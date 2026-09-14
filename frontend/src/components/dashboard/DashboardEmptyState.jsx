import { ArrowRight, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function DashboardEmptyState({ title, description, profile = false, retry }) {
  return <div className="command-empty command-panel"><span className="command-icon"><Compass size={25} /></span><div><h3>{title}</h3><p>{description}</p><div className="command-actions">{retry ? <button className="button button-secondary" onClick={retry}>Try again</button> : <><Link className="button button-primary" to={profile ? '/profile' : '/teams'}>{profile ? 'Update Profile' : 'Explore Teams'}<ArrowRight size={15} /></Link>{!profile && <Link className="command-link" to="/teams/create">Create Team</Link>}</>}</div></div></div>
}
