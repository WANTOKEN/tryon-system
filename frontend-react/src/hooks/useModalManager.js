import { useState, useCallback } from 'react'

/**
 * 全局弹窗状态管理 Hook
 * 集中管理所有弹窗的开关状态，避免 App.jsx 中散落大量 showXxxModal state
 */
export function useModalManager() {
  // === 弹窗可见性状态 ===
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showStoreModal, setShowStoreModal] = useState(false)
  const [showWardrobeModal, setShowWardrobeModal] = useState(false)
  const [showCustomUploadModal, setShowCustomUploadModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showCameraModal, setShowCameraModal] = useState(false)
  const [showAdminContactModal, setShowAdminContactModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  // === 弹窗附加数据 ===
  const [confirmConfig, setConfirmConfig] = useState({ title: '', message: '', action: null })
  const [previewModalData, setPreviewModalData] = useState({ src: '', name: '', clothing: [] })
  const [cameraCallback, setCameraCallback] = useState(null)
  // 预览弹窗搭配区的"替换"按钮 → 请求 MainLayout 打开服装库并预筛对应类别
  const [replaceRequest, setReplaceRequest] = useState(null)

  // === 衣橱上传表单状态 ===
  const [wardrobeUploadCategory, setWardrobeUploadCategory] = useState('tops')
  const [wardrobeUploadName, setWardrobeUploadName] = useState('')
  const [wardrobeUploadColor, setWardrobeUploadColor] = useState('黑色')

  // === 自定义上传表单状态 ===
  const [customUploadCategory, setCustomUploadCategory] = useState('tops')
  const [customUploadName, setCustomUploadName] = useState('')
  const [customUploadColor, setCustomUploadColor] = useState('黑色')

  // === 确认对话框 ===
  const showConfirmDialog = useCallback((title, message, action) => {
    setConfirmConfig({ title, message, action })
    setShowConfirmModal(true)
  }, [])

  const handleConfirmAction = useCallback(() => {
    if (confirmConfig.action) {
      confirmConfig.action()
    }
    setShowConfirmModal(false)
    setConfirmConfig({ title: '', message: '', action: null })
  }, [confirmConfig])

  // === 图片预览弹窗 ===
  const openPreviewModal = useCallback((src, name, clothing = [], actions = []) => {
    setPreviewModalData({ src, name, clothing, actions })
    setShowPreviewModal(true)
  }, [])

  const closePreviewModal = useCallback(() => {
    setShowPreviewModal(false)
    setPreviewModalData({ src: '', name: '', clothing: [] })
  }, [])

  // === 相机弹窗 ===
  const openCameraModal = useCallback(callback => {
    setCameraCallback(() => callback)
    setShowCameraModal(true)
  }, [])

  const closeCameraModal = useCallback(() => {
    setShowCameraModal(false)
    setCameraCallback(null)
  }, [])

  // === 自定义上传弹窗（带分类预设） ===
  const openCustomUploadModal = useCallback((category = 'tops') => {
    setCustomUploadCategory(category)
    setShowCustomUploadModal(true)
  }, [])

  return {
    // 弹窗可见性
    showLoginModal,
    setShowLoginModal,
    showSettingsModal,
    setShowSettingsModal,
    showStoreModal,
    setShowStoreModal,
    showWardrobeModal,
    setShowWardrobeModal,
    showCustomUploadModal,
    setShowCustomUploadModal,
    showConfirmModal,
    setShowConfirmModal,
    showPreviewModal,
    setShowPreviewModal,
    showCameraModal,
    setShowCameraModal,
    showAdminContactModal,
    setShowAdminContactModal,
    showHistoryModal,
    setShowHistoryModal,

    // 弹窗数据
    confirmConfig,
    setConfirmConfig,
    previewModalData,
    setPreviewModalData,
    cameraCallback,
    setCameraCallback,
    replaceRequest,
    setReplaceRequest,

    // 衣橱上传表单
    wardrobeUploadCategory,
    setWardrobeUploadCategory,
    wardrobeUploadName,
    setWardrobeUploadName,
    wardrobeUploadColor,
    setWardrobeUploadColor,

    // 自定义上传表单
    customUploadCategory,
    setCustomUploadCategory,
    customUploadName,
    setCustomUploadName,
    customUploadColor,
    setCustomUploadColor,

    // 操作方法
    showConfirmDialog,
    handleConfirmAction,
    openPreviewModal,
    closePreviewModal,
    openCameraModal,
    closeCameraModal,
    openCustomUploadModal,
  }
}
