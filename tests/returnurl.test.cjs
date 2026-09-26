const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

/* היכן שהקישור שבמייל יחזור אליו. זהו פרמטר redirect_to בלבד — לאן
   הדפדפן מופנה אחרי שהאסימון אומת — ולכן אפשר לקבע אותו בלי לגעת
   באימות עצמו. */
function setup(href, native) {
  const url = new URL(href);
  const ctx = vm.createContext({
    console, setTimeout: () => 1, clearTimeout() {},
    fetch: () => new Promise(() => {}),
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    location: { origin: url.origin, pathname: url.pathname, protocol: url.protocol, hostname: url.hostname },
    window: {},
    document: { addEventListener() {}, documentElement: { classList: { add() {} } } }
  });
  ctx.window = ctx;
  // האפליקציה שבחנויות: Capacitor מזריק את עצמו לפני כל סקריפט של העמוד
  if (native) {
    ctx.Capacitor = { isNativePlatform: () => true, getPlatform: () => native,
      isPluginAvailable: () => false, Plugins: {} };
  }
  for (const f of ['js/config.js', 'js/native.js', 'js/cloud.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
  }
  return ctx;
}

/* returnUrl פרטי, ולכן נקרא דרך הכתובת שהוא בונה בבקשת ההרשמה */
function redirectTo(href, native) {
  const ctx = setup(href, native);
  let asked = '';
  ctx.fetch = (u) => { asked = u; return new Promise(() => {}); };
  ctx.Cloud.signUp('d@e.com', 'secret123');
  const m = decodeURIComponent(asked).match(/redirect_to=([^&]*)/);
  return m ? m[1] : '';
}

test('the production domain is used whatever host the sign-up came from', () => {
  assert.equal(redirectTo('https://www.vaadhorim.com/index.html'), 'https://www.vaadhorim.com/index.html');
  assert.equal(redirectTo('https://vaadhorim.com/index.html'), 'https://www.vaadhorim.com/index.html',
    'the apex is folded into the host that actually serves the site');
  assert.equal(redirectTo('https://vaad-git-preview-x.vercel.app/index.html'), 'https://www.vaadhorim.com/index.html',
    'a Vercel preview never reaches a real inbox');
  assert.equal(redirectTo('https://www.vaadhorim.com/'), 'https://www.vaadhorim.com/', 'the path is kept');
});

test('local development still returns to where the work is happening', () => {
  assert.equal(redirectTo('http://localhost:8099/index.html'), 'http://localhost:8099/index.html');
  assert.equal(redirectTo('http://127.0.0.1:3000/index.html'), 'http://127.0.0.1:3000/index.html');
});

test('inside the store app the link returns to the website, not to the app\'s own localhost', () => {
  /* הקישור נפתח בדפדפן של הטלפון. capacitor://localhost אינו ברשימה
     המאושרת של Supabase, ו-https://localhost היה נפתח בדפדפן כדף שגיאה */
  assert.equal(redirectTo('capacitor://localhost/index.html', 'ios'), 'https://www.vaadhorim.com/');
  assert.equal(redirectTo('https://localhost/index.html', 'android'), 'https://www.vaadhorim.com/');
});

test('a missing site setting falls back to the current origin, never to nothing', () => {
  const ctx = setup('https://somewhere.example/index.html');
  ctx.SiteConfig = null;
  let asked = '';
  ctx.fetch = (u) => { asked = u; return new Promise(() => {}); };
  ctx.Cloud.signUp('d@e.com', 'secret123');
  assert.match(decodeURIComponent(asked), /redirect_to=https:\/\/somewhere\.example\/index\.html/);
});

test('the site setting is the production domain, with no trailing slash', () => {
  const ctx = setup('https://vaadhorim.com/');
  assert.equal(ctx.SiteConfig.url, 'https://www.vaadhorim.com');
  assert.match(ctx.SiteConfig.url, /^https:\/\//, 'absolute, or Supabase treats it as a relative path');
  assert.ok(!/\/$/.test(ctx.SiteConfig.url), 'no trailing slash, or the path would double up');
});
