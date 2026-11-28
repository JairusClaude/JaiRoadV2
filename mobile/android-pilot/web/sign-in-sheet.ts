export function bindSignInSheet(busy: () => boolean) {
    const sheet = document.querySelector<HTMLDialogElement>('#sign-in-panel')!;
    const start = document.querySelector<HTMLButtonElement>('#continue')!;
    const handle = document.querySelector<HTMLButtonElement>('#drag-handle')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let motion: Animation | undefined;
    let pointer: { id: number; y: number; start: number } | undefined;

    function slide(from: string, to: string, finish?: () => void) {
        motion?.cancel();

        if (reduced.matches || from === to) {
            finish?.();

            return;
        }

        motion = sheet.animate([{ transform: from }, { transform: to }], {
            duration: 280,
            easing: 'cubic-bezier(.22,.75,.28,1)',
            fill: 'both',
        });
        motion.onfinish = () => {
            motion?.cancel();
            finish?.();
        };
    }

    function close() {
        motion?.cancel();
        sheet.style.transform = '';
        sheet.close();
    }

    function dismiss(from = getComputedStyle(sheet).transform) {
        if (!busy()) {
            sheet.style.transform = '';
            slide(from, 'translateY(100%)', close);
        }
    }

    start.addEventListener('click', () => {
        sheet.showModal();
        slide('translateY(100%)', 'translateY(0)');
        handle.focus({ preventScroll: true });
    });
    sheet.addEventListener('close', () => start.focus({ preventScroll: true }));
    sheet.addEventListener('cancel', (event) => {
        event.preventDefault();
        dismiss();
    });
    window.addEventListener('jairoads-back', (event) => {
        if (sheet.open) {
            event.preventDefault();
            dismiss();
        }
    });
    handle.addEventListener('click', (event) => {
        if (event.detail === 0) {
            dismiss();
        }
    });
    handle.addEventListener('pointerdown', (event) => {
        if (busy() || !event.isPrimary || event.button !== 0) {
            return;
        }

        motion?.cancel();
        pointer = {
            id: event.pointerId,
            y: event.clientY,
            start: performance.now(),
        };
        handle.setPointerCapture(pointer.id);
    });
    handle.addEventListener('pointermove', (event) => {
        if (pointer?.id === event.pointerId) {
            sheet.style.transform = `translateY(${Math.max(0, event.clientY - pointer.y)}px)`;
        }
    });

    for (const type of [
        'pointerup',
        'pointercancel',
        'lostpointercapture',
    ] as const) {
        handle.addEventListener(type, (event) => {
            if (pointer?.id !== event.pointerId) {
                return;
            }

            const delta = Math.max(0, event.clientY - pointer.y);
            const speed =
                delta / Math.max(1, performance.now() - pointer.start);
            const from = getComputedStyle(sheet).transform;
            pointer = undefined;
            sheet.style.transform = '';

            if (
                type === 'pointerup' &&
                !busy() &&
                (delta > Math.min(120, sheet.offsetHeight * 0.25) ||
                    (delta > 35 && speed > 0.65))
            ) {
                dismiss(from);
            } else {
                slide(from, 'translateY(0)');
            }
        });
    }

    return { close };
}
