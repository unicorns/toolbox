import type { ReactNode } from 'react';
import { BORDER, TEXT_MUTED, TEXT_PRIMARY } from './theme';

export function ProgressBar({ fraction, barClass = 'bg-sky-500' }: { fraction: number; barClass?: string }) {
    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.min(Math.max(fraction, 0), 1) * 100}%` }} />
        </div>
    );
}

/** Toggleable filter chip with a count, used by Queue/History state filters. */
export function FilterChip({ label, count, active, colorClass, onClick }: {
    label: string; count: number; active: boolean; colorClass?: string; onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`cursor-pointer rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                active
                    ? 'border-cyan-600 bg-cyan-600 text-white dark:border-cyan-400 dark:bg-cyan-400 dark:text-zinc-950'
                    : `${BORDER} bg-transparent hover:border-zinc-400 dark:hover:border-zinc-500 ${colorClass ?? TEXT_PRIMARY}`
            }`}
        >
            {label} <span className={active ? 'opacity-80' : TEXT_MUTED}>{count}</span>
        </button>
    );
}

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
    return (
        <span className="group relative inline-block">
            {children}
            <span className="invisible absolute bottom-full left-1/2 z-10 mb-1 w-64 -translate-x-1/2 rounded-md bg-zinc-800 px-3 py-2 text-center text-xs text-zinc-100 opacity-0 shadow-lg transition-opacity duration-200 group-hover:visible group-hover:opacity-100 dark:bg-zinc-700">
                {text}
            </span>
        </span>
    );
}

export function EmptyState({ children }: { children: ReactNode }) {
    return <p className={`py-12 text-center text-sm ${TEXT_MUTED}`}>{children}</p>;
}
