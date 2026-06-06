// Industrial ops-console palette: zinc surfaces, cyan accent, semantic states.

import type { NodeStateKind } from '../insights';

/** Muted/secondary text (labels, hints, empty-state messages). */
export const TEXT_MUTED = 'text-zinc-500 dark:text-zinc-400';

/** Primary body text. */
export const TEXT_PRIMARY = 'text-zinc-800 dark:text-zinc-200';

/** Card / panel surface. */
export const BG_CARD = 'bg-white dark:bg-zinc-900';

/** Subtle border for cards and dividers. */
export const BORDER = 'border-zinc-200 dark:border-zinc-800';

/** Recessed surface (table headers, expanded rows, code blocks). */
export const BG_INSET = 'bg-zinc-100 dark:bg-zinc-950/60';

/** Section label: small uppercase mono tracking. */
export const SECTION_LABEL = `font-mono text-[11px] font-medium uppercase tracking-[0.14em] ${TEXT_MUTED}`;

// --- NODE / JOB STATE COLOR MAPS ---

export const NODE_STATE_BADGE: Record<NodeStateKind, string> = {
    idle: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    mixed: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
    allocated: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    unhealthy: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    other: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

const JOB_STATE_COLORS: [string, string][] = [
    ['RUNNING', 'text-emerald-600 dark:text-emerald-400'],
    ['R', 'text-emerald-600 dark:text-emerald-400'],
    ['PENDING', 'text-amber-600 dark:text-amber-400'],
    ['PD', 'text-amber-600 dark:text-amber-400'],
    ['COMPLETED', 'text-sky-600 dark:text-sky-400'],
    ['FAILED', 'text-red-600 dark:text-red-400'],
    ['TIMEOUT', 'text-red-600 dark:text-red-400'],
    ['NODE_FAIL', 'text-red-600 dark:text-red-400'],
    ['CANCELLED', 'text-red-600 dark:text-red-400'],
    ['OUT_OF_MEMORY', 'text-red-600 dark:text-red-400'],
];

export function jobStateColor(state: string): string {
    for (const [prefix, color] of JOB_STATE_COLORS) {
        if (state.startsWith(prefix)) return color;
    }
    return TEXT_MUTED;
}

export function isFailureState(state: string): boolean {
    return ['FAILED', 'TIMEOUT', 'NODE_FAIL', 'OUT_OF_MEMORY'].some(s => state.startsWith(s));
}
