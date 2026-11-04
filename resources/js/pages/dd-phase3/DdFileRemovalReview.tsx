import { router } from '@inertiajs/react';
import { useState } from 'react';
import {
    PermanentFileDeletionDialog,
    usePermanentFileDeletion,
} from '@/components/files/permanent-file-deletion';
import { Button } from '@/components/ui/button';

export default function DdFileRemovalReview({
    kind,
    files,
}: {
    kind: 'document' | 'media';
    files: { id: number; file_name: string }[];
}) {
    const [selected, setSelected] = useState('');
    const deletion = usePermanentFileDeletion(() => {
        setSelected('');
        router.reload();
    });
    const file = files.find((item) => String(item.id) === selected);

    return (
        <section
            aria-label={`${kind} removal review`}
            className="mb-5 space-y-3 rounded-xl border p-4"
        >
            <h2 className="font-semibold">Individual file deletion</h2>
            <p className="text-sm">
                Permanent deletion removes only the selected file and its
                private Storage object. Review and confirm before deleting.
            </p>
            <label className="block text-sm">
                Selected file
                <select
                    value={selected}
                    disabled={deletion.processing}
                    className="mt-1 block max-w-full rounded border p-2"
                    onChange={(event) => setSelected(event.target.value)}
                >
                    <option value="">Select file</option>
                    {files.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.file_name}
                        </option>
                    ))}
                </select>
            </label>
            <Button
                type="button"
                variant="destructive"
                disabled={!file || deletion.processing}
                onClick={() =>
                    file &&
                    deletion.open({
                        id: file.id,
                        kind,
                        file_name: file.file_name,
                        parent_label: 'Maintenance activity',
                        delete_url: `/dd-phase3/files/${kind}/${file.id}`,
                    })
                }
            >
                Delete selected file
            </Button>
            <PermanentFileDeletionDialog deletion={deletion} />
        </section>
    );
}
