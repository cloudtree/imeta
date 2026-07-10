const LOGO_SRC = '/imeta-portal-logo.png'

/**
 * iMETA Portal 브랜드 엠블럼 (구 RoaringCat 자리)
 * size: 표시 크기(px). 원형 로고라 width/height 동일.
 */
export default function RoaringCat({
  size = 48,
  className = '',
  alt = 'iMETA Portal',
  decorative = true,
}) {
  return (
    <img
      className={['imeta-logo', className].filter(Boolean).join(' ')}
      src={LOGO_SRC}
      alt={decorative ? '' : alt}
      width={size}
      height={size}
      draggable={false}
      style={{ width: size, height: size }}
      aria-hidden={decorative ? true : undefined}
    />
  )
}

export { LOGO_SRC }
