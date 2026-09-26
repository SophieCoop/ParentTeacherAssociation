/* ============================================================
   קישור "הוספה ליומן Google" — תאריכים של יום שלם, וחזרה שנתית
   ============================================================ */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup() {
  const context = vm.createContext({ window: {}, console, URLSearchParams });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/views/dates.js'), 'utf8'), context);
  return context.Views.dates;
}

function params(url) {
  assert.ok(url.startsWith('https://calendar.google.com/calendar/render?'));
  return new URLSearchParams(url.split('?')[1]);
}

test('an event becomes an all-day entry that ends on the following day', () => {
  const dates = setup();
  const q = params(dates.gcalUrl({ title: 'מסיבת סוכות', type: 'event', kind: 'אירוע הגן',
                                    next: new Date(2026, 9, 8) }));
  assert.equal(q.get('action'), 'TEMPLATE');
  assert.equal(q.get('text'), 'מסיבת סוכות');
  assert.equal(q.get('dates'), '20261008/20261009');
  assert.equal(q.get('recur'), null);
});

test('the last day of a month rolls over correctly', () => {
  const dates = setup();
  const q = params(dates.gcalUrl({ title: 'סוף שנה', type: 'year', next: new Date(2027, 5, 30) }));
  assert.equal(q.get('dates'), '20270630/20270701');
});

test('a birthday repeats every year', () => {
  const dates = setup();
  const q = params(dates.gcalUrl({ title: 'יום הולדת — נועה', type: 'birthday',
                                    next: new Date(2026, 9, 4) }));
  assert.equal(q.get('recur'), 'RRULE:FREQ=YEARLY');
});
