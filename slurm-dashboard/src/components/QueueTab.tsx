import { useMemo, useState, Fragment } from 'react';
import type { SlurmQueueItem, TimezoneMode } from '../types';
import { computeQueueStats, parseDurationSeconds } from '../insights';
import { parseTRES, parseUnitValue, getRelativeTimeString } from '../parsing';
import { QueueJobDetails } from './JobDetails';
import { BG_CARD, BG_INSET, BORDER, TEXT_MUTED, TEXT_PRIMARY, jobStateColor } from './theme';
import { ProgressBar, FilterChip, EmptyState } from './ui';

type StateFilter = 'running' | 'pending' | 'other' | null;

function stateBucket(job: SlurmQueueItem): Exclude<StateFilter, null> {
    if (job.State === 'RUNNING' || job.State === 'R') return 'running';
    if (job.State === 'PENDING' || job.State === 'PD') return 'pending';
    return 'other';
}

/** Pending reason from squeue's NODELIST(REASON) column, e.g. "(Resources)". */
function pendingReason(job: SlurmQueueItem): string | null {
    if (stateBucket(job) !== 'pending') return null;
    const fromDetails = job.details?.Reason;
    if (fromDetails && fromDetails !== 'None') return fromDetails;
    const match = /^\((.+)\)$/.exec(job.NodeList ?? '');
    return match ? match[1] : null;
}

/** Compact resources summary: "4n · 32 GPU" for GPU jobs, "32 CPU · 170G" otherwise. */
function resourceSummary(job: SlurmQueueItem): string {
    const details = job.details;
    const nodes = parseInt(details?.NumNodes ?? job.Nodes) || 0;
    const nodesPart = `${nodes}n`;
    const tresString = stateBucket(job) === 'pending'
        ? details?.ReqTRES
        : (details?.AllocTRES && details.AllocTRES !== '(null)' ? details.AllocTRES : details?.TRES);
    if (!tresString || tresString === '(null)') return nodesPart;
    const tres = parseTRES(tresString);
    const gpus = parseUnitValue(tres.gres.gpu ?? '0');
    if (gpus > 0) return `${nodesPart} · ${gpus} GPU`;
    const mem = tres.mem !== 'N/A' ? ` · ${tres.mem}` : '';
    return `${nodesPart} · ${tres.cpu} CPU${mem}`;
}

function RuntimeCell({ job }: { job: SlurmQueueItem }) {
    if (stateBucket(job) === 'pending') return <span className={TEXT_MUTED}>—</span>;
    const elapsed = parseDurationSeconds(job.Time);
    const limit = parseDurationSeconds(job.TimeLimit);
    const fraction = elapsed !== null && limit !== null && limit > 0 ? elapsed / limit : null;
    return (
        <div className="min-w-24">
            <div className="flex items-baseline justify-between gap-2">
                <span>{job.Time}</span>
                {limit !== null && <span className={`text-[10px] ${TEXT_MUTED}`}>/{job.TimeLimit}</span>}
            </div>
            {fraction !== null && (
                <ProgressBar fraction={fraction} barClass={fraction > 0.9 ? 'bg-red-500' : 'bg-sky-500'} />
            )}
        </div>
    );
}

type SortColumn = 'JobId' | 'User' | 'Name' | 'Partition' | 'Start' | null;

function startTime(job: SlurmQueueItem): string {
    return job.details?.StartTime ?? '';
}

interface QueueTabProps {
    queue: SlurmQueueItem[];
    timezoneMode: TimezoneMode;
    detectedTimezone: string | null;
}

export function QueueTab({ queue, timezoneMode, detectedTimezone }: QueueTabProps) {
    const [stateFilter, setStateFilter] = useState<StateFilter>(null);
    const [textFilter, setTextFilter] = useState('');
    const [sort, setSort] = useState<{ column: SortColumn; asc: boolean }>({ column: null, asc: true });
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const stats = useMemo(() => computeQueueStats(queue), [queue]);

    const visibleJobs = useMemo(() => {
        let jobs = queue;
        if (stateFilter) jobs = jobs.filter(job => stateBucket(job) === stateFilter);
        if (textFilter) {
            const needle = textFilter.toLowerCase();
            jobs = jobs.filter(job =>
                job.JobId.toLowerCase().includes(needle) ||
                job.User.toLowerCase().includes(needle) ||
                job.Name.toLowerCase().includes(needle) ||
                job.Partition.toLowerCase().includes(needle)
            );
        }

        const sorted = [...jobs];
        if (sort.column) {
            const key = sort.column;
            sorted.sort((a, b) => {
                const av = key === 'Start' ? startTime(a) : a[key];
                const bv = key === 'Start' ? startTime(b) : b[key];
                const cmp = key === 'JobId'
                    ? (parseInt(av) || 0) - (parseInt(bv) || 0)
                    : av.localeCompare(bv);
                return sort.asc ? cmp : -cmp;
            });
        } else {
            // Default: pending first (submission order), then running by most recent start.
            const rank = (job: SlurmQueueItem) => ({ pending: 0, running: 1, other: 2 })[stateBucket(job)];
            sorted.sort((a, b) => rank(a) - rank(b) || (rank(a) === 1 ? startTime(b).localeCompare(startTime(a)) : 0));
        }
        return sorted;
    }, [queue, stateFilter, textFilter, sort]);

    if (queue.length === 0) {
        return <EmptyState>No queue data found — include `squeue` output in your paste.</EmptyState>;
    }

    function toggleSort(column: SortColumn) {
        setSort(prev => prev.column === column ? { column, asc: !prev.asc } : { column, asc: true });
    }

    function chipToggle(bucket: Exclude<StateFilter, null>) {
        setStateFilter(prev => prev === bucket ? null : bucket);
    }

    const headers: { label: string; column: SortColumn }[] = [
        { label: 'Job ID', column: 'JobId' },
        { label: 'User', column: 'User' },
        { label: 'Name', column: 'Name' },
        { label: 'Partition', column: 'Partition' },
        { label: 'Resources', column: null },
        { label: 'Runtime', column: null },
        { label: 'State', column: null },
        { label: 'Start', column: 'Start' },
    ];

    return (
        <div className={`${BG_CARD} rounded-lg border ${BORDER} p-4 shadow-sm`}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <FilterChip label="Running" count={stats.running} active={stateFilter === 'running'}
                    colorClass="text-emerald-700 dark:text-emerald-400" onClick={() => chipToggle('running')} />
                <FilterChip label="Pending" count={stats.pending} active={stateFilter === 'pending'}
                    colorClass="text-amber-700 dark:text-amber-400" onClick={() => chipToggle('pending')} />
                {stats.other > 0 && (
                    <FilterChip label="Other" count={stats.other} active={stateFilter === 'other'} onClick={() => chipToggle('other')} />
                )}
                <input
                    type="text"
                    placeholder="Filter by id, user, name, partition…"
                    value={textFilter}
                    onChange={e => setTextFilter(e.target.value)}
                    className={`ml-auto w-64 rounded-md border ${BORDER} bg-transparent px-2.5 py-1 font-mono text-xs focus:border-cyan-500 focus:outline-none dark:bg-zinc-950`}
                />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                    <thead>
                        <tr className={`border-b ${BORDER} text-[10px] uppercase tracking-wider ${TEXT_MUTED}`}>
                            {headers.map(({ label, column }) => (
                                <th key={label} className="py-2 pr-4 font-medium">
                                    {column ? (
                                        <button
                                            type="button"
                                            onClick={() => toggleSort(column)}
                                            className="cursor-pointer uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-200"
                                        >
                                            {label}
                                            {sort.column === column && <span className="ml-1">{sort.asc ? '↑' : '↓'}</span>}
                                        </button>
                                    ) : label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visibleJobs.map(job => {
                            const isExpanded = expandedId === job.JobId;
                            const hasDetails = Boolean(job.details && Object.keys(job.details).length > 0);
                            const reason = pendingReason(job);
                            const start = startTime(job);
                            const relativeStart = getRelativeTimeString(start, timezoneMode, detectedTimezone);
                            return (
                                <Fragment key={job.JobId}>
                                    <tr
                                        data-testid="job-row"
                                        onClick={() => hasDetails && setExpandedId(isExpanded ? null : job.JobId)}
                                        className={`border-b ${BORDER} transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${hasDetails ? 'cursor-pointer' : ''}`}
                                    >
                                        <td className={`py-2 pr-4 font-semibold ${TEXT_PRIMARY}`}>
                                            {hasDetails && <span className={`mr-1 inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▸</span>}
                                            {job.JobId}
                                        </td>
                                        <td className="py-2 pr-4">{job.User}</td>
                                        <td className="max-w-56 truncate py-2 pr-4" title={job.Name}>{job.Name}</td>
                                        <td className={`py-2 pr-4 ${TEXT_MUTED}`}>{job.Partition}</td>
                                        <td className="py-2 pr-4 whitespace-nowrap">{resourceSummary(job)}</td>
                                        <td className="py-2 pr-4"><RuntimeCell job={job} /></td>
                                        <td className={`py-2 pr-4 font-semibold ${jobStateColor(job.State)}`}>
                                            {job.State}
                                            {reason && (
                                                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                    {reason}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2 whitespace-nowrap">
                                            {start || '—'}
                                            {relativeStart && <span className={`block text-[10px] ${TEXT_MUTED}`}>{relativeStart}</span>}
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className={BG_INSET}>
                                            <td colSpan={8} className="p-4">
                                                <QueueJobDetails job={job} />
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
                {visibleJobs.length === 0 && <EmptyState>No jobs match the current filters.</EmptyState>}
            </div>
        </div>
    );
}
