import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'system' | 'dark';

const STORAGE_KEY = 'slurm-dashboard-theme';

function getStoredTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return 'system';
}

function applyTheme(theme: Theme): void {
    const isDark =
        theme === 'dark' ||
        (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
    const [theme, setThemeState] = useState<Theme>(getStoredTheme);

    const setTheme = useCallback((t: Theme) => {
        localStorage.setItem(STORAGE_KEY, t);
        setThemeState(t);
        applyTheme(t);
    }, []);

    useEffect(() => {
        applyTheme(theme);

        if (theme !== 'system') return;

        const mq = matchMedia('(prefers-color-scheme: dark)');
        const handler = () => applyTheme('system');
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [theme]);

    return { theme, setTheme };
}
