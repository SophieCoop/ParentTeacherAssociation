/* ============================================================
   כרטיס "הצעד הבא" — איזה צעד מוצג, ומתי הכרטיס נעלם
   ------------------------------------------------------------
   הצעדים נבדקים מול הנתונים עצמם ולא מול סימון "בוצע", ולכן
   הבדיקות בונות מצב ומוודאות שהצעד הראשון שחסר הוא זה שמוצג.
   ============================================================ */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup() {
  const context = vm.createContext({
    window: {}, console, setTimeout: () => 1, clearTimeout() {}, Intl,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
  });
  for (const file of ['js/lang.js', 'js/store.js', 'js/calc.js', 'js/ui.js', 'js/nextstep.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  const { Store } = context;
  Store.state.settings.yearStart = '2026-09-01';
  Store.state.settings.yearEnd = '2027-06-30';
  return context;
}

function addKids(Store, n) {
  const ids = [];
  for (let i = 0; i < n; i++) ids.push(Store.add('children', { name: 'ילד ' + i }).id);
  return ids;
}
function addBudget(Store) {
  Store.add('budgetItems', { categoryId: 'cat-yearend', title: 'סוף שנה', audience: 'children',
                             basis: 'per_person', period: 'year', rate: 100 });
}

test('an empty gan starts at step 1 of 5: adding the children', () => {
  const { Store, NextStep } = setup();
  const s = NextStep.current(Store.state);
  assert.equal(s.id, 'children');
  assert.equal(s.n, 1);
  assert.equal(s.of, 5);
});

test('with children but no budget, the next step is the budget', () => {
  const { Store, NextStep } = setup();
  addKids(Store, 3);
  assert.equal(NextStep.current(Store.state).id, 'budget');
});

test('with a budget and no payments, the step names the amount per parent', () => {
  const { Store, NextStep } = setup();
  addKids(Store, 3);
  addBudget(Store);
  const s = NextStep.current(Store.state);
  assert.equal(s.id, 'payment');
  assert.match(s.text, /100/);
});

test('after the first payment, the step counts the families that still owe', () => {
  const { Store, NextStep } = setup();
  const ids = addKids(Store, 3);
  addBudget(Store);
  Store.add('payments', { childId: ids[0], amount: 100, date: '2026-09-10', method: 'bit' });
  const s = NextStep.current(Store.state);
  assert.equal(s.id, 'collect');
  assert.match(s.title, /^2 משפחות/);
});

test('when everything is done the card disappears', () => {
  const { Store, NextStep } = setup();
  const ids = addKids(Store, 2);
  addBudget(Store);
  ids.forEach(id => Store.add('payments', { childId: id, amount: 100, date: '2026-09-10', method: 'bit' }));
  assert.equal(NextStep.current(Store.state).id, 'expense');
  Store.add('expenses', { categoryId: 'cat-yearend', title: 'ספרים', amount: 50, date: '2026-09-20' });
  assert.equal(NextStep.current(Store.state), null);
  assert.equal(NextStep.cardHTML(Store.state), '');
});
