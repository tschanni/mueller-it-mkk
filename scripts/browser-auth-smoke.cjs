/* Local build at the real frontend origin, using an isolated headless browser.
 * Default: offline mocked flows. --live additionally permits ONLY anonymous
 * GET get-session / me/profile and OPTIONS to the production API. All other
 * API requests remain intercepted. No profile or account is created remotely.
 * Requires Node 22 and an installed Chromium browser; no extra dependencies.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const frontend = 'https://www.mueller-it-mkk.de';
const api = 'https://api.mueller-it-mkk.de';
const auth = '/games/api/v1/auth/';
const profilePath = '/games/api/v1/me/profile';
const live = process.argv.includes('--live');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const results = { liveRequested: live, checks: [], live: [], productionWrites: 0 };
const artifacts = path.join(root, 'docs', 'browser-artifacts');
const check = (name, value = true) => { assert(value, name); results.checks.push(name); };

async function main() {
  const candidates = [process.env.BROWSER_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
  let executable;
  for (const candidate of candidates) { try { await fs.access(candidate); executable = candidate; break; } catch {} }
  if (!executable) throw Error('No Chromium found. Set BROWSER_PATH.');
  const build = path.join(root, 'build');
  await fs.access(path.join(build, 'index.html'));
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'mkk-browser-'));
  const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-sync', '--remote-debugging-port=0', `--user-data-dir=${temporary}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    let port;
    for (let i = 0; i < 100; i++) {
      try { port = Number((await fs.readFile(path.join(temporary, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await sleep(100); }
    }
    if (!port) throw Error('Headless browser did not start.');
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = () => reject(Error('CDP connection failed')); });
    const pending = new Map(); let serial = 0;
    const events = new Map();
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const item = pending.get(message.id); if (!item) return;
        pending.delete(message.id); clearTimeout(item.timer);
        message.error ? item.reject(Error(message.error.message)) : item.resolve(message.result);
      } else for (const listener of events.get(message.method) || []) listener(message.params);
    };
    function command(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++serial;
        const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)); }, 20000);
        pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
      });
    }
    async function evaluate(expression) {
      const value = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (value.exceptionDetails) throw Error('Browser evaluation failed: ' + (value.exceptionDetails.text || 'exception'));
      return value.result.value;
    }
    async function until(expression, label) {
      for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await sleep(100); }
      results.failure = { label, text: await evaluate('document.body.innerText') };
      throw Error('Browser wait failed: ' + label);
    }
    const text = value => `document.body.innerText.includes(${JSON.stringify(value)})`;
    const click = label => evaluate(`(() => { const buttons = [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled && !b.closest('.hidden')); const b = buttons.find(b => b.getAttribute('role') === 'menuitem') || buttons.find(b => b.closest('form')) || buttons.find(b => b.closest('[role=dialog]')) || buttons[0]; if (!b) throw Error('Button unavailable'); b.click(); })()`);
    const fill = (id, value) => evaluate(`(() => { const e = document.getElementById(${JSON.stringify(id)}); if (!e || e.disabled) throw Error('Input unavailable'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    const user = { id: 'browser-fixture-user', name: 'SameName', email: 'browser@example.invalid', emailVerified: true, role: 'USER' };
    let mode = live ? 'live' : 'mock', signedIn = false, fault = null, contact = null;
    const liveRequests = new Map();
    events.set('Network.requestWillBeSent', [event => {
      if (mode === 'live' && event.request.url.startsWith(api + '/')) liveRequests.set(event.requestId, { path: new URL(event.request.url).pathname, method: event.request.method });
    }]);
    events.set('Network.loadingFailed', [event => {
      const request = liveRequests.get(event.requestId);
      if (request) (results.liveNetworkFailures ||= []).push({ ...request, error: event.errorText, canceled: !!event.canceled, cors: event.corsErrorStatus || null });
    }]);
    let registrationBody, savedBody, discordRequested = false;
    const handlerErrors = [];
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2' };
    const fulfill = (requestId, status, value) => command('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: frontend }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' }, { name: 'Cache-Control', value: 'no-store' }], body: status === 204 ? '' : Buffer.from(JSON.stringify(value)).toString('base64') });
    events.set('Fetch.requestPaused', [event => { void (async () => {
      const { requestId, request } = event; const url = new URL(request.url);
      if (url.origin === frontend) {
        const relative = decodeURIComponent(url.pathname);
        let file = path.resolve(build, '.' + relative);
        if (!file.startsWith(build + path.sep) && file !== build) throw Error('Invalid local asset path');
        if (!path.extname(file)) file = path.join(file, 'index.html');
        let bytes;
        try { bytes = await fs.readFile(file); } catch { bytes = await fs.readFile(path.join(build, 'index.html')); file = 'index.html'; }
        return command('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: mime[path.extname(file)] || 'application/octet-stream' }], body: bytes.toString('base64') });
      }
      if (url.origin === api) {
        const p = url.pathname;
        if (mode === 'mock') (results.mockRequests ||= []).push({ path: p, method: request.method });
        // The only production allowlist: no POST/PUT/DELETE and no mail/token URLs.
        if (mode === 'live' && ((request.method === 'GET' && [auth + 'get-session', profilePath].includes(p)) || (request.method === 'OPTIONS' && [profilePath, auth + 'sign-up/email', auth + 'sign-in/email', auth + 'sign-in/social', auth + 'sign-out', auth + 'send-verification-email'].includes(p)))) {
          return command('Fetch.continueRequest', { requestId });
        }
        if (mode === 'live') return command('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
        if (request.method === 'OPTIONS') return fulfill(requestId, 204, null);
        if (p === auth + 'get-session') {
          if (fault === 'network') return command('Fetch.failRequest', { requestId, errorReason: 'InternetDisconnected' });
          if (fault === '503') return fulfill(requestId, 503, { statusCode: 503, message: 'Internal server error' });
          if (fault === '401') return fulfill(requestId, 401, { statusCode: 401 });
          return fulfill(requestId, 200, signedIn ? { user, session: { userId: user.id, expiresAt: new Date(Date.now() + 3600000).toISOString() } } : null);
        }
        if (p === auth + 'sign-up/email') { registrationBody = JSON.parse(request.postData); return fulfill(requestId, 200, { token: null, user }); }
        if (p === auth + 'sign-in/email') { signedIn = true; return fulfill(requestId, 200, { redirect: false, user }); }
        if (p === auth + 'sign-out') { signedIn = false; return fulfill(requestId, 200, { success: true }); }
        if (p === auth + 'sign-in/social') { discordRequested = true; return fulfill(requestId, 200, { redirect: true, url: 'https://discord.com/oauth2/authorize?state=browser-fixture' }); }
        if (p === auth + 'list-accounts') return fulfill(requestId, 200, []);
        if (p === profilePath) {
          if (request.method === 'GET') return fulfill(requestId, 200, { profile: contact });
          savedBody = JSON.parse(request.postData); contact = { ...savedBody, userId: user.id, updatedAt: new Date().toISOString() };
          return fulfill(requestId, 201, contact);
        }
        return fulfill(requestId, 404, {});
      }
      if (url.origin === 'https://discord.com' && discordRequested) return command('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/html' }], body: Buffer.from('<!doctype html><title>OAuth navigation intercepted locally</title>').toString('base64') });
      // Never reach external OAuth or other third-party services during the smoke test.
      if (url.origin === 'https://discord.com' && event.resourceType === 'Document') results.oauthNavigationBlocked = true;
      return command('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
    })().catch(error => { handlerErrors.push(error.message); }); }]);
    await command('Page.enable'); await command('Runtime.enable'); await command('Network.enable');
    await command('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await command('Emulation.setDeviceMetricsOverride', { width: 1100, height: 850, deviceScaleFactor: 1, mobile: false });
    await command('Page.navigate', { url: frontend + '/' });
    await until(text('Start'), 'local desktop');
    results.browser = await evaluate('navigator.userAgent');
    if (live) {
      const read = await evaluate(`(async () => { const out = []; for (const path of ${JSON.stringify([auth + 'get-session', profilePath])}) { try { const r = await fetch(${JSON.stringify(api)} + path, { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(5000) }); const body = await r.json().catch(() => undefined); out.push({ path, status: r.status, cacheControl: r.headers.get('cache-control'), anonymous: body === null }); } catch { out.push({ path, transportError: true }); } } return out; })()`);
      results.live.push(...read);
      // Explicit safe OPTIONS verifies actual production JSON preflight routing.
      const preflights = await evaluate(`(async () => { const out = []; for (const path of ${JSON.stringify([profilePath, auth + 'sign-up/email', auth + 'sign-in/email', auth + 'sign-in/social', auth + 'sign-out', auth + 'send-verification-email'])}) { try { const r = await fetch(${JSON.stringify(api)} + path, { method: 'OPTIONS', credentials: 'include', signal: AbortSignal.timeout(2000), headers: { 'Content-Type': 'application/json' } }); out.push({ path, method: 'OPTIONS', status: r.status }); } catch { out.push({ path, method: 'OPTIONS', transportError: true }); } } return out; })()`);
      results.live.push(...preflights);
      results.liveChecks = { anonymousSession: read[0].status === 200 && read[0].anonymous, anonymousProfile: read[1].status === 401 };
      results.livePreflightPassed = preflights.every(item => item.status >= 200 && item.status < 300);
      if (results.livePreflightPassed) check('live profile/auth OPTIONS usable in browser');
      mode = 'mock';
      await command('Page.navigate', { url: frontend + '/' }); await until(text('Start'), 'mock desktop');
    }
    await click('Start'); await click('Registrieren');
    await fill('register-name', 'SameName'); await fill('register-email', 'browser@example.invalid');
    await fill('register-password', 'browser-fixture-password'); await fill('register-confirm', 'browser-fixture-password'); await click('Registrieren');
    await until(text('Bitte prüfen Sie Ihren Posteingang'), 'registration verification notice');
    check('browser registration sends only confirmed fields', Object.keys(registrationBody).sort().join(',') === 'callbackURL,email,name,password');
    check('browser registration preserves name', registrationBody.name === 'SameName');
    await command('Page.navigate', { url: frontend + '/auth/verified' });
    await until(text('Ihre E-Mail-Adresse wurde bestätigt'), 'verification callback'); await click('OK');
    await fill('login-email', user.email); await fill('login-password', 'browser-fixture-password'); await click('Anmelden');
    await until(text('Sie sind angemeldet.'), 'login success'); await click('OK');
    await click('Start'); await click('Mein Konto'); await until('document.getElementById("contact-firstName")?.disabled === false', 'contact loaded');
    check('user.name and stable ID displayed', await evaluate(text('SameName') + ' && ' + text(user.id)));
    check('no name or image editor', await evaluate('!document.getElementById("account-username") && !document.getElementById("account-image")'));
    await fill('contact-postalCode', '01234'); await fill('contact-city', 'Hanau'); await click('Kontaktdaten speichern');
    await until(text('Ihre Kontaktdaten wurden gespeichert.'), 'save success');
    check('profile save preserves ZIP and clears empty fields', savedBody.postalCode === '01234' && savedBody.firstName === null && !('userId' in savedBody));
    await command('Page.reload'); await until(text('Start'), 'reload');
    await click('Start'); await click('Mein Konto'); await until('document.getElementById("contact-postalCode")?.value === "01234"', 'profile restored');
    check('reload restores session and contacts');
    for (const failure of ['503', 'network']) {
      fault = failure;
      await evaluate('window.dispatchEvent(new Event("focus"))');
      await until(text(failure === '503' ? 'Serverfehler' : 'nicht erreichbar'), 'refresh fault');
      check(failure + ' does not log user out', await evaluate('!!document.getElementById("contact-firstName")'));
      await click('OK'); fault = null;
      await evaluate('window.dispatchEvent(new Event("focus"))'); await sleep(150);
    }
    await fs.mkdir(artifacts, { recursive: true });
    const screenshot = await command('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(path.join(artifacts, 'account-desktop.png'), Buffer.from(screenshot.data, 'base64'));
    await command('Emulation.setDeviceMetricsOverride', { width: 320, height: 740, deviceScaleFactor: 1, mobile: false });
    check('320px account window stays entirely inside the viewport', await evaluate('(() => { const r = document.querySelector(".auth-window").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight - 34; })()'));
    const mobile = await command('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(path.join(artifacts, 'account-mobile.png'), Buffer.from(mobile.data, 'base64'));
    await command('Emulation.setDeviceMetricsOverride', { width: 1100, height: 850, deviceScaleFactor: 1, mobile: false });
    fault = '401'; await evaluate('window.dispatchEvent(new Event("focus"))');
    await until(text('HTTP 401'), 'invalid session notice');
    check('401 removes contact fields', await evaluate('!document.getElementById("contact-firstName")'));
    await click('OK'); fault = null; signedIn = false;
    await fill('login-email', user.email); await fill('login-password', 'browser-fixture-password'); await click('Anmelden');
    await until(text('Sie sind angemeldet.'), 'relogin'); await click('OK');
    await click('Start'); await click('Abmelden'); await until(text('Sie wurden erfolgreich abgemeldet.'), 'logout'); await click('OK');
    check('logout removes identity and contacts', await evaluate('!document.getElementById("contact-firstName")'));
    await command('Page.navigate', { url: frontend + '/auth/error?error=email_not_verified' });
    await until(text('Starten Sie danach die Discord-Anmeldung erneut'), 'Discord verification recovery'); await click('OK');
    await click('Mit Discord anmelden');
    for (let i = 0; i < 100 && !results.oauthNavigationBlocked; i++) await sleep(100);
    check('Discord requests provider URL and attempts top-level navigation without contacting provider', discordRequested && results.oauthNavigationBlocked);
    check('no interception errors', handlerErrors.length === 0);
    results.productionWrites = 0; // All write requests were fulfilled locally or blocked.
    await fs.writeFile(path.join(artifacts, live ? 'results-live.json' : 'results-offline.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify(results, null, 2));
    if (live && (!results.liveChecks.anonymousSession || !results.liveChecks.anonymousProfile || !results.livePreflightPassed)) process.exitCode = 1;
  } finally {
    await fs.mkdir(artifacts, { recursive: true });
    await fs.writeFile(path.join(artifacts, live ? 'results-live.json' : 'results-offline.json'), JSON.stringify(results, null, 2) + '\n');
    if (socket) socket.close(); browser.kill();
    await sleep(300);
    // Only the fresh directory returned by mkdtemp is removed, never a user profile.
    if (path.dirname(path.resolve(temporary)) !== path.resolve(os.tmpdir()) || !path.basename(temporary).startsWith('mkk-browser-')) throw Error('Invalid temporary browser directory');
    await fs.rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
