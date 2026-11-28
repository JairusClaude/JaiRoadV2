import type { TileLayer } from 'leaflet';

export type BasemapStatus = 'loading' | 'ready' | 'unavailable';

/** Track the visible tile batch independently of saved or editable geometry. */
export function watchBasemap(
    tiles: TileLayer,
    onStatus: (status: BasemapStatus) => void,
) {
    let deadline: number | undefined;
    let failed = false;
    let disposed = false;

    const clearDeadline = () => window.clearTimeout(deadline);
    const start = () => {
        if (disposed) {
            return;
        }

        failed = false;
        clearDeadline();
        onStatus('loading');
        deadline = window.setTimeout(() => {
            if (!disposed) {
                onStatus('unavailable');
            }
        }, 12_000);
    };
    const error = () => {
        if (!disposed) {
            failed = true;
            clearDeadline();
            onStatus('unavailable');
        }
    };
    const complete = () => {
        clearDeadline();

        if (!disposed) {
            onStatus(failed ? 'unavailable' : 'ready');
        }
    };

    tiles.on('loading', start);
    tiles.on('tileerror', error);
    tiles.on('load', complete);
    start();

    return {
        retry() {
            if (!disposed) {
                start();
                tiles.redraw();
            }
        },
        dispose() {
            disposed = true;
            clearDeadline();
            tiles.off('loading', start);
            tiles.off('tileerror', error);
            tiles.off('load', complete);
        },
    };
}
