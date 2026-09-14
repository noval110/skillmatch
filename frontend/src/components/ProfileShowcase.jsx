import { Award, ExternalLink, FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'
import LoadingSpinner from './LoadingSpinner'
import useAsync from '../hooks/useAsync'
import { deleteShowcaseItem, getShowcase, saveShowcaseItem } from '../services/api'
import { formatProfileDate, safeExternalURL, titleCase } from '../utils/profile'

function External({ href, children }) {
  const safeHref = safeExternalURL(href)
  return safeHref ? <a href={safeHref} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} />{children}</a> : null
}

function ShowcaseControls({ item, kind, onEdit, onDelete }) {
  return <span className="showcase-controls"><button type="button" aria-label={`Edit ${item.title}`} onClick={() => onEdit(kind, item)}><Pencil size={14} /></button><button type="button" aria-label={`Delete ${item.title}`} onClick={() => onDelete(kind, item)}><Trash2 size={14} /></button></span>
}

function Portfolio({ items, editable, onAdd, onEdit, onDelete }) {
  return <section className="profile-content-section showcase-section">
    <header className="profile-section-heading">
      <div><span className="profile-section-kicker">Proof of work</span><h2>Portfolio</h2><p>Projects, contributions, and tools used to deliver them.</p></div>
      {editable && <button className="button button-secondary button-small" type="button" onClick={() => onAdd('portfolio')}><Plus size={14} />Add Project</button>}
    </header>
    {items.length ? <div className="portfolio-grid">{items.map(item => <article className="portfolio-card" key={item.id}>
      <header><span className="showcase-icon"><FolderKanban size={17} /></span><div><h3>{item.title}</h3>{item.role && <p>{item.role}</p>}</div>{editable && <ShowcaseControls item={item} kind="portfolio" onEdit={onEdit} onDelete={onDelete} />}</header>
      {item.description && <p className="showcase-description">{item.description}</p>}
      {item.technologies?.length > 0 && <div className="showcase-tags">{item.technologies.map(technology => <span key={technology}>{technology}</span>)}</div>}
      {(safeExternalURL(item.project_url) || safeExternalURL(item.repository_url)) && <footer><External href={item.project_url}>Live Demo</External><External href={item.repository_url}>Repository</External></footer>}
    </article>)}</div> : <div className="profile-compact-empty"><p>{editable ? "No portfolio yet. Show teams what you've built." : 'No projects shared yet.'}</p>{editable && <button className="button button-secondary button-small" type="button" onClick={() => onAdd('portfolio')}><Plus size={14} />Add Project</button>}</div>}
  </section>
}

function Achievements({ items, editable, onAdd, onEdit, onDelete }) {
  return <section className="profile-content-section showcase-section">
    <header className="profile-section-heading">
      <div><span className="profile-section-kicker">Track record</span><h2>Achievements</h2><p>Competition results, awards, and certifications.</p></div>
      {editable && <button className="button button-secondary button-small" type="button" onClick={() => onAdd('achievements')}><Plus size={14} />Add Achievement</button>}
    </header>
    {items.length ? <div className="achievement-list">{items.map(item => <article className="achievement-row" key={item.id}>
      <span className="achievement-marker"><Award size={16} /></span>
      <div className="achievement-copy"><header><div><h3>{item.title}</h3><p>{[item.organization, titleCase(item.achievement_type || ''), formatProfileDate(item.date)].filter(Boolean).join(' · ')}</p></div>{editable && <ShowcaseControls item={item} kind="achievements" onEdit={onEdit} onDelete={onDelete} />}</header>{item.description && <p className="showcase-description">{item.description}</p>}<External href={item.credential_url}>View Credential</External></div>
    </article>)}</div> : <div className="profile-compact-empty"><p>{editable ? 'No achievements added yet. Add a result, award, or certification when you are ready.' : 'No achievements shared yet.'}</p>{editable && <button className="button button-secondary button-small" type="button" onClick={() => onAdd('achievements')}><Plus size={14} />Add Achievement</button>}</div>}
  </section>
}

function ShowcaseSections({ data = {}, editable = false, onAdd, onEdit, onDelete }) {
  return <div className="profile-showcase profile-section-group">
    <Portfolio items={Array.isArray(data.portfolio) ? data.portfolio : []} editable={editable} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />
    <Achievements items={Array.isArray(data.achievements) ? data.achievements : []} editable={editable} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />
  </div>
}

function ShowcaseForm({ editing, busy, error, onSubmit }) {
  const project = editing.kind === 'portfolio'
  return <form className="stack-form showcase-form" onSubmit={onSubmit}>
    {error && <div role="alert" className="error-message">{error}</div>}
    <label><span>Title</span><input name="title" defaultValue={editing.item.title || ''} maxLength={200} required /></label>
    {project ? <>
      <label><span>Your role</span><input name="role" defaultValue={editing.item.role || ''} maxLength={120} placeholder="Frontend Developer, Researcher, Presenter..." /></label>
      <div className="showcase-form-grid"><label><span>Project URL</span><input name="project_url" type="url" placeholder="https://" defaultValue={editing.item.project_url || ''} maxLength={2048} /></label><label><span>Repository URL</span><input name="repository_url" type="url" placeholder="https://" defaultValue={editing.item.repository_url || ''} maxLength={2048} /></label></div>
      <label><span>Technologies or skills <small>(comma separated)</small></span><input name="technologies" defaultValue={editing.item.technologies?.join(', ') || ''} maxLength={2400} placeholder="React, Go, PostgreSQL" /></label>
    </> : <>
      <label><span>Organization</span><input name="organization" defaultValue={editing.item.organization || ''} maxLength={200} /></label>
      <div className="showcase-form-grid"><label><span>Type</span><select name="achievement_type" defaultValue={editing.item.achievement_type || 'competition'}><option value="competition">Competition</option><option value="certification">Certification</option><option value="award">Award</option><option value="other">Other</option></select></label><label><span>Date</span><input type="date" name="date" defaultValue={editing.item.date || ''} /></label></div>
      <label><span>Credential URL</span><input name="credential_url" type="url" placeholder="https://" defaultValue={editing.item.credential_url || ''} maxLength={2048} /></label>
    </>}
    <label><span>Description</span><textarea name="description" rows={4} defaultValue={editing.item.description || ''} maxLength={4000} placeholder="Describe the outcome and your contribution." /></label>
    <button className="button button-primary" disabled={busy}>{busy ? 'Saving...' : project ? 'Save Project' : 'Save Achievement'}</button>
  </form>
}

function EditableShowcase({ onDataChange }) {
  const loader = useCallback(async () => {
    const result = await getShowcase()
    onDataChange?.(result)
    return result
  }, [onDataChange])
  const { data, loading, error, reload } = useAsync(loader)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const open = (kind, item = {}) => { setFormError(''); setEditing({ kind, item }) }
  const save = async event => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(form)
    const linkFields = editing.kind === 'portfolio' ? ['project_url', 'repository_url'] : ['credential_url']
    if (linkFields.some(field => body[field] && !safeExternalURL(body[field]))) {
      setFormError('Use a complete HTTP(S) URL without embedded credentials.')
      return
    }
    if (editing.kind === 'portfolio') body.technologies = body.technologies.split(',').map(value => value.trim()).filter(Boolean)
    setBusy(true); setFormError('')
    try {
      await saveShowcaseItem(editing.kind, editing.item.id, body)
      setEditing(null)
      await reload()
    } catch (err) { setFormError(err.message) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true); setDeleteError('')
    try {
      await deleteShowcaseItem(deleting.kind, deleting.item.id)
      setDeleting(null)
      await reload()
    } catch (err) { setDeleteError(err.message) }
    finally { setBusy(false) }
  }

  if (loading && !data) return <div className="profile-showcase-loading"><LoadingSpinner label="Loading portfolio and achievements..." /></div>
  return <>
    {error && <div className="profile-inline-error" role="alert"><span>Portfolio and achievements could not be loaded.</span><button type="button" onClick={reload}>Try again</button></div>}
    <ShowcaseSections data={data} editable onAdd={open} onEdit={open} onDelete={(kind, item) => { setDeleteError(''); setDeleting({ kind, item }) }} />
    <Modal open={Boolean(editing)} title={`${editing?.item.id ? 'Edit' : 'Add'} ${editing?.kind === 'portfolio' ? 'Project' : 'Achievement'}`} onClose={() => { if (!busy) setEditing(null) }}>{editing && <ShowcaseForm key={`${editing.kind}-${editing.item.id || 'new'}`} editing={editing} busy={busy} error={formError} onSubmit={save} />}</Modal>
    <ConfirmDialog open={Boolean(deleting)} title="Delete this item?" message={`Remove ${deleting?.item.title || 'this item'} from your profile?`} confirmLabel="Delete" cancelLabel="Cancel" loading={busy} error={deleteError} onClose={() => { if (!busy) setDeleting(null) }} onConfirm={remove} />
  </>
}

export default function ProfileShowcase({ showcase, editable = false, onDataChange }) {
  return editable ? <EditableShowcase onDataChange={onDataChange} /> : <ShowcaseSections data={showcase} />
}
