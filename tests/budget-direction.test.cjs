/* ============================================================
   שני כיווני העבודה: תכנון קודם מול גבייה קודם
   ------------------------------------------------------------
   settings.collectPerChild הוא ההכרעה בין השניים, ולכן הבדיקות
   כאן מוודאות שני דברים: שהכיוון הישן לא השתנה כלל כשהשדה ריק,
   ושברגע שהוא מלא הוא הופך למקור האמת של הגבייה.
   ============================================================ */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

/* הכיוון השני יושב מאחורי דגל תכונה, ולכן הבדיקות מדליקות אותו
   במפורש — חוץ מזו שבודקת מה קורה כשהוא כבוי */
function setup(flagOn) {
  const context = vm.createContext({
    window: {}, console, setTimeout: () => 1, clearTimeout() {},
    Features: { budgetDirections: flagOn !== false },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
  });
  for (const file of ['js/lang.js', 'js/store.js', 'js/calc.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  const { Store } = context;
  Store.state.settings.yearStart = '2026-09-01';
  Store.state.settings.yearEnd = '2027-06-30';
  return context;
}

/* סעיף תקציב בסכום כולל, בלי תאריך — מתחלק בין כל הילדים */
function addItem(Store, title, amount) {
  return Store.add('budgetItems', {
    title, rate: amount, basis: 'total', period: 'year',
    audience: 'children', categoryId: 'cat-other', periods: []
  });
}

test('plan first: the collection is derived from the budget, exactly as before', () => {
  const { Store, Calc } = setup();
  Store.setHeadcount('children', 10);
  addItem(Store, 'מתנות', 3000);

  assert.equal(Calc.collectFirst(Store.state), false);
  assert.equal(Calc.budgetTotal(Store.state), 3000);
  assert.equal(Calc.fullChildShare(Store.state), 300);
  assert.equal(Calc.collectionSummary(Store.state).due, 3000);

  const frame = Calc.budgetFrame(Store.state);
  assert.equal(frame.mode, 'plan');
  assert.equal(frame.planned, 3000);
  assert.equal(frame.perChildPlanned, 300);
  assert.equal(frame.kids, 10);
  assert.equal(frame.items, 1);
});

test('collect first: the set amount becomes the charge, and the budget is measured against it', () => {
  const { Store, Calc } = setup();
  Store.setHeadcount('children', 30);
  addItem(Store, 'מתנות', 12000);
  Store.state.settings.collectPerChild = 500;

  assert.equal(Calc.collectFirst(Store.state), true);
  assert.equal(Calc.fullChildShare(Store.state), 500, 'the charge no longer follows the budget');
  assert.equal(Calc.collectionSummary(Store.state).due, 15000);
  assert.equal(Calc.budgetTotal(Store.state), 12000, 'the plan itself is untouched');

  const frame = Calc.budgetFrame(Store.state);
  assert.equal(frame.mode, 'collect');
  assert.equal(frame.available, 15000);
  assert.equal(frame.planned, 12000);
  assert.equal(frame.remaining, 3000);
  assert.equal(frame.pct, 80);
});

test('collect first: a child who joined mid-year is charged proportionally', () => {
  const { Store, Calc } = setup();
  Store.setHeadcount('children', 2);
  Store.state.settings.collectPerChild = 1000;

  const late = Store.state.children[1];
  Store.update('children', late.id, { joinDate: '2027-02-01' });   // כחמישה חודשים מתוך עשרה

  const full = Calc.childCollection(Store.state, Store.state.children[0]);
  const part = Calc.childCollection(Store.state, late);
  assert.equal(full.due, 1000);
  assert.ok(part.due > 0 && part.due < 1000, 'charged for part of the year, not all of it');
  assert.equal(part.due, Math.round(1000 * part.percent / 100));

  // והתקציב הזמין משקף את החיוב בפועל, לא מכפלה פשוטה
  assert.equal(Calc.budgetFrame(Store.state).available, full.due + part.due);
});

test('collect first: a manual percentage still wins over the set amount', () => {
  const { Store, Calc } = setup();
  Store.setHeadcount('children', 2);
  Store.state.settings.collectPerChild = 1000;
  const kid = Store.state.children[0];
  Store.update('children', kid.id, { sharePercentOverride: 50 });

  const r = Calc.childCollection(Store.state, kid);
  assert.equal(r.percent, 50);
  assert.equal(r.due, 500);
});

test('clearing the amount returns to plan first', () => {
  const { Store, Calc } = setup();
  Store.setHeadcount('children', 10);
  addItem(Store, 'מתנות', 3000);

  Store.state.settings.collectPerChild = 500;
  assert.equal(Calc.collectionSummary(Store.state).due, 5000);

  Store.state.settings.collectPerChild = 0;
  assert.equal(Calc.collectFirst(Store.state), false);
  assert.equal(Calc.collectionSummary(Store.state).due, 3000, 'back to the budget-derived charge');
  assert.equal(Calc.budgetFrame(Store.state).mode, 'plan');
});

test('an over-planned budget is reported as an overrun, not as progress past the end', () => {
  const { Store, Calc } = setup();
  Store.setHeadcount('children', 10);
  addItem(Store, 'מתנות', 6000);
  Store.state.settings.collectPerChild = 500;

  const frame = Calc.budgetFrame(Store.state);
  assert.equal(frame.available, 5000);
  assert.equal(frame.planned, 6000);
  assert.equal(frame.remaining, -1000, 'negative means planned beyond what is collected');
  assert.equal(frame.pct, 120);
});

test('the saved state carries the field, and old saves get it on load', () => {
  const { Store, Calc } = setup();
  Store.importJSON(JSON.stringify({ children: [{ id: 'c1', name: 'ותיק', parents: [] }] }));
  assert.equal(Store.state.settings.collectPerChild, 0, 'missing field defaults to plan first');
  assert.equal(Calc.collectFirst(Store.state), false);
});

test('with the feature flag off, a saved amount is ignored and nothing changes', () => {
  const { Store, Calc } = setup(false);
  Store.setHeadcount('children', 10);
  addItem(Store, 'מתנות', 3000);
  Store.state.settings.collectPerChild = 500;   // נשמר, אך אינו נקרא

  assert.equal(Calc.budgetDirectionsOn(), false);
  assert.equal(Calc.collectFirst(Store.state), false);
  assert.equal(Calc.fullChildShare(Store.state), 300, 'back to the budget-derived charge');
  assert.equal(Calc.collectionSummary(Store.state).due, 3000);
  assert.equal(Calc.budgetFrame(Store.state).mode, 'plan');

  // והסכום עצמו נשאר על מקומו, כך שהדלקה מחדש מחזירה את המצב
  assert.equal(Store.state.settings.collectPerChild, 500);
});
