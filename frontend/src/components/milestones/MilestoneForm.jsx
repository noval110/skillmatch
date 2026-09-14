import { useState } from 'react'
import Modal from '../Modal'
import { milestoneWritePayload } from '../../utils/milestones'

const suggestions = ['Proposal', 'Prototype', 'Testing', 'Demo Video', 'Pitch Deck', 'Final Submission']

export default function MilestoneForm({ open, milestone, busy, error, onClose, onSave }) {
  const [status, setStatus] = useState(milestone?.status || 'not_started')
  const [progress, setProgress] = useState(milestone?.progress || 0)
  if (!open) return null
  const changeStatus = value => {
    setStatus(value)
    if (value === 'completed') setProgress(100)
    if (value === 'not_started') setProgress(0)
  }
  const changeProgress = value => {
    const next = Math.min(100, Math.max(0, Number(value) || 0))
    setProgress(next)
    if (next === 100) setStatus('completed')
    else if (next > 0 && status === 'not_started') setStatus('in_progress')
    else if (next < 100 && status === 'completed') setStatus('in_progress')
  }
  return <Modal open title={milestone ? 'Edit Milestone' : 'Create Milestone'} onClose={busy ? undefined : onClose}>
    <form className="stack-form milestone-form" onSubmit={event => {
      event.preventDefault()
      const values = new FormData(event.currentTarget)
      onSave(milestoneWritePayload({ title: values.get('title'), description: values.get('description'), due_date: values.get('due_date'), status, progress }))
    }}>
      {error && <div className="error-message" role="alert">{error}</div>}
      <label><span>Title</span><input name="title" list="milestone-title-suggestions" maxLength="120" defaultValue={milestone?.title || ''} placeholder="Proposal, prototype, final submission..." required /><datalist id="milestone-title-suggestions">{suggestions.map(title => <option key={title} value={title} />)}</datalist></label>
      <label><span>Description <small>(optional)</small></span><textarea name="description" rows="4" maxLength="2000" defaultValue={milestone?.description || ''} placeholder="Describe the measurable outcome your team wants to complete." /></label>
      <div className="milestone-form-grid">
        <label><span>Due date <small>(optional)</small></span><input name="due_date" type="date" defaultValue={milestone?.due_date || ''} /></label>
        <label><span>Status</span><select name="status" value={status} onChange={event => changeStatus(event.target.value)}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label>
      </div>
      <label className="milestone-progress-field"><span>Progress <output>{progress}%</output></span><input aria-label="Milestone progress" type="range" min="0" max="100" step="5" value={progress} onChange={event => changeProgress(event.target.value)} /></label>
      <div className="milestone-form-actions"><button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving...' : milestone ? 'Save Changes' : 'Create Milestone'}</button></div>
    </form>
  </Modal>
}
