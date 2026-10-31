import { router } from '@inertiajs/react';

type Payload = Record<string, string | number | boolean | File | null>;

/** Use only explicit DD endpoints. Validation errors keep the editor open. */
export function requestOperation(
    url: string,
    data: Payload,
    method: 'post' | 'put' | 'delete' = 'post',
    upload = false,
    options: { preserveState?: boolean } = {},
): Promise<void> {
    if (!url.startsWith('/dd-phase3/')) {
        return Promise.reject(new Error('This action is unavailable.'));
    }

    return new Promise((resolve, reject) => {
        let settled = false;
        router.visit(url, {
            method,
            data,
            forceFormData: upload,
            preserveScroll: true,
            // A confirmation dialog must survive the validation redirect so
            // its rejection can be shown and a fresh preview requested.
            ...options,
            onSuccess: () => {
                settled = true;
                resolve();
            },
            onError: (errors) => {
                settled = true;
                reject(
                    new Error(
                        Object.values(errors).join(' ') ||
                            'Please review the form and try again.',
                    ),
                );
            },
            onCancel: () => {
                settled = true;
                reject(new Error('The request was cancelled.'));
            },
            onFinish: () => {
                if (!settled) {
                    reject(
                        new Error(
                            'The request could not be completed. Please try again.',
                        ),
                    );
                }
            },
        });
    });
}
