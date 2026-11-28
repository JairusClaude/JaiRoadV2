import { useCallback } from 'react';

export function useMobileDialogViewport() {
    return useCallback((element: HTMLDivElement | null) => {
        const viewport = window.visualViewport;

        if (!element || !viewport) {
            return;
        }

        function update() {
            if (!element || !viewport) {
                return;
            }

            const height = viewport.height;
            const bottom = Math.max(
                0,
                window.innerHeight - height - viewport.offsetTop,
            );
            element.style.setProperty('--jr-dialog-height', `${height}px`);
            element.style.setProperty('--jr-dialog-bottom', `${bottom}px`);
        }

        update();
        viewport.addEventListener('resize', update);
        viewport.addEventListener('scroll', update);

        return () => {
            viewport.removeEventListener('resize', update);
            viewport.removeEventListener('scroll', update);
        };
    }, []);
}
