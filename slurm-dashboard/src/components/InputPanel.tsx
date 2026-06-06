import type { KeyboardEvent } from 'react';
import { useState } from 'react';
import { SLURM_COMMAND, ANONYMIZED_EXAMPLE_DATA } from '../parsing';
import { BG_CARD, BORDER, SECTION_LABEL, TEXT_MUTED } from './theme';

interface InputPanelProps {
    onAnalyze: (text: string) => void;
    showMessage: (msg: string, type?: string) => void;
}

export function InputPanel({ onAnalyze, showMessage }: InputPanelProps) {
    const [inputValue, setInputValue] = useState('');
    const [copyText, setCopyText] = useState('Copy');

    function handleAnalyzeClick() {
        if (!inputValue.trim()) {
            showMessage('Please paste some Slurm output first.', 'error');
        } else {
            onAnalyze(inputValue);
        }
    }

    function handleCopy() {
        navigator.clipboard.writeText(SLURM_COMMAND).then(
            () => setCopyText('Copied!'),
            () => {
                setCopyText('Failed!');
                showMessage('Failed to copy command.', 'error');
            }
        );
        setTimeout(() => setCopyText('Copy'), 2000);
    }

    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleAnalyzeClick();
        }
    }

    return (
        <div className={`${BG_CARD} mx-auto mb-8 max-w-4xl rounded-lg border ${BORDER} p-5 shadow-sm`}>
            <p className={`mb-4 text-sm ${TEXT_MUTED}`}>
                Run the command below on a login node, then paste its output here.
                Everything stays in your browser — nothing is uploaded or stored.
            </p>

            <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between">
                    <span className={SECTION_LABEL}>Command</span>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className={`w-16 cursor-pointer rounded-md border ${BORDER} py-0.5 text-center font-mono text-[11px] font-medium transition-colors hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400`}
                    >
                        {copyText}
                    </button>
                </div>
                <pre className="max-h-24 overflow-auto rounded-md bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-200 dark:bg-zinc-950">
                    <code>{SLURM_COMMAND}</code>
                </pre>
            </div>

            <textarea
                rows={8}
                aria-label="Slurm command output"
                className={`w-full rounded-md border ${BORDER} bg-zinc-50 p-3 font-mono text-xs transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:bg-zinc-950 dark:text-zinc-200`}
                placeholder="Paste one or more command outputs…"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
            />
            <div className="mt-3 flex gap-2">
                <button
                    type="button"
                    onClick={handleAnalyzeClick}
                    className="cursor-pointer rounded-md bg-cyan-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:bg-cyan-500 dark:text-zinc-950 dark:hover:bg-cyan-400 dark:focus:ring-offset-zinc-900"
                >
                    Analyze
                </button>
                <button
                    type="button"
                    onClick={() => onAnalyze(ANONYMIZED_EXAMPLE_DATA)}
                    className={`cursor-pointer rounded-md border ${BORDER} px-5 py-2 text-sm font-medium transition-colors hover:border-zinc-400 dark:hover:border-zinc-500`}
                >
                    Load example
                </button>
            </div>
        </div>
    );
}
