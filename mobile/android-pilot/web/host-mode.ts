type ModeMessage = 'cache-ready' | 'show-online' | 'show-local' | 'lock';

declare global {
    interface Window {
        JaiRoadsHost?: { postMessage: (message: ModeMessage) => void };
    }
}

export function hostMode(message: ModeMessage) {
    if (!window.JaiRoadsHost) {
        return false;
    }

    window.JaiRoadsHost.postMessage(message);

    return true;
}
