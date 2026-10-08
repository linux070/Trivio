import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, RefreshCw, Trash2 } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Trivio Uncaught React Error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('trivio_current_screen')
      sessionStorage.removeItem('trivio_current_screen')
      localStorage.removeItem('trivio_active_game')
      sessionStorage.removeItem('trivio_active_game')
      window.location.hash = ''
    } catch {
      // ignore
    }
    window.location.reload()
  }

  private handleHardReset = () => {
    try {
      localStorage.clear()
      sessionStorage.clear()
      window.location.hash = ''
    } catch {
      // ignore
    }
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'linear-gradient(160deg, #7c3aed 0%, #6d28d9 30%, #5b21b6 65%, #4c1d95 100%)',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              width: '100%',
              background: 'rgba(255, 255, 255, 0.95)',
              color: '#1e293b',
              borderRadius: '24px',
              padding: '32px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertCircle size={24} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
                  Something went wrong
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Trivio encountered an unexpected rendering error
                </p>
              </div>
            </div>

            {this.state.error && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginBottom: '20px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#b91c1c',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={this.handleReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: '14px',
                  background: '#7c3aed',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px 0 rgba(124, 58, 237, 0.4)',
                }}
              >
                <RefreshCw size={16} />
                Reload Page
              </button>

              <button
                onClick={this.handleHardReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 20px',
                  borderRadius: '14px',
                  background: 'transparent',
                  color: '#64748b',
                  fontWeight: 500,
                  fontSize: '13px',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={15} />
                Clear All Cached Data & Reset
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
