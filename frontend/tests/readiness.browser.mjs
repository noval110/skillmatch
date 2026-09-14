// Run against the local Vite dev server and an isolated Chrome CDP profile.
// All API data is intercepted in the browser; this never writes to the backend.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const appBase = 'http://127.0.0.1:5174'
const chromeTargets = await (await fetch('http://127.0.0.1:9337/json')).json()
const pageTarget = chromeTargets.find(target => target.type === 'page')
assert.ok(pageTarget, 'No Chrome page target is available')
const socket = new WebSocket(pageTarget.webSocketDebuggerUrl)
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))

let sequence = 0
let apiBase = ''
let readinessMode = 'mixed'
let accessMode = 'owner'
const pending = new Map()
const runtimeErrors = []
const requests = []
const checks = []
const pause = (milliseconds = 160) => new Promise(resolve => setTimeout(resolve, milliseconds))
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence
  pending.set(id, { resolve, reject })
  socket.send(JSON.stringify({ id, method, params }))
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
  throw new Error(`Timed out waiting for: ${expression}`)
}

const profile = {
  id: 101,
  name: 'Noval',
  email: 'fixture@example.test',
  bio: 'Learning through collaboration.',
  experience_level: 'intermediate',
  preferred_role: 'Frontend Developer',
  availability: 'flexible',
  project_interest: 'Web Development',
  avatar_url: '',
}
const baseTeam = {
  id: 1,
  name: 'Telupewete',
  competition_type: 'Web Development',
  competition_category: 'Technology',
  max_members: 4,
  description: 'A student team building an accessible learning platform.',
  project_idea: 'Make learning resources easier to discover.',
  beginner_friendly: true,
  willing_to_mentor: true,
}
const roleRows = [
  { id: 11, role_name: 'Frontend Developer', status: 'filled', experience_preference: 'intermediate' },
  { id: 12, role_name: 'Presenter', status: 'open', experience_preference: 'open' },
]
const roleSkills = {
  11: [
    { id: 1, skill_id: 1, skill_name: 'React', required_level: 'advanced' },
    { id: 2, skill_id: 2, skill_name: 'JavaScript', required_level: 'advanced' },
  ],
  12: [{ id: 3, skill_id: 3, skill_name: 'Public Speaking', required_level: 'intermediate' }],
}
const weights = { team_composition: 25, role_coverage: 30, skill_coverage: 35, profile_readiness: 10 }
const mixedReadiness = {
  team_id: 1,
  version: 'v1',
  status: 'ready',
  readiness_score: 38,
  message: '0 of 2 roles covered; 1 of 3 required skills meet the target level.',
  components: { team_composition: 50, role_coverage: 0, skill_coverage: 50, profile_readiness: 83.33 },
  weights,
  summary: { member_count: 2, capacity: 4, role_count: 2, covered_roles: 0, required_skills: 3, covered_skills: 1, partial_skills: 1, missing_skills: 1, incomplete_profiles: 1 },
  strengths: ['React'],
  priority_gaps: [
    { type: 'role', name: 'Presenter', severity: 'missing', role_id: 12 },
    { type: 'skill', name: 'Public Speaking', severity: 'missing', skill_id: 3 },
    { type: 'skill', name: 'JavaScript', severity: 'partial', skill_id: 2 },
    { type: 'profile', name: '1 member has an incomplete profile', severity: 'incomplete' },
  ],
  roles: [
    { id: 11, name: 'Frontend Developer', status: 'filled', coverage_status: 'partial', required_skills: [
      { skill_id: 1, name: 'React', required_level: 'advanced', highest_team_level: 'advanced', status: 'covered', role_ids: [11], members: [{ id: 101, name: 'Noval', level: 'advanced', meets_requirement: true }] },
      { skill_id: 2, name: 'JavaScript', required_level: 'advanced', highest_team_level: 'intermediate', status: 'partial', role_ids: [11], members: [{ id: 102, name: 'Dian', level: 'intermediate', meets_requirement: false }] },
    ] },
    { id: 12, name: 'Presenter', status: 'open', coverage_status: 'missing', required_skills: [
      { skill_id: 3, name: 'Public Speaking', required_level: 'intermediate', highest_team_level: null, status: 'missing', role_ids: [12], members: [] },
    ] },
  ],
  skills: [
    { skill_id: 1, name: 'React', required_level: 'advanced', highest_team_level: 'advanced', status: 'covered', role_ids: [11], members: [{ id: 101, name: 'Noval', level: 'advanced', meets_requirement: true }] },
    { skill_id: 2, name: 'JavaScript', required_level: 'advanced', highest_team_level: 'intermediate', status: 'partial', role_ids: [11], members: [{ id: 102, name: 'Dian', level: 'intermediate', meets_requirement: false }] },
    { skill_id: 3, name: 'Public Speaking', required_level: 'intermediate', highest_team_level: null, status: 'missing', role_ids: [12], members: [] },
  ],
  member_profiles: [
    { id: 101, name: 'Noval', completed_fields: 6, total_fields: 6, percent: 100, missing_fields: [] },
    { id: 102, name: 'Dian', completed_fields: 4, total_fields: 6, percent: 66.67, missing_fields: ['Availability', 'Competition interests'] },
  ],
  recommended_actions: [
    'Find a teammate for the Presenter role',
    'Find a teammate with Public Speaking',
    'Strengthen JavaScript from intermediate to advanced',
    'Ask teammates to complete their own profiles and skills',
  ],
  assumptions: [
    'Team composition treats max_members as the desired capacity.',
    'A role is covered only when marked filled by its owner and all required skills are covered collectively.',
  ],
}
const fullReadiness = {
  ...structuredClone(mixedReadiness),
  readiness_score: 100,
  message: '2 of 2 roles covered; 3 of 3 required skills meet the target level.',
  components: { team_composition: 100, role_coverage: 100, skill_coverage: 100, profile_readiness: 100 },
  summary: { ...mixedReadiness.summary, member_count: 4, covered_roles: 2, covered_skills: 3, partial_skills: 0, missing_skills: 0, incomplete_profiles: 0 },
  strengths: ['React', 'JavaScript', 'Public Speaking'],
  priority_gaps: [],
  recommended_actions: [],
}
fullReadiness.roles = fullReadiness.roles.map(role => ({ ...role, status: 'filled', coverage_status: 'covered', required_skills: role.required_skills.map(skill => ({ ...skill, highest_team_level: skill.required_level, status: 'covered', members: [{ id: 101, name: 'Noval', level: skill.required_level, meets_requirement: true }] })) }))
fullReadiness.skills = fullReadiness.skills.map(skill => ({ ...skill, highest_team_level: skill.required_level, status: 'covered', members: [{ id: 101, name: 'Noval', level: skill.required_level, meets_requirement: true }] }))
fullReadiness.member_profiles = fullReadiness.member_profiles.map(member => ({ ...member, completed_fields: 6, percent: 100, missing_fields: [] }))

const setupReadiness = (message, roles = []) => ({
  team_id: 1,
  version: 'v1',
  status: 'setup_required',
  readiness_score: null,
  message,
  components: { team_composition: 50, role_coverage: null, skill_coverage: null, profile_readiness: 83.33 },
  weights,
  summary: { member_count: 2, capacity: 4, role_count: roles.length, covered_roles: 0, required_skills: 0, covered_skills: 0, partial_skills: 0, missing_skills: 0, incomplete_profiles: 1 },
  strengths: [],
  priority_gaps: [{ type: 'profile', name: '1 member has an incomplete profile', severity: 'incomplete' }],
  roles,
  skills: [],
  member_profiles: mixedReadiness.member_profiles,
  recommended_actions: roles.length ? ['Define the skills required for Frontend Developer'] : ['Add team roles and their required skills'],
  assumptions: mixedReadiness.assumptions,
})

function accessTeam() {
  return { ...baseTeam, owner_id: accessMode === 'owner' ? 101 : 999 }
}
function accessMembers() {
  const rows = accessMode === 'owner'
    ? [{ id: 101, name: 'Noval', role: 'owner' }, { id: 102, name: 'Dian', role: 'member' }]
    : [{ id: 999, name: 'Team Owner', role: 'owner' }, { id: 102, name: 'Dian', role: 'member' }]
  if (accessMode === 'member') rows.push({ id: 101, name: 'Noval', role: 'member' })
  if (readinessMode === 'full') rows.push({ id: 103, name: 'Raka', role: 'member' }, { id: 104, name: 'Sari', role: 'member' })
  return rows
}
function currentReadiness() {
  if (readinessMode === 'full') return fullReadiness
  if (readinessMode === 'no-roles') return setupReadiness('Add team roles and required skills to calculate readiness.')
  if (readinessMode === 'no-skills') return setupReadiness('Complete role requirements, proficiency levels, and team setup to calculate readiness.', [{ id: 11, name: 'Frontend Developer', status: 'filled', coverage_status: 'setup_required', required_skills: [] }])
  return mixedReadiness
}
function responseFor(path, method) {
  if (path === '/teams/1/readiness') {
    if (readinessMode === 'error') return [503, { error: 'Readiness service is temporarily unavailable' }]
    return [200, currentReadiness()]
  }
  if (path === '/profile') return [200, profile]
  if (path === '/profile/skills') return [200, [{ id: 1, name: 'React', skill_name: 'React', level: 'advanced' }]]
  if (path === '/profile/showcase') return [200, { portfolio: [], achievements: [] }]
  if (path === '/skills') return [200, [{ id: 1, name: 'React' }, { id: 2, name: 'JavaScript' }, { id: 3, name: 'Public Speaking' }]]
  if (path === '/teams' || path === '/teams/search') return [200, [accessTeam()]]
  if (path === '/teams/recommended') return [200, []]
  if (path === '/teams/1') return [200, { team: accessTeam(), members: accessMembers() }]
  if (path === '/teams/1/roles') return [200, readinessMode === 'no-roles' ? [] : roleRows]
  const skillMatch = path.match(/^\/teams\/1\/roles\/(\d+)\/skills$/)
  if (skillMatch) return [200, readinessMode === 'no-skills' ? [] : roleSkills[skillMatch[1]] || []]
  if (/^\/teams\/1\/roles\/\d+\/match$/.test(path)) return [200, { match_score: 80, matched_skills: ['React'], missing_skills: [] }]
  if (path === '/teams/1/join-requests') return [200, []]
  if (path === '/notifications/unread-count') return [200, { unread_count: 2 }]
  if (path === '/notifications' || path === '/conversations') return [200, []]
  if (method === 'OPTIONS') return [200, {}]
  return [200, {}]
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
  const apiURL = new URL(apiBase)
  const path = new URL(request.url).pathname.slice(apiURL.pathname.replace(/\/$/, '').length) || '/'
  requests.push({ path, method: request.method, authorization: request.headers.Authorization || request.headers.authorization || '' })
  const [status, body] = responseFor(path, request.method)
  await send('Fetch.fulfillRequest', {
    requestId,
    responseCode: status,
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Access-Control-Allow-Origin', value: '*' },
      { name: 'Access-Control-Allow-Headers', value: '*' },
      { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
    ],
    body: Buffer.from(JSON.stringify(body)).toString('base64'),
  })
})

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: appBase })
await until('!!document.querySelector(".landing-page")')
apiBase = await evaluate("import('/src/services/api.js').then(module => module.default)")
assert.ok(apiBase, 'VITE_API_URL is required for browser verification')
await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
const token = `e30.${Buffer.from(JSON.stringify({ user_id: 101 })).toString('base64url')}.fixture`
await evaluate(`localStorage.setItem('token', ${JSON.stringify(token)}); localStorage.setItem('currentUser', ${JSON.stringify(JSON.stringify(profile))})`)

async function navigate(route, readySelector) {
  await send('Page.navigate', { url: appBase + route })
  await until(`location.pathname === ${JSON.stringify(route.split('?')[0])}`)
  await until(readySelector)
  await pause(250)
}
async function readinessPage() {
  await navigate('/teams/1?tab=readiness', '!!document.querySelector(".team-readiness, .detail-tabs + .panel")')
}

accessMode = 'owner'
readinessMode = 'mixed'
await readinessPage()
assert.equal(await evaluate('document.querySelector(".readiness-score-display strong").textContent.replace(/\\s/g, "")'), '38%')
assert.deepEqual(await evaluate('[...document.querySelectorAll(".readiness-status")].slice(0,3).map(node => node.textContent.trim())'), ['Covered', 'Needs improvement', 'Missing'])
assert.ok(await evaluate('document.body.innerText.includes("Find a teammate for the Presenter role")'))
assert.ok(await evaluate('document.body.innerText.includes("1 member has an incomplete profile")'))
assert.ok(await evaluate('!![...document.querySelectorAll("button")].find(node => node.textContent.includes("Manage Role"))'))
assert.ok(requests.some(request => request.path === '/teams/1/readiness' && request.authorization.startsWith('Bearer ')))
checks.push({ scenario: 'owner mixed coverage', pass: true, coverage: ['covered', 'partial', 'missing', 'missing role', 'incomplete profile'] })

readinessMode = 'full'
await readinessPage()
assert.ok(await evaluate('document.body.innerText.includes("100%") && document.body.innerText.includes("All configured requirements are covered")'))
checks.push({ scenario: 'complete role and skill configuration', pass: true })

for (const setupMode of ['no-roles', 'no-skills']) {
  readinessMode = setupMode
  await readinessPage()
  const copy = await evaluate('document.querySelector(".team-readiness").innerText')
  assert.ok(copy.includes('Readiness setup incomplete'))
  assert.ok(!await evaluate('!!document.querySelector(".readiness-score-display strong")'))
  checks.push({ scenario: setupMode, pass: true, misleadingZero: false })
}

readinessMode = 'error'
await readinessPage()
assert.ok(await evaluate('document.body.innerText.includes("Readiness couldn\'t be loaded") && document.body.innerText.includes("Retry")'))
checks.push({ scenario: 'API failure', pass: true })

readinessMode = 'mixed'
accessMode = 'member'
await readinessPage()
assert.ok(await evaluate('!!document.querySelector(".team-readiness")'))
assert.ok(!await evaluate('[...document.querySelectorAll("button")].some(node => node.textContent.includes("Manage Role"))'))
checks.push({ scenario: 'current member access', pass: true })

accessMode = 'outsider'
const beforeOutsider = requests.filter(request => request.path === '/teams/1/readiness').length
await readinessPage()
assert.ok(await evaluate('document.body.innerText.includes("Readiness is available to team members.")'))
const afterOutsider = requests.filter(request => request.path === '/teams/1/readiness').length
assert.equal(afterOutsider, beforeOutsider, 'Outsider UI must not request detailed readiness')
checks.push({ scenario: 'outsider controlled state', pass: true, detailedRequestSent: false })

accessMode = 'owner'
await navigate('/dashboard', '!!document.querySelector(".command-stats") && !document.querySelector(".command-loading")')
await until('!!document.querySelector(".readiness-ring")')
assert.equal(await evaluate('document.querySelector(".readiness-ring strong").textContent'), '38%')
assert.ok(await evaluate('document.body.innerText.includes("View Readiness Details")'))
checks.push({ route: '/dashboard', readinessPreview: true })

for (const route of ['/teams/1', '/teams/1?tab=roles', '/teams/1?tab=members', '/profile', '/messages', '/notifications']) {
  await navigate(route, '!!document.querySelector(".app-content") && document.querySelector(".app-content").innerText.length > 20')
  assert.ok(!await evaluate('!!document.querySelector(".route-error")'))
  checks.push({ route, rendered: true })
}

await mkdir('artifacts/team-readiness', { recursive: true })
readinessMode = 'mixed'
accessMode = 'owner'
await readinessPage()
for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844], ['small-mobile', 320, 780]]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await evaluate('window.scrollTo(0, 0)')
  await pause(220)
  const layout = await evaluate('({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, overflowing: [...document.querySelectorAll("body *")].filter(node => { const rect = node.getBoundingClientRect(); const style = getComputedStyle(node); return rect.width > 0 && style.display !== "none" && style.position !== "fixed" && rect.right > innerWidth + 1 }).map(node => ({ tag: node.tagName, className: String(node.className), left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right, width: node.getBoundingClientRect().width })).slice(0, 20) })')
  if (layout.documentWidth > width || layout.overflowing.length) console.log('Overflow diagnostic', name, layout)
  assert.ok(layout.documentWidth <= width, `${name} has horizontal document overflow`)
  assert.deepEqual(layout.overflowing, [], `${name} has readiness elements outside the viewport`)
  checks.push({ viewport: name, ...layout })
  if (['desktop', 'tablet', 'mobile'].includes(name)) {
    const metrics = await send('Page.getLayoutMetrics')
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: metrics.cssContentSize.height, scale: 1 } })
    await writeFile(`artifacts/team-readiness/${name}.png`, Buffer.from(screenshot.data, 'base64'))
  }
}

assert.equal(runtimeErrors.length, 0, `Browser runtime errors: ${JSON.stringify(runtimeErrors)}`)
await writeFile('artifacts/team-readiness/checks.json', JSON.stringify({ checks, readinessRequests: requests.filter(request => request.path === '/teams/1/readiness').length, runtimeErrors: [] }, null, 2))
socket.close()
console.log(`Team Readiness browser verification passed (${checks.length} checks).`)
