import { usePage } from '@inertiajs/react';
import * as Dialog from '@radix-ui/react-dialog';
import {
    CircleAlert,
    Check,
    LockKeyhole,
    ShieldCheck,
    Trash2,
    TriangleAlert,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useMobileDialogViewport } from '@/hooks/use-mobile-dialog-viewport';
import type { DependentCounts } from '@/types/maintenance-projects';
import '../../../css/jairoads-deletion-dialog.css';

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

export type DeleteConfirmation = {
    confirmation: string;
    captcha_token: string;
    captcha_answer: string;
};

export function DeletionDialog({
    open,
    title,
    description,
    children,
    processing,
    error,
    confirmLabel,
    confirmDisabled = false,
    blocked = false,
    reviewing = false,
    selectionLabel = 'Selected items',
    busyLabel = 'Deleting…',
    irreversible = true,
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
    blocked?: boolean;
    reviewing?: boolean;
    selectionLabel?: string;
    busyLabel?: string;
    irreversible?: boolean;
    requireYes?: boolean;
    challengeScope?: 'project' | 'record';
    onClose: () => void;
    onConfirm: (confirmation?: DeleteConfirmation) => void;
    returnFocus?: RefObject<HTMLElement | null>;
}) {
    const viewport = useMobileDialogViewport();
    const cancelRef = useRef<HTMLButtonElement>(null);
    const opener = useRef<HTMLElement | null>(null);
    const [confirmation, setConfirmation] = useState('');
    const confirmationId = useId();
    const preview = usePage().props.previewOnly === true;
    const needsChallenge = !!challengeScope && !preview;
    const [challenge, setChallenge] = useState<{
        question: string;
        token: string;
    } | null>(null);
    const [answer, setAnswer] = useState('');
    const [challengeError, setChallengeError] = useState('');
    const [revision, setRevision] = useState(0);
    const resetVerification = () => {
        setConfirmation('');
        setChallenge(null);
        setAnswer('');
        setChallengeError('');
    };
    const closeDialog = () => {
        resetVerification();
        onClose();
    };
    useEffect(() => {
        if (!open || !needsChallenge || blocked) {
            return;
        }

        const controller = new AbortController();
        fetch(`/workspace/ui/deletion-challenge?scope=${challengeScope}`, {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('Verification unavailable.');
                }

                const data = await response.json();

                if (!controller.signal.aborted) {
                    setChallenge(data);
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setChallengeError(
                        'Verification unavailable. Request a new challenge.',
                    );
                }
            });

        return () => controller.abort();
    }, [open, title, needsChallenge, challengeScope, revision, blocked]);
    const yesReady = !requireYes || confirmation.trim().toUpperCase() === 'YES';
    // The equation is already public. This is immediate form feedback only;
    // the server still validates the signed challenge, expiry and single use.
    const operands = challenge?.question.match(/^(\d+)\s*\+\s*(\d+)$/);
    const answerReady =
        !needsChallenge ||
        (!!challenge &&
            /^\d{1,3}$/.test(answer) &&
            (!operands ||
                Number(answer) === Number(operands[1]) + Number(operands[2])));
    const confirmed = yesReady && answerReady;
    const footerHint = processing
        ? 'Deleting… please keep this window open.'
        : blocked
          ? 'Protected records'
          : reviewing
            ? 'Checking affected data…'
            : confirmDisabled
              ? 'Deletion is not available yet.'
              : !yesReady
                ? 'Type YES to continue.'
                : !answerReady
                  ? challenge
                      ? 'Enter the correct answer to continue.'
                      : 'Waiting for verification…'
                  : 'Ready to delete. Review the selected data.';

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(value) => {
                if (!value && !processing) {
                    closeDialog();
                }
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="jr-delete-overlay" />
                <Dialog.Content
                    className="jr-app jr-theme jr-delete-dialog jr-delete-premium"
                    data-mobile-layout="sheet"
                    ref={viewport}
                    data-blocked={blocked}
                    aria-busy={processing}
                    onOpenAutoFocus={(event) => {
                        opener.current =
                            document.activeElement instanceof HTMLElement
                                ? document.activeElement
                                : null;
                        event.preventDefault();
                        cancelRef.current?.focus();
                    }}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        const target = returnFocus?.current?.isConnected
                            ? returnFocus.current
                            : opener.current;

                        if (target?.isConnected && target !== document.body) {
                            target.focus();
                        } else {
                            const heading =
                                document.querySelector<HTMLElement>(
                                    'main h1, h1',
                                );
                            heading?.setAttribute('tabindex', '-1');
                            heading?.focus();
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
                        <span
                            className="jr-delete-warning-icon"
                            aria-hidden="true"
                        >
                            {blocked ? (
                                <LockKeyhole size={24} />
                            ) : (
                                <TriangleAlert size={24} />
                            )}
                        </span>
                        <div className="jr-delete-heading-copy">
                            <span className="jr-delete-eyebrow">
                                {blocked
                                    ? 'Deletion blocked'
                                    : irreversible
                                      ? 'Permanent action'
                                      : 'Confirm action'}
                            </span>
                            <Dialog.Title>{title}</Dialog.Title>
                            <Dialog.Description>
                                {description}
                                {irreversible &&
                                    !blocked &&
                                    !/cannot be undone|irreversible|permanent/i.test(
                                        description,
                                    ) &&
                                    ' This action cannot be undone.'}
                            </Dialog.Description>
                        </div>
                    </div>
                    <div className="jr-delete-body">
                        <section
                            className="jr-delete-selection"
                            aria-label={selectionLabel}
                        >
                            <div className="jr-delete-section-label">
                                {selectionLabel}
                            </div>
                            {children}
                        </section>
                        {blocked && (
                            <div className="jr-delete-notice" role="status">
                                <LockKeyhole size={17} aria-hidden="true" />
                                <span>
                                    Deletion is unavailable until the blocking
                                    conditions are resolved.
                                </span>
                            </div>
                        )}
                        {reviewing && (
                            <p className="jr-delete-progress" role="status">
                                <Spinner /> Reviewing deletion eligibility…
                            </p>
                        )}
                        {requireYes && !blocked && (
                            <div
                                className="jr-delete-verification"
                                data-complete={yesReady}
                            >
                                <label
                                    htmlFor={confirmationId}
                                    className="jr-delete-verification-label"
                                >
                                    <span
                                        className="jr-delete-step"
                                        aria-hidden="true"
                                    >
                                        {yesReady ? <Check size={14} /> : 1}
                                    </span>{' '}
                                    Type YES to confirm permanent deletion{' '}
                                    <span className="jr-required">
                                        * Required
                                    </span>
                                </label>
                                <input
                                    id={confirmationId}
                                    type="text"
                                    autoComplete="off"
                                    autoCapitalize="characters"
                                    spellCheck={false}
                                    maxLength={12}
                                    value={confirmation}
                                    onChange={(event) =>
                                        setConfirmation(event.target.value)
                                    }
                                    placeholder="Type YES"
                                    disabled={processing}
                                    required
                                    aria-required="true"
                                    className="jr-delete-input"
                                />
                            </div>
                        )}
                        {needsChallenge && !blocked && (
                            <div
                                className="jr-delete-verification"
                                data-complete={answerReady}
                            >
                                <label
                                    htmlFor={confirmationId + '-captcha'}
                                    className="jr-delete-verification-label"
                                >
                                    <span
                                        className="jr-delete-step"
                                        aria-hidden="true"
                                    >
                                        {answerReady ? <Check size={14} /> : 2}
                                    </span>{' '}
                                    Solve the verification challenge{' '}
                                    <span className="jr-required">*</span>
                                </label>
                                <div className="jr-delete-challenge-row">
                                    <div
                                        className="jr-delete-equation"
                                        aria-live="polite"
                                    >
                                        {challenge
                                            ? challenge.question + ' = ?'
                                            : 'Loading verification…'}
                                    </div>
                                    <input
                                        id={confirmationId + '-captcha'}
                                        inputMode="numeric"
                                        autoComplete="off"
                                        value={answer}
                                        onChange={(event) =>
                                            setAnswer(
                                                event.target.value
                                                    .replace(/[^0-9]/g, '')
                                                    .slice(0, 3),
                                            )
                                        }
                                        placeholder="Enter answer"
                                        maxLength={3}
                                        aria-describedby={
                                            confirmationId + '-answer-hint'
                                        }
                                        disabled={processing || !challenge}
                                        className="jr-delete-input"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={processing}
                                        onClick={() => {
                                            setChallenge(null);
                                            setAnswer('');
                                            setChallengeError('');
                                            setRevision((value) => value + 1);
                                        }}
                                    >
                                        New challenge
                                    </Button>
                                </div>
                                <p
                                    id={confirmationId + '-answer-hint'}
                                    className="jr-delete-field-hint"
                                >
                                    {answerReady
                                        ? 'Answer correct.'
                                        : answer
                                          ? 'Check your answer.'
                                          : 'Enter the sum shown above.'}
                                </p>
                                {challengeError && (
                                    <p role="alert" className="jr-field-error">
                                        {challengeError}
                                    </p>
                                )}
                            </div>
                        )}
                        {error && (
                            <div className="jr-delete-error" role="alert">
                                <CircleAlert size={18} aria-hidden="true" />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>
                    <div className="jr-dialog-actions">
                        <span
                            className="jr-delete-footer-hint"
                            role="status"
                            aria-live="polite"
                            data-ready={
                                confirmed &&
                                !processing &&
                                !blocked &&
                                !reviewing &&
                                !confirmDisabled
                            }
                        >
                            {blocked ? (
                                <LockKeyhole size={15} />
                            ) : (
                                <ShieldCheck size={15} />
                            )}{' '}
                            {footerHint}
                        </span>
                        <Button
                            ref={cancelRef}
                            type="button"
                            variant="outline"
                            className="jr-delete-cancel"
                            disabled={processing}
                            onClick={closeDialog}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            className="jr-danger jr-delete-confirm"
                            variant="destructive"
                            disabled={
                                processing ||
                                blocked ||
                                reviewing ||
                                confirmDisabled ||
                                !confirmed
                            }
                            onClick={() => {
                                if (
                                    confirmed &&
                                    !blocked &&
                                    !reviewing &&
                                    !confirmDisabled &&
                                    !processing
                                ) {
                                    onConfirm(
                                        needsChallenge && challenge
                                            ? {
                                                  confirmation: 'YES',
                                                  captcha_token:
                                                      challenge.token,
                                                  captcha_answer: answer,
                                              }
                                            : undefined,
                                    );

                                    if (needsChallenge) {
                                        setChallenge(null);
                                        setAnswer('');
                                        setChallengeError('');
                                        setRevision((value) => value + 1);
                                    }
                                }
                            }}
                        >
                            {processing ? (
                                <>
                                    <Spinner /> {busyLabel}
                                </>
                            ) : (
                                <>
                                    <Trash2 size={16} aria-hidden="true" />{' '}
                                    {confirmLabel}
                                </>
                            )}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
