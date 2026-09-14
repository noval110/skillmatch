import { ArrowRight, Sprout, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function LandingTeamCard({ team }) {
  return <article className="landing-team-card landing-card">
    <div className="landing-team-top"><span className={`landing-team-initial tone-${team.tone}`}>{team.initial}</span><span className="landing-chip">Sample team</span></div>
    <h3>{team.name}</h3><span className="landing-team-category">{team.category}</span>
    <p className="landing-team-description">{team.description}</p>
    <span className="landing-role-label">LOOKING FOR</span><div className="landing-team-skills">{team.roles.map((role) => <span className="landing-chip" key={role}>{role}</span>)}</div>
    <div className="landing-team-meta"><span><UsersRound size={15} />{team.members} members</span>{team.beginner && <span className="landing-beginner"><Sprout size={15} />Beginner friendly</span>}</div>
    <Link className="landing-button landing-button-outline" to="/teams">Explore similar teams<ArrowRight size={15} /></Link>
  </article>
}
