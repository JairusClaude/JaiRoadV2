type ModeMessage = 'cache-ready' | 'show-online' | 'show-local' | 'lock';

declare global {
    interface Window {
        JaiRoadsHost?: { postMessage: (message: string) => void };
    }
}

export function hostMode(message: ModeMessage) {
    if (!window.JaiRoadsHost) {
        return false;
    }

    window.JaiRoadsHost.postMessage(message);

    return true;
}

export function exportLocalFile(name: string, data: string) {
    if (window.JaiRoadsHost) {
        window.JaiRoadsHost.postMessage('export-file:' + JSON.stringify({ name, data }));
        return;
    }
    const link = document.createElement('a');
    link.download = name;
    link.href = data;
    link.click();
}
