import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import type { PartitionCapacity, PartitionData, NodeData, SlurmQueueItem, ResourcePool } from '../types';
import { computePartitionCapacity, computeClusterTotals } from '../insights';
import { formatMemoryMB } from '../parsing';
import { BG_CARD, BORDER, SECTION_LABEL, TEXT_MUTED, TEXT_PRIMARY } from './theme';
import { ProgressBar } from './ui';

function PoolRow({ label, pool, format }: { label: string; pool: ResourcePool; format: (n: number) => string }) {
    const fraction = pool.total > 0 ? pool.allocated / pool.total : 0;
    return (
        <div>
            <div className="mb-1 flex items-baseline justify-between font-mono text-xs">
                <span className={TEXT_MUTED}>{label}</span>
                <span className={TEXT_PRIMARY}>
                    {format(pool.free)} free <span className={TEXT_MUTED}>/ {format(pool.total)}</span>
                </span>
            </div>
            <ProgressBar fraction={fraction} barClass="bg-zinc-400 dark:bg-zinc-600" />
        </div>
    );
}

const formatCount = (n: number) => n.toLocaleString();

function PartitionConfig({ details }: { details: Record<string, string> }) {
    const entries: [string, string | undefined][] = [
        ['State', details.State],
        ['Max time', details.MaxTime],
        ['Default time', details.DefaultTime],
        ['Oversubscribe', details.OverSubscribe],
        ['Accounts', details.AllowAccounts !== 'ALL' ? details.AllowAccounts : undefined],
        ['Groups', details.AllowGroups !== 'ALL' ? details.AllowGroups : undefined],
        ['QoS', details.QoS !== 'N/A' ? details.QoS : undefined],
        ['Nodes', details.Nodes],
    ];
    return (
        <dl className={`mt-3 space-y-1 border-t ${BORDER} pt-3 font-mono text-[11px]`}>
            {entries.filter(([, value]) => value).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                    <dt className={`w-24 shrink-0 ${TEXT_MUTED}`}>{key}</dt>
                    <dd className={`break-all ${TEXT_PRIMARY}`}>{value}</dd>
                </div>
            ))}
        </dl>
    );
}

function CapacityCard({ capacity, details, index }: { capacity: PartitionCapacity; details: Record<string, string>; index: number }) {
    const [showConfig, setShowConfig] = useState(false);
    const { gpu, cpu } = capacity;

    // GPU partitions headline free GPUs; CPU-only partitions headline free CPUs.
    const headline = gpu
        ? { value: gpu.free, unit: 'GPUs free', total: gpu.total }
        : { value: cpu.free, unit: 'CPUs free', total: cpu.total };

    const subline = gpu
        ? `up to ${capacity.largestFreeGpuBlock} on one node · ${capacity.nodesIdle} idle ${capacity.nodesIdle === 1 ? 'node' : 'nodes'}`
        : `${capacity.nodesIdle} idle ${capacity.nodesIdle === 1 ? 'node' : 'nodes'}`;

    return (
        <section
            aria-label={`${capacity.name} capacity`}
            className={`${BG_CARD} animate-rise rounded-lg border ${BORDER} p-5 shadow-sm`}
            style={{ '--rise-delay': `${index * 70}ms` } as CSSProperties}
        >
            <div className="mb-3 flex items-baseline justify-between gap-2">
                <h3 className={`truncate font-mono text-sm font-semibold ${TEXT_PRIMARY}`}>
                    {capacity.name}
                    {details.Default === 'YES' && (
                        <span className={`ml-2 rounded-full border ${BORDER} px-1.5 py-px font-mono text-[10px] font-normal ${TEXT_MUTED}`}>Default</span>
                    )}
                </h3>
                <span className={`shrink-0 font-mono text-[11px] ${TEXT_MUTED}`}>{capacity.nodesTotal} nodes</span>
            </div>

            <div className="mb-4">
                <div className="flex items-baseline gap-2">
                    <span className={`font-mono text-5xl font-medium leading-none tracking-tight ${headline.value > 0 ? 'text-emerald-600 dark:text-emerald-400' : TEXT_MUTED}`}>
                        {headline.value.toLocaleString()}
                    </span>
                    <span className={`font-mono text-xs ${TEXT_MUTED}`}>
                        {headline.unit} <span>of {headline.total.toLocaleString()}</span>
                    </span>
                </div>
                <p className={`mt-1.5 font-mono text-[11px] ${TEXT_MUTED}`}>{subline}</p>
            </div>

            <div className="space-y-3">
                {gpu && <PoolRow label="CPU" pool={cpu} format={formatCount} />}
                <PoolRow label="MEM" pool={capacity.memMB} format={formatMemoryMB} />
            </div>

            {capacity.unavailable.length > 0 && (
                <details className="mt-3 text-xs">
                    <summary className="cursor-pointer font-mono font-medium text-red-600 dark:text-red-400">
                        ⚠ {capacity.unavailable.length} unavailable
                    </summary>
                    <ul className="mt-2 space-y-1.5">
                        {capacity.unavailable.map(node => (
                            <li key={node.name} className="font-mono text-[11px]">
                                <span className={TEXT_PRIMARY}>{node.name}</span>{' '}
                                <span className="text-red-600 dark:text-red-400">{node.state}</span>
                                {node.reason && <span className={`block ${TEXT_MUTED}`}>{node.reason}</span>}
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            {capacity.pendingJobs > 0 && (
                <p className="mt-3 font-mono text-[11px] text-amber-700 dark:text-amber-400">
                    ⏳ {capacity.pendingJobs} {capacity.pendingJobs === 1 ? 'job' : 'jobs'} waiting
                    {' · '}
                    {capacity.pendingGpus > 0
                        ? `${capacity.pendingGpus} GPUs requested`
                        : `${capacity.pendingCpus} CPUs requested`}
                </p>
            )}

            <button
                type="button"
                aria-label={`${capacity.name} config`}
                aria-expanded={showConfig}
                onClick={() => setShowConfig(v => !v)}
                className={`mt-3 cursor-pointer font-mono text-[11px] ${TEXT_MUTED} transition-colors hover:text-cyan-600 dark:hover:text-cyan-400`}
            >
                {showConfig ? '▾ config' : '▸ config'}
            </button>
            {showConfig && <PartitionConfig details={details} />}
        </section>
    );
}

interface CapacityCardsProps {
    partitions: Map<string, PartitionData>;
    nodes: Map<string, NodeData>;
    queue: SlurmQueueItem[];
}

export function CapacityCards({ partitions, nodes, queue }: CapacityCardsProps) {
    const capacities = useMemo(() => computePartitionCapacity(partitions, nodes, queue), [partitions, nodes, queue]);
    const totals = useMemo(() => computeClusterTotals(partitions, nodes), [partitions, nodes]);

    if (capacities.length === 0) return null;

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <h2 className={SECTION_LABEL}>Capacity</h2>
                {capacities.length > 1 && (
                    <span className={`font-mono text-[11px] ${TEXT_MUTED}`}>
                        cluster total: <span className="font-medium text-emerald-600 dark:text-emerald-400">{totals.gpu.free.toLocaleString()}</span> GPUs free
                        {' · '}{totals.nodesIdle.toLocaleString()} idle
                        {totals.nodesUnavailable > 0 && (
                            <span className="text-red-600 dark:text-red-400">{' · '}{totals.nodesUnavailable} unavailable</span>
                        )}
                        {' · '}{totals.nodesTotal.toLocaleString()} nodes
                    </span>
                )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {capacities.map((capacity, i) => (
                    <CapacityCard
                        key={capacity.name}
                        capacity={capacity}
                        details={partitions.get(capacity.name)?.details ?? {}}
                        index={i}
                    />
                ))}
            </div>
        </div>
    );
}
