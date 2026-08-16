import { useState } from 'react'
import BrandLogo from './BrandLogo'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    if (!username || !password) {
      return
    }

    setLoading(true)
    try {
      await onLogin(username, password)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-[#F7F5F0] px-4 dark:bg-[#121212]'>
      {/* Background Decoration */}
      <div className='pointer-events-none fixed inset-0 overflow-hidden'>
        <div className='absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-champagne/[0.03] blur-3xl' />
        <div className='absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-purple-500/[0.02] blur-3xl' />
      </div>

      <div className='relative w-full max-w-md animate-scale-in'>
        {/* Logo */}
        <div className='mb-10 text-center'>
          <div className='gold-glow mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-champagne to-champagne-dark p-3 shadow-lg'>
            <BrandLogo size={40} />
          </div>
          <h1 className='text-2xl font-bold text-charcoal dark:text-grayLight'>
            AI Virtual Try-on
          </h1>
          <p className='mt-1 text-grayMuted dark:text-grayMedium'>智能虚拟试衣系统</p>
        </div>

        {/* Login Form */}
        <div className='glass-card rounded-3xl p-8'>
          <h2 className='mb-6 text-xl font-semibold text-charcoal dark:text-white'>登录账户</h2>

          <form onSubmit={handleSubmit} className='space-y-5'>
            <div>
              <label
                htmlFor='username'
                className='mb-2 block text-sm font-medium text-grayMedium dark:text-grayLight'
              >
                用户名
              </label>
              <input
                id='username'
                type='text'
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder='请输入用户名'
                className='w-full rounded-xl border border-grayLight bg-white px-4 py-3 text-charcoal placeholder-grayMuted transition-all focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/50 dark:border-gray-600 dark:bg-[#252525] dark:text-white dark:placeholder-grayMedium'
                required
              />
            </div>

            <div>
              <label
                htmlFor='password'
                className='mb-2 block text-sm font-medium text-grayMedium dark:text-grayLight'
              >
                密码
              </label>
              <input
                id='password'
                type='password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder='请输入密码'
                className='w-full rounded-xl border border-grayLight bg-white px-4 py-3 text-charcoal placeholder-grayMuted transition-all focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/50 dark:border-gray-600 dark:bg-[#252525] dark:text-white dark:placeholder-grayMedium'
                required
              />
            </div>

            <button
              type='submit'
              disabled={loading}
              className='btn-primary w-full rounded-xl px-4 py-3.5 disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50'
            >
              {loading ? (
                <span className='flex items-center justify-center gap-2'>
                  <svg className='h-5 w-5 animate-spin' fill='none' viewBox='0 0 24 24'>
                    <circle
                      className='opacity-25'
                      cx='12'
                      cy='12'
                      r='10'
                      stroke='currentColor'
                      strokeWidth='4'
                    />
                    <path
                      className='opacity-75'
                      fill='currentColor'
                      d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                    />
                  </svg>
                  登录中...
                </span>
              ) : (
                '登录'
              )}
            </button>
          </form>

          <p className='mt-6 text-center text-sm text-grayMuted dark:text-grayMedium'>
            还没有账户？
            <a href='#' className='text-champagne hover:underline'>
              联系管理员
            </a>
          </p>
        </div>

        {/* Demo Credentials */}
        <p className='mt-4 text-center text-xs text-grayMuted'>测试账号: admin / admin123</p>
      </div>
    </div>
  )
}
