import SkillSelect from '../components/SkillSelect'
import { skillCategory } from '../config/competitions'
import { Camera, Mail, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import Avatar from '../components/Avatar'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import LoadingSpinner from '../components/LoadingSpinner'
import Modal from '../components/Modal'
import Navbar from '../components/Navbar'
import useAsync from '../hooks/useAsync'
import { addProfileSkill, deleteProfileSkill, getProfile, getProfileSkills, getSkills, getTeams, resolveMediaURL, updateProfile, updateProfileSkill, uploadProfilePhoto } from '../services/api'
import { getCurrentUserId } from '../utils/auth'
import { loadTeamDetail } from '../utils/teams'

const capitalize = (value) => value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : ''

export default function Profile() {
  const loader = useCallback(async () => {
    const [profile, userSkillsResponse, skillsResponse, teamsResponse] = await Promise.all([getProfile(), getProfileSkills(), getSkills(), getTeams()])
    const userSkills = Array.isArray(userSkillsResponse) ? userSkillsResponse : []
    const skills = Array.isArray(skillsResponse) ? skillsResponse : []
    const teams = Array.isArray(teamsResponse) ? teamsResponse : []
    const userId = getCurrentUserId()
    const details = await Promise.all(teams.map((team) => loadTeamDetail(team.id, true).catch(() => ({ ...team, members: [], roles: [] }))))
    const joined = details.filter((team) => Number(team.owner_id) === userId || team.members.some((member) => Number(member.id) === userId))
    const scores = details.flatMap((team) => team.roles || []).map((role) => Number(role.match?.match_score)).filter(Number.isFinite)
    return { profile, userSkills, skills, teamsJoined: joined.length, bestMatch: scores.length ? Math.max(...scores) : 0 }
  }, [])
  const { data, loading, error, reload } = useAsync(loader)
  const [profileOpen, setProfileOpen] = useState(false)
  const [skillOpen, setSkillOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState(null)
  const [formError, setFormError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [deletingSkill, setDeletingSkill] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const photoInput = useRef(null)
  if (loading) return <LoadingSpinner label="Memuat profil..." />
  const profile = data?.profile || {}
  const openProfile = () => { setFormError(''); setProfileOpen(true) }
  const saveProfile = async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); try { await updateProfile({ name: values.get('name'), bio: values.get('bio'), experience_level: values.get('experience_level'), preferred_role: values.get('preferred_role'), availability: values.get('availability'), project_interest: values.get('project_interest') }); setProfileOpen(false); reload() } catch (err) { setFormError(err.message) } }
  const openSkill = (skill = null) => { setEditingSkill(skill); setFormError(''); setSkillOpen(true) }
  const saveSkill = async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); try { if (editingSkill) await updateProfileSkill(editingSkill.id, { level: values.get('level') }); else await addProfileSkill({ skill_id: Number(values.get('skill_id')), level: values.get('level') }); setSkillOpen(false); reload() } catch (err) { setFormError(err.message) } }
  const askRemoveSkill = (skill) => { setDeleteError(''); setDeletingSkill(skill) }
  const removeSkill = async () => {
    setDeleteBusy(true); setDeleteError('')
    try { await deleteProfileSkill(deletingSkill.id); setDeletingSkill(null); await reload() }
    catch (err) { setDeleteError(err.message) }
    finally { setDeleteBusy(false) }
  }
  const changePhoto = async (event) => {
    const photo = event.target.files?.[0]
    event.target.value = ''
    if (!photo) return
    if (!['image/jpeg', 'image/png'].includes(photo.type)) { setPhotoError('Gunakan gambar JPG atau PNG.'); return }
    if (photo.size > 5 * 1024 * 1024) { setPhotoError('Ukuran foto maksimal 5 MB.'); return }
    setPhotoError('')
    setPhotoUploading(true)
    try {
      const result = await uploadProfilePhoto(photo)
      let currentUser = {}
      try { currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}') } catch { currentUser = {} }
      localStorage.setItem('currentUser', JSON.stringify({ ...currentUser, avatar_url: result.avatar_url }))
      window.dispatchEvent(new Event('profile-updated'))
      await reload()
    } catch (err) { setPhotoError(err.message) }
    finally { setPhotoUploading(false) }
  }

  return <div className="profile-page"><Navbar title="Profil Saya" subtitle="Tampilkan skill, pengalaman, dan minat kompetisimu." action={false} /><div className="page-body">{error && <div className="error-message">{error}</div>}<div className="profile-layout"><aside className="profile-identity"><div className="profile-photo-control"><Avatar name={profile.name} src={resolveMediaURL(profile.avatar_url)} className="profile-avatar" /><button type="button" onClick={() => photoInput.current?.click()} disabled={photoUploading} aria-label="Ubah foto profil"><Camera size={16} /></button><input ref={photoInput} type="file" accept="image/jpeg,image/png" onChange={changePhoto} /></div><button className="profile-photo-link" type="button" onClick={() => photoInput.current?.click()} disabled={photoUploading}>{photoUploading ? 'Mengunggah...' : 'Ubah foto profil'}</button>{photoError && <p className="profile-photo-error">{photoError}</p>}<h2>{profile.name}</h2><p>{capitalize(profile.experience_level)} · Competition Member</p><span><Mail size={13} />{profile.email}</span></aside><div className="profile-main"><section className="panel profile-about"><div className="section-heading"><h2>Tentang Saya</h2><button className="button button-secondary button-small" onClick={openProfile}><Pencil size={13} />Edit Profil</button></div><p>{profile.bio || 'Belum ada bio. Ceritakan sedikit tentang dirimu.'}</p><dl className="profile-preferences"><div><dt>Preferred Role</dt><dd>{profile.preferred_role || 'Belum diisi'}</dd></div><div><dt>Availability</dt><dd>{capitalize(profile.availability) || 'Belum diisi'}</dd></div><div><dt>Competition Interest</dt><dd>{profile.project_interest || 'Belum diisi'}</dd></div></dl>{(!profile.preferred_role || !profile.availability || !profile.project_interest) && <div className="complete-profile-prompt"><p>Lengkapi profil untuk mendapatkan match yang lebih akurat.</p><button className="button button-secondary button-small" onClick={openProfile}>Complete Profile</button></div>}</section><section className="panel profile-skills"><div className="section-heading"><h2>Skills</h2><button className="button button-secondary button-small" onClick={() => openSkill()}><Plus size={13} />Tambah Skill</button></div>{data?.userSkills?.length ? <div className="profile-skill-groups">{[...new Set(data.userSkills.map(skillCategory))].map(category => <section key={category}><h3>{category}</h3><div className="profile-skill-chips">{data.userSkills.filter(skill => skillCategory(skill) === category).map((skill) => <div className="profile-skill-chip" key={skill.id}><span>{skill.name}</span><Badge tone={skill.level}>{capitalize(skill.level)}</Badge><button onClick={() => openSkill(skill)} aria-label={`Edit ${skill.name}`}><Pencil size={12} /></button><button onClick={() => askRemoveSkill(skill)} aria-label={`Hapus ${skill.name}`}><Trash2 size={12} /></button></div>)}</div></section>)}</div> : <EmptyState title="Belum ada skill" description="Tambahkan skill agar rekomendasi match lebih akurat." />}</section></div></div><section className="profile-stats"><span>Teams Joined<strong>{data?.teamsJoined || 0}</strong></span><span>Skills<strong>{data?.userSkills?.length || 0}</strong></span><span>Best Match<strong>{data?.bestMatch || 0}%</strong></span></section></div><Modal open={profileOpen} title="Edit Profile" onClose={() => setProfileOpen(false)}><form className="stack-form" onSubmit={saveProfile}>{formError && <div className="error-message">{formError}</div>}<label><span>Name</span><input name="name" defaultValue={profile.name} required /></label><label><span>Bio</span><textarea name="bio" defaultValue={profile.bio} rows="4" /></label><label><span>Experience Level</span><select name="experience_level" defaultValue={profile.experience_level?.toLowerCase() || 'beginner'}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><label><span>Preferred Role <small>(optional)</small></span><input name="preferred_role" maxLength={100} defaultValue={profile.preferred_role || ''} placeholder="Second Speaker, Researcher, Developer..." /></label><label><span>Availability <small>(optional)</small></span><select name="availability" defaultValue={profile.availability || ''}><option value="">Not specified</option><option value="weekday">Weekday</option><option value="weekend">Weekend</option><option value="flexible">Flexible</option></select></label><label><span>Competition Interest <small>(optional)</small></span><input name="project_interest" maxLength={100} defaultValue={profile.project_interest || ''} placeholder="Debate, Business Case, Research, Hackathon..." /></label><button className="button button-primary">Save Changes</button></form></Modal><Modal open={skillOpen} title={editingSkill ? 'Edit Skill' : 'Add Skill'} onClose={() => setSkillOpen(false)}><form className="stack-form" onSubmit={saveSkill}>{formError && <div className="error-message">{formError}</div>}{!editingSkill && <SkillSelect skills={(data?.skills || []).filter(skill => !data.userSkills.some(owned => owned.id === skill.id))} />}<label><span>Level</span><select name="level" defaultValue={editingSkill?.level || 'beginner'}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><button className="button button-primary">Save Skill</button></form></Modal><ConfirmDialog open={Boolean(deletingSkill)} title="Hapus skill?" message={`${deletingSkill?.name || 'Skill'} akan dihapus dari profil kamu.`} confirmLabel="Hapus Skill" loading={deleteBusy} error={deleteError} onClose={() => setDeletingSkill(null)} onConfirm={removeSkill} /></div>
}
