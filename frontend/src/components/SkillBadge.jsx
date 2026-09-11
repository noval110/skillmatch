import Badge from './Badge'

export default function SkillBadge({ name, level }) {
  return <span className="skill-badge"><span>{name}</span>{level && <Badge tone={level}>{level}</Badge>}</span>
}
