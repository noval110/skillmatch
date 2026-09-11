import { Link } from 'react-router-dom'
import TeamCompatibilityBadges from './TeamCompatibilityBadges'

const components = [
  ['skill_score', 'Skill Compatibility', 30],
  ['role_interest_score', 'Role Interest', 25],
  ['availability_score', 'Availability', 20],
  ['project_interest_score', 'Competition Interest', 15],
  ['experience_fit_score', 'Experience Fit', 10],
]

export default function MatchBreakdown({ match }) {
  if (!match) return <p className="matching-note">Match belum tersedia. Coba muat ulang halaman.</p>
  const overall = Math.max(0, Math.min(100, Number(match.match_score) || 0))
  return <section className="match-breakdown" aria-label="Match breakdown">
    <div className="overall-match"><h3>Overall Match</h3><strong>{overall}%</strong></div>
    <TeamCompatibilityBadges team={match} />
    {components.map(([key, label, max]) => {
      const available = match[key] != null && Number.isFinite(Number(match[key]))
      const value = available ? Math.max(0, Math.min(max, Number(match[key]))) : 0
      return <div className="match-component" key={key}>
        <div className="match-progress-label"><span>{label}</span><strong>{available ? `${value} / ${max}` : '—'}</strong></div>
        <div className="progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><span style={{ width: `${value / max * 100}%` }} /></div>
      </div>
    })}
    <p className="matching-note">Jadwal tim belum tersedia. Availability mendapat nilai netral (10/20), atau 20/20 untuk Flexible. Preferensi yang belum diisi mendapat nilai netral.</p>
    {match.profile_incomplete && <div className="complete-profile-prompt"><p>Lengkapi profil untuk mendapatkan match yang lebih akurat.</p><Link className="text-link" to="/profile">Complete Profile</Link></div>}
    {match.matched_skills?.length > 0 && <p className="matching-note"><strong>Relevant Skills:</strong> {match.matched_skills.join(', ')}</p>}
    {match.skills_to_improve?.length > 0 && <p className="matching-note"><strong>Skills to Improve:</strong> {match.skills_to_improve.join(', ')}</p>}
    {match.missing_skills?.length > 0 && <p className="matching-note"><strong>Learning Opportunity · Missing Skills:</strong> {match.missing_skills.join(', ')}</p>}
  </section>
}
