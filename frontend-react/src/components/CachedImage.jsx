import { useState, useEffect, useRef, memo } from 'react'

// 内存缓存：存储已加载的图片 URL
const imageCache = new Map()

/**
 * 预加载图片
 */
export function preloadImage(src) {
  return new Promise((resolve, reject) => {
    if (imageCache.has(src)) {
      resolve(src)
      return
    }
    const img = new Image()
    img.onload = () => {
      imageCache.set(src, true)
      resolve(src)
    }
    img.onerror = reject
    img.src = src
  })
}

/**
 * 带缓存的图片组件
 *
 * 特性：
 * 1. 浏览器缓存：利用 Cache-Control 响应头（后端设置）
 * 2. 内存缓存：使用 Map 存储已加载的图片 URL
 * 3. 懒加载：使用 Intersection Observer 延迟加载视口外的图片
 * 4. 低质量占位图：先加载缩略图，再加载高清图
 */
function CachedImage({
  src,
  alt = '',
  style,
  className,
  onClick,
  placeholder,
  lazy = true,
  thumbUrl,
  onLoad,
  onError,
  ...props
}) {
  const [loaded, setLoaded] = useState(() => imageCache.has(src))
  const [inView, setInView] = useState(!lazy)
  const [currentSrc, setCurrentSrc] = useState(thumbUrl || src)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef(null)
  const observerRef = useRef(null)

  // 懒加载：监听元素是否进入视口
  useEffect(() => {
    if (!lazy || inView) {
      return undefined
    }

    const img = imgRef.current
    if (!img) {
      return undefined
    }

    observerRef.current = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setInView(true)
            observerRef.current?.disconnect()
          }
        })
      },
      {
        rootMargin: '100px', // 提前 100px 开始加载
        threshold: 0.01,
      }
    )

    observerRef.current.observe(img)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [lazy, inView])

  // 图片加载完成
  const handleLoad = () => {
    setLoaded(true)
    setHasError(false)
    imageCache.set(currentSrc, true)
    // 如果当前是缩略图，加载完成后切换到高清图
    if (thumbUrl && currentSrc === thumbUrl && src !== thumbUrl) {
      setCurrentSrc(src)
    }
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    onError?.()
  }

  // 默认占位符
  const defaultPlaceholder = (
    <div
      style={{
        width: style?.width || 60,
        height: style?.height || 60,
        background: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        ...style,
      }}
      className={className}
    >
      <div
        style={{
          width: 20,
          height: 20,
          border: '2px solid #ddd',
          borderTopColor: '#999',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
    </div>
  )

  // 错误占位符
  const errorPlaceholder = (
    <div
      style={{
        width: style?.width || 60,
        height: style?.height || 60,
        background: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        color: '#999',
        fontSize: 12,
        ...style,
      }}
      className={className}
    >
      加载失败
    </div>
  )

  // 不在视口中，显示占位符
  if (!inView) {
    return <div ref={imgRef}>{placeholder || defaultPlaceholder}</div>
  }

  // 加载失败
  if (hasError && !loaded) {
    return errorPlaceholder
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <img
      ref={imgRef}
      src={currentSrc}
      alt={alt}
      style={{
        ...style,
        opacity: loaded ? 1 : 0.5,
        transition: 'opacity 0.3s ease',
      }}
      className={className}
      onClick={onClick}
      onLoad={handleLoad}
      onError={handleError}
      loading={lazy ? 'lazy' : 'eager'}
      decoding='async'
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
    />
  )
}

// 使用 memo 优化性能
export default memo(CachedImage)

// 添加 CSS 动画
if (typeof document !== 'undefined') {
  const styleId = 'cached-image-styles'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `
    document.head.appendChild(style)
  }
}
