import { Check, Inbox, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Badge from '../components/Badge'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'
import Navbar from '../components/Navbar'
import useAsync from '../hooks/useAsync'
import { acceptJoinRequest, getJoinRequests, getTeams, rejectJoinRequest, resolveMediaURL } from '../services/api'
import { getCurrentUserId } from '../utils/auth'

const tabs = ['pending', 'accepted', 'rejected']

export default function JoinRequests() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState('pending')
  const loader = useCallback(async () => {
    const userId = getCurrentUserId()
    const teamsResponse = await getTeams()
    const teams = Array.isArray(teamsResponse) ? teamsResponse : []
    const teamFilter = params.get('team')
    const owned = teams.filter((team) => Number(team.owner_id) === userId && (!teamFilter || String(team.id) === teamFilter))
    const groups = await Promise.all(owned.map(async (team) => ({ team, requests: await getJoinRequests(team.id).catch(() => []) })))
    return groups.flatMap(({ team, requests }) => requests.map((request) => ({ ...request, team })))
  }, [params])
  const asyncResult = useAsync(loader)
  const { loading, error, reload } = asyncResult
  const data = Array.isArray(asyncResult.data) ? asyncResult.data : []
  const act = async (request, action) => { try { await action(request.id); await reload(); window.dispatchEvent(new Event('notifications-updated')) } catch (err) { window.alert(err.message) } }
  const filtered = data?.filter((request) => request.status === tab) || []

  return <div className="join-requests-page"><Navbar title="Join Requests" subtitle="Kelola permintaan masuk ke team milikmu." action={false} /><div className="page-body">{error && <div className="error-message">{error}</div>}<div className="tabs request-tabs">{tabs.map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}<span>{data.filter((request) => request.status === item).length}</span></button>)}</div>{loading ? <LoadingSpinner /> : filtered.length ? <div className="request-list">{filtered.map((request) => <article className="request-card" key={request.id}><Link className="user-avatar-link" to={`/users/${request.user_id}`} aria-label={`View ${request.name}'s profile`}><Avatar name={request.name} src={resolveMediaURL(request.avatar_url)} className="request-avatar" /></Link><div className="request-copy"><div className="title-line"><h3><Link className="user-profile-name" to={`/users/${request.user_id}`}>{request.name}</Link></h3><Badge tone={request.status}>{request.status}</Badge></div><p>{request.message || 'Tidak ada pesan.'}</p><Link to={`/teams/${request.team.id}`}>{request.team.name}</Link></div>{request.status === 'pending' && <div className="request-actions"><button className="button button-secondary danger-text" onClick={() => act(request, rejectJoinRequest)}><X size={14} />Tolak</button><button className="button button-primary" onClick={() => act(request, acceptJoinRequest)}><Check size={14} />Terima</button></div>}</article>)}</div> : <div className="request-empty"><span><Inbox size={22} /></span><h3>Belum ada permintaan {tab}</h3><p>Permintaan dengan status ini akan tampil di sini.</p></div>}</div></div>
}
