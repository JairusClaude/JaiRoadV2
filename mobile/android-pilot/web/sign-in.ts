import { loadWorkspace, RequestError, Vault } from './queue';
import './sign-in.css';

const element = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
const form = element<HTMLFormElement>('credentials');
const submit = element<HTMLButtonElement>('submit');
const email = element<HTMLInputElement>('email');
const password = element<HTMLInputElement>('password');
const showPassword = element<HTMLButtonElement>('show-password');
const status = element('sign-in-status');
const explore = element<HTMLButtonElement>('explore');
const showcase = element('showcase');

let signingIn = false;

if (location.hash) {
    history.replaceState(null, '', location.pathname);
}

function showStatus(message: string, error = false) {
    status.textContent = message;
    status.hidden = !message;
    status.dataset.error = String(error);
}

function renderConnection() {
    submit.disabled = signingIn;
    form.setAttribute('aria-busy', String(signingIn));

    if (!signingIn && status.dataset.error !== 'true') {
        showStatus(
            navigator.onLine
                ? ''
                : 'Offline mode · Sign in with an account previously used online on this phone.',
        );
    }
}

function csrfCookie() {
    const name = 'XSRF-TOKEN=';
    const cookie = document.cookie
        .split('; ')
        .find((part) => part.startsWith(name));

    return cookie ? decodeURIComponent(cookie.slice(name.length)) : '';
}

class PilotUnreachable extends Error {}

async function startSession() {
    try {
        return await fetch('/login', {
            cache: 'no-store',
            credentials: 'same-origin',
            redirect: 'manual',
            signal: AbortSignal.timeout(12000),
        });
    } catch {
        throw new PilotUnreachable();
    }
}

function sessionHeaders() {
    const csrf = csrfCookie();

    if (!csrf) {
        throw new Error('Could not start a secure session. Try again.');
    }

    return { Accept: 'application/json', 'X-XSRF-TOKEN': csrf };
}

async function authenticate(
    emailAddress: string,
    secret: string,
    remember: boolean,
) {
    // Open a Fortify guest session before validating the submitted credentials.
    // A previous online session is never proof of the newly submitted password.
    let session = await startSession();

    if (session.type === 'opaqueredirect') {
        const logout = await fetch('/logout', {
            method: 'POST',
            credentials: 'same-origin',
            redirect: 'error',
            signal: AbortSignal.timeout(12000),
            headers: sessionHeaders(),
        });

        if (!logout.ok) {
            throw new Error('Could not switch accounts. Try again.');
        }

        session = await startSession();
    }

    if (!session.ok || new URL(session.url).origin !== location.origin) {
        throw new Error('JaiROADS sign-in is temporarily unavailable.');
    }

    const response = await fetch('/login', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: { ...sessionHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: emailAddress,
            password: secret,
            remember,
        }),
    });

    if (response.status === 422) {
        throw new Error('Check your email address and password and try again.');
    }

    if (response.status === 429) {
        throw new Error(
            'Too many attempts. Wait a minute before trying again.',
        );
    }

    if (response.status === 419) {
        throw new Error('Your sign-in session expired. Try again.');
    }

    if (!response.ok || (await response.json()).two_factor !== false) {
        throw new Error('JaiROADS could not sign you in. Try again.');
    }
}

async function openWorkspace(vault: Vault, offline: boolean) {
    const { openFieldReports } = await import('./main');
    password.value = '';
    openFieldReports(vault, offline);
}

async function signInOffline(emailAddress: string, secret: string) {
    try {
        await openWorkspace(await Vault.open(emailAddress, secret), true);
    } catch {
        throw new Error(
            'Offline sign-in could not unlock this account. Use the email and password from your last online sign-in on this phone.',
        );
    }
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (signingIn) {
        return;
    }

    signingIn = true;
    showStatus('Signing in…');
    renderConnection();
    const emailAddress = email.value.trim().toLowerCase();
    const secret = password.value;

    try {
        if (!navigator.onLine) {
            await signInOffline(emailAddress, secret);

            return;
        }

        try {
            await authenticate(
                emailAddress,
                secret,
                new FormData(form).has('remember'),
            );
        } catch (error) {
            if (error instanceof PilotUnreachable) {
                await signInOffline(emailAddress, secret);

                return;
            }

            throw error;
        }

        const workspace = await loadWorkspace().catch((error: unknown) => {
            if (error instanceof RequestError && error.status === 403) {
                return null;
            }

            throw error;
        });

        if (!workspace) {
            password.value = '';
            location.replace('/dashboard');

            return;
        }

        try {
            await openWorkspace(
                await Vault.prepare(emailAddress, secret, workspace),
                false,
            );
        } catch {
            throw new Error(
                'Could not open saved fieldwork with this password. Your existing files are still on this phone.',
            );
        }
    } catch (error) {
        showStatus(
            error instanceof Error &&
                !['TypeError', 'TimeoutError', 'SyntaxError'].includes(
                    error.name,
                )
                ? error.message
                : 'Could not reach JaiROADS. Check your connection and try again.',
            true,
        );
    } finally {
        signingIn = false;
        renderConnection();
    }
});

showPassword.addEventListener('click', () => {
    const reveal = password.type === 'password';
    password.type = reveal ? 'text' : 'password';
    showPassword.setAttribute(
        'aria-label',
        reveal ? 'Hide password' : 'Show password',
    );
    document
        .getElementById('password-slash')
        ?.setAttribute('visibility', reveal ? 'visible' : 'hidden');
});

const slides = [
    {
        image: new URL(
            '../../../public/images/jairoads/road-rehabilitation.jpg',
            import.meta.url,
        ).href,
        label: 'Road rehabilitation',
        title: 'Better roads. Stronger communities.',
        description:
            'Coordinate roadway rehabilitation and keep essential infrastructure information in one place.',
    },
    {
        image: new URL(
            '../../../public/images/jairoads/road-mapping-fallback.svg',
            import.meta.url,
        ).href,
        label: 'Road mapping',
        title: 'Every road has a story to tell.',
        description:
            'See road coverage and the projects connected to each location.',
    },
    {
        image: new URL(
            '../../../public/images/jairoads/infrastructure-fallback.svg',
            import.meta.url,
        ).href,
        label: 'Infrastructure works',
        title: 'Track the work that moves us forward.',
        description:
            'Bring maintenance projects, engineering work, and progress reporting together.',
    },
];
let activeSlide = 0;

function showSlide(index: number) {
    activeSlide = (index + slides.length) % slides.length;
    const slide = slides[activeSlide];
    const image = element<HTMLImageElement>('slide-image');
    image.src = slide.image;
    const animation = image.getAnimations()[0];

    if (animation) {
        animation.currentTime = 0;
        animation.play();
    }

    element('slide-label').textContent = slide.label;
    element('slide-title').textContent = slide.title;
    element('slide-description').textContent = slide.description;
    element('slide-position').textContent =
        activeSlide + 1 + ' / ' + slides.length;
}

explore.addEventListener('click', () => {
    element('sign-in-panel').hidden = true;
    explore.hidden = true;
    showcase.hidden = false;
    showSlide(activeSlide);
    element('continue').focus({ preventScroll: true });
});
element('previous').addEventListener('click', () => showSlide(activeSlide - 1));
element('next').addEventListener('click', () => showSlide(activeSlide + 1));
element('continue').addEventListener('click', () => {
    showcase.hidden = true;
    explore.hidden = false;
    element('sign-in-panel').hidden = false;
    email.focus({ preventScroll: true });
});
window.addEventListener('online', renderConnection);
window.addEventListener('offline', renderConnection);
renderConnection();
