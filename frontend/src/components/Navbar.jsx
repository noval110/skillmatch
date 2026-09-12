import NotificationBell from './NotificationBell'
import { ChevronDown, LogOut, Plus, Settings, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getProfile, resolveMediaURL } from '../services/api'
import { logout } from '../utils/auth'
import Avatar from './Avatar'

export default function Navbar({ title, subtitle, action = true }) {
  const navigate = useNavigate()
  const menuRef = useRef(null)
  const [openMenu, setOpenMenu] = useState(null)
  let initialUser = null
  try { initialUser = JSON.parse(localStorage.getItem('currentUser') || 'null') } catch { initialUser = null }
  const [savedUser, setSavedUser] = useState(initialUser)
  const userName = savedUser?.name || 'Account'

  useEffect(() => {
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setOpenMenu(null) }
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpenMenu(null) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', closeOnEscape) }
  }, [])

  useEffect(() => {
    let active = true
    const refreshUser = async () => {
      try {
        const profile = await getProfile()
        if (!active) return
        setSavedUser((currentUser) => {
          const nextUser = { ...(currentUser || {}), ...profile }
          localStorage.setItem('currentUser', JSON.stringify(nextUser))
          return nextUser
        })
      } catch { /* The route-level API state handles authentication errors. */ }
    }
    const syncUser = () => {
      try { setSavedUser(JSON.parse(localStorage.getItem('currentUser') || 'null')) } catch { setSavedUser(null) }
    }
    refreshUser()
    window.addEventListener('profile-updated', syncUser)
    return () => { active = false; window.removeEventListener('profile-updated', syncUser) }
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }
  const toggleMenu = (menu) => {
    setOpenMenu((current) => current === menu ? null : menu)
  }

  return (
    <header className="topbar">
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      <div className="topbar-actions" ref={menuRef}>
        <NotificationBell />
        <div className="topbar-menu-wrap">
          <button className={`topbar-user ${openMenu === 'account' ? 'is-active' : ''}`} type="button" aria-label="Open account menu" aria-expanded={openMenu === 'account'} onClick={() => toggleMenu('account')}><Avatar name={userName} src={resolveMediaURL(savedUser?.avatar_url)} size="small" /><strong>{userName}</strong><ChevronDown className={openMenu === 'account' ? 'rotated' : ''} size={14} /></button>
          {openMenu === 'account' && <div className="topbar-popover account-popover"><div className="account-popover-head"><Avatar name={userName} src={resolveMediaURL(savedUser?.avatar_url)} /><span><strong>{userName}</strong><small>{savedUser?.email || 'SkillMatch member'}</small></span></div><nav><Link to="/profile" onClick={() => setOpenMenu(null)}><UserRound size={15} />Profile</Link><Link to="/settings" onClick={() => setOpenMenu(null)}><Settings size={15} />Settings</Link><button type="button" onClick={handleLogout}><LogOut size={15} />Logout</button></nav></div>}
        </div>
        {action && <Link className="button button-primary" to="/teams/create"><Plus size={17} />Create Team</Link>}
      </div>
    </header>
  )
}
