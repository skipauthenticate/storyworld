import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[STORYWORLD] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="max-w-md text-center px-8">
            <h2 className="text-2xl font-bold font-serif text-primary mb-3 tracking-wide">
              Something went wrong
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              STORYWORLD encountered an unexpected error. This may be caused by a browser
              compatibility issue or a temporary glitch.
            </p>
            <pre className="text-[11px] font-mono text-destructive bg-muted/50 p-3 rounded border border-border mb-6 text-left overflow-auto max-h-32">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
