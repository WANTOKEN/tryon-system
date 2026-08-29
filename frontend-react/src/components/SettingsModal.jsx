import { useEffect, useState } from 'react'

import PropTypes from 'prop-types'

import { useI18n } from '../hooks/useI18n'
import { api } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'

import { Icon } from './ui'

/**
 * 设置弹窗
 *
 * 内容包含：
 *  1. 门店信息（商户信息统一在此：店名/联系方式需密码解锁；未登录显示登录；含"查看门店详情"入口）
 *  2. 当前顾客信息（sessionCustomer，从 Header 同步过来）
 *  3. 结束试穿（一键清空所有试穿数据）
 *  4. 退出登录（仅已登录时显示）
 *
 * 所有交互通过 props 由父组件提供，确保本组件无业务依赖、可复用。
 */
export default function SettingsModal({
  open = false,
  isLoggedIn = false,
  userInfo = null,
  sessionCustomer = '',
  onClose,
  onLogin,
  onLogout,
  onOpenStoreInfo,
  onEndSession,
}) {
  const { t } = useI18n()
  // 商户敏感信息默认遮蔽，需输入密码解锁
  const [revealMerchant, setRevealMerchant] = useState(false)
  const [showPwdInput, setShowPwdInput] = useState(false)
  const [pwd, setPwd] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [verifying, setVerifying] = useState(false)

  // Esc 键关闭
  useEffect(() => {
    if (!open) {
      return undefined
    }
    const handler = e => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // 每次打开时重置遮蔽与解锁状态
  useEffect(() => {
    if (open) {
      setRevealMerchant(false)
      setShowPwdInput(false)
      setPwd('')
      setPwdError('')
    }
  }, [open])

  if (!open) {
    return null
  }

  // 顾客尾号：Customer_20260816_123045 -> 取时间部分后 6 位
  const customerTail =
    sessionCustomer && sessionCustomer.includes('_')
      ? sessionCustomer.split('_').slice(1).join('_').slice(-6)
      : (sessionCustomer || '').slice(-6)

  const maskText = value => {
    if (!value) {
      return ''
    }
    if (value.length <= 2) {
      return value
    }
    return (
      value.charAt(0) + '*'.repeat(Math.min(value.length - 2, 6)) + value.charAt(value.length - 1)
    )
  }

  const handleLoginClick = () => {
    onClose?.()
    onLogin?.()
  }

  const handleLogoutClick = () => {
    onClose?.()
    onLogout?.()
  }

  const handleStoreClick = () => {
    onClose?.()
    onOpenStoreInfo?.()
  }

  const handleEndSessionClick = () => {
    onClose?.()
    onEndSession?.()
  }

  // 点击「显示」→ 展开密码输入
  const handleRevealClick = () => {
    setShowPwdInput(true)
    setPwdError('')
  }

  // 提交密码校验
  const handleUnlock = async () => {
    if (!pwd) {
      setPwdError(t('settingsEnterPassword') || '请输入密码')
      return
    }
    setVerifying(true)
    setPwdError('')
    try {
      const res = await api.post(API_ENDPOINTS.AUTH.VERIFY_PASSWORD, { password: pwd })
      if (res.success && res.data?.valid) {
        setRevealMerchant(true)
        setShowPwdInput(false)
        setPwd('')
      } else {
        setPwdError(t('settingsWrongPassword') || '密码错误')
      }
    } catch {
      setPwdError(t('settingsWrongPassword') || '密码错误')
    } finally {
      setVerifying(false)
    }
  }

  const handleCancelPwd = () => {
    setShowPwdInput(false)
    setPwd('')
    setPwdError('')
  }

  return (
    <div
      className='fixed inset-0 z-[var(--z-modal-1)] flex items-center justify-center p-4'
      role='dialog'
      aria-modal='true'
      aria-label={t('settingsTitle')}
    >
      {/* 遮罩 */}
      <div
        className='absolute inset-0 bg-black/40 backdrop-blur-sm'
        onClick={onClose}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            onClose()
          }
        }}
        role='button'
        tabIndex={-1}
        aria-label={t('settingsClose')}
      />
      {/* 弹窗主体 */}
      <div className='modal-surface relative w-full max-w-md animate-scale-in overflow-hidden rounded-2xl shadow-2xl'>
        <div className='flex items-center justify-between bg-gradient-to-r from-[var(--header-bg-1)] to-[var(--header-bg-2)] px-6 py-4'>
          <h2 className='text-lg font-semibold text-white'>{t('settingsTitle')}</h2>
          <button
            type='button'
            onClick={onClose}
            className='rounded-lg p-1.5 transition-colors hover:bg-white/10'
            aria-label={t('settingsClose')}
          >
            <svg
              className='h-5 w-5 text-white/70'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>

        <div className='space-y-5 px-6 py-5'>
          {/* 当前顾客信息（放在首位展示） */}
          {sessionCustomer && (
            <section>
              <div className='mb-3 flex items-center gap-2'>
                <span className='flex h-5 w-5 items-center justify-center text-[var(--accent)]'>
                  <Icon name='users' className='h-5 w-5' />
                </span>
                <span className='text-sm font-semibold text-[var(--text)]'>
                  {t('settingsCustomerInfo')}
                </span>
                <span className='ml-auto rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-0.5 font-mono text-xs font-medium text-[var(--text)]'>
                  #{customerTail}
                </span>
              </div>
              <div className='rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3'>
                <div className='flex items-center justify-between'>
                  <p className='text-xs text-[var(--text-muted)]'>{t('settingsCustomerTail')}</p>
                  <p className='font-mono text-sm font-medium text-[var(--text)]'>{customerTail}</p>
                </div>
                <div className='mt-2 flex items-center justify-between gap-3'>
                  <p className='shrink-0 text-xs text-[var(--text-muted)]'>
                    {t('settingsCustomerId')}
                  </p>
                  <p className='break-all text-right text-xs text-[var(--text-muted)]'>
                    {sessionCustomer}
                  </p>
                </div>
              </div>
            </section>
          )}

          <div className='border-t border-[var(--border-primary)]' />

          {/* 门店信息（商户信息统一在此，含密码解锁） */}
          <section>
            <div className='mb-3 flex items-center gap-2'>
              <span className='flex h-5 w-5 items-center justify-center text-[var(--accent)]'>
                <Icon name='store' className='h-5 w-5' />
              </span>
              <span className='text-sm font-semibold text-[var(--text)]'>
                {t('settingsStoreInfo')}
              </span>
            </div>

            {isLoggedIn ? (
              <div className='rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3'>
                <div className='flex items-center gap-3'>
                  <div className='flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--bg-card)]'>
                    <Icon name='store' className='h-5 w-5 text-[var(--accent)]' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium text-[var(--text)]'>
                      {revealMerchant
                        ? userInfo?.store_name || t('settingsMerchantAccount')
                        : maskText(userInfo?.store_name) || t('settingsMerchantMasked')}
                    </p>
                    <p className='mt-0.5 truncate text-xs text-[var(--text-muted)]'>
                      {revealMerchant
                        ? userInfo?.phone || t('settingsLoggedIn')
                        : maskText(userInfo?.phone) || t('settingsContactHidden')}
                    </p>
                  </div>
                  {!revealMerchant && !showPwdInput && (
                    <button
                      type='button'
                      onClick={handleRevealClick}
                      className='text-xs font-medium text-[var(--accent)] hover:opacity-80'
                    >
                      {t('settingsReveal')}
                    </button>
                  )}
                  {revealMerchant && (
                    <button
                      type='button'
                      onClick={() => setRevealMerchant(false)}
                      className='text-xs font-medium text-[var(--accent)] hover:opacity-80'
                    >
                      {t('settingsHide')}
                    </button>
                  )}
                </div>

                {/* 密码解锁区 */}
                {showPwdInput && !revealMerchant && (
                  <div className='mt-3 border-t border-[var(--border-primary)] pt-3'>
                    <p className='mb-2 text-xs text-[var(--text-muted)]'>
                      {t('settingsUnlockTip') || '输入登录密码以查看商户信息'}
                    </p>
                    <div className='flex gap-2'>
                      <input
                        type='password'
                        value={pwd}
                        onChange={e => setPwd(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            handleUnlock()
                          }
                        }}
                        placeholder={t('settingsEnterPassword') || '请输入密码'}
                        className='flex-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'
                      />
                      <button
                        type='button'
                        onClick={handleUnlock}
                        disabled={verifying}
                        className='rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50'
                      >
                        {verifying
                          ? t('settingsUnlocking') || '验证中…'
                          : t('settingsUnlock') || '解锁'}
                      </button>
                      <button
                        type='button'
                        onClick={handleCancelPwd}
                        className='rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--border-secondary)]'
                      >
                        {t('settingsCancel') || '取消'}
                      </button>
                    </div>
                    {pwdError && <p className='mt-1.5 text-xs text-[var(--error)]'>{pwdError}</p>}
                  </div>
                )}

                {/* 查看门店详情入口 */}
                <button
                  type='button'
                  onClick={handleStoreClick}
                  className='mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border-primary)] py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--border-secondary)]'
                >
                  {t('settingsStoreDetail') || '查看门店详情'}
                  <Icon name='chevronRight' className='h-3.5 w-3.5' />
                </button>
              </div>
            ) : (
              <div>
                <p className='mb-2 text-xs text-[var(--text-muted)]'>{t('settingsLoginHint')}</p>
                <button
                  type='button'
                  onClick={handleLoginClick}
                  className='w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90'
                >
                  {t('settingsLoginBtn')}
                </button>
              </div>
            )}
          </section>

          <div className='border-t border-[var(--border-primary)]' />

          {/* 结束试穿 */}
          <button
            type='button'
            onClick={handleEndSessionClick}
            className='modal-list-item-danger flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors'
          >
            <div className='flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--bg-card)]'>
              <Icon name='logout' className='h-4 w-4 text-[var(--error)]' />
            </div>
            <div className='flex-1'>
              <p className='text-sm font-medium text-[var(--error)]'>{t('settingsEndSession')}</p>
              <p className='text-xs text-[var(--text-muted)]'>{t('settingsEndHint')}</p>
            </div>
            <Icon name='chevronRight' className='h-4 w-4 text-[var(--text-muted)]' />
          </button>

          {/* 退出登录 */}
          {isLoggedIn && (
            <section>
              <div className='mb-3 flex items-center gap-2'>
                <span className='flex h-5 w-5 items-center justify-center text-[var(--accent)]'>
                  <Icon name='logout' className='h-5 w-5' />
                </span>
                <span className='text-sm font-semibold text-[var(--text)]'>
                  {t('settingsLogoutSection')}
                </span>
              </div>
              <p className='mb-2 text-xs text-[var(--text-muted)]'>{t('settingsLogoutHint')}</p>
              <button
                type='button'
                onClick={handleLogoutClick}
                className='w-full rounded-xl border border-[var(--border-primary)] py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--border-secondary)]'
              >
                {t('settingsLogoutBtn')}
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

SettingsModal.propTypes = {
  open: PropTypes.bool,
  isLoggedIn: PropTypes.bool,
  userInfo: PropTypes.object,
  sessionCustomer: PropTypes.string,
  onClose: PropTypes.func,
  onLogin: PropTypes.func,
  onLogout: PropTypes.func,
  onOpenStoreInfo: PropTypes.func,
  onEndSession: PropTypes.func,
}
