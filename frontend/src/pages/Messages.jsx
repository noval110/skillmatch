import {
  ArrowLeft,
  MessageCircle,
  Send,
  UsersRound,
} from 'lucide-react'
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import Navbar from '../components/Navbar'
import LoadingSpinner from '../components/LoadingSpinner'
import usePolling from '../hooks/usePolling'
import {
  getConversations,
  getConversation,
  getMessages,
  sendMessage,
  readConversation,
  resolveMediaURL,
} from '../services/api'
import { getCurrentUserId } from '../utils/auth'
import './community.css'

function isSameDay(first, second) {
  if (!first || !second) return false

  const a = new Date(first)
  const b = new Date(second)

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatMessageTime(value) {
  if (!value) return ''

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatConversationTime(value) {
  if (!value) return ''

  const date = new Date(value)
  const today = new Date()

  if (isSameDay(date, today)) {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
  })
}

function formatDateSeparator(value) {
  const date = new Date(value)
  const today = new Date()

  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (isSameDay(date, today)) return 'Today'
  if (isSameDay(date, yesterday)) return 'Yesterday'

  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== today.getFullYear()
      ? 'numeric'
      : undefined,
  })
}

function conversationName(item) {
  if (item.type === 'team') {
    return item.team_name || 'Team Chat'
  }

  return item.other_user?.name || 'Conversation'
}

function ConversationItem({ item, active }) {
  const team = item.type === 'team'
  const name = conversationName(item)

  return (
    <Link
      className={`conversation-link ${active ? 'is-active' : ''}`}
      to={`/messages/${item.id}`}
    >
      <Avatar
        name={name}
        src={
          team
            ? ''
            : resolveMediaURL(item.other_user?.avatar_url)
        }
      />

      <span className="conversation-copy">
        <span className="conversation-title-row">
          <strong>{name}</strong>

          <time dateTime={item.updated_at}>
            {formatConversationTime(item.updated_at)}
          </time>
        </span>

        {team && (
          <small className="conversation-type-meta">
            <UsersRound size={12} />
            {item.member_count || 0} members
          </small>
        )}

        <small className="conversation-preview">
          {item.last_message || (
            team
              ? 'Start collaborating with your team'
              : 'Say hello'
          )}
        </small>
      </span>

      {item.unread_count > 0 && (
        <span
          className="chat-unread"
          aria-label={`${item.unread_count} unread messages`}
        >
          {item.unread_count > 99 ? '99+' : item.unread_count}
        </span>
      )}
    </Link>
  )
}

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

  const userID = getCurrentUserId()

  useEffect(() => {
    let active = true
    let timer
    let busy = false
    let queued = false

    latest.current = 0
    setMessages([])
    setConversation(null)
    setLoading(true)
    setError('')

    const poll = async () => {
      if (!active) return

      if (busy) {
        queued = true
        return
      }

      clearTimeout(timer)

      if (document.hidden) {
        timer = setTimeout(poll, 15000)
        return
      }

      busy = true

      try {
        const [info, batch] = await Promise.all([
          getConversation(id),
          getMessages(
            id,
            latest.current
              ? { after: latest.current }
              : {},
          ),
        ])

        if (!active) return

        const initial = latest.current === 0

        const nearBottom =
          !scroll.current ||
          scroll.current.scrollHeight -
            scroll.current.scrollTop -
            scroll.current.clientHeight <
            120

        setConversation(info)
        setError('')

        if (initial) {
          setOlder(batch.length === 50)
        }

        if (batch.length) {
          latest.current = batch.at(-1).id

          setMessages((current) => {
            const merged = new Map()

            ;[...current, ...batch].forEach((item) => {
              merged.set(item.id, item)
            })

            return [...merged.values()].sort(
              (a, b) => a.id - b.id,
            )
          })

          if (initial || nearBottom) {
            requestAnimationFrame(() => {
              if (scroll.current) {
                scroll.current.scrollTop =
                  scroll.current.scrollHeight
              }
            })
          }
        }

        const receivedMessage = batch.some(
          (item) => Number(item.sender_id) !== userID,
        )

        if (
          latest.current &&
          !document.hidden &&
          (info.unread_count > 0 || receivedMessage)
        ) {
          await readConversation(id, latest.current)

          if (active) {
            onRead()
            window.dispatchEvent(
              new Event('notifications-updated'),
            )
          }
        }
      } catch (err) {
        if (active) {
          setError(err.message)
        }
      } finally {
        busy = false

        if (active) {
          setLoading(false)

          timer = setTimeout(
            poll,
            queued ? 0 : 5000,
          )

          queued = false
        }
      }
    }

    refresh.current = poll

    poll()

    const visible = () => {
      if (!document.hidden) {
        poll()
      }
    }

    document.addEventListener(
      'visibilitychange',
      visible,
    )

    return () => {
      active = false
      clearTimeout(timer)

      document.removeEventListener(
        'visibilitychange',
        visible,
      )
    }
  }, [id, userID, onRead])

  const loadOlder = async () => {
    if (!messages.length) return

    setLoadingOlder(true)

    try {
      const batch = await getMessages(id, {
        before: messages[0].id,
      })

      const oldHeight =
        scroll.current?.scrollHeight || 0

      setMessages((current) => {
        const merged = new Map()

        ;[...batch, ...current].forEach((item) => {
          merged.set(item.id, item)
        })

        return [...merged.values()].sort(
          (a, b) => a.id - b.id,
        )
      })

      setOlder(batch.length === 50)

      requestAnimationFrame(() => {
        if (!scroll.current) return

        scroll.current.scrollTop +=
          scroll.current.scrollHeight -
          oldHeight
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingOlder(false)
    }
  }

  const send = async (event) => {
    event.preventDefault()

    const content = draft.trim()

    if (sending || !content) return

    setSending(true)
    setSendError('')

    if (retryKey.current?.content !== content) {
      retryKey.current = {
        content,
        key: crypto.randomUUID(),
      }
    }

    try {
      await sendMessage(id, {
        content,
        client_message_id:
          retryKey.current.key,
      })

      setDraft('')
      retryKey.current = null

      await refresh.current()

      onRead()

      requestAnimationFrame(() => {
        if (scroll.current) {
          scroll.current.scrollTop =
            scroll.current.scrollHeight
        }
      })
    } catch (err) {
      setSendError(err.message)
    } finally {
      setSending(false)
    }
  }

  const handleComposerKeyDown = (event) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault()

      if (
        !sending &&
        event.currentTarget.value.trim()
      ) {
        event.currentTarget.form?.requestSubmit()
      }
    }
  }

  const teamChat = conversation?.type === 'team'

  return (
    <section
      className="chat-thread"
      aria-label="Conversation"
    >
      <header className="chat-header">
        <Link
          className="back-link chat-back"
          to="/messages"
        >
          <ArrowLeft size={17} />
          Messages
        </Link>

        {conversation && (
          teamChat ? (
            <Link
              className="chat-header-target"
              to={`/teams/${conversation.team_id}`}
            >
              <Avatar
                name={conversation.team_name}
              />

              <span>
                <strong>
                  {conversation.team_name}
                </strong>

                <small>
                  {conversation.member_count} members
                </small>
              </span>
            </Link>
          ) : (
            <Link
              className="chat-header-target"
              to={`/users/${conversation.other_user?.id}`}
            >
              <Avatar
                name={conversation.other_user?.name}
                src={resolveMediaURL(
                  conversation.other_user?.avatar_url,
                )}
              />

              <span>
                <strong>
                  {conversation.other_user?.name}
                </strong>

                <small>Direct message</small>
              </span>
            </Link>
          )
        )}
      </header>

      {error && (
        <div
          className="error-message"
          role="alert"
        >
          {error}

          <button
            className="button button-secondary"
            onClick={() => refresh.current()}
          >
            Retry
          </button>
        </div>
      )}

      <div
        className="chat-history"
        ref={scroll}
        aria-label="Messages"
      >
        {loading ? (
          <LoadingSpinner />
        ) : !conversation ? (
          <div className="community-empty">
            Conversation unavailable.
          </div>
        ) : (
          <>
            {older && (
              <button
                className="button button-secondary"
                disabled={loadingOlder}
                onClick={loadOlder}
              >
                {loadingOlder
                  ? 'Loading...'
                  : 'Load older messages'}
              </button>
            )}

            {messages.length ? (
              messages.map((item, index) => {
                const previous =
                  index > 0
                    ? messages[index - 1]
                    : null

                const own =
                  Number(item.sender_id) === userID

                const newDay =
                  !previous ||
                  !isSameDay(
                    previous.created_at,
                    item.created_at,
                  )

                const newSender =
                  !previous ||
                  Number(previous.sender_id) !==
                    Number(item.sender_id) ||
                  newDay

                return (
                  <Fragment key={item.id}>
                    {newDay && (
                      <div className="chat-date-separator">
                        <span>
                          {formatDateSeparator(
                            item.created_at,
                          )}
                        </span>
                      </div>
                    )}

                    <article
                      className={[
                        'chat-bubble',
                        own ? 'is-own' : '',
                        newSender
                          ? 'is-new-sender'
                          : 'is-continuation',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {teamChat &&
                        !own &&
                        newSender && (
                          <strong className="chat-sender">
                            {item.sender_name ||
                              'Team member'}
                          </strong>
                        )}

                      <p>{item.content}</p>

                      <time
                        dateTime={item.created_at}
                      >
                        {formatMessageTime(
                          item.created_at,
                        )}
                      </time>
                    </article>
                  </Fragment>
                )
              })
            ) : (
              <div className="community-empty">
                <MessageCircle size={26} />

                <p>
                  {teamChat
                    ? 'Start planning with your team.'
                    : 'Start the conversation. Say hello!'}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {conversation && (
        <form
          className="chat-composer"
          onSubmit={send}
        >
          {sendError && (
            <div
              className="error-message"
              role="alert"
            >
              {sendError}. Your draft is
              preserved.
            </div>
          )}

          <label
            className="sr-only"
            htmlFor="message-draft"
          >
            Message
          </label>

          <textarea
            id="message-draft"
            name="content"
            placeholder={
              teamChat
                ? 'Message your team...'
                : 'Write a message...'
            }
            rows={2}
            maxLength={4000}
            value={draft}
            disabled={sending}
            onChange={(event) =>
              setDraft(event.target.value)
            }
            onKeyDown={handleComposerKeyDown}
          />

          <button
            className="button button-primary"
            disabled={
              sending || !draft.trim()
            }
          >
            <Send size={17} />

            {sending
              ? 'Sending...'
              : 'Send'}
          </button>
        </form>
      )}
    </section>
  )
}

export default function Messages() {
  const { conversationId } = useParams()

  const [pages, setPages] = useState(1)

  const loader = useCallback(async () => {
    const groups = await Promise.all(
      Array.from(
        { length: pages },
        (_, page) =>
          getConversations(page * 50),
      ),
    )

    return [
      ...new Map(
        groups
          .flat()
          .map((item) => [item.id, item]),
      ).values(),
    ]
  }, [pages])

  const {
    data,
    loading,
    error,
    reload,
  } = usePolling(loader, 10000)

  const teamChats =
    data?.filter(
      (item) => item.type === 'team',
    ) || []

  const directMessages =
    data?.filter(
      (item) => item.type !== 'team',
    ) || []

  const renderGroup = (
    title,
    items,
    emptyText,
  ) => (
    <section className="conversation-group">
      <h3 className="conversation-group-title">
        {title}
      </h3>

      {items.length ? (
        items.map((item) => (
          <ConversationItem
            key={item.id}
            item={item}
            active={
              String(item.id) ===
              String(conversationId)
            }
          />
        ))
      ) : (
        <p className="conversation-group-empty">
          {emptyText}
        </p>
      )}
    </section>
  )

  return (
    <div className="messages-page">
      <Navbar
        title="Messages"
        subtitle="Coordinate with your team and connect with teammates."
        action={false}
      />

      <div className="page-body community-body">
        <div
          className={`panel messages-layout ${
            conversationId
              ? 'has-active'
              : ''
          }`}
        >
          <aside
            className="conversation-list"
            aria-label="Conversations"
          >
            <div className="conversation-list-heading">
              <div>
                <h2>Messages</h2>
                <p>
                  Your collaboration space.
                </p>
              </div>
            </div>

            {error && (
              <div
                className="error-message"
                role="alert"
              >
                {error}

                <button onClick={reload}>
                  Retry
                </button>
              </div>
            )}

            {loading && !data ? (
              <LoadingSpinner />
            ) : data?.length ? (
              <>
                {renderGroup(
                  'TEAM CHATS',
                  teamChats,
                  'Join a team to start collaborating.',
                )}

                {renderGroup(
                  'DIRECT MESSAGES',
                  directMessages,
                  'Message someone from their profile.',
                )}

                {data.length === pages * 50 && (
                  <button
                    className="button button-secondary"
                    onClick={() =>
                      setPages(
                        (current) =>
                          current + 1,
                      )
                    }
                  >
                    Load more conversations
                  </button>
                )}
              </>
            ) : !error ? (
              <div className="community-empty">
                <MessageCircle size={28} />

                <h3>
                  Your conversations will
                  appear here.
                </h3>

                <p>
                  Message a teammate from
                  their profile or join a
                  team to start
                  collaborating.
                </p>

                <Link
                  className="button button-primary"
                  to="/teams"
                >
                  Explore Teams
                </Link>
              </div>
            ) : null}
          </aside>

          {conversationId ? (
            <ChatThread
              key={conversationId}
              id={conversationId}
              onRead={reload}
            />
          ) : (
            <div className="chat-placeholder community-empty">
              <MessageCircle size={34} />

              <h3>
                Choose a conversation
              </h3>

              <p>
                Open a team chat or direct
                message to start talking.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}