import type { TimezoneMode } from '../types';
import { getRelativeTimeString } from '../parsing';
import { useTheme, type Theme } from '../useTheme';
import { BORDER, TEXT_MUTED, TEXT_PRIMARY } from './theme';

function ThemeToggle({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
    const options: { value: Theme; label: string }[] = [
        { value: 'light', label: 'Light' },
        { value: 'system', label: 'Sys' },
        { value: 'dark', label: 'Dark' },
    ];
    return (
        <div className={`inline-flex overflow-hidden rounded-md border ${BORDER}`} role="group" aria-label="Theme">
            {options.map(({ value, label }) => (
                <button
                    key={value}
                    type="button"
                    aria-pressed={theme === value}
                    onClick={() => setTheme(value)}
                    className={`cursor-pointer px-2.5 py-1 font-mono text-[11px] font-medium transition-colors ${
                        theme === value
                            ? 'bg-zinc-800 text-zinc-50 dark:bg-zinc-200 dark:text-zinc-900'
                            : `${TEXT_MUTED} hover:bg-zinc-100 dark:hover:bg-zinc-800`
                    }`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

interface TopBarProps {
    hasData: boolean;
    clusterDate: string | null;
    timezone: TimezoneMode;
    setTimezone: (tz: TimezoneMode) => void;
    detectedTimezone: string | null;
    onNewData: () => void;
}

export function TopBar({ hasData, clusterDate, timezone, setTimezone, detectedTimezone, onNewData }: TopBarProps) {
    const { theme, setTheme } = useTheme();
    const age = clusterDate ? getRelativeTimeString(clusterDate, timezone, detectedTimezone) : '';

    return (
        <header className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
            <h1 className={`font-mono text-lg font-semibold tracking-tight ${TEXT_PRIMARY}`}>
                Slurm Dashboard
                <span className="ml-1.5 inline-block h-3.5 w-1.5 translate-y-px bg-cyan-500 dark:bg-cyan-400" aria-hidden="true" />
            </h1>

            {hasData && clusterDate && (
                <span className={`font-mono text-xs ${TEXT_MUTED}`}>
                    snapshot <span className={TEXT_PRIMARY}>{clusterDate}</span>
                    {age && <span className="ml-1.5 rounded-full bg-zinc-200 px-2 py-0.5 dark:bg-zinc-800">{age}</span>}
                </span>
            )}

            <div className="ml-auto flex items-center gap-3">
                {hasData && (
                    <>
                        <select
                            aria-label="Timezone"
                            value={timezone}
                            onChange={e => setTimezone(e.target.value as TimezoneMode)}
                            className={`h-7 cursor-pointer rounded-md border ${BORDER} bg-transparent px-1.5 font-mono text-[11px] ${TEXT_MUTED} focus:border-cyan-500 focus:outline-none dark:bg-zinc-900`}
                        >
                            <option value="auto" disabled={!detectedTimezone}>
                                {detectedTimezone ? `TZ: auto (${detectedTimezone})` : 'TZ: auto'}
                            </option>
                            <option value="utc">TZ: UTC</option>
                            <option value="local">TZ: local</option>
                        </select>
                        <button
                            type="button"
                            onClick={onNewData}
                            className={`h-7 cursor-pointer rounded-md border ${BORDER} px-2.5 font-mono text-[11px] font-medium ${TEXT_PRIMARY} transition-colors hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400`}
                        >
                            New data
                        </button>
                    </>
                )}
                <ThemeToggle theme={theme} setTheme={setTheme} />
            </div>
        </header>
    );
}
