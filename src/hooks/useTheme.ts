import * as React from 'react';
import { useStore } from '@/store/store';

/** Applies the theme to <html> and keeps the meta theme-colour in sync. */
export function useTheme(): void {
  const theme = useStore((s) => s.settings.theme);
  const motion = useStore((s) => s.settings.motion);

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', theme === 'dark' ? '#080b1a' : '#f4f6fc');
  }, [theme]);

  React.useEffect(() => {
    document.documentElement.dataset.motion = motion ? 'full' : 'reduced';
  }, [motion]);
}