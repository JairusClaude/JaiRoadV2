import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { documentExtension } from '@/lib/maintenance-documents';
import type { DocumentSummary } from '@/types/maintenance-documents';
export function DocumentViewer({
    document: doc,
    open,
    onOpenChange,
    returnFocus,
}: {
    document: DocumentSummary;
    open: boolean;
    returnFocus: RefObject<HTMLElement | null>;
    onOpenChange: (open: boolean) => void;
}) {
    const [state, setState] = useState('loading');
    const [url, setUrl] = useState('');
    const pdf = documentExtension(doc.file_name) === 'pdf';
    const pdfSupported =
        typeof navigator !== 'undefined' && navigator.pdfViewerEnabled;
    useEffect(() => {
        if (!open || !pdf || !pdfSupported) {
            return;
        }

        const abort = new AbortController();
        let objectUrl = '';
        fetch(`/preview-documents/${doc.id}`, { signal: abort.signal })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('unavailable');
                }

                const blob = await response.blob();

                if (abort.signal.aborted) {
                    return;
                }

                objectUrl = URL.createObjectURL(blob);
                setUrl(objectUrl);
                setState('ready');
            })
            .catch(() => {
                if (!abort.signal.aborted) {
                    setState('error');
                }
            });

        return () => {
            abort.abort();

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [open, pdf, pdfSupported, doc.id]);

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (next) {
                    setState('loading');
                    setUrl('');
                }

                onOpenChange(next);
            }}
        >
            <DialogContent
                className="jr-theme jr-document-viewer"
                onCloseAutoFocus={(event) => {
                    if (returnFocus.current?.isConnected) {
                        event.preventDefault();
                        returnFocus.current.focus();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle>{doc.file_name}</DialogTitle>
                    <DialogDescription>
                        {pdf && !pdfSupported
                            ? 'This browser does not provide a built-in PDF viewer. Download the original document to open it in a PDF reader.'
                            : pdf
                              ? 'PDF preview. Use Download to open the original in your preferred reader if your browser cannot display it.'
                              : 'In-browser preview is unavailable for this Office format. Download the original to open it in a compatible application.'}
                    </DialogDescription>
                </DialogHeader>
                {pdf &&
                    pdfSupported &&
                    (state === 'loading' ? (
                        <p role="status">Loading document…</p>
                    ) : state === 'error' ? (
                        <p role="alert">
                            This file is unavailable. It may have been deleted
                            or reset with the preview.
                        </p>
                    ) : (
                        <iframe
                            src={url}
                            title={`Preview of ${doc.file_name}`}
                            className="jr-document-pdf"
                        />
                    ))}
                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Close
                    </Button>
                    <Button className="jr-primary" asChild>
                        <a
                            href={`/preview-documents/${doc.id}?download`}
                            download={doc.file_name}
                        >
                            Download
                        </a>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
