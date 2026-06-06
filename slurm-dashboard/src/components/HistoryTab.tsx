import { useMemo, useState, Fragment } from 'react';
import type { SlurmHistoryItem, TimezoneMode } from '../types';
import { computeHistoryStats } from '../insights';
import { getRelativeTimeString } from '../parsing';
import { HistoryJobDetails } from './JobDetails';
import { BG_CARD, BG_INSET, BORDER, TEXT_MUTED, TEXT_PRIMARY, jobStateColor, isFailureState } from './theme';
import { FilterChip, EmptyState } from './ui';

function normalizeState(state: string): string {
    return state.startsWith('CANCELLED') ? 'CANCELLED' : state;
}

const CHIP_COLORS: Record<string, string> = {
    COMPLETED: 'text-sky-700 dark:text-sky-400',
    RUNNING: 'text-emerald-700 dark:text-emerald-400',
    FAILED: 'text-red-700 dark:text-red-400',
    OUT_OF_MEMORY: 'text-red-700 dark:text-red-400',
    TIMEOUT: 'text-red-700 dark:text-red-400',
    NODE_FAIL: 'text-red-700 dark:text-red-400',
    CANCELLED: 'text-zinc-600 dark:text-zinc-400',
};

interface HistoryTabProps {
    history: SlurmHistoryItem[];
    timezoneMode: TimezoneMode;
    detectedTimezone: string | null;
}

export function HistoryTab({ history, timezoneMode, detectedTimezone }: HistoryTabProps) {
    const [stateFilter, setStateFilter] = useState<string | null>(null);
    const [textFilter, setTextFilter] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const stats = useMemo(() => computeHistoryStats(history), [history]);

    const visibleJobs = useMemo(() => {
        let jobs = history;
        if (stateFilter) jobs = jobs.filter(job => normalizeState(job.State) === stateFilter);
        if (textFilter) {
            const needle = textFilter.toLowerCase();
            jobs = jobs.filter(job =>
                job.JobID.toLowerCase().includes(needle) ||
                job.JobName.toLowerCase().includes(needle) ||
                job.User.toLowerCase().includes(needle)
            );
        }
        return jobs;
    }, [history, stateFilter, textFilter]);

    if (history.length === 0) {
        return <EmptyState>No history data found — include `sacct` output in your paste.</EmptyState>;
    }

    return (
        <div className={`${BG_CARD} rounded-lg border ${BORDER} p-4 shadow-sm`}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
                {stats.map(({ state, count }) => (
                    <FilterChip
                        key={state}
                        label={state}
                        count={count}
                        active={stateFilter === state}
                        colorClass={CHIP_COLORS[state]}
                        onClick={() => setStateFilter(prev => prev === state ? null : state)}
                    />
                ))}
                <input
                    type="text"
                    placeholder="Filter by id, name, user…"
                    value={textFilter}
                    onChange={e => setTextFilter(e.target.value)}
                    className={`ml-auto w-64 rounded-md border ${BORDER} bg-transparent px-2.5 py-1 font-mono text-xs focus:border-cyan-500 focus:outline-none dark:bg-zinc-950`}
                />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                    <thead>
                        <tr className={`border-b ${BORDER} text-[10px] uppercase tracking-wider ${TEXT_MUTED}`}>
                            <th className="py-2 pr-4 font-medium">Job ID</th>
                            <th className="py-2 pr-4 font-medium">Name</th>
                            <th className="py-2 pr-4 font-medium">User</th>
                            <th className="py-2 pr-4 font-medium">Partition</th>
                            <th className="py-2 pr-4 font-medium">State</th>
                            <th className="py-2 pr-4 font-medium">Elapsed</th>
                            <th className="py-2 pr-4 font-medium">Start</th>
                            <th className="py-2 font-medium">End</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleJobs.map(job => {
                            const isExpanded = expandedId === job.JobID;
                            const hasDetails = (job.steps?.length ?? 0) > 0 || Boolean(job.ReqTRES);
                            const failed = isFailureState(job.State);
                            const relativeStart = getRelativeTimeString(job.Start, timezoneMode, detectedTimezone);
                            const relativeEnd = getRelativeTimeString(job.End, timezoneMode, detectedTimezone);
                            return (
                                <Fragment key={job.JobID}>
                                    <tr
                                        onClick={() => hasDetails && setExpandedId(isExpanded ? null : job.JobID)}
                                        className={`border-b ${BORDER} transition-colors ${
                                            failed ? 'bg-red-50 hover:bg-red-100/70 dark:bg-red-950/20 dark:hover:bg-red-950/40' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                                        } ${hasDetails ? 'cursor-pointer' : ''}`}
                                    >
                                        <td className={`py-2 pr-4 font-semibold ${TEXT_PRIMARY}`}>
                                            {hasDetails && <span className={`mr-1 inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▸</span>}
                                            {job.JobID}
                                        </td>
                                        <td className="max-w-56 truncate py-2 pr-4" title={job.JobName}>{job.JobName}</td>
                                        <td className="py-2 pr-4">{job.User}</td>
                                        <td className={`py-2 pr-4 ${TEXT_MUTED}`}>{job.Partition}</td>
                                        <td className={`py-2 pr-4 font-semibold whitespace-nowrap ${jobStateColor(job.State)}`}>{job.State}</td>
                                        <td className="py-2 pr-4">{job.Elapsed}</td>
                                        <td className="py-2 pr-4 whitespace-nowrap">
                                            {job.Start}
                                            {relativeStart && <span className={`block text-[10px] ${TEXT_MUTED}`}>{relativeStart}</span>}
                                        </td>
                                        <td className="py-2 whitespace-nowrap">
                                            {job.End}
                                            {relativeEnd && <span className={`block text-[10px] ${TEXT_MUTED}`}>{relativeEnd}</span>}
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className={BG_INSET}>
                                            <td colSpan={8} className="p-4">
                                                <HistoryJobDetails job={job} />
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
