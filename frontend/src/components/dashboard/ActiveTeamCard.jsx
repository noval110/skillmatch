import { ArrowRight, UsersRound } from 'lucide-react'
import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import useAsync from '../../hooks/useAsync'
import { getTeamReadiness, resolveMediaURL } from '../../services/api'
import CompetitionBadge from '../CompetitionBadge'
import TeamCompatibilityBadges from '../TeamCompatibilityBadges'
import CompetitionPreparationPreview from './CompetitionPreparationPreview'
import TeamReadinessPreview from './TeamReadinessPreview'

export default function ActiveTeamCard({ team }) {
  const loadReadiness = useCallback(() => getTeamReadiness(team.id), [team.id])
  const { data: readiness, loading, error, reload } = useAsync(loadReadiness)
  const memberCount = Array.isArray(team.members) ? team.members.length : null
  const recruiting = memberCount != null && memberCount < team.max_members && readiness?.roles?.some(role => ['active', 'open'].includes(role.status))
  const cover = resolveMediaURL(team.cover_url)

  return <article className="command-panel command-active-team"><header><h2>Your Active Team</h2><Link className="command-link" to={`/teams/${team.id}`}>View Team<ArrowRight size={15} /></Link></header><div className="command-active-grid"><div className="active-team-identity"><span className={`active-team-avatar ${cover ? 'has-image' : ''}`}>{cover ? <img src={cover} alt="" /> : team.name?.slice(0, 2).toUpperCase()}</span><div><h3>{team.name}</h3><CompetitionBadge team={team} />{recruiting && <span className="command-open">Recruiting</span>}<p>{team.project_idea || team.description || 'Set a shared competition goal with your team.'}</p><span className="active-team-members"><UsersRound size={15} />{memberCount ?? '—'} / {team.max_members} members</span><TeamCompatibilityBadges team={team} /></div></div><div aria-busy={loading}>{loading ? <div className="command-skeleton readiness-skeleton" role="status" aria-label="Loading team readiness" /> : <TeamReadinessPreview team={team} readiness={readiness} error={error} retry={reload} />}</div></div><CompetitionPreparationPreview team={team} /></article>
}
