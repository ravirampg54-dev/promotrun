import * as React from 'react';
import { Component } from 'react';
import { Button } from '@/components/ui/Button';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('₹10K crashed:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <div className="card-surface max-w-md p-6">
          <p className="text-lg font-extrabold">Something broke</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your data is saved in this browser and has not been lost. Reloading usually fixes it.
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded bg-surface-2 p-2 text-left text-[11px] text-muted-foreground">
            {this.state.error.message}
          </pre>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    );
  }
}