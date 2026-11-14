import { usePage } from '@inertiajs/react';
import {
    FileSpreadsheet,
    FileText,
    Presentation,
    Upload,
    X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    documentAccept,
    documentExtension,
    documentFileError,
    documentType,
} from '@/lib/maintenance-documents';

export function DocumentIcon({ name }: { name: string }) {
    const Icon =
        (
            { xlsx: FileSpreadsheet, pptx: Presentation } as Record<
                string,
                typeof FileText
            >
        )[documentExtension(name)] ?? FileText;

    return (
        <Icon
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
        />
    );
}
export function DocumentAttachment({
    file,
    savedName,
    disabled,
    error,
    onChange,
}: {
    file: File | null;
    savedName?: string;
    disabled: boolean;
    error?: string;
    onChange: (file: File | null) => void;
}) {
    const canonical = usePage().props.canonicalFrontend === true;
    const input = useRef<HTMLInputElement>(null);
    const [feedback, setFeedback] = useState('');
    const [dragging, setDragging] = useState(false);
    const accept = (files: File[]) => {
        if (disabled) {
            return;
        }

        const problem =
            files.length !== 1
                ? 'Choose one document file at a time.'
                : documentFileError(files[0]);
        setFeedback(problem);

        if (!problem) {
            onChange(files[0]);
        }
    };

    return (
        <div>
            <input
                ref={input}
                className="sr-only"
                tabIndex={-1}
                type="file"
                accept={documentAccept}
                disabled={disabled}
                aria-label="Choose document file"
                onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);

                    if (files.length) {
                        accept(files);
                    }

                    e.target.value = '';
                }}
            />
            <div
                className="jr-upload-zone jr-document-drop"
                data-dragging={dragging}
                onDragOver={(e) => {
                    e.preventDefault();

                    if (!disabled) {
                        setDragging(true);
                    }
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    accept(Array.from(e.dataTransfer.files));
                }}
            >
                <Upload className="size-6" aria-hidden="true" />
                <p>Drag and drop your document here</p>
                <Button
                    type="button"
                    variant="outline"
                    id="attachment"
                    aria-invalid={Boolean(feedback || error)}
                    aria-describedby={
                        feedback || error ? 'attachment-error' : undefined
                    }
                    disabled={disabled}
                    onClick={() => input.current?.click()}
                >
                    Browse Files
                </Button>
                <p className="jr-field-hint">
                    One file · PDF, DOCX, XLSX, PPTX
                </p>
            </div>
            <p className="jr-field-hint mt-2">
                {canonical
                    ? 'Maximum 20 MB per file. Downloads require current authorization.'
                    : 'Local preview: requests up to 64 MiB including form data. Files are retained only until the preview restarts.'}
            </p>
            {(feedback || error) && (
                <p
                    id="attachment-error"
                    className="jr-field-error"
                    role="alert"
                >
                    {feedback || error}
                </p>
            )}
            {(file || savedName) && (
                <div className="jr-document-file-row mt-3">
                    <DocumentIcon name={file?.name ?? savedName!} />
                    <div className="min-w-0 flex-1">
                        <strong
                            className="block truncate"
                            title={file?.name ?? savedName}
                        >
                            {file?.name ?? savedName}
                        </strong>
                        <p className="jr-field-hint">
                            {documentType(file?.name ?? savedName!)}
                            {file
                                ? ` · ${(file.size / 1024).toFixed(1)} KB · Selected file`
                                : ' · Existing attachment retained'}
                        </p>
                    </div>
                    {file && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={disabled}
                            aria-label={`Remove ${file.name}`}
                            onClick={() => {
                                onChange(null);
                                setFeedback('');
                            }}
                        >
                            <X />
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
