/* ============================================================
   הגשר לאפליקציה שבחנויות (js/native.js)
   ------------------------------------------------------------
   באתר הקובץ לא נוגע בכלום. בתוך האפליקציה הוא שומר עותק של
   הנתונים מחוץ ל-WebView ומשחזר ממנו, ולכן הבדיקות כאן מתמקדות
   במה שעלול לאבד נתונים: מה נכנס לעותק, מתי הוא משוחזר, ושהוא
   לעולם אינו נדרס לפני שהשחזור הסתיים.
   ============================================================ */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

/* Storage מינימלי עם מתודות על ה-prototype, כמו בדפדפן — שם
   native.js מתלבש על setItem ו-removeItem */
class FakeStorage {
  constructor() { this._m = new Map(); }
  get length() { return this._m.size; }
  key(i) { return [...this._m.keys()][i] ?? null; }
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }
  setItem(k, v) { this._m.set(String(k), String(v)); }
  removeItem(k) { this._m.delete(String(k)); }
}

/* opts.file — תוכן קובץ העותק (או הבטחה שמחזירה אותו); בלעדיו אין קובץ */
function setup(opts = {}) {
  const calls = [];
  const listeners = {};
  const docHandlers = [];
  const timers = [];
  const classes = new Set();
  const Storage = class extends FakeStorage {};
  const localStorage = new Storage();
  for (const [k, v] of Object.entries(opts.initial || {})) localStorage.setItem(k, v);

  const plugins = {
    Filesystem: {
      writeFile(o) { calls.push(['writeFile', o]); return Promise.resolve({ uri: 'file:///cache/' + o.path }); },
      readFile(o) {
        calls.push(['readFile', o]);
        if (opts.file instanceof Promise) return opts.file;
        return opts.file ? Promise.resolve({ data: JSON.stringify(opts.file) }) : Promise.reject(new Error('File does not exist'));
      }
    },
    App: {
      addListener(name, fn) { listeners[name] = fn; return Promise.resolve({ remove() {} }); },
      getInfo() { return Promise.resolve({ version: '1.0.0', build: '3' }); },
      minimizeApp() { calls.push(['minimizeApp']); return Promise.resolve(); }
    },
    LocalNotifications: { checkPermissions() { return Promise.resolve({ display: 'granted' }); } },
    SplashScreen: { hide() { calls.push(['hide']); return Promise.resolve(); } },
    CapacitorUpdater: { notifyAppReady() { calls.push(['notifyAppReady']); return Promise.resolve(); } }
  };

  const ctx = vm.createContext({
    console, Promise, JSON, String, Object, Date,
    setTimeout(fn) { timers.push(fn); return timers.length; },
    clearTimeout() {},
    requestAnimationFrame(fn) { fn(); },
    Storage, localStorage,
    location: { href: 'capacitor://localhost/' },
    SiteConfig: { url: 'https://www.vaadhorim.com' },
    document: {
      documentElement: { classList: { add(...c) { c.forEach(x => classes.add(x)); } } },
      addEventListener(type, fn, capture) { docHandlers.push({ type, fn, capture }); },
      dispatchEvent() {}
    }
  });
  ctx.window = ctx;
  if (opts.native !== false) {
    ctx.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      isPluginAvailable: (n) => n in plugins,
      Plugins: plugins
    };
  }
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/native.js'), 'utf8'), ctx);
  // כל הטיימרים שממתינים, כולל אלה שנקבעו בזמן הריצה
  const runTimers = () => { while (timers.length) timers.shift()(); };
  const tick = () => new Promise(r => setImmediate(r));
  return { ctx, calls, listeners, docHandlers, classes, localStorage, runTimers, tick };
}

const written = (calls) => calls.filter(c => c[0] === 'writeFile' && c[1].path === 'vaad-gan-backup.json');

test('on the website nothing is touched', async () => {
  const { ctx, classes, calls } = setup({ native: false });
  assert.equal(ctx.Native.is(), false);
  assert.equal(ctx.Storage.prototype.setItem, FakeStorage.prototype.setItem);
  assert.equal(classes.size, 0);
  await ctx.Native.ready();
  assert.equal(calls.length, 0);
});

test('in the app the page is marked, and the live-update bundle is confirmed first thing', () => {
  const { ctx, classes, calls } = setup();
  assert.equal(ctx.Native.is(), true);
  assert.ok(classes.has('native') && classes.has('native-android'));
  assert.deepEqual(calls[0], ['notifyAppReady']);
});

test('every vaad-gan key except the sign-in session is copied to one file', async () => {
  const { ctx, calls, localStorage, runTimers, tick } = setup();
  await ctx.Native.ready();
  localStorage.setItem('vaad-gan-state-v1', '{"a":1}');
  localStorage.setItem('vaad-gan-session-v1', 'refresh-token');
  localStorage.setItem('someone-else', 'x');
  runTimers();
  await tick();
  const w = written(calls);
  assert.equal(w.length, 1, 'several writes in a row become one');
  assert.equal(w[0][1].directory, 'LIBRARY');
  const items = JSON.parse(w[0][1].data).items;
  assert.deepEqual(Object.keys(items), ['vaad-gan-state-v1']);
  assert.equal(localStorage.getItem('vaad-gan-session-v1'), 'refresh-token', 'the page itself still has it');
});

test('a removed key leaves the copy too', async () => {
  const { ctx, calls, localStorage, runTimers, tick } = setup({ initial: { 'vaad-gan-flags-v1': '1' } });
  await ctx.Native.ready();
  localStorage.removeItem('vaad-gan-flags-v1');
  runTimers();
  await tick();
  assert.deepEqual(JSON.parse(written(calls)[0][1].data).items, {});
});

test('a wiped WebView is refilled from the file before the app starts — without the session', async () => {
  const file = { v: 1, items: { 'vaad-gan-state-v1': '{"kids":3}', 'vaad-gan-session-v1': 'old-token' } };
  const { ctx, localStorage } = setup({ file });
  await ctx.Native.ready();
  assert.equal(localStorage.getItem('vaad-gan-state-v1'), '{"kids":3}');
  assert.equal(localStorage.getItem('vaad-gan-session-v1'), null,
    'a refresh token that was already rotated would sign the account out everywhere');
});

test('data already in the WebView is never replaced by the copy', async () => {
  const file = { v: 1, items: { 'vaad-gan-state-v1': 'old' } };
  const { ctx, calls, localStorage } = setup({ file, initial: { 'vaad-gan-state-v1': 'new' } });
  await ctx.Native.ready();
  assert.equal(localStorage.getItem('vaad-gan-state-v1'), 'new');
  assert.equal(calls.filter(c => c[0] === 'readFile').length, 0);
});

test('nothing is written to the copy until the restore has finished', async () => {
  let release;
  const file = new Promise(r => { release = r; });
  const { ctx, calls, localStorage, runTimers, tick } = setup({ file });
  localStorage.setItem('vaad-gan-flags-v1', 'fresh');
  runTimers();
  await tick();
  assert.equal(written(calls).length, 0, 'an early write would overwrite the backup with an empty app');

  release({ data: JSON.stringify({ v: 1, items: { 'vaad-gan-state-v1': 'kept' } }) });
  await ctx.Native.ready();
  runTimers();
  await tick();
  const items = JSON.parse(written(calls).at(-1)[1].data).items;
  assert.equal(items['vaad-gan-state-v1'], 'kept');
  assert.equal(items['vaad-gan-flags-v1'], 'fresh');
});

test('the Android back button closes a dialog, then goes home, then leaves the app', () => {
  const { ctx, calls, listeners } = setup();
  let open = 1, view = 'budget';
  ctx.UI = { closeTopModal() { if (!open) return false; open--; return true; } };
  ctx.Store = { state: { setupDone: true } };
  ctx.App = { view: () => view, setView(v) { view = v; } };

  listeners.backButton();
  assert.equal(open, 0);
  assert.equal(view, 'budget');
  listeners.backButton();
  assert.equal(view, 'home');
  assert.equal(calls.filter(c => c[0] === 'minimizeApp').length, 0);
  listeners.backButton();
  assert.equal(calls.filter(c => c[0] === 'minimizeApp').length, 1);
});

test('a link meant for a new tab opens from the website, in the phone\'s browser', () => {
  const { ctx, docHandlers } = setup();
  const click = docHandlers.find(h => h.type === 'click' && h.capture === true);
  let prevented = false;
  const a = { getAttribute: () => 'privacy.html' };
  click.fn({ target: { closest: () => a }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(ctx.location.href, 'https://www.vaadhorim.com/privacy.html');
});
