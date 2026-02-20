import type { SlurmData, SlurmQueueItem, SlurmHistoryItem, TresResources, TimezoneMode, PartitionData, NodeData, PartitionResourceSummary, ClusterResourceSummary, GresTypeSummary } from './types';

// --- CONSTANTS ---

export const SLURM_COMMAND = `scontrol show partition --oneliner; echo "---"; scontrol show node --oneliner; echo "---"; squeue --all -o "%.18i %.9P %.30j %.8u %.8T %.10M %.10l %.6D %R"; echo "---"; scontrol show job --oneliner; echo "---"; sacct -a --starttime "now-1day" --parsable2 --format=JobID,JobName,User,Partition,State,Start,End,Elapsed,ReqMem,ReqCPUS,ReqTRES; echo "---"; date --iso-8601=seconds`;

export const ANONYMIZED_EXAMPLE_DATA = `PartitionName=gpu-high AllowGroups=ALL AllowAccounts=project-alpha AllowQos=ALL AllocNodes=ALL Default=NO QoS=gpu_qos DefaultTime=NONE DisableRootJobs=NO ExclusiveUser=NO GraceTime=0 Hidden=NO MaxNodes=UNLIMITED MaxTime=7-00:00:00 MinNodes=0 LLN=NO MaxCPUsPerNode=UNLIMITED Nodes=node-a1,node-b[1-2] PriorityJobFactor=1 PriorityTier=100 RootOnly=NO ReqResv=NO OverSubscribe=FORCE:1 OverTimeLimit=NONE PreemptMode=REQUEUE State=UP TotalCPUs=128 TotalNodes=3 SelectTypeParameters=NONE JobDefaults=(null) DefMemPerNode=UNLIMITED MaxMemPerNode=UNLIMITED
PartitionName=cpu-low AllowGroups=ALL AllowAccounts=ALL AllowQos=ALL AllocNodes=ALL Default=YES QoS=N/A DefaultTime=00:30:00 DisableRootJobs=NO ExclusiveUser=NO ExclusiveTopo=NO GraceTime=0 Hidden=NO MaxNodes=UNLIMITED MaxTime=1-00:00:00 MinNodes=0 LLN=NO MaxCPUsPerNode=UNLIMITED MaxCPUsPerSocket=UNLIMITED Nodes=node-c[1-2] PriorityJobFactor=1 PriorityTier=1 RootOnly=NO ReqResv=NO OverSubscribe=NO OverTimeLimit=NONE PreemptMode=OFF State=UP TotalCPUs=64 TotalNodes=2 SelectTypeParameters=NONE JobDefaults=(null) DefMemPerNode=UNLIMITED MaxMemPerNode=UNLIMITED TRES=cpu=64,mem=256000M,node=2,billing=64
---
NodeName=node-a1 Arch=x86_64 CoresPerSocket=1 CPUAlloc=8 CPUTot=32 CPULoad=8.60 Gres=gpu:a100:4 NodeAddr=node-a1.cluster.local NodeHostName=node-a1 Version=23.02.7 OS=Linux 5.15.0-107-generic RealMemory=256000 AllocMem=128000 FreeMem=120000 State=MIXED Partitions=gpu-high BootTime=2025-06-13T12:51:10 SlurmdStartTime=2025-06-13T12:51:56 CfgTRES=cpu=32,mem=256000M,billing=32,gres/gpu=4,gres/gpu:a100=4 AllocTRES=cpu=8,mem=128G,gres/gpu=2,gres/gpu:a100=2
NodeName=node-b1 Arch=x86_64 CoresPerSocket=1 CPUAlloc=48 CPUTot=48 CPULoad=47.1 Gres=gpu:v100:4 NodeAddr=node-b1.cluster.local NodeHostName=node-b1 Version=23.02.7 OS=Linux 5.15.0-107-generic RealMemory=256000 AllocMem=256000 FreeMem=1000 State=ALLOCATED Partitions=gpu-high BootTime=2025-06-13T12:51:10 SlurmdStartTime=2025-06-13T12:51:56 CfgTRES=cpu=48,mem=256000M,billing=48,gres/gpu=4,gres/gpu:v100=4 AllocTRES=cpu=48,mem=256G,gres/gpu=4,gres/gpu:v100=4
NodeName=node-b2 Arch=x86_64 CoresPerSocket=1 CPUAlloc=0 CPUTot=48 CPULoad=0.01 Gres=gpu:v100:4 NodeAddr=node-b2.cluster.local NodeHostName=node-b2 Version=23.02.7 OS=Linux 5.15.0-107-generic RealMemory=256000 AllocMem=0 FreeMem=255000 State=IDLE Partitions=gpu-high BootTime=2025-06-13T12:51:10 SlurmdStartTime=2025-06-13T12:51:56 CfgTRES=cpu=48,mem=256000M,billing=48,gres/gpu=4,gres/gpu:v100=4 AllocTRES=
NodeName=node-c1 Arch=x86_64 CoresPerSocket=1 CPUAlloc=32 CPUTot=32 CPULoad=32.0 Gres=tmpfs:100G NodeAddr=node-c1.cluster.local NodeHostName=node-c1 Version=23.02.7 OS=Linux 5.15.0-107-generic RealMemory=128000 AllocMem=128000 FreeMem=100 State=ALLOCATED Partitions=cpu-low BootTime=2025-06-13T12:51:10 SlurmdStartTime=2025-06-13T12:51:56 CfgTRES=cpu=32,mem=128000M,billing=32 AllocTRES=cpu=32,mem=128G
NodeName=node-c2 Arch=x86_64 CoresPerSocket=1 CPUAlloc=0 CPUTot=32 CPULoad=0.0 Gres=tmpfs:100G NodeAddr=node-c2.cluster.local NodeHostName=node-c2 Version=23.02.7 OS=Linux 5.15.0-107-generic RealMemory=128000 AllocMem=0 FreeMem=127000 State=IDLE Partitions=cpu-low BootTime=2025-06-13T12:51:10 SlurmdStartTime=2025-06-13T12:51:56 CfgTRES=cpu=32,mem=128000M,billing=32 AllocTRES=
---
             JOBID PARTITION                          NAME     USER      STATE       TIME  TIME_LIMIT  NODES NODELIST(REASON)
           1336199  gpu-high                    train_model    user1    RUNNING      10:34  3-00:00:00      1 node-a1
           1336189   cpu-low                    data_proc_1    user2    RUNNING   1-00:27:16  3-00:00:00      1 node-c1
           1336183  gpu-high                    interactive    admin    RUNNING    1:36:51     7:00:00      1 node-b1
           1336180  gpu-high             jupyter-notebook    user1    RUNNING    1:47:05     4:00:00      1 node-b1
           1336166  gpu-high                    interactive    user2    RUNNING    2:48:07     3:00:00      1 node-b1
           1336162   cpu-low                    data_proc_2    user2    PENDING       0:00  1-00:00:00      1 (Resources)
---
JobId=1336199 JobName=train_model UserId=user1(1001) GroupId=project-alpha(2001) JobState=RUNNING Partition=gpu-high StartTime=2025-07-04T10:10:30 EndTime=2025-07-07T10:10:30 NodeList=node-a1 AllocTRES=cpu=8,mem=64G,node=1,billing=8,gres/gpu=1,gres/gpu:a100=1
JobId=1336189 JobName=data_proc_1 UserId=user2(1002) GroupId=project-beta(2002) JobState=RUNNING Partition=cpu-low StartTime=2025-07-03T20:43:48 EndTime=2025-07-06T20:43:48 NodeList=node-c1 AllocTRES=cpu=32,mem=128G,node=1,billing=32
JobId=1336183 JobName=interactive UserId=admin(1000) GroupId=admin-group(2000) JobState=RUNNING Partition=gpu-high StartTime=2025-07-04T19:34:13 EndTime=2025-07-05T02:34:13 NodeList=node-b1 AllocTRES=cpu=16,mem=64G,node=1,billing=16,gres/gpu=2,gres/gpu:v100=2
JobId=1336180 JobName=jupyter-notebook UserId=user1(1001) GroupId=project-alpha(2001) JobState=RUNNING Partition=gpu-high StartTime=2025-07-04T19:23:59 EndTime=2025-07-04T23:23:59 NodeList=node-b1 AllocTRES=cpu=16,mem=64G,node=1,billing=16,gres/gpu=1
JobId=1336166 JobName=interactive UserId=user2(1002) GroupId=project-beta(2002) JobState=RUNNING Partition=gpu-high StartTime=2025-07-04T18:22:57 EndTime=2025-07-04T21:22:57 NodeList=node-b1 AllocTRES=cpu=16,mem=128G,node=1,billing=16,gres/gpu=1,gres/gpu:v100=2
JobId=1336162 JobName=data_proc_2 UserId=user2(1002) GroupId=project-beta(2002) JobState=PENDING Partition=cpu-low StartTime=Unknown EndTime=Unknown NodeList=(null) ReqTRES=cpu=16,mem=64G,node=1,billing=16
---
JobID|JobName|User|Partition|State|Start|End|Elapsed|ReqMem|ReqCPUS|ReqTRES
1336135|grounding|user1|gpu-high|COMPLETED|2025-07-04T15:29:40|2025-07-04T21:07:32|05:37:52|32000Mc|2|gpu:1
1336135.batch|batch|user1|gpu-high|COMPLETED|2025-07-04T15:29:41|2025-07-04T21:07:32|05:37:51|||
1336136|grounding|user1|gpu-high|FAILED|2025-07-04T15:29:40|2025-07-04T21:06:48|05:37:08|32000Mc|2|gpu:1
1336196|robo|user2|gpu-high|CANCELLED by 1002|2025-07-04T21:02:37|2025-07-04T21:06:42|00:04:05|16000Mc|8|gpu:mligpu:1
1336197|robo|user2|gpu-high|OUT_OF_MEMORY|2025-07-04T21:07:00|2025-07-04T21:07:37|00:00:37|32000Mc|16|gpu:mligpu:1
---
2025-07-04T21:22:47-07:00`;


// --- PARSING & UTILITY FUNCTIONS ---

export function parseKeyValueString(str: string): Record<string, string> {
    const data: Record<string, string> = {};
    for (const pair of str.split(' ')) {
        const [key, ...valueParts] = pair.split('=');
        if (key) data[key] = valueParts.join('=');
    }
    return data;
}

export function expandNodeList(nodesStr: string): string[] {
    if (!nodesStr || nodesStr === '(null)') return [];
    const finalNodes = new Set<string>();
    const nodeTokens = nodesStr.match(/[^,[]+\[[^\]]+\]|[^,]+/g) ?? [];
    for (const token of nodeTokens) {
        const match = /^([^[]+)\[([^\]]+)\](.*)$/.exec(token);
        if (match) {
            const prefix = match[1];
            const rangeStr = match[2];
            const suffix = match[3] ?? '';
            for (const item of rangeStr.split(',')) {
                const rangeMatch = /^(\d+)-(\d+)$/.exec(item);
                if (rangeMatch) {
                    const start = parseInt(rangeMatch[1]);
                    const end = parseInt(rangeMatch[2]);
                    const padding = rangeMatch[1].length;
                    for (let i = start; i <= end; i++) {
                        finalNodes.add(`${prefix}${String(i).padStart(padding, '0')}${suffix}`);
                    }
                } else {
                    finalNodes.add(`${prefix}${item}${suffix}`);
                }
            }
        } else if (token) {
            finalNodes.add(token);
        }
    }
    return Array.from(finalNodes);
}

export function parseMemoryToMB(memString: string): number {
    if (!memString) return 0;
    const value = parseFloat(memString);
    if (isNaN(value)) return 0;
    const unit = memString.slice(-1).toUpperCase();
    switch (unit) {
        case 'G': return value * 1024;
        case 'T': return value * 1024 * 1024;
        case 'K': return value / 1024;
        case 'M': default: return value;
    }
}

export function parseUnitValue(valueString: string): number {
    if (!valueString) return 0;
    const value = parseFloat(valueString);
    if (isNaN(value)) return 0;
    const unit = /[KMG]$/i.exec(valueString);
    if (!unit) return value;
    switch (unit[0].toUpperCase()) {
        case 'K': return value * 1000;
        case 'M': return value * 1000 * 1000;
        case 'G': return value * 1000 * 1000 * 1000;
        default: return value;
    }
}

export function parseGresField(gresString: string): Record<string, number> {
    const gresMap: Record<string, number> = {};
    if (!gresString) return gresMap;
    for (const g of gresString.split(',')) {
        const parts = g.split(':');
        if (parts.length >= 2) {
            const gresName = parts.slice(0, -1).join(':');
            const valueStr = parts[parts.length - 1].replace(/\(.*\)/, '');
            gresMap[gresName] = parseUnitValue(valueStr);
        }
    }
    return gresMap;
}

export function parseTRES(tresString: string): TresResources {
    const resources: TresResources = { cpu: '0', mem: 'N/A', gres: {} };
    if (!tresString) return resources;
    for (const res of tresString.split(',')) {
        const [key, value] = res.split('=');
        if (key === 'cpu') {
            resources.cpu = value;
        } else if (key === 'mem') {
            resources.mem = value;
        } else if (key.startsWith('gres/')) {
            resources.gres[key.substring(5)] = value;
        }
    }
    return resources;
}

function formatRelativeTime(ms: number): string {
    if (ms < 0) ms = -ms;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

export function getRelativeTimeString(
    timeString: string,
    timeZoneMode: TimezoneMode,
    detectedTimezone: string | null,
    pastSuffix = 'ago',
    futurePrefix = 'in'
): string {
    if (!timeString || timeString === 'Unknown' || timeString === 'N/A') {
        return '';
    }

    let dateString = timeString;
    const hasOffset = /Z$|[-+]\d{2}:\d{2}$/.test(timeString);

    if (!hasOffset) {
        if (timeZoneMode === 'utc' || (timeZoneMode === 'auto' && detectedTimezone === 'Z')) {
            dateString = `${timeString}Z`;
        } else if (timeZoneMode === 'auto' && detectedTimezone) {
            dateString = `${timeString}${detectedTimezone}`;
        }
    }

    const now = new Date();
    const targetDate = new Date(dateString);
    if (isNaN(targetDate.getTime())) return '';
    const diff = now.getTime() - targetDate.getTime();

    if (diff > 0) {
        return `${formatRelativeTime(diff)} ${pastSuffix}`;
    }
    return `${futurePrefix} ${formatRelativeTime(-diff)}`;
}

export function formatMemoryMB(mb: number): string {
    if (mb >= 1024 * 1024) return `${(mb / (1024 * 1024)).toFixed(1)} TiB`;
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GiB`;
    return `${mb.toFixed(0)} MiB`;
}

function getGresTotal(key: string, cfgTRES: TresResources, configuredGres: Record<string, number>): number {
    if (cfgTRES.gres[key] != null) return parseUnitValue(cfgTRES.gres[key]);
    return configuredGres[key] ?? 0;
}

function getGresAlloc(key: string, allocTRES: TresResources): number {
    return parseUnitValue(allocTRES.gres[key] ?? '0');
}

function aggregateNodeResources(
    nodeNames: Iterable<string>,
    nodes: Map<string, NodeData>,
): Omit<PartitionResourceSummary, 'partitionName'> {
    let nodesTotal = 0, nodesUp = 0, nodesDown = 0;
    let cpuTotal = 0, cpuAllocated = 0;
    let memTotalMB = 0, memAllocatedMB = 0;
    const gresMap = new Map<string, { total: number; allocated: number }>();

    for (const nodeName of nodeNames) {
        const node = nodes.get(nodeName);
        if (!node) continue;
        const details = node.details;

        nodesTotal++;
        const state = details.State ?? '';
        if (state.includes('DOWN') || state.includes('DRAIN')) {
            nodesDown++;
        } else {
            nodesUp++;
        }

        const cfgTRES = parseTRES(details.CfgTRES ?? '');
        const allocTRES = parseTRES(details.AllocTRES ?? '');

        cpuTotal += parseInt(cfgTRES.cpu || details.CPUTot || '0') || 0;
        cpuAllocated += parseInt(allocTRES.cpu || details.CPUAlloc || '0') || 0;
        memTotalMB += parseMemoryToMB(cfgTRES.mem || details.RealMemory);
        memAllocatedMB += parseMemoryToMB(allocTRES.mem || details.AllocMem);

        const configuredGres = parseGresField(details.Gres ?? '');
        const allGresKeys = new Set([
            ...Object.keys(cfgTRES.gres),
            ...Object.keys(allocTRES.gres),
            ...Object.keys(configuredGres),
        ]);

        for (const key of allGresKeys) {
            const total = getGresTotal(key, cfgTRES, configuredGres);
            const alloc = getGresAlloc(key, allocTRES);
            if (total === 0 && alloc === 0) continue;
            const existing = gresMap.get(key) ?? { total: 0, allocated: 0 };
            gresMap.set(key, {
                total: existing.total + total,
                allocated: existing.allocated + alloc,
            });
        }
    }

    const gres: GresTypeSummary[] = Array.from(gresMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, { total, allocated }]) => ({ type, total, allocated }));

    return {
        nodesTotal, nodesUp, nodesDown,
        cpuTotal, cpuAllocated,
        memTotalMB, memAllocatedMB,
        gres,
    };
}

export function computeClusterSummary(
    partitions: Map<string, PartitionData>,
    nodes: Map<string, NodeData>,
): ClusterResourceSummary {
    const partitionSummaries: PartitionResourceSummary[] = Array.from(partitions.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, partition]) => ({
            partitionName: name,
            ...aggregateNodeResources(partition.nodes, nodes),
        }));

    const allNodeNames = new Set<string>();
    for (const partition of partitions.values()) {
        for (const node of partition.nodes) {
            allNodeNames.add(node);
        }
    }

    const totals: PartitionResourceSummary = {
        partitionName: 'Total',
        ...aggregateNodeResources(allNodeNames, nodes),
    };

    return { partitions: partitionSummaries, totals };
}

export function detectAndParseAll(rawData: string): SlurmData {
    const lines = rawData.split('\n');
    const partitionLines: string[] = [];
    const nodeLines: string[] = [];
    const squeueLines: string[] = [];
    const jobDetailLines: string[] = [];
    const sacctLines: string[] = [];
    let squeueHeaderDetected = false;
    let sacctHeaderDetected = false;
    let dateLine: string | null = null;
    let detectedTimezone: string | null = null;

    // Classify each line into the appropriate section
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('---') || trimmedLine === '') continue;

        const isoDateMatch = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})([-+]\d{2}:\d{2}|Z)/.exec(trimmedLine);

        if (isoDateMatch && trimmedLine.length < 50) {
            dateLine = trimmedLine;
            detectedTimezone = isoDateMatch[2];
        } else if (trimmedLine.startsWith('PartitionName=')) {
            partitionLines.push(trimmedLine);
        } else if (trimmedLine.startsWith('NodeName=')) {
            nodeLines.push(trimmedLine);
        } else if (trimmedLine.startsWith('JobId=')) {
            jobDetailLines.push(trimmedLine);
        } else if (trimmedLine.startsWith('JobID|JobName|')) {
            sacctHeaderDetected = true;
        } else if (sacctHeaderDetected) {
            sacctLines.push(trimmedLine);
        } else if (trimmedLine.startsWith('JOBID') && trimmedLine.includes('PARTITION')) {
            squeueHeaderDetected = true;
        } else if (squeueHeaderDetected) {
            squeueLines.push(trimmedLine);
        }
    }

    // Parse partitions
    const partitions = new Map<string, PartitionData>();
    for (const line of partitionLines) {
        const details = parseKeyValueString(line);
        if (details.PartitionName) {
            partitions.set(details.PartitionName, {
                nodes: new Set(expandNodeList(details.Nodes ?? '')),
                details,
            });
        }
    }

    // Parse nodes
    const nodes = new Map<string, NodeData>();
    for (const line of nodeLines) {
        const details = parseKeyValueString(line);
        if (details.NodeName) {
            nodes.set(details.NodeName, { details });
        }
    }

    // Parse squeue output
    const queue: SlurmQueueItem[] = [];
    for (const line of squeueLines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 8) {
            queue.push({
                JobId: parts[0], Partition: parts[1], Name: parts[2], User: parts[3], State: parts[4],
                Time: parts[5], TimeLimit: parts[6], Nodes: parts[7], NodeList: parts.slice(8).join(' '),
            });
        }
    }

    // Merge scontrol job details into queue entries
    for (const line of jobDetailLines) {
        const details = parseKeyValueString(line);
        const jobId = details.JobId;
        if (!jobId) continue;
        const jobIndex = queue.findIndex((j) => j.JobId === jobId);
        if (jobIndex !== -1) {
            queue[jobIndex] = { ...queue[jobIndex], details };
        } else {
            queue.push({
                JobId: jobId,
                Partition: details.Partition ?? '',
                Name: details.JobName ?? '',
                User: (details.UserId ?? '').split('(')[0],
                State: details.JobState ?? '',
                Time: details.RunTime ?? '',
                TimeLimit: details.TimeLimit ?? '',
                Nodes: details.NodeList ?? '',
                NodeList: details.NodeList ?? '',
                details,
            });
        }
    }

    // Parse sacct history, grouping steps under their parent job
    const jobMap = new Map<string, SlurmHistoryItem>();
    for (const line of sacctLines) {
        if (!line) continue;
        const parts = line.split('|');
        if (parts.length < 8) continue;
        const jobData: SlurmHistoryItem = {
            JobID: parts[0], JobName: parts[1], User: parts[2], Partition: parts[3], State: parts[4],
            Start: parts[5], End: parts[6], Elapsed: parts[7], ReqMem: parts[8], ReqCPUS: parts[9], ReqTRES: parts[10],
        };
        const baseJobId = jobData.JobID.split('.')[0];
        const isStep = jobData.JobID.includes('.');
        const existingJob = jobMap.get(baseJobId);
        if (!existingJob) {
            jobMap.set(baseJobId, { ...jobData, steps: [] });
        } else if (!isStep) {
            Object.assign(existingJob, jobData);
        }
        if (isStep) {
            jobMap.get(baseJobId)?.steps?.push(jobData);
        }
    }

    return {
        partitions,
        nodes,
        queue,
        history: Array.from(jobMap.values()),
        clusterDate: dateLine,
        detectedTimezone,
    };
}
