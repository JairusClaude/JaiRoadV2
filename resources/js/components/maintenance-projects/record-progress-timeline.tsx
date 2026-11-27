import { RelatedPageControls } from '@/components/maintenance-projects/record-related-lists';
import type { RelatedPagination } from '@/components/maintenance-projects/record-related-lists';
import { updateMonth } from '@/lib/monthly-updates';
import type { MaintenanceRecordDetail } from '@/types/maintenance-records';
import type { MonthlyUpdateSummary } from '@/types/monthly-updates';

export function RecordProgressTimeline({
    record,
    updates,
    checkpointMonths,
    pagination,
}: {
    record: MaintenanceRecordDetail;
    updates: MonthlyUpdateSummary[];
    checkpointMonths?: (string | null)[];
    pagination?: RelatedPagination;
}) {
    const ordered = [...updates].sort((a, b) =>
        a.update_month.localeCompare(b.update_month),
    );

    const checkpoints = [25, 50, 75, 100].map((target, index) => ({
        target,
        month: checkpointMonths
            ? checkpointMonths[index]
            : ordered.find(
                  (update) => Number(update.progress_percentage) >= target,
              )?.update_month,
    }));

    return (
        <section className="jr-detail-section" aria-label="Progress timeline">
            <h2>Progress timeline</h2>
            <p className="jr-field-hint">
                Recorded dates and reported progress, not projected milestones.
            </p>
            <ol className="mt-3 space-y-3 border-l border-slate-300 pl-4">
                <li>
                    <strong>Start date</strong>
                    <p>{record.start_date || 'Not recorded'}</p>
                </li>
                {ordered.map((update) => (
                    <li key={update.id}>
                        <strong>{updateMonth(update.update_month)}</strong>
                        <p>{update.progress_percentage}% reported progress</p>
                    </li>
                ))}
                {record.status === 'Completed' && (
                    <li>
                        <strong>Completion date</strong>
                        <p>{record.complete_date || 'Not recorded'}</p>
                    </li>
                )}
            </ol>
            <RelatedPageControls
                pagination={pagination}
                parameter="update_page"
                label="Progress timeline pages"
            />
            <h3 className="mt-4 font-semibold">
                Recorded progress checkpoints
            </h3>
            <p className="jr-field-hint">
                Earliest saved report at each threshold. These are derived
                indicators, not separately approved project milestones.
            </p>
            <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {checkpoints.map(({ target, month }) => (
                    <div key={target} className="min-w-0 rounded-lg border p-3">
                        <dt className="font-semibold">{target}% reported</dt>
                        <dd className="text-sm">
                            {month ? updateMonth(month) : 'Not yet recorded'}
                        </dd>
                    </div>
                ))}
            </dl>
            {ordered.length === 0 && (
                <p className="jr-field-hint">No monthly updates recorded.</p>
            )}
        </section>
    );
}
