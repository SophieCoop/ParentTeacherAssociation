/* ============================================================
   חשבון וסנכרון — התחברות, מצב הסנכרון והכרעה בהתנגשות
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.account = (function () {

  var conflictOpen = false;

  /* ---------- שבב מצב קטן ---------- */
  function chipHTML() {
    var i = Cloud.info();
    if (!i.enabled) return '';
    return '<button id="sync-chip" class="badge ' + i.tone + '" data-action="acc-open" ' +
      'style="border:none;cursor:pointer">' + i.icon + ' ' + UI.esc(i.text) + '</button>';
  }

  /* מעדכן את השבב במקום, בלי לצייר מחדש את כל המסך */
  function refreshChip() {
    var el = document.getElementById('sync-chip');
    if (el) {
      var i = Cloud.info();
      el.className = 'badge ' + i.tone;
      el.textContent = i.icon + ' ' + i.text;
    }
    var panel = document.getElementById('sync-panel');
    if (panel) panel.innerHTML = panelInner();
    if (Cloud.info().status === 'conflict' && !conflictOpen) showConflict();
  }

  /* ---------- לוח מצב מלא (בהגדרות) ---------- */
  function panelInner() {
    var i = Cloud.info();

    if (!i.enabled) {
      return '<p class="small muted mb0">הסנכרון כבוי. הנתונים נשמרים במכשיר הזה בלבד.</p>';
    }

    if (!i.signedIn) {
      return '<p class="small muted">כרגע הנתונים נשמרים במכשיר הזה בלבד. ' +
        'התחברות מאפשרת לראות ולערוך אותם גם מהטלפון וגם מהמחשב, ומשמשת גם כגיבוי.</p>' +
        (i.error ? '<div class="note" style="background:#FDF0F2"><div class="n-ico">⚠️</div><div>' + UI.esc(i.error) + '</div></div>' : '') +
        '<div class="btn-row mt">' +
          '<button class="btn ghost" data-action="acc-signup">פתיחת חשבון</button>' +
          '<button class="btn" data-action="acc-signin">התחברות</button>' +
        '</div>';
    }

    var when = i.lastSyncAt ? new Date(i.lastSyncAt) : null;
    return '<div class="row" style="box-shadow:none;background:#FAF8FD">' +
        '<div class="r-ico" style="background:#fff">' + i.icon + '</div>' +
        '<div class="r-body"><div class="r-name">' + UI.esc(i.text) + '</div>' +
        '<div class="r-sub">' + UI.esc(i.email || '') + '</div></div>' +
      '</div>' +
      (when ? '<div class="hint">סונכרן לאחרונה: ' + when.toLocaleString('he-IL') + '</div>' : '') +
      (i.error ? '<div class="note" style="background:#FDF0F2;margin-top:10px"><div class="n-ico">⚠️</div><div>' +
                 UI.esc(i.error) + '</div></div>' : '') +
      '<div class="btn-row mt">' +
        '<button class="btn ghost" data-action="acc-signout">התנתקות</button>' +
        '<button class="btn" data-action="acc-sync">סנכרון עכשיו</button>' +
      '</div>';
  }

  function panel() {
    return '<div class="card">' +
      '<div class="card-title"><h2>סנכרון בין מכשירים</h2></div>' +
      '<div id="sync-panel">' + panelInner() + '</div>' +
      '</div>';
  }

  /* ---------- טופס התחברות / הרשמה ---------- */
  function authForm(mode) {
    var isSignup = mode === 'signup';
    UI.formModal({
      title: isSignup ? 'פתיחת חשבון' : 'התחברות',
      subtitle: isSignup
        ? 'החשבון משמש לסנכרון בין המכשירים שלך ולגיבוי'
        : 'התחברות עם החשבון הקיים כדי למשוך את הנתונים',
      submitLabel: isSignup ? 'פתיחת חשבון' : 'התחברות',
      fields: [
        { name: 'email', label: 'אימייל', type: 'email', required: true, placeholder: 'dana@example.com' },
        { name: 'password', label: 'סיסמה', type: 'password', required: true,
          placeholder: '••••••', hint: isSignup ? 'לפחות 6 תווים' : '' }
      ],
      onSubmit: function (v, close) {
        UI.toast(isSignup ? 'פותח חשבון…' : 'מתחבר…');
        var p = isSignup ? Cloud.signUp(v.email, v.password) : Cloud.signIn(v.email, v.password);
        p.then(function (res) {
          close();
          if (isSignup && res && res.confirmed === false) {
            UI.modal({
              title: 'כמעט סיימנו 📬',
              subtitle: 'שלחנו מייל אישור לכתובת ' + v.email,
              body: '<p class="small">צריך ללחוץ על הקישור במייל כדי להפעיל את החשבון, ואז לחזור לכאן ולהתחבר.</p>' +
                    '<button class="btn mt" data-action="acc-signin">להתחברות</button>'
            });
            return;
          }
          App.render();
          UI.toast('מחוברים ✓ הנתונים מסונכרנים');
        }, function (err) {
          UI.toast(err && err.message ? err.message : 'ההתחברות נכשלה');
        });
        return false;   // הסגירה מתבצעת רק אחרי תשובת השרת
      }
    });
  }

  /* ---------- הכרעה בהתנגשות ---------- */
  function summarize(data) {
    if (!data) return '—';
    var n = function (a) { return (a || []).length; };
    return n(data.children) + ' ילדים · ' + n(data.payments) + ' תשלומים · ' +
           n(data.expenses) + ' הוצאות · ' + n(data.budgetItems) + ' סעיפי תקציב';
  }

  function showConflict() {
    var c = Cloud.getConflict();
    if (!c) return;
    conflictOpen = true;

    UI.modal({
      title: 'שתי גרסאות שונות',
      subtitle: 'הנתונים השתנו גם במכשיר הזה וגם במכשיר אחר',
      body:
        '<p class="small">כדי לא למחוק שום דבר בטעות — בחרי איזו גרסה לשמור. ' +
        'הגרסה שלא תיבחר תוחלף.</p>' +
        '<div class="row" style="box-shadow:none;background:var(--blue);margin-top:12px">' +
          '<div class="r-ico" style="background:#fff">📱</div>' +
          '<div class="r-body"><div class="r-name">המכשיר הזה</div>' +
          '<div class="r-sub" style="color:inherit;opacity:.8;white-space:normal">' + UI.esc(summarize(c.local)) + '</div></div>' +
        '</div>' +
        '<div class="row" style="box-shadow:none;background:var(--green)">' +
          '<div class="r-ico" style="background:#fff">☁️</div>' +
          '<div class="r-body"><div class="r-name">הגרסה בענן</div>' +
          '<div class="r-sub" style="color:inherit;opacity:.8;white-space:normal">' + UI.esc(summarize(c.remote)) +
          (c.at ? ' · ' + new Date(c.at).toLocaleString('he-IL') : '') + '</div></div>' +
        '</div>' +
        '<div class="btn-row mt">' +
          '<button class="btn ghost js-keep-local">לשמור את המכשיר הזה</button>' +
          '<button class="btn js-keep-cloud">לטעון מהענן</button>' +
        '</div>',
      onMount: function (root, close) {
        root.querySelector('.js-keep-local').addEventListener('click', function () {
          conflictOpen = false; close();
          Cloud.resolveConflict('local').then(function () { UI.toast('הגרסה מהמכשיר הועלתה ✓'); });
        });
        root.querySelector('.js-keep-cloud').addEventListener('click', function () {
          conflictOpen = false; close();
          Cloud.resolveConflict('cloud').then(function () { App.render(); UI.toast('נטענה הגרסה מהענן ✓'); });
        });
      }
    });
  }

  return {
    chipHTML: chipHTML, refreshChip: refreshChip, panel: panel, showConflict: showConflict,
    actions: {
      'acc-signin':  function () { authForm('signin'); },
      'acc-signup':  function () { authForm('signup'); },
      'acc-signout': function () {
        UI.confirmBox('להתנתק?', 'הנתונים יישארו על המכשיר הזה, אבל יפסיקו להסתנכרן.', function () {
          Cloud.signOut();
          App.render();
          UI.toast('התנתקת');
        });
      },
      'acc-sync': function () {
        UI.toast('מסנכרן…');
        Cloud.sync(true).then(function () {
          var i = Cloud.info();
          if (i.status === 'synced') UI.toast('הכל מסונכרן ✓');
          else if (i.status === 'conflict') showConflict();
          else if (i.error) UI.toast(i.error);
        });
      },
      'acc-open': function () {
        var i = Cloud.info();
        if (i.status === 'conflict') { showConflict(); return; }
        App.setView('settings');
      }
    }
  };
})();
