import { Component } from 'react'

import PropTypes from 'prop-types'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    const { hasError, error } = this.state
    const { fallback, children } = this.props

    if (hasError) {
      if (fallback) {
        return fallback(error, this.handleReset)
      }

      return (
        <div className='flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-primary)] p-8 text-center'>
          <div className='text-5xl'>😵</div>
          <h2 className='text-xl font-semibold text-[var(--text)]'>页面出错了</h2>
          <p className='text-sm text-[var(--text-muted)]'>请刷新页面或点击下方按钮重试</p>
          <button
            type='button'
            onClick={this.handleReset}
            className='rounded-lg bg-[var(--accent)] px-6 py-2 text-sm font-medium text-white transition hover:opacity-90'
          >
            重试
          </button>
        </div>
      )
    }

    return children
  }
}

ErrorBoundary.propTypes = {
  fallback: PropTypes.func,
  children: PropTypes.node,
}
