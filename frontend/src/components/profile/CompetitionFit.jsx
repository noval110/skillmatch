import { BriefcaseBusiness, CalendarClock, Compass, Gauge } from 'lucide-react'
import { availabilityLabels, titleCase } from '../../utils/profile'

export default function CompetitionFit({ profile, onEdit }) {
  const items = [
    { label: 'Preferred Role', value: profile.preferred_role, icon: BriefcaseBusiness },
    { label: 'Interested In', value: profile.project_interest, icon: Compass },
    { label: 'Availability', value: availabilityLabels[profile.availability] || titleCase(profile.availability || ''), icon: CalendarClock },
    { label: 'Experience', value: titleCase(profile.experience_level || ''), icon: Gauge },
  ]
  return <section className="profile-fit-panel">
    <header><span className="profile-section-kicker">Team planning</span><h2>Competition Fit</h2><p>At-a-glance context for role and schedule decisions.</p></header>
    <dl>{items.map(({ label, value, icon: Icon }) => <div key={label}><dt><Icon size={15} />{label}</dt><dd className={value ? '' : 'is-empty'}>{value || 'Not provided'}</dd></div>)}</dl>
    {onEdit && <button type="button" className="profile-text-button" onClick={onEdit}>Update competition preferences</button>}
  </section>
}
