import * as Dialog from '@radix-ui/react-dialog';
import { CirclePlay, ImageOff, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MonthlyMedia } from '@/types/monthly-updates';

// A failed frame extraction affects only the thumbnail, never the video viewer.
function VideoThumbnail({ file }: { file: MonthlyMedia }) {
    const [frame, setFrame] = useState<{ url: string; image: string } | null>(
        null,
    );
    const url = file.preview_url!;
    useEffect(() => {
        const video = document.createElement('video');
        let disposed = false;
        let target = 0;
        const release = () => {
            disposed = true;
            window.clearTimeout(timeout);
            video.onloadedmetadata = null;
            video.onloadeddata = null;
            video.onseeked = null;
            video.onerror = null;
            video.pause();
            video.removeAttribute('src');
            video.load();
        };
        const capture = () => {
            if (disposed || video.readyState < 2 || !video.videoWidth) {
                return;
            }

            try {
                const canvas = document.createElement('canvas');
                canvas.width = Math.min(640, video.videoWidth);
                canvas.height = Math.max(
                    1,
                    Math.round(
                        (canvas.width * video.videoHeight) / video.videoWidth,
                    ),
                );
                const context = canvas.getContext('2d');

                if (context) {
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    setFrame({
                        url,
                        image: canvas.toDataURL('image/jpeg', 0.8),
                    });
                }
            } catch {
                // Unsupported codecs or cross-origin canvas restrictions use
                // the neutral placeholder and retain the original preview URL.
            }

            release();
        };
        const timeout = window.setTimeout(release, 10000);
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.onloadedmetadata = () => {
            target = Number.isFinite(video.duration)
                ? Math.min(0.1, video.duration / 2)
                : 0;

            if (target > 0) {
                try {
                    video.currentTime = target;
                } catch {
                    release();
                }
            } else {
                capture();
            }
        };
        video.onloadeddata = () => {
            if (target === 0) {
                capture();
            }
        };
        video.onseeked = capture;
        video.onerror = release;
        video.src = url;

        return release;
    }, [url]);

    const image = frame?.url === url ? frame.image : null;

    return (
        <>
            {image && <img src={image} alt="" />}
            <span
                className="jr-monthly-video-play"
                data-has-frame={Boolean(image)}
                aria-hidden="true"
            >
                <CirclePlay />
                <span className="sr-only">Video · Open player</span>
            </span>
        </>
    );
}

function GalleryVideo({
    file,
    onError,
}: {
    file: MonthlyMedia;
    onError: () => void;
}) {
    const video = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        const element = video.current;

        return () => {
            element?.pause();
            element?.removeAttribute('src');
            element?.load();
        };
    }, []);

    return (
        <video
            ref={video}
            src={file.preview_url!}
            controls
            preload="metadata"
            aria-label={`Preview ${file.file_name}`}
            onError={onError}
        />
    );
}

// Uses the same Radix viewer conventions and styles as the approved Add uploader.
// URLs point to its existing process-local media endpoint; no second byte store.
export function MediaGallery({ media }: { media: MonthlyMedia[] }) {
    const [preview, setPreview] = useState<MonthlyMedia | null>(null);
    const [failed, setFailed] = useState<Set<number>>(new Set());
    const opener = useRef<HTMLButtonElement | null>(null);
    const close = useRef<HTMLButtonElement>(null);
    const fail = (id: number) => setFailed((old) => new Set([...old, id]));

    if (!media.length) {
        return (
            <div className="jr-related-empty">
                No media attachments for this monthly update.
            </div>
        );
    }

    return (
        <>
            <TooltipProvider delayDuration={400}>
                <ul
                    className="jr-monthly-gallery"
                    aria-label="Monthly update attachments"
                >
                    {media.map((file) => {
                        const available =
                            file.available &&
                            !!file.preview_url &&
                            !failed.has(file.id);
                        const video = file.mime_type?.startsWith('video/');
                        const contents = (
                            <>
                                <span className="jr-monthly-gallery-thumbnail">
                                    {!available ? (
                                        <ImageOff aria-hidden="true" />
                                    ) : video ? (
                                        <VideoThumbnail file={file} />
                                    ) : (
                                        <img
                                            src={file.preview_url!}
                                            alt=""
                                            onError={() => fail(file.id)}
                                            loading="lazy"
                                        />
                                    )}
                                </span>
                                <span className="jr-monthly-gallery-caption">
                                    <strong title={file.file_name}>
                                        {file.file_name}
                                    </strong>
                                    <small>
                                        {available
                                            ? `${video ? 'Video' : 'Image'}${file.size !== null ? ` · ${(file.size / 1024).toFixed(1)} KB` : ''}`
                                            : 'File unavailable in this preview session.'}
                                    </small>
                                </span>
                            </>
                        );

                        return (
                            <li key={file.id} data-media-id={file.id}>
                                {available ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                aria-label={`Open preview ${file.file_name}`}
                                                aria-haspopup="dialog"
                                                onClick={(event) => {
                                                    opener.current =
                                                        event.currentTarget;
                                                    setPreview(file);
                                                }}
                                            >
                                                {contents}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs break-words">
                                            {file.file_name}
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                    <div className="jr-monthly-gallery-unavailable">
                                        {contents}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </TooltipProvider>
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
                                <Dialog.Title title={preview?.file_name}>
                                    {preview?.file_name}
                                </Dialog.Title>
                                <Dialog.Description>
                                    Monthly update attachment · Local preview
                                    session
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
                        {preview &&
                            (failed.has(preview.id) ? (
                                <p role="status">
                                    File unavailable in this preview session.
                                </p>
                            ) : preview.mime_type?.startsWith('video/') ? (
                                <GalleryVideo
                                    key={preview.id}
                                    file={preview}
                                    onError={() => fail(preview.id)}
                                />
                            ) : (
                                <img
                                    src={preview.preview_url!}
                                    alt={`Preview ${preview.file_name}`}
                                    onError={() => fail(preview.id)}
                                />
                            ))}
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    );
}
