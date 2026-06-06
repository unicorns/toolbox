import type {
    SlurmQueueItem, PartitionData, NodeData, ResourcePool, UnavailableNode,
    PartitionCapacity, ClusterTotals, UserUsage, QueueStats, HistoryStateCount, SlurmHistoryItem,
} from './types';
import { parseTRES, parseGresField, parseUnitValue, parseMemoryToMB, expandNodeList } from './parsing';

/** States indicating a fault or operator intervention — shown as ⚠ unavailable. */
const UNHEALTHY_TOKENS = ['DOWN', 'DRAIN', 'FAIL', 'MAINT', 'INVAL', 'NOT_RESPONDING'];

/**
 * States whose unallocated capacity cannot receive new work right now.
 * Superset of unhealthy: PLANNED/RESERVED/POWER* nodes are fine, but their
 * free capacity is already promised or offline.
 */
const UNSCHEDULABLE_TOKENS = [...UNHEALTHY_TOKENS, 'POWER', 'RESERVED', 'PLANNED'];

export function isNodeUnhealthy(state: string): boolean {
    const upper = state.toUpperCase();
    return UNHEALTHY_TOKENS.some(token => upper.includes(token));
}

export function isNodeSchedulable(state: string): boolean {
    const upper = state.toUpperCase();
    return !UNSCHEDULABLE_TOKENS.some(token => upper.includes(token));
}

function sumGpuEntries(entries: Record<string, number>): number {
    return Object.entries(entries)
        .filter(([key]) => key === 'gpu' || key.startsWith('gpu:'))
        .reduce((sum, [, value]) => sum + value, 0);
}

export function getNodeGpuUsage(details: Record<string, string>): { total: number; allocated: number } | null {
    const cfgGpu = parseTRES(details.CfgTRES ?? '').gres['gpu'];
    const total = cfgGpu != null ? parseUnitValue(cfgGpu) : sumGpuEntries(parseGresField(details.Gres ?? ''));
    if (total === 0) return null;
    const allocated = parseUnitValue(parseTRES(details.AllocTRES ?? '').gres['gpu'] ?? '0');
    return { total, allocated };
}

/**
 * Maps each node name to a short label with the longest common prefix and
 * suffix stripped (e.g. `1xtech-8b200-05-f3` → `05`), shrinking the strips
 * as needed so no label ends up empty.
 */
export function trimNodeNames(names: string[]): Map<string, string> {
    if (names.length < 2) {
        return new Map(names.map(name => [name, name]));
    }

    const commonAffixLength = (fromEnd: boolean): number => {
        let length = 0;
        const reference = names[0];
        while (length < reference.length) {
            const char = fromEnd ? reference[reference.length - 1 - length] : reference[length];
            const mismatch = names.some(name =>
                length >= name.length || (fromEnd ? name[name.length - 1 - length] : name[length]) !== char
            );
            if (mismatch) break;
            length++;
        }
        return length;
    };

    let prefix = commonAffixLength(false);
    let suffix = commonAffixLength(true);
    const minLength = Math.min(...names.map(name => name.length));
    while (prefix + suffix >= minLength) {
        if (prefix >= suffix) prefix--; else suffix--;
    }
    // A 1-char shared affix is coincidence, not a naming convention.
    if (prefix < 2) prefix = 0;
    if (suffix < 2) suffix = 0;

    return new Map(names.map(name => [name, name.slice(prefix, name.length - suffix)]));
}

interface NodeAggregate {
    gpu: ResourcePool;
    hasGpu: boolean;
    cpu: ResourcePool;
    memMB: ResourcePool;
    nodesTotal: number;
    nodesIdle: number;
    largestFreeGpuBlock: number;
    unavailable: UnavailableNode[];
}

function aggregateNodes(nodeNames: Iterable<string>, nodes: Map<string, NodeData>): NodeAggregate {
    const gpu = { total: 0, allocated: 0, free: 0 };
    const cpu = { total: 0, allocated: 0, free: 0 };
    const memMB = { total: 0, allocated: 0, free: 0 };
    let hasGpu = false;
    let nodesTotal = 0;
    let nodesIdle = 0;
    let largestFreeGpuBlock = 0;
    const unavailable: UnavailableNode[] = [];

    for (const name of nodeNames) {
        const node = nodes.get(name);
        if (!node) continue; // partition-only pastes have no node section
        const details = node.details;
        const state = details.State ?? '';
        const schedulable = isNodeSchedulable(state);

        const cfgTRES = parseTRES(details.CfgTRES ?? '');
        const allocTRES = parseTRES(details.AllocTRES ?? '');
        const cpuTot = parseInt(cfgTRES.cpu || details.CPUTot || '0') || 0;
        const cpuAlloc = parseInt(allocTRES.cpu || details.CPUAlloc || '0') || 0;
        const memTot = parseMemoryToMB(cfgTRES.mem || details.RealMemory);
        const memAlloc = parseMemoryToMB(allocTRES.mem || details.AllocMem);

        nodesTotal++;
        cpu.total += cpuTot;
        cpu.allocated += cpuAlloc;
        memMB.total += memTot;
        memMB.allocated += memAlloc;
        if (schedulable) {
            cpu.free += cpuTot - cpuAlloc;
            memMB.free += memTot - memAlloc;
            if (state.toUpperCase().includes('IDLE')) nodesIdle++;
        }
        if (isNodeUnhealthy(state)) {
            unavailable.push({ name, state, reason: details.Reason ?? null });
        }

        const gpuUsage = getNodeGpuUsage(details);
        if (gpuUsage) {
            hasGpu = true;
            gpu.total += gpuUsage.total;
            gpu.allocated += gpuUsage.allocated;
            if (schedulable) {
                const freeOnNode = gpuUsage.total - gpuUsage.allocated;
                gpu.free += freeOnNode;
                largestFreeGpuBlock = Math.max(largestFreeGpuBlock, freeOnNode);
            }
        }
    }

    return { gpu, hasGpu, cpu, memMB, nodesTotal, nodesIdle, largestFreeGpuBlock, unavailable };
}

function isPending(job: SlurmQueueItem): boolean {
    return job.State === 'PENDING' || job.State === 'PD';
}

export function computePartitionCapacity(
    partitions: Map<string, PartitionData>,
    nodes: Map<string, NodeData>,
    queue: SlurmQueueItem[],
): PartitionCapacity[] {
    return Array.from(partitions.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, partition]) => {
            const agg = aggregateNodes(partition.nodes, nodes);

            let pendingJobs = 0, pendingGpus = 0, pendingCpus = 0;
            for (const job of queue) {
                if (!isPending(job) || !job.Partition.split(',').includes(name)) continue;
                pendingJobs++;
                const req = parseTRES(job.details?.ReqTRES ?? '');
                pendingGpus += parseUnitValue(req.gres['gpu'] ?? '0');
                pendingCpus += parseInt(req.cpu) || 0;
            }

            return {
                name,
                gpu: agg.hasGpu ? agg.gpu : null,
                cpu: agg.cpu,
                memMB: agg.memMB,
                nodesTotal: agg.nodesTotal,
                nodesIdle: agg.nodesIdle,
                largestFreeGpuBlock: agg.largestFreeGpuBlock,
                unavailable: agg.unavailable,
                pendingJobs, pendingGpus, pendingCpus,
            };
        });
}

export function computeClusterTotals(
    partitions: Map<string, PartitionData>,
    nodes: Map<string, NodeData>,
): ClusterTotals {
    const allNodeNames = new Set<string>();
    for (const partition of partitions.values()) {
        for (const name of partition.nodes) allNodeNames.add(name);
    }
    const agg = aggregateNodes(allNodeNames, nodes);
    return {
        gpu: agg.gpu,
        cpu: agg.cpu,
        memMB: agg.memMB,
        nodesTotal: agg.nodesTotal,
        nodesIdle: agg.nodesIdle,
        nodesUnavailable: agg.unavailable.length,
    };
}

function isRunning(job: SlurmQueueItem): boolean {
    return job.State === 'RUNNING' || job.State === 'R';
}

export function computeUserUsage(queue: SlurmQueueItem[]): UserUsage[] {
    const byUser = new Map<string, UserUsage & { nodes: Set<string> }>();

    for (const job of queue) {
        if (!isRunning(job)) continue;
        let usage = byUser.get(job.User);
        if (!usage) {
            usage = { user: job.User, jobCount: 0, nodeCount: 0, gpus: 0, cpus: 0, memMB: 0, oldestStart: null, jobs: [], nodes: new Set() };
            byUser.set(job.User, usage);
        }

        usage.jobCount++;
        usage.jobs.push(job);
        for (const node of expandNodeList(job.NodeList ?? '')) usage.nodes.add(node);

        const tres = parseTRES(job.details?.AllocTRES ?? '');
        usage.gpus += parseUnitValue(tres.gres['gpu'] ?? '0');
        usage.cpus += parseInt(tres.cpu) || 0;
        usage.memMB += parseMemoryToMB(tres.mem);

        const start = job.details?.StartTime;
        if (start && start !== 'Unknown' && (usage.oldestStart === null || start < usage.oldestStart)) {
            usage.oldestStart = start;
        }
    }

    return Array.from(byUser.values())
        .map(({ nodes, ...usage }) => ({ ...usage, nodeCount: nodes.size }))
        .sort((a, b) => b.gpus - a.gpus || b.cpus - a.cpus || a.user.localeCompare(b.user));
}

export function computeQueueStats(queue: SlurmQueueItem[]): QueueStats {
    let running = 0, pending = 0, other = 0;
    for (const job of queue) {
        if (isRunning(job)) running++;
        else if (isPending(job)) pending++;
        else other++;
    }
    return { total: queue.length, running, pending, other };
}

/** `CANCELLED by <uid>` collapses to CANCELLED so the chips stay tidy. */
function normalizeHistoryState(state: string): string {
    return state.startsWith('CANCELLED') ? 'CANCELLED' : state;
}

export function computeHistoryStats(history: SlurmHistoryItem[]): HistoryStateCount[] {
    const counts = new Map<string, number>();
    for (const job of history) {
        const state = normalizeHistoryState(job.State);
        counts.set(state, (counts.get(state) ?? 0) + 1);
    }
    return Array.from(counts.entries())
        .map(([state, count]) => ({ state, count }))
        .sort((a, b) => b.count - a.count);
}
