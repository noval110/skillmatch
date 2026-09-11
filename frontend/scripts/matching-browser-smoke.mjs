// Browser UI smoke test with API fixtures; real PostgreSQL behavior is covered by Go integration tests.
// Start Vite on 127.0.0.1:5173 and headless Chrome with --remote-debugging-port=9222 first.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const pages = await fetch('http://127.0.0.1:9222/json').then(r => r.json())
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl)
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }))
let id = 0
const pending = new Map()
const errors = []
ws.addEventListener('message', event => {
  const data = JSON.parse(event.data)
  if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text)
  if (data.id) {
    const task = pending.get(data.id)
    pending.delete(data.id)
    if (data.error) task.reject(Error(data.error.message))
    else task.resolve(data.result)
  }
})
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const requestId = ++id
    pending.set(requestId, { resolve, reject })
    ws.send(JSON.stringify({ id: requestId, method, params }))
  })
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
async function until(expression) {
  for (let count = 0; count < 80; count++) {
    if (await evaluate(`Boolean(${expression})`)) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw Error('Timed out: ' + expression)
}
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
const clickText = text => evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`)
async function fill(name, value) {
  await evaluate(`(() => {
    const el = document.querySelector('[name="${name}"]');
    const prototype = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  })()`)
}
function fixtures() {
  localStorage.setItem('token', 'test.' + btoa(JSON.stringify({ user_id: 1, exp: 9999999999 })) + '.test')
  localStorage.setItem('currentUser', JSON.stringify({ id: 1, name: 'Noval' }))
  const profile = { id: 1, name: 'Noval', email: 'noval@example.test', bio: 'Learning together', experience_level: 'Beginner', preferred_role: null, availability: null, project_interest: null }
  const team = { id: 1, name: 'HackSquad', description: 'Build a web app and learn together.', project_idea: 'Web Development', max_members: 5, owner_id: 1, beginner_friendly: true, willing_to_mentor: true }
  const legacy = { id: 2, name: 'Legacy Team', description: null, project_idea: null, max_members: 4, owner_id: 2 }
  const role = { id: 1, team_id: 1, role_name: 'Frontend Developer', status: 'open', experience_preference: 'beginner' }
  const skills = [{ id: 1, name: 'React' }, { id: 2, name: 'JavaScript' }, { id: 3, name: 'TypeScript' }]
  const requirements = skills.map(s => ({ skill_id: s.id, skill_name: s.name, required_level: 'beginner' }))
  const match = { role_id: 1, role_name: role.role_name, match_score: 88, skill_score: 18, role_interest_score: 25, availability_score: 20, project_interest_score: 15, experience_fit_score: 10, beginner_friendly: true, willing_to_mentor: true, experience_preference: 'beginner', matched_skills: ['React', 'JavaScript'], missing_skills: ['TypeScript'], skills_to_improve: ['React'], profile_incomplete: true }
  window.__requests = []
  const original = window.fetch.bind(window)
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href)
    if (!url.pathname.startsWith('/api/')) return original(input, options)
    const path = url.pathname.slice(4)
    const method = options.method || 'GET'
    const body = options.body ? JSON.parse(options.body) : null
    window.__requests.push({ path, search: url.search, method, body })
    let data
    if (path === '/profile') { if (body) Object.assign(profile, body); data = profile }
    else if (path === '/profile/skills') data = skills.slice(0, 2).map(s => ({ ...s, level: 'beginner' }))
    else if (path === '/skills') data = skills
    else if (path === '/teams/search') data = url.searchParams.get('beginner_friendly') === 'true' ? [team] : [team, legacy]
    else if (path === '/teams') data = method === 'POST' ? { team_id: 1 } : [team, legacy]
    else if (/\/match$/.test(path)) data = match
    else if (/\/skills$/.test(path)) data = requirements
    else if (/\/roles\/\d+$/.test(path)) { if (body) Object.assign(role, body); data = role }
    else if (/\/roles$/.test(path)) data = method === 'POST' ? { role_id: 1 } : [role]
    else if (/\/teams\/\d+$/.test(path)) {
      if (body) Object.assign(team, body)
      data = { team: path.endsWith('/2') ? legacy : team, members: [{ id: 1, name: 'Noval', role: 'Owner' }] }
    } else data = []
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
}
await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${fixtures.toString()})()` })
await fs.mkdir('artifacts/matching', { recursive: true })
async function screenshot(name) {
  const { data } = await cdp('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(`artifacts/matching/${name}.png`, Buffer.from(data, 'base64'))
}
async function navigate(path, ready) {
  await cdp('Page.navigate', { url: 'http://127.0.0.1:5173' + path })
  await until(ready)
}
async function noOverflow() {
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'horizontal page overflow')
  assert.equal(await evaluate("[...document.querySelectorAll('.modal')].every(el => el.scrollWidth <= el.clientWidth)"), true, 'horizontal modal overflow')
}
try {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await navigate('/teams', "document.querySelectorAll('.team-card').length === 2")
  assert.equal(await evaluate("document.querySelectorAll('.team-card .badge-beginner').length"), 1)
  assert.equal(await evaluate("document.querySelectorAll('.team-card .badge-mentor').length"), 1)
  await click('[name="beginner_friendly"]')
  await until("document.querySelectorAll('.team-card').length === 1 && window.__requests.some(r => r.search.includes('beginner_friendly=true'))")
  await screenshot('teams-desktop')
  await noOverflow()

  await navigate('/profile', "document.querySelector('.profile-about')")
  await clickText('Complete Profile')
  await until("document.querySelector('[name=preferred_role]')")
  assert.equal(await evaluate("document.querySelector('[name=experience_level]').value"), 'beginner')
  await fill('preferred_role', 'Frontend Developer')
  await fill('availability', 'weekend')
  await fill('project_interest', 'Web Development')
  await clickText('Save Changes')
  await until("!document.querySelector('.modal') && document.querySelector('.profile-preferences')?.textContent.includes('Frontend Developer')")
  assert.equal(await evaluate("window.__requests.find(r => r.path === '/profile' && r.method === 'PUT').body.availability"), 'weekend')

  await navigate('/teams/create', "document.querySelector('.create-team-form')")
  await fill('name', 'Learning Team')
  await fill('project_idea', 'Web Development')
  await click('[name="beginner_friendly"]')
  await click('[name="willing_to_mentor"]')
  await screenshot('create-desktop')
  await clickText('Buat Team')
  await until("window.__requests.some(r => r.path === '/teams' && r.method === 'POST')")
  const created = await evaluate("window.__requests.find(r => r.path === '/teams' && r.method === 'POST').body")
  assert.equal(created.beginner_friendly, true)
  assert.equal(created.willing_to_mentor, true)

  await navigate('/teams/1', "document.querySelector('.role-card-main')")
  await clickText('Add Role')
  await fill('role_name', 'Frontend Developer')
  await fill('experience_preference', 'beginner')
  await click('.modal .button-primary')
  await until("window.__requests.some(r => r.path === '/teams/1/roles' && r.method === 'POST') && !document.querySelector('.modal')")
  assert.equal(await evaluate("window.__requests.find(r => r.path === '/teams/1/roles' && r.method === 'POST').body.experience_preference"), 'beginner')
  await click('.role-card-main')
  await until("document.querySelectorAll('[role=progressbar]').length === 5")
  assert.equal(await evaluate("document.querySelector('.overall-match strong').textContent"), '88%')
  assert.equal(await evaluate("document.querySelector('.match-breakdown').textContent.includes('Skills to Improve')"), true)
  assert.equal(await evaluate("document.querySelector('.match-breakdown .badge-beginner') !== null"), true)
  await screenshot('match-desktop')
  await noOverflow()
  await fill('experience_preference', 'intermediate')
  await clickText('Save Preference')
  await until("!document.querySelector('.modal') && window.__requests.some(r => r.method === 'PUT' && r.body?.experience_preference === 'intermediate')")
  await clickText('Edit')
  await until("document.querySelector('.modal [name=beginner_friendly]')")
  assert.equal(await evaluate("document.querySelector('.modal [name=beginner_friendly]').checked"), true)
  await click('.modal [name="beginner_friendly"]')
  await clickText('Save Team')
  await until("!document.querySelector('.modal') && window.__requests.some(r => r.path === '/teams/1' && r.method === 'PUT')")
  assert.equal(await evaluate("window.__requests.find(r => r.path === '/teams/1' && r.method === 'PUT').body.beginner_friendly"), false)

  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await navigate('/teams/1', "document.querySelector('.role-card-main')")
  await click('.role-card-main')
  await until("document.querySelector('.match-breakdown')")
  await screenshot('match-mobile')
  await noOverflow()
  await navigate('/teams', "document.querySelectorAll('.team-card').length === 2")
  await screenshot('teams-mobile')
  await noOverflow()
  await navigate('/profile', "document.querySelector('.profile-about')")
  await clickText('Complete Profile')
  await screenshot('profile-mobile')
  await noOverflow()
  await navigate('/teams/create', "document.querySelector('.create-team-form')")
  await screenshot('create-mobile')
  await noOverflow()
  assert.deepEqual(errors, [], 'browser runtime exceptions')
  console.log('PASS: badges, beginner filter request, optional profile save, create/edit team, create/edit role, five score bars, desktop/mobile layout, zero browser exceptions.')
} finally {
  ws.close()
}
