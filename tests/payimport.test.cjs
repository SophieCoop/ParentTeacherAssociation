const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/payimport.js'), 'utf8'), ctx);
const P = ctx.PayImport;
const plain = x => JSON.parse(JSON.stringify(x));

test('CSV: BOM, quotes, embedded delimiters and semicolons', () => {
  const rows = plain(P.parseCSV('﻿שם,סכום,תאריך\n"כהן, דנה","1,250.50",18/09/2026\nלוי רון,300,19.9.26\n\n'));
  assert.deepEqual(rows, [['שם', 'סכום', 'תאריך'], ['כהן, דנה', '1,250.50', '18/09/2026'], ['לוי רון', '300', '19.9.26']]);
  assert.deepEqual(plain(P.parseCSV('a;b\n1;"x;y"')), [['a', 'b'], ['1', 'x;y']]);
});

test('amounts and dates in the formats PayBox and Excel produce', () => {
  assert.equal(P.parseAmount('₪ 1,250.50'), 1250.5);
  assert.equal(P.parseAmount('1.250,50'), 1250.5);
  assert.equal(P.parseAmount(250), 250);
  assert.ok(isNaN(P.parseAmount('שולם')));
  assert.equal(P.parseDate('18/09/2026'), '2026-09-18');
  assert.equal(P.parseDate('9.10.25'), '2025-10-09');
  assert.equal(P.parseDate('2026-09-18T10:00:00'), '2026-09-18');
  assert.equal(P.parseDate('09/18/2026'), '2026-09-18', 'US order when the day cannot be a month');
  assert.equal(P.parseDate(46283), '2026-09-18', 'Excel serial');
  assert.equal(P.parseDate(new Date(2026, 8, 18)), '2026-09-18');
  assert.equal(P.parseDate('לא ידוע'), '');
});

test('column detection from Hebrew PayBox-style headers, English headers, and no headers', () => {
  const heb = [['דוח תשלומים'], ['שם המשלם', 'סכום', 'תאריך תשלום', 'סטטוס', 'תיאור'], ['דנה כהן', '250', '18/09/2026', 'שולם', 'ועד']];
  assert.deepEqual(plain(P.detectColumns(heb)), { headerRow: 1, map: { amount: 1, date: 2, name: 0, status: 3, note: 4 } });
  const eng = [['Name', 'Amount', 'Date'], ['Dana', '250', '2026-09-18']];
  assert.deepEqual(plain(P.detectColumns(eng)), { headerRow: 0, map: { amount: 1, date: 2, name: 0 } });
  const bare = [['דנה כהן', '250', '18/09/2026'], ['רון לוי', '300', '19/09/2026']];
  const d = plain(P.detectColumns(bare));
  assert.equal(d.headerRow, -1);
  assert.deepEqual(d.map, { amount: 1, date: 2, name: 0 });
});

test('records skip totals, empty and cancelled rows', () => {
  const rows = [['שם', 'סכום', 'תאריך', 'סטטוס'], ['דנה כהן', '250', '18/09/2026', 'שולם'], ['רון לוי', '0', '18/09/2026', 'שולם'],
    ['מאיה גל', '100', '18/09/2026', 'בוטל'], ['', '', '', ''], ['סה"כ', '350', '', '']];
  const recs = plain(P.toRecords(rows, P.detectColumns(rows)));
  assert.deepEqual(recs.map(r => [r.name, r.amount, r.date, r.skipped]),
    [['דנה כהן', 250, '2026-09-18', ''], ['מאיה גל', 100, '2026-09-18', 'status'], ['סה"כ', 350, '', 'total']]);
  const totals = [['שם', 'סכום'], ['Total', '10'], ['סך הכל', '10'], ['', '10'], ['סהר לוי', '10']];
  assert.deepEqual(plain(P.toRecords(totals, P.detectColumns(totals))).map(r => r.skipped), ['total', 'total', 'total', '']);
});

test('payer names match parents exactly, partially, or stay for the user to decide', () => {
  const kids = [
    { id: 'a', name: 'נועה', parents: [{ name: 'דנה כהן' }, { name: 'יוסי כהן' }] },
    { id: 'b', name: 'איתי', parents: [{ name: 'דנה לוי' }] },
    { id: 'c', name: 'מאיה', parents: [{ name: 'רון גל' }] }
  ];
  assert.deepEqual(plain(P.matchChild('דנה כהן', kids)), { childId: 'a', level: 'exact', candidates: ['a'] });
  assert.deepEqual(plain(P.matchChild('"דנה  כהן"', kids)).childId, 'a', 'quotes and spacing ignored');
  assert.equal(P.matchChild('רון', kids).childId, 'c', 'unique first name');
  assert.equal(P.matchChild('דנה', kids).level, 'ambiguous', 'two parents called Dana');
  assert.equal(P.matchChild('מאיה', kids).childId, 'c', 'child name works too');
  assert.equal(P.matchChild('גל רון', kids).childId, '', 'reversed order is not guessed');
  assert.equal(P.matchChild('שרה אברהם', kids).level, '');
});

test('import plan marks duplicates of existing payments', () => {
  const kids = [{ id: 'a', name: 'נועה', parents: [{ name: 'דנה כהן' }] }];
  const recs = [{ name: 'דנה כהן', amount: 250, date: '2026-09-18', note: '', skipped: '' },
                { name: 'דנה כהן', amount: 250, date: '2026-10-18', note: '', skipped: '' }];
  const plan = plain(P.importPlan(recs, kids, [{ childId: 'a', amount: '250', date: '2026-09-18' }]));
  assert.deepEqual(plan.map(r => [r.childId, r.duplicate, r.skipped]), [['a', true, 'duplicate'], ['a', false, '']]);
});
