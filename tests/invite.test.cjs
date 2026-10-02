const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

/* שותפים בוועד: מי שהצטרף דרך הזמנה (js/views/join.js) אינו הבעלים
   של הגן שהוא רואה, ולכן pull ו-push צריכים ללכת אל user_id של
   הבעלים ולא של עצמו (js/cloud.js, effectiveId). הטסטים כאן מריצים
   את cloud.js וstore.js האמיתיים מול fetch מדומה, ובודקים לאיזה
   user_id פנו קריאות הרשת בכל תרחיש. */

const OWNER = 'owner-uuid';
const MEMBER = 'member-uuid';

function makeLocalStorage() {
  var data = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; }
  };
}

/* membershipRow — מה שמחזירה קריאת vaad_members עבור המשתמש שמתחבר.
   null = אינו שותף של אף אחד (הבעלים של עצמו). */
function setup(membershipRow) {
  const calls = [];
  const ctx = vm.createContext({
    console, setTimeout: () => 1, clearTimeout() {},
    localStorage: makeLocalStorage(),
    location: { origin: 'https://www.vaadhorim.com', pathname: '/', protocol: 'https:', hostname: 'www.vaadhorim.com' },
    window: {}, document: { addEventListener() {} },
    navigator: { onLine: true }
  });
  ctx.window = ctx;

  ctx.fetch = function (url, opts) {
    opts = opts || {};
    calls.push({ url: url, method: opts.method || 'GET' });

    if (/\/auth\/v1\/token\?grant_type=password/.test(url)) {
      return respond({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600,
        user: { id: MEMBER, email: 'm@example.com' } });
    }
    if (/\/rest\/v1\/vaad_members\?select=owner_id&member_id=eq\./.test(url)) {
      return respond(membershipRow ? [{ owner_id: membershipRow }] : []);
    }
    if (/\/rest\/v1\/vaad_state\?select=data,updated_at&user_id=eq\./.test(url)) {
      return respond([]);   // אין עדיין שורה בענן בתרחישי הטסט האלה
    }
    if (/\/rest\/v1\/vaad_state\?on_conflict=user_id/.test(url)) {
      return respond([{ updated_at: '2026-01-01T00:00:00Z' }]);
    }
    if (/\/rest\/v1\/rpc\/accept_invite/.test(url)) {
      return respond(OWNER);   // הפונקציה מחזירה את מזהה הבעלים
    }
    if (/\/rest\/v1\/vaad_members\?member_id=eq\./.test(url) && opts.method === 'DELETE') {
      return respond([]);
    }
    return respond([]);
  };

  function respond(body) {
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) });
  }

  for (const f of ['js/config.js', 'js/store.js', 'js/cloud.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
  }
  // הטסטים האלה בודקים את מנגנון השותפות עצמו, לא את דגל היכולת
  // (Features.sharedCommittee, כבוי כברירת מחדל — ראו js/config.js)
  ctx.Features.sharedCommittee = true;
  return { ctx: ctx, calls: calls };
}

function urlsFor(calls, path) {
  return calls.filter(function (c) { return c.url.indexOf(path) > -1; }).map(function (c) { return c.url; });
}

test('an account with no membership syncs its own row', () => {
  const { ctx, calls } = setup(null);
  return ctx.Cloud.signIn('m@example.com', 'secret123').then(function () {
    const pulls = urlsFor(calls, '/rest/v1/vaad_state?select=data,updated_at');
    assert.ok(pulls.length > 0, 'a pull should have happened');
    assert.ok(pulls.every(function (u) { return u.indexOf('user_id=eq.' + MEMBER) > -1; }),
      'with no membership row, the member is its own owner');
    assert.equal(ctx.Cloud.isMember(), false);
  });
});

test("a member's sync targets the owner's row, not their own", () => {
  const { ctx, calls } = setup(OWNER);
  return ctx.Cloud.signIn('m@example.com', 'secret123').then(function () {
    const pulls = urlsFor(calls, '/rest/v1/vaad_state?select=data,updated_at');
    assert.ok(pulls.length > 0, 'a pull should have happened');
    assert.ok(pulls.every(function (u) { return u.indexOf('user_id=eq.' + OWNER) > -1; }),
      'a member pulls the owner\'s data, never their own id');
    assert.equal(ctx.Cloud.isMember(), true);
    assert.equal(ctx.Store.currentOwner(), OWNER, "the device's active slot is the owner's, so the shared data lands in one place");
  });
});

test('accepting an invite switches the device to the owner\'s slot and row', () => {
  const { ctx, calls } = setup(null);   // מתחילים כבעלים של עצמם
  return ctx.Cloud.signIn('m@example.com', 'secret123').then(function () {
    assert.equal(ctx.Store.currentOwner(), MEMBER);
    calls.length = 0;
    return ctx.Cloud.acceptInvite('some-token');
  }).then(function () {
    assert.equal(ctx.Cloud.isMember(), true);
    assert.equal(ctx.Store.currentOwner(), OWNER);
    const pulls = urlsFor(calls, '/rest/v1/vaad_state?select=data,updated_at');
    assert.ok(pulls.length > 0 && pulls.every(function (u) { return u.indexOf('user_id=eq.' + OWNER) > -1; }),
      'after accepting, sync reads the owner\'s row');
  });
});

test('leaving a shared vaad switches back to the member\'s own row', () => {
  const { ctx, calls } = setup(OWNER);   // מצטרפים כשותפים מההתחלה
  return ctx.Cloud.signIn('m@example.com', 'secret123').then(function () {
    assert.equal(ctx.Store.currentOwner(), OWNER);
    calls.length = 0;
    return ctx.Cloud.leaveShared();
  }).then(function () {
    assert.equal(ctx.Cloud.isMember(), false);
    assert.equal(ctx.Store.currentOwner(), MEMBER);
    const deletes = calls.filter(function (c) {
      return c.method === 'DELETE' && c.url.indexOf('vaad_members') > -1 && c.url.indexOf('member_id=eq.' + MEMBER) > -1;
    });
    assert.ok(deletes.length > 0, 'leaving removes the membership row for this account');
    const pulls = urlsFor(calls, '/rest/v1/vaad_state?select=data,updated_at');
    assert.ok(pulls.every(function (u) { return u.indexOf('user_id=eq.' + MEMBER) > -1; }),
      'after leaving, sync reads the member\'s own row again');
  });
});

test('createInvite is refused for someone who is themselves a member', () => {
  const { ctx } = setup(OWNER);
  return ctx.Cloud.signIn('m@example.com', 'secret123').then(function () {
    return assert.rejects(ctx.Cloud.createInvite());
  });
});

test('the whole feature is blocked while its flag is off, not just hidden from the menu', () => {
  const { ctx } = setup(null);
  ctx.Features.sharedCommittee = false;   // ברירת המחדל האמיתית — כבוי
  return ctx.Cloud.signIn('m@example.com', 'secret123').then(function () {
    assert.equal(ctx.Cloud.partnersEnabled(), false);
    return Promise.all([
      assert.rejects(ctx.Cloud.createInvite()),
      assert.rejects(ctx.Cloud.acceptInvite('some-token')),
      ctx.Cloud.inviteInfo('some-token').then(function (info) {
        assert.equal(info, null, 'a token lookup is a no-op while the flag is off, not a real RPC call');
      })
    ]);
  });
});
