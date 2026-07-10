/**
 * Apple Finder / Notes 스타일 3단 스플릿 레이아웃
 * left ~20% | center ~40% | right ~40%
 */
export default function SplitView({
  left,
  center,
  right,
  detailOpen = false,
  className = '',
}) {
  return (
    <div
      className={[
        'split-view',
        detailOpen ? 'split-view--detail-open' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <aside className="split-view__pane split-view__pane--nav" aria-label="그룹 탐색">
        {left}
      </aside>
      <section className="split-view__pane split-view__pane--list" aria-label="목록">
        {center}
      </section>
      <aside
        className={[
          'split-view__pane',
          'split-view__pane--detail',
          detailOpen ? 'is-open' : '',
        ].filter(Boolean).join(' ')}
        aria-label="상세"
        aria-hidden={!detailOpen}
      >
        {right}
      </aside>
    </div>
  )
}
