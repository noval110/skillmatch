import { useState } from 'react'
import { skillCategories, skillCategory } from '../config/competitions'

export default function SkillSelect({ skills, suggestions = [] }) {
  const [category, setCategory] = useState('')
  const [selected, setSelected] = useState('')
  const categories = [...new Set([...skillCategories, ...skills.map(skillCategory)])]
  const suggested = skills.filter(skill => suggestions.includes(skill.name))
  return <div className="skill-picker">
    {suggested.length > 0 && <div className="skill-suggestions"><p>Suggested skills · select one, then choose a level and save.</p><div className="tag-list">{suggested.map(skill => <button type="button" className={`tag ${String(skill.id) === selected ? 'selected' : ''}`} key={skill.id} onClick={() => { setCategory(''); setSelected(String(skill.id)) }}>{skill.name}</button>)}</div></div>}
    <label><span>Skill Category</span><select value={category} onChange={event => { setCategory(event.target.value); setSelected('') }}><option value="">All Categories</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
    <label><span>Skill</span><select name="skill_id" required value={selected} onChange={event => setSelected(event.target.value)}><option value="" disabled>Select skill</option>{skills.filter(skill => !category || skillCategory(skill) === category).map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></label>
    {skills.filter(skill => !category || skillCategory(skill) === category).length === 0 && <small>No more skills available in this category.</small>}
  </div>
}
