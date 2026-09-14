// Run against the local Vite server and an isolated Chrome CDP instance.
// API calls are intercepted so the profile states and mutations stay deterministic.
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
let ownMode = 'full'
let publicMode = 'full'
let messageMode = 'error'
let nextSkillID = 20
let nextShowcaseID = 30
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

const fixtureAvatar = (initials, color) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="${color}"/><text x="80" y="94" fill="#fff5f7" font-family="Arial" font-size="54" font-weight="700" text-anchor="middle">${initials}</text></svg>`)}`
let ownProfile = { id: 101, name: 'Noval', email: 'private@example.test', bio: 'I build accessible products and turn research into focused prototypes.', experience_level: 'Intermediate', preferred_role: 'Frontend Developer', availability: 'weekend', project_interest: 'Web Development', avatar_url: fixtureAvatar('N', '#51202c') }
let ownSkills = [
  { id: 1, name: 'React', category: 'Technical', level: 'advanced' },
  { id: 2, name: 'Public Speaking', category: 'Communication', level: 'intermediate' },
]
const catalog = [...ownSkills, { id: 3, name: 'Go', category: 'Technical' }, { id: 4, name: 'Research', category: 'Research' }]
let showcase = {
  portfolio: [{ id: 10, title: 'AccessLab', role: 'Frontend Developer', description: 'An accessible workspace for student competition teams.', project_url: 'https://example.com/accesslab', repository_url: 'https://github.com/example/accesslab', technologies: ['React', 'Accessibility'] }],
  achievements: [{ id: 11, title: 'Web Product Finalist', organization: 'National Student Challenge', achievement_type: 'competition', date: '2026-08-15', description: 'Built and presented a working prototype.', credential_url: 'https://example.com/credential' }],
}
const publicProfile = userID => ({
  id: userID,
  name: userID === 101 ? ownProfile.name : 'Aisha Rahman',
  bio: userID === 101 ? ownProfile.bio : 'Researcher who turns field insights into clear product direction.',
  experience_level: userID === 101 ? ownProfile.experience_level : 'Advanced',
  profile_photo_url: fixtureAvatar(userID === 101 ? 'N' : 'AR', userID === 101 ? '#51202c' : '#263d4f'),
  preferred_role: userID === 101 ? ownProfile.preferred_role : 'UX Researcher',
  availability: userID === 101 ? ownProfile.availability : 'flexible',
  project_interest: userID === 101 ? ownProfile.project_interest : 'Business Case',
  created_at: '2025-03-01T00:00:00Z',
  skills: userID === 101 ? ownSkills : [{ id: 8, name: 'UX Research', category: 'Research', level: 'advanced' }, { id: 9, name: 'Presentation', category: 'Communication', level: 'intermediate' }],
  teams: [{ id: 7, name: 'Insight Makers', role: userID === 101 ? 'Member' : 'Owner', competition_type: 'Business Case' }],
  portfolio: showcase.portfolio,
  achievements: showcase.achievements,
})

function response(path, method, requestBody) {
  if (method === 'OPTIONS') return [200, {}]
  if (path === '/notifications/unread-count') return [200, { unread_count: 2 }]
  if (path === '/profile') {
    if (ownMode === 'error') return [503, { error: 'Profile service temporarily unavailable' }]
    if (method === 'PUT') {
      ownProfile = { ...ownProfile, ...JSON.parse(requestBody) }
      return [200, { message: 'Profile updated successfully' }]
    }
    return [200, ownProfile]
  }
  if (path === '/profile/photo') return [200, { avatar_url: '/uploads/avatars/user-101.png?v=2' }]
  if (path === '/skills') return [200, catalog]
  if (path === '/profile/skills') {
    if (method === 'POST') {
      const body = JSON.parse(requestBody)
      const source = catalog.find(skill => skill.id === body.skill_id)
      ownSkills.push({ ...source, id: nextSkillID++, level: body.level })
      return [201, ownSkills.at(-1)]
    }
    return [200, ownSkills]
  }
  const skillMatch = path.match(/^\/profile\/skills\/(\d+)$/)
  if (skillMatch) {
    const skillID = Number(skillMatch[1])
    if (method === 'PUT') {
      ownSkills = ownSkills.map(skill => skill.id === skillID ? { ...skill, ...JSON.parse(requestBody) } : skill)
      return [200, ownSkills.find(skill => skill.id === skillID)]
    }
    if (method === 'DELETE') { ownSkills = ownSkills.filter(skill => skill.id !== skillID); return [204, {}] }
  }
  if (path === '/profile/showcase') return [200, showcase]
  const showcaseMatch = path.match(/^\/profile\/(portfolio|achievements)(?:\/(\d+))?$/)
  if (showcaseMatch) {
    const kind = showcaseMatch[1]
    const itemID = Number(showcaseMatch[2])
    if (method === 'POST') {
      const item = { id: nextShowcaseID++, ...JSON.parse(requestBody) }
      showcase = { ...showcase, [kind]: [item, ...showcase[kind]] }
      return [201, item]
    }
    if (method === 'PUT') {
      const item = { id: itemID, ...JSON.parse(requestBody) }
      showcase = { ...showcase, [kind]: showcase[kind].map(current => current.id === itemID ? item : current) }
      return [200, item]
    }
    if (method === 'DELETE') { showcase = { ...showcase, [kind]: showcase[kind].filter(item => item.id !== itemID) }; return [204, {}] }
  }
  const publicMatch = path.match(/^\/users\/(\d+)\/profile$/)
  if (publicMatch) {
    const userID = Number(publicMatch[1])
    if (userID === 999 || publicMode === 'missing') return [404, { error: 'User not found' }]
    if (userID === 500 || publicMode === 'error') return [503, { error: 'Unable to load this profile. Please try again.' }]
    return [200, publicProfile(userID)]
  }
  if (path === '/conversations' && method === 'POST') return messageMode === 'error' ? [503, { error: 'Messaging is temporarily unavailable' }] : [200, { id: 44 }]
  if (path === '/conversations') return [200, []]
  if (path === '/conversations/44') return [200, { id: 44, other_user: { id: 202, name: 'Aisha Rahman', avatar_url: '' }, last_message: '', unread_count: 0, updated_at: '2026-09-14T00:00:00Z' }]
  if (path === '/conversations/44/messages') return [200, []]
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
  if (!apiBase || !request.url.startsWith(apiBase)) { await send('Fetch.continueRequest', { requestId }); return }
  const apiPath = new URL(apiBase).pathname.replace(/\/$/, '')
  const path = new URL(request.url).pathname.slice(apiPath.length) || '/'
  requests.push({ path, method: request.method, body: request.postData || '', authorization: request.headers.Authorization || request.headers.authorization || '' })
  const [status, body] = response(path, request.method, request.postData || '')
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
await evaluate(`localStorage.setItem('token', ${JSON.stringify(token)}); localStorage.setItem('currentUser', ${JSON.stringify(JSON.stringify(ownProfile))})`)

async function navigate(route, selector) {
  await send('Page.navigate', { url: appBase + route })
  await until(`location.pathname === ${JSON.stringify(route)}`)
  await until(selector)
  await pause(240)
}

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
ownMode = 'full'
await navigate('/profile', '!!document.querySelector(".profile-hero") && !!document.querySelector(".profile-showcase")')
assert.equal(await evaluate('document.querySelector(".profile-completion-ring strong").textContent'), '100%')
assert.ok(await evaluate('document.body.innerText.includes("Frontend Developer") && document.body.innerText.includes("React") && document.body.innerText.includes("AccessLab") && document.body.innerText.includes("Web Product Finalist")'))
assert.equal(requests.some(request => request.path === '/teams'), false)
checks.push({ scenario: 'own profile loads complete credibility sections without team N+1 requests', pass: true })

await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("Edit Profile")).click()')
await until('!!document.querySelector(".profile-edit-form")')
await evaluate(`document.querySelector('.profile-edit-form input[name=preferred_role]').value='Product Engineer'; document.querySelector('.profile-edit-form').requestSubmit()`)
await until('document.querySelector(".profile-role").textContent.includes("Product Engineer")')
assert.ok(requests.some(request => request.method === 'PUT' && request.path === '/profile' && JSON.parse(request.body).preferred_role === 'Product Engineer'))
checks.push({ scenario: 'profile edit persists existing fields', pass: true })

await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("Add Skill")).click()')
await until('!!document.querySelector("select[name=skill_id]")')
await evaluate(`document.querySelector('select[name=skill_id]').value='3'; document.querySelector('select[name=level]').value='intermediate'; document.querySelector('.modal form').requestSubmit()`)
await until('document.body.innerText.includes("Go") && document.querySelectorAll(".profile-skill-row").length === 3')
assert.ok(requests.some(request => request.method === 'POST' && request.path === '/profile/skills'))
await evaluate(`document.querySelector("button[aria-label='Edit React level']").click()`)
await until('!!document.querySelector(".modal select[name=level]")')
await evaluate(`document.querySelector('.modal select[name=level]').value='beginner'; document.querySelector('.modal form').requestSubmit()`)
await until(`document.querySelector("button[aria-label='Edit React level']").closest(".profile-skill-row").innerText.includes("Beginner")`)
await evaluate(`document.querySelector("button[aria-label='Remove Go']").click()`)
await until('!!document.querySelector(".confirm-dialog")')
await evaluate('[...document.querySelectorAll(".confirm-dialog button")].find(button => button.textContent.includes("Remove Skill")).click()')
await until(`!document.querySelector("button[aria-label='Remove Go']")`)
checks.push({ scenario: 'skill add, level edit, and remove flows', pass: true })

await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("Add Project")).click()')
await until('!!document.querySelector(".showcase-form")')
const portfolioPosts = requests.filter(request => request.method === 'POST' && request.path === '/profile/portfolio').length
await evaluate(`document.querySelector('.showcase-form input[name=title]').value='Competition Hub'; document.querySelector('.showcase-form input[name=project_url]').value='ftp://example.com/file'; document.querySelector('.showcase-form').requestSubmit()`)
await until('document.querySelector(".showcase-form .error-message")?.textContent.includes("HTTP(S)")')
assert.equal(requests.filter(request => request.method === 'POST' && request.path === '/profile/portfolio').length, portfolioPosts)
await evaluate(`document.querySelector('.showcase-form input[name=project_url]').value='https://example.com/hub'; document.querySelector('.showcase-form input[name=technologies]').value='React, Go'; document.querySelector('.showcase-form').requestSubmit()`)
await until('document.body.innerText.includes("Competition Hub")')
assert.ok(requests.some(request => request.method === 'POST' && request.path === '/profile/portfolio' && JSON.parse(request.body).technologies.length === 2))
await evaluate(`document.querySelector("button[aria-label='Edit Competition Hub']").click()`)
await until('!!document.querySelector(".showcase-form")')
await evaluate(`document.querySelector('.showcase-form input[name=title]').value='Competition Workspace'; document.querySelector('.showcase-form').requestSubmit()`)
await until('document.body.innerText.includes("Competition Workspace")')
await evaluate(`document.querySelector("button[aria-label='Delete Competition Workspace']").click()`)
await until('!!document.querySelector(".confirm-dialog")')
await evaluate('[...document.querySelectorAll(".confirm-dialog button")].find(button => button.textContent === "Delete").click()')
await until('!document.body.innerText.includes("Competition Workspace")')
checks.push({ scenario: 'portfolio validation, create, edit, and delete flows', pass: true })

await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("Add Achievement")).click()')
await until('!!document.querySelector(".showcase-form")')
await evaluate(`document.querySelector('.showcase-form input[name=title]').value='Accessibility Award'; document.querySelector('.showcase-form input[name=organization]').value='Student Product Forum'; document.querySelector('.showcase-form').requestSubmit()`)
await until('document.body.innerText.includes("Accessibility Award")')
assert.ok(requests.some(request => request.method === 'POST' && request.path === '/profile/achievements'))
checks.push({ scenario: 'achievement create and timeline rendering', pass: true })

const completeProfile = { ...ownProfile }
const completeSkills = [...ownSkills]
const completeShowcase = showcase
ownProfile = { ...ownProfile, avatar_url: '', bio: '', availability: '' }
ownSkills = []
showcase = { portfolio: [], achievements: [] }
await navigate('/profile', '!!document.querySelector(".profile-completion") && !!document.querySelector(".profile-showcase")')
assert.equal(await evaluate('document.querySelector(".profile-completion-ring strong").textContent'), '43%')
assert.ok(await evaluate('document.querySelector(".profile-completion").innerText.includes("Profile photo") && document.querySelector(".profile-completion").innerText.includes("Bio") && document.body.innerText.includes("No portfolio yet") && document.body.innerText.includes("No achievements added yet")'))
checks.push({ scenario: 'incomplete own profile shows real missing fields and compact empty states', pass: true })
ownProfile = completeProfile
ownSkills = completeSkills
showcase = completeShowcase

ownMode = 'error'
await navigate('/profile', '!!document.querySelector(".profile-load-error")')
assert.ok(await evaluate('document.body.innerText.includes("Your profile could not be loaded") && document.body.innerText.includes("Try again")'))
checks.push({ scenario: 'own profile error state', pass: true })
ownMode = 'full'

publicMode = 'full'; messageMode = 'error'
await navigate('/users/202', '!!document.querySelector(".profile-hero.is-public")')
assert.ok(await evaluate('document.body.innerText.includes("Aisha Rahman") && document.body.innerText.includes("UX Research") && document.body.innerText.includes("Insight Makers") && document.body.innerText.includes("Owner · Business Case")'))
assert.equal(await evaluate('document.body.innerText.includes("private@example.test")'), false)
await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("Message")).click()')
await until('!!document.querySelector(".profile-message-error")')
assert.ok(await evaluate('document.querySelector(".profile-message-error").innerText.includes("Messaging is temporarily unavailable")'))
checks.push({ scenario: 'public profile uses safe fields and handles message failure inline', pass: true })

messageMode = 'success'
await evaluate('document.querySelector(".profile-message-error button").click()')
await until('location.pathname === "/messages/44"')
assert.ok(requests.some(request => request.method === 'POST' && request.path === '/conversations' && JSON.parse(request.body).user_id === 202))
checks.push({ scenario: 'message opens the existing direct-conversation route', pass: true })

publicMode = 'error'
await navigate('/users/202', '!!document.querySelector(".profile-load-error")')
assert.ok(await evaluate('document.body.innerText.includes("This profile could not be loaded") && document.body.innerText.includes("Try again")'))
publicMode = 'full'
await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("Try again")).click()')
await until('!!document.querySelector(".profile-hero.is-public")')
checks.push({ scenario: 'public profile API error can recover in place', pass: true })

await navigate('/users/101', '!!document.querySelector(".profile-hero.is-public")')
assert.ok(await evaluate('document.body.innerText.includes("Edit My Profile")'))
assert.equal(await evaluate('[...document.querySelectorAll("button,a")].some(node => node.textContent.trim() === "Message")'), false)
checks.push({ scenario: 'current user sees edit action and cannot message themselves', pass: true })

await navigate('/users/999', '!!document.querySelector(".profile-load-error")')
assert.ok(await evaluate('document.body.innerText.includes("Member not found")'))
checks.push({ scenario: 'missing public profile has a controlled 404 state', pass: true })

await mkdir('artifacts/profile-redesign', { recursive: true })
async function capture(name, route, selector, width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await navigate(route, selector)
  await evaluate('window.scrollTo(0, 0)')
  const layout = await evaluate('({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, overflowing: [...document.querySelectorAll("body *")].filter(node => { const rect = node.getBoundingClientRect(); const style = getComputedStyle(node); return rect.width > 0 && style.display !== "none" && style.position !== "fixed" && rect.right > innerWidth + 1 }).map(node => ({ tag: node.tagName, className: String(node.className), right: node.getBoundingClientRect().right })).slice(0, 20) })')
  assert.ok(layout.documentWidth <= width, `${name} document overflow`)
  assert.deepEqual(layout.overflowing, [], `${name} elements overflow`)
  checks.push({ viewport: name, ...layout })
  const metrics = await send('Page.getLayoutMetrics')
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: metrics.cssContentSize.height, scale: 1 } })
  await writeFile(`artifacts/profile-redesign/${name}.png`, Buffer.from(screenshot.data, 'base64'))
}

ownMode = 'full'; publicMode = 'full'
await capture('own-desktop', '/profile', '!!document.querySelector(".profile-showcase")', 1440, 1000)
await capture('public-desktop', '/users/202', '!!document.querySelector(".profile-hero.is-public")', 1440, 1000)
await capture('own-mobile', '/profile', '!!document.querySelector(".profile-showcase")', 390, 844)
await capture('public-small-mobile', '/users/202', '!!document.querySelector(".profile-hero.is-public")', 320, 780)

assert.equal(runtimeErrors.length, 0, `Browser runtime errors: ${JSON.stringify(runtimeErrors)}`)
await writeFile('artifacts/profile-redesign/checks.json', JSON.stringify({ checks, mutations: requests.filter(request => ['POST', 'PUT', 'DELETE'].includes(request.method)).map(request => ({ path: request.path, method: request.method, authorized: request.authorization.startsWith('Bearer ') })), runtimeErrors: [] }, null, 2))
socket.close()
console.log(`Profile browser verification passed (${checks.length} checks).`)
