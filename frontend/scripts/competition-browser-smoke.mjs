// Browser UI smoke test with API fixtures; real PostgreSQL behavior is covered by Go integration tests.
// Start Vite on 127.0.0.1:5173 and headless Chrome with --remote-debugging-port=9222 first.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const pages = await fetch(process.env.CDP_URL || 'http://127.0.0.1:9222/json').then(r => r.json())
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
  const profile = { id: 1, name: 'Noval', email: 'noval@example.test', experience_level: 'beginner', preferred_role: 'Second Speaker', availability: 'flexible', project_interest: 'Debate' }
  const specs = [
    ['Academic', 'Debate', 'ArgueMasters', 'Second Speaker', ['Public Speaking', 'Argumentation', 'Rebuttal', 'Critical Thinking']],
    ['Business', 'Business Case', 'CaseMinds', 'Business Analyst', ['Business Analysis', 'Market Research', 'Strategy', 'Presentation']],
    ['Research', 'Scientific Writing', 'Research Circle', 'Academic Writer', ['Academic Writing', 'Research', 'Literature Review']],
    ['Creative', 'Video Competition', 'Story Studio', 'Video Editor', ['Video Editing', 'Storytelling']],
    ['Technology', 'Hackathon', 'HackSquad', 'Frontend Developer', ['React', 'JavaScript', 'Go', 'Figma']],
  ]
  const teams = specs.map(([competition_category, competition_type, name], i) => ({ id: i + 1, name, competition_category, competition_type, project_idea: 'Prepare together', description: 'A team for every skill.', max_members: 4, owner_id: 1, beginner_friendly: true, willing_to_mentor: true }))
  teams.push({ id: 6, name: 'Legacy Team', max_members: 4, owner_id: 2, competition_category: null, competition_type: null })
  const categories = { 'Public Speaking': 'Communication', Argumentation: 'Communication', Rebuttal: 'Communication', Presentation: 'Communication', 'Critical Thinking': 'Research', 'Business Analysis': 'Business', 'Market Research': 'Business', Strategy: 'Business', 'Academic Writing': 'Research', Research: 'Research', 'Literature Review': 'Research', 'Video Editing': 'Creative', Storytelling: 'Creative', React: 'Technical', JavaScript: 'Technical', Go: 'Technical', Figma: 'Design' }
  const skills = Object.entries(categories).map(([name, category], i) => ({ id: i + 1, name, category }))
  let owned = skills.filter(skill => ['React', 'Presentation', 'Research'].includes(skill.name)).map(skill => ({ ...skill, level: 'intermediate' }))
  const roles = specs.map((spec, i) => ({ id: i + 1, team_id: i + 1, role_name: spec[3], status: 'open', experience_preference: 'open' }))
  const requirements = {}
  window.__requests = []
  const original = window.fetch.bind(window)
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href)
    if (!url.pathname.startsWith('/api/')) return original(input, options)
    const path = url.pathname.slice(4), method = options.method || 'GET'
    const body = options.body ? JSON.parse(options.body) : null
    window.__requests.push({ path, search: url.search, method, body })
    const teamID = Number(path.split('/')[2]), roleID = Number(path.split('/')[4])
    let data = []
    if (path === '/login') data = { token: localStorage.getItem('token'), user: profile }
    else if (path === '/register') data = { message: 'Created' }
    else if (path === '/profile') { if (body) Object.assign(profile, body); data = profile }
    else if (path.startsWith('/profile/skills')) {
      if (method === 'POST') owned.push({ ...skills.find(skill => skill.id === body.skill_id), level: body.level })
      if (method === 'PUT') owned.find(skill => skill.id === Number(path.split('/')[3])).level = body.level
      if (method === 'DELETE') owned = owned.filter(skill => skill.id !== Number(path.split('/')[3]))
      data = owned
    } else if (path === '/skills') data = skills
    else if (path === '/teams/search') data = teams.filter(team => (!url.searchParams.get('competition_category') || team.competition_category === url.searchParams.get('competition_category')) && (!url.searchParams.get('competition_type') || team.competition_type === url.searchParams.get('competition_type')) && (!url.searchParams.get('beginner_friendly') || team.beginner_friendly))
    else if (path === '/teams/recommended') data = teams.slice(0, 3).map(team => ({ team, match_score: 86, recommended_role: 'Teammate', matched_skills: [], member_count: 1, reason: 'Open role', match: { match_score: 86 } }))
    else if (path === '/teams') {
      if (method === 'POST') { const team = { ...body, id: teams.length + 1, owner_id: 1 }; teams.push(team); data = { team_id: team.id } }
      else data = teams
    } else if (/\/match$/.test(path)) data = { role_id: roleID, role_name: roles.find(role => role.id === roleID)?.role_name, match_score: 100, skill_score: 30, role_interest_score: 25, availability_score: 20, project_interest_score: 15, experience_fit_score: 10, matched_skills: [], missing_skills: [], skills_to_improve: [], beginner_friendly: true, willing_to_mentor: true }
    else if (/\/skills$/.test(path)) {
      if (method === 'POST') { const skill = skills.find(skill => skill.id === body.skill_id); (requirements[roleID] ||= []).push({ skill_id: skill.id, skill_name: skill.name, required_level: body.required_level }) }
      data = requirements[roleID] || []
    } else if (/\/roles$/.test(path)) {
      if (method === 'POST') { const role = { id: roles.length + 1, team_id: teamID, ...body, status: 'open' }; roles.push(role); data = { role_id: role.id } }
      else data = roles.filter(role => role.team_id === teamID)
    } else if (/^\/teams\/\d+$/.test(path)) {
      const team = teams.find(team => team.id === teamID)
      if (body) Object.assign(team, body)
      data = { team, members: [{ id: team.owner_id, name: 'Owner', role: 'Owner' }] }
    }
    return new Response(JSON.stringify(data), { status: method === 'POST' ? 201 : 200, headers: { 'Content-Type': 'application/json' } })
  }
}
await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${fixtures.toString()})()` })
await fs.mkdir('../.gocache/competitions', { recursive: true })
async function screenshot(name) {
  const { data } = await cdp('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(`../.gocache/competitions/${name}.png`, Buffer.from(data, 'base64'))
}
async function navigate(path, ready) {
  await cdp('Page.navigate', { url: (process.env.FRONTEND_URL || 'http://127.0.0.1:5173') + path })
  await until(ready)
}
async function noOverflow() {
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'page overflow')
  assert.equal(await evaluate("[...document.querySelectorAll('.modal')].every(el => el.scrollWidth <= el.clientWidth)"), true, 'modal overflow')
}
try {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await navigate('/', "document.querySelector('.landing-hero')")
  assert.match(await evaluate("document.querySelector('h1').textContent"), /next competition/)
  assert.equal(await evaluate("document.querySelectorAll('.competition-categories a').length"), 9)
  await screenshot('landing-desktop'); await noOverflow()
  await navigate('/login', "document.querySelector('#login-email')")
  await evaluate(`document.querySelector('#login-email').value = 'noval@example.test'`)
  // Authentication API behavior is tested with real PostgreSQL in the Go suite.
  assert.equal(await evaluate("document.querySelector('#login-password').required"), true)
  await navigate('/register', "document.querySelector('#register-name')")
  assert.equal(await evaluate("document.querySelector('#experience-level').options.length"), 3)
  await navigate('/dashboard', "document.querySelectorAll('.recommendation-card').length === 3")
  assert.equal(await evaluate("new Set([...document.querySelectorAll('.recommendation-card .competition-category')].map(el => el.textContent)).size"), 3)
  await screenshot('dashboard-desktop'); await noOverflow()
  await navigate('/profile', "document.querySelector('.profile-skill-groups')")
  assert.equal(await evaluate("document.querySelectorAll('.profile-skill-groups h3').length"), 3)
  await clickText('Tambah Skill')
  await until("document.querySelector('.skill-picker')")
  await evaluate(`(() => { const el = document.querySelector('.skill-picker select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, 'Communication'); el.dispatchEvent(new Event('change', { bubbles: true })); })()`)
  assert.deepEqual(await evaluate("[...document.querySelector('[name=skill_id]').options].slice(1).map(el => el.textContent)"), ['Public Speaking', 'Argumentation', 'Rebuttal'])
  await fill('skill_id', '1'); await fill('level', 'advanced'); await clickText('Save Skill')
  await until("!document.querySelector('.modal') && document.querySelector('.profile-skill-groups')?.textContent.includes('Public Speaking')")
  await click('[aria-label="Edit Public Speaking"]'); await fill('level', 'beginner'); await clickText('Save Skill')
  await until("!document.querySelector('.modal') && document.querySelector('.profile-skill-groups')")
  await screenshot('profile-desktop'); await noOverflow()
  await click('[aria-label="Hapus Public Speaking"]'); await clickText('Hapus Skill')
  await until("!document.querySelector('.modal') && !document.querySelector('[aria-label=\"Edit Public Speaking\"]')")

  const scenarios = [
    ['Academic', 'Debate', 'Second Speaker', 'Public Speaking'],
    ['Business', 'Business Case', 'Business Analyst', 'Business Analysis'],
    ['Research', 'Scientific Writing', 'Academic Writer', 'Academic Writing'],
    ['Creative', 'Video Competition', 'Video Editor', 'Video Editing'],
    ['Technology', 'Hackathon', 'Frontend Developer', 'React'],
  ]
  for (const [index, [category, type, role, skill]] of scenarios.entries()) {
    await navigate('/teams/create', "document.querySelector('.create-team-form')")
    await fill('name', type + ' Team'); await fill('project_idea', 'Prepare together')
    await fill('competition_category', category)
    assert.equal(await evaluate(`!!document.querySelector('datalist option[value=${JSON.stringify(type)}]')`), true)
    await fill('competition_type', type); await clickText('Buat Team')
    await until("window.__requests.some(r => r.path === '/teams' && r.method === 'POST') && document.querySelector('.team-hero')")
    assert.equal(await evaluate("window.__requests.find(r => r.path === '/teams' && r.method === 'POST').body.competition_type"), type)
    await navigate('/teams/' + (index + 1), "document.querySelector('.role-card-main')")
    assert.match(await evaluate("document.querySelector('.competition-meta').textContent"), new RegExp(type))
    await clickText('Add Role')
    assert.equal(await evaluate(`[...document.querySelectorAll('#suggested-roles option')].some(el => el.value === ${JSON.stringify(role)})`), true)
    await fill('role_name', 'My custom role'); await click('.modal .button-primary')
    await until("!document.querySelector('.modal') && document.querySelectorAll('.role-card-main').length === 2")
    await click('.role-card-main'); await until("document.querySelector('.skill-suggestions')")
    const before = await evaluate("window.__requests.filter(r => /roles.*skills/.test(r.path) && r.method === 'POST').length")
    await clickText(skill)
    assert.equal(await evaluate("window.__requests.filter(r => /roles.*skills/.test(r.path) && r.method === 'POST').length"), before, 'suggestion must not auto-save')
    await fill('required_level', 'intermediate'); await clickText('Add')
    await until("!document.querySelector('.modal') && document.querySelector('.role-card-main')")
    await click('.role-card-main'); await until("document.querySelector('.skill-detail-list')")
    assert.match(await evaluate("document.querySelector('.skill-detail-list').textContent"), new RegExp(skill))
    assert.equal(await evaluate("document.querySelectorAll('[role=progressbar]').length"), 5)
    await screenshot(`role-${index + 1}`); await noOverflow()
  }
  await navigate('/teams/1', "document.querySelector('.team-hero')")
  await clickText('Edit'); await fill('competition_category', 'Other'); await fill('competition_type', 'Custom Championship'); await clickText('Save Team')
  await until("!document.querySelector('.modal') && document.querySelector('.competition-meta')?.textContent.includes('Custom Championship')")
  await navigate('/teams?competition_category=Academic', "document.querySelectorAll('.team-card').length === 1")
  await fill('competition_type', 'Debate'); await click('[name=beginner_friendly]')
  await until("window.__requests.some(r => r.search.includes('competition_type=Debate') && r.search.includes('beginner_friendly=true'))")
  await clickText('Filter'); await fill('role', 'Second Speaker'); await fill('skill', 'Public Speaking')
  await until("window.__requests.some(r => r.search.includes('skill=Public+Speaking') && r.search.includes('role=Second+Speaker'))")
  await screenshot('filters-desktop'); await noOverflow()
  await navigate('/teams', "document.querySelectorAll('.team-card').length === 6")
  assert.match(await evaluate("document.querySelectorAll('.team-card')[5].textContent"), /General Competition/)
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  for (const [path, ready, name] of [
    ['/', "document.querySelector('.landing-hero')", 'landing'],
    ['/dashboard', "document.querySelector('.recommendation-card')", 'dashboard'],
    ['/teams', "document.querySelectorAll('.team-card').length === 6", 'teams'],
    ['/teams/create', "document.querySelector('.create-team-form')", 'create'],
    ['/profile', "document.querySelector('.profile-skill-groups')", 'profile'],
  ]) { await navigate(path, ready); await screenshot(name + '-mobile'); await noOverflow() }
  await clickText('Tambah Skill'); await screenshot('add-skill-mobile'); await noOverflow()
  await navigate('/teams/2', "document.querySelector('.role-card-main')"); await click('.role-card-main'); await until("document.querySelector('.skill-picker')"); await screenshot('business-role-mobile'); await noOverflow()
  assert.deepEqual(errors, [], 'browser runtime exceptions')
  console.log('PASS: competition categories, five domain flows, custom types/roles, explicit skill suggestions, grouped profile skill CRUD, combined filters, legacy fallback, diverse recommendations, desktop/mobile layouts, auth screens, and zero browser exceptions.')
} finally { ws.close() }
