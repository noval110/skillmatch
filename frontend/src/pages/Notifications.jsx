import { Bell, Check, CheckCheck } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import LoadingSpinner from '../components/LoadingSpinner'
import usePolling from '../hooks/usePolling'
import { getNotifications, readNotification, readAllNotifications } from '../services/api'
import './community.css'

export const notificationTarget = item => item.related_conversation_id ? `/messages/${item.related_conversation_id}` : item.related_team_id ? `/teams/${item.related_team_id}` : item.related_user_id ? `/users/${item.related_user_id}` : null
export default function Notifications() {
  const [pages, setPages] = useState(1)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const loader = useCallback(async () => {
    let items = [], before
    for (let page = 0; page < pages; page++) {
      const batch = await getNotifications(before)
      items = [...items, ...batch]
      if (batch.length < 50) break
      before = batch.at(-1).id
    }
    return items
  }, [pages])
  const { data, loading, error, reload } = usePolling(loader, 20000, 'notifications-updated')
  const mark = async (id) => {
    setBusy(true); setActionError('')
    try { if (id) await readNotification(id); else await readAllNotifications(); await reload(); window.dispatchEvent(new Event('notifications-updated')) }
    catch (err) { setActionError(err.message) } finally { setBusy(false) }
  }
  return <div className="notifications-page"><Navbar title="Notifications" subtitle="Updates from your SkillMatch community." action={false} /><div className="page-body community-body">
    <div className="section-heading"><h2>Your updates</h2><button className="button button-secondary" disabled={busy || !data?.some(item => !item.is_read)} onClick={() => mark()}><CheckCheck size={16} />Mark all as read</button></div>
    {(error || actionError) && <div role="alert" className="error-message">{actionError || error}<button className="button button-secondary" onClick={reload}>Retry</button></div>}
    {loading ? <LoadingSpinner /> : data?.length ? <div className="notification-feed">{data.map(item => <article className={`panel notification-row ${item.is_read ? '' : 'is-unread'}`} key={item.id}>
      <Bell size={20} aria-hidden="true" /><div><h3>{item.title}{!item.is_read && <span className="unread-dot" aria-label="Unread" />}</h3><p>{item.message}</p><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time><div className="community-actions">{notificationTarget(item) && <Link to={notificationTarget(item)} onClick={() => { if (!item.is_read) mark(item.id) }}>View {item.related_conversation_id ? 'conversation' : item.related_team_id ? 'team' : 'profile'}</Link>}{!item.is_read && <button className="text-link" disabled={busy} onClick={() => mark(item.id)}><Check size={14} />Mark as read</button>}</div></div>
    </article>)}{data.length === pages * 50 && <button className="button button-secondary" onClick={() => setPages(value => value + 1)}>Load older notifications</button>}</div> : !error && <div className="panel community-empty"><Bell size={28} /><h3>No notifications yet</h3><p>Team requests and community updates will appear here.</p></div>}
  </div></div>
}
