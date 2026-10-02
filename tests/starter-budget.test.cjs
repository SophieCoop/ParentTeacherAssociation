/* ============================================================
   התקציב ההתחלתי של אשף ההקמה
   ------------------------------------------------------------
   הסעיפים הם לאדם, ולכן הבדיקות מוודאות שהסכום הכולל נגזר ממספר
   הילדים והצוות, ושהצעת החלוקה מזהה את הסעיפים כשלה.
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
  for (const file of ['js/lang.js', 'js/store.js', 'js/calc.js', 'js/budgetplan.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  const { Store } = context;
  Store.state.settings.yearStart = '2026-09-01';
  Store.state.settings.yearEnd = '2027-06-30';
  return context;
}

test('the starter budget has the six agreed items', () => {
  const { Store, BudgetPlan } = setup();
  const titles = BudgetPlan.starter(Store.state.settings).map(b => b.title).join(' | ');
  assert.equal(titles, 'מתנה לפורים | מתנה לפסח | מתנה לשבועות | מתנות סוף שנה לילדים | ' +
                       'מתנה לפסח לצוות | מתנות סוף שנה לצוות החינוכי');
});

test('amounts are per person, so the total follows the headcount', () => {
  const { Store, Calc, BudgetPlan } = setup();
  for (let i = 0; i < 30; i++) Store.add('children', { name: 'ילד ' + i });
  for (let i = 0; i < 3; i++) Store.add('staff', { name: 'צוות ' + i, level: 'teacher' });
  BudgetPlan.starter(Store.state.settings).forEach(b => Store.add('budgetItems', b));
  // ילדים: (20+20+20+50) × 30 = 3,300 · צוות: (100+250) × 3 = 1,050
  assert.equal(Calc.budgetTotal(Store.state), 4350);
});

test('holiday items land on their date inside the school year; year-end on the last day', () => {
  const { Store, BudgetPlan } = setup();
  const items = BudgetPlan.starter(Store.state.settings);
  items.forEach(b => {
    assert.ok(b.date >= '2026-09-01' && b.date <= '2027-06-30', b.title + ' ' + b.date);
  });
  assert.equal(items[3].date, '2027-06-30');
});

test('the budget helper recognises every starter item as its own', () => {
  const { Store, BudgetPlan } = setup();
  BudgetPlan.starter(Store.state.settings).forEach(b => {
    const k = BudgetPlan.keyOf(b);
    assert.ok(k && BudgetPlan.choice(k.choice), b.title);
  });
});
