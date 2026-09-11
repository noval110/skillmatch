import { Link } from 'react-router-dom'
import { competitionCategories } from '../config/competitions'

export default function CompetitionCategories() {
  return <div className="competition-categories" aria-label="Explore competition categories">{competitionCategories.map(({ name, icon: Icon, tone }) => <Link className={`competition-badge competition-${tone}`} to={`/teams?competition_category=${encodeURIComponent(name)}`} key={name}><Icon size={14} />{name}</Link>)}</div>
}
