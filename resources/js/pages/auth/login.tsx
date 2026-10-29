import '../../../css/jairoads-login.css';
import { Form, Head } from '@inertiajs/react';
import {
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    LockKeyhole,
    Pause,
    Play,
    Route,
    ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
    previewOnly?: boolean;
    demoEmail?: string;
    demoPassword?: string;
    oldEmail?: string;
};

// Photographs are illustrative. This application does not claim to be an official DPWH website.
// The first image is bundled locally; the other two are from Unsplash (see README for credits).
const slides = [
    {
        image: '/images/jairoads/road-rehabilitation.jpg',
        label: '01 — Road rehabilitation',
        headline: 'Better roads. Stronger communities.',
        description:
            'Coordinate roadway rehabilitation and keep essential infrastructure information in one place.',
        credit: 'JaiROADS illustrative imagery',
    },
    {
        image: 'https://images.unsplash.com/photo-1709390073380-6abf8acbe485?auto=format&fit=crop&w=1800&q=80',
        label: '02 — Road mapping',
        headline: 'Every road has a story to tell.',
        description:
            'Understand road coverage, geographic context, and the projects connected to each location.',
        credit: 'Photo: XT7 Core / Unsplash · Cebu, Philippines',
    },
    {
        image: 'https://images.unsplash.com/photo-1763328044351-98341e9963da?auto=format&fit=crop&w=1800&q=80',
        label: '03 — Infrastructure works',
        headline: 'Track the work that moves us forward.',
        description:
            'Bring maintenance projects, engineering work, and progress reporting together.',
        credit: 'Photo: Christian Agbede / Unsplash',
    },
] as const;

export default function Login({
    status,
    canResetPassword,
    previewOnly,
    demoEmail,
    demoPassword,
    oldEmail,
}: Props) {
    const [activeSlide, setActiveSlide] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [hovered, setHovered] = useState(false);

    useEffect(() => {
        const preference = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        );
        const update = () => setReducedMotion(preference.matches);
        update();
        preference.addEventListener('change', update);

        return () => preference.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        if (!playing || reducedMotion || hovered) {
            return;
        }

        const timer = window.setInterval(() => {
            setActiveSlide((current) => (current + 1) % slides.length);
        }, 7000);

        return () => window.clearInterval(timer);
    }, [playing, reducedMotion, hovered]);

    const changeSlide = (direction: number) => {
        setActiveSlide(
            (current) => (current + direction + slides.length) % slides.length,
        );
    };

    const slide = slides[activeSlide];

    return (
        <>
            <Head title="Sign in · JaiROADS" />
            <div className="jr-login">
                <div className="jr-login-frame">
                    <section
                        aria-label="JaiROADS road infrastructure showcase"
                        className="jr-login-showcase relative isolate overflow-hidden bg-[#1b3141] text-white"
                        onMouseEnter={() => setHovered(true)}
                        onMouseLeave={() => setHovered(false)}
                        onFocusCapture={() => setHovered(true)}
                        onBlurCapture={(event) => {
                            if (
                                !event.currentTarget.contains(
                                    event.relatedTarget,
                                )
                            ) {
                                setHovered(false);
                            }
                        }}
                    >
                        {slides.map((item, index) => (
                            <img
                                key={item.image}
                                src={item.image}
                                alt=""
                                aria-hidden="true"
                                loading="eager"
                                decoding="async"
                                onError={(event) => {
                                    // Keep the slideshow usable even without an external image connection.
                                    if (
                                        !event.currentTarget.src.endsWith(
                                            '/images/jairoads/road-rehabilitation.jpg',
                                        )
                                    ) {
                                        event.currentTarget.src =
                                            '/images/jairoads/road-rehabilitation.jpg';
                                    }
                                }}
                                className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 motion-reduce:transition-none ${index === activeSlide ? 'opacity-100' : 'opacity-0'}`}
                            />
                        ))}
                        <div
                            aria-hidden="true"
                            className="jr-login-shade absolute inset-0"
                        />
                        <div className="jr-login-slide-content relative z-10">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-amber-100/30 bg-white/15 backdrop-blur-sm">
                                        <Route
                                            aria-hidden="true"
                                            className="size-6 text-[#ffd293]"
                                            strokeWidth={2.2}
                                        />
                                    </div>
                                    <div className="leading-tight">
                                        <div className="text-[23px] font-bold tracking-[-.045em]">
                                            Jai
                                            <span className="text-[#ffd29c]">
                                                ROADS
                                            </span>
                                        </div>
                                        <div className="mt-0.5 text-[10px] font-semibold tracking-[.22em] text-white/75 uppercase">
                                            Road infrastructure management
                                        </div>
                                    </div>
                                </div>
                                <span className="hidden rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-semibold tracking-[.16em] text-white/90 uppercase backdrop-blur-sm sm:inline-flex">
                                    Engineering & public works
                                </span>
                            </div>

                            <div className="jr-login-caption">
                                <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[.2em] text-[#ffd293] uppercase">
                                    <span
                                        className="h-px w-9 bg-[#ffc476]"
                                        aria-hidden="true"
                                    />
                                    {slide.label}
                                </div>
                                <div aria-live="off" key={activeSlide}>
                                    <h1 className="max-w-[570px] text-[30px] leading-[1.1] font-bold tracking-[-.04em] sm:text-[38px] lg:text-[clamp(32px,3.1vw,52px)]">
                                        {slide.headline}
                                    </h1>
                                    <p className="mt-3 hidden max-w-[470px] text-[15px] leading-7 text-white/85 sm:block lg:mt-5 lg:text-base">
                                        {slide.description}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-end justify-between gap-4">
                                <div className="space-y-3">
                                    <div
                                        className="flex items-center gap-2"
                                        aria-label="Choose showcase image"
                                    >
                                        {slides.map((item, index) => (
                                            <button
                                                key={item.label}
                                                type="button"
                                                onClick={() =>
                                                    setActiveSlide(index)
                                                }
                                                aria-label={`Show ${item.label}`}
                                                aria-current={
                                                    index === activeSlide
                                                        ? 'true'
                                                        : undefined
                                                }
                                                className={`h-1.5 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none ${index === activeSlide ? 'w-9 bg-[#ffd293]' : 'w-5 bg-white/45 hover:bg-white/85'}`}
                                            />
                                        ))}
                                    </div>
                                    <p className="hidden text-[11px] text-white/65 md:block">
                                        {slide.credit}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setPlaying((value) => !value)
                                        }
                                        aria-label={
                                            playing
                                                ? 'Pause slideshow'
                                                : 'Resume slideshow'
                                        }
                                        className="flex size-9 items-center justify-center rounded-full border border-white/30 bg-white/10 transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
                                    >
                                        {playing ? (
                                            <Pause
                                                aria-hidden="true"
                                                className="size-4"
                                            />
                                        ) : (
                                            <Play
                                                aria-hidden="true"
                                                className="size-4"
                                            />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => changeSlide(-1)}
                                        aria-label="Previous slide"
                                        className="flex size-9 items-center justify-center rounded-full border border-white/30 bg-white/10 transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
                                    >
                                        <ChevronLeft
                                            aria-hidden="true"
                                            className="size-4"
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => changeSlide(1)}
                                        aria-label="Next slide"
                                        className="flex size-9 items-center justify-center rounded-full border border-white/30 bg-white/10 transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
                                    >
                                        <ChevronRight
                                            aria-hidden="true"
                                            className="size-4"
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <main className="jr-login-panel">
                        <div className="flex items-center justify-between text-[11px] font-semibold tracking-[.16em] text-[#8090a3] uppercase">
                            <span className="inline-flex items-center gap-2">
                                <ShieldCheck
                                    aria-hidden="true"
                                    className="size-4 text-[#a65b2a]"
                                />{' '}
                                Secure workspace
                            </span>
                            <span>JaiROADS</span>
                        </div>

                        <div className="jr-login-form">
                            <div className="mb-6 space-y-2">
                                <p className="text-xs font-bold tracking-[.22em] text-[#a35a2d] uppercase">
                                    Welcome to JaiROADS
                                </p>
                                <h2 className="text-[30px] font-bold tracking-[-.04em] text-[#16263a] sm:text-[34px]">
                                    Welcome back
                                </h2>
                                <p className="max-w-[380px] text-sm leading-6 text-[#697b90]">
                                    Sign in to your JaiROADS workspace.
                                </p>
                            </div>

                            {status && (
                                <p
                                    role="status"
                                    className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
                                >
                                    {status}
                                </p>
                            )}

                            {previewOnly && (
                                <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                                    Frontend preview only · sample account
                                    <br />
                                    Email: {demoEmail}
                                    <br />
                                    Password: {demoPassword}
                                </p>
                            )}
                            <Form
                                {...store.form()}
                                resetOnSuccess={['password']}
                                className="space-y-4"
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor="email"
                                                className="text-sm font-semibold text-[#263c53]"
                                            >
                                                Email address
                                            </Label>
                                            <Input
                                                id="email"
                                                defaultValue={oldEmail}
                                                type="email"
                                                name="email"
                                                required
                                                autoFocus
                                                autoComplete="email"
                                                placeholder="you@example.com"
                                                aria-invalid={Boolean(
                                                    errors.email,
                                                )}
                                                className="h-12 rounded-xl border-[#dce4ec] bg-[#fdfefe] px-4 text-sm text-[#17283e] placeholder:text-[#a1afbd] focus-visible:border-[#a45b30] focus-visible:ring-[#a45b30]/20"
                                            />
                                            <InputError
                                                message={errors.email}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <Label
                                                    htmlFor="password"
                                                    className="text-sm font-semibold text-[#263c53]"
                                                >
                                                    Password
                                                </Label>
                                                {canResetPassword && (
                                                    <a
                                                        href={request().url}
                                                        className="text-xs font-semibold text-[#965027] underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#965027]"
                                                    >
                                                        Forgot password?
                                                    </a>
                                                )}
                                            </div>
                                            <PasswordInput
                                                id="password"
                                                name="password"
                                                required
                                                autoComplete="current-password"
                                                placeholder="Enter your password"
                                                aria-invalid={Boolean(
                                                    errors.password,
                                                )}
                                                className="h-12 rounded-xl border-[#dce4ec] bg-[#fdfefe] px-4 text-sm text-[#17283e] placeholder:text-[#a1afbd] focus-visible:border-[#a45b30] focus-visible:ring-[#a45b30]/20"
                                            />
                                            <InputError
                                                message={errors.password}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2.5 py-1">
                                            <Checkbox
                                                id="remember"
                                                name="remember"
                                                className="border-[#b8c5d3] data-[state=checked]:border-[#965027] data-[state=checked]:bg-[#965027]"
                                            />
                                            <Label
                                                htmlFor="remember"
                                                className="cursor-pointer text-sm font-normal text-[#53687d]"
                                            >
                                                Keep me signed in
                                            </Label>
                                        </div>
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                            data-test="login-button"
                                            className="mt-1 h-12 w-full rounded-xl bg-[#964b23] text-sm font-semibold text-white shadow-[0_6px_18px_rgba(121,56,21,0.17)] transition hover:bg-[#783a1a] focus-visible:ring-[#bd835a]/30 disabled:opacity-65"
                                        >
                                            {processing ? (
                                                <>
                                                    <Spinner /> Signing in…
                                                </>
                                            ) : (
                                                <>
                                                    Sign in{' '}
                                                    <ArrowRight
                                                        aria-hidden="true"
                                                        className="ml-1 size-4"
                                                    />
                                                </>
                                            )}
                                        </Button>
                                    </>
                                )}
                            </Form>

                            <div className="mt-5 border-t border-[#edf0f4] pt-5 [&>div:last-child]:hidden">
                                {previewOnly ? (
                                    <p className="text-xs leading-5 text-[#738398]">
                                        Password recovery and passkey sign-in
                                        are unavailable in this preview.
                                    </p>
                                ) : (
                                    <PasskeyVerify label="Sign in with a passkey" />
                                )}
                            </div>

                            <div className="mt-5">
                                <div className="flex items-start gap-3">
                                    <LockKeyhole
                                        aria-hidden="true"
                                        className="mt-0.5 size-[18px] shrink-0 text-[#8a9db0]"
                                    />
                                    <p className="text-xs leading-5 text-[#738398]">
                                        Need an account? Contact your system
                                        administrator.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="jr-login-footer">
                            <span>© {new Date().getFullYear()} JaiROADS</span>
                            <span>
                                Road infrastructure & maintenance management
                            </span>
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}
