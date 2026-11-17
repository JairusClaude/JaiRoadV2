import { KeyRound, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DeletionDialog } from '@/components/maintenance-projects/deletion-dialog';
import type { Passkey } from '@/types/auth';

type Props = {
    passkey: Passkey;
    onDelete: (id: number, onError: () => void) => void;
};

export default function PasskeyItem({ passkey, onDelete }: Props) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState('');
    const opener = useRef<HTMLButtonElement>(null);

    const handleDelete = () => {
        if (isDeleting) return;
        setIsDeleting(true);
        setError('');
        onDelete(passkey.id, () => { setIsDeleting(false); setError('Unable to remove this passkey. Please try again.'); });
    };

    return (
        <div className="flex items-center justify-between border-b p-4 last:border-b-0">
            <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <KeyRound className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <p className="font-medium tracking-tight">
                            {passkey.name}
                        </p>
                        {passkey.authenticator && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase ring-1 ring-border ring-inset">
                                {passkey.authenticator}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Added {passkey.created_at_diff}
                        {passkey.last_used_at_diff && (
                            <>
                                <span className="mx-1 text-muted-foreground/50">
                                    /
                                </span>
                                Last used {passkey.last_used_at_diff}
                            </>
                        )}
                    </p>
                </div>
            </div>

            <Button
                ref={opener}
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => { setError(''); setOpen(true); }}
            >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Remove</span>
            </Button>
            <DeletionDialog
                open={open}
                title="Remove passkey"
                description="You will no longer be able to use this passkey to sign in. Your other sign-in methods are not removed."
                selectionLabel="Selected passkey"
                irreversible={false}
                processing={isDeleting}
                busyLabel="Removing…"
                error={error}
                confirmLabel="Remove passkey"
                onClose={() => { if (!isDeleting) setOpen(false); }}
                onConfirm={handleDelete}
                returnFocus={opener}
            >
                <p className="jr-delete-target-title">{passkey.name}</p>
            </DeletionDialog>
        </div>
    );
}
