import { useMemo, useState } from 'react';
import type { PartitionData, NodeData, SlurmQueueItem } from '../types';
import { getNodeGpuUsage, isNodeUnhealthy, trimNodeNames } from '../insights';
import { parseTRES, formatMemoryMB, parseMemoryToMB } from '../parsing';
import { NodeDetail } from './NodeDetail';
import { BG_CARD, BORDER, SECTION_LABEL, TEXT_MUTED, nodeStateKind, type NodeStateKind } from './theme';

const CELL_TINT: Record<NodeStateKind, string> = {
    idle: 'border-emerald-300 bg-emerald-50 hover:border-emerald-500 dark:border-emerald-900 dark:bg-emerald-950/40 dark:hover:border-emerald-600',
    mixed: 'border-sky-300 bg-sky-50 hover:border-sky-500 dark:border-sky-900 dark:bg-sky-950/40 dark:hover:border-sky-600',
    allocated: 'border-amber-300 bg-amber-50 hover:border-amber-500 dark:border-amber-900 dark:bg-amber-950/40 dark:hover:border-amber-600',
    unhealthy: 'border-red-300 bg-red-50 hover:border-red-500 dark:border-red-900 dark:bg-red-950/40 dark:hover:border-red-600',
    other: 'border-zinc-300 bg-zinc-50 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500',
};

const LEGEND: { kind: NodeStateKind; label: string; dotClass: string }[] = [
    { kind: 'idle', label: 'idle', dotClass: 'bg-emerald-400' },
    { kind: 'mixed', label: 'mixed', dotClass: 'bg-sky-400' },
    { kind: 'allocated', label: 'full', dotClass: 'bg-amber-400' },
    { kind: 'unhealthy', label: 'down/drain', dotClass: 'bg-red-400' },
];

function GpuDots({ total, allocated, unhealthy }: { total: number; allocated: number; unhealthy: boolean }) {
    return (
        <span className="flex max-w-[5.5rem] flex-wrap gap-[3px]" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => {
                const isAllocated = i < allocated;
                const dotClass = unhealthy
                    ? 'bg-red-300 dark:bg-red-900'
                    : isAllocated
                        ? 'bg-zinc-300 dark:bg-zinc-700'
                        : 'bg-emerald-500 dark:bg-emerald-400';
                return <span key={i} className={`h-[7px] w-[7px] rounded-[2px] ${dotClass}`} />;
            })}
        </span>
    );
}

function CpuMiniBar({ details }: { details: Record<string, string> }) {
    const cfg = parseTRES(details.CfgTRES ?? '');
    const alloc = parseTRES(details.AllocTRES ?? '');
    const total = parseInt(cfg.cpu || details.CPUTot || '0') || 0;
    const used = parseInt(alloc.cpu || details.CPUAlloc || '0') || 0;
    const fraction = total > 0 ? used / total : 0;
    return (
        <span className="block h-[7px] w-[5.5rem] overflow-hidden rounded-[2px] bg-emerald-500 dark:bg-emerald-400" aria-hidden="true">
            <span className="block h-full bg-zinc-300 dark:bg-zinc-700" style={{ width: `${fraction * 100}%` }} />
        </span>
    );
}

function nodeTooltip(name: string, details: Record<string, string>): string {
    const cfg = parseTRES(details.CfgTRES ?? '');
    const alloc = parseTRES(details.AllocTRES ?? '');
    const cpu = `cpu ${parseInt(alloc.cpu || details.CPUAlloc || '0') || 0}/${parseInt(cfg.cpu || details.CPUTot || '0') || 0}`;
    const mem = `mem ${formatMemoryMB(parseMemoryToMB(alloc.mem || details.AllocMem))}/${formatMemoryMB(parseMemoryToMB(cfg.mem || details.RealMemory))}`;
    const gpuUsage = getNodeGpuUsage(details);
    const gpu = gpuUsage ? ` · gpu ${gpuUsage.allocated}/${gpuUsage.total}` : '';
    return `${name} · ${details.State ?? '?'} · ${cpu} · ${mem}${gpu}`;
}

interface NodeHeatmapProps {
    partitions: Map<string, PartitionData>;
    nodes: Map<string, NodeData>;
    queue: SlurmQueueItem[];
}

export function NodeHeatmap({ partitions, nodes, queue }: NodeHeatmapProps) {
    const [selected, setSelected] = useState<string | null>(null);

    const shortLabels = useMemo(() => trimNodeNames(Array.from(nodes.keys())), [nodes]);

    // Partition -> sorted node names present in the node data.
    const groups = useMemo(() => {
        const seen = new Set<string>();
        const result: { partition: string; nodeNames: string[] }[] = [];
        for (const [name, partition] of Array.from(partitions.entries()).sort(([a], [b]) => a.localeCompare(b))) {
            const nodeNames = Array.from(partition.nodes).filter(n => nodes.has(n)).sort();
            if (nodeNames.length > 0) {
                result.push({ partition: name, nodeNames });
                nodeNames.forEach(n => seen.add(n));
            }
        }
        const unassigned = Array.from(nodes.keys()).filter(n => !seen.has(n)).sort();
        if (unassigned.length > 0) {
            result.push({ partition: partitions.size > 0 ? '(no partition)' : '', nodeNames: unassigned });
        }
        return result;
    }, [partitions, nodes]);

    if (nodes.size === 0) return null;

    return (
        <section aria-label="Nodes" className={`${BG_CARD} animate-rise rounded-lg border ${BORDER} p-5 shadow-sm`} style={{ '--rise-delay': '210ms' } as React.CSSProperties}>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className={SECTION_LABEL}>Nodes</h2>
                <div className={`flex items-center gap-3 font-mono text-[10px] ${TEXT_MUTED}`}>
                    {LEGEND.map(({ kind, label, dotClass }) => (
                        <span key={kind} className="flex items-center gap-1">
                            <span className={`h-2 w-2 rounded-[2px] ${dotClass}`} />
                            {label}
                        </span>
                    ))}
                    <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-[2px] bg-emerald-500 dark:bg-emerald-400" />
                        = free GPU
                    </span>
                </div>
            </div>

            <div className="space-y-4">
                {groups.map(({ partition, nodeNames }) => (
                    <div key={partition}>
                        {groups.length > 1 && (
                            <p className={`mb-1.5 font-mono text-[11px] font-medium ${TEXT_MUTED}`}>{partition}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                            {nodeNames.map(name => {
                                const details = nodes.get(name)!.details;
                                const state = details.State ?? '';
                                const kind = nodeStateKind(state, isNodeUnhealthy(state));
                                const gpuUsage = getNodeGpuUsage(details);
                                const isSelected = selected === name;
                                return (
                                    <button
                                        key={name}
                                        type="button"
                                        aria-label={`${name}: ${state}`}
                                        aria-pressed={isSelected}
                                        title={nodeTooltip(name, details)}
                                        onClick={() => setSelected(isSelected ? null : name)}
                                        className={`cursor-pointer rounded-md border px-1.5 py-1 transition-all ${CELL_TINT[kind]} ${
                                            isSelected ? 'ring-2 ring-cyan-500 dark:ring-cyan-400' : ''
                                        }`}
                                    >
                                        <span className={`block text-left font-mono text-[10px] font-medium leading-tight ${TEXT_MUTED}`}>
                                            {shortLabels.get(name)}
                                        </span>
                                        {gpuUsage
                                            ? <GpuDots total={gpuUsage.total} allocated={gpuUsage.allocated} unhealthy={kind === 'unhealthy'} />
                                            : <CpuMiniBar details={details} />}
                                    </button>
                                );
                            })}
                        </div>
                        {selected !== null && nodeNames.includes(selected) && (
                            <NodeDetail
                                name={selected}
                                details={nodes.get(selected)!.details}
                                queue={queue}
                                onClose={() => setSelected(null)}
                            />
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
