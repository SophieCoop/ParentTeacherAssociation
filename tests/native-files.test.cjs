/* ============================================================
   מה נארז באפליקציה שבחנויות (native/web-files.json)
   ------------------------------------------------------------
   האפליקציה אורזת רק חלק מהקבצים שבשורש המאגר. קובץ חדש ש-index.html
   טוען אבל לא נכנס לרשימה היה עובד באתר ונשבר רק בטלפון — ולכן
   הבדיקה עוברת על כל מה שהעמוד טוען. ומהצד השני: דפים פנימיים
   (stats.html) וקבצים שאין להם מקום באפליקציה לא ייכנסו אליה בטעות.
   ============================================================ */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const entries = JSON.parse(fs.readFileSync(path.join(ROOT, 'native', 'web-files.json'), 'utf8'));

function shipped() {
  const out = new Set();
  const walk = (rel) => {
    const full = path.join(ROOT, rel);
    if (fs.statSync(full).isDirectory()) {
      for (const name of fs.readdirSync(full)) {
        if (!name.startsWith('.')) walk(rel.replace(/\/$/, '') + '/' + name);
      }
    } else {
      out.add(rel);
    }
  };
  entries.forEach(walk);
  return out;
}

/* כל src ו-href מקומיים: בלי כתובות חיצוניות, עוגנים, ובלי הנתיב
   המוחלט של Vercel שנטען רק באתר (ראו index.html) */
function localRefs(html) {
  const refs = [];
  for (const m of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const ref = m[1].split(/[?#]/)[0];
    if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(ref)) continue;
    refs.push(ref);
  }
  return refs;
}

test('everything index.html loads is inside the app', () => {
  const files = shipped();
  const refs = localRefs(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
  assert.ok(refs.length > 20, 'the page loads its scripts from js/');
  for (const ref of refs) assert.ok(files.has(ref), ref + ' is loaded by the page but not shipped');
});

test('the icons the manifest names are inside the app', () => {
  const files = shipped();
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  for (const icon of manifest.icons) assert.ok(files.has(icon.src), icon.src);
});

test('internal pages and site-only files stay out of the app', () => {
  const files = [...shipped()];
  const banned = [
    'stats.html',          // מסך פנימי לבעלת האתר
    'privacy.html',        // נפתח מהאתר, כדי שיהיה תמיד בגרסה שמתפרסמת לחנויות
    'sw.js',               // באפליקציה התזכורות מתוזמנות בטלפון עצמו
    'vercel.json', 'README.md', 'CLAUDE.md'
  ];
  for (const f of banned) assert.ok(!files.includes(f), f + ' must not be shipped');
  for (const dir of ['tests/', 'native/', 'email-templates/', 'undefined/', 'node_modules/']) {
    assert.ok(!files.some(f => f.startsWith(dir)), dir + ' must not be shipped');
  }
});
