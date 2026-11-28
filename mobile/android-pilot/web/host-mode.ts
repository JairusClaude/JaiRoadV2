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
        const id=crypto.randomUUID();
        const chunkSize=128*1024;
        window.JaiRoadsHost.postMessage('export-start:'+JSON.stringify({id,name,length:data.length}));
        for(let offset=0;offset<data.length;offset+=chunkSize){window.JaiRoadsHost.postMessage('export-chunk:'+JSON.stringify({id,offset,data:data.slice(offset,offset+chunkSize)}));}
        window.JaiRoadsHost.postMessage('export-end:'+JSON.stringify({id}));
        return;
    }
    const link = document.createElement('a');
    link.download = name;
    link.href = data;
    link.click();
}
