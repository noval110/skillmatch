import { Settings2, Users } from 'lucide-react'
import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import ApprovedAsset from '../components/ApprovedAsset'
import Avatar from '../components/Avatar'
import Badge from '../components/Badge'
import LoadingSpinner from '../components/LoadingSpinner'
import Navbar from '../components/Navbar'
import useAsync from '../hooks/useAsync'
import { getTeams, resolveMediaURL } from '../services/api'
import { getCurrentUserId } from '../utils/auth'
import { loadTeamDetail } from '../utils/teams'

function MyTeamCard({ team, userId }) {
  const members = Array.isArray(team.members) ? team.members : []
  const roles = Array.isArray(team.roles) ? team.roles : []
  const isOwner = Number(team.owner_id) === userId
  const member = members.find((item) => Number(item.id) === userId)
  const skills = [...new Set(roles.flatMap((role) => role.skills || []).map((skill) => skill.skill_name).filter(Boolean))]
  return <article className="my-team-card"><header><span className="avatar avatar-large avatar-team">{team.name?.charAt(0)}</span><div><div className="title-line"><h2>{team.name}</h2><Badge tone={isOwner ? 'owner' : 'neutral'}>{isOwner ? 'Owner' : 'Member'}</Badge></div><p>{team.project_idea || team.description || 'Belum ada deskripsi proyek.'}</p></div><div className="my-team-card-actions"><Link className="button button-secondary" to={`/teams/${team.id}`}>View Team</Link>{isOwner && <Link className="button button-primary" to={`/teams/${team.id}`}><Settings2 size={14} />Manage Team</Link>}</div></header><p className="my-team-description">{team.description || 'Team ini belum menambahkan deskripsi.'}</p><div className="my-team-meta"><span><Users size={14} />{team.members.length} / {team.max_members} members</span>{member?.role && <span>Your role: <strong>{member.role}</strong></span>}<span>{team.roles.length} current roles</span></div><div className="my-team-content"><div><h3>Members</h3><div className="member-avatar-group">{team.members.slice(0, 6).map((item) => <Link className="user-avatar-link" to={`/users/${item.id}`} key={item.id} aria-label={`View ${item.name}'s profile`}><Avatar name={item.name} src={resolveMediaURL(item.avatar_url)} /></Link>)}</div></div><div><h3>Current Roles</h3><div className="tag-list">{team.roles.slice(0, 5).map((role) => <span className="tag" key={role.id}>{role.role_name}</span>)}</div></div><div><h3>Required Skills</h3><div className="tag-list">{skills.slice(0, 5).map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></div></div></article>
}

export default function MyTeam() {
  const userId = getCurrentUserId()
  const loader = useCallback(async () => {
    const teamsResponse = await getTeams()
    const teams = Array.isArray(teamsResponse) ? teamsResponse : []
    const details = await Promise.all(teams.map((team) => loadTeamDetail(team.id, false).catch(() => ({ ...team, members: [], roles: [] }))))
    return details.filter((team) => Number(team.owner_id) === userId || team.members.some((member) => Number(member.id) === userId))
  }, [userId])
  const { data = [], loading, error } = useAsync(loader)
  return <div className="my-team-page"><Navbar title="Tim Saya" subtitle="Kelola dan pantau progres team kamu." /><div className="page-body">{error && <div className="error-message">{error}</div>}{loading ? <LoadingSpinner /> : data?.length ? <div className="my-team-list">{data.map((team) => <MyTeamCard key={team.id} team={team} userId={userId} />)}</div> : <div className="my-team-empty"><ApprovedAsset name="emptyTeam" className="my-team-illustration" alt="Belum bergabung dengan team" /><h3>Kamu belum bergabung dengan team manapun.</h3><p>Temukan team yang sesuai dengan skillmu atau buat team sendiri.</p><div><Link className="button button-primary" to="/teams">Cari Team</Link><Link className="button button-secondary" to="/teams/create">Buat Team</Link></div></div>}</div></div>
}
