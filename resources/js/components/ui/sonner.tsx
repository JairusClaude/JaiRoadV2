import { useFlashToast } from '@/hooks/use-flash-toast';
import { useAppearance } from '@/hooks/use-appearance';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster({ ...props }: ToasterProps) {
    const { appearance } = useAppearance();

    useFlashToast();

    return (
        <Sonner
            theme={appearance}
            className="toaster group"
            position="top-right"
            duration={4500}
            closeButton
            richColors
            style={
                {
                    '--normal-bg': 'var(--jr-toast-bg, var(--jr-role-accent-soft, var(--popover)))',
                    '--normal-text': 'var(--jr-toast-ink, var(--jr-role-accent-ink, var(--popover-foreground)))',
                    '--normal-border': 'var(--jr-role-accent, var(--border))',
                } as React.CSSProperties
            }
            {...props}
        />
    );
}

export { Toaster };
