import { CalendarDays, Check, CircleAlert, Clock3, Edit3, Flag, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import ConfirmDialog from '../ConfirmDialog'
import useAsync from '../../hooks/useAsync'
import { createTeamMilestone, deleteTeamMilestone, getTeamMilestones, updateTeamMilestone } from '../../services/api'
import { formatMilestoneDate, milestoneDeadlineState, milestoneStatusLabel, milestoneWritePayload, normalizeMilestonePayload } from '../../utils/milestones'
import MilestoneForm from './MilestoneForm'
import '../../styles/milestones.css'

const deadlineLabels = { upcoming: 'Upcoming', due_soon: 'Due soon', overdue: 'Overdue', completed: 'Completed', no_deadline: 'No deadline' }

export default function TeamMilestonesPanel({ team, owner }) {
  const loader = useCallback(async () => normalizeMilestonePayload(await getTeamMilestones(team.id)), [team.id])
  const { data, loading, error, reload } = useAsync(loader)
  const [editor, setEditor] = useState(undefined)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const canManage = owner && data?.can_manage
  const save = async payload => {
    setBusy(true); setActionError('')
    try {
      if (editor?.id) await updateTeamMilestone(team.id, editor.id, payload)
      else await createTeamMilestone(team.id, payload)
      setEditor(undefined)
      await reload()
    } catch (requestError) { setActionError(requestError.message) }
    finally { setBusy(false) }
  }
  const complete = async milestone => {
    setBusy(true); setActionError('')
    try {
      await updateTeamMilestone(team.id, milestone.id, milestoneWritePayload({ ...milestone, status: 'completed', progress: 100 }))
      await reload()
    } catch (requestError) { setActionError(requestError.message) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true); setActionError('')
    try {
      await deleteTeamMilestone(team.id, deleting.id)
      setDeleting(null)
      await reload()
    } catch (requestError) { setActionError(requestError.message) }
    finally { setBusy(false) }
  }

  if (loading && !data) return <section className="milestone-workspace" aria-busy="true"><div className="milestone-loading" role="status"><Flag size={24} /><span>Loading competition preparation...</span></div></section>
  if (error && !data) return <section className="milestone-workspace milestone-load-error" role="alert"><CircleAlert size={24} /><h2>Competition workspace couldn't be loaded.</h2><p>{error}</p><button className="button button-secondary" onClick={reload}><RefreshCw size={15} />Retry</button></section>
  const milestones = data?.milestones || []
  const summary = data?.summary || { total: 0, completed: 0, in_progress: 0, not_started: 0, overall_progress: null }
  return <section className="milestone-workspace" aria-label="Team competition milestones">
    <header className="milestone-heading"><div><span className="milestone-eyebrow">COMPETITION PREPARATION</span><h2>Turn your team's plan into<br />measurable progress.</h2><p>Track the work your team needs to finish before competition day.</p></div>{canManage && <button className="button button-primary" disabled={busy} onClick={() => { setActionError(''); setEditor(null) }}><Plus size={16} />New Milestone</button>}</header>
    {(error || actionError) && <div className="milestone-inline-error" role="alert"><span>{actionError || error}</span>{error && <button onClick={reload}>Retry</button>}</div>}
    {milestones.length > 0 ? <>
      <section className="milestone-summary">
        <div className="milestone-overall"><span>Overall preparation</span><strong>{summary.overall_progress}%</strong><progress aria-label="Overall competition preparation" max="100" value={summary.overall_progress} /></div>
        <dl><div><dt>Milestones</dt><dd>{summary.total}</dd></div><div><dt>Completed</dt><dd>{summary.completed}</dd></div><div><dt>In progress</dt><dd>{summary.in_progress}</dd></div><div><dt>Not started</dt><dd>{summary.not_started}</dd></div></dl>
      </section>
      <div className="milestone-list">{milestones.map(milestone => {
        const deadline = milestoneDeadlineState(milestone)
        return <article className={`milestone-card deadline-${deadline}`} key={milestone.id}>
          <div className="milestone-marker">{milestone.status === 'completed' ? <Check size={16} /> : <Flag size={15} />}</div>
          <div className="milestone-card-content"><header><div><h3>{milestone.title}</h3><span className={`milestone-status status-${milestone.status}`}>{milestoneStatusLabel(milestone.status)}</span></div><span className={`deadline-label ${deadline}`}><CalendarDays size={13} />{deadlineLabels[deadline]}</span></header>
            <p>{milestone.description || 'No description added.'}</p>
            <div className="milestone-progress"><div><span>{milestone.due_date ? `Due ${formatMilestoneDate(milestone.due_date)}` : 'Schedule when your team is ready'}</span><strong>{milestone.progress}% complete</strong></div><progress aria-label={`${milestone.title} progress`} max="100" value={milestone.progress} /></div>
            {canManage && <div className="milestone-actions"><button disabled={busy} onClick={() => { setActionError(''); setEditor(milestone) }}><Edit3 size={14} />Edit</button><button disabled={busy} onClick={() => { setActionError(''); setDeleting(milestone) }}><Trash2 size={14} />Delete</button>{milestone.status !== 'completed' && <button className="mark-complete" onClick={() => complete(milestone)} disabled={busy}><Check size={14} />Mark Complete</button>}</div>}
          </div>
        </article>
      })}</div>
    </> : <div className="milestone-empty"><span><Clock3 size={27} /></span><h3>Plan your competition journey.</h3><p>{canManage ? 'Create milestones for your proposal, prototype, presentation, submission, or anything your team needs.' : 'No milestones have been created yet.'}</p>{canManage && <button className="button button-primary" disabled={busy} onClick={() => { setActionError(''); setEditor(null) }}><Plus size={15} />Create First Milestone</button>}</div>}
    <MilestoneForm key={editor?.id || (editor === null ? 'new' : 'closed')} open={editor !== undefined} milestone={editor} busy={busy} error={actionError} onClose={() => setEditor(undefined)} onSave={save} />
    <ConfirmDialog open={Boolean(deleting)} title="Delete milestone?" message={`${deleting?.title || 'This milestone'} will be removed from the team workspace.`} confirmLabel="Delete Milestone" loading={busy} error={actionError} onClose={() => setDeleting(null)} onConfirm={remove} />
  </section>
}
