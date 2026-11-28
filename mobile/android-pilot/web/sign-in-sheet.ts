// Full-screen navigation. Keep the preview mounted so its carousel state survives.
export function bindSignInSheet(busy: () => boolean) {
    const page = document.querySelector<HTMLElement>('#auth-page')!;
    const preview = document.querySelector<HTMLElement>('#preview-screen')!;
    const start = document.querySelector<HTMLButtonElement>('#continue')!;
    const heading = document.querySelector<HTMLElement>('#sign-in-title')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const swipeArea = '.hero, .panel-top, #sign-in-title, .description';
    const interactive = 'input, textarea, select, button, a, label, [contenteditable]';
    let motion: Animation | undefined;
    let previewMotion: Animation | undefined;
    let moving = false;
    let drag: { id: number; x: number; y: number; time: number; delta: number; active: boolean } | undefined;

    function updateSwipeMode() {
        if (!page.hidden) {
            page.dataset.swipeMode = page.scrollHeight <= page.clientHeight + 2 ? 'full' : 'header';
        }
    }

    // Reserve the gesture before pointerdown so Android cannot claim it as scrolling.
    const observer = new ResizeObserver(updateSwipeMode);
    observer.observe(page);
    observer.observe(document.querySelector<HTMLElement>('#sign-in-panel')!);
    window.addEventListener('resize', updateSwipeMode);
    window.visualViewport?.addEventListener('resize', updateSwipeMode);

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
        drag = undefined;
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
        updateSwipeMode();
        animate('translateY(100%)', 'translateY(0)', false, () => {
            preview.style.visibility = 'hidden';
            heading.focus({ preventScroll: true });
            updateSwipeMode();
        });
    }

    function dismiss(from = getComputedStyle(page).transform) {
        if (busy() || moving || page.hidden) return;
        if (document.activeElement instanceof HTMLElement && page.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        preview.style.visibility = '';
        animate(from, 'translateY(100%)', true, close);
    }

    start.addEventListener('click', open);
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
    page.addEventListener('pointerdown', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (moving || busy() || page.hidden || !event.isPrimary || event.button !== 0 ||
            page.scrollTop > 1 || target?.closest(interactive) ||
            (page.dataset.swipeMode !== 'full' && !target?.closest(swipeArea))) return;
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), delta: 0, active: false };
        // Capture at the start on non-interactive content. Form controls retain native behavior.
        page.setPointerCapture(event.pointerId);
    });
    page.addEventListener('pointermove', (event) => {
        if (!drag || drag.id !== event.pointerId) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.active) {
            if (dy < -12 || (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy))) {
                drag = undefined;
                if (page.hasPointerCapture(event.pointerId)) page.releasePointerCapture(event.pointerId);
                return;
            }
            if (dy < 8 || dy <= Math.abs(dx)) return;
            drag.active = true;
            preview.style.visibility = '';
        }
        if (event.cancelable) event.preventDefault();
        drag.delta = Math.max(0, dy);
        if (!reduced.matches) page.style.transform = `translateY(${drag.delta}px)`;
    });
    function finishDrag(event: PointerEvent) {
        if (!drag || drag.id !== event.pointerId) return;
        const { active, delta, time } = drag;
        drag = undefined;
        if (page.hasPointerCapture(event.pointerId)) page.releasePointerCapture(event.pointerId);
        if (!active) return;
        const speed = delta / Math.max(1, performance.now() - time);
        const from = getComputedStyle(page).transform;
        if (event.type === 'pointerup' && !busy() &&
            (delta > Math.min(110, page.clientHeight * 0.22) || (delta > 35 && speed > 0.65))) {
            dismiss(from);
        } else {
            animate(from, 'translateY(0)', false, () => {
                preview.style.visibility = 'hidden';
            });
        }
    }
    page.addEventListener('pointerup', finishDrag);
    page.addEventListener('pointercancel', finishDrag);
    page.addEventListener('lostpointercapture', finishDrag);
    return { close };
}
