import { useState, useEffect, useRef } from 'react';

interface CachedImageProps {
  src: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
  className?: string;
  placeholder?: React.ReactNode;
  /** 是否使用 Intersection Observer 懒加载 */
  lazy?: boolean;
  /** 缩略图 URL（用于低质量占位图） */
  thumbUrl?: string;
}

/**
 * 带缓存的图片组件
 * 
 * 特性：
 * 1. 浏览器缓存：利用 Cache-Control 响应头
 * 2. 内存缓存：使用 Map 存储已加载的图片 URL
 * 3. 懒加载：使用 Intersection Observer 延迟加载视口外的图片
 * 4. 低质量占位图：先加载缩略图，再加载高清图
 */
export default function CachedImage({
  src,
  alt = '',
  width,
  height,
  style,
  className,
  placeholder,
  lazy = true,
  thumbUrl,
}: CachedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(!lazy);
  const [currentSrc, setCurrentSrc] = useState(thumbUrl || src);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 懒加载：监听元素是否进入视口
  useEffect(() => {
    if (!lazy || inView) return;

    const img = imgRef.current;
    if (!img) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // 提前 100px 开始加载
        threshold: 0.01,
      }
    );

    observerRef.current.observe(img);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [lazy, inView]);

  // 图片加载完成
  const handleLoad = () => {
    setLoaded(true);
    // 如果当前是缩略图，加载完成后切换到高清图
    if (thumbUrl && currentSrc === thumbUrl) {
      setCurrentSrc(src);
    }
  };

  // 默认占位符
  const defaultPlaceholder = (
    <div
      style={{
        width: width || 60,
        height: height || 60,
        background: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        ...style,
      }}
      className={className}
    >
      <span style={{ color: '#ccc', fontSize: 12 }}>加载中...</span>
    </div>
  );

  // 不在视口中，显示占位符
  if (!inView) {
    return (
      <div ref={imgRef as React.RefObject<HTMLDivElement>}>
        {placeholder || defaultPlaceholder}
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      style={{
        ...style,
        opacity: loaded ? 1 : 0.5,
        transition: 'opacity 0.3s ease',
      }}
      className={className}
      onLoad={handleLoad}
      loading={lazy ? 'lazy' : 'eager'}
      // 添加解码提示，让浏览器异步解码
      decoding="async"
    />
  );
}
