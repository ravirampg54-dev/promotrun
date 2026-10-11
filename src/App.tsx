import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/Toaster';
import { useTheme } from './hooks/useTheme';
import { useNotificationSync } from './store/selectors';
import { useDerived } from './store/selectors';

function ThemeBridge() {
  useTheme();
  const derived = useDerived();
  useNotificationSync(derived);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeBridge />
        <ConfirmProvider>
          <AppRoutes />
        </ConfirmProvider>
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  );
}