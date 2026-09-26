/* ============================================================
   תזכורות מתוזמנות מראש — באפליקציה שבחנויות
   ------------------------------------------------------------
   הטלפון מציג את ההתראה בזמן שנקבע לה, גם כשהאפליקציה סגורה.
   לכן כל שלב (שבוע, יומיים) מתוזמן לתשע בבוקר של היום שבו הוא
   מתחיל — ורק אם היום הזה עוד לפנינו. שלב שכבר התחיל מוצג בפס
   שבמסך הבית, ולא יוצאת עליו התראה נוספת.
   ============================================================ */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup() {
  const context = vm.createContext({
    window: {}, console, setTimeout: () => 1, clearTimeout() {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
  });
  for (const file of ['js/lang.js', 'js/store.js', 'js/calc.js', 'js/reminders.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  /* סוף השנה הוא תאריך שתמיד ברשימה; כאן הוא כבר מאחורינו, כדי שכל
     בדיקה תראה רק את התאריכים שהיא עצמה הוסיפה */
  context.Store.state.settings.yearEnd = '2026-06-30';
  return context;
}

const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
// Array.from: מערך שנוצר בתוך ה-vm הוא מתחום אחר, ו-deepStrictEqual משווה גם את זה
const times = (list) => Array.from(list, n => n.at.getTime());

test('an event ten days away gets both stages, each at nine in the morning', () => {
  const { Store, Reminders } = setup();
  Store.add('events', { title: 'מסיבת סוכות', date: '2026-10-11' });
  const list = Reminders.plan(Store.state, at(2026, 10, 1, 8));
  assert.deepEqual(times(list), [at(2026, 10, 4, 9).getTime(), at(2026, 10, 9, 9).getTime()]);
  assert.equal(list[0].title, '🔔 מסיבת סוכות');
  assert.match(list[0].body, /^בעוד 7 ימים/);
  assert.match(list[1].body, /^בעוד 2 ימים/);
});

test('once the week stage has begun only the two-day one is still ahead', () => {
  const { Store, Reminders } = setup();
  Store.add('events', { title: 'טיול', date: '2026-10-06' });
  const list = Reminders.plan(Store.state, at(2026, 10, 1, 12));
  assert.deepEqual(times(list), [at(2026, 10, 4, 9).getTime()]);
});

test('an event tomorrow has nothing left to schedule — the home banner covers it', () => {
  const { Store, Reminders } = setup();
  Store.add('events', { title: 'מחר', date: '2026-10-02' });
  assert.equal(Reminders.plan(Store.state, at(2026, 10, 1, 8)).length, 0);
});

test('on the first day of a stage it is scheduled only while nine has not passed', () => {
  const { Store, Reminders } = setup();
  Store.add('events', { title: 'אסיפה', date: '2026-10-08' });
  assert.deepEqual(times(Reminders.plan(Store.state, at(2026, 10, 1, 8, 59))),
    [at(2026, 10, 1, 9).getTime(), at(2026, 10, 6, 9).getTime()]);
  assert.deepEqual(times(Reminders.plan(Store.state, at(2026, 10, 1, 9, 1))),
    [at(2026, 10, 6, 9).getTime()]);
});

test('a birthday that has already passed this year is scheduled for next year', () => {
  const { Store, Reminders } = setup();
  Store.add('children', { name: 'נועה', birthDate: '2021-09-20' });
  const list = Reminders.plan(Store.state, at(2026, 10, 1, 8));
  assert.equal(list.length, 2);
  assert.deepEqual(times(list), [at(2027, 9, 13, 9).getTime(), at(2027, 9, 18, 9).getTime()]);
});

test('more than three at the same moment become one summary; three stay separate', () => {
  const four = setup();
  for (const t of ['א', 'ב', 'ג', 'ד']) four.Store.add('events', { title: t, date: '2026-10-20' });
  const merged = four.Reminders.plan(four.Store.state, at(2026, 10, 1, 8));
  assert.equal(merged.length, 2, 'one summary per stage');
  assert.equal(merged[0].title, '🔔 4 תאריכים קרובים');
  assert.equal(merged[0].body.split('\n').length, 4);

  const three = setup();
  for (const t of ['א', 'ב', 'ג']) three.Store.add('events', { title: t, date: '2026-10-20' });
  assert.equal(three.Reminders.plan(three.Store.state, at(2026, 10, 1, 8)).length, 6);
});

test('the list is sorted, capped below the iPhone limit, and numbered from one', () => {
  const { Store, Reminders } = setup();
  for (let d = 0; d < 45; d++) {
    const date = new Date(2026, 9, 12 + d);
    const iso = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
    Store.add('events', { title: 'אירוע ' + d, date: iso });
  }
  const list = Reminders.plan(Store.state, at(2026, 10, 1, 8));
  assert.equal(list.length, 60);
  assert.deepEqual(Array.from(list, n => n.id), Array.from({ length: 60 }, (_, i) => i + 1));
  const t = times(list);
  assert.deepEqual(t, [...t].sort((a, b) => a - b));
});
