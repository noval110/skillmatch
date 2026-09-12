import { ArrowLeft, ArrowUpRight, CalendarDays, Clock3, Compass, Sprout, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getCurrentUserId } from '../utils/auth'
import Avatar from '../components/Avatar'
import ProfileShowcase from '../components/ProfileShowcase'
import Badge from '../components/Badge'
import LoadingSpinner from '../components/LoadingSpinner'
import Navbar from '../components/Navbar'
import SkillIcon from '../components/SkillIcon'
import { createConversation, getPublicProfile, resolveMediaURL } from '../services/api'
import './public-profile.css'

const label = (value) => value ? value.charAt(0).toUpperCase() + value.slice(1) : ''
const availabilityLabels = { weekday: 'Weekdays', weekend: 'Weekends', flexible: 'Flexible' }

export default function PublicProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [messageBusy, setMessageBusy] = useState(false)
  const [messageError, setMessageError] = useState('')
  const startChat = async () => {
    setMessageBusy(true); setMessageError('')
    try { const conversation = await createConversation(id); navigate(`/messages/${conversation.id}`) }
    catch (err) { setMessageError(err.message) } finally { setMessageBusy(false) }
  }
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ id, loading: true, profile: null, status: 0 })

  useEffect(() => {
    let active = true
    getPublicProfile(id).then(
      (profile) => { if (active) setState({ id, loading: false, profile, status: 200 }) },
      (error) => { if (active) setState({ id, loading: false, profile: null, status: error.status || 500 }) },
    )
    // A slow response for the previous route must never replace the next user's profile.
    return () => { active = false }
  }, [id, attempt])

  const loading = state.id !== id || state.loading
  const profile = state.profile
  const retry = () => {
    setState({ id, loading: true, profile: null, status: 0 })
    setAttempt((value) => value + 1)
  }
  const joined = profile?.created_at ? new Date(profile.created_at) : null
  const joinedLabel = joined && !Number.isNaN(joined.getTime())
    ? joined.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''
  const skills = Array.isArray(profile?.skills) ? profile.skills : []
  const teams = Array.isArray(profile?.teams) ? profile.teams : []
  const categories = [...new Set(skills.map((skill) => skill.category || 'Other'))]

  return <div className="public-profile-page">
    <Navbar title="Member Profile" subtitle="Get to know your next teammate." action={false} />
    <div className="page-body public-profile-body">
      <Link to="/teams" className="back-link"><ArrowLeft size={15} />Back to Teams</Link>
      {loading ? <LoadingSpinner label="Loading public profile..." /> : !profile ?
        <section className="panel public-profile-error" role="alert">
          <UsersRound size={30} aria-hidden="true" />
          <h1>{state.status === 404 || state.status === 400 ? 'User not found' : 'Unable to load this profile'}</h1>
          <p>{state.status === 404 || state.status === 400 ? 'This member may no longer be on SkillMatch.' : 'Something went wrong. Please try again in a moment.'}</p>
          <div>{state.status !== 404 && state.status !== 400 && <button className="button button-secondary" onClick={retry}>Try again</button>}<Link className="button button-primary" to="/teams">Back to Teams</Link></div>
        </section> : <>
          <header className="panel public-profile-header">
            <Avatar name={profile.name} src={resolveMediaURL(profile.profile_photo_url)} className="public-profile-avatar" />
            <div className="public-profile-heading">
              <span className="public-profile-eyebrow">SkillMatch member</span>
              <h1>{profile.name}</h1>
              <p>{profile.preferred_role || 'Exploring new ways to contribute'}</p>
              <div className="public-profile-badges">
                {profile.experience_level && <Badge tone={profile.experience_level.toLowerCase()}>{profile.experience_level.toLowerCase() === 'beginner' && <Sprout size={13} aria-hidden="true" />}{label(profile.experience_level)}</Badge>}
                {joinedLabel && <span className="public-profile-joined"><CalendarDays size={13} aria-hidden="true" />Joined {joinedLabel}</span>}
              </div>
            </div>
            {Number(profile.id) !== getCurrentUserId() && <button className="button button-primary" disabled={messageBusy} onClick={startChat}>{messageBusy ? 'Opening...' : 'Message'}</button>}
          </header>
          {messageError && <div className="error-message" role="alert">{messageError}</div>}
          <div className="public-profile-grid">
            <div className="public-profile-main">
              <section className="panel public-profile-section"><h2>About</h2><p className="public-profile-bio">{profile.bio || 'This member has not added a bio yet.'}</p></section>
              <section className="panel public-profile-section"><div className="section-heading"><h2>Skills</h2><span className="public-profile-count">{skills.length}</span></div>
                {skills.length ? <div className="public-profile-skill-groups">{categories.map((category) => <section key={category}><h3>{category}</h3><div className="public-profile-skills">{skills.filter((skill) => (skill.category || 'Other') === category).map((skill) => <div className="public-profile-skill" key={skill.id}><SkillIcon name={skill.name} /><span>{skill.name}</span>{skill.level && <Badge tone={skill.level.toLowerCase()}>{label(skill.level)}</Badge>}</div>)}</div></section>)}</div> : <p>No skills added yet.</p>}
              </section>
              <ProfileShowcase showcase={profile} />
              <section className="panel public-profile-section"><div className="section-heading"><h2>Teams</h2><span className="public-profile-count">{teams.length}</span></div>
                {teams.length ? <div className="public-profile-teams">{teams.map((team) => <Link className="public-profile-team" key={team.id} to={`/teams/${team.id}`}><span className="public-profile-team-icon"><UsersRound size={19} aria-hidden="true" /></span><span><strong>{team.name}</strong><small>{team.role || 'Member'}</small></span><ArrowUpRight size={17} aria-hidden="true" /></Link>)}</div> : <p>This member has not joined any teams yet.</p>}
              </section>
            </div>
            <aside className="public-profile-preferences">
              <section className="panel public-profile-section"><Compass size={20} className="public-profile-section-icon" aria-hidden="true" /><h2>Competition Interests</h2><p>{profile.project_interest || 'No competition interests shared yet.'}</p></section>
              <section className="panel public-profile-section"><Clock3 size={20} className="public-profile-section-icon" aria-hidden="true" /><h2>Availability</h2><p>{availabilityLabels[profile.availability] || label(profile.availability) || 'Availability not shared yet.'}</p></section>
            </aside>
          </div>
        </>}
    </div>
  </div>
}
