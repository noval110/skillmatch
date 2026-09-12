import { Award, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'
import LoadingSpinner from './LoadingSpinner'
import { getShowcase, saveShowcaseItem, deleteShowcaseItem } from '../services/api'
import '../pages/community.css'

const safeLink = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? value : null } catch { return null } }
function External({ href, children }) { return safeLink(href) && <a href={href} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} />{children}</a> }

export default function ProfileShowcase({ showcase, editable = false }) {
  const [data, setData] = useState(showcase)
  const [loading, setLoading] = useState(editable)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!editable) return
    let active = true
    setLoading(true); setError('')
    getShowcase().then(result => { if (active) setData(result) }, err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [editable, attempt])
  const visible = editable ? data : showcase
  const open = (kind, item = {}) => { setFormError(''); setEditing({ kind, item }) }
  const save = async event => {
    event.preventDefault(); setBusy(true); setFormError('')
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(form)
    if (editing.kind === 'portfolio') body.technologies = body.technologies.split(',').map(value => value.trim()).filter(Boolean)
    try { await saveShowcaseItem(editing.kind, editing.item.id, body); setEditing(null); setAttempt(value => value + 1) }
    catch (err) { setFormError(err.message) } finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true); setFormError('')
    try { await deleteShowcaseItem(deleting.kind, deleting.item.id); setDeleting(null); setAttempt(value => value + 1) }
    catch (err) { setFormError(err.message) } finally { setBusy(false) }
  }
  return <div className="profile-showcase">
    {error && <div className="error-message" role="alert">{error}<button className="button button-secondary" onClick={() => setAttempt(value => value + 1)}>Retry</button></div>}
    {loading ? <LoadingSpinner label="Loading portfolio and achievements..." /> : ['portfolio', 'achievements'].map(kind => <section className="panel showcase-section" key={kind}>
      <div className="section-heading"><h2>{kind === 'portfolio' ? 'Portfolio' : 'Achievements'}</h2>{editable && <button className="button button-secondary" onClick={() => open(kind)}><Plus size={15} />{kind === 'portfolio' ? 'Add Project' : 'Add Achievement'}</button>}</div>
      {visible?.[kind]?.length ? <div className="showcase-list">{visible[kind].map(item => <article className="showcase-item" key={item.id}>
        <div className="showcase-item-heading"><h3>{kind === 'achievements' && <Award size={17} />}{item.title}</h3>{editable && <div className="showcase-controls"><button className="icon-button" aria-label={`Edit ${item.title}`} onClick={() => open(kind, item)}><Pencil size={15} /></button><button className="icon-button danger" aria-label={`Delete ${item.title}`} onClick={() => { setFormError(''); setDeleting({ kind, item }) }}><Trash2 size={15} /></button></div>}</div>
        {kind === 'portfolio' ? <><p className="showcase-meta">{item.role}</p><p className="showcase-description">{item.description}</p><div className="tag-list">{item.technologies?.map(technology => <span className="tag" key={technology}>{technology}</span>)}</div><div className="community-actions"><External href={item.project_url}>Live Demo</External><External href={item.repository_url}>Repository</External></div></> : <><p className="showcase-meta">{[item.organization, item.achievement_type, item.date].filter(Boolean).join(' · ')}</p><p className="showcase-description">{item.description}</p><div className="community-actions"><External href={item.credential_url}>Credential</External></div></>}
      </article>)}</div> : <p className="showcase-empty">{kind === 'portfolio' ? 'No projects shared yet.' : 'No achievements shared yet.'}</p>}
    </section>)}
    {editable && <><Modal open={Boolean(editing)} title={`${editing?.item.id ? 'Edit' : 'Add'} ${editing?.kind === 'portfolio' ? 'Project' : 'Achievement'}`} onClose={() => { if (!busy) setEditing(null) }}>{editing && <form className="stack-form" key={`${editing.kind}-${editing.item.id || 'new'}`} onSubmit={save}>
      {formError && <div role="alert" className="error-message">{formError}</div>}
      <label><span>Title</span><input name="title" defaultValue={editing.item.title || ''} maxLength={200} required /></label>
      {editing.kind === 'portfolio' ? <><label><span>Your role</span><input name="role" defaultValue={editing.item.role || ''} maxLength={120} /></label><label><span>Project URL</span><input name="project_url" type="url" placeholder="https://" defaultValue={editing.item.project_url || ''} maxLength={2048} /></label><label><span>Repository URL</span><input name="repository_url" type="url" placeholder="https://" defaultValue={editing.item.repository_url || ''} maxLength={2048} /></label><label><span>Technologies / skills (comma separated, up to 30)</span><input name="technologies" defaultValue={editing.item.technologies?.join(', ') || ''} maxLength={2400} /></label></> : <><label><span>Organization</span><input name="organization" defaultValue={editing.item.organization || ''} maxLength={200} /></label><label><span>Achievement type</span><select name="achievement_type" defaultValue={editing.item.achievement_type || 'competition'}>{['competition', 'certification', 'award', 'other'].map(type => <option key={type} value={type}>{type}</option>)}</select></label><label><span>Date</span><input type="date" name="date" defaultValue={editing.item.date || ''} /></label><label><span>Credential URL</span><input name="credential_url" type="url" placeholder="https://" defaultValue={editing.item.credential_url || ''} maxLength={2048} /></label></>}
      <label><span>Description</span><textarea name="description" rows={4} defaultValue={editing.item.description || ''} maxLength={4000} /></label><button className="button button-primary" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
    </form>}</Modal><ConfirmDialog open={Boolean(deleting)} title="Delete this item?" message={`Remove ${deleting?.item.title || 'this item'} from your profile?`} confirmLabel="Delete" loading={busy} error={formError} onClose={() => { if (!busy) setDeleting(null) }} onConfirm={remove} /></>}
  </div>
}
