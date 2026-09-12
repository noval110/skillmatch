// Run against a Vite production preview built with
// VITE_API_URL=https://skillmatch-api.example.test/api and Chrome's CDP port 9334.
// API fixtures verify the frontend contract; Go integration tests use real PostgreSQL.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:4173'
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
function fixtures() {
  localStorage.setItem('token', 'test.' + btoa(JSON.stringify({ user_id: 1, exp: 9999999999 })) + '.test')
  localStorage.setItem('currentUser', JSON.stringify({ id: 1, name: 'Viewer' }))
  const team = { id: 7, name: 'Profile Team', owner_id: 1, max_members: 5, competition_category: 'Technology', competition_type: 'Hackathon' }
  const members = [{ id: 1, name: 'Viewer', role: 'Owner' }, { id: 4, name: 'Budi Santoso', role: 'Frontend Developer' }]
  const profile = { id: 4, name: 'Budi Santoso', bio: 'Building accessible communities together.', preferred_role: 'Frontend Developer', experience_level: 'beginner', availability: 'weekend', project_interest: 'Hackathon', created_at: '2025-01-02T00:00:00Z', profile_photo_url: '/uploads/avatars/user-4.png', skills: [{ id: 1, name: 'React', category: 'Technical', level: 'advanced' }, { id: 2, name: 'Public Speaking', category: 'Communication', level: 'beginner' }], teams: [{ id: 7, name: 'Profile Team', role: 'Frontend Developer' }] }
  let applicants = [{ id: 42, user_id: 4, name: 'Budi Santoso', status: 'pending', message: 'Let us build together.' }]
  window.__requests = []
  window.__fail = true
  const original = window.fetch.bind(window)
  window.fetch = async (input, options = {}) => {
    const url = new URL(input, location.href)
    if (!url.pathname.startsWith('/api/')) return original(input, options)
    const path = url.pathname.slice(4)
    window.__requests.push({ url: url.href, path, authorization: options.headers?.Authorization, method: options.method || 'GET' })
    let data = [], status = 200
    if (/^\/users\/.+\/profile$/.test(path)) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const id = Number(path.split('/')[2])
      if (id === 999) { data = { error: 'User not found' }; status = 404 }
      else if (id === 500 && window.__fail) { data = { error: 'Database unavailable' }; status = 500 }
      else if (id === 5) data = { ...profile, id, name: 'Empty Member', bio: '', preferred_role: '', availability: '', project_interest: '', created_at: null, profile_photo_url: '', skills: [], teams: [] }
      else data = { ...profile, id }
    } else if (path === '/profile') data = { id: 1, name: 'Viewer', email: 'private@example.test' }
    else if (path === '/teams' || path === '/teams/search') data = [team]
    else if (path === '/teams/7') data = { team, members }
    else if (path === '/teams/7/join-requests') data = applicants
    else if (path.includes('/accept') || path.includes('/reject')) { applicants = []; data = { message: 'Updated' } }
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  }
}
try {
  await cdp('Page.enable'); await cdp('Runtime.enable')
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${fixtures.toString()})()` })
  const photo = await fs.readFile(new URL('../src/assets/avatars/avatar-1.png', import.meta.url))
  ws.addEventListener('message', event => {
    const data = JSON.parse(event.data)
    if (data.method === 'Fetch.requestPaused') cdp('Fetch.fulfillRequest', { requestId: data.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'image/png' }], body: photo.toString('base64') }).catch(error => errors.push(error.message))
  })
  await cdp('Fetch.enable', { patterns: [{ urlPattern: 'https://skillmatch-api.example.test/uploads/*' }] })
  await navigate('/teams/7'); await until('document.querySelector(".member-profile-link")')
  await click('.member-profile-link[href="/users/4"]')
  await until('document.body.textContent.includes("Loading public profile")')
  await until('document.querySelector(".public-profile-heading h1")?.textContent === "Budi Santoso"')
  assert.equal(await evaluate('location.pathname'), '/users/4')
  assert.ok(await evaluate('window.__requests.some(r => r.url === "https://skillmatch-api.example.test/api/users/4/profile" && r.authorization?.startsWith("Bearer "))'))
  assert.equal(await evaluate('document.querySelector(".public-profile-avatar img").src'), 'https://skillmatch-api.example.test/uploads/avatars/user-4.png')
  await cdp('Page.reload'); await until('document.querySelector(".public-profile-heading h1")?.textContent === "Budi Santoso"')
  assert.equal(await evaluate('document.querySelectorAll(".public-profile-body input, .public-profile-body textarea").length'), 0)
  await click('.public-profile-team'); await until('location.pathname === "/teams/7"')
  for (const [route, selector] of [['/join-requests', '.request-card .user-profile-name'], ['/join-requests', '.request-card .user-avatar-link'], ['/my-team', '.member-avatar-group a[href="/users/4"]']]) {
    await navigate(route); await until(`document.querySelector(${JSON.stringify(selector)})`); await click(selector)
    await until('location.pathname === "/users/4" && document.querySelector(".public-profile-header")')
  }
  await navigate('/join-requests'); await until('document.querySelector(".request-actions button")')
  await click('.request-actions button'); await until('window.__requests.some(r => r.path === "/join-requests/42/reject" && r.method === "PUT")')
  assert.equal(await evaluate('location.pathname'), '/join-requests')
  await navigate('/users/4'); await until('document.querySelector(".public-profile-header")')
  assert.equal(await evaluate('document.querySelector(".notification-button").getAttribute("href")'), '/notifications')
  await click('.topbar-user'); await until(`document.querySelector('.account-popover a[href="/profile"]')`)
  await navigate('/users/999'); await until('document.querySelector(".public-profile-error h1")?.textContent === "User not found"')
  await click('.public-profile-error a'); await until('location.pathname === "/teams"')
  await navigate('/users/500'); await until('document.querySelector(".public-profile-error button")')
  await evaluate('window.__fail = false'); await click('.public-profile-error button'); await until('document.querySelector(".public-profile-header")')
  await navigate('/users/5'); await until('document.body.textContent.includes("No skills added yet.")')
  assert.ok(await evaluate('document.body.textContent.includes("This member has not joined any teams yet.")'))
  await navigate('/users/4'); await until('document.querySelector(".public-profile-header")')
  for (const width of [1440, 900, 390, 320]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    if (width <= 390) await until('document.querySelector(".sidebar").getBoundingClientRect().right <= 0')
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `overflow at ${width}px`)
    if (width === 1440 || width === 390) {
      const screenshot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      await fs.mkdir(new URL('../../.gocache/public-profile-review/', import.meta.url), { recursive: true })
      await fs.writeFile(new URL(`../../.gocache/public-profile-review/${width}.png`, import.meta.url), Buffer.from(screenshot.data, 'base64'))
    }
  }
  assert.deepEqual(errors, [])
  console.log('PASS: member/applicant links, request action, notifications/account navigation, authenticated API URL, photo URL, refresh, loading, 404, retry, empty profile, responsive 1440/900/390/320px, no runtime exceptions.')
} finally { ws.close() }
