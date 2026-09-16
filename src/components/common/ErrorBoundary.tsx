import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Download } from 'lucide-react';
import { triggerExportDownload } from '../../utils/export';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  exporting: boolean;
  exportSuccess: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      exporting: false,
      exportSuccess: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleExport = async (): Promise<void> => {
    try {
      this.setState({ exporting: true });
      await triggerExportDownload();
      this.setState({ exporting: false, exportSuccess: true });
    } catch (err) {
      console.error('Failed to export data from error boundary:', err);
      this.setState({ exporting: false });
      alert('Could not export data. Check browser console.');
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-slate-900 dark:text-slate-100">
          <div className="max-w-xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-8">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400 mb-4">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <h1 className="text-xl font-bold">Something went wrong</h1>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              An unexpected application error occurred. You can safely export all your stored
              problems, attempts, and notes before reloading to prevent any data loss.
            </p>

            {this.state.error && (
              <div className="bg-slate-100 dark:bg-slate-800/80 rounded-lg p-3.5 mb-6 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto max-h-40 border border-slate-200 dark:border-slate-700">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>

              <button
                onClick={this.handleExport}
                disabled={this.state.exporting}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                {this.state.exporting
                  ? 'Exporting...'
                  : this.state.exportSuccess
                    ? 'Data Exported!'
                    : 'Export My Data'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
