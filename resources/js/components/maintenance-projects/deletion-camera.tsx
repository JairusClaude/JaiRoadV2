import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export function DeletionCamera({ token, scope, disabled, onReceipt }: {
    token: string;
    scope: 'project' | 'record';
    disabled: boolean;
    onReceipt: (receipt: string) => void;
}) {
    const video = useRef<HTMLVideoElement>(null);
    const stream = useRef<MediaStream | null>(null);
    const request = useRef<AbortController | null>(null);
    const active = useRef(true);
    const generation = useRef(0);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [photo, setPhoto] = useState('');
    const [verified, setVerified] = useState(false);
    const [error, setError] = useState('');

    const stop = () => {
        stream.current?.getTracks().forEach((track) => track.stop());
        stream.current = null;
        if (video.current) video.current.srcObject = null;
    };

    useEffect(() => {
        active.current = true;
        return () => {
            active.current = false;
            generation.current++;
            request.current?.abort();
            stop();
        };
    }, []);

    const start = async () => {
        if (disabled || busy) return;
        const current = ++generation.current;
        stop();
        request.current?.abort();
        onReceipt('');
        setVerified(false);
        setPhoto('');
        setReady(false);
        setError('');
        setBusy(true);
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('Camera access requires a secure HTTPS page and a supported browser.');
            }
            const media = await navigator.mediaDevices.getUserMedia({
                audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            });
            if (!active.current || current !== generation.current) {
                media.getTracks().forEach((track) => track.stop());
                return;
            }
            stream.current = media;
            if (!video.current) { stop(); return; }
            video.current.srcObject = media;
            await video.current.play();
        } catch (reason) {
            if (active.current && current === generation.current) {
                stop();
                setError(reason instanceof Error && reason.name === 'NotAllowedError'
                    ? 'Camera permission was denied. Allow access in your browser and try again.'
                    : 'Camera unavailable. Check the camera connection, browser permission and HTTPS, then retry.');
            }
        } finally {
            if (active.current && current === generation.current) setBusy(false);
        }
    };

    const capture = async () => {
        const element = video.current;
        if (disabled || busy || !ready || !element || !stream.current || !element.videoWidth || !element.videoHeight) return;
        const current = ++generation.current;
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 640 / Math.max(element.videoWidth, element.videoHeight));
        canvas.width = Math.round(element.videoWidth * scale);
        canvas.height = Math.round(element.videoHeight * scale);
        const context = canvas.getContext('2d');
        if (!context) { setError('Could not capture the photo. Try again.'); return; }
        context.drawImage(element, 0, 0, canvas.width, canvas.height);
        const preview = canvas.toDataURL('image/jpeg', 0.75);
        setPhoto(preview);
        stop();
        setReady(false);
        setBusy(true);
        setError('');
        setVerified(false);
        onReceipt('');
        const controller = new AbortController();
        request.current = controller;
        try {
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.75));
            if (!blob || blob.size > 524288) throw new Error('Photo could not be processed. Retake it.');
            if (!active.current || current !== generation.current) return;
            const cookie = document.cookie.split('; ').find((value) => value.startsWith('XSRF-TOKEN='));
            if (!cookie) throw new Error('Session verification unavailable. Refresh the page.');
            const response = await fetch(`/dd-phase3/ui/deletion-challenge/camera?scope=${scope}`, {
                method: 'POST', cache: 'no-store', signal: controller.signal,
                headers: { Accept: 'application/json', 'Content-Type': 'image/jpeg',
                    'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(11)), 'X-Deletion-Challenge': token },
                body: blob,
            });
            const data = await response.json();
            if (!response.ok || typeof data.receipt !== 'string') throw new Error(data.message || 'Camera verification failed. Retake the photo or request a new challenge.');
            if (active.current && current === generation.current) {
                onReceipt(data.receipt);
                setVerified(true);
            }
        } catch (reason) {
            if (active.current && current === generation.current && !controller.signal.aborted) {
                setError(reason instanceof Error ? reason.message : 'Camera verification failed.');
            }
        } finally {
            if (active.current && current === generation.current) setBusy(false);
        }
    };

    return (
        <section className="jr-deletion-camera" aria-label="Camera verification">
            <h3 className="jr-delete-verification-label"><span className="jr-delete-step">3</span> Camera verification <span className="jr-required">*</span></h3>
            <p className="jr-field-hint">Please turn on your webcam and take a picture to confirm this deletion. Your browser will request permission. The photo is sent for a one-time image check and is not stored. This does not verify your identity.</p>
            <video ref={video} autoPlay muted playsInline onLoadedData={() => setReady(true)} className={photo ? 'hidden' : 'jr-deletion-camera-preview'} aria-label="Live camera preview" />
            {photo && <img src={photo} alt="Captured verification photo" className="jr-deletion-camera-preview" />}
            <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={disabled || busy} onClick={start}>{photo || ready ? 'Retake photo' : 'Turn on webcam'}</Button>
                <Button type="button" variant="outline" disabled={disabled || busy || !ready} onClick={capture}>Take picture</Button>
            </div>
            {busy && <p role="status">Preparing camera verification…</p>}
            {verified && <p role="status" className="text-sm font-medium text-green-700">Photo accepted. Camera is off.</p>}
            {error && <p role="alert" className="jr-field-error">{error}</p>}
        </section>
    );
}
