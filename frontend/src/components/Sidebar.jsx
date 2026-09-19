import { Bell, Home, House, LogOut, Menu, MessageCircle, Settings, UserRound, UsersRound, UserSearch, X } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { logout } from '../utils/auth'
import logo from '../assets/branding/skillmatch-logo-transparent.png'

const links = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/dashboard', label: 'Dashboard', icon: House },
  { to: '/teams', label: 'Teams', icon: UsersRound },
  { to: '/my-team', label: 'My Team', icon: UserSearch },
  { to: '/join-requests', label: 'Join Requests', icon: Bell },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ open, onOpen, onClose }) {
  const navigate = useNavigate()
  const drawer = useRef(null)
  const toggle = useRef(null)
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const toggleButton = toggle.current
    document.body.style.overflow = 'hidden'
    drawer.current?.querySelector('a')?.focus()
    const onKeyDown = event => {
      if (event.key === 'Escape') { onClose(); return }
      if (event.key !== 'Tab') return
      const elements = [...drawer.current.querySelectorAll('a, button')].filter(element => element.getClientRects().length)
      const first = elements[0], last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    const media = window.matchMedia('(max-width: 800px)')
    const onResize = () => { if (!media.matches) onClose() }
    document.addEventListener('keydown', onKeyDown)
    media.addEventListener('change', onResize)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); media.removeEventListener('change', onResize); toggleButton?.focus() }
  }, [open, onClose])
  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <>
      <button ref={toggle} className="mobile-menu-button" onClick={onOpen} aria-label="Open navigation" aria-expanded={open} aria-controls="workspace-navigation"><Menu size={21} /></button>
      {open && <button className="sidebar-backdrop" onClick={onClose} aria-label="Close menu" />}
      <aside ref={drawer} id="workspace-navigation" className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Main navigation">
        <Link className="brand workspace-brand" to="/" onClick={onClose} aria-label="SkillMatch home"><span className="workspace-logo"><img src={logo} alt="" /></span><span>SkillMatch<small>Build Together. Go Further.</small></span></Link>
        <button className="sidebar-close" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        <nav className="sidebar-nav">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={onClose} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-purpose"><span>YOUR NEXT CHAPTER</span><p>Better teams.<br />Bigger possibilities.</p><small>Bring your strengths.<br />Build something together.</small></div>
        <button className="logout-button" onClick={handleLogout}><LogOut size={15} />Logout</button>
      </aside>
    </>
  )
}
