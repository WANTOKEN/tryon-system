import { useState, useEffect } from 'react'

export default function LoginModal({ 
  isOpen, 
  onClose, 
  onLogin, 
  onSmsLogin, 
  onSendSms,
  loading = false 
}) {
  const [tab, setTab] = useState('password') // 'password' | 'sms'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [countdown, setCountdown] = useState(0)

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // 重置表单
  useEffect(() => {
    if (!isOpen) {
      setUsername('')
      setPassword('')
      setPhone('')
      setSmsCode('')
      setCountdown(0)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handlePasswordLogin = (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    onLogin(username.trim(), password)
  }

  const handleSmsLogin = (e) => {
    e.preventDefault()
    if (!phone.trim() || !smsCode.trim()) return
    onSmsLogin(phone.trim(), smsCode)
  }

  const handleSendSms = async () => {
    if (countdown > 0 || !phone.trim()) return
    const success = await onSendSms(phone.trim())
    if (success) {
      setCountdown(60)
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[90] flex items-center justify-center p-4" 
      role="dialog" 
      aria-modal="true"
    >
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1A1A1A] to-[#2A2A2A] px-6 py-6 text-center">
          <div className="w-14 h-14 rounded-full bg-champagne/20 border-2 border-champagne/40 flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-champagne" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">商家登录</h2>
          <p className="text-xs text-gray-400 mt-1">登录后即可使用 AI 试穿功能</p>
        </div>

        {/* Tab 切换 */}
        <div className="px-6 pt-5">
          <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === 'password'
                  ? 'bg-white text-charcoal shadow-sm'
                  : 'text-grayMuted hover:text-charcoal'
              }`}
              onClick={() => setTab('password')}
            >
              账号密码
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === 'sms'
                  ? 'bg-white text-charcoal shadow-sm'
                  : 'text-grayMuted hover:text-charcoal'
              }`}
              onClick={() => setTab('sms')}
            >
              手机验证码
            </button>
          </div>

          {/* 账号密码表单 */}
          {tab === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-charcoal mb-1.5 block">账号</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-grayLight rounded-xl focus:outline-none focus:border-champagne focus:ring-2 focus:ring-champagne/20 transition-all placeholder:text-grayMuted/60"
                  placeholder="用户名/手机号"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-charcoal mb-1.5 block">密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-grayLight rounded-xl focus:outline-none focus:border-champagne focus:ring-2 focus:ring-champagne/20 transition-all placeholder:text-grayMuted/60"
                  placeholder="输入密码"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !username.trim() || !password.trim()}
                className="w-full mt-4 py-3 bg-charcoal text-white text-sm font-semibold rounded-xl hover:bg-charcoal/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    登录中...
                  </>
                ) : '登录'}
              </button>
            </form>
          )}

          {/* 短信验证码表单 */}
          {tab === 'sms' && (
            <form onSubmit={handleSmsLogin} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-charcoal mb-1.5 block">手机号</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-grayLight rounded-xl focus:outline-none focus:border-champagne focus:ring-2 focus:ring-champagne/20 transition-all placeholder:text-grayMuted/60"
                  placeholder="输入手机号"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-charcoal mb-1.5 block">验证码</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                    maxLength={6}
                    className="flex-1 px-3 py-2.5 text-sm border border-grayLight rounded-xl focus:outline-none focus:border-champagne focus:ring-2 focus:ring-champagne/20 transition-all placeholder:text-grayMuted/60"
                    placeholder="输入验证码"
                  />
                  <button
                    type="button"
                    onClick={handleSendSms}
                    disabled={countdown > 0 || !phone.trim()}
                    className="px-4 py-2.5 text-sm font-medium text-champagne border border-champagne/30 rounded-xl hover:bg-champagne/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !phone.trim() || !smsCode.trim()}
                className="w-full mt-4 py-3 bg-charcoal text-white text-sm font-semibold rounded-xl hover:bg-charcoal/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    登录中...
                  </>
                ) : '登录'}
              </button>
            </form>
          )}

          {/* 取消按钮 */}
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-3 py-2 text-sm text-grayMuted hover:text-charcoal transition-colors"
          >
            取消
          </button>

          {/* 测试账号提示 */}
          <p className="mt-4 text-center text-xs text-grayMuted">
            测试账号: admin / admin123
          </p>
        </div>
      </div>
    </div>
  )
}
