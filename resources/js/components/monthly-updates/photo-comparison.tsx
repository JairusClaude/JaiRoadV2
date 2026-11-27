import { useState } from 'react';
import type { MonthlyMedia } from '@/types/monthly-updates';

export function PhotoComparison({ media }: { media: MonthlyMedia[] }) {
    const [left, setLeft] = useState('');
    const [right, setRight] = useState('');
    const photos = media.filter(
        (file) =>
            file.available &&
            file.preview_url &&
            file.mime_type?.startsWith('image/'),
    );

    if (photos.length < 2) {
        return null;
    }

    const first = photos.find((file) => String(file.id) === left);
    const second = photos.find((file) => String(file.id) === right);

    return (
        <details className="mt-4 rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer font-semibold">
                Compare two photos
            </summary>
            <p className="mt-2 text-sm text-slate-600">
                Choose existing photos. Their chronological order is not
                verified by the system.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {[
                    { title: 'First photo', value: left, set: setLeft },
                    { title: 'Second photo', value: right, set: setRight },
                ].map(({ title, value, set }) => (
                    <label key={title} className="grid min-w-0 gap-2 text-sm">
                        {title}
                        <select
                            className="w-full rounded-lg border p-2"
                            value={value}
                            onChange={(event) => set(event.target.value)}
                        >
                            <option value="">Select a photo</option>
                            {photos.map((photo) => (
                                <option key={photo.id} value={photo.id}>
                                    {photo.file_name} (#{photo.id})
                                </option>
                            ))}
                        </select>
                    </label>
                ))}
            </div>
            {first && second && first.id !== second.id && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {[first, second].map((photo) => (
                        <figure key={photo.id} className="min-w-0">
                            <img
                                src={photo.preview_url ?? undefined}
                                alt={photo.file_name}
                                loading="lazy"
                                className="aspect-video w-full rounded-lg object-contain"
                            />
                            <figcaption className="mt-1 text-sm break-words">
                                {photo.file_name}
                            </figcaption>
                        </figure>
                    ))}
                </div>
            )}
            {first && second && first.id === second.id && (
                <p role="status" className="mt-3 text-sm">
                    Select two different photos to compare.
                </p>
            )}
        </details>
    );
}
