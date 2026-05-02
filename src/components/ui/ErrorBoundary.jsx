import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p className="text-base font-semibold text-charcoal mb-1">Something went wrong</p>
          <p className="text-sm text-charcoal/45 mb-6 max-w-xs">{this.state.error?.message ?? 'An unexpected error occurred. Please try again.'}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="text-sm bg-charcoal text-cream px-4 py-2 rounded-xl hover:bg-charcoal/80 transition-colors font-medium"
            >
              Try again
            </button>
            <a
              href="/"
              className="text-sm text-charcoal/50 hover:text-charcoal px-4 py-2 rounded-xl border border-charcoal/15 hover:border-charcoal/30 transition-colors"
            >
              Go to home
            </a>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
