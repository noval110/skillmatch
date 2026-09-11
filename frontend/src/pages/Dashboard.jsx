import CompetitionCategories from '../components/CompetitionCategories'
import { diverseTeams } from '../config/competitions'
import { Bell, Shapes, Target, Trophy, UsersRound } from 'lucide-react'
import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import ApprovedAsset from '../components/ApprovedAsset'
import EmptyState from '../components/EmptyState'
import LoadingSpinner from '../components/LoadingSpinner'
import Navbar from '../components/Navbar'
import SkillIcon from '../components/SkillIcon'
import StatCard from '../components/StatCard'
import TeamCard from '../components/TeamCard'
import useAsync from '../hooks/useAsync'
import { getJoinRequests, getProfile, getProfileSkills, getSkills, getTeams } from '../services/api'
import { getCurrentUserId } from '../utils/auth'
import { hydrateTeam, loadTeamDetail } from '../utils/teams'

export default function Dashboard() {
  const loadDashboard = useCallback(async () => {
    const [profile, profileSkillsResponse, skillsResponse, teamsResponse] = await Promise.all([
      getProfile(), getProfileSkills(), getSkills(), getTeams(),
    ])
    const profileSkills = Array.isArray(profileSkillsResponse) ? profileSkillsResponse : []
    const skills = Array.isArray(skillsResponse) ? skillsResponse : []
    const teams = Array.isArray(teamsResponse) ? teamsResponse : []
    const userId = getCurrentUserId()
    const detailed = await Promise.all(teams.map((team) => loadTeamDetail(team.id, false).catch(() => ({ ...team, members: [], roles: [] }))))
    const myTeams = detailed.filter((team) => Number(team.owner_id) === userId || team.members.some((member) => Number(member.id) === userId))
    const ownedTeams = detailed.filter((team) => Number(team.owner_id) === userId)
    const requestGroups = await Promise.all(ownedTeams.map((team) => getJoinRequests(team.id).catch(() => [])))
    const pendingRequests = requestGroups.flat().filter((request) => request.status === 'pending').length
    const matchedTeams = await Promise.all(detailed.map((team) => hydrateTeam(team, true)))
    const recommended = diverseTeams(matchedTeams)
    const bestMatch = Math.max(0, ...recommended.map((team) => Number(team.matchScore) || 0))
    return { profile, profileSkills, skills, myTeams, pendingRequests, recommended, bestMatch }
  }, [])
  const { data, loading, error } = useAsync(loadDashboard)
  if (loading) return <LoadingSpinner label="Menyiapkan dashboard..." />

  return (
    <div className="dashboard-page">
      <Navbar title={`Hi, ${data?.profile?.name || 'there'} 👋`} subtitle="Find the right team for your next competition." />
      <div className="page-body">
        {error && <div className="error-message">{error}</div>}
        <section className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <small>Find • Connect • Build</small>
            <h2>Find the right team<br /><span>for any competition.</span></h2>
            <p>Meet speakers, researchers, strategists, creators, and developers who share your competition goals.</p>
            <div><Link className="button button-primary" to="/teams">Explore Teams</Link><Link className="button button-secondary" to="/teams/create">Create Team</Link></div>
          </div>
          <ApprovedAsset name="dashboard" alt="SkillMatch team collaborating" />
        </section>
        <CompetitionCategories /><section className="stats-grid">
          <StatCard label="My Teams" value={data?.myTeams?.length || 0} icon={UsersRound} />
          <StatCard label="Join Requests" value={data?.pendingRequests || 0} icon={Bell} tone="orange" />
          <StatCard label="Best Match" value={`${data?.bestMatch || 0}%`} icon={Target} tone="green" />
          <StatCard label="Skills" value={data?.profileSkills?.length || 0} icon={Shapes} tone="slate" />
        </section>
        <div className="section-heading dashboard-section-heading"><h2>Recommended for you</h2><Link to="/teams">View all</Link></div>
        {data?.recommended?.length ? <div className="card-grid dashboard-team-grid">{data.recommended.map((team) => <TeamCard dashboard key={team.id} team={team} roles={team.roles} matchScore={team.matchScore} />)}</div> : <EmptyState title="Belum ada rekomendasi" description="Team baru akan muncul di sini." />}
        <section className="dashboard-lower">
          <div className="dashboard-mini-panel">
            <div className="section-heading"><h2>Explore Skills</h2></div>
            <div className="trending-grid">{data?.skills?.slice(0, 6).map((skill) => <span key={skill.id}><SkillIcon name={skill.name} fallback={Shapes} /><span>{skill.name}</span></span>)}</div>
          </div>
          <div className="dashboard-mini-panel">
            <div className="section-heading"><h2>Recent Activity</h2></div>
            <div className="activity-list">{data?.recommended?.slice(0, 3).map((team) => <Link to={`/teams/${team.id}`} key={team.id}><span className="avatar">{team.name?.charAt(0)}</span><span><strong>{team.name}</strong><small>Available to explore</small></span></Link>)}</div>
          </div>
          <aside className="profile-cta"><Trophy size={30} /><h3>Complete your profile</h3><p>Add more skills to get better team recommendations.</p><Link className="button" to="/profile">Update Profile</Link></aside>
        </section>
      </div>
    </div>
  )
}
