import { Pencil } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'
import Modal from '../components/Modal'
import Navbar from '../components/Navbar'
import ProfileShowcase from '../components/ProfileShowcase'
import SkillSelect from '../components/SkillSelect'
import CompetitionFit from '../components/profile/CompetitionFit'
import ProfileHero from '../components/profile/ProfileHero'
import ProfileSkills from '../components/profile/ProfileSkills'
import useAsync from '../hooks/useAsync'
import { addProfileSkill, deleteProfileSkill, getProfile, getProfileSkills, getSkills, resolveMediaURL, updateProfile, updateProfileSkill, uploadProfilePhoto } from '../services/api'
import { getProfileCompletion } from '../utils/profile'
import '../styles/profile.css'

export default function Profile() {
  const loader = useCallback(async () => {
    const [profile, userSkillsResponse, skillsResponse] = await Promise.all([getProfile(), getProfileSkills(), getSkills()])
    return {
      profile,
      userSkills: Array.isArray(userSkillsResponse) ? userSkillsResponse : [],
      skills: Array.isArray(skillsResponse) ? skillsResponse : [],
    }
  }, [])
  const { data, loading, error, reload } = useAsync(loader)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileBusy, setProfileBusy] = useState(false)
  const [skillOpen, setSkillOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState(null)
  const [formError, setFormError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [deletingSkill, setDeletingSkill] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [showcase, setShowcase] = useState(null)
  const photoInput = useRef(null)

  const profile = data?.profile || {}
  const userSkills = data?.userSkills || []
  const completion = getProfileCompletion(data?.profile, data?.userSkills)
  const hasEvidence = Boolean(showcase?.portfolio?.length || showcase?.achievements?.length)
  const openProfile = () => { setFormError(''); setProfileOpen(true) }
  const openSkill = (skill = null) => { setEditingSkill(skill); setFormError(''); setSkillOpen(true) }
  const completeProfile = () => {
    const missing = new Set(completion?.missing.map(item => item.label))
    if (['Bio', 'Experience level', 'Preferred role', 'Availability', 'Competition interest'].some(label => missing.has(label))) openProfile()
    else if (missing.has('At least one skill')) openSkill()
    else if (missing.has('Profile photo')) photoInput.current?.click()
    else openProfile()
  }

  const syncSavedUser = updated => {
    let currentUser = {}
    try { currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}') } catch { currentUser = {} }
    localStorage.setItem('currentUser', JSON.stringify({ ...currentUser, ...updated }))
    window.dispatchEvent(new Event('profile-updated'))
  }
  const saveProfile = async event => {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const body = {
      name: values.get('name').trim(),
      bio: values.get('bio').trim(),
      experience_level: values.get('experience_level'),
      preferred_role: values.get('preferred_role').trim(),
      availability: values.get('availability'),
      project_interest: values.get('project_interest').trim(),
    }
    if (!body.name) { setFormError('Name cannot be blank.'); return }
    setProfileBusy(true); setFormError('')
    try {
      await updateProfile(body)
      syncSavedUser({ name: body.name })
      setProfileOpen(false)
      await reload()
    } catch (err) { setFormError(err.message) }
    finally { setProfileBusy(false) }
  }
  const saveSkill = async event => {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setProfileBusy(true); setFormError('')
    try {
      if (editingSkill) await updateProfileSkill(editingSkill.id, { level: values.get('level') })
      else await addProfileSkill({ skill_id: Number(values.get('skill_id')), level: values.get('level') })
      setSkillOpen(false)
      await reload()
    } catch (err) { setFormError(err.message) }
    finally { setProfileBusy(false) }
  }
  const removeSkill = async () => {
    setDeleteBusy(true); setDeleteError('')
    try {
      await deleteProfileSkill(deletingSkill.id)
      setDeletingSkill(null)
      await reload()
    } catch (err) { setDeleteError(err.message) }
    finally { setDeleteBusy(false) }
  }
  const changePhoto = async event => {
    const photo = event.target.files?.[0]
    event.target.value = ''
    if (!photo) return
    if (!['image/jpeg', 'image/png'].includes(photo.type)) { setPhotoError('Use a JPG or PNG image.'); return }
    if (photo.size > 5 * 1024 * 1024) { setPhotoError('Profile photos must be 5 MB or smaller.'); return }
    setPhotoError(''); setPhotoUploading(true)
    try {
      const result = await uploadProfilePhoto(photo)
      syncSavedUser({ avatar_url: result.avatar_url })
      await reload()
    } catch (err) { setPhotoError(err.message) }
    finally { setPhotoUploading(false) }
  }

  return <div className="profile-page">
    <Navbar title="My Profile" subtitle="Show teams what you can contribute." action={false} userProfile={data?.profile ?? null} />
    <div className="page-body profile-body">
      {loading && !data ? <LoadingSpinner label="Loading your profile..." /> : error && !data ? <section className="profile-load-error" role="alert"><h1>Your profile could not be loaded.</h1><p>{error}</p><button className="button button-primary" type="button" onClick={reload}>Try again</button></section> : <>
        {error && <div className="profile-inline-error" role="alert"><span>Some profile details may be out of date.</span><button type="button" onClick={reload}>Try again</button></div>}
        <ProfileHero profile={profile} photoURL={resolveMediaURL(profile.avatar_url)} own completion={completion} hasEvidence={hasEvidence} photoBusy={photoUploading} photoError={photoError} photoInputRef={photoInput} onPhoto={changePhoto} onEdit={openProfile} onComplete={completeProfile} />
        <div className="profile-content-grid">
          <main className="profile-primary-column">
            <div className="profile-section-group">
              <section className="profile-content-section profile-about-section">
                <header className="profile-section-heading"><div><span className="profile-section-kicker">Introduction</span><h2>About</h2></div><button className="profile-text-button" type="button" onClick={openProfile}><Pencil size={13} />Edit</button></header>
                <p className={profile.bio ? 'profile-about-copy' : 'profile-about-copy is-empty'}>{profile.bio || 'Tell teams what you want to build and how you like to contribute.'}</p>
              </section>
              <ProfileSkills skills={userSkills} editable onAdd={() => openSkill()} onEdit={openSkill} onRemove={skill => { setDeleteError(''); setDeletingSkill(skill) }} />
            </div>
            <ProfileShowcase editable onDataChange={setShowcase} />
          </main>
          <aside className="profile-secondary-column"><CompetitionFit profile={profile} onEdit={openProfile} /><p className="profile-matching-note">Complete profiles improve the quality of team recommendations by giving SkillMatch more real information to compare.</p></aside>
        </div>
      </>}
    </div>

    <Modal open={profileOpen} title="Edit Profile" onClose={() => { if (!profileBusy) setProfileOpen(false) }}><form className="stack-form profile-edit-form" onSubmit={saveProfile}>
      {formError && <div className="error-message" role="alert">{formError}</div>}
      <label><span>Name</span><input name="name" defaultValue={profile.name} maxLength={100} required /></label>
      <label><span>Bio <small>(optional)</small></span><textarea name="bio" defaultValue={profile.bio} rows="5" maxLength={1000} placeholder="What do you want to build, and how do you contribute to a team?" /></label>
      <div className="profile-edit-grid"><label><span>Experience Level</span><select name="experience_level" defaultValue={profile.experience_level?.toLowerCase() || 'beginner'}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><label><span>Availability <small>(optional)</small></span><select name="availability" defaultValue={profile.availability || ''}><option value="">Not specified</option><option value="weekday">Weekdays</option><option value="weekend">Weekends</option><option value="flexible">Flexible</option></select></label></div>
      <label><span>Preferred Role <small>(optional)</small></span><input name="preferred_role" maxLength={100} defaultValue={profile.preferred_role || ''} placeholder="Frontend Developer, Researcher, Presenter..." /></label>
      <label><span>Competition Interest <small>(optional)</small></span><input name="project_interest" maxLength={100} defaultValue={profile.project_interest || ''} placeholder="Hackathon, Debate, Business Case..." /></label>
      <button className="button button-primary" disabled={profileBusy}>{profileBusy ? 'Saving...' : 'Save Changes'}</button>
    </form></Modal>
    <Modal open={skillOpen} title={editingSkill ? `Edit ${editingSkill.name}` : 'Add Skill'} onClose={() => { if (!profileBusy) setSkillOpen(false) }}><form className="stack-form" onSubmit={saveSkill}>
      {formError && <div className="error-message" role="alert">{formError}</div>}
      {!editingSkill && <SkillSelect skills={(data?.skills || []).filter(skill => !userSkills.some(owned => owned.id === skill.id))} />}
      <label><span>Level</span><select name="level" defaultValue={editingSkill?.level || 'beginner'}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
      <button className="button button-primary" disabled={profileBusy}>{profileBusy ? 'Saving...' : 'Save Skill'}</button>
    </form></Modal>
    <ConfirmDialog open={Boolean(deletingSkill)} title="Remove this skill?" message={`${deletingSkill?.name || 'This skill'} will be removed from your profile.`} confirmLabel="Remove Skill" cancelLabel="Cancel" loading={deleteBusy} error={deleteError} onClose={() => { if (!deleteBusy) setDeletingSkill(null) }} onConfirm={removeSkill} />
  </div>
}
