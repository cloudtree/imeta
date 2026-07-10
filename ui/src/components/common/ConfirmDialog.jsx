import Modal from './Modal'

/**
 * @param {object} props
 * @param {string} [props.title]
 * @param {string} props.message
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 * @param {() => void} [props.onReject]  — 있으면 중간(아니오) 버튼 표시
 * @param {string} [props.confirmLabel]
 * @param {string} [props.rejectLabel]
 * @param {string} [props.cancelLabel]
 * @param {boolean} [props.danger]
 * @param {boolean} [props.loading]
 */
export default function ConfirmDialog({
  title = '삭제 확인',
  message,
  onConfirm,
  onCancel,
  onReject,
  confirmLabel = '삭제',
  rejectLabel = '아니오',
  cancelLabel = '취소',
  danger = true,
  loading = false,
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          {onReject && (
            <button className="btn btn-secondary" onClick={onReject} disabled={loading}>
              {rejectLabel}
            </button>
          )}
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="confirm-message" style={{ whiteSpace: 'pre-line' }}>{message}</p>
    </Modal>
  )
}
