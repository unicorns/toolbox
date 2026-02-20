import type { KeyboardEvent, ReactNode } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SlurmData, SlurmQueueItem, SlurmHistoryItem, JobRowProps, TimezoneMode, PartitionData, NodeData } from './types';
import {
    SLURM_COMMAND, ANONYMIZED_EXAMPLE_DATA,
    expandNodeList, parseTRES, parseMemoryToMB, parseUnitValue, parseGresField,
    getRelativeTimeString, detectAndParseAll,
} from './parsing';


// --- HELPER & UI COMPONENTS ---

function MessageBox({ message, type, onDismiss }: { message: string; type: string; onDismiss: () => void }) {
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
}

function Header() {
    return (
        <header className="text-center mb-6">
            <h1 className="text-4xl font-bold text-gray-900">Slurm Dashboard</h1>
            <p className="text-lg text-gray-600 mt-2">An interactive dashboard for visualizing your Slurm cluster's status</p>
        </header>
    );
}

function CommandBlock({ onCopy, copyText }: { onCopy: () => void; copyText: string }) {
    return (
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
}

function InputSection({ onAnalyze, showMessage }: { onAnalyze: (text: string) => void; showMessage: (msg: string, type?: string) => void }) {
    const [inputValue, setInputValue] = useState('');
    const [copyText, setCopyText] = useState('Copy');

    function handleAnalyzeClick() {
        if (!inputValue.trim()) {
            showMessage('Please paste some Slurm output first.', 'error');
        } else {
            onAnalyze(inputValue);
        }
    }

    function handleExampleClick() {
        setInputValue(ANONYMIZED_EXAMPLE_DATA);
        onAnalyze(ANONYMIZED_EXAMPLE_DATA);
    }

    function handleCopy() {
        navigator.clipboard.writeText(SLURM_COMMAND).then(
            () => setCopyText('Copied!'),
            () => {
                setCopyText('Failed!');
                showMessage('Failed to copy command.', 'error');
            }
        );
        setTimeout(() => setCopyText('Copy'), 2000);
    }

    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleAnalyzeClick();
        }
    }

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
}

function DataTimestampDisplay({ clusterDate, timezone, detectedTimezone }: { clusterDate: string | null; timezone: TimezoneMode; detectedTimezone: string | null }) {
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
}

function ConfigurationPane({ timezone, setTimezone, detectedTimezone, clusterDate }: { timezone: TimezoneMode; setTimezone: (tz: TimezoneMode) => void; detectedTimezone: string | null; clusterDate: string | null }) {
    return (
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
                                    onChange={e => setTimezone(e.target.value as TimezoneMode)}
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
}


// --- TABS & CONTENT COMPONENTS ---

function TabButton({ tabId, activeTab, onClick, children }: { tabId: string; activeTab: string; onClick: (id: string) => void; children: ReactNode }) {
    return (
        <button
            type="button"
            className={`tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${activeTab === tabId ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => onClick(tabId)}
        >
            {children}
        </button>
    );
}

function PartitionsTab({ partitions }: { partitions: Map<string, PartitionData> }) {
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
}

function ProgressBar({ value, color = 'bg-blue-500' }: { value: number; color?: string }) {
    return (
        <div className="bg-gray-200 rounded-full h-4 w-full overflow-hidden">
            <div className={`${color} h-4 rounded-full`} style={{ width: `${value}%` }}></div>
        </div>
    );
}

function Tooltip({ text, children }: { text: string; children: ReactNode }) {
    return (
        <div className="group relative inline-block">
            {children}
            <span className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-300
                             w-64 bg-gray-800 text-white text-center text-xs rounded-lg py-2 px-3
                             absolute z-10 bottom-full left-1/2 -ml-32">
                {text}
            </span>
        </div>
    );
}

function GresResourceDisplay({ details }: { details: Record<string, string> }) {
    const cfgTRES = parseTRES(details.CfgTRES ?? '');
    const allocTRES = parseTRES(details.AllocTRES ?? '');
    const configuredGres = parseGresField(details.Gres);

    const allGresKeys = new Set([...Object.keys(cfgTRES.gres), ...Object.keys(allocTRES.gres), ...Object.keys(configuredGres)]);
    if (allGresKeys.size === 0) return null;

    const gresGroups = new Map<string, string[]>();
    for (const key of allGresKeys) {
        const baseType = key.split(':')[0];
        let group = gresGroups.get(baseType);
        if (!group) {
            group = [];
            gresGroups.set(baseType, group);
        }
        group.push(key);
    }

    function getGresBarColor(type: string): string {
        return type.includes('gpu') ? 'bg-purple-600' : 'bg-teal-500';
    }

    return (
        <div className="space-y-3">
            {Array.from(gresGroups.entries()).map(([baseType, keys]) => {
                const subtypes = keys.filter(k => k !== baseType).sort();
                const hasGeneric = keys.includes(baseType);

                if (hasGeneric && subtypes.length > 0) {
                    const total = parseInt(cfgTRES.gres[baseType] ?? '0');
                    const allocated = parseInt(allocTRES.gres[baseType] ?? '0');
                    const pct = total > 0 ? (allocated / total * 100) : 0;

                    return (
                        <div key={baseType}>
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">GRES/{baseType.toUpperCase()} (TOTAL): {allocated}/{total} ({pct.toFixed(1)}%)</span>
                                <Tooltip text="A GRES subtype may appear available if a job requested the resource generically (e.g., --gres=gpu:1). Check the (TOTAL) allocation for true usage.">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </Tooltip>
                            </div>
                            <ProgressBar value={pct} color={getGresBarColor(baseType)} />
                            <div className="ml-4 mt-2 pl-4 border-l-2 border-gray-200 space-y-2">
                                {subtypes.map(key => {
                                    const subTotal = parseUnitValue(cfgTRES.gres[key] ?? String(configuredGres[key] ?? '0'));
                                    const subAlloc = parseUnitValue(allocTRES.gres[key] ?? '0');
                                    if (subTotal === 0 && subAlloc === 0) return null;
                                    const subPct = subTotal > 0 ? (subAlloc / subTotal * 100) : 0;
                                    return (
                                        <div key={key}>
                                            <span className="text-sm font-medium">GRES/{key.toUpperCase()}: {subAlloc}/{subTotal} ({subPct.toFixed(1)}%)</span>
                                            <ProgressBar value={subPct} color="bg-violet-500" />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                }

                return keys.sort().map(key => {
                    const total = parseUnitValue(cfgTRES.gres[key] ?? String(configuredGres[key] ?? '0'));
                    const allocated = parseUnitValue(allocTRES.gres[key] ?? '0');
                    if (total === 0 && allocated === 0) return null;
                    const pct = total > 0 ? (allocated / total * 100) : 0;
                    return (
                        <div key={key}>
                            <span className="text-sm font-medium">GRES/{key.toUpperCase()}: {allocated.toLocaleString()}/{total.toLocaleString()} ({pct.toFixed(1)}%)</span>
                            <ProgressBar value={pct} color={getGresBarColor(key)} />
                        </div>
                    );
                });
            })}
        </div>
    );
}

function getNodeStateColor(state: string): string {
    if (state.includes('DOWN') || state.includes('DRAIN')) return 'bg-red-100 text-red-800';
    if (state.includes('ALLOCATED')) return 'bg-orange-100 text-orange-800';
    if (state.includes('MIXED')) return 'bg-blue-100 text-blue-800';
    if (state.includes('IDLE')) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
}

function NodeCard({ name, details, jobs }: { name: string; details: Record<string, string>; jobs: SlurmQueueItem[] }) {
    const cfgTRES = parseTRES(details.CfgTRES ?? '');
    const allocTRES = parseTRES(details.AllocTRES ?? '');

    const cpuTot = parseInt(cfgTRES.cpu || details.CPUTot || '0');
    const cpuAlloc = parseInt(allocTRES.cpu || details.CPUAlloc || '0');
    const memTot = parseMemoryToMB(cfgTRES.mem || details.RealMemory);
    const memAlloc = parseMemoryToMB(allocTRES.mem || details.AllocMem);

    const cpuPct = cpuTot > 0 ? (cpuAlloc / cpuTot * 100) : 0;
    const memPct = memTot > 0 ? (memAlloc / memTot * 100) : 0;

    const stateColor = getNodeStateColor(details.State);
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
                    {(details.Partitions ?? '').split(',').map((p) => (
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
                                        {Object.entries(tres.gres).map(([key, val]) => (
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
}

function NodesTab({ nodes, queue }: { nodes: Map<string, NodeData>; queue: SlurmQueueItem[] }) {
    const nodeToJobsMap = useMemo(() => {
        const map = new Map<string, SlurmQueueItem[]>();
        for (const [name] of nodes) {
            map.set(name, []);
        }
        for (const job of queue) {
            if (job.State !== 'RUNNING' && job.State !== 'R') continue;
            for (const nodeName of expandNodeList(job.NodeList ?? '')) {
                const nodeJobs = map.get(nodeName);
                if (nodeJobs) {
                    nodeJobs.push(job);
                }
            }
        }
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
}

function TresDetails({ tresString, title }: { tresString: string; title: string }) {
    if (!tresString || tresString === '(null)') return null;
    const tres = parseTRES(tresString);
    return (
        <div className="mb-2">
            <h4 className="font-bold">{title}:</h4>
            <div className="flex space-x-6 text-sm flex-wrap">
                <span><strong className="font-semibold">CPU:</strong> {tres.cpu}</span>
                <span><strong className="font-semibold">Memory:</strong> {tres.mem}</span>
                {Object.entries(tres.gres).map(([key, val]) => (
                    <span key={key}><strong className="font-semibold">GRES/{key.toUpperCase()}:</strong> {val}</span>
                ))}
            </div>
        </div>
    );
}

function JobDetails({ job, isHistory }: { job: SlurmQueueItem | SlurmHistoryItem; isHistory: boolean }) {
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
                        {Object.entries(parseTRES(historyJob.ReqTRES).gres).map(([key, val]) => (
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
                                {historyJob.steps.map((step) => (
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

    const queueJob = job as SlurmQueueItem;
    const allocTres = (queueJob.details?.AllocTRES && queueJob.details.AllocTRES !== '(null)') ? queueJob.details.AllocTRES : queueJob.details?.TRES;
    const reqTres = queueJob.details?.ReqTRES && queueJob.details.ReqTRES !== '(null)' ? queueJob.details.ReqTRES : null;

    if (allocTres === reqTres) {
        return (
            <div>
                <TresDetails tresString={allocTres ?? ''} title="Allocated & Requested Resources" />
            </div>
        );
    }

    return (
        <div>
            <TresDetails tresString={allocTres ?? ''} title="Allocated Resources" />
            <TresDetails tresString={reqTres ?? ''} title="Requested Resources" />
        </div>
    );
}

const JOB_STATE_COLORS: Record<string, string> = {
    RUNNING: 'text-green-600',
    R: 'text-green-600',
    PENDING: 'text-yellow-600',
    PD: 'text-yellow-600',
    COMPLETED: 'text-blue-600',
    FAILED: 'text-red-600',
    TIMEOUT: 'text-red-600',
    CANCELLED: 'text-red-600',
    OUT_OF_MEMORY: 'text-red-600',
};

function getJobStateColor(state: string): string {
    for (const [prefix, color] of Object.entries(JOB_STATE_COLORS)) {
        if (state.startsWith(prefix)) return color;
    }
    return 'text-gray-600';
}

function JobTableHeader() {
    return (
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
    );
}

function JobRow({ job, isHistory = false, timezoneMode, detectedTimezone }: JobRowProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    let jobId: string;
    let jobName: string;
    let hasDetails: boolean;
    let startTime: string;
    let endTime: string;

    if (isHistory) {
        const h = job as SlurmHistoryItem;
        jobId = h.JobID;
        jobName = h.JobName;
        hasDetails = (h.steps?.length ?? 0) > 0 || Boolean(h.ReqTRES);
        startTime = h.Start;
        endTime = h.End;
    } else {
        const q = job as SlurmQueueItem;
        jobId = q.JobId;
        jobName = q.Name;
        hasDetails = Boolean(q.details && Object.keys(q.details).length > 0);
        startTime = q.details?.StartTime ?? 'N/A';
        endTime = q.details?.EndTime ?? 'N/A';
    }

    const stateColor = getJobStateColor(job.State);
    const relativeStartTime = getRelativeTimeString(startTime, timezoneMode, detectedTimezone);
    const relativeEndTime = getRelativeTimeString(endTime, timezoneMode, detectedTimezone);

    return (
        <>
            <tr className={`border-b hover:bg-gray-50 ${hasDetails ? 'cursor-pointer' : ''}`} onClick={() => hasDetails && setIsExpanded(!isExpanded)}>
                <td className="px-2 py-2 text-center">{hasDetails && <span className={`arrow inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>&#9654;</span>}</td>
                <td className="px-4 py-2 font-mono">{jobId}</td>
                <td className="px-4 py-2">{job.User}</td>
                <td className="px-4 py-2">{job.Partition}</td>
                <td className={`px-4 py-2 font-semibold ${stateColor}`}>{job.State}</td>
                <td className="px-4 py-2 font-mono">{jobName}</td>
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

function QueueTab({ queue, timezoneMode, detectedTimezone }: { queue: SlurmQueueItem[]; timezoneMode: TimezoneMode; detectedTimezone: string | null }) {
    if (queue.length === 0) return <p className="text-center text-gray-500">No queue data found.</p>;

    return (
        <div className="bg-white p-4 rounded-lg shadow-md overflow-x-auto">
            <table className="w-full text-sm text-left">
                <JobTableHeader />
                <tbody>
                    {queue.map((job) => <JobRow key={job.JobId} job={job} isHistory={false} timezoneMode={timezoneMode} detectedTimezone={detectedTimezone} />)}
                </tbody>
            </table>
        </div>
    );
}

function HistoryTab({ history, timezoneMode, detectedTimezone }: { history: SlurmHistoryItem[]; timezoneMode: TimezoneMode; detectedTimezone: string | null }) {
    const [filter, setFilter] = useState('');

    const filteredHistory = useMemo(() => {
        if (!filter) return history;
        const lowerFilter = filter.toLowerCase();
        return history.filter(job =>
            job.JobID.toLowerCase().includes(lowerFilter) ||
            job.JobName.toLowerCase().includes(lowerFilter) ||
            job.User.toLowerCase().includes(lowerFilter)
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
                <JobTableHeader />
                <tbody>
                    {filteredHistory.map((job) => <JobRow key={job.JobID} job={job} isHistory={true} timezoneMode={timezoneMode} detectedTimezone={detectedTimezone} />)}
                </tbody>
            </table>
        </div>
    );
}


// --- MAIN APP COMPONENT ---

function App() {
    const [slurmData, setSlurmData] = useState<SlurmData | null>(null);
    const [activeTab, setActiveTab] = useState('nodes');
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');
    const [timezone, setTimezone] = useState<TimezoneMode>('auto');

    const showMessage = useCallback((text: string, type = 'info') => {
        setMessage(text);
        setMessageType(type);
    }, []);

    function selectBestTab(parsed: SlurmData): string {
        if (parsed.nodes.size > 0) return 'nodes';
        if (parsed.partitions.size > 0) return 'partitions';
        if (parsed.queue.length > 0) return 'queue';
        if (parsed.history.length > 0) return 'history';
        return 'nodes';
    }

    function handleAnalyze(text: string): void {
        try {
            const parsed = detectAndParseAll(text);
            setSlurmData(parsed);
            setActiveTab(selectBestTab(parsed));
            setTimezone(parsed.detectedTimezone ? 'auto' : 'local');
            setMessage('');
        } catch (error: unknown) {
            console.error("Parsing Error:", error);
            showMessage(`Could not process input. Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
            setSlurmData(null);
        }
    }

    return (
        <div className="bg-gray-100 text-gray-800 font-sans">
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
