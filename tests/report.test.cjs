const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup() {
  const context = vm.createContext({
    window: {}, console, setTimeout: () => 1, clearTimeout() {}, Promise, Date,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
  });
  for (const file of ['js/lang.js', 'js/store.js', 'js/calc.js', 'js/report.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  return context;
}
const plain = x => JSON.parse(JSON.stringify(x));
const NOW = new Date(2027, 0, 15);
const sheetsOf = ctx => plain(ctx.Report.sheets(ctx.Store.state, NOW))
  .reduce((m, s) => (m[s.name] = s, m), {});

test('the report carries the four headline numbers, and they agree with the app', () => {
  const ctx = setup();
  const { Store, Calc } = ctx;
  Store.loadDemo();
  const o = Calc.overview(Store.state);
  const rows = sheetsOf(ctx)['סיכום'].rows;
  const find = label => rows.find(r => r[0] === label);

  assert.equal(find('הכנסות — נגבה בפועל לקופה')[1], o.collected);
  assert.equal(find('תקציב מתוכנן לשנה')[1], o.budget);
  assert.equal(find('הוצאות בפועל')[1], o.spent);
  assert.equal(find('נשאר בקופה (נגבה פחות הוצאות)')[1], o.cashLeft);
  assert.equal(find('נותר מהתקציב המתוכנן')[1], o.budgetLeft);
  assert.equal(find('מספר ילדים')[1], Store.state.children.length);
});

test('every payment, budget item and expense reaches its sheet, with a matching total', () => {
  const ctx = setup();
  const { Store, Calc } = ctx;
  Store.loadDemo();
  const sh = sheetsOf(ctx);

  // header row + one row per record + a blank line + a total line
  const income = sh['הכנסות'].rows;
  assert.equal(income.length, Store.state.payments.length + 3);
  assert.equal(income.at(-1)[3], Calc.collectedTotal(Store.state));

  const budget = sh['תכנון תקציב'].rows;
  assert.equal(budget.length, Store.state.budgetItems.length + 3);
  assert.equal(budget.at(-1)[6], Calc.budgetTotal(Store.state));

  const spend = sh['הוצאות בפועל'].rows;
  assert.equal(spend.length, Store.state.expenses.length + 3);
  assert.equal(spend.at(-1)[4], Calc.expensesTotal(Store.state));

  // the listed amounts really add up to the stated total
  const listed = spend.slice(1, -2).reduce((s, r) => s + r[4], 0);
  assert.equal(Calc.round2(listed), Calc.expensesTotal(Store.state));
});

test('names and dates come through, not ids', () => {
  const ctx = setup();
  const { Store } = ctx;
  Store.loadDemo();
  const row = sheetsOf(ctx)['הכנסות'].rows[1];
  const kid = Store.state.children.find(c => c.name === row[1]);
  assert.ok(kid, 'the child column holds a name');
  assert.ok(row[2].includes(kid.parents[0].name), 'the parent column holds the parent');
  assert.match(String(row[0]), /^\d{4}-\d{2}-\d{2}T/, 'the date column holds a real date');
  assert.ok(['מזומן', 'פייבוקס', 'ביט', 'העברה בנקאית', 'צ׳ק'].includes(row[4]));
});

test('the refunds sheet appears only when there is something to settle', () => {
  const ctx = setup();
  const { Store, Calc } = ctx;
  Store.loadDemo();

  const rf = Calc.refunds(Store.state);
  const present = !!sheetsOf(ctx)['החזרים להורים'];
  assert.equal(present, rf.totalRefund > 0 || rf.totalOwed > 0);

  // with nothing collected and nothing spent there is nothing to settle
  Store.state.payments = [];
  Store.state.expenses = [];
  const names = plain(ctx.Report.sheets(Store.state, NOW)).map(s => s.name);
  assert.deepEqual(names, ['סיכום', 'הכנסות', 'תכנון תקציב', 'הוצאות בפועל']);
});

test('the refunds sheet balances: paid minus real cost, per child and in total', () => {
  const ctx = setup();
  const { Store, Calc } = ctx;
  Store.loadDemo();
  const rf = Calc.refunds(Store.state);
  if (!(rf.totalRefund > 0 || rf.totalOwed > 0)) return;   // nothing to settle in the demo

  const rows = sheetsOf(ctx)['החזרים להורים'].rows;
  const body = rows.slice(3, -2);
  assert.equal(body.length, Store.state.children.length);
  body.forEach(r => assert.equal(Calc.round2(r[3] - r[4]), r[5], 'paid − cost = balance'));
  assert.equal(rows.at(-1)[6], rf.totalRefund);
  assert.equal(rows.at(-1)[7], rf.totalOwed);
});

test('an empty committee still produces a readable report', () => {
  const ctx = setup();
  const { Store } = ctx;
  Store.reset();
  const sh = plain(ctx.Report.sheets(Store.state, NOW));
  assert.equal(sh.length, 4);
  sh.forEach(s => {
    assert.ok(s.name && s.rows.length, s.name + ' has rows');
    assert.ok(Array.isArray(s.widths) && s.widths.length, s.name + ' has column widths');
  });
  assert.equal(sh[0].rows.find(r => r[0] === 'נשאר בקופה (נגבה פחות הוצאות)')[1], 0);
});

test('the file name stays ASCII, whatever the committee is called', () => {
  const ctx = setup();
  const { Store, Report } = ctx;
  ctx.UI = { todayISO: () => '2027-01-15' };
  Store.reset();
  // a Hebrew name in an anchor's download attribute is dropped by some
  // browsers, and the file lands as "download" with no extension
  Store.state.gan.name = 'גן/צבעוני: כיתה*א';
  assert.equal(Report.fileName(), 'vaad-report-2027-01-15.xlsx');
  assert.match(Report.fileName(), /^[\x20-\x7e]+$/, 'ASCII only');
});

test('the income sheet names who paid, even without a child to attach to', () => {
  const ctx = setup();
  const { Store } = ctx;
  Store.reset();
  Store.setHeadcount('children', 3);
  Store.add('payments', { childId: '', payer: 'נילה אחמדזנוב', amount: 1444, method: 'paybox', date: '2025-09-21', installments: 1 });
  Store.add('payments', { childId: Store.state.children[0].id, amount: 500, method: 'bit', date: '2025-09-22', installments: 1 });
  const rows = sheetsOf(ctx)['הכנסות'].rows;
  assert.deepEqual(rows[1].slice(1, 4), ['ללא שיוך', 'נילה אחמדזנוב', 1444],
    'the payer from the file stands in for the missing child');
  assert.equal(rows[2][1], 'ילד 1', 'an assigned payment is unchanged');
  assert.equal(rows[rows.length - 1][3], 1944, 'and both are in the total');
});
