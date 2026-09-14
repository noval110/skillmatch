import { ArrowRight, Check, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import CompetitionBadge from './CompetitionBadge'
import TeamCompatibilityBadges from './TeamCompatibilityBadges'
import MatchBreakdown from './MatchBreakdown'
import '../pages/community.css'

export default function RecommendationCard({ recommendation, onApply, applied = false }) {
  const { team, match_score, recommended_role, matched_skills, reason, member_count, match, availability_note } = recommendation
  const score = typeof match_score === 'number' && Number.isFinite(match_score) ? Math.max(0, Math.min(100, match_score)) : null
  return <article className="command-recommendation command-panel">
    <header><span className="recommendation-initials">{team.name?.slice(0, 2).toUpperCase()}</span><div><h3>{team.name}</h3><CompetitionBadge team={team} /></div><span className="recommendation-score">{score == null ? 'Match unavailable' : `${score}% Match`}</span></header>
    <p className="command-rec-description">{team.project_idea || team.description || 'Explore the team to learn about their competition goals.'}</p>
    <div className="command-rec-role"><span>Recommended role</span><strong>{recommended_role || 'Review available roles'}</strong></div>
    <div className="command-tags" aria-label="Matching skills">{matched_skills?.length ? matched_skills.slice(0, 3).map(skill => <span key={skill}>{skill}</span>) : <p>No shared required skills yet.</p>}{matched_skills?.length > 3 && <span>+{matched_skills.length - 3} more</span>}</div>
    <div className="command-rec-meta"><span><Users size={14} />{member_count ?? '—'} / {team.max_members} members</span><TeamCompatibilityBadges team={team} /></div>
    {reason && <p className="command-rec-reason">{reason}</p>}
    <details className="command-rec-breakdown"><summary>Why this match?</summary>{matched_skills?.length > 0 && <p>{matched_skills.length} required skills matched.</p>}<MatchBreakdown match={match} />{availability_note && <p>{availability_note}</p>}</details>
    <div className="command-rec-actions"><Link className="button button-secondary" to={`/teams/${team.id}`}>View Details<ArrowRight size={14} /></Link>{onApply && <button className="button button-primary" disabled={applied} onClick={() => onApply(recommendation)}>{applied ? <><Check size={14} />Request Sent</> : 'Apply to Join'}</button>}</div>
  </article>
}
