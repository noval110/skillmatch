import { ArrowRight, Flag } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function DashboardHero({ profile, profileReadiness }) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const name = profile?.name?.trim().split(/\s+/)[0]
  return <section className="command-hero">
    <div className="command-hero-copy">
      <h1>{greeting}{name ? `, ${name}` : ''}.</h1>
      <h2>Build a team that is ready to compete.</h2>
      <p>Find the right teammates, strengthen your skills,<br className="command-desktop-break" /> and prepare your team for the next competition.</p>
      <div className="command-actions"><Link className="button button-primary" to="/teams">Explore Teams<ArrowRight size={16} /></Link><Link className="button button-secondary" to="/profile">{profileReadiness?.percent === 100 ? 'View Profile' : 'Complete Profile'}</Link></div>
    </div>
    <div className="command-hero-art" aria-hidden="true"><div className="command-summit summit-back" /><div className="command-summit summit-front" /><Flag size={30} /><span>Different strengths.<br />One shared ambition.</span></div>
  </section>
}
