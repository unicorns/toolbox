import { useMemo } from 'react';
import type { SlurmQueueItem } from '../types';
import { parseTRES, parseMemoryToMB, parseUnitValue, parseGresField, expandNodeList, formatMemoryMB } from '../parsing';
import { isNodeUnhealthy } from '../insights';
import { BG_INSET, BORDER, TEXT_MUTED, TEXT_PRIMARY, nodeStateKind, NODE_STATE_BADGE } from './theme';
import { ProgressBar, Tooltip } from './ui';

function getGresBarColor(type: string): string {
    return type.includes('gpu') ? 'bg-violet-500' : 'bg-teal-500';
}

function GresResourceDisplay({ details }: { details: Record<string, string> }) {
    const cfgTRES = parseTRES(details.CfgTRES ?? '');
    const allocTRES = parseTRES(details.AllocTRES ?? '');
    const configuredGres = parseGresField(details.Gres ?? '');

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

    return (
        <div className="space-y-3">
            {Array.from(gresGroups.entries()).map(([baseType, keys]) => {
                const subtypes = keys.filter(k => k !== baseType).sort();
                const hasGeneric = keys.includes(baseType);

                if (hasGeneric && subtypes.length > 0) {
                    const total = parseInt(cfgTRES.gres[baseType] ?? '0');
                    const allocated = parseInt(allocTRES.gres[baseType] ?? '0');
                    const fraction = total > 0 ? allocated / total : 0;

                    return (
                        <div key={baseType}>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-medium">GRES/{baseType.toUpperCase()} (TOTAL): {allocated}/{total}</span>
                                <Tooltip text="A GRES subtype may appear available if a job requested the resource generically (e.g., --gres=gpu:1). Check the (TOTAL) allocation for true usage.">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </Tooltip>
                            </div>
                            <ProgressBar fraction={fraction} barClass={getGresBarColor(baseType)} />
                            <div className={`ml-3 mt-2 space-y-2 border-l-2 ${BORDER} pl-3`}>
                                {subtypes.map(key => {
                                    const subTotal = parseUnitValue(cfgTRES.gres[key] ?? String(configuredGres[key] ?? '0'));
                                    const subAlloc = parseUnitValue(allocTRES.gres[key] ?? '0');
                                    if (subTotal === 0 && subAlloc === 0) return null;
                                    return (
                                        <div key={key}>
                                            <span className="font-mono text-xs font-medium">GRES/{key.toUpperCase()}: {subAlloc}/{subTotal}</span>
                                            <ProgressBar fraction={subTotal > 0 ? subAlloc / subTotal : 0} barClass="bg-violet-400" />
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
                    return (
                        <div key={key}>
                            <span className="font-mono text-xs font-medium">GRES/{key.toUpperCase()}: {allocated.toLocaleString()}/{total.toLocaleString()}</span>
                            <ProgressBar fraction={total > 0 ? allocated / total : 0} barClass={getGresBarColor(key)} />
                        </div>
                    );
                });
            })}
        </div>
    );
}

interface NodeDetailProps {
    name: string;
    details: Record<string, string>;
    queue: SlurmQueueItem[];
    onClose: () => void;
}

export function NodeDetail({ name, details, queue, onClose }: NodeDetailProps) {
    const jobs = useMemo(
        () => queue.filter(job =>
            (job.State === 'RUNNING' || job.State === 'R') && expandNodeList(job.NodeList ?? '').includes(name)
        ),
        [queue, name],
    );

    const cfgTRES = parseTRES(details.CfgTRES ?? '');
    const allocTRES = parseTRES(details.AllocTRES ?? '');
    const cpuTot = parseInt(cfgTRES.cpu || details.CPUTot || '0') || 0;
    const cpuAlloc = parseInt(allocTRES.cpu || details.CPUAlloc || '0') || 0;
    const memTot = parseMemoryToMB(cfgTRES.mem || details.RealMemory);
    const memAlloc = parseMemoryToMB(allocTRES.mem || details.AllocMem);

    const state = details.State ?? '';
    const badge = NODE_STATE_BADGE[nodeStateKind(state, isNodeUnhealthy(state))];

    return (
        <section
            aria-label={`${name} details`}
            className={`mt-2 rounded-lg border ${BORDER} ${BG_INSET} p-4`}
        >
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <h3 className={`font-mono text-sm font-semibold ${TEXT_PRIMARY}`}>{name}</h3>
                    <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${badge}`}>{state}</span>
                    {details.Reason && <span className="font-mono text-[11px] text-red-600 dark:text-red-400">{details.Reason}</span>}
                </div>
                <button
                    type="button"
                    aria-label="Close node details"
                    onClick={onClose}
                    className={`cursor-pointer font-mono text-xs ${TEXT_MUTED} hover:text-zinc-700 dark:hover:text-zinc-200`}
                >
                    ✕
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                    <div>
                        <span className="font-mono text-xs font-medium">CPU: {cpuAlloc}/{cpuTot}</span>
                        <ProgressBar fraction={cpuTot > 0 ? cpuAlloc / cpuTot : 0} barClass="bg-sky-500" />
                    </div>
                    <div>
                        <span className="font-mono text-xs font-medium">Memory: {formatMemoryMB(memAlloc)} / {formatMemoryMB(memTot)}</span>
                        <ProgressBar fraction={memTot > 0 ? memAlloc / memTot : 0} barClass="bg-emerald-500" />
                    </div>
                    <GresResourceDisplay details={details} />
                    {details.CPULoad && (
                        <p className={`font-mono text-[11px] ${TEXT_MUTED}`}>load {details.CPULoad} · partitions {details.Partitions ?? '—'}</p>
                    )}
                </div>

                <div>
                    <h4 className={`mb-2 font-mono text-[11px] font-medium uppercase tracking-wider ${TEXT_MUTED}`}>
                        Active jobs ({jobs.length})
                    </h4>
                    {jobs.length === 0 ? (
                        <p className={`font-mono text-xs ${TEXT_MUTED}`}>none</p>
                    ) : (
                        <ul className="space-y-1.5">
                            {jobs.map(job => {
                                const tresString = job.details?.AllocTRES && job.details.AllocTRES !== '(null)' ? job.details.AllocTRES : job.details?.TRES;
                                const tres = parseTRES(tresString ?? '');
                                return (
                                    <li key={job.JobId} className={`rounded-md border ${BORDER} bg-white p-2 font-mono text-[11px] dark:bg-zinc-900`}>
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span>
                                                <span className={`font-semibold ${TEXT_PRIMARY}`}>{job.JobId}</span>
                                                <span className={`ml-1.5 ${TEXT_MUTED}`}>{job.User}</span>
                                            </span>
                                            <span className={TEXT_MUTED}>{job.Time}</span>
                                        </div>
                                        <div className={`mt-0.5 truncate ${TEXT_MUTED}`}>{job.Name}</div>
                                        <div className={`mt-0.5 flex flex-wrap gap-x-3 ${TEXT_MUTED}`}>
                                            <span>cpu {tres.cpu}</span>
                                            <span>mem {tres.mem}</span>
                                            {Object.entries(tres.gres)
                                                .filter(([key]) => !key.includes(':'))
                                                .map(([key, val]) => <span key={key}>{key} {val}</span>)}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </section>
    );
}
