import CompetitionBadge from './CompetitionBadge'
import TeamCompatibilityBadges from './TeamCompatibilityBadges'
import { ArrowRight, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import ApprovedAsset from './ApprovedAsset'
import Avatar from './Avatar'
import Badge from './Badge'
import MatchProgress from './MatchProgress'
import { resolveMediaURL } from '../services/api'

export default function TeamCard({ team, roles = [], matchScore, compact = false, dashboard = false, membership = false, membershipLabel, userRole }) {
  const roleRows = Array.isArray(roles) ? roles : []
  const openRoles = roleRows.filter((role) => String(role.status || 'open').toLowerCase() !== 'filled')
  const memberCount = Array.isArray(team.members) ? team.members.length : 0
  const hasCapacity = memberCount < Number(team.max_members || 0)
  const isRecruiting = openRoles.length > 0 || (roleRows.length === 0 && hasCapacity)
  const roleNeeds = openRoles.map((role) => role.role_name).filter(Boolean)
  const needsMessage = roleNeeds.length
    ? `Need ${roleNeeds.join(', ')}`
    : roleRows.length === 0 && hasCapacity
      ? 'Role yang dibutuhkan belum ditentukan'
      : 'Semua role telah terisi'
  const skills = [...new Set(roleRows.flatMap((role) => role.skills || []).map((skill) => skill.skill_name).filter(Boolean))]
  const normalizedName = team.name?.toLowerCase().replace(/[^a-z]/g, '') || ''
  const coverAsset = normalizedName.includes('hacksquad') ? 'hackSquad' : normalizedName.includes('devnova') ? 'devNova' : normalizedName.includes('bytebuilder') ? 'byteBuilders' : null
  if (dashboard) return (
    <article className="team-card dashboard-team-card">
      <div className={`team-cover ${coverAsset ? '' : 'team-cover-fallback'}`}>{coverAsset && <ApprovedAsset name={coverAsset} alt={`${team.name} team cover`} />}<Badge tone={isRecruiting ? 'open' : 'filled'}>{isRecruiting ? 'Open' : 'Filled'}</Badge></div>
      <Link className="dashboard-team-link" to={`/teams/${team.id}`}>
        <span className="avatar avatar-team">{team.name?.charAt(0)}</span><span><h3>{team.name}</h3>
        <p>{team.project_idea || team.description || 'No competition goal yet.'}</p>
        </span>
      </Link>
      <CompetitionBadge team={team} /><TeamCompatibilityBadges team={team} /><div className="team-card-meta"><span><Users size={13} />{team.members?.length || 0} / {team.max_members} members</span></div>
      <p className={`team-needs ${roleNeeds.length ? 'is-open' : ''}`}>{needsMessage}</p>
      <div className="tag-list">{skills.slice(0, 3).map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div>
      {team.members?.length > 0 && <div className="member-avatar-group">{team.members.slice(0, 3).map((member) => <Link className="user-avatar-link" to={`/users/${member.id}`} key={member.id} aria-label={`View ${member.name}'s profile`}><Avatar name={member.name} src={resolveMediaURL(member.avatar_url)} size="tiny" /></Link>)}{team.members.length > 3 && <span className="avatar">+{team.members.length - 3}</span>}</div>}
      <MatchProgress score={matchScore} />
    </article>
  )
  const tags = membership ? roleRows.map((role) => role.role_name) : (skills.length ? skills : roleRows.map((role) => role.role_name))
  return (
    <article className={`team-card ${compact ? 'team-card-compact' : ''}`}>
      <div className="team-card-head">
        <div className="avatar avatar-team">{team.name?.slice(0, 2).toUpperCase()}</div>
        <div><h3>{team.name}</h3><p>{team.project_idea || team.description || 'Tujuan kompetisi belum ditambahkan.'}</p></div>
        {membership ? <Badge tone={membershipLabel === 'Owner' ? 'owner' : 'neutral'}>{membershipLabel}</Badge> : <Badge tone={isRecruiting ? 'open' : 'filled'}>{isRecruiting ? 'Open' : 'Filled'}</Badge>}
      </div>
      <CompetitionBadge team={team} /><TeamCompatibilityBadges team={team} /><div className="team-card-meta"><span><Users size={14} />{team.members ? `${team.members.length} / ${team.max_members}` : `Max ${team.max_members}`} members</span>{userRole && <span>Your role: {userRole}</span>}</div>
      {!membership && <p className={`team-needs ${roleNeeds.length ? 'is-open' : ''}`}>{needsMessage}</p>}
      <div className="tag-list">{tags.slice(0, 3).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
      {matchScore !== undefined && <MatchProgress score={matchScore} />}
      <Link className="text-link" to={`/teams/${team.id}`}>View details <ArrowRight size={15} /></Link>
    </article>
  )
}
