import type { SlurmQueueItem, SlurmHistoryItem } from '../types';
import { parseTRES } from '../parsing';
import { TEXT_MUTED } from './theme';

function TresDetails({ tresString, title }: { tresString: string; title: string }) {
    if (!tresString || tresString === '(null)') return null;
    const tres = parseTRES(tresString);
    return (
        <div className="mb-2">
            <h4 className="text-xs font-bold">{title}:</h4>
            <div className="flex flex-wrap gap-x-6 font-mono text-xs">
                <span><strong className="font-semibold">CPU:</strong> {tres.cpu}</span>
                <span><strong className="font-semibold">Memory:</strong> {tres.mem}</span>
                {Object.entries(tres.gres).map(([key, val]) => (
                    <span key={key}><strong className="font-semibold">GRES/{key.toUpperCase()}:</strong> {val}</span>
                ))}
            </div>
        </div>
    );
}

export function QueueJobDetails({ job }: { job: SlurmQueueItem }) {
    const details = job.details ?? {};
    const allocTres = details.AllocTRES && details.AllocTRES !== '(null)' ? details.AllocTRES : details.TRES;
    const reqTres = details.ReqTRES && details.ReqTRES !== '(null)' ? details.ReqTRES : null;

    return (
        <div>
            {allocTres === reqTres ? (
                <TresDetails tresString={allocTres ?? ''} title="Allocated & Requested Resources" />
            ) : (
                <>
                    <TresDetails tresString={allocTres ?? ''} title="Allocated Resources" />
                    <TresDetails tresString={reqTres ?? ''} title="Requested Resources" />
                </>
            )}
            {(details.Command || details.WorkDir) && (
                <div className={`mt-2 space-y-0.5 font-mono text-[11px] ${TEXT_MUTED}`}>
                    {details.Command && <p className="break-all">cmd: {details.Command}</p>}
                    {details.WorkDir && <p className="break-all">dir: {details.WorkDir}</p>}
                </div>
            )}
        </div>
    );
}

export function HistoryJobDetails({ job }: { job: SlurmHistoryItem }) {
    let reqMem = job.ReqMem ?? '';
    if (reqMem.endsWith('c')) {
        const memVal = parseFloat(reqMem);
        const cpuVal = parseInt(job.ReqCPUS);
        if (!isNaN(memVal) && !isNaN(cpuVal)) {
            const totalMem = memVal * cpuVal;
            const unit = reqMem.replace(/[0-9.c]/g, '');
            reqMem = `${totalMem}${unit}`;
        }
    }
    reqMem = reqMem.replace(/[nc]$/i, '');

    return (
        <div>
            <div className="mb-2">
                <h4 className="text-xs font-bold">Requested Resources:</h4>
                <div className="flex flex-wrap gap-x-6 font-mono text-xs">
                    <span><strong className="font-semibold">CPU:</strong> {job.ReqCPUS}</span>
                    <span><strong className="font-semibold">Memory:</strong> {reqMem}</span>
                    {Object.entries(parseTRES(job.ReqTRES).gres).map(([key, val]) => (
                        <span key={key}><strong className="font-semibold">GRES/{key.toUpperCase()}:</strong> {val}</span>
                    ))}
                </div>
            </div>
            {job.steps && job.steps.length > 0 && (
                <>
                    <h4 className="mb-1 mt-3 text-xs font-bold">Job Steps:</h4>
                    <table className="w-full text-left font-mono text-[11px]">
                        <thead>
                            <tr className={TEXT_MUTED}>
                                <th className="py-0.5 pr-4 font-medium">Step ID</th>
                                <th className="py-0.5 pr-4 font-medium">Name</th>
                                <th className="py-0.5 pr-4 font-medium">State</th>
                                <th className="py-0.5 font-medium">Elapsed</th>
                            </tr>
                        </thead>
                        <tbody>
                            {job.steps.map((step) => (
                                <tr key={step.JobID} className={TEXT_MUTED}>
                                    <td className="py-0.5 pr-4">{step.JobID}</td>
                                    <td className="py-0.5 pr-4">{step.JobName}</td>
                                    <td className="py-0.5 pr-4">{step.State}</td>
                                    <td className="py-0.5">{step.Elapsed}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
}
