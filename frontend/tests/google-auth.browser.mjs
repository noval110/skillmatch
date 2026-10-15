// Run manually: node tests/google-auth.browser.mjs
// Uses installed Chrome, a local Vite server, and simulated Google/API responses.
// No real Google account or application database is used.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const artifacts = path.resolve(frontend, '../artifacts/google-auth')
mkdirSync(artifacts, { recursive: true })
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
assert.ok(existsSync(chrome), 'Set CHROME_PATH to your installed Chrome executable')
const children = []
let socket
let sequence = 0
const pending = new Map()

function start(command, args, options = {}) {
  const child = spawn(command, args, { cwd: frontend, windowsHide: true, stdio: 'ignore', ...options })
  children.push(child)
  return child
}

async function waitHTTP(url) {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch { /* Startup is asynchronous. */ }
    await delay(100)
  }
  throw new Error(`Server did not start: ${url}`)
}

function send(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 10000)
    pending.set(id, { resolve, reject, timeout })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result?.value
}

async function waitFor(expression) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evaluate(expression)) return
    await delay(75)
  }
  throw new Error(`Browser condition failed: ${expression}`)
}

async function visit(url) {
  await send('Page.navigate', { url })
  await waitFor(`location.href === ${JSON.stringify(url)} && document.querySelector('.google-auth') !== null`)
}

async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  writeFileSync(path.join(artifacts, `${name}.png`), Buffer.from(result.data, 'base64'))
}

const mock = `(() => {
  window.__googleRequests = [];
  const installGoogle = () => {
    window.google = { accounts: { id: {
      initialize(config) { window.__googleConfig = config; },
      renderButton(element, options) {
        window.__googleOptions = options;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = options.text === 'signup_with' ? 'Daftar dengan Google' : 'Masuk dengan Google';
        button.style.cssText = 'width:100%;height:40px;border:1px solid #dadce0;border-radius:'+(options.shape === 'pill' ? '20px' : '4px')+';background:white;color:#333';
        button.onclick = () => window.__googleConfig.callback({ credential: 'verified-test-token' });
        element.appendChild(button);
      }
    } } };
  };
  window.__installGoogle = installGoogle;
  if (!location.search.includes('sdk=fail')) installGoogle();
  const append = Element.prototype.appendChild;
  Element.prototype.appendChild = function(node) {
    if (node.tagName === 'SCRIPT' && node.src.includes('accounts.google.com/gsi/')) {
      queueMicrotask(() => node.onerror(new Event('error')));
      return node;
    }
    return append.call(this, node);
  };
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (url, options) => {
    const pathname = new URL(url, location.href).pathname;
    if (!pathname.startsWith('/api/')) return originalFetch(url, options);
    if (pathname === '/api/auth/google') {
      window.__googleRequests.push(JSON.parse(options.body));
      await new Promise(resolve => setTimeout(resolve, 80));
      if (window.__rejectGoogle) return new Response(JSON.stringify({ error: 'Verifikasi Google gagal. Silakan coba lagi.' }), {status:401});
      const payload = btoa(JSON.stringify({user_id:7,email:'test@gmail.com',exp:Math.floor(Date.now()/1000)+3600}));
      return new Response(JSON.stringify({token:'test.'+payload+'.session',user:{id:7,name:'Google Tester',email:'test@gmail.com'}}), {status:200});
    }
    if (pathname === '/api/profile') return new Response(JSON.stringify({id:7,name:'Google Tester',email:'test@gmail.com',experience_level:'advanced'}), {status:200});
    return new Response('[]', {status:200});
  };
})();`

try {
  for (const [port, id] of [[5197, 'test-client.apps.googleusercontent.com'], [5198, '']]) {
    start(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      env: { ...process.env, VITE_GOOGLE_CLIENT_ID: id, VITE_API_URL: `http://127.0.0.1:${port}/api` },
    })
    await waitHTTP(`http://127.0.0.1:${port}/login`)
  }
  start(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9397', `--user-data-dir=${path.join(artifacts, 'chrome-profile')}`, '--window-size=1280,900', 'about:blank'])
  const response = await waitHTTP('http://127.0.0.1:9397/json/list')
  const targets = await response.json()
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    clearTimeout(entry.timeout)
    if (message.error) entry.reject(new Error(JSON.stringify(message.error)))
    else entry.resolve(message.result)
  }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: mock })

  for (const route of ['login', 'register']) {
    await visit(`http://127.0.0.1:5197/${route}`)
    await waitFor(`document.querySelector('.google-auth-button button') !== null`)
    assert.equal(await evaluate('window.__googleOptions.text'), route === 'login' ? 'signin_with' : 'signup_with')
    assert.ok(await evaluate('window.__googleOptions.width > 200'), 'Google button must receive the available width while loading')
    await screenshot(`${route}-desktop`)
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true)
    await screenshot(`${route}-mobile`)
    if (route === 'register') {
      await evaluate(`(() => { const select = document.querySelector('#experience-level'); select.value = 'advanced'; select.dispatchEvent(new Event('change', {bubbles:true})); })()`)
    }
    // Duplicate callbacks must issue a single API request.
    await evaluate(`window.__googleConfig.callback({credential:'verified-test-token'}); window.__googleConfig.callback({credential:'verified-test-token'}); true`)
    await waitFor(`location.pathname === '/dashboard' && localStorage.getItem('token') !== null`)
    const requests = await evaluate('window.__googleRequests')
    assert.equal(requests.length, 1)
    assert.equal(requests[0].experience_level, route === 'register' ? 'advanced' : 'beginner')
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('currentUser')).email`), 'test@gmail.com')
    await evaluate('localStorage.clear()')
    await send('Emulation.clearDeviceMetricsOverride')
  }

  await visit('http://127.0.0.1:5197/login')
  await waitFor(`document.querySelector('.google-auth-button button') !== null`)
  await evaluate(`window.__rejectGoogle = true; document.querySelector('.google-auth-button button').click()`)
  await waitFor(`document.querySelector('.error-message')?.textContent.includes('Verifikasi Google gagal') && !document.querySelector('.primary-button').disabled`)
  assert.equal(await evaluate('localStorage.getItem("token")'), null)
  await evaluate(`window.__rejectGoogle = false; document.querySelector('.google-auth-button button').click()`)
  await waitFor(`location.pathname === '/dashboard'`)
  await evaluate('localStorage.clear()')

  await visit('http://127.0.0.1:5197/login?sdk=fail')
  await waitFor(`document.querySelector('.google-auth-fallback')?.textContent.includes('Coba muat')`)
  assert.equal(await evaluate('document.querySelector(".primary-button").disabled'), false)
  await evaluate(`window.__installGoogle(); document.querySelector('.google-auth-fallback').click()`)
  await waitFor(`document.querySelector('.google-auth-button button') !== null`)

  for (const route of ['login', 'register']) {
    await visit(`http://127.0.0.1:5198/${route}`)
    assert.equal(await evaluate('document.querySelector(".google-auth-fallback").disabled'), true)
    assert.equal(await evaluate('document.querySelector(".primary-button").disabled'), false)
    await screenshot(`${route}-unconfigured`)
    await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 740, deviceScaleFactor: 1, mobile: true })
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true)
    await screenshot(`${route}-unconfigured-mobile`)
    await send('Emulation.clearDeviceMetricsOverride')
  }
  console.log('PASS: Google login/register, selected experience, session storage, duplicate callbacks, API failure/retry, SDK failure/retry, mobile layout, and missing configuration.')
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try { await send('Browser.close') } catch { /* Chrome may close before replying. */ }
    socket.close()
  }
  for (const child of children.reverse()) child.kill()
}
