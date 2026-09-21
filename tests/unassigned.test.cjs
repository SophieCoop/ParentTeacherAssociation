/* כסף שנכנס לקופה בלי שם הורה — כך נראה ייבוא מפייבוקס לוועד שהוזן
   בו רק מספר הילדים. הוא חייב להיספר בגבייה, אחרת מסך הבית מראה
   קופה מלאה ומסך הגבייה מראה אפס. */
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
  return context;
}

/* ועד של 8 ילדים ללא שמות, תקציב 10,000, ו-9,145.32 ₪ שיובאו ללא שיוך */
function imported() {
  const { Store, Calc } = setup();
  Store.reset();
  Store.setHeadcount('children', 8);
  Store.add('budgetItems', { name: 'פעילויות', categoryId: Store.state.categories[0].id, mode: 'total', amount: 10000 });
  [1444, 1444, 1444, 1444, 1444, 481.33, 481.33, 481.33, 481.33].forEach((a, i) =>
    Store.add('payments', { childId: '', payer: 'הורה ' + (i + 1), amount: a, method: 'paybox', date: '2025-09-21', installments: 1, note: '' }));
  return { Store, Calc };
}

test('the collection screen counts money that has no parent on it', () => {
  const { Store, Calc } = imported();
  const s = Calc.collectionSummary(Store.state);
  assert.equal(s.paid, 9145.32, 'this is the number the user is looking for');
  assert.equal(s.assigned, 0, 'and none of it is on a child yet');
  assert.equal(s.unassigned, 9145.32);
  assert.equal(s.due, 10000);
  assert.equal(s.remaining, 854.68);
  assert.equal(s.pct, 91);
});

test('the collection total and the money in the pot are the same number', () => {
  const { Store, Calc } = imported();
  assert.equal(Calc.collectionSummary(Store.state).paid, Calc.collectedTotal(Store.state),
    'two screens, one truth');
});

test('assigning a payment moves it from unassigned to a child, total unchanged', () => {
  const { Store, Calc } = imported();
  const kid = Store.state.children[0];
  Store.update('payments', Store.state.payments[0].id, { childId: kid.id });
  const s = Calc.collectionSummary(Store.state);
  assert.equal(s.paid, 9145.32, 'the total does not move');
  assert.equal(s.assigned, 1444);
  assert.equal(s.unassigned, 7701.32);
  assert.equal(s.fullCount, 1, 'and that child now shows as paid');
});

test('per-child rows stay honest: unassigned money is nobody\'s payment', () => {
  const { Store, Calc } = imported();
  const s = Calc.collectionSummary(Store.state);
  assert.ok(s.rows.every(r => r.paid === 0), 'no child is credited with money that is not theirs');
  assert.equal(s.noneCount, 8);
});

test('a payment left on a deleted child is not lost from the total', () => {
  const { Store, Calc } = imported();
  const kid = Store.state.children[0];
  Store.update('payments', Store.state.payments[0].id, { childId: kid.id });
  Store.state.children = Store.state.children.filter(c => c.id !== kid.id);
  const s = Calc.collectionSummary(Store.state);
  assert.equal(s.paid, 9145.32, 'the money is still in the collection');
  assert.equal(s.unassigned, 9145.32, 'and it falls back to being unassigned');
});

test('with nothing unassigned the extra numbers are simply zero', () => {
  const { Store, Calc } = setup();
  Store.reset();
  Store.setHeadcount('children', 2);
  Store.add('payments', { childId: Store.state.children[0].id, amount: 500, method: 'bit', date: '2025-09-21', installments: 1 });
  const s = Calc.collectionSummary(Store.state);
  assert.equal(s.unassigned, 0);
  assert.equal(s.paid, 500);
  assert.equal(s.assigned, 500);
});
