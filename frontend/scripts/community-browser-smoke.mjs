// Run Vite on FRONTEND_URL (default localhost:5173), Chrome CDP port 9334,
// and PHASE=1..4. API fixtures test the UI; Go integration tests use PostgreSQL.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173'
const pages = await fetch(process.env.CDP_URL || 'http://127.0.0.1:9334/json').then(r => r.json())
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl)
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }))
let sequence = 0
const pending = new Map(), errors = []
ws.addEventListener('message', event => {
  const data = JSON.parse(event.data)
  if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text)
  if (data.id) {
    const task = pending.get(data.id); pending.delete(data.id)
    if (data.error) task.reject(Error(data.error.message)); else task.resolve(data.result)
  }
})
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) })
}
async function evaluate(expression) {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails))
  return r.result.value
}
async function until(expression) {
  for (let i = 0; i < 80; i++) {
    if (await evaluate(`Boolean(${expression})`)) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw Error('Timed out: ' + expression)
}
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
const navigate = async path => { await cdp('Page.navigate', { url: base + path }); await until('window.__requests') }
const buttonText = text => evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`)
async function fill(name, value) {
  await evaluate(`(() => { const el = document.querySelector('[name="${name}"]'); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); })()`)
}
function fixtures() {
  localStorage.setItem('token', 'test.' + btoa(JSON.stringify({ user_id: 1, exp: 9999999999 })) + '.test')
  localStorage.setItem('currentUser', JSON.stringify({ id: 1, name: 'Owner' }))
  window.__requests = []
  const showcase = { portfolio: [], achievements: [] }
  const chat = { id: 1, other_user: { id: 4, name: 'Budi' }, last_message: 'Hello teammate', updated_at: '2026-09-12T00:00:00Z', unread_count: 1 }
  const messages = [{ id: 1, conversation_id: 1, sender_id: 4, content: 'Hello teammate', created_at: '2026-09-12T00:00:00Z', read_at: null }]
  window.__pushMessage = () => { messages.push({ id: messages.length + 1, conversation_id: 1, sender_id: 4, content: 'Arrived through polling', created_at: new Date().toISOString() }); chat.unread_count++ }
  const notifications = [{ id: 1, type: 'join_request_received', title: 'New join request', message: 'Budi requested to join Community Team.', related_team_id: 7, related_user_id: 4, is_read: false, created_at: '2026-09-12T00:00:00Z' }]
  const original = window.fetch.bind(window)
  window.fetch = async (input, options = {}) => {
    const url = new URL(input, location.href)
    if (!url.pathname.startsWith('/api/')) return original(input, options)
    const path = url.pathname.slice(4), method = options.method || 'GET'
    window.__requests.push({ path, method })
    let data = [], status = 200
    const body = options.body ? JSON.parse(options.body) : null
    if (path === '/profile') data = { id: 1, name: 'Owner', email: 'owner@example.test' }
    else if (path === '/notifications/unread-count') data = { unread_count: notifications.filter(n => !n.is_read).length }
    else if (path === '/notifications') data = notifications
    else if (path.startsWith('/notifications/') && method === 'PUT') notifications.forEach(n => { n.is_read = true })
    else if (path === '/profile/showcase') data = showcase
    else if (/^\/profile\/(portfolio|achievements)/.test(path)) {
      const [, , kind, id] = path.split('/')
      if (method === 'POST') { data = { ...body, id: 1 }; showcase[kind].push(data) }
      if (method === 'PUT') { data = { ...body, id: Number(id) }; showcase[kind] = showcase[kind].map(item => item.id === Number(id) ? data : item) }
      if (method === 'DELETE') showcase[kind] = showcase[kind].filter(item => item.id !== Number(id))
    } else if (/^\/users\/\d+\/profile$/.test(path)) data = { id: 4, name: 'Budi', ...showcase, skills: [], teams: [] }
    else if (path === '/conversations') data = method === 'POST' ? { id: 1 } : [chat]
    else if (path === '/conversations/1') data = chat
    else if (path === '/conversations/1/messages') {
      if (method === 'POST') {
        if (window.__sendFails) { status = 500; data = { error: 'Temporary send failure' } }
        else { data = { id: messages.length + 1, conversation_id: 1, sender_id: 1, content: body.content, created_at: new Date().toISOString() }; messages.push(data); chat.last_message = body.content }
      } else data = messages.filter(m => !url.searchParams.get('after') || m.id > Number(url.searchParams.get('after')))
    } else if (path === '/conversations/1/read') { chat.unread_count = 0; messages.forEach(m => { m.read_at = new Date().toISOString() }) }
    else if (path.startsWith('/conversations/999')) { status = 404; data = { error: 'Conversation not found' } }
    else if (path === '/teams/recommended') data = [{ team: { id: 7, name: 'Recommended Community', owner_id: 4, max_members: 5, competition_category: 'Technology', competition_type: 'Hackathon', beginner_friendly: true }, member_count: 2, match_score: 86, recommended_role: 'Frontend Developer', matched_skills: ['React'], reason: 'Matches your preferred role', match: { match_score: 86, skill_score: 24, role_interest_score: 25, availability_score: 20, project_interest_score: 7, experience_fit_score: 10, matched_skills: ['React'] }, availability_note: 'Team schedules are not specified.' }]
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  }
}
try {
  await cdp('Page.enable'); await cdp('Runtime.enable')
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${fixtures.toString()})()` })
  await navigate('/notifications')
  await until('document.querySelector(".notification-row.is-unread")')
  assert.equal(await evaluate('document.querySelector(".notification-button").getAttribute("href")'), '/notifications')
  assert.equal(await evaluate('document.querySelector(".notification-row a").getAttribute("href")'), '/teams/7')
  await click('.notification-row button')
  await until('!document.querySelector(".notification-row.is-unread") && !document.querySelector(".notification-count")')
  await cdp('Page.reload'); await until('document.querySelector(".notification-row.is-unread")')
  await click('.section-heading button'); await until('!document.querySelector(".notification-row.is-unread")')
  assert.deepEqual(errors, [])
  console.log('PASS: notifications bell, unread badge, mark one/all, team target, SPA refresh.')
  if (Number(process.env.PHASE || 2) >= 2) {
    await navigate('/profile'); await until('document.querySelector(".profile-showcase .section-heading button")')
    await buttonText('Add Project'); await fill('title', 'SkillMatch Project'); await fill('role', 'Developer'); await fill('technologies', 'React, Go'); await fill('project_url', 'https://example.test'); await buttonText('Save')
    await until('document.querySelector(".showcase-item h3")?.textContent === "SkillMatch Project"')
    await click('[aria-label="Edit SkillMatch Project"]'); await fill('title', 'Updated Project'); await buttonText('Save'); await until('document.querySelector(".showcase-item h3")?.textContent === "Updated Project"')
    await buttonText('Add Achievement'); await fill('title', 'Community Award'); await fill('date', '2026-09-12'); await buttonText('Save'); await until('document.body.textContent.includes("Community Award") && !document.querySelector(".modal-backdrop")')
    await evaluate('history.pushState({}, "", "/users/4"); dispatchEvent(new PopStateEvent("popstate"))')
    await until('document.querySelector(".public-profile-header")')
    assert.equal(await evaluate('document.querySelectorAll(".showcase-controls").length'), 0)
    assert.ok(await evaluate('document.body.textContent.includes("Updated Project") && document.body.textContent.includes("Community Award")'))
    await evaluate('history.pushState({}, "", "/profile"); dispatchEvent(new PopStateEvent("popstate"))'); await until('document.querySelector(".showcase-controls")')
    await click('[aria-label="Delete Updated Project"]'); await buttonText('Delete'); await until('!document.body.textContent.includes("Updated Project")')
    console.log('PASS: portfolio create/edit/delete, achievement create, public read-only showcase, own profile preserved.')
  }
  if (Number(process.env.PHASE || 2) >= 3) {
    await navigate('/users/4'); await until('document.querySelector(".public-profile-header")'); await buttonText('Message')
    await until('location.pathname === "/messages/1" && document.querySelector(".chat-bubble")')
    assert.ok(await evaluate('window.__requests.some(r => r.path === "/conversations/1/read" && r.method === "PUT")'))
    await fill('content', 'Hello from Owner'); await buttonText('Send'); await until('document.querySelector(".chat-bubble.is-own")?.textContent.includes("Hello from Owner")')
    await evaluate('window.__sendFails = true'); await fill('content', 'Keep my draft'); await buttonText('Send'); await until('document.querySelector(".chat-composer .error-message")')
    assert.equal(await evaluate('document.querySelector("#message-draft").value'), 'Keep my draft')
    await evaluate('window.__sendFails = false'); await buttonText('Send'); await until('[...document.querySelectorAll(".chat-bubble")].some(el => el.textContent.includes("Keep my draft"))')
    await evaluate('window.__pushMessage()')
    await evaluate('new Promise(resolve => setTimeout(resolve, 2000))')
    await until('document.querySelector(".chat-history")?.textContent.includes("Arrived through polling")')
    await cdp('Page.reload'); await until('document.querySelector(".chat-header .user-profile-link")')
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: false })
    await until('document.querySelector(".sidebar").getBoundingClientRect().right <= 0')
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".conversation-list")).display'), 'none')
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'))
    await click('.chat-back'); await until('location.pathname === "/messages"')
    await click('.conversation-link'); await until('document.querySelector(".chat-header .user-profile-link")')
    await navigate('/messages/999'); await until('document.body.textContent.includes("Conversation not found")')
    assert.equal(await evaluate('document.querySelectorAll(".chat-composer").length'), 0)
    console.log('PASS: public profile Message, chat send/read, retained draft/retry, refresh, mobile list/detail, unauthorized conversation state.')
  }
  if (Number(process.env.PHASE || 2) >= 4) {
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
    await navigate('/dashboard'); await until('document.querySelector(".recommendation-card")')
    assert.ok(await evaluate('document.querySelector(".recommendation-card").textContent.includes("86%") && document.querySelector(".recommended-role").textContent.includes("Frontend Developer")'))
    await click('.recommendation-breakdown summary')
    assert.equal(await evaluate('document.querySelectorAll(".recommendation-card [role=progressbar]").length'), 5)
    assert.equal(await evaluate('document.querySelector(".recommendation-reason").textContent'), 'Matches your preferred role')
    assert.equal(await evaluate('document.querySelector(".recommendation-card > a").getAttribute("href")'), '/teams/7')
    for (const route of ['/notifications', '/profile', '/users/4', '/messages/1', '/dashboard']) {
      await navigate(route)
      await until('document.querySelector(".topbar")')
      await evaluate('new Promise(resolve => setTimeout(resolve, 300))')
      for (const width of [1440, 900, 390, 320]) {
        await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
        await evaluate('new Promise(resolve => setTimeout(resolve, 300))')
        assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `overflow ${route} at ${width}px`)
        if (width === 1440 || width === 390) {
          const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
          await fs.mkdir(new URL('../../.gocache/community-review/', import.meta.url), { recursive: true })
          await fs.writeFile(new URL(`../../.gocache/community-review/${route.replaceAll('/', '-')}-${width}.png`, import.meta.url), Buffer.from(shot.data, 'base64'))
        }
      }
    }
    console.log('PASS: ranked recommendation API data, explanation/breakdown, team link, all new pages at 1440/900/390/320px.')
  }
  assert.deepEqual(errors, [])
} finally { ws.close() }
