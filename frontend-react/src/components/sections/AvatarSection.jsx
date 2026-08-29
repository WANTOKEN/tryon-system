import { useRef, useCallback, useState } from 'react'

import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'

import CachedImage from '../CachedImage'
import { Icon } from '../ui'
import { api } from '../../utils/request'
import { API_ENDPOINTS } from '../../config/api'

export default function AvatarSection({
  avatarPreview = null,
  onAvatarChange,
  onOpenPreviewModal,
  onShowModelModal,
  onSetAvatarPreview,
  sessionId = null,
  t,
  showToast = null,
}) {
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const [showScan, setShowScan] = useState(false)
  // 扫码上传状态：qrSvg(二维码) / ticketId / polling / uploaded / error
  const [qrSvg, setQrSvg] = useState(null)
  const [_ticketId, setTicketId] = useState(null)
  const [scanPolling, setScanPolling] = useState(false)
  const [scanDone, setScanDone] = useState(false)
  const [scanError, setScanError] = useState(null)
  const pollTimer = useRef(null)

  const handleAvatarFileChange = useCallback(
    e => {
      const file = e.target.files?.[0]
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          showToast?.('图片大小不能超过 10MB', 'warning')
          return
        }
        onAvatarChange(e)
      }
    },
    [onAvatarChange, showToast]
  )

  // 轮询 ticket 状态，手机端上传完成后自动刷新形象
  const startPolling = useCallback(
    tid => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current)
      }
      setScanPolling(true)
      pollTimer.current = setInterval(async () => {
        try {
          const res = await api.get(API_ENDPOINTS.SCAN.STATUS(tid))
          if (res.success && res.data?.uploaded) {
            clearInterval(pollTimer.current)
            pollTimer.current = null
            setScanPolling(false)
            setScanDone(true)
            if (res.data.image_url) {
              onSetAvatarPreview?.(res.data.image_url)
            }
            setTimeout(() => setShowScan(false), 1200)
          } else if (res.status === 404 || res.status === 410) {
            // 票据失效（404 not found 通常因后端重启/多进程，410 已过期）。
            // 继续轮询只会永久空转刷屏，停止并提示用户重新扫码。
            clearInterval(pollTimer.current)
            pollTimer.current = null
            setScanPolling(false)
            setScanError(t('scanTicketExpired') || '二维码已失效，请重新生成')
          }
        } catch {
          // 网络/超时异常：静默重试保持当前轮询
        }
      }, 2000)
    },
    [onSetAvatarPreview, t]
  )

  // 打开扫码上传：向后端申请 ticket + 二维码，并启动轮询
  const openScan = useCallback(async () => {
    setScanError(null)
    setScanDone(false)
    setQrSvg(null)
    setTicketId(null)
    try {
      const res = await api.post(API_ENDPOINTS.SCAN.CREATE, {
        session_id: sessionId || '',
      })
      if (res.success && res.data) {
        setQrSvg(res.data.qr_svg)
        setTicketId(res.data.ticket_id)
        setShowScan(true)
        startPolling(res.data.ticket_id)
      } else {
        setScanError(res.error || t('scanCreateFailed') || '生成二维码失败')
      }
    } catch (err) {
      setScanError(t('scanCreateFailed') || '生成二维码失败，请稍后重试')
    }
  }, [sessionId, t, startPolling])

  const closeScan = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
    setScanPolling(false)
    setShowScan(false)
  }, [])

  let scanContent
  if (scanError) {
    scanContent = (
      <div className='scan-state scan-state-error'>
        {scanError}
        <button type='button' className='scan-refresh-btn' onClick={openScan}>
          {t('refreshQr') || '刷新二维码'}
        </button>
      </div>
    )
  } else if (scanDone) {
    scanContent = (
      <div className='scan-state scan-state-done'>
        <Icon name='check' className='h-10 w-10' />
        <span>{t('scanUploadDone') || '上传成功，已更新形象'}</span>
        <p className='scan-modal-note'>{t('scanUploadDoneHint') || '窗口将自动关闭'}</p>
      </div>
    )
  } else {
    scanContent = (
      <div className='scan-qr-wrap'>
        <div className='scan-qr'>
          {qrSvg ? (
            <img src={qrSvg} alt='scan qr' className='scan-qr-img' />
          ) : (
            <div className='scan-loading'>
              <Icon name='loader' className='h-8 w-8 animate-spin' />
            </div>
          )}
        </div>
        <p className='scan-modal-hint'>
          {t('scanUploadHint') || '用手机扫描二维码，在手机端选择照片即可上传到当前形象'}
        </p>
        {scanPolling && (
          <p className='scan-modal-note'>{t('scanUploadPolling') || '正在等待手机端上传…'}</p>
        )}
      </div>
    )
  }

  return (
    <div className='sidebar-section'>
      <div className='sidebar-section-title'>{t('myProfile')}</div>

      {/* 已选形象预览 */}
      <div className='avatar-section-simple'>
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className={`avatar-upload-simple ${avatarPreview ? 'has-image' : 'empty'}`}
          onClick={() => !avatarPreview && fileInputRef.current?.click()}
          role={avatarPreview ? undefined : 'button'}
          tabIndex={avatarPreview ? undefined : 0}
          onKeyDown={e => {
            if (!avatarPreview && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          aria-label={avatarPreview ? undefined : t('aria_upload_avatar')}
        >
          {avatarPreview ? (
            <>
              <CachedImage
                src={avatarPreview}
                alt={t('aria_user_photo')}
                className='avatar-img-simple'
              />
              <div className='avatar-actions-simple'>
                <button
                  type='button'
                  className='avatar-action-simple'
                  onClick={e => {
                    e.stopPropagation()
                    onOpenPreviewModal(avatarPreview, t('myProfile'))
                  }}
                  title={t('preview')}
                >
                  <Icon name='search' className='h-3.5 w-3.5' />
                </button>
                <button
                  type='button'
                  className='avatar-action-simple'
                  onClick={e => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  title={t('change')}
                >
                  <Icon name='refresh' className='h-3.5 w-3.5' />
                </button>
                <button
                  type='button'
                  className='avatar-action-simple'
                  onClick={e => {
                    e.stopPropagation()
                    onAvatarChange?.({ target: { files: null } })
                  }}
                  title={t('delete')}
                >
                  <Icon name='trash' className='h-3.5 w-3.5' />
                </button>
              </div>
            </>
          ) : (
            <>
              <Icon name='user' className='h-8 w-8' strokeWidth={1.5} />
              <span className='text-sm'>{t('notUploaded') || '尚未上传形象'}</span>
            </>
          )}
        </div>
      </div>

      {/* 三个上传入口 */}
      <div className='avatar-entries'>
        <button
          type='button'
          className='avatar-entry'
          onClick={() => cameraInputRef.current?.click()}
        >
          <Icon name='camera' className='h-4 w-4' />
          <span>{t('avatarEntryTakePhoto') || '拍照上传'}</span>
        </button>
        <button type='button' className='avatar-entry' onClick={openScan}>
          <Icon name='qr' className='h-4 w-4' />
          <span>{t('avatarEntryScan') || '扫码上传'}</span>
        </button>
        <button type='button' className='avatar-entry' onClick={onShowModelModal}>
          <Icon name='user' className='h-4 w-4' />
          <span>{t('avatarEntryModel') || '使用模特'}</span>
        </button>
      </div>

      {/* 扫码上传弹窗（portal 到 body；遮罩背景与弹窗为兄弟，避免父级 z-index 盖住按钮） */}
      {showScan &&
        createPortal(
          <>
            <div
              className='scan-overlay'
              onClick={closeScan}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  closeScan()
                }
              }}
              role='button'
              tabIndex={-1}
              aria-label={t('close') || '关闭'}
            />
            <div
              className='scan-modal'
              onClick={e => e.stopPropagation()}
              onKeyDown={e => e.stopPropagation()}
              role='presentation'
              tabIndex={-1}
            >
              <div className='scan-modal-inner'>
                <button
                  type='button'
                  className='scan-modal-close'
                  onClick={e => {
                    e.stopPropagation()
                    closeScan()
                  }}
                  aria-label={t('close') || '关闭'}
                >
                  <Icon name='close' className='h-4 w-4' />
                </button>
                <div className='scan-modal-title'>{t('scanUploadTitle') || '扫码上传形象'}</div>

                {scanContent}
              </div>
            </div>
          </>,
          document.body
        )}

      {/* 文件选择（相册） */}
      <input
        ref={fileInputRef}
        type='file'
        accept='image/*'
        onChange={handleAvatarFileChange}
        className='hidden'
      />
      {/* 拍照（调用摄像头） */}
      <input
        ref={cameraInputRef}
        type='file'
        accept='image/*'
        capture='environment'
        onChange={handleAvatarFileChange}
        className='hidden'
      />
    </div>
  )
}

AvatarSection.propTypes = {
  avatarPreview: PropTypes.string,
  onAvatarChange: PropTypes.func.isRequired,
  onOpenPreviewModal: PropTypes.func.isRequired,
  onShowModelModal: PropTypes.func.isRequired,
  onSetAvatarPreview: PropTypes.func,
  sessionId: PropTypes.string,
  t: PropTypes.func.isRequired,
  showToast: PropTypes.func,
}
