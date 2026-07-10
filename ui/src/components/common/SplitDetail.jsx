/**
 * 우측 상세 패널 — 헤더 + 스크롤 본문 + 푸터 액션
 */
export default function SplitDetail({
  title,
  subtitle,
  empty,
  emptyTitle = '항목을 선택하세요',
  emptyHint = '목록에서 항목을 클릭하면 상세 정보가 여기에 표시됩니다.',
  children,
  footer,
  onClose,
}) {
  if (empty) {
    return (
      <div className="split-detail split-detail--empty">
        <div className="split-detail__empty-inner">
          <div className="split-detail__empty-icon" aria-hidden="true">☰</div>
          <h3 className="split-detail__empty-title">{emptyTitle}</h3>
          <p className="split-detail__empty-hint">{emptyHint}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="split-detail">
      <header className="split-detail__header">
        <div className="split-detail__heading">
          <h2 className="split-detail__title">{title}</h2>
          {subtitle && <p className="split-detail__subtitle">{subtitle}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            className="split-detail__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        )}
      </header>
      <div className="split-detail__body">{children}</div>
      {footer && <footer className="split-detail__footer">{footer}</footer>}
    </div>
  )
}
