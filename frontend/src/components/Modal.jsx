import { X } from 'lucide-react'

export default function Modal({ open, title, children, onClose }) {
  if (!open) return null
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={19} /></button></header>{children}</section></div>
}
