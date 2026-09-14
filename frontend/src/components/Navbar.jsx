import NotificationBell from './NotificationBell'
import { ChevronDown, LogOut, Plus, Search, Settings, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getProfile, resolveMediaURL } from '../services/api'
import { logout } from '../utils/auth'
import Avatar from './Avatar'

export default function Navbar({ title, subtitle, action = true, search = false, userProfile }) {
  const navigate = useNavigate()
  const menuRef = useRef(null)
  const [openMenu, setOpenMenu] = useState(null)
  let initialUser = null
  try { initialUser = JSON.parse(localStorage.getItem('currentUser') || 'null') } catch { initialUser = null }
  const [savedUser, setSavedUser] = useState(initialUser)
  const displayedUser = userProfile === undefined ? savedUser : userProfile
  const userName = displayedUser?.name || 'Account'
  const avatarURL = resolveMediaURL(displayedUser?.avatar_url)
  const userAvatar = avatarURL ? <Avatar name={userName} src={avatarURL} size="small" /> : <span className="avatar account-initials" aria-hidden="true">{userName.slice(0, 2).toUpperCase()}</span>

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
    if (userProfile === undefined) refreshUser()
    window.addEventListener('profile-updated', syncUser)
    return () => { active = false; window.removeEventListener('profile-updated', syncUser) }
  }, [userProfile])

  const handleLogout = () => { logout(); navigate('/login') }
  const toggleMenu = (menu) => {
    setOpenMenu((current) => current === menu ? null : menu)
  }

  return (
    <header className="topbar">
      {search ? <form className="command-search" role="search" onSubmit={(event) => { event.preventDefault(); const query = new FormData(event.currentTarget).get('query').trim(); navigate(query ? `/teams?q=${encodeURIComponent(query)}` : '/teams') }}><Search size={18} aria-hidden="true" /><input name="query" aria-label="Search teams, skills, or competitions" placeholder="Search teams, skills, or competitions..." /><button type="submit" aria-label="Search"><Search size={16} /></button></form> : <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>}
      <div className="topbar-actions" ref={menuRef}>
        <NotificationBell />
        <div className="topbar-menu-wrap">
          <button className={`topbar-user ${openMenu === 'account' ? 'is-active' : ''}`} type="button" aria-label="Open account menu" aria-expanded={openMenu === 'account'} onClick={() => toggleMenu('account')}>{userAvatar}<span><strong>{userName}</strong>{search && <small>SkillMatch member</small>}</span><ChevronDown className={openMenu === 'account' ? 'rotated' : ''} size={14} /></button>
          {openMenu === 'account' && <div className="topbar-popover account-popover"><div className="account-popover-head">{userAvatar}<span><strong>{userName}</strong><small>{displayedUser?.email || 'SkillMatch member'}</small></span></div><nav><Link to="/profile" onClick={() => setOpenMenu(null)}><UserRound size={15} />Profile</Link><Link to="/settings" onClick={() => setOpenMenu(null)}><Settings size={15} />Settings</Link><button type="button" onClick={handleLogout}><LogOut size={15} />Logout</button></nav></div>}
        </div>
        {action && <Link className="button button-primary" to="/teams/create"><Plus size={17} />Create Team</Link>}
      </div>
    </header>
  )
}
