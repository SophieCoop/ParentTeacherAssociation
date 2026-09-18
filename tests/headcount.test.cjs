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
  for (const file of ['js/store.js', 'js/calc.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  return context;
}

test('a headcount entered in setup feeds per-person budget items until a longer list exists', () => {
  const { Store, Calc } = setup();
  Store.state.settings.childrenCount = 25;
  Store.state.settings.staffCount = 4;
  assert.equal(Calc.childCount(Store.state), 25);
  assert.equal(Calc.staffCount(Store.state), 4);
  assert.equal(Calc.audienceCount(Store.state, 'children'), 25);
  assert.equal(Calc.audienceCount(Store.state, 'staff_edu'), 4);

  for (let i = 0; i < 3; i++) Store.state.children.push({ id: 'c' + i, name: 'ילד ' + i });
  assert.equal(Calc.childCount(Store.state), 25, 'three names do not shrink the headcount');
  for (let i = 3; i < 30; i++) Store.state.children.push({ id: 'c' + i, name: 'ילד ' + i });
  assert.equal(Calc.childCount(Store.state), 30, 'a longer list wins');

  const idea = { audiences: ['children', 'staff'], lines: [{ qty: 1, amount: 340 }] };
  const total = Calc.ideaTotal(idea, Store.state);
  assert.ok(total > 0);
  const split = Calc.ideaSplit(Store.state, idea);
  assert.deepEqual(JSON.parse(JSON.stringify(split.parts)).map(p => [p.id, p.count]), [['children', 30], ['staff', 4]]);
  assert.equal(split.perChild, round(total / 34));
  assert.equal(split.perParent, round(total / 30));
  function round(x) { return Math.round(x * 100) / 100; }
});

test('headcounts are cleaned on load', () => {
  const { Store, Calc } = setup();
  Store.replaceState({ settings: { childrenCount: '12', staffCount: -3 } });
  assert.equal(Store.state.settings.childrenCount, 12);
  assert.equal(Store.state.settings.staffCount, 0);
  Store.replaceState({ settings: { childrenCount: 'abc', staffCount: 5000 } });
  assert.equal(Store.state.settings.childrenCount, 0);
  assert.equal(Store.state.settings.staffCount, 999);
  Store.replaceState({});
  assert.equal(Calc.childCount(Store.state), 0);
});
