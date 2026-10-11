import { Toaster as SonnerToaster } from 'sonner';
import { useStore } from '@/store/store';

export function Toaster() {
  const theme = useStore((s) => s.settings.theme);
  return (
    <SonnerToaster
      theme={theme}
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            'group rounded-xl border border-border bg-card text-card-foreground shadow-card text-sm',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground rounded-md px-2 h-8 text-xs font-semibold',
          cancelButton: 'bg-surface-2 text-muted-foreground rounded-md px-2 h-8 text-xs',
        },
      }}
    />
  );
}