// 品牌 Logo：直接渲染 public/logo.png 原图（金棕色图标，带透明边）
// 不再使用 mask 染色方案，避免原图被染成色块；干净显示原始 logo。
export default function BrandLogo({
  size = 28,
  className = '',
  style = {},
}: {
  size?: number
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <img
      src="/logo.png"
      alt="AI TryOn"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', objectFit: 'contain', ...style }}
    />
  )
}
