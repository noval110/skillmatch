import { Camera, Check, Pencil, Sparkles } from 'lucide-react'
import Avatar from '../Avatar'
import Badge from '../Badge'
import { availabilityLabels, titleCase } from '../../utils/profile'

function Completion({ completion, hasEvidence, onEdit, onComplete }) {
  const missing = completion?.missing || []
  return <aside className="profile-completion" aria-label="Profile completion">
    <div className="profile-completion-score">
      <span className="profile-completion-ring" style={{ '--profile-progress': `${completion?.percent || 0}%` }}><strong>{completion?.percent || 0}%</strong></span>
      <span><strong>Profile Completion</strong><small>{completion?.completed || 0} of {completion?.total || 7} essentials complete</small></span>
    </div>
    {missing.length ? <div className="profile-missing"><span>Still missing</span><ul>{missing.slice(0, 3).map(item => <li key={item.label}>{item.label}</li>)}</ul></div> : <p className="profile-complete-note"><Check size={14} />Your profile essentials are complete.</p>}
    <p className="profile-evidence-note"><Sparkles size={13} />{hasEvidence ? 'Project or achievement evidence added.' : 'Portfolio and achievements are optional credibility boosters.'}</p>
    <button className="button button-primary full-width" type="button" onClick={missing.length ? onComplete : onEdit}><Pencil size={14} />{missing.length ? 'Complete Profile' : 'Edit Profile'}</button>
  </aside>
}

export default function ProfileHero({ profile, photoURL, own = false, completion, hasEvidence = false, photoBusy = false, photoError = '', photoInputRef, onPhoto, onEdit, onComplete, actions }) {
  const role = profile.preferred_role || (own ? 'Add your preferred competition role' : 'Competition team member')
  const experience = titleCase(profile.experience_level || '')
  const availability = availabilityLabels[profile.availability]
  return <header className={`profile-hero ${own ? 'is-own' : 'is-public'}`}>
    <div className="profile-hero-avatar-wrap">
      <Avatar name={profile.name} src={photoURL} className="profile-hero-avatar" />
      {own && <label className="profile-photo-button" aria-label="Change profile photo">
        <Camera size={16} />
        <input ref={photoInputRef} type="file" accept="image/jpeg,image/png" onChange={onPhoto} disabled={photoBusy} />
      </label>}
      {own && <span className="profile-photo-status">{photoBusy ? 'Uploading...' : 'JPG or PNG, up to 5 MB'}</span>}
      {photoError && <span className="profile-photo-error" role="alert">{photoError}</span>}
    </div>
    <div className="profile-hero-copy">
      <span className="profile-eyebrow">{own ? 'Your competition profile' : 'Teammate profile'}</span>
      <h1>{profile.name || 'SkillMatch member'}</h1>
      <p className="profile-role">{role}</p>
      <div className="profile-hero-meta">
        {experience && <Badge tone={profile.experience_level?.toLowerCase()}>{experience}</Badge>}
        {availability && <span>{availability}</span>}
        {profile.project_interest && <span>Interested in {profile.project_interest}</span>}
      </div>
      <p className={`profile-hero-bio ${profile.bio ? '' : 'is-empty'}`}>{profile.bio || (own ? 'Tell teams what you want to build and how you like to contribute.' : 'No bio added yet.')}</p>
    </div>
    {own ? <Completion completion={completion} hasEvidence={hasEvidence} onEdit={onEdit} onComplete={onComplete || onEdit} /> : <div className="profile-hero-actions">{actions}</div>}
  </header>
}
