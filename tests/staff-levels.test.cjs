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

test('afternoon care is a built-in educational staff level', () => {
  const { Store } = setup();
  const lv = Store.STAFF_LEVELS.find(l => l.id === 'afternoon');
  assert.equal(lv.name, 'צהרון');
  assert.ok(Store.eduLevelIds().includes('afternoon'));
});

test('a manually added category joins the levels, the educational staff and the budget ranks', () => {
  const { Store, Calc } = setup();
  const lv = Store.addStaffLevel({ name: 'צוות מטבח', icon: '🧑‍🍳', weight: Calc.rankToWeight(3) });
  assert.ok(lv.id && lv.custom && lv.edu);
  assert.equal(Store.STAFF_LEVELS.at(-1).id, lv.id);
  assert.equal(Store.staffLevel(lv.id).name, 'צוות מטבח');
  assert.ok(Store.eduLevelIds().includes(lv.id));
  assert.equal(Calc.levelRank(Store.state, lv.id), 3);
  Store.state.staff.push({ id: 's1', name: 'רות', level: lv.id });
  assert.equal(Calc.staffAtLevel(Store.state, 'edu'), 1);

  assert.equal(Store.updateStaffLevel(lv.id, { name: 'מטבח', weight: 4 }).name, 'מטבח');
  assert.equal(Calc.levelRank(Store.state, lv.id), 1);
  assert.equal(Store.addStaffLevel({ name: '   ' }), null);
});

test('a category with staff in it cannot be deleted; an empty one can', () => {
  const { Store } = setup();
  const lv = Store.addStaffLevel({ name: 'הסעות' });
  Store.state.staff.push({ id: 's1', name: 'רות', level: lv.id });
  Store.state.settings.levelWeights[lv.id] = 3;
  assert.equal(Store.removeStaffLevel(lv.id), false);
  Store.state.staff.length = 0;
  assert.equal(Store.removeStaffLevel(lv.id), true);
  assert.equal(Store.STAFF_LEVELS.some(l => l.id === lv.id), false);
  assert.equal(lv.id in Store.state.settings.levelWeights, false);
  assert.equal(Store.removeStaffLevel('manager'), false);
});

test('custom levels survive a reload and bad entries are dropped', () => {
  const { Store } = setup();
  Store.replaceState({
    staffLevels: [
      { id: 'lvl-1', name: 'חצר', icon: '🌳', tone: 'nope', weight: 99 },
      { id: 'lvl-1', name: 'כפול' },
      { id: 'manager', name: 'מתחזה' },
      { id: 'lvl-2', name: '' },
      'garbage'
    ]
  });
  const custom = Store.STAFF_LEVELS.filter(l => l.custom);
  assert.deepEqual(JSON.parse(JSON.stringify(custom.map(l => [l.id, l.name, l.tone, l.weight, l.plural]))), [['lvl-1', 'חצר', 'purple', 4, 'חצר']]);
  assert.equal(Store.STAFF_LEVELS.filter(l => l.id === 'manager').length, 1);
  Store.replaceState({});
  assert.deepEqual(JSON.parse(JSON.stringify(Store.state.staffLevels)), []);
});
