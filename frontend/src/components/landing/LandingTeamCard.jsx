import { UsersRound } from 'lucide-react'
import Avatar from '../Avatar'

export default function LandingTeamCard({ team }) {
  return (
    <article className="landing-team-card">
      <div className="landing-team-cover"><img src={team.cover} alt={`${team.name} cover`} /><span className="landing-status">Open</span></div>
      <div className="landing-team-title"><span>{team.initial}</span><div><h3>{team.name}</h3><p>{team.category}</p></div></div>
      <p className="landing-member-count"><UsersRound size={13} />{team.members} members</p>
      <div className="landing-team-skills">{team.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
      <div className="landing-team-bottom"><div className="landing-avatar-stack">{team.people.map((person) => <Avatar name={person} size="tiny" key={person} />)}<span>+{team.extra}</span></div><div className="landing-match"><span>Match with you <b>{team.match}%</b></span><i><em style={{ width: `${team.match}%` }} /></i></div></div>
    </article>
  )
}
