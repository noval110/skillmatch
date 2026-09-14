import { ArrowLeft, ArrowUpRight, CalendarDays, MessageCircle, Pencil, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import LoadingSpinner from '../components/LoadingSpinner'
import ProfileShowcase from '../components/ProfileShowcase'
import CompetitionFit from '../components/profile/CompetitionFit'
import ProfileHero from '../components/profile/ProfileHero'
import ProfileSkills from '../components/profile/ProfileSkills'
import { createConversation, getPublicProfile, resolveMediaURL } from '../services/api'
import { getCurrentUserId } from '../utils/auth'
import '../styles/profile.css'

export default function PublicProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [messageBusy, setMessageBusy] = useState(false)
  const [messageError, setMessageError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ id, loading: true, profile: null, status: 0, error: '' })

  useEffect(() => {
    let active = true
    getPublicProfile(id).then(
      profile => { if (active) setState({ id, loading: false, profile, status: 200, error: '' }) },
      error => { if (active) setState({ id, loading: false, profile: null, status: error.status || 500, error: error.message }) },
    )
    return () => { active = false }
  }, [id, attempt])

  const loading = state.id !== id || state.loading
  const profile = state.profile
  const isSelf = Number(profile?.id) === getCurrentUserId()
  const skills = Array.isArray(profile?.skills) ? profile.skills : []
  const teams = Array.isArray(profile?.teams) ? profile.teams : []
  const joined = profile?.created_at ? new Date(profile.created_at) : null
  const joinedLabel = joined && !Number.isNaN(joined.getTime()) ? joined.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''
  const retry = () => { setState({ id, loading: true, profile: null, status: 0, error: '' }); setAttempt(value => value + 1) }
  const startChat = async () => {
    setMessageBusy(true); setMessageError('')
    try {
      const conversation = await createConversation(id)
      navigate(`/messages/${conversation.id}`)
    } catch (err) { setMessageError(err.message) }
    finally { setMessageBusy(false) }
  }

  const actions = isSelf ? <Link className="button button-primary" to="/profile"><Pencil size={15} />Edit My Profile</Link> : <>
    <button className="button button-primary" type="button" disabled={messageBusy} onClick={startChat}><MessageCircle size={15} />{messageBusy ? 'Opening...' : 'Message'}</button>
    {teams.length > 0 && <a className="button button-secondary" href="#member-teams"><UsersRound size={15} />View Teams</a>}
  </>

  return <div className="profile-page public-profile-page">
    <Navbar title="Member Profile" subtitle="Evaluate fit for your next competition team." action={false} />
    <div className="page-body profile-body">
      <Link to="/teams" className="profile-back-link"><ArrowLeft size={15} />Back to Teams</Link>
      {loading ? <LoadingSpinner label="Loading member profile..." /> : !profile ? <section className="profile-load-error" role="alert">
        <UsersRound size={30} />
        <h1>{[400, 404].includes(state.status) ? 'Member not found' : 'This profile could not be loaded.'}</h1>
        <p>{[400, 404].includes(state.status) ? 'This member may no longer be available on SkillMatch.' : state.error || 'Please try again in a moment.'}</p>
        <div>{![400, 404].includes(state.status) && <button className="button button-secondary" type="button" onClick={retry}>Try again</button>}<Link className="button button-primary" to="/teams">Explore Teams</Link></div>
      </section> : <>
        <ProfileHero profile={profile} photoURL={resolveMediaURL(profile.profile_photo_url)} actions={actions} />
        {messageError && <div className="profile-message-error" role="alert"><span>Could not open this conversation: {messageError}</span><button type="button" onClick={startChat}>Try again</button></div>}
        <div className="profile-public-context">{joinedLabel && <span><CalendarDays size={14} />SkillMatch member since {joinedLabel}</span>}<span><UsersRound size={14} />{teams.length} {teams.length === 1 ? 'team' : 'teams'} listed</span></div>
        <div className="profile-content-grid">
          <main className="profile-primary-column">
            <div className="profile-section-group">
              <section className="profile-content-section profile-about-section"><header className="profile-section-heading"><div><span className="profile-section-kicker">Introduction</span><h2>About</h2></div></header><p className={profile.bio ? 'profile-about-copy' : 'profile-about-copy is-empty'}>{profile.bio || 'No bio added yet.'}</p></section>
              <ProfileSkills skills={skills} />
            </div>
            <ProfileShowcase showcase={profile} />
          </main>
          <aside className="profile-secondary-column">
            <CompetitionFit profile={profile} />
            <section className="profile-teams-panel" id="member-teams"><header><span className="profile-section-kicker">Team experience</span><h2>Teams</h2><p>Current SkillMatch memberships visible to teammates.</p></header>
              {teams.length ? <div className="profile-team-list">{teams.map(team => <Link key={team.id} to={`/teams/${team.id}`}><span className="profile-team-icon"><UsersRound size={17} /></span><span><strong>{team.name}</strong><small>{[team.role || 'Member', team.competition_type].filter(Boolean).join(' · ')}</small></span><ArrowUpRight size={15} /></Link>)}</div> : <p className="profile-side-empty">This member has not joined any teams yet.</p>}
            </section>
          </aside>
        </div>
      </>}
    </div>
  </div>
}
