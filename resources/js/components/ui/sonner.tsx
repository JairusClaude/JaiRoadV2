import { useIsPhone } from '@/hooks/use-mobile';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { useAppearance } from '@/hooks/use-appearance';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster({ ...props }: ToasterProps) {
    const { appearance } = useAppearance();
    const phone = useIsPhone();

    useFlashToast();

    return (
        <Sonner
            theme={appearance}
            className="toaster group"
            position={phone ? 'bottom-center' : 'top-center'}
            visibleToasts={phone ? 1 : 3}
            duration={3000}
            offset={76}
            mobileOffset={
                phone
                    ? {
                          bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
                          left: 16,
                          right: 16,
                      }
                    : 64
            }
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
