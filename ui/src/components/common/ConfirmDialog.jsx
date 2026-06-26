import Modal from './Modal'

export default function ConfirmDialog({ message, onConfirm, onCancel, loading }) {
  return (
    <Modal
      title="삭제 확인"
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            취소
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            삭제
          </button>
        </>
      }
    >
      <p className="confirm-message">{message}</p>
    </Modal>
  )
}
