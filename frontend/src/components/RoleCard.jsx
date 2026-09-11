import { experienceLabel } from '../utils/matching'
import { ChevronRight, Trash2 } from 'lucide-react'
import Badge from './Badge'
import MatchProgress from './MatchProgress'
import SkillBadge from './SkillBadge'

export default function RoleCard({ role, owner, onSelect, onStatus, onDelete }) {
  return (
    <article className="role-card">
      <button className="role-card-main" onClick={() => onSelect(role)}>
        <div><div className="role-title-row"><h3>{role.role_name}</h3><Badge tone={role.status === 'filled' ? 'filled' : 'open'}>{role.status}</Badge></div><p>{experienceLabel(role.experience_preference)} � {role.skills?.length || 0} required skills</p></div>
        <ChevronRight size={19} />
      </button>
      {role.skills?.length > 0 && <div className="tag-list">{role.skills.slice(0, 4).map((skill) => <SkillBadge key={skill.skill_id} name={skill.skill_name} />)}</div>}
      {role.match && <MatchProgress score={role.match.match_score} />}
      {owner && <div className="role-actions"><button className="button button-small button-secondary" onClick={() => onStatus(role)}>{role.status === 'filled' ? 'Mark open' : 'Mark filled'}</button><button className="icon-button danger" onClick={() => onDelete(role)} aria-label="Delete role"><Trash2 size={16} /></button></div>}
    </article>
  )
}
