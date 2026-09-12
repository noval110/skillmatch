import { ArrowRight, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import CompetitionBadge from './CompetitionBadge'
import TeamCompatibilityBadges from './TeamCompatibilityBadges'
import MatchProgress from './MatchProgress'
import MatchBreakdown from './MatchBreakdown'
import '../pages/community.css'

export default function RecommendationCard({ recommendation }) {
  const { team, match_score, recommended_role, matched_skills, reason, member_count, match, availability_note } = recommendation
  return <article className="team-card recommendation-card">
    <div className="team-card-head"><span className="avatar avatar-team">{team.name?.slice(0, 2).toUpperCase()}</span><div><h3>{team.name}</h3><p>{team.project_idea || team.description}</p></div></div>
    <CompetitionBadge team={team} /><TeamCompatibilityBadges team={team} />
    <div className="team-card-meta"><span><Users size={14} />{member_count} / {team.max_members} members</span></div>
    <MatchProgress score={match_score} />
    <p className="recommended-role"><span>Recommended Role</span><strong>{recommended_role}</strong></p>
    <div className="recommendation-skills"><h4>Matching skills</h4>{matched_skills?.length ? <div className="tag-list">{matched_skills.map(skill => <span className="tag" key={skill}>{skill}</span>)}</div> : <p>No shared required skills yet.</p>}</div>
    <p className="recommendation-reason">{reason}</p>
    <details className="recommendation-breakdown"><summary>Why this match?</summary><MatchBreakdown match={match} /><p>{availability_note}</p></details>
    <Link className="text-link" to={`/teams/${team.id}`}>View Team <ArrowRight size={15} /></Link>
  </article>
}
