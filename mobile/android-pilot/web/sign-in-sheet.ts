// Full-screen vertical navigation; keep the preview mounted so its slide is preserved.
export function bindSignInSheet(busy: () => boolean) {
    const page = document.querySelector<HTMLElement>('#auth-page')!;
    const preview = document.querySelector<HTMLElement>('#preview-screen')!;
    const start = document.querySelector<HTMLButtonElement>('#continue')!;
    const explore = document.querySelector<HTMLButtonElement>('#explore')!;
    const heading = document.querySelector<HTMLElement>('#sign-in-title')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let motion: Animation | undefined;
    let previewMotion: Animation | undefined;
    let moving = false;
    let touch: { id: number; x: number; y: number; time: number; delta: number; dragging: boolean } | undefined;

    function stop() {
        motion?.cancel();
        previewMotion?.cancel();
        motion = undefined;
        previewMotion = undefined;
        moving = false;
    }

    function animate(from: string, to: string, closing: boolean, finish: () => void) {
        stop();
        page.style.transform = '';
        preview.style.transform = '';
        if (reduced.matches) {
            finish();
            return;
        }
        moving = true;
        const timing: KeyframeAnimationOptions = {
            duration: 280,
            easing: 'cubic-bezier(.22,.75,.28,1)',
            fill: 'both',
        };
        if (closing) {
            previewMotion = preview.animate(
                [{ transform: 'translateY(4%)' }, { transform: 'translateY(0)' }],
                timing,
            );
        }
        const current = page.animate([{ transform: from }, { transform: to }], timing);
        motion = current;
        current.onfinish = () => {
            if (motion !== current) return;
            stop();
            finish();
        };
    }

    function close() {
        stop();
        touch = undefined;
        page.hidden = true;
        page.style.transform = '';
        preview.style.transform = '';
        preview.style.visibility = '';
        preview.inert = false;
        start.focus({ preventScroll: true });
    }

    function open() {
        if (moving || !page.hidden) return;
        preview.inert = true;
        page.hidden = false;
        page.scrollTop = 0;
        animate('translateY(100%)', 'translateY(0)', false, () => {
            preview.style.visibility = 'hidden';
            heading.focus({ preventScroll: true });
        });
    }

    function dismiss(from = getComputedStyle(page).transform) {
        if (busy() || moving || page.hidden) return;
        preview.style.visibility = '';
        animate(from, 'translateY(100%)', true, close);
    }

    start.addEventListener('click', open);
    explore.addEventListener('click', () => dismiss());
    window.addEventListener('jairoads-back', (event) => {
        if (!page.hidden) {
            event.preventDefault();
            dismiss();
        }
    });
    page.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            dismiss();
        }
    });
    const interactive = 'input, textarea, select, button, a, label, [contenteditable]';
    page.addEventListener('touchstart', (event) => {
        if (moving || busy() || page.scrollTop > 1 || event.touches.length !== 1 ||
            (event.target as Element | null)?.closest(interactive) ||
            document.activeElement?.matches('input, textarea, select, [contenteditable]')) {
            touch = undefined;
            return;
        }
        const point = event.touches[0];
        touch = { id: point.identifier, x: point.clientX, y: point.clientY, time: performance.now(), delta: 0, dragging: false };
    }, { passive: true });
    page.addEventListener('touchmove', (event) => {
        if (!touch || busy() || event.touches.length !== 1) return;
        const point = Array.from(event.touches).find((p) => p.identifier === touch?.id);
        if (!point) return;
        const dy = point.clientY - touch.y;
        const dx = point.clientX - touch.x;
        if (!touch.dragging) {
            if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) || dy < -10) {
                touch = undefined;
                return;
            }
            if (dy < 10 || dy <= Math.abs(dx) || !event.cancelable || page.scrollTop > 1) return;
            touch.dragging = true;
            preview.style.visibility = '';
        }
        if (event.cancelable) event.preventDefault();
        touch.delta = Math.max(0, dy);
        if (!reduced.matches) page.style.transform = `translateY(${touch.delta}px)`;
    }, { passive: false });
    function finishTouch(event: TouchEvent) {
        if (!touch) return;
        const cancelled = event.type === 'touchcancel';
        if (!cancelled && !Array.from(event.changedTouches).some((p) => p.identifier === touch?.id)) return;
        const { dragging, delta, time } = touch;
        touch = undefined;
        if (!dragging) return;
        const speed = delta / Math.max(1, performance.now() - time);
        const from = getComputedStyle(page).transform;
        if (!cancelled && !busy() && (delta > Math.min(120, page.clientHeight * 0.25) || (delta > 35 && speed > 0.65))) {
            dismiss(from);
        } else {
            animate(from, 'translateY(0)', false, () => {
                preview.style.visibility = 'hidden';
            });
        }
    }
    page.addEventListener('touchend', finishTouch);
    page.addEventListener('touchcancel', finishTouch);
    return { close };
}
