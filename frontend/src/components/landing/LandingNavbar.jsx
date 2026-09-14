import { Menu, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '../../assets/branding/skillmatch-logo.png'

const links = [
  ['home', 'Home'],
  ['how-it-works', 'How It Works'],
  ['features', 'Features'],
  ['explore', 'Explore'],
  ['about', 'About'],
  ['faq', 'FAQ'],
]

export default function LandingNavbar({ activeSection, isAuthenticated = false }) {
  const [open, setOpen] = useState(false)
  const menuButton = useRef(null)

  function handleKeyDown(event) {
    if (event.key === 'Escape' && open) {
      setOpen(false)
      menuButton.current?.focus()
    }
  }

  return (
    <header className="landing-nav-shell">
      <nav className="landing-nav" aria-label="Navigasi landing page" onKeyDown={handleKeyDown}>
        <a className="landing-brand" href="#home" aria-label="SkillMatch home" onClick={() => setOpen(false)}>
          <span className="landing-brand-mark"><img src={logo} alt="" /></span>
          <strong>Skill<span>Match</span></strong>
        </a>
        <button ref={menuButton} className="landing-menu-toggle" type="button" aria-label={open ? 'Tutup navigasi' : 'Buka navigasi'} aria-expanded={open} aria-controls="landing-navigation" onClick={() => setOpen((value) => !value)}>{open ? <X size={19} /> : <Menu size={19} />}</button>
        <div id="landing-navigation" className={`landing-nav-content ${open ? 'is-open' : ''}`}>
          <div className="landing-links">{links.map(([id, label]) => <a className={activeSection === id ? 'active' : ''} aria-current={activeSection === id ? 'location' : undefined} href={`#${id}`} key={id} onClick={() => setOpen(false)}>{label}</a>)}</div>
          <div className="landing-nav-actions">
            {isAuthenticated ? <>
              <Link className="landing-button landing-button-outline" to="/profile" onClick={() => setOpen(false)}>Profile</Link>
              <Link className="landing-button landing-button-primary" to="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
            </> : <>
              <Link className="landing-button landing-button-outline" to="/login" onClick={() => setOpen(false)}>Login</Link>
              <Link className="landing-button landing-button-primary" to="/register" onClick={() => setOpen(false)}>Get Started</Link>
            </>}
          </div>
        </div>
      </nav>
    </header>
  )
}
