import { useForm } from '@inertiajs/react';
import { useRef } from 'react';

export default function DdMediaUpload({
    updateId,
    enabled,
}: {
    updateId: number;
    enabled: boolean;
}) {
    const input = useRef<HTMLInputElement>(null);
    const form = useForm<{ file: File | null }>({ file: null });

    return (
        <section
            className="jr-detail-section"
            aria-label="Upload private media"
        >
            <h2>Upload Media</h2>
            <p className="jr-field-hint">
                Upload one photo or video to this saved MonthlyUpdate. JPEG,
                PNG, WebP, MP4 or WebM; maximum 20 MB per file. Private access
                requires authorization.
            </p>
            <form
                onSubmit={(event) => {
                    event.preventDefault();

                    if (!enabled || !form.data.file || form.processing) {
                        return;
                    }

                    form.post(
                        `/dd-phase3/ui/monthly-updates/${updateId}/media`,
                        {
                            forceFormData: true,
                            preserveScroll: true,
                            onSuccess: () => {
                                form.reset();

                                if (input.current) {
                                    input.current.value = '';
                                }
                            },
                        },
                    );
                }}
                className="mt-3 flex flex-wrap items-center gap-3"
            >
                <input
                    ref={input}
                    type="file"
                    aria-label="Private media file"
                    disabled={!enabled || form.processing}
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                    onChange={(event) => {
                        form.clearErrors();
                        form.setData('file', event.target.files?.[0] ?? null);
                    }}
                />
                <button
                    className="jr-primary rounded-lg px-4 py-2 text-white disabled:opacity-50"
                    disabled={!enabled || !form.data.file || form.processing}
                >
                    Upload Media
                </button>
                {form.errors.file && (
                    <p role="alert" className="text-sm text-red-700">
                        {form.errors.file}
                    </p>
                )}
            </form>
            {!enabled && (
                <p className="jr-field-hint">
                    Uploads require current record permissions and configured
                    private Storage.
                </p>
            )}
        </section>
    );
}
