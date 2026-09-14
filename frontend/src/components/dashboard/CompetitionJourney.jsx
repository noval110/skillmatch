import { Check, Circle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getCompetitionJourney } from '../../utils/dashboard'

export default function CompetitionJourney({ readiness, hasTeam }) {
  const steps = getCompetitionJourney(readiness, hasTeam)
  return <section className="command-panel command-journey"><h2>Your Competition Journey</h2><ol>{steps.map((step, index) => <li key={step.title} className={`${step.complete ? 'is-complete' : ''} ${step.current ? 'is-current' : ''}`} aria-current={step.current ? 'step' : undefined}><span className="journey-marker">{step.complete ? <Check size={16} /> : index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}</ol>
    <div className="journey-note">Small steps. Shared progress.<br /><strong>A stronger team starts with you.</strong></div>
    {readiness && readiness.percent < 100 && <details className="command-profile-checklist"><summary>What should I add next?</summary><ul>{readiness.checks.map(check => <li key={check.label}>{check.complete ? <Check size={13} /> : <Circle size={13} />}<span>{check.label}</span></li>)}</ul><Link className="command-link" to="/profile">Complete your profile</Link></details>}
  </section>
}
