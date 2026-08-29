/**
 * 手机端扫码上传落地页（/scan-upload?ticket=xxx）
 * 用户用手机扫 PC 端二维码后打开此页，选图/拍照上传到指定 session 的 avatar。
 * 兼容 iOS / iPad / Android：使用 <input capture> 唤起摄像头，按钮大尺寸便于触摸。
 */
import { useEffect, useRef, useState } from 'react'

import { api } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'
import { useI18n } from '../hooks/useI18n'

import { Icon } from './ui'

// 手机原图通常很大会拖慢上传：先用 canvas 缩到最长边 1600px 并转 JPEG，
// 体积可降一个数量级；小图（<400KB）直接原样上传，避免无谓的解码开销。
const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.82
const MIN_COMPRESS_BYTES = 400 * 1024

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (file.size < MIN_COMPRESS_BYTES) {
      resolve(file)
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        blob => {
          if (blob) {
            resolve(new File([blob], 'tryon-upload.jpg', { type: 'image/jpeg' }))
          } else {
            reject(new Error('compress failed'))
          }
        },
        'image/jpeg',
        JPEG_QUALITY
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image load failed'))
    }
    img.src = url
  })
}

export default function ScanUploadPage() {
  const { t } = useI18n()
  const fileRef = useRef(null)
  const [ticket, setTicket] = useState(null)
  const [status, setStatus] = useState('idle') // idle | uploading | done | error
  const [preview, setPreview] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [ticketExpired, setTicketExpired] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tk = params.get('ticket')
    if (tk) {
      setTicket(tk)
    } else {
      setStatus('error')
      setErrorMsg(t('scanTicketMissing') || '二维码无效或已过期')
    }
  }, [t])

  const handleFile = async e => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }
    if (!ticket) {
      setStatus('error')
      setErrorMsg(t('scanTicketMissing') || '二维码无效或已过期')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg(t('fileTooLarge') || '图片大小不能超过 10MB')
      return
    }
    const previewFile = await compressImage(file)
    setPreview(URL.createObjectURL(previewFile))
    setStatus('uploading')
    setErrorMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', previewFile)
      const res = await api.uploadPublic(API_ENDPOINTS.SCAN.UPLOAD(ticket), fd)
      if (res.success) {
        setStatus('done')
      } else {
        const errText = res.error || ''
        const expired =
          /expired|过期|not found/.test(errText) || res.status === 410 || res.status === 404
        setTicketExpired(expired)
        setStatus('error')
        setErrorMsg(
          expired
            ? t('scanTicketExpired') || '二维码已过期，请在电脑端刷新二维码后重新扫码'
            : errText || t('uploadFailed') || '上传失败，请重试'
        )
      }
    } catch (err) {
      setStatus('error')
      setErrorMsg(t('uploadFailed') || '上传失败，请重试')
    }
  }

  const renderState = () => {
    if (status === 'done') {
      return (
        <div className='scan-upload-state scan-upload-done'>
          <Icon name='check' className='h-16 w-16' />
          <p className='scan-upload-title'>{t('scanUploadDone') || '上传成功'}</p>
          <p className='scan-upload-sub'>{t('scanUploadDoneHint') || '请回到电脑端查看形象'}</p>
          {preview && <img src={preview} alt='preview' className='scan-upload-preview' />}
        </div>
      )
    }
    if (status === 'error') {
      return (
        <div className='scan-upload-state scan-upload-error'>
          <Icon name='close' className='h-12 w-12' />
          <p className='scan-upload-title'>{errorMsg || t('uploadFailed')}</p>
          {ticketExpired ? (
            <p className='scan-upload-sub'>
              {t('scanTicketExpiredHint') || '请回到电脑端点击刷新二维码，重新扫码即可继续上传'}
            </p>
          ) : (
            <button type='button' className='scan-upload-btn' onClick={() => setStatus('idle')}>
              {t('retry') || '重试'}
            </button>
          )}
        </div>
      )
    }
    return (
      <>
        <p className='scan-upload-title'>{t('scanUploadPhoneTitle') || '上传形象照片'}</p>
        <p className='scan-upload-sub'>
          {t('scanUploadPhoneHint') || '拍摄或选择一张清晰的正身照片'}
        </p>

        {preview && <img src={preview} alt='preview' className='scan-upload-preview' />}

        <button
          type='button'
          className='scan-upload-btn'
          onClick={() => fileRef.current?.click()}
          disabled={status === 'uploading'}
        >
          {status === 'uploading' ? (
            <>
              <Icon name='loader' className='h-5 w-5 animate-spin' />
              {t('uploading') || '上传中…'}
            </>
          ) : (
            <>
              <Icon name='camera' className='h-5 w-5' />
              {t('takeOrPickPhoto') || '拍照 / 选择照片'}
            </>
          )}
        </button>

        {/* 相册选择 / 拍照（移动端 accept=image/* 已包含拍照选项） */}
        <input
          ref={fileRef}
          type='file'
          accept='image/*'
          onChange={handleFile}
          className='hidden'
        />
      </>
    )
  }

  return (
    <div className='scan-upload-page'>
      <div className='scan-upload-card'>
        <div className='scan-upload-logo'>
          <Icon name='sparkle' className='h-6 w-6' />
          <span>{t('appName') || 'AI 试衣'}</span>
        </div>

        {renderState()}
      </div>
    </div>
  )
}
