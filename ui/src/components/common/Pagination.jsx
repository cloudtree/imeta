export default function Pagination({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  const getPageNumbers = () => {
    const delta = 2
    const pages = []
    for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
      pages.push(i)
    }
    return pages
  }

  return (
    <div className="pagination">
      <span className="pagination-info">
        {total === 0 ? '0건' : `${start} - ${end} / 총 ${total}건`}
      </span>
      <div className="pagination-controls">
        <button
          className="pagination-btn"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          title="처음"
        >
          «
        </button>
        <button
          className="pagination-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          title="이전"
        >
          ‹
        </button>
        {getPageNumbers().map((p) => (
          <button
            key={p}
            className={`pagination-btn${p === page ? ' active' : ''}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        <button
          className="pagination-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          title="다음"
        >
          ›
        </button>
        <button
          className="pagination-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          title="마지막"
        >
          »
        </button>
      </div>
    </div>
  )
}
