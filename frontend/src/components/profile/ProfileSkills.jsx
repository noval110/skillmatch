import { Pencil, Plus, Trash2 } from 'lucide-react'
import Badge from '../Badge'
import SkillIcon from '../SkillIcon'
import { groupProfileSkills, titleCase } from '../../utils/profile'

export default function ProfileSkills({ skills = [], editable = false, onAdd, onEdit, onRemove }) {
  const groups = groupProfileSkills(skills)
  return <section className="profile-content-section profile-skills-section">
    <header className="profile-section-heading">
      <div><span className="profile-section-kicker">Capabilities</span><h2>Skills</h2><p>Practical strengths teams can plan around.</p></div>
      {editable && <button className="button button-secondary button-small" type="button" onClick={onAdd}><Plus size={14} />Add Skill</button>}
    </header>
    {skills.length ? <div className="profile-skill-groups">{Object.entries(groups).map(([category, items]) => <section key={category}>
      <h3>{category}</h3>
      <div className="profile-skill-list">{items.map(skill => <article className="profile-skill-row" key={skill.id}>
        <span className="profile-skill-icon"><SkillIcon name={skill.name} /></span>
        <span className="profile-skill-name"><strong>{skill.name}</strong><small>Skill level</small></span>
        <Badge tone={skill.level?.toLowerCase()}>{titleCase(skill.level || 'Not set')}</Badge>
        {editable && <span className="profile-skill-actions"><button type="button" aria-label={`Edit ${skill.name} level`} onClick={() => onEdit(skill)}><Pencil size={13} /></button><button type="button" aria-label={`Remove ${skill.name}`} onClick={() => onRemove(skill)}><Trash2 size={13} /></button></span>}
      </article>)}</div>
    </section>)}</div> : <div className="profile-compact-empty"><p>{editable ? 'Add skills so teams can understand where you contribute best.' : 'No skills added yet.'}</p>{editable && <button className="button button-secondary button-small" type="button" onClick={onAdd}><Plus size={14} />Add your first skill</button>}</div>}
  </section>
}
