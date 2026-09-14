import { Menu, X } from 'lucide-react'
import {
  useRef,
  useState,
} from 'react'
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

export default function LandingNavbar({
  activeSection,
  isAuthenticated = false,
}) {
  const [open, setOpen] =
    useState(false)

  const menuButton = useRef(null)

  const close = () => setOpen(false)

  const handleKeyDown = (event) => {
    if (
      event.key === 'Escape' &&
      open
    ) {
      close()
      menuButton.current?.focus()
    }
  }

  return (
    <header className="landing-nav-shell">
      <nav
        className="landing-nav"
        aria-label="Landing page navigation"
        onKeyDown={handleKeyDown}
      >
        <a
          className="landing-brand"
          href="#home"
          aria-label="SkillMatch home"
          onClick={close}
        >
          <span className="landing-brand-mark">
            <img src={logo} alt="" />
          </span>

          <strong>
            SkillMatch
          </strong>
        </a>

        <button
          ref={menuButton}
          className="landing-menu-toggle"
          type="button"
          aria-label={
            open
              ? 'Close navigation'
              : 'Open navigation'
          }
          aria-expanded={open}
          aria-controls="landing-navigation"
          onClick={() =>
            setOpen(
              (current) => !current,
            )
          }
        >
          {open ? (
            <X size={18} />
          ) : (
            <Menu size={18} />
          )}
        </button>

        <div
          id="landing-navigation"
          className={`landing-nav-content ${
            open ? 'is-open' : ''
          }`}
        >
          <div className="landing-links">
            {links.map(
              ([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className={
                    activeSection === id
                      ? 'active'
                      : ''
                  }
                  aria-current={
                    activeSection === id
                      ? 'location'
                      : undefined
                  }
                  onClick={close}
                >
                  {label}
                </a>
              ),
            )}
          </div>

          <div className="landing-nav-actions">
            {isAuthenticated ? (
              <>
                <Link
                  className="landing-button landing-button-outline"
                  to="/profile"
                  onClick={close}
                >
                  Profile
                </Link>

                <Link
                  className="landing-button landing-button-primary"
                  to="/dashboard"
                  onClick={close}
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  className="landing-button landing-button-outline"
                  to="/login"
                  onClick={close}
                >
                  Login
                </Link>

                <Link
                  className="landing-button landing-button-primary"
                  to="/register"
                  onClick={close}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}