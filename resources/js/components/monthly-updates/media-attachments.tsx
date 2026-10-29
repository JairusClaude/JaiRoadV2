import * as Dialog from '@radix-ui/react-dialog';
import { Eye, FileVideo, ImageOff, UploadCloud, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { monthlyMediaAccept, monthlyMediaTypes } from '@/lib/monthly-updates';
import type { MonthlyMedia } from '@/types/monthly-updates';

type Attachment = File | MonthlyMedia;
const fileName = (file: Attachment) =>
    file instanceof File ? file.name : file.file_name;
const fileType = (file: Attachment) =>
    file instanceof File ? file.type : (file.mime_type ?? '');
const fileSize = (file: Attachment) => file.size ?? 0;
function LocalMedia({
    file,
    thumbnail = false,
}: {
    file: Attachment;
    thumbnail?: boolean;
}) {
    const image = useRef<HTMLImageElement>(null);
    const video = useRef<HTMLVideoElement>(null);
    const isVideo = fileType(file).startsWith('video/');
    useEffect(() => {
        if (!(file instanceof File) && !file.available) {
            return;
        }

        if (thumbnail && isVideo) {
            return;
        }

        const element = image.current ?? video.current;
        const url =
            file instanceof File
                ? URL.createObjectURL(file)
                : (file.preview_url ?? '');
        element?.setAttribute('src', url);

        return () => {
            if (element instanceof HTMLVideoElement) {
                element.pause();
            }

            element?.removeAttribute('src');

            if (element instanceof HTMLVideoElement) {
                element.load();
            }

            if (file instanceof File) {
                URL.revokeObjectURL(url);
            }
        };
    }, [file, thumbnail, isVideo]);

    if (!(file instanceof File) && !file.available) {
        return <ImageOff className="size-5" aria-hidden="true" />;
    }

    if (thumbnail && isVideo) {
        return <FileVideo className="size-5" aria-hidden="true" />;
    }

    return isVideo ? (
        <video
            ref={video}
            controls
            preload="metadata"
            aria-label={`Preview ${fileName(file)}`}
        />
    ) : (
        <img ref={image} alt={thumbnail ? '' : `Preview ${fileName(file)}`} />
    );
}
const metadata = (file: Attachment) =>
    !(file instanceof File) && !file.available
        ? 'File unavailable in this preview session.'
        : `${fileType(file).split('/')[1]?.toUpperCase() ?? 'File'} · ${fileSize(file) >= 1024 * 1024 ? `${(fileSize(file) / (1024 * 1024)).toFixed(1)} MB` : `${(fileSize(file) / 1024).toFixed(1)} KB`}`;

export function MediaAttachments({
    files,
    existing = [],
    onRemoveExisting,
    disabled,
    error,
    onChange,
}: {
    files: File[];
    existing?: MonthlyMedia[];
    onRemoveExisting?: (id: number) => void;
    disabled: boolean;
    error?: string;
    onChange: (files: File[]) => void;
}) {
    const picker = useRef<HTMLInputElement>(null);
    const opener = useRef<HTMLButtonElement | null>(null);
    const close = useRef<HTMLButtonElement>(null);
    const [preview, setPreview] = useState<Attachment | null>(null);
    const [rejected, setRejected] = useState('');
    const [dragging, setDragging] = useState(false);
    const selectedTitle = useId();
    const selected: Attachment[] = [...existing, ...files];
    const add = (incoming: File[]) => {
        if (disabled) {
            return;
        }

        const accepted = incoming.filter((file) =>
            monthlyMediaTypes.includes(file.type),
        );
        const invalid = incoming.filter(
            (file) => !monthlyMediaTypes.includes(file.type),
        );
        setRejected(
            invalid.length
                ? `Not added: ${invalid.map((file) => fileName(file)).join(', ')}. Use JPEG, PNG, WebP, MP4, or WebM.`
                : '',
        );

        if (accepted.length) {
            onChange([...files, ...accepted]);
        }
    };

    return (
        <>
            <div
                className="jr-monthly-drop"
                data-dragging={dragging}
                onDragOver={(event) => {
                    event.preventDefault();

                    if (!disabled) {
                        setDragging(true);
                    }
                }}
                onDragLeave={(event) => {
                    if (
                        !event.currentTarget.contains(
                            event.relatedTarget as Node,
                        )
                    ) {
                        setDragging(false);
                    }
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    add(Array.from(event.dataTransfer.files));
                }}
            >
                <UploadCloud className="size-6" aria-hidden="true" />
                <strong>Drag and drop photos or videos</strong>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => picker.current?.click()}
                >
                    Browse Files
                </Button>
                <p className="jr-field-hint">
                    JPEG, PNG, WebP, MP4, WebM · Optional
                </p>
                <input
                    ref={picker}
                    id="attachments"
                    aria-label="Attach photos and videos"
                    aria-describedby={
                        rejected || error ? 'attachments-error' : undefined
                    }
                    className="sr-only"
                    type="file"
                    tabIndex={-1}
                    multiple
                    accept={monthlyMediaAccept}
                    disabled={disabled}
                    onChange={(event) => {
                        add(Array.from(event.target.files ?? []));
                        event.target.value = '';
                    }}
                />
            </div>
            {(rejected || error) && (
                <p
                    id="attachments-error"
                    className="jr-field-error"
                    role="alert"
                >
                    {[rejected, error].filter(Boolean).join(' ')}
                </p>
            )}
            {!!selected.length && (
                <section
                    className="jr-monthly-selected"
                    aria-labelledby={selectedTitle}
                >
                    <h3 id={selectedTitle}>
                        Selected Files{' '}
                        <span className="jr-muted">({selected.length})</span>
                    </h3>
                    <ul
                        className="jr-monthly-files"
                        aria-label="Selected attachments"
                    >
                        {selected.map((file, index) => (
                            <li
                                key={
                                    file instanceof File
                                        ? `${file.name}-${file.lastModified}-${index}`
                                        : `saved-${file.id}`
                                }
                            >
                                <button
                                    type="button"
                                    className="jr-monthly-file-open"
                                    disabled={
                                        disabled ||
                                        (!(file instanceof File) &&
                                            !file.available)
                                    }
                                    aria-label={`Open preview ${fileName(file)}`}
                                    aria-haspopup="dialog"
                                    onClick={(event) => {
                                        opener.current = event.currentTarget;
                                        setPreview(file);
                                    }}
                                >
                                    <span className="jr-monthly-file-thumb">
                                        <LocalMedia file={file} thumbnail />
                                    </span>
                                    <span className="jr-monthly-file-name">
                                        <strong title={fileName(file)}>
                                            {fileName(file)}
                                        </strong>
                                        <small>{metadata(file)}</small>
                                    </span>
                                    <Eye
                                        className="jr-monthly-file-eye size-4"
                                        aria-hidden="true"
                                    />
                                </button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled={disabled}
                                    aria-label={`Remove ${fileName(file)}`}
                                    onClick={() =>
                                        file instanceof File
                                            ? onChange(
                                                  files.filter(
                                                      (_, item) =>
                                                          item !==
                                                          index -
                                                              existing.length,
                                                  ),
                                              )
                                            : onRemoveExisting?.(file.id)
                                    }
                                >
                                    <X className="size-4" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            <p className="jr-field-hint mt-3">
                Local preview only. Saved updates and file bytes remain until
                this preview server restarts; they are not uploaded to Supabase.
            </p>
            <Dialog.Root
                open={preview !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPreview(null);
                    }
                }}
            >
                <Dialog.Portal>
                    <Dialog.Overlay className="jr-delete-overlay" />
                    <Dialog.Content
                        className="jr-app jr-theme jr-monthly-viewer"
                        onOpenAutoFocus={(event) => {
                            event.preventDefault();
                            close.current?.focus();
                        }}
                        onCloseAutoFocus={(event) => {
                            event.preventDefault();
                            opener.current?.focus();
                        }}
                    >
                        <header>
                            <div>
                                <Dialog.Title
                                    title={
                                        preview ? fileName(preview) : undefined
                                    }
                                >
                                    {preview ? fileName(preview) : undefined}
                                </Dialog.Title>
                                <Dialog.Description>
                                    {preview ? metadata(preview) : ''} · Local
                                    file preview
                                </Dialog.Description>
                            </div>
                            <Dialog.Close asChild>
                                <Button
                                    ref={close}
                                    type="button"
                                    variant="outline"
                                    aria-label="Close file preview"
                                >
                                    <X className="size-4" /> Close
                                </Button>
                            </Dialog.Close>
                        </header>
                        {preview && <LocalMedia file={preview} />}
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    );
}
