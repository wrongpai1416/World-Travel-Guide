import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          padding: '2rem',
          color: '#ff6b6b',
          background: '#1a1a2e',
          minHeight: '100vh',
          fontFamily: 'monospace',
        }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={20} /> 渲染出错</h2>
          <pre style={{
            whiteSpace: 'pre-wrap',
            background: '#0d0d1a',
            padding: '1rem',
            borderRadius: '8px',
            fontSize: 'var(--font-size-md)',
            overflow: 'auto',
            maxHeight: '60vh',
          }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); }}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1.5rem',
              background: '#4a6fa5',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
