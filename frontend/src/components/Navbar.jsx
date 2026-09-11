import { Bell, ChevronDown, LogOut, Plus, Settings, UserRound, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getJoinRequests, getProfile, getTeams, resolveMediaURL } from '../services/api'
import { getCurrentUserId, logout } from '../utils/auth'
import Avatar from './Avatar'

export default function Navbar({ title, subtitle, action = true }) {
  const navigate = useNavigate()
  const menuRef = useRef(null)
  const [openMenu, setOpenMenu] = useState(null)
  let initialUser = null
  try { initialUser = JSON.parse(localStorage.getItem('currentUser') || 'null') } catch { initialUser = null }
  const [savedUser, setSavedUser] = useState(initialUser)
  const [notifications, setNotifications] = useState([])
  const [notificationLoading, setNotificationLoading] = useState(true)
  const userName = savedUser?.name || 'Account'

  const loadNotifications = useCallback(async () => {
    if (!localStorage.getItem('token')) return
    setNotificationLoading(true)
    try {
      const userId = getCurrentUserId()
      const teamsResponse = await getTeams()
      const teams = Array.isArray(teamsResponse) ? teamsResponse : []
      const ownedTeams = teams.filter((team) => Number(team.owner_id) === userId)
      const groups = await Promise.all(ownedTeams.map(async (team) => {
        const requests = await getJoinRequests(team.id).catch(() => [])
        return (Array.isArray(requests) ? requests : [])
          .filter((request) => String(request.status).toLowerCase() === 'pending')
          .map((request) => ({ ...request, team }))
      }))
      setNotifications(groups.flat().sort((left, right) => Number(right.id) - Number(left.id)))
    } catch { setNotifications([]) }
    finally { setNotificationLoading(false) }
  }, [])

  useEffect(() => {
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setOpenMenu(null) }
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpenMenu(null) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', closeOnEscape) }
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(loadNotifications, 0)
    const timer = window.setInterval(loadNotifications, 20000)
    window.addEventListener('focus', loadNotifications)
    window.addEventListener('notifications-updated', loadNotifications)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(timer)
      window.removeEventListener('focus', loadNotifications)
      window.removeEventListener('notifications-updated', loadNotifications)
    }
  }, [loadNotifications])

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
    if (menu === 'notifications') loadNotifications()
    setOpenMenu((current) => current === menu ? null : menu)
  }

  return (
    <header className="topbar">
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      <div className="topbar-actions" ref={menuRef}>
        <div className="topbar-menu-wrap">
          <button className={`icon-button notification-button ${openMenu === 'notifications' ? 'is-active' : ''}`} type="button" aria-label={`${notifications.length} notifikasi join request`} aria-expanded={openMenu === 'notifications'} onClick={() => toggleMenu('notifications')}><Bell size={18} />{notifications.length > 0 && <span className="notification-count">{notifications.length > 9 ? '9+' : notifications.length}</span>}</button>
          {openMenu === 'notifications' && <div className="topbar-popover notification-popover"><header><strong>Notifikasi</strong>{notifications.length > 0 && <span>{notifications.length} baru</span>}</header>{notificationLoading ? <div className="notification-empty"><span className="notification-mini-spinner" /><p>Memuat notifikasi...</p></div> : notifications.length ? <div className="notification-list">{notifications.slice(0, 5).map((request) => <Link to={`/join-requests?team=${request.team.id}`} key={`${request.team.id}-${request.id}`} onClick={() => setOpenMenu(null)}><Avatar name={request.name} src={resolveMediaURL(request.avatar_url)} size="small" /><span><strong>{request.name}</strong><small>ingin bergabung ke {request.team.name}</small></span></Link>)}</div> : <div className="notification-empty"><Bell size={20} /><strong>Belum ada notifikasi</strong><p>Join request baru akan muncul di sini.</p></div>}<Link className="notification-footer" to="/join-requests" onClick={() => setOpenMenu(null)}><UsersRound size={14} />Lihat semua Join Requests</Link></div>}
        </div>
        <div className="topbar-menu-wrap">
          <button className={`topbar-user ${openMenu === 'account' ? 'is-active' : ''}`} type="button" aria-label="Open account menu" aria-expanded={openMenu === 'account'} onClick={() => toggleMenu('account')}><Avatar name={userName} src={resolveMediaURL(savedUser?.avatar_url)} size="small" /><strong>{userName}</strong><ChevronDown className={openMenu === 'account' ? 'rotated' : ''} size={14} /></button>
          {openMenu === 'account' && <div className="topbar-popover account-popover"><div className="account-popover-head"><Avatar name={userName} src={resolveMediaURL(savedUser?.avatar_url)} /><span><strong>{userName}</strong><small>{savedUser?.email || 'SkillMatch member'}</small></span></div><nav><Link to="/profile" onClick={() => setOpenMenu(null)}><UserRound size={15} />Profile</Link><Link to="/settings" onClick={() => setOpenMenu(null)}><Settings size={15} />Settings</Link><button type="button" onClick={handleLogout}><LogOut size={15} />Logout</button></nav></div>}
        </div>
        {action && <Link className="button button-primary" to="/teams/create"><Plus size={17} />Create Team</Link>}
      </div>
    </header>
  )
}
