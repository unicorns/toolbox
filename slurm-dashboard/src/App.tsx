import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { SlurmData, SlurmQueueItem, SlurmHistoryItem, JobRowProps } from './types';

// --- CONSTANTS & CONFIGURATION ---
const SLURM_COMMAND = `scontrol show partition --oneliner; echo "---"; scontrol show node --oneliner; echo "---"; squeue --all -o "%.18i %.9P %.30j %.8u %.8T %.10M %.10l %.6D %R"; echo "---"; scontrol show job --oneliner; echo "---"; sacct -a --starttime "now-1day" --parsable2 --format=JobID,JobName,User,Partition,State,Start,End,Elapsed,ReqMem,ReqCPUS,ReqTRES; echo "---"; date --iso-8601=seconds`;

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
export const parseKeyValueString = (str: string): Record<string, string> => {
    const data: Record<string, string> = {};
    str.split(' ').forEach((pair: string) => {
        const [key, ...valueParts] = pair.split('=');
        if (key) data[key] = valueParts.join('=');
    });
    return data;
};

export const expandNodeList = (nodesStr: string): string[] => {
    if (!nodesStr || nodesStr === '(null)') return [];
    const finalNodes = new Set<string>();
    const nodeTokens = nodesStr.match(/[^,[]+\[[^\]]+\]|[^,]+/g) ?? [];
    nodeTokens.forEach((token: string) => {
        const match = /^([^[]+)\[([^\]]+)\](.*)$/.exec(token);
        if (match) {
            const prefix = match[1], rangeStr = match[2], suffix = match[3] ?? '';
            rangeStr.split(',').forEach((item: string) => {
                const rangeMatch = /^(\d+)-(\d+)$/.exec(item);
                if (rangeMatch) {
                    const start = parseInt(rangeMatch[1]), end = parseInt(rangeMatch[2]), padding = rangeMatch[1].length;
                    for (let i = start; i <= end; i++) finalNodes.add(`${prefix}${String(i).padStart(padding, '0')}${suffix}`);
                } else {
                    finalNodes.add(`${prefix}${item}${suffix}`);
                }
            });
        } else if (token) {
            finalNodes.add(token);
        }
    });
    return Array.from(finalNodes);
};

const parseMemoryToMB = (memString: string): number => {
    if (!memString || typeof memString !== 'string') return 0;
    const value = parseFloat(memString);
    if (isNaN(value)) return 0;
    const unit = memString.slice(-1).toUpperCase();
    switch (unit) {
        case 'G': return value * 1024;
        case 'T': return value * 1024 * 1024;
        case 'K': return value / 1024;
        case 'M': default: return value;
    }
};

const parseUnitValue = (valueString: string): number => {
    if (!valueString || typeof valueString !== 'string') return 0;
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
};

const parseGresField = (gresString: string): Record<string, number> => {
    const gresMap: Record<string, number> = {};
    if (!gresString) return gresMap;
    gresString.split(',').forEach((g: string) => {
        const parts = g.split(':');
        if (parts.length >= 2) {
            const gresName = parts.slice(0, -1).join(':');
            const valueStr = parts[parts.length - 1].replace(/\(.*\)/, '');
            gresMap[gresName] = parseUnitValue(valueStr);
        }
    });
    return gresMap;
};

export const parseTRES = (tresString: string): { cpu: string; mem: string; gres: Record<string, string> } => {
    const resources: { cpu: string; mem: string; gres: Record<string, string> } = { cpu: '0', mem: 'N/A', gres: {} };
    if (!tresString) return resources;
    tresString.split(',').forEach((res: string) => {
        const [key, value] = res.split('=');
        if (key === 'cpu') resources.cpu = value;
        else if (key === 'mem') resources.mem = value;
        else if (key.startsWith('gres/')) {
            const gresName = key.substring(5);
            resources.gres[gresName] = value;
        }
    });
    return resources;
};

const formatRelativeTime = (ms: number): string => {
    if (ms < 0) ms = -ms;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
};

const getRelativeTimeString = (
    timeString: string,
    timeZoneMode: string,
    detectedTimezone: string | null,
    pastSuffix = 'ago',
    futurePrefix = 'in'
): string => {
    if (!timeString || timeString === 'Unknown' || timeString === 'N/A') {
        return '';
    }

    let dateString = timeString;
    const hasOffset = timeString.endsWith('Z') || (/[-+]\d{2}:\d{2}$/.exec(timeString));

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
    } else {
        return `${futurePrefix} ${formatRelativeTime(-diff)}`;
    }
};


export const detectAndParseAll = (rawData: string): SlurmData => {
    const lines = rawData.split('\n');
    const partitionLines: string[] = [], nodeLines: string[] = [], squeueLines: string[] = [], jobDetailLines: string[] = [], sacctLines: string[] = [];
    let squeueHeaderDetected = false, sacctHeaderDetected = false, dateLine: string | null = null, detectedTimezone: string | null = null;

    lines.forEach((line: string) => {
        const trimmedLine = line.trim();
        const isoDateRegex = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})([-+]\d{2}:\d{2}|Z)/;
        const match = isoDateRegex.exec(trimmedLine);

        if (trimmedLine.startsWith('---') || trimmedLine === '') return;

        if (match && trimmedLine.length < 50) {
            dateLine = trimmedLine;
            detectedTimezone = match[2];
        }
        else if (trimmedLine.startsWith('PartitionName=')) partitionLines.push(trimmedLine);
        else if (trimmedLine.startsWith('NodeName=')) nodeLines.push(trimmedLine);
        else if (trimmedLine.startsWith('JobId=')) jobDetailLines.push(trimmedLine);
        else if (trimmedLine.startsWith('JobID|JobName|')) sacctHeaderDetected = true;
        else if (sacctHeaderDetected) sacctLines.push(trimmedLine);
        else if (trimmedLine.startsWith('JOBID') && trimmedLine.includes('PARTITION')) squeueHeaderDetected = true;
        else if (squeueHeaderDetected) squeueLines.push(trimmedLine);
    });

    const partitions = new Map<string, { nodes: Set<string>; details: Record<string, string> }>();
    partitionLines.forEach((line: string) => {
        const details = parseKeyValueString(line);
        if (details.PartitionName) {
            partitions.set(details.PartitionName, {
                nodes: new Set(expandNodeList(details.Nodes ?? '')),
                details: details
            });
        }
    });

    const nodes = new Map<string, { details: Record<string, string> }>();
    nodeLines.forEach((line: string) => {
        const details = parseKeyValueString(line);
        if (details.NodeName) nodes.set(details.NodeName, { details });
    });

    const queue: SlurmQueueItem[] = [];
    squeueLines.forEach((line: string) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 8) {
            queue.push({
                JobId: parts[0], Partition: parts[1], Name: parts[2], User: parts[3], State: parts[4],
                Time: parts[5], TimeLimit: parts[6], Nodes: parts[7], NodeList: parts.slice(8).join(' ')
            });
        }
    });

    jobDetailLines.forEach((line: string) => {
        const details = parseKeyValueString(line);
        const jobId = details.JobId;
        if (!jobId) return;
        const jobIndex = queue.findIndex((j) => j.JobId === jobId);
        if (jobIndex !== -1) {
            queue[jobIndex] = { ...queue[jobIndex], ...details, details: details };
        } else {
            queue.push({
                JobId: details.JobId ?? '',
                Partition: details.Partition ?? '',
                Name: details.JobName ?? '',
                User: (details.UserId ?? '').split('(')[0],
                State: details.JobState ?? '',
                Time: details.RunTime ?? '',
                TimeLimit: details.TimeLimit ?? '',
                Nodes: details.NodeList ?? '',
                NodeList: details.NodeList ?? '',
                details: details
            });
        }
    });

    const jobMap = new Map<string, SlurmHistoryItem>();
    sacctLines.forEach((line: string) => {
        if (!line) return;
        const parts = line.split('|');
        if (parts.length < 8) return;
        const jobData = {
            JobID: parts[0], JobName: parts[1], User: parts[2], Partition: parts[3], State: parts[4],
            Start: parts[5], End: parts[6], Elapsed: parts[7], ReqMem: parts[8], ReqCPUS: parts[9], ReqTRES: parts[10]
        };
        const baseJobId = jobData.JobID.split('.')[0];
        if (!jobMap.has(baseJobId)) {
            jobMap.set(baseJobId, { ...jobData, steps: [] });
        } else if (!jobData.JobID.includes('.')) {
            const existingJob = jobMap.get(baseJobId);
            if (existingJob) {
                Object.assign(existingJob, jobData);
            }
        }
        if (jobData.JobID.includes('.')) {
            const existingJob = jobMap.get(baseJobId);
            existingJob?.steps?.push(jobData);
        }
    });

    return {
        partitions,
        nodes,
        queue,
        history: Array.from(jobMap.values()),
        clusterDate: dateLine,
        detectedTimezone
    };
};


// --- HELPER & UI COMPONENTS ---

const MessageBox = ({ message, type, onDismiss }: { message: string; type: string; onDismiss: () => void }) => {
    useEffect(() => {
        if (message) {
            const timer = setTimeout(onDismiss, 4000);
            return () => clearTimeout(timer);
        }
    }, [message, onDismiss]);

    if (!message) return null;

    const color = type === 'error' ? 'bg-red-600' : 'bg-green-600';
    return (
        <div className={`fixed bottom-5 right-5 text-white py-3 px-5 rounded-lg shadow-xl z-50 ${color}`}>
            {message}
        </div>
    );
};

const Header = () => (
    <header className="text-center mb-6">
        <h1 className="text-4xl font-bold text-gray-900">Slurm Dashboard</h1>
        <p className="text-lg text-gray-600 mt-2">An interactive dashboard for visualizing your Slurm cluster's status</p>
    </header>
);

const CommandBlock = ({ onCopy, copyText }: { onCopy: () => void; copyText: string }) => (
    <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-bold text-gray-700">Recommended All-in-One Command</label>
            <button type="button" onClick={onCopy} className="bg-gray-600 text-white text-xs font-bold py-1 px-3 rounded-md hover:bg-gray-700 transition duration-200 w-20 text-center cursor-pointer">
                {copyText}
            </button>
        </div>
        <pre className="bg-gray-800 text-white p-3 rounded-md text-xs overflow-x-auto">
            <code>{SLURM_COMMAND}</code>
        </pre>
        <p className="text-xs text-gray-500 mt-2">Note: `sacct` can be slow. The command above limits history to the last day. Adjust as needed.</p>
    </div>
);

const InputSection = ({ onAnalyze, showMessage }: { onAnalyze: (text: string) => void; showMessage: (msg: string, type?: string) => void }) => {
    const [inputValue, setInputValue] = useState('');
    const [copyText, setCopyText] = useState('Copy');

    const handleAnalyzeClick = () => {
        if (!inputValue.trim()) {
            showMessage('Please paste some Slurm output first.', 'error');
        } else {
            onAnalyze(inputValue);
        }
    };

    const handleExampleClick = () => {
        setInputValue(ANONYMIZED_EXAMPLE_DATA);
        onAnalyze(ANONYMIZED_EXAMPLE_DATA);
    };

    const handleCopy = () => {
        const textarea = document.createElement('textarea');
        textarea.value = SLURM_COMMAND;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            setCopyText('Copied!');
        } catch {
            setCopyText('Failed!');
            showMessage('Failed to copy command.', 'error');
        }
        document.body.removeChild(textarea);
        setTimeout(() => setCopyText('Copy'), 2000);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleAnalyzeClick();
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8 max-w-6xl mx-auto">
            <p className="text-gray-700 mb-6">This tool parses the output of standard Slurm commands to create a user-friendly, visual representation of your cluster's partitions, nodes, and job queue. Paste your command outputs below to get started.</p>
            <CommandBlock onCopy={handleCopy} copyText={copyText} />
            <label htmlFor="slurm-input" className="block text-lg font-medium text-gray-700 mb-2">Paste Slurm Command Outputs Here</label>
            <textarea
                id="slurm-input"
                rows={12}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                placeholder="Paste one or more command outputs..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
            />
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <button type="button" onClick={handleAnalyzeClick} className="w-full sm:w-1/2 bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-300 cursor-pointer">
                    Analyze Cluster Data
                </button>
                <button type="button" onClick={handleExampleClick} className="w-full sm:w-1/2 bg-gray-200 text-gray-800 font-bold py-3 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition duration-300 cursor-pointer">
                    Load Example Data
                </button>
            </div>
        </div>
    );
};

const DataTimestampDisplay = ({ clusterDate, timezone, detectedTimezone }: { clusterDate: string | null; timezone: string; detectedTimezone: string | null }) => {
    if (!clusterDate) {
        return <p className="text-center text-gray-500">No timestamp found in data.</p>;
    }

    const relativeTime = getRelativeTimeString(clusterDate, timezone, detectedTimezone);

    return (
        <div className="text-center p-4">
            <p className="text-lg font-semibold text-gray-800 font-mono">{clusterDate}</p>
            {relativeTime && <p className="text-sm text-gray-500 mt-1">({relativeTime})</p>}
        </div>
    );
};


const ConfigurationPane = ({ timezone, setTimezone, detectedTimezone, clusterDate }: { timezone: string; setTimezone: (tz: string) => void; detectedTimezone: string | null; clusterDate: string | null }) => (
    <div className="mt-6 border-t pt-6 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Configuration</h3>
                <div className="p-4 bg-gray-50 rounded-lg space-y-6">
                    <div>
                        <h4 className="text-md font-semibold text-gray-800 mb-2">Display & Timezone</h4>
                        <div className="flex items-center space-x-2">
                            <label htmlFor="timezone-selector" className="text-sm font-medium text-gray-700 w-32">Data Timestamp:</label>
                            <select
                                id="timezone-selector"
                                value={timezone}
                                onChange={e => setTimezone(e.target.value)}
                                className="flex-1 h-8 rounded border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="auto" disabled={!detectedTimezone}>
                                    {detectedTimezone ? `Auto-Detect (${detectedTimezone})` : 'Auto-Detect (No date found)'}
                                </option>
                                <option value="utc">UTC</option>
                                <option value="local">Local (Browser)</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Data Collection Time</h3>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <DataTimestampDisplay clusterDate={clusterDate} timezone={timezone} detectedTimezone={detectedTimezone} />
                    </div>
                </div>
            </div>
            <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">UI Legend</h3>
                <div className="p-4 bg-gray-50 rounded-lg text-sm space-y-2">
                    <div className="flex items-center"><span className="inline-block bg-indigo-600 text-white font-semibold text-xs mr-1 mb-1 px-2 py-0.5 rounded-full">Partition</span><span className="ml-2">= Partition with active jobs on a node</span></div>
                    <div className="flex items-center"><span className="inline-block bg-gray-200 text-gray-700 text-xs mr-1 mb-1 px-2 py-0.5 rounded-full">Partition</span><span className="ml-2">= Partition with no active jobs on a node</span></div>
                    <div className="flex items-center"><span className="text-sm font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-800">ALLOCATED</span><span className="ml-2">= Node is fully allocated</span></div>
                    <div className="flex items-center"><span className="text-sm font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-800">MIXED</span><span className="ml-2">= Node is partially allocated</span></div>
                    <div className="flex items-center"><span className="text-sm font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800">IDLE</span><span className="ml-2">= Node is idle</span></div>
                    <div className="flex items-center"><span className="text-sm font-semibold px-2 py-1 rounded-full bg-red-100 text-red-800">DOWN/DRAIN</span><span className="ml-2">= Node is down, drained, or unavailable</span></div>
                </div>
            </div>
        </div>
    </div>
);


// --- TABS & CONTENT COMPONENTS ---

const TabButton = ({ tabId, activeTab, onClick, children }: { tabId: string; activeTab: string; onClick: (id: string) => void; children: React.ReactNode }) => (
    <button
        type="button"
        className={`tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${activeTab === tabId ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        onClick={() => onClick(tabId)}
    >
        {children}
    </button>
);

const PartitionsTab = ({ partitions }: { partitions: Map<string, { nodes: Set<string>; details: Record<string, string> }> }) => {
    if (partitions.size === 0) return <p className="text-center text-gray-500">No partition data found.</p>;

    const sortedPartitions = Array.from(partitions.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    return (
        <div className="space-y-6">
            {sortedPartitions.map(([name, { details, nodes }]) => (
                <div key={name} className="bg-white p-6 rounded-lg shadow-md">
                    <div className="flex items-center border-b pb-3 mb-4">
                        <h2 className="text-xl font-bold text-gray-800">{name}</h2>
                        {details.Default === 'YES' && <span className="ml-3 bg-yellow-200 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Default</span>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                        <div><strong className="block text-gray-500">State</strong><span className="font-semibold">{details.State}</span></div>
                        <div><strong className="block text-gray-500">Total Nodes</strong><span className="font-semibold">{details.TotalNodes}</span></div>
                        <div><strong className="block text-gray-500">Total CPUs</strong><span className="font-semibold">{details.TotalCPUs}</span></div>
                        <div><strong className="block text-gray-500">Max Time</strong><span className="font-semibold">{details.MaxTime}</span></div>
                    </div>
                    <div>
                        <h3 className="text-md font-semibold text-gray-700 mb-2">Nodes ({nodes.size})</h3>
                        <div className="flex flex-wrap">
                            {nodes.size > 0 ? Array.from(nodes).sort().map(node => (
                                <span key={node} className="inline-block bg-gray-200 text-gray-800 text-xs font-medium mr-2 mb-2 px-2.5 py-0.5 rounded-full">{node}</span>
                            )) : <p className="text-gray-500">No nodes listed.</p>}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const ProgressBar = ({ value, color = 'bg-blue-500' }: { value: number; color?: string }) => (
    <div className="bg-gray-200 rounded-full h-4 w-full overflow-hidden">
        <div className={`${color} h-4 rounded-full`} style={{ width: `${value}%` }}></div>
    </div>
);

const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => (
    <div className="tooltip-container relative inline-block">
        {children}
        <span className="tooltip invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-300
                         w-64 bg-gray-800 text-white text-center text-xs rounded-lg py-2 px-3
                         absolute z-10 bottom-full left-1/2 -ml-32">
            {text}
        </span>
    </div>
);

const GresResourceDisplay = ({ details }: { details: Record<string, string> }) => {
    const cfgTRES = parseTRES(details.CfgTRES ?? '');
    const allocTRES = parseTRES(details.AllocTRES ?? '');
    const configuredGres = parseGresField(details.Gres);

    const allGresKeys = new Set<string>([...Object.keys(cfgTRES.gres), ...Object.keys(allocTRES.gres), ...Object.keys(configuredGres)].map(k => String(k)));
    if (allGresKeys.size === 0) return null;

    const gresGroups = new Map<string, string[]>();
    Array.from(allGresKeys).forEach((key) => {
        if (typeof key !== 'string') return;
        const baseType = key.split(':')[0];
        if (!gresGroups.has(baseType)) {
            gresGroups.set(baseType, [] as string[]);
        }
        gresGroups.get(baseType)!.push(key);
    });

    return (
        <div className="space-y-3">
            {(Array.from(gresGroups.entries())).map(([baseType, keys]) => {
                const genericKey = baseType;
                const keysStr: string[] = (keys as (string | number)[]).filter((k): k is string => typeof k === 'string');
                const subtypes: string[] = keysStr.filter((k) => typeof k === 'string' && k !== genericKey).sort();
                const hasGeneric = keysStr.includes(genericKey);

                if (hasGeneric && subtypes.length > 0) {
                    // Hierarchical Display
                    const total = parseInt(cfgTRES.gres[genericKey] ?? '0');
                    const allocated = parseInt(allocTRES.gres[genericKey] ?? '0');
                    const pct = total > 0 ? (allocated / total * 100) : 0;
                    const color = baseType.includes('gpu') ? 'bg-purple-600' : 'bg-teal-500';

                    return (
                        <div key={baseType}>
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">GRES/{genericKey.toUpperCase()} (TOTAL): {allocated}/{total} ({pct.toFixed(1)}%)</span>
                                <div className="group">
                                    <Tooltip text="A GRES subtype may appear available if a job requested the resource generically (e.g., --gres=gpu:1). Check the (TOTAL) allocation for true usage.">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </Tooltip>
                                </div>
                            </div>
                            <ProgressBar value={pct} color={color} />
                            <div className="ml-4 mt-2 pl-4 border-l-2 border-gray-200 space-y-2">
                                {(subtypes).map((keyStr) => {
                                    const kStr = String(keyStr);
                                    const subTotalStr = String(cfgTRES.gres[kStr] ?? configuredGres[kStr] ?? '0');
                                    const subTotal = parseUnitValue(subTotalStr);
                                    const subAllocStr = String(allocTRES.gres[kStr] ?? '0');
                                    const subAlloc = parseUnitValue(subAllocStr);

                                    if (subTotal === 0 && subAlloc === 0) return null;
                                    const subPct = subTotal > 0 ? (subAlloc / subTotal * 100) : 0;
                                    return (
                                        <div key={kStr}>
                                            <span className="text-sm font-medium">GRES/{kStr.toUpperCase()}: {subAlloc}/{subTotal} ({subPct.toFixed(1)}%)</span>
                                            <ProgressBar value={subPct} color="bg-violet-500" />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                } else {
                    // Flat Display
                    return keysStr.sort().map((keyStr) => {
                        const kStr = String(keyStr);
                        const totalStr = String(cfgTRES.gres[kStr] ?? configuredGres[kStr] ?? '0');
                        const total = parseUnitValue(totalStr);
                        const allocatedStr = String(allocTRES.gres[kStr] ?? '0');
                        const allocated = parseUnitValue(allocatedStr);

                        if (total === 0 && allocated === 0) return null;
                        const pct = total > 0 ? (allocated / total * 100) : 0;
                        const color = kStr.includes('gpu') ? 'bg-purple-600' : 'bg-teal-500';
                        return (
                            <div key={kStr}>
                                <span className="text-sm font-medium">GRES/{kStr.toUpperCase()}: {allocated.toLocaleString()}/{total.toLocaleString()} ({pct.toFixed(1)}%)</span>
                                <ProgressBar value={pct} color={color} />
                            </div>
                        );
                    });
                }
            })}
        </div>
    );
};

const NodeCard = ({ name, details, jobs }: { name: string; details: Record<string, string>; jobs: SlurmQueueItem[] }) => {
    const cfgTRES = parseTRES(details.CfgTRES ?? '');
    const allocTRES = parseTRES(details.AllocTRES ?? '');

    const cpuTot = parseInt(cfgTRES.cpu || details.CPUTot || '0');
    const cpuAlloc = parseInt(allocTRES.cpu || details.CPUAlloc || '0');
    const memTot = parseMemoryToMB(cfgTRES.mem || details.RealMemory);
    const memAlloc = parseMemoryToMB(allocTRES.mem || details.AllocMem);

    const cpuPct = cpuTot > 0 ? (cpuAlloc / cpuTot * 100) : 0;
    const memPct = memTot > 0 ? (memAlloc / memTot * 100) : 0;

    let stateColor = 'bg-gray-100 text-gray-800'; // default
    if (details.State.includes('DOWN') || details.State.includes('DRAIN')) {
        stateColor = 'bg-red-100 text-red-800';
    } else if (details.State.includes('ALLOCATED')) {
        stateColor = 'bg-orange-100 text-orange-800';
    } else if (details.State.includes('MIXED')) {
        stateColor = 'bg-blue-100 text-blue-800';
    } else if (details.State.includes('IDLE')) {
        stateColor = 'bg-green-100 text-green-800';
    }

    const activePartitions = new Set(jobs.map((j) => j.Partition));

    return (
        <div className="bg-white p-4 rounded-lg shadow-md flex flex-col space-y-3">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">{name}</h3>
                <span className={`text-sm font-semibold px-2 py-1 rounded-full ${stateColor}`}>{details.State}</span>
            </div>
            <div>
                <span className="text-sm font-medium">CPU: {cpuAlloc}/{cpuTot} ({cpuPct.toFixed(1)}%)</span>
                <ProgressBar value={cpuPct} color="bg-blue-500" />
            </div>
            <div>
                <span className="text-sm font-medium">Memory: {memAlloc.toFixed(0)}MB / {memTot.toFixed(0)}MB ({memPct.toFixed(1)}%)</span>
                <ProgressBar value={memPct} color="bg-green-500" />
            </div>
            <GresResourceDisplay details={details} />
            <div className="pt-2 border-t border-gray-200 mt-2">
                <h4 className="text-xs font-bold text-gray-500 mb-1 uppercase">Partitions</h4>
                <div className="flex flex-wrap">
                    {(details.Partitions ?? '').split(',').map((p: string) => (
                        <span key={p} className={`inline-block ${activePartitions.has(p) ? 'bg-indigo-600 text-white font-semibold' : 'bg-gray-200 text-gray-700'} text-xs mr-1 mb-1 px-2 py-0.5 rounded-full`}>{p}</span>
                    ))}
                </div>
            </div>
            {jobs.length > 0 && (
                <div className="pt-2 border-t border-gray-200 mt-2">
                    <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase">Active Jobs</h4>
                    <div className="space-y-1">
                        {jobs.map((job) => {
                            const tresString = job.details?.AllocTRES && job.details.AllocTRES !== '(null)' ? job.details.AllocTRES : job.details?.TRES;
                            const tres = parseTRES(tresString ?? '');
                            return (
                                <div key={job.JobId} className="text-xs p-2 bg-gray-50 rounded">
                                    <div>
                                        <span className="font-mono font-semibold">{job.JobId}</span>
                                        <span className="font-medium text-gray-600"> ({job.User})</span>
                                        <span className="font-medium text-indigo-700 float-right">{job.Partition}</span>
                                    </div>
                                    <div className="text-gray-600 mt-1 flex space-x-3 flex-wrap">
                                        <span><strong className="font-semibold">CPU:</strong> {tres.cpu}</span>
                                        <span><strong className="font-semibold">Mem:</strong> {tres.mem}</span>
                                        {Object.entries(tres.gres).map(([key, val]: [string, string]) => (
                                            <span key={key}><strong className="font-semibold">GRES/{key.toUpperCase()}:</strong> {val}</span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const NodesTab = ({ nodes, queue }: { nodes: Map<string, { details: Record<string, string> }>; queue: SlurmQueueItem[] }) => {
    const nodeToJobsMap = useMemo(() => {
        const map = new Map<string, SlurmQueueItem[]>();
        nodes.forEach((_, name) => map.set(name, []));
        queue.filter(j => j.State === 'RUNNING' || j.State === 'R').forEach(job => {
            expandNodeList(job.NodeList ?? '').forEach(nodeName => {
                const nodeJobs = map.get(nodeName);
                if (nodeJobs) {
                    nodeJobs.push(job);
                }
            });
        });
        return map;
    }, [nodes, queue]);

    if (nodes.size === 0) return <p className="text-center text-gray-500 col-span-full">No node data found.</p>;

    const sortedNodes = Array.from(nodes.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {sortedNodes.map(([name, { details }]) => (
                <NodeCard key={name} name={name} details={details} jobs={nodeToJobsMap.get(name) ?? []} />
            ))}
        </div>
    );
};

const TresDetails = ({ tresString, title }: { tresString: string; title: string }) => {
    if (!tresString || tresString === '(null)') return null;
    const tres = parseTRES(tresString);
    return (
        <div className="mb-2">
            <h4 className="font-bold">{title}:</h4>
            <div className="flex space-x-6 text-sm flex-wrap">
                <span><strong className="font-semibold">CPU:</strong> {tres.cpu}</span>
                <span><strong className="font-semibold">Memory:</strong> {tres.mem}</span>
                {Object.entries(tres.gres).map(([key, val]: [string, string]) => (
                    <span key={key}><strong className="font-semibold">GRES/{key.toUpperCase()}:</strong> {val}</span>
                ))}
            </div>
        </div>
    );
};

const JobDetails = ({ job, isHistory }: { job: SlurmQueueItem | SlurmHistoryItem; isHistory: boolean }) => {
    if (isHistory) {
        const historyJob = job as SlurmHistoryItem;
        let reqMem = historyJob.ReqMem ?? '';
        if (reqMem.endsWith('c')) {
            const memVal = parseFloat(reqMem);
            const cpuVal = parseInt(historyJob.ReqCPUS);
            if (!isNaN(memVal) && !isNaN(cpuVal)) {
                const totalMem = memVal * cpuVal;
                const unit = reqMem.replace(/[0-9.c]/g, '');
                reqMem = `${totalMem}${unit}`;
            }
        }
        reqMem = reqMem.replace(/[nc]$/i, '');

        return (
            <div>
                <div className="mb-2">
                    <h4 className="font-bold">Requested Resources:</h4>
                    <div className="flex space-x-6 text-sm flex-wrap">
                        <span><strong className="font-semibold">CPU:</strong> {historyJob.ReqCPUS}</span>
                        <span><strong className="font-semibold">Memory:</strong> {reqMem}</span>
                        {Object.entries(parseTRES(historyJob.ReqTRES).gres).map(([key, val]: [string, string]) => (
                            <span key={key}><strong className="font-semibold">GRES/{key.toUpperCase()}:</strong> {val}</span>
                        ))}
                    </div>
                </div>
                {historyJob.steps && historyJob.steps.length > 0 && (
                    <>
                        <h4 className="font-bold mt-4 mb-2">Job Steps:</h4>
                        <table className="w-full text-left">
                            <thead className="text-xs text-gray-500">
                                <tr>
                                    <th className="px-4 py-1 pl-6">Step ID</th>
                                    <th className="px-4 py-1">Name</th>
                                    <th className="px-4 py-1">State</th>
                                    <th className="px-4 py-1">Elapsed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyJob.steps.map((step: SlurmHistoryItem) => (
                                    <tr key={step.JobID} className="text-xs text-gray-600">
                                        <td className="px-4 py-1 pl-6 font-mono">{step.JobID}</td>
                                        <td className="px-4 py-1 font-mono">{step.JobName}</td>
                                        <td className="px-4 py-1">{step.State}</td>
                                        <td className="px-4 py-1">{step.Elapsed}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}
            </div>
        );
    }

    // For Queue Jobs
    const queueJob = job as SlurmQueueItem;
    const allocTres = (queueJob.details?.AllocTRES && queueJob.details.AllocTRES !== '(null)') ? queueJob.details.AllocTRES : queueJob.details?.TRES;
    const reqTres = queueJob.details?.ReqTRES && queueJob.details.ReqTRES !== '(null)' ? queueJob.details.ReqTRES : null;

    return (
        <div>
            {allocTres === reqTres ? (
                <TresDetails tresString={allocTres ?? ''} title="Allocated & Requested Resources" />
            ) : (
                <>
                    <TresDetails tresString={allocTres ?? ''} title="Allocated Resources" />
                    <TresDetails tresString={reqTres ?? ''} title="Requested Resources" />
                </>
            )}
        </div>
    );
};


const JobRow = ({ job, isHistory = false, timezoneMode, detectedTimezone }: JobRowProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Helper functions to safely access properties
    const getJobId = (job: SlurmQueueItem | SlurmHistoryItem): string => {
        return isHistory ? (job as SlurmHistoryItem).JobID : (job as SlurmQueueItem).JobId;
    };

    const getJobName = (job: SlurmQueueItem | SlurmHistoryItem): string => {
        return isHistory ? (job as SlurmHistoryItem).JobName : (job as SlurmQueueItem).Name;
    };

    const historyJob = isHistory ? job as SlurmHistoryItem : null;
    const queueJob = !isHistory ? job as SlurmQueueItem : null;

    const hasDetails = Boolean(queueJob?.details && Object.keys(queueJob.details).length > 0) ||
        Boolean(historyJob && ((historyJob.steps?.length ?? 0) > 0 || Boolean(historyJob.ReqTRES)));

    const stateColors: Record<string, string> = {
        RUNNING: 'text-green-600', R: 'text-green-600',
        PENDING: 'text-yellow-600', PD: 'text-yellow-600',
        COMPLETED: 'text-blue-600',
        FAILED: 'text-red-600', TIMEOUT: 'text-red-600', CANCELLED: 'text-red-600', OUT_OF_MEMORY: 'text-red-600',
    };
    const stateKey = Object.keys(stateColors).find((s: string) => (job.State ?? '').startsWith(s));
    const stateColor = stateKey ? stateColors[stateKey] : 'text-gray-600';

    const startTime = historyJob ? historyJob.Start : (queueJob?.details?.StartTime ?? 'N/A');
    const endTime = historyJob ? historyJob.End : (queueJob?.details?.EndTime ?? 'N/A');
    const relativeStartTime = getRelativeTimeString(startTime, timezoneMode, detectedTimezone);
    const relativeEndTime = getRelativeTimeString(endTime, timezoneMode, detectedTimezone);

    return (
        <>
            <tr className={`border-b hover:bg-gray-50 ${hasDetails ? 'cursor-pointer' : ''}`} onClick={() => hasDetails && setIsExpanded(!isExpanded)}>
                <td className="px-2 py-2 text-center">{hasDetails && <span className={`arrow inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>}</td>
                <td className="px-4 py-2 font-mono">{getJobId(job)}</td>
                <td className="px-4 py-2">{job.User}</td>
                <td className="px-4 py-2">{job.Partition}</td>
                <td className={`px-4 py-2 font-semibold ${stateColor}`}>{job.State}</td>
                <td className="px-4 py-2 font-mono">{getJobName(job)}</td>
                <td className="px-4 py-2">
                    {startTime}
                    {relativeStartTime && <><br /><span className="text-xs text-gray-500">{relativeStartTime}</span></>}
                </td>
                <td className="px-4 py-2">
                    {endTime}
                    {relativeEndTime && <><br /><span className="text-xs text-gray-500">{relativeEndTime}</span></>}
                </td>
            </tr>
            {isExpanded && hasDetails && (
                <tr className="bg-gray-50">
                    <td colSpan={8} className="p-4">
                        <JobDetails job={job} isHistory={isHistory} />
                    </td>
                </tr>
            )}
        </>
    );
}

const QueueTab = ({ queue, timezoneMode, detectedTimezone }: { queue: SlurmQueueItem[]; timezoneMode: string; detectedTimezone: string | null }) => {
    if (queue.length === 0) return <p className="text-center text-gray-500">No queue data found.</p>;

    return (
        <div className="bg-white p-4 rounded-lg shadow-md overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
                    <tr>
                        <th className="px-2 py-3 w-4"></th>
                        <th className="px-4 py-3">Job ID</th>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Partition</th>
                        <th className="px-4 py-3">State</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Start Time</th>
                        <th className="px-4 py-3">End Time</th>
                    </tr>
                </thead>
                <tbody>
                    {queue.map((job) => <JobRow key={job.JobId} job={job} isHistory={false} timezoneMode={timezoneMode} detectedTimezone={detectedTimezone} />)}
                </tbody>
            </table>
        </div>
    );
};

const HistoryTab = ({ history, timezoneMode, detectedTimezone }: { history: SlurmHistoryItem[]; timezoneMode: string; detectedTimezone: string | null }) => {
    const [filter, setFilter] = useState('');

    const filteredHistory = useMemo(() => {
        if (!filter) return history;
        return history.filter(job =>
            job.JobID.toLowerCase().includes(filter.toLowerCase()) ||
            job.JobName.toLowerCase().includes(filter.toLowerCase()) ||
            job.User.toLowerCase().includes(filter.toLowerCase())
        );
    }, [history, filter]);

    if (history.length === 0) return <p className="text-center text-gray-500">No history data found.</p>;

    return (
        <div className="bg-white p-4 rounded-lg shadow-md overflow-x-auto">
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Filter by Job ID, Name, or User..."
                    className="w-full p-2 border border-gray-300 rounded-md"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
            </div>
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
                    <tr>
                        <th className="px-2 py-3 w-4"></th>
                        <th className="px-4 py-3">Job ID</th>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Partition</th>
                        <th className="px-4 py-3">State</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Start Time</th>
                        <th className="px-4 py-3">End Time</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredHistory.map((job) => <JobRow key={job.JobID} job={job} isHistory={true} timezoneMode={timezoneMode} detectedTimezone={detectedTimezone} />)}
                </tbody>
            </table>
        </div>
    );
};


// --- MAIN APP COMPONENT ---

function App() {
    const [slurmData, setSlurmData] = useState<SlurmData | null>(null);
    const [activeTab, setActiveTab] = useState('nodes');
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');
    const [timezone, setTimezone] = useState('auto');

    const showMessage = useCallback((text: string, type = 'info') => {
        setMessage(text);
        setMessageType(type);
    }, []);

    const handleAnalyze = (text: string) => {
        try {
            const parsed = detectAndParseAll(text);
            setSlurmData(parsed);

            if (parsed.nodes.size > 0) {
                setActiveTab('nodes');
            } else if (parsed.partitions.size > 0) {
                setActiveTab('partitions');
            } else if (parsed.queue.length > 0) {
                setActiveTab('queue');
            } else if (parsed.history.length > 0) {
                setActiveTab('history');
            } else {
                setActiveTab('nodes');
            }

            if (!parsed.detectedTimezone) {
                setTimezone('local');
            } else {
                setTimezone('auto');
            }

            setMessage('');
        } catch (error: unknown) {
            console.error("Parsing Error:", error);
            showMessage(`Could not process input. Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
            setSlurmData(null);
        }
    };

    return (
        <div className="bg-gray-100 text-gray-800 font-sans">
            <style>{`
                .tooltip-container .tooltip {
                    visibility: hidden;
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                .tooltip-container:hover .tooltip {
                    visibility: visible;
                    opacity: 1;
                }
            `}</style>
            <div className="container mx-auto p-4 md:p-6">
                <MessageBox message={message} type={messageType} onDismiss={() => setMessage('')} />
                <Header />
                <main>
                    <InputSection onAnalyze={handleAnalyze} showMessage={showMessage} />

                    {slurmData && (
                        <>
                            <ConfigurationPane
                                timezone={timezone}
                                setTimezone={setTimezone}
                                detectedTimezone={slurmData.detectedTimezone}
                                clusterDate={slurmData.clusterDate}
                            />
                            <div id="dashboard-tabs" className="max-w-7xl mx-auto mt-6">
                                <div className="border-b border-gray-200 mb-6">
                                    <nav className="flex -mb-px space-x-6" aria-label="Tabs">
                                        <TabButton tabId="partitions" activeTab={activeTab} onClick={setActiveTab}>Partitions</TabButton>
                                        <TabButton tabId="nodes" activeTab={activeTab} onClick={setActiveTab}>Node Details</TabButton>
                                        <TabButton tabId="queue" activeTab={activeTab} onClick={setActiveTab}>Job Queue</TabButton>
                                        <TabButton tabId="history" activeTab={activeTab} onClick={setActiveTab}>History</TabButton>
                                    </nav>
                                </div>
                                <div className="mt-6">
                                    {activeTab === 'partitions' && <PartitionsTab partitions={slurmData.partitions} />}
                                    {activeTab === 'nodes' && <NodesTab nodes={slurmData.nodes} queue={slurmData.queue} />}
                                    {activeTab === 'queue' && <QueueTab queue={slurmData.queue} timezoneMode={timezone} detectedTimezone={slurmData.detectedTimezone} />}
                                    {activeTab === 'history' && <HistoryTab history={slurmData.history} timezoneMode={timezone} detectedTimezone={slurmData.detectedTimezone} />}
                                </div>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}

export default App;
