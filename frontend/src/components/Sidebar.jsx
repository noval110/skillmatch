import { Bell, Home, House, LogOut, Menu, Settings, UserRound, UsersRound, UserSearch, X } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { logout } from '../utils/auth'
import ApprovedAsset from './ApprovedAsset'

const links = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/dashboard', label: 'Dashboard', icon: House },
  { to: '/teams', label: 'Teams', icon: UsersRound },
  { to: '/my-team', label: 'My Team', icon: UserSearch },
  { to: '/join-requests', label: 'Join Requests', icon: Bell },
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <>
      <button className="mobile-menu-button" onClick={onClose} aria-label="Toggle menu"><Menu size={21} /></button>
      {open && <button className="sidebar-backdrop" onClick={onClose} aria-label="Close menu" />}
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <Link className="brand" to="/" onClick={onClose} aria-label="SkillMatch home"><ApprovedAsset name="logo" alt="SkillMatch" /></Link>
        <button className="sidebar-close" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        <nav className="sidebar-nav">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={onClose} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="logout-button" onClick={handleLogout}><LogOut size={15} />Logout</button>
      </aside>
    </>
  )
}
