// Only the standalone review server supplies previewOnly. Laravel is unaffected.
export function initializePreviewSessionChecks() {
    const initial = document.querySelector('script[data-page="app"]');

    if (!initial?.textContent) {
        return;
    }

    const page = JSON.parse(initial.textContent);

    if (page.props?.previewOnly !== true) {
        return;
    }

    let sequence = 0;
    const check = async () => {
        const current = ++sequence;

        if (window.location.pathname === '/login') {
            document.documentElement.style.visibility = '';

            return;
        }

        document.documentElement.style.visibility = 'hidden';

        try {
            const response = await fetch('/preview/session', {
                cache: 'no-store',
            });
            const session = await response.json();

            if (current !== sequence) {
                return;
            }

            if (!session.authenticated) {
                window.location.replace('/login');

                return;
            }

            document.documentElement.style.visibility = '';
        } catch {
            if (current === sequence) {
                window.location.replace('/login');
            }
        }
    };
    window.addEventListener('popstate', () => void check());
    window.addEventListener('pageshow', () => void check());
    window.addEventListener('focus', () => void check());
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            void check();
        }
    });
}
