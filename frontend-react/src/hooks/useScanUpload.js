import { useEffect, useRef, useState, useCallback } from 'react'

import { api } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'

/**
 * 扫码上传形象：申请 ticket + 二维码，并轮询手机端上传状态。
 * 复用同一套逻辑，供侧边栏 AvatarSection 与形象来源弹窗共用。
 */
export default function useScanUpload({
  sessionId = null,
  onUploaded,
  showToast: _showToast = null,
  t,
}) {
  const [showScan, setShowScan] = useState(false)
  const [qrSvg, setQrSvg] = useState(null)
  const [ticketId, setTicketId] = useState(null)
  const [scanPolling, setScanPolling] = useState(false)
  const [scanDone, setScanDone] = useState(false)
  const [scanError, setScanError] = useState(null)
  const pollTimer = useRef(null)

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
              onUploaded?.(res.data.image_url)
            }
            setTimeout(() => setShowScan(false), 1200)
          } else if (res.status === 404 || res.status === 410) {
            // 票据过期/不存在，停止轮询并提示
            clearInterval(pollTimer.current)
            pollTimer.current = null
            setScanPolling(false)
            setScanError(t('scanTicketExpired') || '二维码已过期，请重新生成')
          }
        } catch {
          // 网络错误：静默重试
        }
      }, 2000)
    },
    [onUploaded, t]
  )

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
        setScanError(res.message || t('scanCreateFailed') || '生成二维码失败')
      }
    } catch {
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

  // 组件卸载时清理轮询，避免内存泄漏与对已卸载组件 setState
  useEffect(() => {
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current)
        pollTimer.current = null
      }
    }
  }, [])

  return {
    showScan,
    qrSvg,
    ticketId,
    scanPolling,
    scanDone,
    scanError,
    openScan,
    closeScan,
  }
}
