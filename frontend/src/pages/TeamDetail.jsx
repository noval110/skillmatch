import CompetitionFields from '../components/CompetitionFields'
import CompetitionBadge from '../components/CompetitionBadge'
import SkillSelect from '../components/SkillSelect'
import { rolesFor, skillsForRole } from '../config/competitions'
import TeamCompatibilityBadges from '../components/TeamCompatibilityBadges'
import TeamPreferenceFields from '../components/TeamPreferenceFields'
import ExperiencePreferenceField from '../components/ExperiencePreferenceField'
import { experienceLabel } from '../utils/matching'
import MatchBreakdown from '../components/MatchBreakdown'
import { ArrowLeft, Edit3, LogOut, Plus, Trash2, UserMinus, Users } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Badge from '../components/Badge'
import Avatar from '../components/Avatar'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import LoadingSpinner from '../components/LoadingSpinner'
import Modal from '../components/Modal'
import Navbar from '../components/Navbar'
import RoleCard from '../components/RoleCard'
import SkillBadge from '../components/SkillBadge'
import useAsync from '../hooks/useAsync'
import { addRoleSkill, createTeamRole, deleteRoleSkill, deleteTeam, deleteTeamRole, getSkills, joinTeam, leaveTeam, removeTeamMember, resolveMediaURL, updateTeam, updateTeamRole } from '../services/api'
import { getCurrentUserId } from '../utils/auth'
import { loadTeamDetail } from '../utils/teams'

export default function TeamDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const loader = useCallback(async () => {
    const [team, skills] = await Promise.all([loadTeamDetail(id, true), getSkills()])
    return { team, skills: Array.isArray(skills) ? skills : [] }
  }, [id])
  const { data, loading, error, reload } = useAsync(loader)
  const [modal, setModal] = useState(null)
  const [selectedRoleId, setSelectedRoleId] = useState(null)
  const [formError, setFormError] = useState('')
  const [activeTab, setActiveTab] = useState('roles')
  const [confirmation, setConfirmation] = useState(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmError, setConfirmError] = useState('')

  if (loading) return <LoadingSpinner label="Memuat detail team..." />
  if (!data?.team) return <div className="page-body"><div className="error-message">{error || 'Team tidak ditemukan'}</div></div>

  const team = data.team
  const selectedRole = team.roles.find((role) => role.id === selectedRoleId)
  const userId = getCurrentUserId()
  const isOwner = Number(team.owner_id) === userId
  const isMember = team.members.some((member) => Number(member.id) === userId)
  const openModal = (name) => { setFormError(''); setModal(name) }
  const run = async (action, after) => {
    try {
      await action()
      setModal(null)
      if (after) after()
      else reload()
    } catch (err) { setFormError(err.message) }
  }
  const askConfirmation = (value) => { setConfirmError(''); setConfirmation(value) }
  const confirmDeleteTeam = () => askConfirmation({ type: 'delete-team', title: 'Hapus team?', message: `${team.name} beserta role, anggota, dan seluruh datanya akan dihapus permanen.`, label: 'Hapus Team' })
  const confirmDeleteRole = (role) => askConfirmation({ type: 'delete-role', target: role, title: 'Hapus role?', message: `Role ${role.role_name} akan dihapus dari team ini.`, label: 'Hapus Role' })
  const confirmRemoveMember = (member) => askConfirmation({ type: 'remove-member', target: member, title: 'Keluarkan anggota?', message: `${member.name} akan dikeluarkan dari ${team.name}.`, label: 'Keluarkan' })
  const confirmLeaveTeam = () => askConfirmation({ type: 'leave-team', title: 'Keluar dari team?', message: `Kamu tidak lagi menjadi anggota ${team.name}.`, label: 'Keluar Team' })
  const confirmDeleteRoleSkill = (skill) => askConfirmation({ type: 'delete-role-skill', target: skill, title: 'Hapus skill?', message: `${skill.skill_name} akan dihapus dari kebutuhan role ${selectedRole?.role_name}.`, label: 'Hapus Skill' })
  const executeConfirmation = async () => {
    setConfirmBusy(true); setConfirmError('')
    try {
      if (confirmation.type === 'delete-team') { await deleteTeam(id); navigate('/teams'); return }
      if (confirmation.type === 'delete-role') await deleteTeamRole(id, confirmation.target.id)
      if (confirmation.type === 'remove-member') await removeTeamMember(id, confirmation.target.id)
      if (confirmation.type === 'delete-role-skill') await deleteRoleSkill(id, selectedRole.id, confirmation.target.skill_id)
      if (confirmation.type === 'leave-team') { await leaveTeam(id); navigate('/teams'); return }
      setConfirmation(null)
      await reload()
    } catch (err) { setConfirmError(err.message) }
    finally { setConfirmBusy(false) }
  }
  const chooseRole = (role) => { setSelectedRoleId(role.id); openModal('role-detail') }

  return <>
    <Navbar title={team.name} subtitle={team.project_idea} action={false} />
    <div className="page-body">
      <Link to="/teams" className="back-link"><ArrowLeft size={16} />Back to teams</Link>
      {error && <div className="error-message">{error}</div>}
      <section className="panel team-hero">
        <div className="avatar avatar-large avatar-team">{team.name?.slice(0, 2).toUpperCase()}</div>
        <div className="team-hero-copy"><div className="title-line"><h2>{team.name}</h2><Badge tone="open">Open</Badge></div><p>{team.description || 'Belum ada deskripsi.'}</p><CompetitionBadge team={team} /><TeamCompatibilityBadges team={team} /><div className="team-card-meta"><span><Users size={16} />{team.members.length} / {team.max_members} members</span><span>{team.roles.length} roles</span></div></div>
        <div className="hero-actions">
          {isOwner ? <><button className="button button-secondary" onClick={() => openModal('edit-team')}><Edit3 size={16} />Edit</button><button className="button button-danger" onClick={confirmDeleteTeam}><Trash2 size={16} />Delete</button></> : isMember ? <button className="button button-secondary" onClick={confirmLeaveTeam}><LogOut size={16} />Leave Team</button> : <button className="button button-primary" onClick={() => openModal('join')}>Join Team</button>}
        </div>
      </section>
      <div className="detail-tabs">{['roles', 'members', 'about'].map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>
      <div className={`detail-grid tab-${activeTab}`}>
        <section><div className="section-heading"><div><h2>Roles</h2><p>Pilih role untuk melihat kebutuhan skill dan match.</p></div>{isOwner && <button className="button button-secondary" onClick={() => openModal('add-role')}><Plus size={16} />Add Role</button>}</div>{team.roles.length ? <div className="role-list">{team.roles.map((role) => <RoleCard key={role.id} role={role} owner={isOwner} onSelect={chooseRole} onStatus={(item) => run(() => updateTeamRole(id, item.id, item.status === 'filled' ? 'active' : 'filled'))} onDelete={confirmDeleteRole} />)}</div> : <EmptyState title="Belum ada role" description="Owner belum menambahkan role yang dibutuhkan." />}</section>
        <aside className="panel members-panel"><div className="section-heading"><div><h2>Members</h2><p>{team.members.length} anggota saat ini</p></div></div><div className="member-list">{team.members.map((member) => <div className="member-row" key={member.id}><Avatar name={member.name} src={resolveMediaURL(member.avatar_url)} /><div><strong>{member.name}</strong><p>{member.role}</p></div>{Number(member.id) === Number(team.owner_id) && <Badge tone="neutral">Owner</Badge>}{isOwner && Number(member.id) !== userId && <button className="icon-button danger" onClick={() => confirmRemoveMember(member)}><UserMinus size={16} /></button>}</div>)}</div>{isOwner && <Link className="button button-secondary full-width" to={`/join-requests?team=${id}`}>View Join Requests</Link>}</aside>
        <section className="panel team-about"><h2>About this team</h2><p>{team.description || 'Belum ada deskripsi.'}</p><h3>Competition goal / idea</h3><p>{team.project_idea}</p><div className="about-meta"><span>Owner ID <strong>#{team.owner_id}</strong></span><span>Capacity <strong>{team.max_members} members</strong></span></div></section>
      </div>
    </div>

    <Modal open={modal === 'join'} title="Join Team" onClose={() => setModal(null)}><form className="stack-form" onSubmit={(event) => { event.preventDefault(); run(() => joinTeam(id, new FormData(event.currentTarget).get('message'))) }}>{formError && <div className="error-message">{formError}</div>}<label><span>Message</span><textarea name="message" rows="4" placeholder="Ceritakan kenapa kamu cocok untuk team ini..." required /></label><button className="button button-primary">Send Request</button></form></Modal>
    <Modal open={modal === 'edit-team'} title="Edit Team" onClose={() => setModal(null)}><form className="stack-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); run(() => updateTeam(id, { competition_category: form.get('competition_category'), competition_type: form.get('competition_type'), name: form.get('name'), description: form.get('description'), project_idea: form.get('project_idea'), max_members: Number(form.get('max_members')), beginner_friendly: form.has('beginner_friendly'), willing_to_mentor: form.has('willing_to_mentor') })) }}>{formError && <div className="error-message">{formError}</div>}<label><span>Name</span><input name="name" defaultValue={team.name} required /></label><label><span>Competition Goal / Idea</span><input name="project_idea" defaultValue={team.project_idea} required /></label><label><span>Description</span><textarea name="description" defaultValue={team.description} rows="4" /></label><label><span>Max Members</span><input name="max_members" type="number" min="2" max="10" defaultValue={team.max_members} required /></label><CompetitionFields team={team} /><TeamPreferenceFields team={team} /><button className="button button-primary">Save Team</button></form></Modal>
    <Modal open={modal === 'add-role'} title="Add Role" onClose={() => setModal(null)}><form className="stack-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); run(() => createTeamRole(id, form.get('role_name'), form.get('experience_preference'))) }}>{formError && <div className="error-message">{formError}</div>}<label><span>Role Name</span><input name="role_name" list="suggested-roles" placeholder="Choose a suggestion or type any role" required /><datalist id="suggested-roles">{rolesFor(team.competition_type, team.competition_category).map(role => <option key={role} value={role} />)}</datalist></label><ExperiencePreferenceField /><button className="button button-primary">Add Role</button></form></Modal>
    <Modal open={modal === 'role-detail'} title={selectedRole?.role_name || 'Role Detail'} onClose={() => setModal(null)}>{selectedRole && <div className="role-detail"><div className="title-line"><Badge tone={selectedRole.status === 'filled' ? 'filled' : 'open'}>{selectedRole.status}</Badge><Badge tone="neutral">{experienceLabel(selectedRole.experience_preference)}</Badge></div><MatchBreakdown match={selectedRole.match} />{formError && <div className="error-message">{formError}</div>}{isOwner && <form className="stack-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); run(() => updateTeamRole(id, selectedRole.id, { experience_preference: form.get('experience_preference') })) }}><ExperiencePreferenceField value={selectedRole.experience_preference} /><button className="button button-secondary">Save Preference</button></form>}<h3>Required Skills</h3>{selectedRole.skills?.length ? <div className="skill-detail-list">{selectedRole.skills.map((skill) => <div className="skill-row" key={skill.skill_id}><SkillBadge name={skill.skill_name} level={skill.required_level} />{isOwner && <button className="icon-button danger" onClick={() => confirmDeleteRoleSkill(skill)}><Trash2 size={15} /></button>}</div>)}</div> : <EmptyState title="No required skills" />}{isOwner && <form className="inline-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); run(() => addRoleSkill(id, selectedRole.id, { skill_id: Number(form.get('skill_id')), required_level: form.get('required_level') })) }}><SkillSelect key={selectedRole.id} skills={data.skills.filter(skill => !selectedRole.skills?.some(required => required.skill_id === skill.id))} suggestions={skillsForRole(selectedRole.role_name, team.competition_category)} /><select name="required_level" aria-label="Required level"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select><button className="button button-primary"><Plus size={15} />Add</button></form>}</div>}</Modal>
    <ConfirmDialog open={Boolean(confirmation)} title={confirmation?.title} message={confirmation?.message} confirmLabel={confirmation?.label} loading={confirmBusy} error={confirmError} onClose={() => setConfirmation(null)} onConfirm={executeConfirmation} />
  </>
}
