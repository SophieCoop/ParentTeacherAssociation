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

test('entering a headcount creates placeholder children and staff that the budget can use', () => {
  const { Store, Calc } = setup();
  assert.equal(Store.setHeadcount('children', 25), 25);
  assert.equal(Store.setHeadcount('staff', 4), 4);
  const kids = plain(Store.state.children);
  assert.equal(kids.length, 25);
  assert.deepEqual(kids.slice(0, 2).map(c => c.name), ['ילד 1', 'ילד 2']);
  assert.equal(kids[24].name, 'ילד 25');
  assert.ok(kids.every(c => c.placeholder && c.id && c.joinDate === Store.state.settings.yearStart));
  assert.ok(new Set(kids.map(c => c.id)).size === 25);
  assert.deepEqual(plain(Store.state.staff).map(t => [t.name, t.level, t.role, t.placeholder]),
    [['גננת', 'lead', 'גננת', true], ['מנהלת', 'manager', 'מנהלת', true],
     ['סייעת 1', 'assistant', 'סייעת', true], ['סייעת 2', 'assistant', 'סייעת', true]]);
  assert.equal(Calc.childCount(Store.state), 25);
  assert.equal(Calc.audienceCount(Store.state, 'children'), 25);
  assert.equal(Calc.audienceCount(Store.state, 'staff_edu'), 4);
  assert.equal(Calc.staffAtLevel(Store.state, 'edu'), 4);
});

test('lowering the count removes only placeholders, from the end, never named children', () => {
  const { Store } = setup();
  Store.add('children', { name: 'אביב', parents: [] });
  Store.setHeadcount('children', 5);
  assert.deepEqual(plain(Store.state.children).map(c => c.name), ['אביב', 'ילד 1', 'ילד 2', 'ילד 3', 'ילד 4']);
  Store.setHeadcount('children', 2);
  assert.deepEqual(plain(Store.state.children).map(c => c.name), ['אביב', 'ילד 1']);
  assert.equal(Store.headcountFloor('children'), 1);
  assert.equal(Store.setHeadcount('children', 0), 1, 'cannot drop below the named child');
  assert.deepEqual(plain(Store.state.children).map(c => c.name), ['אביב']);
});

test('a placeholder with a payment is kept, and renaming a placeholder makes it real', () => {
  const { Store } = setup();
  Store.setHeadcount('children', 3);
  const paid = Store.state.children[1];
  Store.add('payments', { childId: paid.id, amount: 100 });
  Store.setHeadcount('children', 0);
  assert.deepEqual(plain(Store.state.children).map(c => c.name), ['ילד 2']);
  assert.equal(Store.headcountFloor('children'), 1);

  Store.update('children', paid.id, { name: 'נועה' });
  assert.equal(Store.state.children[0].placeholder, false);
  Store.setHeadcount('children', 3);
  assert.deepEqual(plain(Store.state.children).map(c => c.name), ['נועה', 'ילד 1', 'ילד 2'], 'numbering reuses free names');
  Store.setHeadcount('children', 1);
  assert.deepEqual(plain(Store.state.children).map(c => c.name), ['נועה']);
});

test('placeholder staff fill in around real staff: one lead, one manager, then assistants', () => {
  const { Store } = setup();
  Store.add('staff', { name: 'הדס כהן', role: 'גננת', level: 'lead' });
  Store.setHeadcount('staff', 4);
  assert.deepEqual(plain(Store.state.staff).map(t => [t.name, t.level]),
    [['הדס כהן', 'lead'], ['מנהלת', 'manager'], ['סייעת 1', 'assistant'], ['סייעת 2', 'assistant']]);
  Store.setHeadcount('staff', 2);
  assert.deepEqual(plain(Store.state.staff).map(t => t.name), ['הדס כהן', 'מנהלת']);
  Store.setHeadcount('staff', 1);
  assert.deepEqual(plain(Store.state.staff).map(t => t.name), ['הדס כהן']);
  Store.setHeadcount('staff', 1);
  assert.equal(Store.setHeadcount('staff', 0), 1);

  const one = setup();
  one.Store.setHeadcount('staff', 1);
  assert.deepEqual(plain(one.Store.state.staff).map(t => t.level), ['lead'], 'a single staff member is the teacher');
  const dup = setup();
  dup.Store.add('staff', { name: 'מנהלת', role: '', level: 'assistant' });
  dup.Store.setHeadcount('staff', 3);
  const names = plain(dup.Store.state.staff).map(t => t.name);
  assert.equal(new Set(names).size, 3, 'names stay unique: ' + names.join(', '));
});

test('bad input keeps the current count and unknown kinds are ignored', () => {
  const { Store } = setup();
  Store.setHeadcount('staff', 3);
  assert.equal(Store.setHeadcount('staff', 'abc'), 3);
  assert.equal(Store.setHeadcount('staff', 5000), 999);
  assert.equal(Store.setHeadcount('payments', 5), 0);
  assert.equal((Store.state.payments || []).length, 0);
});

test('a payer assignment is stored on the child, accumulates, and survives a reload', () => {
  const { Store } = setup();
  const kid = Store.add('children', { name: 'נועם ריגר', parents: [] });

  assert.equal(Store.rememberPayer(kid.id, ['t:501111111', 'n:anna riger']).id, kid.id);
  assert.deepEqual(plain(Store.find('children', kid.id).payerKeys), ['t:501111111', 'n:anna riger']);

  // הורה יכול לשלם ממספר נוסף — המפתחות מצטברים ואינם נדרסים
  Store.rememberPayer(kid.id, ['t:502222222', 'n:anna riger']);
  assert.deepEqual(plain(Store.find('children', kid.id).payerKeys),
    ['t:501111111', 'n:anna riger', 't:502222222'], 'added once, no duplicates');

  // שורדים ייצוא וטעינה
  const saved = Store.exportJSON();
  Store.reset();
  Store.importJSON(saved);
  assert.deepEqual(plain(Store.find('children', kid.id).payerKeys),
    ['t:501111111', 'n:anna riger', 't:502222222']);

  // קלט ריק או ילד שאינו קיים אינם עושים דבר
  assert.equal(Store.rememberPayer(kid.id, []), null);
  assert.equal(Store.rememberPayer('no-such-child', ['t:1']), null);
});

test('children saved before payer keys existed get an empty list, not undefined', () => {
  const { Store } = setup();
  Store.importJSON(JSON.stringify({ children: [{ id: 'c1', name: 'ותיק', parents: [] }] }));
  assert.deepEqual(plain(Store.find('children', 'c1').payerKeys), []);
});
