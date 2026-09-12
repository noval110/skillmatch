import { ArrowLeft, MessageCircle, Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import Navbar from '../components/Navbar'
import LoadingSpinner from '../components/LoadingSpinner'
import usePolling from '../hooks/usePolling'
import { getConversations, getConversation, getMessages, sendMessage, readConversation, resolveMediaURL } from '../services/api'
import { getCurrentUserId } from '../utils/auth'
import './community.css'

function ChatThread({ id, onRead }) {
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sendError, setSendError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [older, setOlder] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const refresh = useRef(() => {})
  const scroll = useRef(null)
  const latest = useRef(0)
  const retryKey = useRef(null)
  const user = getCurrentUserId()
  useEffect(() => {
    let active = true, timer, busy = false, queued = false
    const poll = async () => {
      if (!active) return
      if (busy) { queued = true; return }
      clearTimeout(timer)
      if (document.hidden) { timer = setTimeout(poll, 8000); return }
      busy = true
      try {
        const [info, batch] = await Promise.all([getConversation(id), getMessages(id, latest.current ? { after: latest.current } : {})])
        if (!active) return
        const initial = !latest.current
        const nearBottom = !scroll.current || scroll.current.scrollHeight - scroll.current.scrollTop - scroll.current.clientHeight < 100
        setConversation(info); setError('')
        if (initial) setOlder(batch.length === 50)
        if (batch.length) {
          latest.current = batch.at(-1).id
          setMessages(old => [...new Map([...old, ...batch].map(item => [item.id, item])).values()].sort((a, b) => a.id - b.id))
          if (initial || nearBottom) requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight })
        }
        // Mark only fetched messages, so a concurrently delivered message stays unread.
        if (latest.current && !document.hidden && (info.unread_count > 0 || batch.some(item => item.sender_id !== user && !item.read_at))) {
          await readConversation(id, latest.current)
          if (active) { onRead(); window.dispatchEvent(new Event('notifications-updated')) }
        }
      } catch (err) { if (active) setError(err.message) }
      finally { busy = false; if (active) { setLoading(false); timer = setTimeout(poll, queued ? 0 : 8000); queued = false } }
    }
    refresh.current = poll; poll()
    const visible = () => { if (!document.hidden) poll() }
    document.addEventListener('visibilitychange', visible)
    return () => { active = false; clearTimeout(timer); document.removeEventListener('visibilitychange', visible) }
  }, [id, user, onRead])
  const loadOlder = async () => {
    setLoadingOlder(true)
    try {
      const batch = await getMessages(id, { before: messages[0].id })
      const height = scroll.current?.scrollHeight || 0
      setMessages(old => [...new Map([...batch, ...old].map(item => [item.id, item])).values()].sort((a, b) => a.id - b.id)); setOlder(batch.length === 50)
      requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop += scroll.current.scrollHeight - height })
    } catch (err) { setError(err.message) } finally { setLoadingOlder(false) }
  }
  const send = async event => {
    event.preventDefault()
    if (sending || !draft.trim()) return
    setSending(true); setSendError('')
    const content = draft.trim()
    if (retryKey.current?.content !== content) retryKey.current = { content, key: crypto.randomUUID() }
    try {
      await sendMessage(id, { content, client_message_id: retryKey.current.key })
      setDraft(''); retryKey.current = null
      // Poll from the last received cursor, keeping messages sent concurrently by the peer.
      await refresh.current(); onRead()
      requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight })
    } catch (err) { setSendError(err.message) } finally { setSending(false) }
  }
  return <section className="chat-thread" aria-label="Conversation">
    <header className="chat-header"><Link className="back-link chat-back" to="/messages"><ArrowLeft size={17} />Messages</Link>{conversation && <Link className="user-profile-link" to={`/users/${conversation.other_user.id}`}><Avatar name={conversation.other_user.name} src={resolveMediaURL(conversation.other_user.avatar_url)} size="small" /><strong>{conversation.other_user.name}</strong></Link>}</header>
    {error && <div className="error-message" role="alert">{error}<button className="button button-secondary" onClick={() => refresh.current()}>Retry</button></div>}
    <div className="chat-history" ref={scroll} aria-label="Messages">
      {loading ? <LoadingSpinner /> : !conversation ? <div className="community-empty">Conversation unavailable. Choose another conversation.</div> : <>{older && <button className="button button-secondary" disabled={loadingOlder} onClick={loadOlder}>{loadingOlder ? 'Loading...' : 'Load older messages'}</button>}{messages.length ? messages.map(item => <article key={item.id} className={`chat-bubble ${Number(item.sender_id) === user ? 'is-own' : ''}`}><p>{item.content}</p><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></article>) : <div className="community-empty"><MessageCircle size={26} /><p>Start the conversation. Say hello!</p></div>}</>}
    </div>
    {conversation && <form className="chat-composer" onSubmit={send}>{sendError && <div className="error-message" role="alert">{sendError} Your draft is preserved; you can retry.</div>}<label className="sr-only" htmlFor="message-draft">Message</label><textarea id="message-draft" name="content" placeholder="Write a message..." rows={2} maxLength={4000} value={draft} disabled={sending} onChange={event => setDraft(event.target.value)} /><button className="button button-primary" disabled={sending || !draft.trim()}><Send size={17} />{sending ? 'Sending...' : 'Send'}</button></form>}
  </section>
}

export default function Messages() {
  const { conversationId } = useParams()
  const [pages, setPages] = useState(1)
  const loader = useCallback(async () => {
    const groups = await Promise.all(Array.from({ length: pages }, (_, page) => getConversations(page * 50)))
    return [...new Map(groups.flat().map(item => [item.id, item])).values()]
  }, [pages])
  const { data, loading, error, reload } = usePolling(loader, 10000)
  return <div className="messages-page"><Navbar title="Messages" subtitle="Connect with your next teammate." action={false} /><div className="page-body community-body"><div className={`panel messages-layout ${conversationId ? 'has-active' : ''}`}>
    <aside className="conversation-list" aria-label="Conversations"><h2>Conversations</h2>{error && <div className="error-message" role="alert">{error}<button onClick={reload}>Retry</button></div>}{loading ? <LoadingSpinner /> : data?.length ? <>{data.map(item => <Link className={`conversation-link ${String(item.id) === conversationId ? 'is-active' : ''}`} key={item.id} to={`/messages/${item.id}`}><Avatar name={item.other_user.name} src={resolveMediaURL(item.other_user.avatar_url)} /><span><strong>{item.other_user.name}</strong><small>{item.last_message || 'Say hello'}</small><time dateTime={item.updated_at}>{new Date(item.updated_at).toLocaleDateString()}</time></span>{item.unread_count > 0 && <span className="chat-unread">{item.unread_count}</span>}</Link>)}{data.length === pages * 50 && <button className="button button-secondary" onClick={() => setPages(value => value + 1)}>Load more conversations</button>}</> : !error && <div className="community-empty"><MessageCircle size={28} /><p>No conversations yet.</p><Link to="/teams">Find teammates</Link></div>}</aside>
    {conversationId ? <ChatThread key={conversationId} id={conversationId} onRead={reload} /> : <div className="chat-placeholder community-empty"><MessageCircle size={34} /><p>Choose a conversation or message someone from their profile.</p></div>}
  </div></div></div>
}
