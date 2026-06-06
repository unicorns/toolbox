import { describe, it, expect } from 'vitest';
import {
    isNodeSchedulable, getNodeGpuUsage, trimNodeNames,
    computePartitionCapacity, computeClusterTotals,
    computeUserUsage, computeQueueStats, computeHistoryStats,
} from '../insights';
import { detectAndParseAll } from '../parsing';
import type { PartitionData, NodeData, SlurmQueueItem, SlurmHistoryItem } from '../types';

function makeNode(name: string, opts: {
    state: string; cpuTot: number; cpuAlloc: number; memTotMB: number; memAllocMB: number;
    gpuTot?: number; gpuAlloc?: number; reason?: string;
}): [string, NodeData] {
    const gpuCfg = opts.gpuTot != null ? `,gres/gpu=${opts.gpuTot}` : '';
    const gpuAlloc = opts.gpuAlloc ? `,gres/gpu=${opts.gpuAlloc}` : '';
    const details: Record<string, string> = {
        NodeName: name,
        State: opts.state,
        CfgTRES: `cpu=${opts.cpuTot},mem=${opts.memTotMB}M,billing=${opts.cpuTot}${gpuCfg}`,
        AllocTRES: opts.cpuAlloc > 0 || opts.gpuAlloc ? `cpu=${opts.cpuAlloc},mem=${opts.memAllocMB}M${gpuAlloc}` : '',
    };
    if (opts.reason) details.Reason = opts.reason;
    return [name, { details }];
}

function makePartitions(spec: Record<string, string[]>): Map<string, PartitionData> {
    return new Map(Object.entries(spec).map(([name, nodeNames]) => [
        name,
        { nodes: new Set(nodeNames), details: { PartitionName: name } },
    ]));
}

const pendingJob = (id: string, partition: string, reqTres: string): SlurmQueueItem => ({
    JobId: id, Partition: partition, Name: `job${id}`, User: 'u1', State: 'PENDING',
    Time: '0:00', TimeLimit: '1:00:00', Nodes: '1', NodeList: '(Resources)',
    details: { JobId: id, JobState: 'PENDING', ReqTRES: reqTres },
});

describe('isNodeSchedulable', () => {
    it('accepts healthy states', () => {
        expect(isNodeSchedulable('IDLE')).toBe(true);
        expect(isNodeSchedulable('MIXED')).toBe(true);
        expect(isNodeSchedulable('ALLOCATED')).toBe(true);
        expect(isNodeSchedulable('ALLOCATED+COMPLETING')).toBe(true);
    });

    it('rejects down/drained/failed states', () => {
        expect(isNodeSchedulable('DOWN')).toBe(false);
        expect(isNodeSchedulable('IDLE+DRAIN')).toBe(false);
        expect(isNodeSchedulable('MIXED+DRAIN')).toBe(false);
        expect(isNodeSchedulable('DOWN+NOT_RESPONDING')).toBe(false);
        expect(isNodeSchedulable('FAIL')).toBe(false);
        expect(isNodeSchedulable('FAILING')).toBe(false);
        expect(isNodeSchedulable('MAINT')).toBe(false);
        expect(isNodeSchedulable('INVALID')).toBe(false);
    });

    it('rejects nodes already promised or withheld from scheduling', () => {
        expect(isNodeSchedulable('IDLE+PLANNED')).toBe(false);
        expect(isNodeSchedulable('IDLE+RESERVED')).toBe(false);
        expect(isNodeSchedulable('IDLE+POWERED_DOWN')).toBe(false);
        expect(isNodeSchedulable('IDLE+POWERING_UP')).toBe(false);
    });
});

describe('getNodeGpuUsage', () => {
    it('reads totals and allocation from CfgTRES/AllocTRES', () => {
        const details = {
            CfgTRES: 'cpu=256,mem=1400000M,billing=256,gres/gpu=8',
            AllocTRES: 'cpu=64,mem=400000M,gres/gpu=3',
        };
        expect(getNodeGpuUsage(details)).toEqual({ total: 8, allocated: 3 });
    });

    it('treats missing AllocTRES as zero allocated', () => {
        const details = {
            CfgTRES: 'cpu=48,mem=256000M,billing=48,gres/gpu=4,gres/gpu:v100=4',
            AllocTRES: '',
        };
        expect(getNodeGpuUsage(details)).toEqual({ total: 4, allocated: 0 });
    });

    it('falls back to the Gres field when CfgTRES lacks gpu', () => {
        const details = {
            Gres: 'gpu:a100:4',
            CfgTRES: 'cpu=32,mem=256000M,billing=32',
            AllocTRES: '',
        };
        expect(getNodeGpuUsage(details)).toEqual({ total: 4, allocated: 0 });
    });

    it('returns null for nodes without GPUs', () => {
        const details = {
            CfgTRES: 'cpu=32,mem=128000M,billing=32',
            AllocTRES: 'cpu=32,mem=128G',
        };
        expect(getNodeGpuUsage(details)).toBeNull();
    });
});

describe('trimNodeNames', () => {
    it('strips common prefix and suffix', () => {
        const names = ['1xtech-8b200-05-f3', '1xtech-8b200-06-f3', '1xtech-8b200-102-f3'];
        const trimmed = trimNodeNames(names);
        expect(trimmed.get('1xtech-8b200-05-f3')).toBe('05');
        expect(trimmed.get('1xtech-8b200-06-f3')).toBe('06');
        expect(trimmed.get('1xtech-8b200-102-f3')).toBe('102');
    });

    it('keeps the full name for a single node', () => {
        const trimmed = trimNodeNames(['node-a1']);
        expect(trimmed.get('node-a1')).toBe('node-a1');
    });

    it('never produces empty labels', () => {
        const trimmed = trimNodeNames(['node-1', 'node-12']);
        expect(trimmed.get('node-1')).toBe('1');
        expect(trimmed.get('node-12')).toBe('12');
    });

    it('ignores trivial 1-char common affixes', () => {
        const trimmed = trimNodeNames(['alpha', 'beta']);
        expect(trimmed.get('alpha')).toBe('alpha');
        expect(trimmed.get('beta')).toBe('beta');
    });
});

describe('computePartitionCapacity', () => {
    // gpu partition: one mixed node, one idle, one drained-while-running, one fully allocated
    const nodes = new Map([
        makeNode('g1', { state: 'MIXED', cpuTot: 256, cpuAlloc: 64, memTotMB: 1400000, memAllocMB: 400000, gpuTot: 8, gpuAlloc: 3 }),
        makeNode('g2', { state: 'IDLE', cpuTot: 256, cpuAlloc: 0, memTotMB: 1400000, memAllocMB: 0, gpuTot: 8 }),
        makeNode('g3', { state: 'MIXED+DRAIN', cpuTot: 256, cpuAlloc: 128, memTotMB: 1400000, memAllocMB: 700000, gpuTot: 8, gpuAlloc: 4, reason: 'bad DIMM' }),
        makeNode('g4', { state: 'ALLOCATED', cpuTot: 256, cpuAlloc: 256, memTotMB: 1400000, memAllocMB: 1400000, gpuTot: 8, gpuAlloc: 8 }),
        makeNode('c1', { state: 'IDLE+PLANNED', cpuTot: 32, cpuAlloc: 0, memTotMB: 128000, memAllocMB: 0 }),
        makeNode('c2', { state: 'IDLE', cpuTot: 32, cpuAlloc: 0, memTotMB: 128000, memAllocMB: 0 }),
    ]);
    const partitions = makePartitions({ gpu: ['g1', 'g2', 'g3', 'g4'], cpu: ['c1', 'c2'] });

    const capacities = computePartitionCapacity(partitions, nodes, []);
    const gpu = capacities.find(c => c.name === 'gpu')!;
    const cpu = capacities.find(c => c.name === 'cpu')!;

    it('computes free GPUs over schedulable nodes only', () => {
        // g1: 8-3=5 free; g2: 8 free; g3 drained: 0 free; g4: 0 free
        expect(gpu.gpu).toEqual({ total: 32, allocated: 15, free: 13 });
    });

    it('computes largest single-node GPU block', () => {
        expect(gpu.largestFreeGpuBlock).toBe(8);
    });

    it('counts idle nodes excluding unschedulable ones', () => {
        expect(gpu.nodesIdle).toBe(1);
        // c1 is IDLE+PLANNED -> not counted
        expect(cpu.nodesIdle).toBe(1);
    });

    it('lists unavailable nodes with reasons', () => {
        expect(gpu.unavailable).toEqual([{ name: 'g3', state: 'MIXED+DRAIN', reason: 'bad DIMM' }]);
        expect(cpu.unavailable).toEqual([]);
    });

    it('computes CPU and memory pools', () => {
        expect(gpu.cpu).toEqual({ total: 1024, allocated: 448, free: 448 });
        expect(gpu.memMB.total).toBe(5600000);
        expect(gpu.memMB.allocated).toBe(2500000);
        expect(gpu.memMB.free).toBe(2400000);
    });

    it('returns null gpu pool for CPU-only partitions', () => {
        expect(cpu.gpu).toBeNull();
    });

    it('aggregates pending pressure per partition from ReqTRES', () => {
        const queue = [
            pendingJob('1', 'gpu', 'cpu=32,mem=170G,node=1,billing=32,gres/gpu=8'),
            pendingJob('2', 'gpu', 'cpu=16,mem=64G,node=1,billing=16,gres/gpu=4'),
            pendingJob('3', 'cpu', 'cpu=8,mem=32G,node=1,billing=8'),
        ];
        const withPending = computePartitionCapacity(partitions, nodes, queue);
        const gpuPending = withPending.find(c => c.name === 'gpu')!;
        expect(gpuPending.pendingJobs).toBe(2);
        expect(gpuPending.pendingGpus).toBe(12);
        expect(gpuPending.pendingCpus).toBe(48);
    });

    it('counts a multi-partition pending job toward each listed partition', () => {
        const queue = [pendingJob('1', 'gpu,cpu', 'cpu=4,mem=16G,node=1')];
        const withPending = computePartitionCapacity(partitions, nodes, queue);
        expect(withPending.find(c => c.name === 'gpu')!.pendingJobs).toBe(1);
        expect(withPending.find(c => c.name === 'cpu')!.pendingJobs).toBe(1);
    });
});

describe('computeClusterTotals', () => {
    it('deduplicates nodes shared across partitions', () => {
        const nodes = new Map([
            makeNode('n1', { state: 'MIXED', cpuTot: 100, cpuAlloc: 40, memTotMB: 1000, memAllocMB: 400, gpuTot: 8, gpuAlloc: 2 }),
            makeNode('n2', { state: 'IDLE+DRAIN', cpuTot: 100, cpuAlloc: 0, memTotMB: 1000, memAllocMB: 0, gpuTot: 8 }),
        ]);
        const partitions = makePartitions({ a: ['n1', 'n2'], b: ['n1'] });
        const totals = computeClusterTotals(partitions, nodes);
        expect(totals.cpu).toEqual({ total: 200, allocated: 40, free: 60 });
        expect(totals.gpu).toEqual({ total: 16, allocated: 2, free: 6 });
        expect(totals.nodesTotal).toBe(2);
        expect(totals.nodesIdle).toBe(0);
        expect(totals.nodesUnavailable).toBe(1);
    });
});

function runningJob(id: string, user: string, nodeList: string, allocTres: string, startTime: string): SlurmQueueItem {
    return {
        JobId: id, Partition: 'gpu', Name: `job${id}`, User: user, State: 'RUNNING',
        Time: '1:00:00', TimeLimit: '2:00:00', Nodes: '1', NodeList: nodeList,
        details: { JobId: id, JobState: 'RUNNING', AllocTRES: allocTres, StartTime: startTime, NodeList: nodeList },
    };
}

describe('computeUserUsage', () => {
    it('aggregates running jobs per user, sorted by GPUs desc', () => {
        const queue = [
            runningJob('1', 'alice', 'n[1-2]', 'cpu=64,mem=200G,node=2,gres/gpu=16', '2026-06-01T10:00:00'),
            runningJob('2', 'bob', 'n3', 'cpu=32,mem=100G,node=1,gres/gpu=8', '2026-06-02T10:00:00'),
            runningJob('3', 'alice', 'n4', 'cpu=8,mem=50G,node=1,gres/gpu=2', '2026-06-03T10:00:00'),
        ];
        const usage = computeUserUsage(queue);
        expect(usage.map(u => u.user)).toEqual(['alice', 'bob']);
        expect(usage[0]).toMatchObject({ user: 'alice', jobCount: 2, nodeCount: 3, gpus: 18, cpus: 72 });
        expect(usage[0].memMB).toBe(250 * 1024);
        expect(usage[0].oldestStart).toBe('2026-06-01T10:00:00');
        expect(usage[0].jobs.map(j => j.JobId)).toEqual(['1', '3']);
    });

    it('counts shared nodes once per user', () => {
        const queue = [
            runningJob('1', 'alice', 'n1', 'cpu=8,mem=10G,node=1,gres/gpu=1', '2026-06-01T10:00:00'),
            runningJob('2', 'alice', 'n1', 'cpu=8,mem=10G,node=1,gres/gpu=1', '2026-06-01T11:00:00'),
        ];
        expect(computeUserUsage(queue)[0].nodeCount).toBe(1);
    });

    it('ignores pending jobs and counts detail-less running jobs with zero resources', () => {
        const queue: SlurmQueueItem[] = [
            { JobId: '1', Partition: 'gpu', Name: 'j', User: 'alice', State: 'PENDING', Time: '0:00', TimeLimit: '1:00', Nodes: '1', NodeList: '(Resources)' },
            { JobId: '2', Partition: 'gpu', Name: 'j', User: 'bob', State: 'RUNNING', Time: '0:10', TimeLimit: '1:00', Nodes: '2', NodeList: 'n[1-2]' },
        ];
        const usage = computeUserUsage(queue);
        expect(usage.length).toBe(1);
        expect(usage[0]).toMatchObject({ user: 'bob', jobCount: 1, nodeCount: 2, gpus: 0, cpus: 0 });
        expect(usage[0].oldestStart).toBeNull();
    });
});

describe('computeQueueStats', () => {
    it('buckets jobs by state', () => {
        const job = (state: string): SlurmQueueItem => ({
            JobId: '1', Partition: 'p', Name: 'n', User: 'u', State: state,
            Time: '', TimeLimit: '', Nodes: '1', NodeList: '',
        });
        const stats = computeQueueStats([job('RUNNING'), job('RUNNING'), job('PENDING'), job('COMPLETING')]);
        expect(stats).toEqual({ total: 4, running: 2, pending: 1, other: 1 });
    });
});

describe('computeHistoryStats', () => {
    const histJob = (id: string, state: string): SlurmHistoryItem => ({
        JobID: id, JobName: 'j', User: 'u', Partition: 'p', State: state,
        Start: '', End: '', Elapsed: '', ReqMem: '', ReqCPUS: '', ReqTRES: '',
    });

    it('counts jobs by state, grouping CANCELLED-by variants', () => {
        const stats = computeHistoryStats([
            histJob('1', 'COMPLETED'), histJob('2', 'COMPLETED'), histJob('3', 'FAILED'),
            histJob('4', 'CANCELLED by 1002'), histJob('5', 'CANCELLED'), histJob('6', 'OUT_OF_MEMORY'),
        ]);
        expect(stats).toEqual([
            { state: 'COMPLETED', count: 2 },
            { state: 'CANCELLED', count: 2 },
            { state: 'FAILED', count: 1 },
            { state: 'OUT_OF_MEMORY', count: 1 },
        ]);
    });
});

describe('parseDurationSeconds', () => {
    it('parses slurm duration formats', async () => {
        const { parseDurationSeconds } = await import('../insights');
        expect(parseDurationSeconds('10:34')).toBe(634);
        expect(parseDurationSeconds('1:36:51')).toBe(5811);
        expect(parseDurationSeconds('2-00:00:00')).toBe(172800);
        expect(parseDurationSeconds('15-01:23:32')).toBe(1301012);
    });

    it('returns null for unlimited or non-durations', async () => {
        const { parseDurationSeconds } = await import('../insights');
        expect(parseDurationSeconds('UNLIMITED')).toBeNull();
        expect(parseDurationSeconds('')).toBeNull();
        expect(parseDurationSeconds('N/A')).toBeNull();
    });
});

describe('node Reason extraction', () => {
    it('captures multi-word drain reasons from scontrol node lines', () => {
        const raw = 'NodeName=g3 Arch=x86_64 CPUAlloc=0 CPUTot=256 State=IDLE+DRAIN Partitions=gpu CfgTRES=cpu=256,mem=1400000M AllocTRES= CurrentWatts=0 AveWatts=0 Reason=Kill task failed [root@2026-06-01T10:00:00]';
        const parsed = detectAndParseAll(raw);
        expect(parsed.nodes.get('g3')?.details.Reason).toBe('Kill task failed [root@2026-06-01T10:00:00]');
    });
});
