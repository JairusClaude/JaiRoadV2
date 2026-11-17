import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';

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
        fallback: '/images/jairoads/road-mapping-fallback.svg',
        label: '02 — Road mapping',
        headline: 'Every road has a story to tell.',
        description:
            'Understand road coverage, geographic context, and the projects connected to each location.',
        credit: 'Photo: XT7 Core / Unsplash · Cebu, Philippines',
    },
    {
        image: 'https://images.unsplash.com/photo-1763328044351-98341e9963da?auto=format&fit=crop&w=1800&q=80',
        fallback: '/images/jairoads/infrastructure-fallback.svg',
        label: '03 — Infrastructure works',
        headline: 'Track the work that moves us forward.',
        description:
            'Bring maintenance projects, engineering work, and progress reporting together.',
        credit: 'Photo: Christian Agbede / Unsplash',
    },
] as const;

export default function AuthShowcase() {
    const [activeSlide, setActiveSlide] = useState(0);
    const [playing, setPlaying] = useState(() => typeof window === 'undefined' || (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && !document.documentElement.classList.contains('jr-reduce-motion')));
    const [loadedImages, setLoadedImages] = useState<number[]>([]);
    useEffect(() => {
        const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => { if (preference.matches) setPlaying(false); };
        preference.addEventListener('change', update);
        return () => preference.removeEventListener('change', update);
    }, []);
    useEffect(() => {
        if (!playing) return;
        const timer = window.setTimeout(() => setActiveSlide((current) => (current + 1) % slides.length), 10000);
        return () => window.clearTimeout(timer);
    }, [playing, activeSlide]);
    const changeSlide = (direction: number) => setActiveSlide((current) => (current + direction + slides.length) % slides.length);
    const slide = slides[activeSlide];
    return (
                    <section
                        aria-label="JaiROADS road infrastructure showcase"
                        className="jr-login-showcase relative isolate overflow-hidden bg-[#1b3141] text-white"
                        data-active-slide={activeSlide}
                    >
                        {slides.map((item, index) => (
                            <div key={item.image} className={`absolute inset-0 transition-opacity duration-1000 motion-reduce:transition-none ${index === activeSlide ? 'opacity-100' : 'opacity-0'}`}>
                                {'fallback' in item && <img src={item.fallback} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-center" />}
                                <img src={item.image} alt="" aria-hidden="true" loading="eager" decoding="async" referrerPolicy="no-referrer"
                                    onLoad={() => setLoadedImages((previous) => previous.includes(index) ? previous : [...previous, index])}
                                    onError={() => setLoadedImages((previous) => previous.filter((value) => value !== index))}
                                    className={`absolute inset-0 h-full w-full object-cover object-center ${'fallback' in item && !loadedImages.includes(index) ? 'opacity-0' : 'opacity-100'}`} />
                            </div>
                        ))}
                        <div
                            aria-hidden="true"
                            className="jr-login-shade absolute inset-0"
                        />
                        <div className="jr-login-slide-content relative z-10">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <img
                                        src="/images/jairoads/peo-ddo-transparent.webp"
                                        alt="PEO-DDO"
                                        width={144}
                                        height={144}
                                        className="size-12 shrink-0 object-contain sm:size-14 xl:size-16"
                                    />
                                    <div className="min-w-0 leading-tight">
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
                                        {'fallback' in slide && !loadedImages.includes(activeSlide) ? 'JaiROADS illustrative artwork' : slide.credit}
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
    );
}
