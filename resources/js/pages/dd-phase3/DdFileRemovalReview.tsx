import { useState } from 'react';

export default function DdFileRemovalReview({
    kind,
    files,
}: {
    kind: 'document' | 'media';
    files: { id: number; file_name: string }[];
}) {
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    async function review(id: string) {
        setMessage('');

        if (!id) {
            return;
        }

        setBusy(true);

        try {
            const response = await fetch(
                `/dd-phase3/files/${kind}/${id}/deletion-review`,
                {
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin',
                    cache: 'no-store',
                },
            );

            if (!response.ok) {
                throw new Error();
            }

            const data = (await response.json()) as { message: string };
            setMessage(data.message);
        } catch {
            setMessage(
                'This file cannot be reviewed. Check your authorization and its parent record.',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <section
            aria-label={`${kind} removal preparation`}
            className="mb-5 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
            <h2 className="font-semibold">
                File removal — policy approval required
            </h2>
            <p className="text-sm">
                Deletion is disabled. The team must decide whether to retain the
                private file when removing its database record, or approve
                permanent object deletion and recovery handling.
            </p>
            <label className="block text-sm">
                Review {kind}
                <select
                    disabled={busy}
                    defaultValue=""
                    className="mt-1 block max-w-full rounded border p-2"
                    onChange={(e) => void review(e.target.value)}
                >
                    <option value="">Select file</option>
                    {files.map((f) => (
                        <option key={f.id} value={f.id}>
                            {f.file_name}
                        </option>
                    ))}
                </select>
            </label>
            {message && (
                <p role="status" className="text-sm">
                    {message}
                </p>
            )}
            <button
                type="button"
                disabled
                className="rounded border px-3 py-2 opacity-60"
            >
                Delete unavailable pending retention policy
            </button>
        </section>
    );
}
