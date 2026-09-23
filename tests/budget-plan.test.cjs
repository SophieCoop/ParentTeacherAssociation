/* ============================================================
   עזר התקציב: ההצעה לחלוקה, והשינויים שהיא מייצרת
   ------------------------------------------------------------
   שלושה דברים שחייבים להחזיק: סכום ההצעה שווה בדיוק למה שחולק,
   סעיף קיים לעולם אינו נמחק, ו"שמירה על הקיים" באמת לא נוגעת בו.
   ============================================================ */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup() {
  const context = vm.createContext({
    window: {}, console, setTimeout: () => 1, clearTimeout() {}, Intl,
    Features: { budgetDirections: true },
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

function amountOf(ctx) {
  return (b) => ctx.Calc.itemAmount(ctx.Store.state, b);
}

/* מה שהמסך עושה באישור — כאן, כדי לבדוק את התוצאה ברשימת הסעיפים */
function apply(ctx, plan, amounts) {
  const { Store, BudgetPlan } = ctx;
  const ch = BudgetPlan.changes(Store.state, plan, amounts || {}, amountOf(ctx));
  ch.update.forEach((u) => Store.update('budgetItems', u.id, u.data));
  ch.add.forEach((d) => Store.add('budgetItems', d));
  return ch;
}

/* מערכים שנוצרו בתוך הקונטקסט של vm אינם זהים בטיפוס לאלה שכאן */
const plain = (v) => JSON.parse(JSON.stringify(v));
const eq = (a, b, msg) => assert.deepEqual(plain(a), b, msg);

const sum = (xs) => xs.reduce((s, x) => s + x, 0);

test('the design example: 15,000 split across the default picks, to the shekel', () => {
  const ctx = setup();
  const { Store, Calc, BudgetPlan } = ctx;
  Store.setHeadcount('children', 30);
  Store.state.settings.collectPerChild = 500;

  const available = Calc.budgetFrame(Store.state).available;
  assert.equal(available, 15000);

  const plan = BudgetPlan.propose(Store.state, amountOf(ctx), {
    picks: ['yearend_kids', 'yearend_staff', 'party', 'holidays', 'food', 'gear', 'reserve'],
    holidays: BudgetPlan.DEFAULT_HOLIDAYS, mode: 'keep', available
  });
  const byId = Object.fromEntries(plan.rows.map((r) => [r.id, r.amount]));
  eq(byId, {
    yearend_kids: 3000, yearend_staff: 2600, party: 2000, holidays: 3500,
    gear: 1100, food: 1500, reserve: 1300
  });
  assert.equal(sum(plan.rows.map((r) => r.amount)), 15000);

  apply(ctx, plan);
  assert.equal(Calc.budgetTotal(Store.state), 15000, 'the new items add up to exactly what was split');
  assert.equal(Calc.budgetFrame(Store.state).remaining, 0);
});

test('holidays become one dated item each, and the row total is split between them', () => {
  const ctx = setup();
  const { Store, BudgetPlan } = ctx;
  Store.setHeadcount('children', 10);

  const plan = BudgetPlan.propose(Store.state, amountOf(ctx), {
    picks: ['holidays'], holidays: ['rosh', 'hanukkah', 'purim'], mode: 'keep', available: 1000
  });
  const ch = apply(ctx, plan);
  assert.equal(ch.add.length, 3);
  eq(ch.add.map((d) => d.title), ['מתנה לראש השנה', 'מתנה לחנוכה', 'מתנה לפורים']);
  assert.equal(sum(ch.add.map((d) => d.rate)), 1000);
  // תאריכי החגים של תשפ״ז, מהלוח העברי
  eq(ch.add.map((d) => d.date), ['2026-09-12', '2026-12-05', '2027-03-23']);
  assert.ok(ch.add.every((d) => d.categoryId === 'cat-holiday' && d.basis === 'total'));
});

test('a child who joins after a holiday does not pay for it, but the total still holds', () => {
  const ctx = setup();
  const { Store, Calc, BudgetPlan } = ctx;
  Store.setHeadcount('children', 2);
  Store.update('children', Store.state.children[1].id, { joinDate: '2027-01-01' });

  const plan = BudgetPlan.propose(Store.state, amountOf(ctx), {
    picks: ['holidays'], holidays: ['hanukkah', 'purim'], mode: 'keep', available: 400
  });
  apply(ctx, plan);
  assert.equal(Calc.budgetTotal(Store.state), 400);
  const late = Calc.childCollection(Store.state, Store.state.children[1]);
  const early = Calc.childCollection(Store.state, Store.state.children[0]);
  assert.equal(late.due, 100, 'half of purim only');
  assert.equal(early.due, 300);
});

test('keep: existing items are untouched, and only the remainder is proposed', () => {
  const ctx = setup();
  const { Store, BudgetPlan } = ctx;
  Store.setHeadcount('children', 10);
  const gift = Store.add('budgetItems', {
    title: 'מתנת סוף שנה', categoryId: 'cat-yearend', audience: 'children',
    basis: 'per_person', period: 'year', rate: 200, periods: []
  });

  const init = BudgetPlan.initialPicks(Store.state);
  eq(init.picks, ['yearend_kids'], 'what is already planned comes pre-selected');

  const plan = BudgetPlan.propose(Store.state, amountOf(ctx), {
    picks: ['yearend_kids', 'food', 'reserve'], holidays: [], mode: 'keep', available: 5000
  });
  assert.equal(plan.planned, 2000);
  assert.equal(plan.fixed, 2000);
  eq(plan.rows.map((r) => r.id), ['food', 'reserve'], 'the existing pick gets no new row');
  assert.equal(sum(plan.rows.map((r) => r.amount)), 3000);

  const ch = apply(ctx, plan);
  assert.equal(ch.update.length, 0);
  assert.equal(Store.find('budgetItems', gift.id).rate, 200);
  assert.equal(Store.find('budgetItems', gift.id).basis, 'per_person');
});

test('reset: picked items get a new amount in place, nothing is deleted, unpicked ones stay fixed', () => {
  const ctx = setup();
  const { Store, Calc, BudgetPlan } = ctx;
  Store.setHeadcount('children', 10);
  const gift = Store.add('budgetItems', {
    title: 'מתנת סוף שנה', categoryId: 'cat-yearend', audience: 'children',
    basis: 'per_person', period: 'year', rate: 200, periods: []
  });
  const clubs = Store.add('budgetItems', {
    title: 'חוג', categoryId: 'cat-clubs', audience: 'children',
    basis: 'total', period: 'year', rate: 1000, periods: []
  });

  const plan = BudgetPlan.propose(Store.state, amountOf(ctx), {
    picks: ['yearend_kids', 'reserve'], holidays: [], mode: 'reset', available: 6000
  });
  assert.equal(plan.fixed, 1000, 'the unpicked clubs item stays as it is');
  assert.equal(plan.toSplit, 5000);

  const ch = apply(ctx, plan, { yearend_kids: 4000 });
  assert.equal(Store.state.budgetItems.length, 3, 'two existing, one new reserve');
  eq(ch.update.map((u) => u.id), [gift.id]);
  assert.equal(Calc.itemAmount(Store.state, Store.find('budgetItems', gift.id)), 4000, 'the edited amount wins');
  assert.equal(Store.find('budgetItems', clubs.id).rate, 1000);
  // הרזרבה נשארת בסכום שהוצע לה; העריכה של שורה אחת אינה מזיזה את האחרות
  assert.equal(Calc.budgetTotal(Store.state), 4000 + 1650 + 1000);
});

test('an existing holiday is recognised by its title, and keep proposes only the new ones', () => {
  const ctx = setup();
  const { Store, BudgetPlan } = ctx;
  Store.setHeadcount('children', 10);
  Store.add('budgetItems', {
    title: 'מתנה לחנוכה', categoryId: 'cat-holiday', audience: 'children',
    basis: 'total', period: 'year', rate: 500, periods: [], date: '2026-12-01'
  });

  const init = BudgetPlan.initialPicks(Store.state);
  eq(init.picks, ['holidays']);
  eq(init.holidays, ['hanukkah']);

  const plan = BudgetPlan.propose(Store.state, amountOf(ctx), {
    picks: ['holidays'], holidays: ['hanukkah', 'pesach'], mode: 'keep', available: 1500
  });
  assert.equal(plan.rows.length, 1);
  eq(plan.rows[0].holidays.map((h) => h.id), ['pesach']);
  assert.equal(plan.rows[0].amount, 1000);
});

test('rounding never leaves the split off by a shekel, even for awkward totals', () => {
  const { BudgetPlan } = setup();
  for (const total of [0, 7, 99, 1234, 4999, 15001, 23457]) {
    const parts = BudgetPlan.split(total, [20, 17, 13, 23, 10, 7], -1);
    assert.equal(sum(parts), total, 'split of ' + total);
    assert.ok(parts.every((v) => v >= 0), 'no negative amounts for ' + total);
  }
});

test('without a Hebrew calendar the holiday date falls back to a nearby fixed day', () => {
  const ctx = setup();
  const d = ctx.BudgetPlan.holidayDate({ yearStart: '2026-09-01', yearEnd: '2027-06-30' }, 'pesach');
  assert.equal(d, '2027-04-22');
  // שנת לימודים לא תקינה — אין בה מה לסרוק
  assert.equal(ctx.BudgetPlan.holidayDate({ yearStart: '', yearEnd: '' }, 'pesach').slice(5), '04-10');
});
