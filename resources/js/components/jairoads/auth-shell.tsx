import '../../../css/jairoads-login.css';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import AuthShowcase from './auth-showcase';

export const authInputClass =
    'h-12 rounded-lg border-[#e3d9cc] bg-[#fffdfa] px-4 text-sm text-[#3e2a20] placeholder:text-[#968b83] focus-visible:border-[#a45b30] focus-visible:ring-[#a45b30]/20';
export const authButtonClass =
    'h-12 w-full rounded-lg bg-[#692c14] text-sm font-semibold text-white shadow-[0_6px_18px_rgba(121,56,21,0.17)] hover:bg-[#783a1a] focus-visible:ring-[#bd835a]/30 disabled:opacity-65';
export default function AuthShell({
    eyebrow,
    title,
    description,
    children,
    showMobileIntro = false,
}: {
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
    showMobileIntro?: boolean;
}) {
    const [intro, setIntro] = useState(false);
    return (
        <div className="jr-login" data-mobile-intro={showMobileIntro && intro}>
            <div className="jr-login-frame">
                <AuthShowcase
                    expandedMobile={showMobileIntro && intro}
                    onContinue={() => {
                        setIntro(false);
                        requestAnimationFrame(() => document.getElementById('email')?.focus({ preventScroll: true }));
                    }}
                />
                <main className="jr-login-panel">
                    <div className="jr-login-secure-label flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold tracking-[.16em] text-[#586d83] uppercase">
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
                        <div className="jr-login-form-intro mb-6 space-y-2">
                            <p className="text-xs font-bold tracking-[.22em] text-[#a35a2d] uppercase">
                                {eyebrow}
                            </p>
                            <h2 className="text-[30px] font-bold tracking-[-.04em] text-[#16263a] sm:text-[34px]">
                                {title}
                            </h2>
                            <p className="text-sm leading-6 text-[#697b90]">
                                {description}
                            </p>
                        </div>
                        {children}
                        {showMobileIntro && (
                            <button type="button" className="jr-login-explore" onClick={() => {
                                setIntro(true);
                                requestAnimationFrame(() => document.getElementById('jr-login-continue')?.focus({ preventScroll: true }));
                            }}>
                                Explore JaiROADS <ArrowRight aria-hidden="true" className="size-4" />
                            </button>
                        )}
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
    );
}
