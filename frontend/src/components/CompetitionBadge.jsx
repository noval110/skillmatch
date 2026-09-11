import { categoryFor } from '../config/competitions'

export default function CompetitionBadge({ team }) {
  const category = categoryFor(team.competition_category)
  const Icon = category.icon
  return <div className="competition-meta"><span className={`competition-badge competition-${category.tone}`}><Icon size={14} />{team.competition_type || 'General Competition'}</span><span className="competition-category">{team.competition_category || 'Other'}</span></div>
}
