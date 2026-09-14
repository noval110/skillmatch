import { ArrowRight, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import RecommendationCard from '../components/RecommendationCard'
import DashboardHero from '../components/dashboard/DashboardHero'
import DashboardStats from '../components/dashboard/DashboardStats'
import ActiveTeamCard from '../components/dashboard/ActiveTeamCard'
import CompetitionJourney from '../components/dashboard/CompetitionJourney'
import DashboardEmptyState from '../components/dashboard/DashboardEmptyState'
import TeamApplicationDialog from '../components/dashboard/TeamApplicationDialog'
import useAsync from '../hooks/useAsync'
import { loadDashboard } from '../services/dashboard'
import { getProfileReadiness } from '../utils/dashboard'
import '../styles/dashboard.css'

export default function Dashboard() {
  const { data, loading, error, reload } = useAsync(loadDashboard)
  const [selectedTeam, setSelectedTeam] = useState('')
  const [application, setApplication] = useState(null)
  const [sentRequests, setSentRequests] = useState([])
  const readiness = getProfileReadiness(data?.profile, data?.profileSkills)
  const teams = data?.myTeams || []
  const activeTeam = teams.find(team => String(team.id) === selectedTeam) || teams[0]
  const hasTeam = teams.length ? true : data?.errors.teams ? null : data ? false : null

  return <div className="command-page">
    <Navbar search action={false} userProfile={data?.profile ?? null} />
    <div className="command-layout">
      <div className="command-main">
        {error && <div className="command-inline-error" role="alert">Dashboard unavailable: {error}<button onClick={reload}>Retry</button></div>}
        {!loading && data && Object.keys(data.errors).length > 0 && <div className="command-data-warning" role="status"><span>Some dashboard data couldn't be loaded. Unavailable values are shown as —.</span><button onClick={reload}>Retry</button></div>}
        <DashboardHero profile={data?.profile} profileReadiness={readiness} />
        {loading ? <div className="command-loading" role="status" aria-label="Loading your dashboard"><div className="command-stats">{[1, 2, 3, 4].map(item => <div key={item} className="command-skeleton stat-skeleton" />)}</div><div className="command-skeleton active-skeleton" /><span className="sr-only">Loading teams and recommendations...</span></div> : <>
          <DashboardStats data={data} readiness={readiness} />
          {teams.length > 1 && <label className="command-team-switch">Working with<select value={activeTeam.id} onChange={event => setSelectedTeam(event.target.value)}>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select><Link className="command-link" to="/my-team">All your teams<ArrowRight size={14} /></Link></label>}
          {activeTeam ? <ActiveTeamCard key={activeTeam.id} team={activeTeam} /> : data?.errors.teams || error ? <DashboardEmptyState title="Your teams couldn't be loaded." description="Retry to see your current team and its role coverage." retry={reload} /> : <DashboardEmptyState title="You haven't joined a team yet." description="Discover teams that match your skills and competition goals." />}
          <section className="command-recommendations"><header className="command-section-heading"><div><h2>Recommended for You</h2><p>Teams with room for your skills and ambitions.</p></div><Link className="command-link" to="/teams">View all<ArrowRight size={14} /></Link></header>
            {data?.errors.recommendations || error ? <DashboardEmptyState title="Recommendations are unavailable." description="Your team suggestions couldn't be loaded. Please try again." retry={reload} /> : data?.recommended?.length ? <div className="command-recommendation-grid">{data.recommended.slice(0, 3).map(recommendation => <RecommendationCard key={recommendation.team.id} recommendation={recommendation} onApply={setApplication} applied={sentRequests.includes(recommendation.team.id)} />)}</div> : <DashboardEmptyState title="Let's find your next opportunity." description="Add your skills and competition interests to your profile, or explore teams with open roles." profile />}
            {sentRequests.length > 0 && <p className="command-sent-note" role="status">Your request has been sent. Team decisions will appear in Notifications.</p>}
          </section>
        </>}
      </div>
      <aside className="command-rail" aria-label="Your competition progress">
        <CompetitionJourney readiness={readiness} hasTeam={hasTeam} />
        <section className="command-panel command-opportunities"><span className="command-icon"><Trophy size={24} /></span><span className="command-coming-soon">COMING SOON</span><h2>Competition opportunities</h2><p>A place to discover your next challenge. A live competition directory is on the way.</p><span className="command-rail-note">For now, explore teams by competition type.</span><Link className="command-link" to="/teams">Explore Teams<ArrowRight size={15} /></Link></section>
        <Link className="command-panel command-rail-cta" to={hasTeam ? '/messages' : '/profile'}><span className="command-icon"><Trophy size={25} /></span><span>{hasTeam ? 'Turn a connection into collaboration.' : 'Turn your skills into real opportunities.'}</span><ArrowRight size={18} /></Link>
      </aside>
    </div>
    {application && <TeamApplicationDialog key={application.team.id} recommendation={application} onClose={() => setApplication(null)} onSent={id => setSentRequests(ids => [...ids, id])} />}
  </div>
}
