/* ============================================================
   סעיף תקציב לאנשי צוות מסוימים
   ------------------------------------------------------------
   staffIds בסעיף של הצוות קובע את מספר האנשים שהסכום "לאדם" מוכפל
   בו. בלי בחירה (סעיף ישן או מהעזר) — כל הצוות, כמו תמיד.
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
  for (const file of ['js/lang.js', 'js/store.js', 'js/calc.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  const { Store } = context;
  Store.setHeadcount('children', 10);
  ['גננת', 'סייעת 1', 'סייעת 2', 'מורה לחוג'].forEach((name) => Store.add('staff', { name, level: 'assistant' }));
  return context;
}

function staffItem(extra) {
  return Object.assign({ title: 'מתנה', categoryId: 'cat-yearend', audience: 'staff_edu',
    basis: 'per_person', period: 'year', rate: 100, periods: [] }, extra);
}

test('without a selection the item is for the whole staff, as before', () => {
  const { Store, Calc } = setup();
  assert.equal(Calc.itemAmount(Store.state, staffItem()), 400);
  assert.equal(Calc.itemStaffCount(Store.state, staffItem()), null);
});

test('with a selection only the chosen people are counted, free names included', () => {
  const { Store, Calc } = setup();
  const [a, b] = Store.state.staff;
  const item = staffItem({ staffIds: [a.id, b.id], staffNames: ['ממלאת מקום'] });
  assert.equal(Calc.itemStaffCount(Store.state, item), 3);
  assert.equal(Calc.itemAmount(Store.state, item), 300);
});

test('an empty selection counts no one, and a removed staff member drops out', () => {
  const { Store, Calc } = setup();
  assert.equal(Calc.itemAmount(Store.state, staffItem({ staffIds: [] })), 0);

  const [a, b] = Store.state.staff;
  const item = staffItem({ staffIds: [a.id, b.id] });
  Store.remove('staff', b.id);
  assert.equal(Calc.itemAmount(Store.state, item), 100);
});

test('a selection on a children item is ignored', () => {
  const { Store, Calc } = setup();
  const item = staffItem({ audience: 'children', staffIds: [] });
  assert.equal(Calc.itemAmount(Store.state, item), 1000);
});
