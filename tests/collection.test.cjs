const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup() {
  let form;
  const context = vm.createContext({
    window: {}, console, setTimeout: () => 1, clearTimeout() {},
    UI: { todayISO: () => '2026-09-17', formModal: options => { form = options; }, toast() {} },
    App: { render() {} }
  });
  for (const file of ['js/store.js', 'js/calc.js', 'js/views/collection.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  context.Store.state.children.push(
    { id: 'a', name: 'אביב', parents: [{ name: 'סופי' }] },
    { id: 'b', name: 'גבי', parents: [{ name: 'גבי' }] }
  );
  return { ...context, form: () => form };
}

test('bulk payment records the full amount separately for each selected child', () => {
  const s = setup();
  s.Views.collection.payForm();
  s.form().onSubmit({ childIds: ['a', 'b'], amount: 150, method: 'paybox', date: '2026-09-17', installments: 2, note: 'ועד' });
  const payments = JSON.parse(JSON.stringify(s.Store.state.payments));
  assert.equal(payments.length, 2);
  assert.deepEqual(payments.map(p => [p.childId, p.amount, p.method, p.installments, p.note]),
    [['a', 150, 'paybox', 2, 'ועד'], ['b', 150, 'paybox', 2, 'ועד']]);
  assert.notEqual(payments[0].id, payments[1].id);
  assert.ok(payments.every(p => !('childIds' in p)));
});

test('empty or stale selections do not create unassigned payments', () => {
  for (const childIds of [[], ['missing'], ['a', 'missing']]) {
    const s = setup();
    s.Views.collection.payForm();
    assert.equal(s.form().onSubmit({ childIds, amount: 100 }), false);
    assert.equal(s.Store.state.payments.length, 0);
  }
});

test('editing one payment keeps the other payment intact', () => {
  const s = setup();
  s.Store.add('payments', { id: 'p1', childId: 'a', amount: 100 });
  s.Store.add('payments', { id: 'p2', childId: 'b', amount: 100 });
  s.Views.collection.payForm(s.Store.find('payments', 'p1'));
  s.form().onSubmit({ childId: 'a', amount: 200, installments: 1 });
  assert.equal(s.Store.state.payments.length, 2);
  assert.equal(s.Store.find('payments', 'p1').amount, 200);
  assert.equal(s.Store.find('payments', 'p2').amount, 100);
});
