import { Form } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { TriangleAlert, Trash2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import '../../css/jairoads-deletion-dialog.css';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function DeleteUser() {
    const passwordInput = useRef<HTMLInputElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const [busy, setBusy] = useState(false);

    return (
        <div className="space-y-6">
            <Heading
                variant="small"
                title="Delete account"
                description="Delete your account and all of its resources"
            />
            <div className="space-y-4 rounded-lg border border-red-100 bg-red-50 p-4 dark:border-red-200/10 dark:bg-red-700/10">
                <div className="relative space-y-0.5 text-red-600 dark:text-red-100">
                    <p className="font-medium">Warning</p>
                    <p className="text-sm">
                        Please proceed with caution, this cannot be undone.
                    </p>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button
                            variant="destructive"
                            data-test="delete-user-button"
                        >
                            Delete account
                        </Button>
                    </DialogTrigger>
                    <DialogContent
                        className="jr-delete-dialog jr-delete-premium jr-delete-account"
                        onOpenAutoFocus={event => { event.preventDefault(); cancelRef.current?.focus(); }}
                        onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}
                        onPointerDownOutside={event => { if (busy) event.preventDefault(); }}
                    >
                        <div className="jr-delete-heading">
                            <span className="jr-delete-warning-icon" aria-hidden="true"><TriangleAlert size={24} /></span>
                            <div className="jr-delete-heading-copy">
                                <span className="jr-delete-eyebrow">Permanent action</span>
                                <DialogTitle>Are you sure you want to delete your account?</DialogTitle>
                                <DialogDescription>Once your account is deleted, all of its resources and data will also be permanently deleted. Enter your password to confirm.</DialogDescription>
                            </div>
                        </div>

                        <Form
                            {...ProfileController.destroy.form()}
                            options={{
                                preserveScroll: true,
                            }}
                            onError={() => passwordInput.current?.focus()}
                            onStart={() => setBusy(true)}
                            onFinish={() => setBusy(false)}
                            resetOnSuccess
                            className="jr-delete-account-form"
                        >
                            {({ resetAndClearErrors, processing, errors }) => (
                                <>
                                    <div className="jr-delete-body"><div className="jr-delete-notice">This action cannot be undone.</div><div className="jr-delete-verification">
                                        <Label
                                            htmlFor="password"
                                            className="jr-delete-verification-label"
                                        >
                                            Confirm with your password
                                        </Label>

                                        <PasswordInput
                                            id="password"
                                            name="password"
                                            ref={passwordInput}
                                            placeholder="Password"
                                            autoComplete="current-password"
                                            disabled={processing}
                                            required
                                            className="jr-delete-input"
                                        />

                                        <InputError message={errors.password} role="alert" />
                                    </div></div>

                                    <DialogFooter className="jr-dialog-actions">
                                        <DialogClose asChild>
                                            <Button
                                                ref={cancelRef}
                                                variant="outline"
                                                className="jr-delete-cancel"
                                                disabled={processing}
                                                onClick={() =>
                                                    resetAndClearErrors()
                                                }
                                            >
                                                Cancel
                                            </Button>
                                        </DialogClose>

                                        <Button
                                            variant="destructive"
                                            className="jr-danger jr-delete-confirm"
                                            disabled={processing}
                                            asChild
                                        >
                                            <button
                                                type="submit"
                                                data-test="confirm-delete-user-button"
                                            >
                                                {processing ? <><Spinner /> Deleting…</> : <><Trash2 size={16} aria-hidden="true" /> Delete account</>}
                                            </button>
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
