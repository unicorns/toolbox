import type { CSSProperties } from 'react';
import { useMemo, useState, Fragment } from 'react';
import type { SlurmQueueItem, TimezoneMode } from '../types';
import { computeUserUsage } from '../insights';
import { formatMemoryMB, getRelativeTimeString } from '../parsing';
import { BG_CARD, BG_INSET, BORDER, SECTION_LABEL, TEXT_MUTED, TEXT_PRIMARY } from './theme';

const WEEK_MS = 7 * 24 * 3600 * 1000;

interface UserUsageProps {
    queue: SlurmQueueItem[];
    timezoneMode: TimezoneMode;
    detectedTimezone: string | null;
}

export function UserUsage({ queue, timezoneMode, detectedTimezone }: UserUsageProps) {
    const usage = useMemo(() => computeUserUsage(queue), [queue]);
    const [expanded, setExpanded] = useState<string | null>(null);

    if (usage.length === 0) return null;

    const hasGpus = usage.some(u => u.gpus > 0);

    return (
        <section
            aria-label="Usage by user"
            className={`${BG_CARD} animate-rise rounded-lg border ${BORDER} p-5 shadow-sm`}
            style={{ '--rise-delay': '280ms' } as CSSProperties}
        >
            <h2 className={`${SECTION_LABEL} mb-3`}>Usage by user</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                    <thead>
                        <tr className={`border-b ${BORDER} text-[10px] uppercase tracking-wider ${TEXT_MUTED}`}>
                            <th className="py-2 pr-4 font-medium">User</th>
                            {hasGpus && <th className="py-2 pr-4 text-right font-medium">GPUs</th>}
                            <th className="py-2 pr-4 text-right font-medium">CPUs</th>
                            <th className="py-2 pr-4 text-right font-medium">Mem</th>
                            <th className="py-2 pr-4 text-right font-medium">Nodes</th>
                            <th className="py-2 pr-4 text-right font-medium">Jobs</th>
                            <th className="py-2 text-right font-medium">Oldest job</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usage.map(user => {
                            const isExpanded = expanded === user.user;
                            // Flag week-old jobs: long-lived interactive holds are usually forgotten.
                            const oldestMs = user.oldestStart ? Date.now() - new Date(user.oldestStart).getTime() : 0;
                            const oldestIsStale = oldestMs > WEEK_MS;
                            const relativeOldest = user.oldestStart
                                ? getRelativeTimeString(user.oldestStart, timezoneMode, detectedTimezone, 'old')
                                : '—';
                            return (
                                <Fragment key={user.user}>
                                    <tr
                                        data-testid="user-row"
                                        onClick={() => setExpanded(isExpanded ? null : user.user)}
                                        className={`cursor-pointer border-b ${BORDER} transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50`}
                                    >
                                        <td className={`py-2 pr-4 font-medium ${TEXT_PRIMARY}`}>
                                            <span className={`mr-1.5 inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▸</span>
                                            {user.user}
                                        </td>
                                        {hasGpus && (
                                            <td className={`py-2 pr-4 text-right font-semibold ${user.gpus > 0 ? TEXT_PRIMARY : TEXT_MUTED}`}>
                                                {user.gpus.toLocaleString()}
                                            </td>
                                        )}
                                        <td className="py-2 pr-4 text-right">{user.cpus.toLocaleString()}</td>
                                        <td className="py-2 pr-4 text-right">{user.memMB > 0 ? formatMemoryMB(user.memMB) : '—'}</td>
                                        <td className="py-2 pr-4 text-right">{user.nodeCount.toLocaleString()}</td>
                                        <td className="py-2 pr-4 text-right">{user.jobCount.toLocaleString()}</td>
                                        <td className={`py-2 text-right ${oldestIsStale ? 'font-semibold text-amber-600 dark:text-amber-400' : TEXT_MUTED}`}>
                                            {relativeOldest}
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className={BG_INSET}>
                                            <td colSpan={hasGpus ? 7 : 6} className="px-4 py-3">
                                                <ul className="space-y-1">
                                                    {user.jobs.map(job => (
                                                        <li key={job.JobId} className="flex flex-wrap items-baseline gap-x-4">
                                                            <span className={`font-semibold ${TEXT_PRIMARY}`}>{job.JobId}</span>
                                                            <span className={TEXT_PRIMARY}>{job.Name}</span>
                                                            <span className={TEXT_MUTED}>{job.Partition}</span>
                                                            <span className={TEXT_MUTED}>{job.NodeList}</span>
                                                            <span className={`ml-auto ${TEXT_MUTED}`}>{job.Time}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
