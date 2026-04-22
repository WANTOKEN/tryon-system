import { useState } from 'react'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password) return

    setLoading(true)
    try {
      await onLogin(username, password)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F5F0] dark:bg-[#121212] px-4">
      {/* Background Decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-champagne/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/[0.02] rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-champagne to-champagne-dark flex items-center justify-center shadow-lg gold-glow">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-charcoal dark:text-grayLight">AI Virtual Try-on</h1>
          <p className="text-grayMuted dark:text-grayMedium mt-1">智能虚拟试衣系统</p>
        </div>

        {/* Login Form */}
        <div className="glass-card rounded-3xl p-8">
          <h2 className="text-xl font-semibold text-charcoal dark:text-white mb-6">登录账户</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-grayMedium dark:text-grayLight mb-2">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="w-full px-4 py-3 rounded-xl border border-grayLight dark:border-gray-600 bg-white dark:bg-[#252525] text-charcoal dark:text-white placeholder-grayMuted dark:placeholder-grayMedium focus:outline-none focus:ring-2 focus:ring-champagne/50 focus:border-champagne transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-grayMedium dark:text-grayLight mb-2">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-4 py-3 rounded-xl border border-grayLight dark:border-gray-600 bg-white dark:bg-[#252525] text-charcoal dark:text-white placeholder-grayMuted dark:placeholder-grayMedium focus:outline-none focus:ring-2 focus:ring-champagne/50 focus:border-champagne transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  登录中...
                </span>
              ) : (
                '登录'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-grayMuted dark:text-grayMedium">
            还没有账户？<a href="#" className="text-champagne hover:underline">联系管理员</a>
          </p>
        </div>

        {/* Demo Credentials */}
        <p className="mt-4 text-center text-xs text-grayMuted">
          测试账号: admin / admin123
        </p>
      </div>
    </div>
  )
}
