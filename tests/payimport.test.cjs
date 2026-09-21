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
  // סדר הפוך כן מזוהה, אבל ברמה משלו — כדי שהמשתמש יראה על מה
  // ההתאמה נשענת. ההיפוך נדרש להתאמה מלאה, לא חלקית.
  assert.deepEqual([P.matchChild('גל רון', kids).childId, P.matchChild('גל רון', kids).level],
    ['c', 'reversed']);
  assert.equal(P.matchChild('שרה אברהם', kids).level, '');
});

test('import plan marks duplicates of existing payments', () => {
  const kids = [{ id: 'a', name: 'נועה', parents: [{ name: 'דנה כהן' }] }];
  const recs = [{ name: 'דנה כהן', amount: 250, date: '2026-09-18', note: '', skipped: '' },
                { name: 'דנה כהן', amount: 250, date: '2026-10-18', note: '', skipped: '' }];
  const plan = plain(P.importPlan(recs, kids, [{ childId: 'a', amount: '250', date: '2026-09-18' }]));
  assert.deepEqual(plan.map(r => [r.childId, r.duplicate, r.skipped]), [['a', true, 'duplicate'], ['a', false, '']]);
});

/* ---------- התאמה לפי טלפון ----------
   הייצוא של פייבוקס נושא את מספר המשלם, והוא זהה בשני הצדדים גם
   כששמו נכתב באנגלית או בסדר הפוך. */

test('a phone number survives both formats and becomes the same key', () => {
  const local = P.phoneKey('054-6483000');
  assert.equal(P.phoneKey('972-546483000'), local, 'international == local');
  assert.equal(P.phoneKey('+972 54 648 3000'), local, 'spaces and plus ignored');
  assert.equal(P.phoneKey('00972546483000'), local, 'double-zero prefix');
  assert.equal(P.phoneKey('0546483000'), local);
  assert.equal(P.phoneKey(''), '');
  assert.equal(P.phoneKey('1234'), '', 'too short to be a phone');
  assert.equal(P.phoneKey(null), '');
});

test('the payer is matched by phone even when the name would never match', () => {
  const kids = [
    { id: 'a', name: 'איתי אלקוב', parents: [{ name: 'איתי אלקובי', phone: '054-9491000' }] },
    { id: 'b', name: 'ירדן דורון', parents: [{ name: 'דורון וייסברג', phone: '054-6483000' }] }
  ];
  // שם באנגלית — לפי השם לבדו אין סיכוי
  assert.equal(P.matchChild('Itay Elkoub', kids).childId, '', 'name alone fails');
  const m = P.matchPayer({ name: 'Itay Elkoub', phone: '972-549491000' }, kids);
  assert.deepEqual([m.childId, m.level], ['a', 'phone']);

  // סדר הפוך נתפס לפי השם, אבל הטלפון גובר ומדייק את הרמה
  assert.equal(P.matchChild('וייסברג דורון', kids).level, 'reversed');
  const rev = P.matchPayer({ name: 'וייסברג דורון', phone: '972-546483000' }, kids);
  assert.deepEqual([rev.childId, rev.level], ['b', 'phone']);
});

test('without a usable phone the match falls back to the name, unchanged', () => {
  const kids = [{ id: 'a', name: 'מאיה גל', parents: [{ name: 'דנה כהן', phone: '052-1111111' }] }];
  assert.equal(P.matchPayer({ name: 'דנה כהן', phone: '' }, kids).level, 'exact');
  assert.equal(P.matchPayer({ name: 'דנה כהן' }, kids).level, 'exact');
  assert.equal(P.matchPayer({ name: 'דנה כהן', phone: '03-000' }, kids).level, 'exact', 'junk phone ignored');
  assert.equal(P.matchPayer({ name: 'לא קיים', phone: '972-599999999' }, kids).childId, '',
    'an unknown phone does not invent a match');
});

test('one phone on two children is ambiguous, never a silent guess', () => {
  const kids = [
    { id: 'a', name: 'תום לוי', parents: [{ name: 'רות לוי', phone: '052-7777777' }] },
    { id: 'b', name: 'גיל לוי', parents: [{ name: 'רות לוי', phone: '052-7777777' }] }
  ];
  const m = P.matchPayer({ name: 'רות לוי', phone: '972-527777777' }, kids);
  assert.equal(m.childId, '', 'no child is picked');
  assert.equal(m.level, 'ambiguous');
  assert.deepEqual(plain(m.candidates), ['a', 'b']);
});

test('a PayBox export maps its columns and keeps only the money coming in', () => {
  const rows = [
    ['שם', 'פלאפון', 'סוג', 'סכום', 'תאריך', 'הערות', 'שורות התשלום'],
    ['נילה א', '972-526461000', 'העברה לקבוצה', 1444, '2025-09-21', '', ''],
    ['Itay E', '972-549491000', 'העברה לקבוצה', 1444, '2025-09-21', '', ''],
    ['Sophie C', '972-542117000', 'תשלום מהקבוצה', -1100, '2025-09-25', '', ''],
    ['מיכל ר', '972-529156000', 'העברה לקבוצה', 481.33, '2026-05-11', 'חוג חיות', ''],
    ['Sophie C', '972-542117000', 'תשלום מהקבוצה', -3300, '2025-11-18', '', '']
  ];
  const det = P.detectColumns(rows);
  assert.equal(det.headerRow, 0);
  assert.deepEqual(
    ['name', 'phone', 'amount', 'date', 'note'].map(k => rows[0][det.map[k]]),
    ['שם', 'פלאפון', 'סכום', 'תאריך', 'הערות'],
    'every column lands where it belongs');

  const recs = P.toRecords(rows, det);
  // תנועות יוצאות מהקופה (סכום שלילי) אינן תשלומי הורים
  assert.equal(recs.length, 3);
  assert.deepEqual(plain(recs).map(r => r.amount), [1444, 1444, 481.33]);
  assert.equal(recs[2].note, 'חוג חיות');
  assert.equal(recs[0].phone, P.phoneKey('052-6461000'));
});

/* ---------- מה שנלמד פעם אחת ---------- */

test('a payer the user assigned by hand is recognised on the next import', () => {
  const kids = [{ id: 'a', name: 'נועם ריגר', parents: [{ name: 'אנה ריגר', phone: '' }] }];
  const rec = { name: 'Anna Riger', phone: '' };

  // בפעם הראשונה אין קשר בין "Anna Riger" ל"אנה ריגר"
  assert.equal(P.matchPayer(rec, kids).childId, '', 'nothing to go on yet');

  // המשתמש שייך ביד, והמפתחות נשמרים על הילד
  kids[0].payerKeys = P.keysForRecord(rec);
  const m = P.matchPayer(rec, kids);
  assert.deepEqual([m.childId, m.level], ['a', 'remembered']);
});

test('a remembered phone is recognised even when the name changed since', () => {
  const kids = [{ id: 'a', name: 'תום לוי', parents: [{ name: 'רות לוי', phone: '' }],
                  payerKeys: P.keysForRecord({ name: 'Ruth Levi', phone: '972-521111111' }) }];
  // אותו מספר, שם אחר לגמרי בייצוא הבא
  const m = P.matchPayer({ name: 'R. Levi-Cohen', phone: '052-1111111' }, kids);
  assert.deepEqual([m.childId, m.level], ['a', 'phone']);
});

test('what gets remembered is the phone and the name, and nothing else', () => {
  assert.deepEqual(plain(P.keysForRecord({ name: 'דנה כהן', phone: '972-521234567' })),
    ['t:521234567', 'n:דנה כהן']);
  assert.deepEqual(plain(P.keysForRecord({ name: 'דנה כהן', phone: '' })), ['n:דנה כהן']);
  assert.deepEqual(plain(P.keysForRecord({ name: '', phone: '' })), []);
});

test('a remembered name on two children is ambiguous, not a coin toss', () => {
  const rec = { name: 'Dana K', phone: '' };
  const keys = P.keysForRecord(rec);
  const kids = [{ id: 'a', name: 'תום', parents: [], payerKeys: keys },
                { id: 'b', name: 'גיל', parents: [], payerKeys: keys }];
  const m = P.matchPayer(rec, kids);
  assert.equal(m.childId, '');
  assert.equal(m.level, 'ambiguous');
});

test('a real phone still beats a remembered name', () => {
  const kids = [
    { id: 'a', name: 'תום לוי', parents: [{ name: 'רות לוי', phone: '052-1111111' }] },
    { id: 'b', name: 'גיל כהן', parents: [], payerKeys: ['n:רות לוי'] }
  ];
  const m = P.matchPayer({ name: 'רות לוי', phone: '972-521111111' }, kids);
  assert.deepEqual([m.childId, m.level], ['a', 'phone'], 'the phone is the harder evidence');
});

/* ---------- ייבוא בלי שיוך ---------- */
/* ועד שהוזן בו רק מספר ילדים ולא שמות: אין למה לשייך, והכסף עדיין
   אמיתי. השורות נכנסות בלי שיוך, ושם המשלם מהקובץ הוא מה שמחזיק
   אותן — גם בתצוגה וגם בזיהוי כפילויות בייבוא הבא. */
const placeholders = [1, 2, 3].map(i => ({ id: 'c' + i, name: 'ילד ' + i, placeholder: true, parents: [] }));
const file = [
  { name: 'נילה אחמדזנוב', amount: 1444, date: '2025-09-21' },
  { name: 'Itay Elkoub', amount: 1444, date: '2025-09-21' },
  { name: 'וייסברג דורון', amount: 481.33, date: '2025-09-21' }
];

test('with placeholder children nothing matches, and nothing is dropped', () => {
  const plan = plain(P.importPlan(file, placeholders, []));
  assert.equal(plan.length, 3);
  assert.deepEqual(plan.map(r => r.childId), ['', '', ''], 'no child to attach to');
  assert.deepEqual(plan.map(r => r.skipped), ['', '', ''], 'and yet none is filtered out');
  assert.deepEqual(plan.map(r => r.name), file.map(r => r.name), 'the payer name survives');
});

test('the same file twice: the payer name is what catches the duplicate', () => {
  const stored = file.map((r, i) => ({ id: 'p' + i, childId: '', payer: r.name, amount: r.amount, date: r.date }));
  const plan = plain(P.importPlan(file, placeholders, stored));
  assert.deepEqual(plan.map(r => r.skipped), ['duplicate', 'duplicate', 'duplicate']);
});

test('a payment assigned by hand after the import is still caught next time', () => {
  const stored = [{ id: 'p0', childId: 'c1', payer: 'נילה אחמדזנוב', amount: 1444, date: '2025-09-21' }];
  const plan = plain(P.importPlan(file, placeholders, stored));
  assert.equal(plan[0].skipped, 'duplicate', 'the payer key still matches although the child changed');
  assert.equal(plan[1].skipped, '', 'and the row with the same amount but another payer does not');
});

test('a stored payment with neither child nor payer blocks nothing', () => {
  const stored = [{ id: 'p0', childId: '', payer: '', amount: 1444, date: '2025-09-21' }];
  const plan = plain(P.importPlan(file, placeholders, stored));
  assert.deepEqual(plan.map(r => r.skipped), ['', '', ''], 'better a double than a real row blocked');
  assert.deepEqual(plain(P.dupKeys('', '', 1444, '2025-09-21')), []);
});

test('amount and date are part of the key, so a second payment is not a duplicate', () => {
  const stored = [{ id: 'p0', childId: '', payer: 'נילה אחמדזנוב', amount: 1444, date: '2025-09-21' }];
  const later = [{ name: 'נילה אחמדזנוב', amount: 1444, date: '2025-11-02' },
                 { name: 'נילה אחמדזנוב', amount: 200, date: '2025-09-21' }];
  const plan = plain(P.importPlan(later, placeholders, stored));
  assert.deepEqual(plan.map(r => r.skipped), ['', '']);
});

/* ---------- עמודת "שם הילד/ה" / שאלת מנהל ----------
   בפייבוקס אפשר לצרף לגבייה שאלה למשלמים, ומנהלי ועד שואלים בה
   כמעט תמיד בשביל מי התשלום. התשובה הזאת היא הראיה הישירה ביותר. */

const QKIDS = [
  { id: 'a', name: 'תום לוי', parents: [{ name: 'רות לוי', phone: '052-1111111' }] },
  { id: 'b', name: 'גיל כהן', parents: [{ name: 'דנה כהן', phone: '052-2222222' }] }
];
function withQuestion(header, answer, payer, phone) {
  const rows = [['שם', 'פלאפון', 'סכום', 'תאריך', header],
                [payer || 'סבתא שרה', phone || '972-509999999', '300', '2025-09-21', answer]];
  const detected = P.detectColumns(rows);
  const rec = plain(P.toRecords(rows, detected))[0];
  return { col: detected.map.child, rec: rec, match: plain(P.matchPayer(rec, QKIDS)) };
}

test('the admin question column is found however it is phrased', () => {
  ['מה שם הילד/ה?', 'שם הילד', 'שם התלמיד/ה', 'עבור מי התשלום?', 'שאלת מנהל', 'ילד/ה', 'Child', 'Student']
    .forEach(header => {
      const r = withQuestion(header, 'גיל כהן');
      assert.equal(r.col, 4, header + ' — column not detected');
      assert.equal(r.rec.childName, 'גיל כהן');
      assert.deepEqual([r.match.childId, r.match.level], ['b', 'child'], header);
    });
});

test('a plain notes column is not mistaken for the question', () => {
  const r = withQuestion('הערות', 'שולם במזומן');
  assert.equal(r.col, undefined);
  assert.equal(r.rec.childName, '');
});

test('the declared child beats the phone — a grandmother paying for a grandchild', () => {
  /* המספר רשום אצל תום, אבל ההורה כתב במפורש "גיל כהן" */
  const r = withQuestion('מה שם הילד/ה?', 'גיל כהן', 'רות לוי', '052-1111111');
  assert.deepEqual([r.match.childId, r.match.level], ['b', 'child'],
    'what the payer wrote wins over whose number it came from');
});

test('an answer that matches nothing does not block the other signals', () => {
  const r = withQuestion('מה שם הילד/ה?', 'ילד שלא קיים', 'רות לוי', '052-1111111');
  assert.deepEqual([r.match.childId, r.match.level], ['a', 'phone'], 'falls back to the phone');
});

test('an answer that fits two children falls through rather than guessing', () => {
  const kids = [{ id: 'a', name: 'תום לוי', parents: [] }, { id: 'b', name: 'תום לוי', parents: [] }];
  const rows = [['שם', 'סכום', 'שם הילד'], ['סבתא שרה', '300', 'תום לוי']];
  const rec = plain(P.toRecords(rows, P.detectColumns(rows)))[0];
  const m = plain(P.matchPayer(rec, kids));
  assert.equal(m.childId, '', 'two candidates, so no automatic pick');
});

test('an empty answer on one row does not spoil the others', () => {
  const rows = [['שם', 'סכום', 'מה שם הילד/ה?'],
                ['סבתא שרה', '300', 'גיל כהן'],
                ['דוד רון', '300', ''],
                ['רות לוי', '300', 'תום לוי']];
  const recs = plain(P.toRecords(rows, P.detectColumns(rows)));
  assert.deepEqual(recs.map(r => r.childName), ['גיל כהן', '', 'תום לוי']);
  assert.deepEqual(recs.map(r => plain(P.matchPayer(r, QKIDS)).level), ['child', '', 'child']);
});

test('a question column whose header reads like another kind does not steal it', () => {
  /* "עבור" היא כותרת של תיאור, ו"עבור איזה ילד" של שאלת המנהל */
  const rows = [['שם', 'סכום', 'עבור', 'עבור איזה ילד'], ['סבתא שרה', '300', 'ועד', 'גיל כהן']];
  const d = P.detectColumns(rows);
  assert.equal(d.map.note, 2, 'the exact header keeps its own kind');
  assert.equal(d.map.child, 3);
});

test('the real PayBox export has no question column and is unaffected', () => {
  const rows = [['שם', 'פלאפון', 'סוג', 'סכום', 'תאריך', 'הערות', 'שורות התשלום', 'מנהל שורות התשלום'],
                ['וייסברג דורון', '972-546483000', 'העברה לקבוצה', '481.33', '2025-09-21', '💸 תשלומים', 'ב3 תשלומים']];
  const d = plain(P.detectColumns(rows));
  assert.equal(d.map.child, undefined, 'nothing here answers "which child"');
  assert.deepEqual([d.map.name, d.map.phone, d.map.amount, d.map.date, d.map.note], [0, 1, 3, 4, 5]);
});
