import Badge from './Badge'

export default function TeamCompatibilityBadges({ team = {} }) {
  if (!team.beginner_friendly && !team.willing_to_mentor) return null
  return <div className="compatibility-badges">
    {team.beginner_friendly === true && <Badge tone="beginner">🌱 Beginner Friendly</Badge>}
    {team.willing_to_mentor === true && <Badge tone="mentor">Mentor Available</Badge>}
  </div>
}
