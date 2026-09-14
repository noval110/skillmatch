import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { joinTeam } from '../../services/api'

export default function TeamApplicationDialog({ recommendation, onClose, onSent }) {
  const dialog = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { dialog.current.showModal() }, [])
  async function submit(event) {
    event.preventDefault()
    const message = new FormData(event.currentTarget).get('message').trim()
    if (!message) { setError('Add a short introduction before sending your request.'); return }
    setBusy(true); setError('')
    try { await joinTeam(recommendation.team.id, message); onSent(recommendation.team.id); onClose() }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="command-application" aria-labelledby="application-title" onCancel={event => { if (busy) event.preventDefault(); else onClose() }}>
    <header><div><span className="command-eyebrow">YOUR NEXT CONNECTION</span><h2 id="application-title">Apply to {recommendation.team.name}</h2></div><button className="icon-button" aria-label="Close application" disabled={busy} onClick={onClose}><X size={20} /></button></header>
    <p>Introduce yourself and share what you would like to contribute{recommendation.recommended_role ? ` as a ${recommendation.recommended_role}` : ''}.</p>
    <form onSubmit={submit}><label htmlFor="application-message">Your introduction</label><textarea id="application-message" name="message" rows="5" required maxLength={2000} autoFocus placeholder="My skills, interests, and availability..." disabled={busy} />{error && <p className="command-inline-error" role="alert">{error}</p>}<div className="command-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Sending...' : 'Send Join Request'}</button></div></form>
  </dialog>
}
