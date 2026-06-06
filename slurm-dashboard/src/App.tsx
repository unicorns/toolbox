import { useState, useEffect, useCallback } from 'react';
import type { SlurmData, TimezoneMode } from './types';
import { detectAndParseAll } from './parsing';
import { TopBar } from './components/TopBar';
import { InputPanel } from './components/InputPanel';
import { CapacityCards } from './components/CapacityCards';
import { NodeHeatmap } from './components/NodeHeatmap';
import { UserUsage } from './components/UserUsage';
import { QueueTab } from './components/QueueTab';
import { HistoryTab } from './components/HistoryTab';
import { TEXT_MUTED } from './components/theme';
import { EmptyState } from './components/ui';

function MessageBox({ message, type, onDismiss }: { message: string; type: string; onDismiss: () => void }) {
    useEffect(() => {
        if (message) {
            const timer = setTimeout(onDismiss, 4000);
            return () => clearTimeout(timer);
        }
    }, [message, onDismiss]);

    if (!message) return null;

    const color = type === 'error' ? 'bg-red-600' : 'bg-emerald-600';
    return (
        <div className={`fixed bottom-5 right-5 z-50 rounded-lg px-5 py-3 text-sm text-white shadow-xl ${color}`}>
            {message}
        </div>
    );
}

type Tab = 'overview' | 'queue' | 'history';

function TabButton({ tab, activeTab, count, onClick, children }: {
    tab: Tab; activeTab: Tab; count?: number; onClick: (tab: Tab) => void; children: string;
}) {
    const isActive = tab === activeTab;
    return (
        <button
            type="button"
            onClick={() => onClick(tab)}
            className={`cursor-pointer whitespace-nowrap border-b-2 px-1 pb-2.5 pt-1 font-mono text-sm transition-colors ${
                isActive
                    ? 'border-cyan-500 font-semibold text-cyan-700 dark:border-cyan-400 dark:text-cyan-400'
                    : `border-transparent font-medium ${TEXT_MUTED} hover:border-zinc-300 hover:text-zinc-700 dark:hover:border-zinc-600 dark:hover:text-zinc-300`
            }`}
        >
            {children}
            {count !== undefined && count > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-px text-[10px] ${
                    isActive ? 'bg-cyan-100 dark:bg-cyan-950' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                    {count}
                </span>
            )}
        </button>
    );
}

function selectBestTab(parsed: SlurmData): Tab {
    if (parsed.nodes.size > 0 || parsed.partitions.size > 0) return 'overview';
    if (parsed.queue.length > 0) return 'queue';
    return 'history';
}

function App() {
    const [slurmData, setSlurmData] = useState<SlurmData | null>(null);
    const [showInput, setShowInput] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');
    const [timezone, setTimezone] = useState<TimezoneMode>('auto');

    const showMessage = useCallback((text: string, type = 'info') => {
        setMessage(text);
        setMessageType(type);
    }, []);

    function handleAnalyze(text: string): void {
        try {
            const parsed = detectAndParseAll(text);
            const isEmpty = parsed.partitions.size === 0 && parsed.nodes.size === 0
                && parsed.queue.length === 0 && parsed.history.length === 0;
            if (isEmpty) {
                showMessage('No Slurm data recognized in input.', 'error');
                setSlurmData(null);
                return;
            }
            setSlurmData(parsed);
            setShowInput(false);
            setActiveTab(selectBestTab(parsed));
            setTimezone(parsed.detectedTimezone ? 'auto' : 'local');
            setMessage('');
        } catch (error: unknown) {
            console.error('Parsing Error:', error);
            showMessage(`Could not process input. Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
            setSlurmData(null);
        }
    }

    const hasOverviewData = slurmData !== null && (slurmData.nodes.size > 0 || slurmData.partitions.size > 0);

    return (
        <div className="min-h-screen bg-zinc-100 font-sans text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
            <div className="mx-auto max-w-7xl p-4 md:p-6">
                <MessageBox message={message} type={messageType} onDismiss={() => setMessage('')} />
                <TopBar
                    hasData={slurmData !== null}
                    clusterDate={slurmData?.clusterDate ?? null}
                    timezone={timezone}
                    setTimezone={setTimezone}
                    detectedTimezone={slurmData?.detectedTimezone ?? null}
                    onNewData={() => setShowInput(true)}
                />
                <main>
                    {(showInput || slurmData === null) && (
                        <InputPanel onAnalyze={handleAnalyze} showMessage={showMessage} />
                    )}

                    {slurmData && (
                        <>
                            <nav className="mb-5 flex gap-6 border-b border-zinc-200 dark:border-zinc-800" aria-label="Tabs">
                                <TabButton tab="overview" activeTab={activeTab} onClick={setActiveTab}>Overview</TabButton>
                                <TabButton tab="queue" activeTab={activeTab} count={slurmData.queue.length} onClick={setActiveTab}>Queue</TabButton>
                                <TabButton tab="history" activeTab={activeTab} count={slurmData.history.length} onClick={setActiveTab}>History</TabButton>
                            </nav>

                            {activeTab === 'overview' && (
                                hasOverviewData ? (
                                    <div className="space-y-6">
                                        <CapacityCards partitions={slurmData.partitions} nodes={slurmData.nodes} queue={slurmData.queue} />
                                        <NodeHeatmap partitions={slurmData.partitions} nodes={slurmData.nodes} queue={slurmData.queue} />
                                        <UserUsage queue={slurmData.queue} timezoneMode={timezone} detectedTimezone={slurmData.detectedTimezone} />
                                    </div>
                                ) : (
                                    <EmptyState>No partition or node data found — include `scontrol show partition/node` output in your paste.</EmptyState>
                                )
                            )}
                            {activeTab === 'queue' && (
                                <QueueTab queue={slurmData.queue} timezoneMode={timezone} detectedTimezone={slurmData.detectedTimezone} />
                            )}
                            {activeTab === 'history' && (
                                <HistoryTab history={slurmData.history} timezoneMode={timezone} detectedTimezone={slurmData.detectedTimezone} />
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}

export default App;
