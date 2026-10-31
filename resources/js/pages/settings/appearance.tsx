import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { useAppearance } from '@/hooks/use-appearance';
import type { Appearance } from '@/hooks/use-appearance';
const modes: {
    value: Appearance;
    label: string;
    description: string;
    icon: typeof Sun;
}[] = [
    {
        value: 'light',
        label: 'Light',
        description: 'Always use the light interface',
        icon: Sun,
    },
    {
        value: 'dark',
        label: 'Dark',
        description: 'Use the dark interface',
        icon: Moon,
    },
    {
        value: 'system',
        label: 'System',
        description: 'Match your device',
        icon: Monitor,
    },
];
export default function Appearance() {
    const { appearance, updateAppearance } = useAppearance();

    return (
        <ProjectWorkspace>
            <Head title="Appearance · JaiROADS" />
            <div className="jr-settings mx-auto max-w-4xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Appearance
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Customize the appearance of JaiROADS on this device.
                        </p>
                    </div>
                    <Link
                        href="/settings-preview"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200"
                    >
                        <ArrowLeft className="size-4" />
                        Back to Settings
                    </Link>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center gap-3 border-b border-slate-200 pb-5 dark:border-slate-700">
                        <Palette className="size-5 text-amber-700" />
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Color theme
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Applied immediately and stored on this device.
                            </p>
                        </div>
                    </div>
                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                        {modes.map(
                            ({ value, label, description, icon: Icon }) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={appearance === value}
                                    onClick={() => updateAppearance(value)}
                                    className={`rounded-xl border p-5 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-amber-600 ${appearance === value ? 'border-amber-600 bg-amber-50 dark:bg-amber-950' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}
                                >
                                    <Icon className="size-6 text-slate-700 dark:text-slate-200" />
                                    <span className="mt-4 block font-semibold text-slate-900 dark:text-white">
                                        {label}{' '}
                                        {appearance === value ? '✓' : ''}
                                    </span>
                                    <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                                        {description}
                                    </span>
                                </button>
                            ),
                        )}
                    </div>
                </div>
            </div>
        </ProjectWorkspace>
    );
}
