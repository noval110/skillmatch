// Run against the local Vite server and isolated Chrome CDP instance.
// API calls are intercepted and fulfilled with mutable in-browser fixtures.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const appBase = 'http://127.0.0.1:5174'
const targets = await (await fetch('http://127.0.0.1:9337/json')).json()
const page = targets.find(target => target.type === 'page')
assert.ok(page, 'No Chrome page target is available')
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))

let id = 0
let apiBase = ''
let access = 'owner'
let mode = 'list'
let nextID = 10
const pending = new Map()
const requests = []
const runtimeErrors = []
const checks = []
const pause = (ms = 160) => new Promise(resolve => setTimeout(resolve, ms))
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const requestID = ++id
  pending.set(requestID, { resolve, reject })
  socket.send(JSON.stringify({ id: requestID, method, params }))
})
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  return result.result.value
}
const until = async expression => {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await evaluate(expression)) return
    await pause(100)
  }
  throw new Error(`Timed out waiting for ${expression}`)
}

const profile = { id: 101, name: 'Noval', email: 'fixture@example.test', bio: 'Builder', experience_level: 'intermediate', preferred_role: 'Developer', availability: 'flexible', project_interest: 'Web Development', avatar_url: '' }
const team = () => ({ id: 1, name: 'Telupewete', owner_id: access === 'owner' ? 101 : 999, max_members: 4, description: 'Building an accessible learning platform.', project_idea: 'Competition-ready learning tools.', competition_category: 'Technology', competition_type: 'Web Development', beginner_friendly: true, willing_to_mentor: true })
const members = () => access === 'owner'
  ? [{ id: 101, name: 'Noval', role: 'Owner' }, { id: 102, name: 'Dian', role: 'Member' }]
  : access === 'member'
    ? [{ id: 999, name: 'Owner', role: 'Owner' }, { id: 101, name: 'Noval', role: 'Member' }]
    : [{ id: 999, name: 'Owner', role: 'Owner' }, { id: 102, name: 'Dian', role: 'Member' }]
const originalMilestones = () => [
  { id: 1, team_id: 1, title: 'Proposal', description: 'Prepare the problem statement, solution concept, and implementation plan.', status: 'in_progress', progress: 65, due_date: '2026-09-13', created_by: 101, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-10T00:00:00Z' },
  { id: 2, team_id: 1, title: 'Testing', description: 'Run accessibility and usability tests with students.', status: 'not_started', progress: 0, due_date: '2026-09-16', created_by: 101, created_at: '2026-09-02T00:00:00Z', updated_at: '2026-09-02T00:00:00Z' },
  { id: 3, team_id: 1, title: 'Demo Video', description: 'Record a concise product walkthrough.', status: 'in_progress', progress: 40, due_date: '2026-10-18', created_by: 101, created_at: '2026-09-03T00:00:00Z', updated_at: '2026-09-08T00:00:00Z' },
  { id: 4, team_id: 1, title: 'Prototype', description: 'Complete the interactive product prototype.', status: 'completed', progress: 100, due_date: '2026-09-10', created_by: 101, created_at: '2026-08-20T00:00:00Z', updated_at: '2026-09-09T00:00:00Z' },
]
let milestones = originalMilestones()
const sortMilestones = values => [...values].sort((left, right) => {
  if ((left.status === 'completed') !== (right.status === 'completed')) return left.status === 'completed' ? 1 : -1
  if (!left.due_date !== !right.due_date) return left.due_date ? -1 : 1
  return (left.due_date || '').localeCompare(right.due_date || '') || left.id - right.id
})
const milestoneResponse = () => {
  const rows = mode === 'empty' ? [] : sortMilestones(milestones)
  const total = rows.length
  return {
    milestones: rows,
    can_manage: access === 'owner',
    summary: {
      total,
      completed: rows.filter(item => item.status === 'completed').length,
      in_progress: rows.filter(item => item.status === 'in_progress').length,
      not_started: rows.filter(item => item.status === 'not_started').length,
      overall_progress: total ? Math.round(rows.reduce((sum, item) => sum + item.progress, 0) / total) : null,
      next_milestone: rows.find(item => item.status !== 'completed') || null,
    },
  }
}
const readiness = { team_id: 1, status: 'setup_required', readiness_score: null, message: 'Add team roles and required skills to calculate readiness.', components: {}, weights: {}, summary: {}, strengths: [], priority_gaps: [], roles: [], skills: [], member_profiles: [], recommended_actions: [], assumptions: [] }

function fixture(path, method, requestBody) {
  if (path === '/teams/1/milestones') {
    if (mode === 'error') return [503, { error: 'Workspace temporarily unavailable' }]
    if (method === 'POST') {
      const body = JSON.parse(requestBody)
      const item = { id: nextID++, team_id: 1, ...body, created_by: 101, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      milestones.push(item)
      return [201, item]
    }
    return [200, milestoneResponse()]
  }
  const itemMatch = path.match(/^\/teams\/1\/milestones\/(\d+)$/)
  if (itemMatch) {
    const milestoneID = Number(itemMatch[1])
    if (method === 'PUT') {
      const body = JSON.parse(requestBody)
      const index = milestones.findIndex(item => item.id === milestoneID)
      milestones[index] = { ...milestones[index], ...body, updated_at: new Date().toISOString() }
      return [200, milestones[index]]
    }
    if (method === 'DELETE') {
      milestones = milestones.filter(item => item.id !== milestoneID)
      return [204, {}]
    }
  }
  if (path === '/profile') return [200, profile]
  if (path === '/profile/skills') return [200, [{ id: 1, name: 'React', skill_name: 'React', level: 'advanced' }]]
  if (path === '/profile/showcase') return [200, { portfolio: [], achievements: [] }]
  if (path === '/skills') return [200, []]
  if (path === '/teams' || path === '/teams/search') return [200, [team()]]
  if (path === '/teams/recommended') return [200, []]
  if (path === '/teams/1') return [200, { team: team(), members: members() }]
  if (path === '/teams/1/roles') return [200, []]
  if (path === '/teams/1/readiness') return [200, readiness]
  if (path === '/teams/1/join-requests') return [200, []]
  if (path === '/notifications/unread-count') return [200, { unread_count: 2 }]
  if (method === 'OPTIONS') return [200, {}]
  return [200, []]
}

socket.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data)
  if (message.id) {
    const callback = pending.get(message.id)
    pending.delete(message.id)
    if (callback) {
      if (message.error) callback.reject(message.error)
      else callback.resolve(message.result)
    }
  }
  if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails)
  if (message.method !== 'Fetch.requestPaused') return
  const { requestId, request } = message.params
  if (!apiBase || !request.url.startsWith(apiBase)) {
    await send('Fetch.continueRequest', { requestId })
    return
  }
  const apiPath = new URL(apiBase).pathname.replace(/\/$/, '')
  const path = new URL(request.url).pathname.slice(apiPath.length) || '/'
  requests.push({ path, method: request.method, body: request.postData || '', authorization: request.headers.Authorization || request.headers.authorization || '' })
  const [status, body] = fixture(path, request.method, request.postData)
  await send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' }], body: Buffer.from(JSON.stringify(body)).toString('base64') })
})

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: appBase })
await until('!!document.querySelector(".landing-page")')
apiBase = await evaluate("import('/src/services/api.js').then(module => module.default)")
assert.ok(apiBase)
await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
const token = `e30.${Buffer.from(JSON.stringify({ user_id: 101 })).toString('base64url')}.fixture`
await evaluate(`localStorage.setItem('token', ${JSON.stringify(token)}); localStorage.setItem('currentUser', ${JSON.stringify(JSON.stringify(profile))})`)

async function navigate(route, selector) {
  await send('Page.navigate', { url: appBase + route })
  await until(`location.pathname === ${JSON.stringify(route.split('?')[0])}`)
  await until(selector)
  await pause(250)
}
const openWorkspace = () => navigate('/teams/1?tab=milestones', '!!document.querySelector(".milestone-workspace, .detail-tabs + .panel")')

access = 'owner'; mode = 'list'; milestones = originalMilestones()
await openWorkspace()
assert.equal(await evaluate('document.querySelectorAll(".milestone-card").length'), 4)
assert.equal(await evaluate('document.querySelector(".milestone-overall strong").textContent'), '51%')
assert.ok(await evaluate('document.body.innerText.includes("Overdue") && document.body.innerText.includes("Due soon") && document.body.innerText.includes("Completed")'))
assert.deepEqual(await evaluate('[...document.querySelectorAll(".milestone-card h3")].map(node => node.textContent)'), ['Proposal', 'Testing', 'Demo Video', 'Prototype'])
assert.ok(requests.some(request => request.path === '/teams/1/milestones' && request.authorization.startsWith('Bearer ')))
checks.push({ scenario: 'owner list, progress summary, sorted deadlines', pass: true })

await evaluate('[...document.querySelectorAll("button")].find(node => node.textContent.includes("New Milestone")).click()')
await until('!!document.querySelector(".milestone-form")')
await evaluate(`document.querySelector('.milestone-form input[name=title]').value='Pitch Deck'; document.querySelector('.milestone-form textarea').value='Prepare the final story.'; document.querySelector('.milestone-form input[name=due_date]').value='2026-10-20'; document.querySelector('.milestone-form').requestSubmit()`)
await until('document.querySelectorAll(".milestone-card").length === 5')
assert.ok(requests.some(request => request.method === 'POST' && request.path === '/teams/1/milestones' && JSON.parse(request.body).title === 'Pitch Deck'))
checks.push({ scenario: 'owner creates milestone', pass: true })

await evaluate('document.querySelector(".milestone-card .milestone-actions button").click()')
await until('!!document.querySelector(".milestone-form")')
await evaluate(`document.querySelector('.milestone-form input[name=title]').value='Proposal Review'; document.querySelector('.milestone-form').requestSubmit()`)
await until('document.body.innerText.includes("Proposal Review")')
assert.ok(requests.some(request => request.method === 'PUT' && JSON.parse(request.body).title === 'Proposal Review'))
checks.push({ scenario: 'owner edits milestone', pass: true })

await evaluate('document.querySelector(".milestone-card .mark-complete").click()')
await until('document.querySelector(".milestone-summary").innerText.includes("Completed\\n2")')
const completionRequest = requests.findLast(request => request.method === 'PUT')
assert.equal(JSON.parse(completionRequest.body).status, 'completed')
assert.equal(JSON.parse(completionRequest.body).progress, 100)
checks.push({ scenario: 'owner marks complete', pass: true })

const countBeforeDelete = await evaluate('document.querySelectorAll(".milestone-card").length')
await evaluate('document.querySelector(".milestone-card .milestone-actions button:nth-child(2)").click()')
await until('!!document.querySelector(".confirm-dialog")')
await evaluate('[...document.querySelectorAll(".confirm-dialog button")].find(node => node.textContent.includes("Delete Milestone")).click()')
await until(`document.querySelectorAll(".milestone-card").length === ${countBeforeDelete - 1}`)
assert.ok(requests.some(request => request.method === 'DELETE' && /\/milestones\/\d+$/.test(request.path)))
checks.push({ scenario: 'owner deletes milestone', pass: true })

mode = 'empty'; await openWorkspace()
assert.ok(await evaluate('document.body.innerText.includes("Plan your competition journey.") && document.body.innerText.includes("Create First Milestone")'))
checks.push({ scenario: 'owner empty state', pass: true })

access = 'member'; await openWorkspace()
assert.ok(await evaluate('document.body.innerText.includes("No milestones have been created yet.")'))
assert.ok(!await evaluate('document.body.innerText.includes("Create First Milestone")'))
checks.push({ scenario: 'member read-only empty state', pass: true })

access = 'outsider'; mode = 'list'
const beforeOutsider = requests.filter(request => request.path === '/teams/1/milestones').length
await openWorkspace()
assert.ok(await evaluate('document.body.innerText.includes("Competition workspace is available to team members.")'))
assert.equal(requests.filter(request => request.path === '/teams/1/milestones').length, beforeOutsider)
checks.push({ scenario: 'outsider controlled state', detailedRequestSent: false, pass: true })

access = 'owner'; mode = 'error'; await openWorkspace()
assert.ok(await evaluate('document.body.innerText.includes("Competition workspace couldn\'t be loaded.") && document.body.innerText.includes("Retry")'))
checks.push({ scenario: 'API error state', pass: true })

mode = 'list'; milestones = originalMilestones()
await navigate('/dashboard', '!!document.querySelector(".command-stats") && !document.querySelector(".command-loading")')
await until('!!document.querySelector(".preparation-preview:not(.preview-loading)")')
assert.ok(await evaluate('document.querySelector(".preparation-preview").innerText.includes("1 / 4 milestones complete") && document.querySelector(".preparation-preview").innerText.includes("51%") && document.querySelector(".preparation-preview").innerText.includes("Proposal")'))
checks.push({ scenario: 'dashboard preparation preview', pass: true })

await mkdir('artifacts/team-milestones', { recursive: true })
await openWorkspace()
for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844], ['small-mobile', 320, 780]]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await evaluate('window.scrollTo(0, 0)')
  await pause(220)
  const layout = await evaluate('({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, overflowing: [...document.querySelectorAll("body *")].filter(node => { const rect = node.getBoundingClientRect(); const style = getComputedStyle(node); return rect.width > 0 && style.display !== "none" && style.position !== "fixed" && rect.right > innerWidth + 1 }).map(node => ({ tag: node.tagName, className: String(node.className), right: node.getBoundingClientRect().right })).slice(0, 20) })')
  if (layout.documentWidth > width || layout.overflowing.length) console.log('Overflow diagnostic', name, layout)
  assert.ok(layout.documentWidth <= width, `${name} document overflow`)
  assert.deepEqual(layout.overflowing, [], `${name} elements overflow`)
  checks.push({ viewport: name, ...layout })
  if (name !== 'small-mobile') {
    const metrics = await send('Page.getLayoutMetrics')
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: metrics.cssContentSize.height, scale: 1 } })
    await writeFile(`artifacts/team-milestones/${name}.png`, Buffer.from(screenshot.data, 'base64'))
  }
}

assert.equal(runtimeErrors.length, 0, `Browser runtime errors: ${JSON.stringify(runtimeErrors)}`)
await writeFile('artifacts/team-milestones/checks.json', JSON.stringify({ checks, mutations: requests.filter(request => ['POST', 'PUT', 'DELETE'].includes(request.method)).map(request => ({ path: request.path, method: request.method, body: request.body, authorized: request.authorization.startsWith('Bearer ') })), runtimeErrors: [] }, null, 2))
socket.close()
console.log(`Team Milestones browser verification passed (${checks.length} checks).`)
