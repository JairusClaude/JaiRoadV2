export async function recoveryRequest<T>(url: string, payload?: Record<string, unknown>): Promise<T> {
    const token = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN='));
    if (payload && !token) throw new Error('Session verification unavailable. Refresh and retry.');
    const response = await fetch(url, {
        method: payload ? 'POST' : 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
            Accept: 'application/json',
            ...(payload ? { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token!.slice(11)) } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const messages = Object.values(data.errors ?? {}).flat().filter((value) => typeof value === 'string');
        throw new Error(response.status === 429 ? 'Too many attempts. Wait a minute and try again.' : messages.join(' ') || data.message || 'Recovery is unavailable. Please contact the SuperAdmin.');
    }
    return data as T;
}
