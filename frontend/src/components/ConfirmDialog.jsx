import { AlertTriangle, X } from 'lucide-react'

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Konfirmasi', cancelLabel = 'Batal', loading = false, error = '', onConfirm, onClose }) {
  if (!open) return null

  return (
    <div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={loading ? undefined : onClose}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" onMouseDown={(event) => event.stopPropagation()}>
        <button className="confirm-close" type="button" aria-label="Tutup" onClick={onClose} disabled={loading}><X size={16} /></button>
        <span className="confirm-icon"><AlertTriangle size={21} /></span>
        <div className="confirm-copy">
          <h2 id="confirm-title">{title}</h2>
          <p id="confirm-message">{message}</p>
        </div>
        {error && <div className="confirm-error">{error}</div>}
        <div className="confirm-actions">
          <button className="button button-secondary" type="button" onClick={onClose} disabled={loading}>{cancelLabel}</button>
          <button className="button button-primary" type="button" onClick={onConfirm} disabled={loading}>{loading ? 'Memproses...' : confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}
