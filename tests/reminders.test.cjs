/* ============================================================
   תזכורות — מי נכנס לחלון, ובאיזה שלב
   ------------------------------------------------------------
   המפתח של כל תזכורת קובע אם התראה תצא שוב, ולכן הבדיקות מוודאות
   גם שהוא משתנה בין שלב לשלב ובין שנה לשנה.
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
  const { Store } = context;
  Store.state.settings.yearEnd = '2027-06-30';
  return context;
}

const today = new Date(2026, 9, 1); // 1 באוקטובר 2026

test('an event 7 days away is in the week stage; 8 days away is not yet due', () => {
  const { Store, Reminders } = setup();
  Store.add('events', { title: 'מסיבת סוכות', date: '2026-10-08' });
  Store.add('events', { title: 'רחוק', date: '2026-10-09' });
  const list = Reminders.due(Store.state, today);
  assert.equal(list.length, 1);
  assert.equal(list[0].title, 'מסיבת סוכות');
  assert.equal(list[0].days, 7);
  assert.equal(list[0].stage, 'week');
});

test('two days before, the stage and the key change, so a second notification goes out', () => {
  const { Store, Reminders } = setup();
  Store.add('events', { title: 'טיול', date: '2026-10-08' });
  const week = Reminders.due(Store.state, today)[0];
  const soon = Reminders.due(Store.state, new Date(2026, 9, 6))[0];
  assert.equal(soon.stage, 'soon');
  assert.equal(soon.days, 2);
  assert.notEqual(week.key, soon.key);
});

test('the event day itself is still reminded; the day after it is not', () => {
  const { Store, Reminders } = setup();
  Store.add('events', { title: 'חנוכה', date: '2026-10-01' });
  assert.equal(Reminders.due(Store.state, today)[0].days, 0);
  assert.equal(Reminders.due(Store.state, new Date(2026, 9, 2)).length, 0);
});

test('birthdays recur every year, with a different key each year', () => {
  const { Store, Reminders } = setup();
  Store.add('children', { name: 'נועה', birthDate: '2021-10-04' });
  const a = Reminders.due(Store.state, today)[0];
  const b = Reminders.due(Store.state, new Date(2027, 9, 1))[0];
  assert.equal(a.days, 3);
  assert.equal(a.stage, 'week');
  assert.notEqual(a.key, b.key);
});

test('reminders are sorted nearest first, and the wording is natural', () => {
  const { Store, Reminders } = setup();
  Store.add('events', { title: 'ב', date: '2026-10-06' });
  Store.add('events', { title: 'א', date: '2026-10-02' });
  const list = Reminders.due(Store.state, today);
  assert.equal(list.map(it => it.title).join(','), 'א,ב');
  assert.equal(Reminders.when(0), 'היום');
  assert.equal(Reminders.when(1), 'מחר');
  assert.equal(Reminders.when(5), 'בעוד 5 ימים');
});
