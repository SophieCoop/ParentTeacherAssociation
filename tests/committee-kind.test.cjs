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
const plain = x => JSON.parse(JSON.stringify(x));

test('a new committee is a kindergarten one, and the wording matches', () => {
  const { Store, Lang } = setup();
  assert.equal(Store.state.gan.kind, 'gan');
  assert.equal(Lang.kind(), 'gan');
  assert.equal(Lang.t('childrenOf'), 'ילדי הגן');
  assert.equal(Lang.t('placeIn'), 'בגן');
  assert.equal(Store.staffLevel('lead').name, 'גננת');
});

test('choosing a class committee switches every term, staff level included', () => {
  const { Store, Lang } = setup();
  Store.setKind('class');
  assert.equal(Store.kind(), 'class');
  assert.equal(Lang.t('childrenOf'), 'ילדי הכיתה');
  assert.equal(Lang.t('placeIn'), 'בכיתה');
  assert.equal(Lang.t('staffTeam'), 'צוות הכיתה');
  assert.equal(Lang.t('placeName'), 'שם הכיתה');
  assert.equal(Store.staffLevel('lead').name, 'מורה');
  assert.equal(Store.staffLevel('lead').plural, 'מורות');
  // דרגות שאינן תלויות בסוג הוועד אינן משתנות
  assert.equal(Store.staffLevel('manager').name, 'מנהלת');
  assert.ok(Store.STAFF_ROLES.includes('מחנכת'));
  assert.ok(!Store.STAFF_ROLES.includes('גננת'));
});

test('placeholder staff follow the chosen wording, both ways, and named staff never do', () => {
  const { Store } = setup();
  Store.setHeadcount('staff', 3);
  assert.deepEqual(plain(Store.state.staff).map(t => t.name), ['גננת', 'מנהלת', 'סייעת 1']);

  Store.setKind('class');
  assert.deepEqual(plain(Store.state.staff).map(t => [t.name, t.role, t.level]),
    [['מורה', 'מורה', 'lead'], ['מנהלת', 'מנהלת', 'manager'], ['סייעת 1', 'סייעת', 'assistant']]);

  // וחזרה לוועד גן מחזירה את המילה
  Store.setKind('gan');
  assert.deepEqual(plain(Store.state.staff).map(t => t.name), ['גננת', 'מנהלת', 'סייעת 1']);

  // רשומה שקיבלה שם אמיתי יוצאת מהמשחק
  Store.update('staff', Store.state.staff[0].id, { name: 'הדס כהן' });
  assert.equal(Store.state.staff[0].placeholder, false);
  Store.setKind('class');
  assert.equal(Store.state.staff[0].name, 'הדס כהן');
  assert.equal(Store.state.staff[0].role, 'גננת');   // התפקיד שנכתב ביד נשאר כפי שהוא
});

test('a class committee built from scratch gets a teacher as its first placeholder', () => {
  const { Store } = setup();
  Store.setKind('class');
  Store.setHeadcount('staff', 2);
  assert.deepEqual(plain(Store.state.staff).map(t => t.name), ['מורה', 'מנהלת']);
});

test('the choice is saved with the data, and older data stays a kindergarten', () => {
  const { Store } = setup();
  Store.setKind('class');
  const saved = JSON.parse(Store.exportJSON());
  assert.equal(saved.gan.kind, 'class');

  Store.importJSON(JSON.stringify(saved));
  assert.equal(Store.kind(), 'class');

  // נתונים שנשמרו לפני שהבחירה נוספה
  delete saved.gan.kind;
  Store.importJSON(JSON.stringify(saved));
  assert.equal(Store.kind(), 'gan');
});
