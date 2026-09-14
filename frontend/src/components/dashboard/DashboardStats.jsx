import { Layers, Send, UserRound, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function DashboardStats({ data, readiness }) {
  const items = [
    { label: 'Teams Joined', value: data?.errors.teams ? null : data?.myTeams?.length, icon: UsersRound, note: 'Your teams, including those you lead', to: '/my-team' },
    { label: 'Join Requests', value: data?.pendingRequests, icon: Send, note: 'Incoming · awaiting your review', to: '/join-requests' },
    { label: 'Profile Completion', value: readiness ? `${readiness.percent}%` : null, icon: UserRound, note: readiness ? `${readiness.completed} of ${readiness.total} profile basics` : 'Profile data unavailable', to: '/profile', progress: readiness?.percent },
    { label: 'Skills Added', value: data?.profileSkills?.length, icon: Layers, note: 'Showcase your strengths', to: '/profile' },
  ]
  return <section className="command-stats" aria-label="Your status">{items.map(({ label, value, icon: Icon, note, to, progress }) => <Link className="command-stat command-panel" to={to} key={label}>
    <span className="command-stat-icon"><Icon size={23} /></span><div><h2>{label}</h2><strong>{value ?? '—'}</strong>{progress != null && <progress aria-label="Profile completion" max="100" value={progress} />}<p>{value == null ? 'Unavailable · try again' : note}</p></div>
  </Link>)}</section>
}
