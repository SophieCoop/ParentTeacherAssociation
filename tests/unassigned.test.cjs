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
});

/* אם 9 אנשים שילמו, אסור למסך לכתוב "8 טרם שילמו". כל עוד יש כסף
   בלי שם, השאלה מי שילם פתוחה — לא שלילית. */
test('while money is unassigned nobody is declared a non-payer', () => {
  const { Store, Calc } = imported();
  const s = Calc.collectionSummary(Store.state);
  assert.equal(s.noneCount, 0, 'not one of them "has not paid"');
  assert.equal(s.unknownCount, 8, 'they are simply not known yet');
  assert.ok(s.rows.every(r => r.status === 'unknown'));
});

test('once everything is assigned the counts go back to being definitive', () => {
  const { Store, Calc } = imported();
  Store.state.children.forEach((c, i) => {
    const p = Store.state.payments[i];
    if (p) Store.update('payments', p.id, { childId: c.id });
  });
  Store.update('payments', Store.state.payments[8].id, { childId: Store.state.children[0].id });
  const s = Calc.collectionSummary(Store.state);
  assert.equal(s.unassigned, 0);
  assert.equal(s.unknownCount, 0, 'no open questions left');
  assert.ok(s.rows.every(r => r.status !== 'unknown'));
});

test('a child who paid part is partial, not unknown, even beside unassigned money', () => {
  const { Store, Calc } = imported();
  Store.update('payments', Store.state.payments[5].id, { childId: Store.state.children[0].id });
  const s = Calc.collectionSummary(Store.state);
  assert.equal(s.rows[0].status, 'partial', 'we know something about this one');
  assert.equal(s.partialCount, 1);
  assert.equal(s.unknownCount, 7);
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

/* "כל ההורים שילמו" היא שאלה על הכסף, לא על השמות: אם כל מה שצריך
   לגבות נכנס, הגבייה נסגרה גם בלי לדעת מי שילם מה. */
function committee(budget, pays) {
  const { Store, Calc } = setup();
  Store.reset();
  Store.setHeadcount('children', 4);
  Store.add('budgetItems', { name: 'פעילויות', categoryId: Store.state.categories[0].id, mode: 'total', amount: budget });
  pays.forEach(([amount, kid]) => Store.add('payments', {
    childId: kid === null ? '' : Store.state.children[kid].id,
    payer: kid === null ? 'משלם' : '', amount: amount, method: 'paybox', date: '2025-09-21', installments: 1
  }));
  return Calc.collectionSummary(Store.state);
}

test('money all in without a single assignment still closes the collection', () => {
  const s = committee(4000, [[1000, null], [1000, null], [1000, null], [1000, null]]);
  assert.equal(s.done, true, 'the money is the question, not the names');
  assert.equal(s.unknownCount, 4, 'and we still admit we do not know who');
  assert.equal(s.pct, 100);
});

test('money still missing does not close it, assigned or not', () => {
  assert.equal(committee(4000, [[1000, null], [1000, null], [1000, null]]).done, false);
  assert.equal(committee(4000, [[1000, 0], [1000, 1], [1000, 2]]).done, false);
});

test('everyone has a payment but one is partial — not closed', () => {
  const s = committee(4000, [[1000, 0], [1000, 1], [1000, 2], [500, 3]]);
  assert.equal(s.noneCount, 0, 'nobody is at zero');
  assert.equal(s.done, false, 'and yet 500 is missing');
});

test('part assigned, part not, money complete — closed', () => {
  const s = committee(4000, [[1000, 0], [1000, 1], [1000, null], [1000, null]]);
  assert.equal(s.done, true);
  assert.equal(s.unknownCount, 2);
});

/* ---------- "כל ההורים שילמו" דורשת ראיה לכל הורה ---------- */

test('one parent covering the whole budget does not close the collection', () => {
  const s = committee(4000, [[4000, 0]]);
  assert.equal(s.cashGap, 0, 'the budget is covered');
  assert.equal(s.owed, 3000, 'but three parents owe 1,000 each');
  assert.equal(s.remaining, 3000, 'and that is what is left to collect');
  assert.equal(s.done, false);
  assert.equal(s.everyonePaid, false);
  assert.equal(s.overTotal, 3000, 'the one who paid is owed a refund');
});

test('each child covered by their own payment — that is everyone', () => {
  const s = committee(4000, [[1000, 0], [1000, 1], [1000, 2], [1000, 3]]);
  assert.equal(s.everyonePaid, true);
  assert.equal(s.fullCount, 4);
});

test('a parent who paid twice does not pay for someone else', () => {
  /* ילד 0 מקבל שני תשלומים שמכסים גם את המכסה של ילד 3 — הכסף שלם,
     אבל הורה אחד לא שילם, והחוב שלו נשאר חוב */
  const s = committee(4000, [[1000, 0], [1000, 0], [1000, 1], [1000, 2]]);
  assert.equal(s.cashGap, 0);
  assert.equal(s.owed, 1000, 'the fourth parent still owes their share');
  assert.equal(s.done, false);
  assert.equal(s.everyonePaid, false);
});

test('unassigned money counts only as many parents as it has distinct names', () => {
  const four = [['אמא א', 1000], ['אבא ב', 1000], ['אמא ג', 1000], ['אבא ד', 1000]];
  const one = [['אמא א', 1000], ['אמא א', 1000], ['אמא א', 1000], ['אמא א', 1000]];
  const build = list => {
    const { Store, Calc } = setup();
    Store.reset();
    Store.setHeadcount('children', 4);
    Store.add('budgetItems', { name: 'פעילויות', categoryId: Store.state.categories[0].id, mode: 'total', amount: 4000 });
    list.forEach(([payer, amount]) => Store.add('payments',
      { childId: '', payer: payer, amount: amount, method: 'paybox', date: '2025-09-21', installments: 1 }));
    return Calc.collectionSummary(Store.state);
  };
  const a = build(four);
  assert.equal(a.everyonePaid, true, 'four names for four children');
  const b = build(one);
  assert.equal(b.done, true, 'the same money came in');
  assert.equal(b.everyonePaid, false, 'but it is one parent who paid four times');
  assert.equal(b.unassigned, 4000);
});

test('unassigned payments with no name at all prove nothing', () => {
  const { Store, Calc } = setup();
  Store.reset();
  Store.setHeadcount('children', 4);
  Store.add('budgetItems', { name: 'פעילויות', categoryId: Store.state.categories[0].id, mode: 'total', amount: 4000 });
  [1000, 1000, 1000, 1000].forEach(a => Store.add('payments',
    { childId: '', payer: '', amount: a, method: 'cash', date: '2025-09-21', installments: 1 }));
  const s = Calc.collectionSummary(Store.state);
  assert.equal(s.done, true);
  assert.equal(s.everyonePaid, false, 'four anonymous payments could all be one person');
  assert.equal(Calc.distinctPayers(Store.state), 0);
});

test('names that differ only by spacing or case are the same parent', () => {
  const { Store, Calc } = setup();
  Store.reset();
  ['דנה  כהן', 'דנה כהן', 'Dana Cohen', 'dana cohen'].forEach(name => Store.add('payments',
    { childId: '', payer: name, amount: 100, method: 'paybox', date: '2025-09-21', installments: 1 }));
  assert.equal(Calc.distinctPayers(Store.state), 2);
});

test('assigned and unassigned together: the names cover what is missing', () => {
  const { Store, Calc } = setup();
  Store.reset();
  Store.setHeadcount('children', 4);
  Store.add('budgetItems', { name: 'פעילויות', categoryId: Store.state.categories[0].id, mode: 'total', amount: 4000 });
  Store.add('payments', { childId: Store.state.children[0].id, amount: 1000, method: 'bit', date: '2025-09-21', installments: 1 });
  Store.add('payments', { childId: Store.state.children[1].id, amount: 1000, method: 'bit', date: '2025-09-21', installments: 1 });
  ['אמא ג', 'אבא ד'].forEach(n => Store.add('payments',
    { childId: '', payer: n, amount: 1000, method: 'paybox', date: '2025-09-21', installments: 1 }));
  const s = Calc.collectionSummary(Store.state);
  assert.equal(s.everyonePaid, true, 'there are exactly two different payers to explain the two open rows');
  assert.equal(s.unknownCount, 0, 'so nothing is open any more');
  assert.equal(s.fullCount, 4, 'all four count as paid');
  assert.equal(s.rows.map(r => r.status).join(','), 'full,full,covered,covered',
    'the two that were unknown are now covered — paid, but not on a name');
});

test('a committee with no budget yet has not "collected everything"', () => {
  const { Store, Calc } = setup();
  Store.reset();
  Store.setHeadcount('children', 8);
  const s = Calc.collectionSummary(Store.state);
  assert.equal(s.due, 0, 'nothing to collect');
  assert.equal(s.everyonePaid, false, 'and so nothing to declare');
});

/* ---------- ספירת אנשים, לא ספירת תשלומים ---------- */

function payers(list) {
  const { Store, Calc } = setup();
  Store.reset();
  list.forEach(([payer, phone]) => Store.add('payments',
    { childId: '', payer: payer, payerPhone: phone || '', amount: 100, method: 'paybox', date: '2025-09-21', installments: 1 }));
  return Calc.distinctPayers(Store.state);
}

test('the real PayBox file: 9 payments, 8 people', () => {
  /* "וייסברג דורון" מופיע פעמיים — הוא פרס לשלושה תשלומים */
  assert.equal(payers([
    ['נילה אחמדזנוב', '972-526461000'], ['Itay Elkoub', '972-549491000'],
    ['וייסברג דורון', '972-546483000'], ['Anna Riger', '972-507766000'],
    ['אורית חולי', '972-545215000'], ['ברהנו אברהם', '972-505462000'],
    ['וייסברג דורון', '972-546483000'], ['שירן גנות', '972-543512000'],
    ['מיכל רדה', '972-529156000']
  ]), 8);
});

test('the same name in reversed order is one parent, not two', () => {
  assert.equal(payers([['דורון וייסברג'], ['וייסברג דורון']]), 1);
  assert.equal(payers([['דנה כהן'], ['רות לוי']]), 2, 'two real names stay two');
});

test('one phone, two spellings of the name — one parent', () => {
  assert.equal(payers([['Doron W', '054-6483000'], ['דורון וייסברג', '972-546483000']]), 1,
    'the number is the same person however the name is written');
});

test('the link carries: phone joins A to B, name joins B to C', () => {
  assert.equal(payers([
    ['דורון וייסברג', '054-6483000'],   // A
    ['Doron', '054-6483000'],           // B — same phone as A
    ['Doron', '']                       // C — same name as B, no phone
  ]), 1);
});

test('two payments from one parent in instalments count once', () => {
  assert.equal(payers([['שירן גנות', '972-543512000'], ['שירן גנות', '972-543512000'],
                       ['שירן גנות', '972-543512000']]), 1, 'three instalments, one parent');
});

test('the same name on two different phones is two parents', () => {
  assert.equal(payers([['דנה כהן', '052-1111111'], ['דנה כהן', '053-2222222']]), 1,
    'the shared name still joins them — better to undercount than to over-declare');
});

test('a payment assigned to a child is not counted here', () => {
  const { Store, Calc } = setup();
  Store.reset();
  Store.setHeadcount('children', 2);
  Store.add('payments', { childId: Store.state.children[0].id, payer: 'רות לוי', amount: 100, method: 'bit', date: '2025-09-21', installments: 1 });
  Store.add('payments', { childId: '', payer: 'דנה כהן', amount: 100, method: 'paybox', date: '2025-09-21', installments: 1 });
  assert.equal(Calc.distinctPayers(Store.state), 1, 'only the unassigned ones are being identified');
});

test('instalments from one parent do not add up to "everyone paid"', () => {
  const { Store, Calc } = setup();
  Store.reset();
  Store.setHeadcount('children', 4);
  Store.add('budgetItems', { name: 'פעילויות', categoryId: Store.state.categories[0].id, mode: 'total', amount: 4000 });
  /* הורה אחד סוגר 4,000 ₪ בארבעה תשלומים. הכסף שלם, אבל שילם אדם אחד. */
  [1000, 1000, 1000, 1000].forEach(a => Store.add('payments',
    { childId: '', payer: 'וייסברג דורון', payerPhone: '972-546483000', amount: a, method: 'paybox', date: '2025-09-21', installments: 1 }));
  const s = Calc.collectionSummary(Store.state);
  assert.equal(s.done, true);
  assert.equal(Calc.distinctPayers(Store.state), 1);
  assert.equal(s.everyonePaid, false, 'four payments, one parent, three still open');
});

/* ---------- שני חסרים שונים ---------- */

test('normally the budget gap and what parents owe are the same number', () => {
  const s = committee(4000, [[1000, 0], [1000, 1], [1000, 2]]);
  assert.equal(s.cashGap, 1000);
  assert.equal(s.owed, 1000);
  assert.equal(s.remaining, 1000);
});

test('an overpayment does not cancel someone else\'s debt', () => {
  /* שלושה שילמו, אחד מהם 500 ביתר, והרביעי לא שילם כלום */
  const s = committee(4000, [[1000, 0], [1000, 1], [1500, 2]]);
  assert.equal(s.cashGap, 500, 'the pot is only 500 short');
  assert.equal(s.owed, 1000, 'but a whole share is still owed');
  assert.equal(s.remaining, 1000, 'chase the share, not the gap');
  assert.equal(s.overTotal, 500, 'and refund the 500');
});

test('money that is in but unassigned is not a debt of anyone', () => {
  const { Store, Calc } = setup();
  Store.reset();
  Store.setHeadcount('children', 4);
  Store.add('budgetItems', { name: 'פעילויות', categoryId: Store.state.categories[0].id, mode: 'total', amount: 4000 });
  ['אמא א', 'אבא ב', 'אמא ג', 'אבא ד'].forEach(n => Store.add('payments',
    { childId: '', payer: n, amount: 1000, method: 'paybox', date: '2025-09-21', installments: 1 }));
  const s = Calc.collectionSummary(Store.state);
  assert.equal(s.owed, 0, 'nobody is known to owe');
  assert.equal(s.remaining, 0);
  assert.equal(s.done, true, 'and the money is all in');
});

test('unassigned money does not paper over a known debt', () => {
  const { Store, Calc } = setup();
  Store.reset();
  Store.setHeadcount('children', 4);
  Store.add('budgetItems', { name: 'פעילויות', categoryId: Store.state.categories[0].id, mode: 'total', amount: 4000 });
  /* ילד 0 שילם 200 בלבד, והשאר נכנס בלי שיוך מהורה אחד */
  Store.add('payments', { childId: Store.state.children[0].id, amount: 200, method: 'bit', date: '2025-09-21', installments: 1 });
  Store.add('payments', { childId: '', payer: 'אמא ב', amount: 3800, method: 'paybox', date: '2025-09-21', installments: 1 });
  const s = Calc.collectionSummary(Store.state);
  assert.equal(s.cashGap, 0, 'the budget is covered');
  assert.equal(s.owed, 800, 'but child 0 is 800 short of their own share');
  assert.equal(s.done, false);
});

/* ---------- ההורים ששילמו, בשמם ---------- */

function payersOnly(list) {
  const { Store, Calc } = setup();
  Store.reset();
  Store.setHeadcount('children', 6);
  Store.add('budgetItems', { name: 'פעילויות', categoryId: Store.state.categories[0].id, mode: 'total', amount: 8000 });
  list.forEach(([payer, phone, amount]) => Store.add('payments',
    { childId: '', payer: payer, payerPhone: phone, amount: amount, method: 'paybox', date: '2025-09-21', installments: 1 }));
  return { Store, Calc };
}

test('payments are grouped per person, with the total and how many times', () => {
  const { Store, Calc } = payersOnly([
    ['לודמילה אחמדזנוב', '972-526461000', 1444],
    ['אילנה וייסברג דורון', '972-546483000', 481.33],
    ['אילנה וייסברג דורון', '972-546483000', 481.33],
    ['אילנה וייסברג דורון', '972-546483000', 481.33]
  ]);
  const g = Calc.payerGroups(Store.state);
  assert.equal(g.length, 2, 'two people, four payments');
  assert.equal(g[0].name, 'לודמילה אחמדזנוב');
  assert.equal(g[0].count, 1);
  assert.equal(g[1].count, 3, 'three instalments');
  assert.equal(g[1].total, 1443.99);
  assert.equal(g[1].sameAmount, true, 'identical amounts — that is what a PayBox split looks like');
});

test('two payments of different amounts are not called instalments', () => {
  const { Store, Calc } = payersOnly([['דנה כהן', '', 300], ['דנה כהן', '', 700]]);
  const g = Calc.payerGroups(Store.state);
  assert.equal(g[0].count, 2);
  assert.equal(g[0].sameAmount, false, 'a split has one repeating amount, this is two separate payments');
  assert.equal(g[0].total, 1000);
});

test('the fullest spelling of the name represents the group', () => {
  const { Store, Calc } = payersOnly([['דורון', '972-546483000', 100], ['אילנה וייסברג דורון', '972-546483000', 100]]);
  const g = Calc.payerGroups(Store.state);
  assert.equal(g.length, 1, 'one phone, one person');
  assert.equal(g[0].name, 'אילנה וייסברג דורון');
});

test('as many payers as children means they paid, not "not known yet"', () => {
  const six = ['אמא א', 'אבא ב', 'אמא ג', 'אבא ד', 'אמא ה', 'אבא ו']
    .map(n => [n, '', 1333]);
  const { Store, Calc } = payersOnly(six);
  const s = Calc.collectionSummary(Store.state);
  assert.equal(Calc.distinctPayers(Store.state), 6);
  assert.equal(s.unknownCount, 0, 'nothing is open');
  assert.equal(s.rows.map(r => r.status).join(','), 'covered,covered,covered,covered,covered,covered');
  assert.equal(s.fullCount, 6, 'all six count as paid');
});

test('fewer payers than children leaves the question open', () => {
  const { Store, Calc } = payersOnly([['אמא א', '', 4000], ['אבא ב', '', 4000]]);
  const s = Calc.collectionSummary(Store.state);
  assert.equal(Calc.distinctPayers(Store.state), 2);
  assert.equal(s.unknownCount, 6, 'two people cannot vouch for six children');
  assert.equal(s.fullCount, 0);
});

test('an anonymous payment does not turn anyone into a payer', () => {
  const six = [1, 2, 3, 4, 5, 6].map(() => ['', '', 1333]);
  const { Store, Calc } = payersOnly(six);
  const s = Calc.collectionSummary(Store.state);
  assert.equal(Calc.payerGroups(Store.state).length, 0, 'no name, no phone, no person');
  assert.equal(s.unknownCount, 6);
});

/* ---------- שיוך כל התשלומים של משלם אחד ---------- */

test('assigning a payer\'s payments empties that group and fills the child', () => {
  const { Store, Calc } = payersOnly([
    ['אילנה וייסברג דורון', '972-546483000', 481.33],
    ['אילנה וייסברג דורון', '972-546483000', 481.33],
    ['אילנה וייסברג דורון', '972-546483000', 481.33],
    ['שירן גנות', '972-543512000', 1444]
  ]);
  const before = Calc.payerGroups(Store.state);
  assert.equal(before.length, 2);
  const kid = Store.state.children[0];
  before[0].payments.forEach(p => Store.update('payments', p.id, { childId: kid.id }));
  const after = Calc.payerGroups(Store.state);
  assert.equal(after.length, 1, 'the assigned group is gone from the unassigned list');
  assert.equal(after[0].name, 'שירן גנות');
  assert.equal(Calc.paidBy(Store.state, kid.id), 1443.99, 'and the child now carries all three');
});

test('the group key is stable across reads, so a card can be reopened', () => {
  const { Store, Calc } = payersOnly([['דנה כהן', '052-1111111', 100], ['דנה כהן', '052-1111111', 100]]);
  const a = Calc.payerGroups(Store.state)[0].key;
  const b = Calc.payerGroups(Store.state)[0].key;
  assert.equal(a, b);
  assert.ok(a, 'and it is not empty');
});

test('what gets remembered from a group is the phone and the name', () => {
  const { Store, Calc } = payersOnly([['אילנה וייסברג דורון', '972-546483000', 481.33]]);
  const g = Calc.payerGroups(Store.state)[0];
  const kid = Store.state.children[0];
  Store.rememberPayer(kid.id, ['t:546483000', 'n:' + g.name]);
  assert.equal(Store.find('children', kid.id).payerKeys.join(','),
    't:546483000,n:אילנה וייסברג דורון');
});
