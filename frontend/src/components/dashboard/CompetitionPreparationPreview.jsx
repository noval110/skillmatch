import { ArrowRight, CalendarDays, Flag, RefreshCw } from 'lucide-react'
import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import useAsync from '../../hooks/useAsync'
import { getTeamMilestones } from '../../services/api'
import { formatMilestoneDate, normalizeMilestonePayload } from '../../utils/milestones'
import '../../styles/milestones.css'

export default function CompetitionPreparationPreview({ team }) {
  const loader = useCallback(async () => normalizeMilestonePayload(await getTeamMilestones(team.id)), [team.id])
  const { data, loading, error, reload } = useAsync(loader)
  if (loading) return <div className="preparation-preview preview-loading" role="status" aria-label="Loading competition preparation" />
  if (error) return <div className="preparation-preview preview-error"><Flag size={17} /><span>Preparation unavailable.</span><button onClick={reload}><RefreshCw size={13} />Retry</button></div>
  const summary = data?.summary
  return <div className="preparation-preview"><div className="preparation-preview-title"><span><Flag size={16} /></span><div><h3>Competition Preparation</h3><p>{summary?.total ? `${summary.completed} / ${summary.total} milestones complete` : 'Plan the work before competition day.'}</p></div></div>{summary?.total ? <><div className="preparation-preview-progress"><strong>{summary.overall_progress}%</strong><progress aria-label="Competition preparation" max="100" value={summary.overall_progress} /></div><div className="preparation-preview-next"><span>Next</span><strong>{summary.next_milestone?.title || 'All milestones complete'}</strong>{summary.next_milestone?.due_date && <small><CalendarDays size={11} />{formatMilestoneDate(summary.next_milestone.due_date)}</small>}</div></> : null}<Link to={`/teams/${team.id}?tab=milestones`}>Open Workspace<ArrowRight size={14} /></Link></div>
}
