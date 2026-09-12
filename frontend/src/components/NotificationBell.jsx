import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import usePolling from '../hooks/usePolling'
import { getNotificationCount } from '../services/api'

export default function NotificationBell() {
  const { data, error } = usePolling(getNotificationCount, 20000, 'notifications-updated')
  const count = data?.unread_count || 0
  return <Link className="icon-button notification-button" to="/notifications" aria-label={error ? 'Notifications (count unavailable)' : `${count} unread notifications`} title={error || 'Notifications'}><Bell size={18} />{count > 0 && <span className="notification-count">{count > 99 ? '99+' : count}</span>}</Link>
}
