import * as Dialog from '@radix-ui/react-dialog';
import { usePage } from '@inertiajs/react';
import { useEffect, useId, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeletionCamera } from './deletion-camera';
import type { DependentCounts } from '@/types/maintenance-projects';

export function DeletionCounts({
    counts,
    includeRecords = true,
    preserve = false,
}: {
    counts?: DependentCounts;
    includeRecords?: boolean;
    preserve?: boolean;
}) {
    if (!counts) {
        return null;
    }

    const affected = [
        ...(includeRecords
            ? [
                  {
                      label: 'Maintenance records',
                      count: counts.maintenance_records,
                  },
              ]
            : []),
        { label: 'Monthly updates', count: counts.monthly_updates },
        { label: 'Media', count: counts.media },
        { label: 'Maintenance documents', count: counts.maintenance_documents },
    ].filter((item) => preserve || item.count > 0);

    if (affected.length === 0) {
        return (
            <p className="jr-delete-empty">No dependent maintenance data.</p>
        );
    }

    return (
        <dl
            className="jr-delete-counts"
            aria-label={
                preserve
                    ? 'Related data to preserve'
                    : 'Dependent data to delete'
            }
        >
            {affected.map(({ label, count }) => (
                <div key={label}>
                    <dt>{label}</dt>
                    <dd>{count}</dd>
                </div>
            ))}
        </dl>
    );
}

export type DeleteConfirmation = { confirmation: string; captcha_token: string; captcha_answer: string; camera_receipt: string };

export function DeletionDialog({
    open,
    title,
    description,
    children,
    processing,
    error,
    confirmLabel,
    confirmDisabled = false,
    requireYes = false,
    challengeScope,
    onClose,
    onConfirm,
    returnFocus,
}: {
    open: boolean;
    title: string;
    description: string;
    children: ReactNode;
    processing: boolean;
    error: string;
    confirmLabel: string;
    confirmDisabled?: boolean;
    requireYes?: boolean;
    challengeScope?: 'project' | 'record';
    onClose: () => void;
    onConfirm: (confirmation?: DeleteConfirmation) => void;
    returnFocus?: RefObject<HTMLElement | null>;
}) {
    const [confirmation, setConfirmation] = useState('');
    const confirmationId = useId();
    const preview = usePage().props.previewOnly === true;
    const needsChallenge = !!challengeScope && !preview;
    const [challenge, setChallenge] = useState<{ question: string; token: string } | null>(null);
    const [answer, setAnswer] = useState('');
    const [cameraReceipt, setCameraReceipt] = useState('');
    const [challengeError, setChallengeError] = useState('');
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        setConfirmation('');
    }, [open, title]);
    useEffect(() => {
        setChallenge(null);
        setAnswer('');
        setCameraReceipt('');
        setChallengeError('');
        if (!open || !needsChallenge) return;
        const controller = new AbortController();
        fetch(`/dd-phase3/ui/deletion-challenge?scope=${challengeScope}`, {
            headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal,
        }).then(async (response) => {
            if (!response.ok) throw new Error('Verification unavailable.');
            const data = await response.json();
            if (!controller.signal.aborted) setChallenge(data);
        }).catch(() => {
            if (!controller.signal.aborted) setChallengeError('Verification unavailable. Request a new challenge.');
        });
        return () => controller.abort();
    }, [open, title, needsChallenge, challengeScope, revision]);
    const confirmed = (!requireYes || confirmation === 'YES') && (!needsChallenge || (!!challenge && /^\d{1,3}$/.test(answer) && !!cameraReceipt));

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(value) => {
                if (!value) {
                    onClose();
                }
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="jr-delete-overlay" />
                <Dialog.Content
                    className="jr-app jr-theme jr-delete-dialog"
                    onCloseAutoFocus={(event) => {
                        if (returnFocus?.current?.isConnected) {
                            event.preventDefault();
                            returnFocus.current.focus();
                        }
                    }}
                    onEscapeKeyDown={(event) => {
                        if (processing) {
                            event.preventDefault();
                        }
                    }}
                    onPointerDownOutside={(event) => {
                        if (processing) {
                            event.preventDefault();
                        }
                    }}
                >
                    <div className="jr-delete-heading">
                        <span className="jr-delete-warning-icon" aria-hidden="true"><TriangleAlert size={22} /></span>
                        <div>
                            <Dialog.Title>{title}</Dialog.Title>
                            <Dialog.Description>{description}</Dialog.Description>
                        </div>
                    </div>
                    <div className="jr-delete-body">
                    {children}
                    {requireYes && (
                        <div className="mt-4 grid gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                            <label htmlFor={confirmationId} className="text-sm font-semibold text-red-800">Type YES to confirm permanent deletion <span className="jr-required">* Required</span></label>
                            <input id={confirmationId} type="text" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type YES" disabled={processing} required aria-required="true" className="w-full min-h-11 rounded-lg border-2 border-red-300 bg-white px-4 py-3 text-base text-slate-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-200" />
                        </div>
                    )}
                    {needsChallenge && (
                        <div className="mt-3 grid gap-2 rounded-xl border border-slate-300 p-3">
                            <label htmlFor={confirmationId + '-captcha'} className="text-sm font-semibold">Verification: solve the equation <span className="jr-required">*</span></label>
                            <div className="rounded-md bg-slate-100 p-3 text-lg font-semibold" aria-live="polite">{challenge ? challenge.question + ' = ?' : 'Loading verification…'}</div>
                            <input id={confirmationId + '-captcha'} inputMode="numeric" autoComplete="off" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Enter answer" disabled={processing || !challenge} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                            <Button type="button" variant="outline" disabled={processing} onClick={() => setRevision((value) => value + 1)}>New challenge</Button>
                            {challengeError && <p role="alert" className="jr-field-error">{challengeError}</p>}
                        </div>
                    )}
                    {open && needsChallenge && challenge && challengeScope && (
                        <DeletionCamera key={challenge.token} token={challenge.token} scope={challengeScope} disabled={processing} onReceipt={setCameraReceipt} />
                    )}
                    {error && (
                        <p className="jr-field-error" role="alert">
                            {error}
                        </p>
                    )}
                    </div>
                    <div className="jr-dialog-actions">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={processing}
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            className="jr-danger"
                            variant="destructive"
                            disabled={processing || confirmDisabled || !confirmed}
                            onClick={() => {
                                if (confirmed && !confirmDisabled && !processing) {
                                    onConfirm(needsChallenge && challenge ? { confirmation, captcha_token: challenge.token, captcha_answer: answer, camera_receipt: cameraReceipt } : undefined);
                                    if (needsChallenge) setRevision((value) => value + 1);
                                }
                            }}
                        >
                            {processing ? 'Deleting…' : confirmLabel}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
