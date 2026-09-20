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
      /* חשבון שנפתח וממתין לאישור אינו "לא מחובר" סתם: יש כאן משימה
         פתוחה שחוסמת את הגיבוי, ולכן היא מוצגת ככזו ולא כהצעה לפתוח
         חשבון נוסף. זו גם הדרך להגיע לכאן אחרי "לא להציג שוב"
         שבתזכורת (js/confirm.js). */
      var waiting = (window.Confirm && Confirm.pending()) || null;
      if (waiting) {
        return '<div class="note" style="background:#FDF0F2"><div class="n-ico">📬</div><div>' +
            '<b>החשבון ממתין לאישור במייל</b>' +
            'פתחנו חשבון עבור <span class="mail">' + UI.esc(waiting.email) + '</span>, ' +
            'אבל עד שלא לוחצים על הקישור שנשלח אליו הנתונים נשמרים במכשיר הזה בלבד. ' +
            'אם המייל לא נמצא — כדאי לחפש בספאם או ב"קידומי מכירות".' +
          '</div></div>' +
          (i.error ? '<div class="note" style="background:#FDF0F2;margin-top:10px"><div class="n-ico">⚠️</div><div>' + UI.esc(i.error) + '</div></div>' : '') +
          '<div class="btn-row mt">' +
            '<button class="btn ghost" data-action="acc-resend">שליחת המייל שוב</button>' +
            '<button class="btn" data-action="acc-signin">כבר אישרתי — התחברות</button>' +
          '</div>';
      }

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
  /* ---------- שליחת מייל האישור מחדש ---------- */
  /* המייל לפעמים לא מגיע — נחסם, נופל לספאם או נמחק בטעות. כאן אפשר
     לבקש אותו שוב בלי לפתוח חשבון חדש ובלי לזכור את הסיסמה */
  function resendForm(email) {
    UI.formModal({
      title: 'שליחת מייל האישור מחדש',
      subtitle: 'נשלח קישור אישור חדש. הקישור הקודם יפסיק לעבוד',
      submitLabel: 'שליחה',
      fields: [
        { name: 'email', label: 'אימייל', type: 'email', required: true,
          value: email || '', placeholder: 'dana@example.com',
          hint: 'אותה כתובת שאיתה נפתח החשבון' }
      ],
      onSubmit: function (v, close) {
        UI.toast('שולח…');
        Cloud.resendConfirm(v.email).then(function () {
          close();
          UI.modal({
            title: 'המייל נשלח 📬',
            body: '<div class="state-box" role="status" aria-live="polite">' +
                    '<div class="state-ico info">📬</div>' +
                    '<b>שלחנו קישור חדש</b>' +
                    '<p>אל <span class="mail">' + UI.esc(v.email) + '</span><br>' +
                    'הקישור מחזיר ישר לאפליקציה ומאשר את החשבון.</p>' +
                  '</div>' +
                  '<div class="note"><div class="n-ico">💡</div><div>' +
                  'לא רואים אותו? כדאי לבדוק בתיקיית הספאם או ב"קידומי מכירות", ' +
                  'ולחפש את הכתובת ששלחה את המייל הקודם.' +
                  '</div></div>'
          });
        }, function (err) {
          UI.toast(err && err.message ? err.message : 'השליחה נכשלה');
        });
        return false;   // נסגר רק אחרי תשובת השרת
      }
    });
  }

  function notConfirmed(err) {
    return !!err && (err.code === 'email_not_confirmed' ||
                     /not confirmed|לאשר את המייל/i.test(err.message || ''));
  }

  /* הצעה לשלוח שוב — מוצגת כשההתחברות נכשלת כי החשבון עוד לא אושר */
  function notConfirmedBox(email) {
    UI.modal({
      title: 'החשבון עוד לא אושר',
      subtitle: 'צריך ללחוץ על הקישור שבמייל האישור',
      body: '<p class="small">פתחנו את החשבון, אבל האישור במייל עדיין לא בוצע. ' +
            'אם המייל לא הגיע — אפשר לשלוח אותו שוב.</p>' +
            '<button class="btn mt js-resend">שליחת המייל שוב</button>',
      onMount: function (root, close) {
        root.querySelector('.js-resend').addEventListener('click', function () {
          close(); resendForm(email);
        });
      }
    });
  }

  /* email — כתובת למלא מראש. מגיעה מהתזכורת לאישור המייל, שכבר
     יודעת באיזו כתובת נפתח החשבון */
  function authForm(mode, email) {
    var isSignup = mode === 'signup';
    UI.formModal({
      title: isSignup ? 'פתיחת חשבון' : 'התחברות',
      subtitle: isSignup
        ? 'החשבון משמש לסנכרון בין המכשירים שלך ולגיבוי'
        : 'התחברות עם החשבון הקיים כדי למשוך את הנתונים',
      submitLabel: isSignup ? 'פתיחת חשבון' : 'התחברות',
      fields: [
        { name: 'email', label: 'אימייל', type: 'email', required: true,
          value: email || '', placeholder: 'dana@example.com' },
        { name: 'password', label: 'סיסמה', type: 'password', required: true,
          placeholder: '••••••', hint: isSignup ? 'לפחות 6 תווים' : '' },
        { name: 'resend', type: 'html',
          html: '<button type="button" class="linkbtn js-resend">' +
                'מייל האישור לא הגיע? שליחה מחדש</button>' }
      ],
      onMount: function (root) {
        root.querySelector('.js-resend').addEventListener('click', function () {
          var f = root.querySelector('#f-email');
          resendForm(f ? f.value.trim() : '');
        });
      },
      onSubmit: function (v, close) {
        UI.toast(isSignup ? 'פותח חשבון…' : 'מתחבר…');
        var p = isSignup ? Cloud.signUp(v.email, v.password) : Cloud.signIn(v.email, v.password);
        p.then(function (res) {
          close();
          if (isSignup && res && res.confirmed === false) {
            UI.modal({
              title: 'כמעט סיימנו 📬',
              subtitle: 'שלחנו מייל אישור לכתובת ' + v.email,
              body: '<p class="small">צריך ללחוץ על הקישור שבמייל כדי להפעיל את החשבון.</p>' +
                    '<div class="note"><div class="n-ico">💡</div><div>' +
                    '<b>הקישור מחזיר ישר לאפליקציה</b> ומציג הודעת אישור. ' +
                    'אם המייל נפתח בטלפון — האישור יתבצע שם, ואפשר להמשיך לעבוד מכל מכשיר.' +
                    '</div></div>' +
                    '<button class="btn mt js-retry">כבר אישרתי — התחברות</button>' +
                    '<button class="btn soft js-resend" style="margin-top:9px">' +
                    'המייל לא הגיע? שליחה שוב</button>',
              onMount: function (root2, close2) {
                root2.querySelector('.js-resend').addEventListener('click', function () {
                  close2(); resendForm(v.email);
                });
                root2.querySelector('.js-retry').addEventListener('click', function () {
                  UI.toast('מתחבר…');
                  Cloud.signIn(v.email, v.password).then(function () {
                    close2();
                    App.render();
                    UI.toast('מחוברים ✓ הנתונים מסונכרנים');
                  }, function (err) {
                    if (notConfirmed(err)) { close2(); notConfirmedBox(v.email); return; }
                    UI.toast(err && err.message ? err.message : 'ההתחברות נכשלה');
                  });
                });
              }
            });
            return;
          }
          App.render();
          UI.toast('מחוברים ✓ הנתונים מסונכרנים');
          if (window.Analytics) Analytics.account(isSignup ? 'signup' : 'signin');
        }, function (err) {
          if (notConfirmed(err)) { close(); notConfirmedBox(v.email); return; }
          UI.toast(err && err.message ? err.message : 'ההתחברות נכשלה');
        });
        return false;   // הסגירה מתבצעת רק אחרי תשובת השרת
      }
    });
  }

  /* ---------- חזרה מקישור האישור שבמייל ---------- */
  /* res מגיע מ-Cloud.init: הצלחה מלאה, או קישור שפג תוקפו / כבר נוצל */
  function showAuthResult(res) {
    if (!res) return;

    if (res.ok) {
      var isSignup = res.type === 'signup' || res.type === 'invite';
      // אישור באמצע ההקמה — חוזרים לשלב שבו עצרנו, לא לעמוד הראשי
      var inSetup = !Store.state.setupDone;
      UI.modal({
        title: isSignup ? 'החשבון אושר 🎉' : 'ההתחברות הושלמה ✓',
        subtitle: '',
        body:
          '<div class="state-box" role="status" aria-live="polite">' +
            '<div class="state-ico">✓</div>' +
            '<b>' + (isSignup ? 'המייל אומת והחשבון פעיל' : 'זיהינו אותך') + '</b>' +
            '<p>' + (res.email ? '<span class="mail">' + UI.esc(res.email) + '</span><br>' : '') +
            (inSetup
              ? 'מכאן כל מה שתזיני בהמשך ההקמה נשמר בענן תוך כדי, וההקמה ממשיכה מהשלב שבו עצרת.'
              : 'מעכשיו כל שינוי נשמר בענן אוטומטית, ואפשר להמשיך לעבוד מהטלפון ומהמחשב.') +
            '</p>' +
          '</div>' +
          '<button class="btn mt js-go">' +
          (inSetup ? 'המשך בהקמה' : 'המשך לאפליקציה') + '</button>',
        onMount: function (root, close) {
          root.querySelector('.js-go').addEventListener('click', function () {
            close();
            App.render();
          });
        }
      });
      if (window.Analytics) Analytics.account('confirmed');
      return;
    }

    /* לחיצה שנייה על אותו קישור נכשלת תמיד — הוא חד־פעמי. אם המכשיר
       כבר מחובר, האישור פשוט הצליח בלחיצה הקודמת ואין כאן תקלה */
    if (Cloud.signedIn()) {
      UI.modal({
        title: 'הכול כבר מאושר ✓',
        body: '<div class="state-box"><div class="state-ico">✓</div>' +
                '<b>החשבון פעיל וההתחברות קיימת</b>' +
                '<p>קישור האישור הוא חד־פעמי, ולכן לחיצה נוספת עליו לא עובדת. ' +
                'אין צורך לעשות דבר — אפשר להמשיך לעבוד.</p>' +
              '</div>' +
              '<button class="btn mt js-go">המשך לאפליקציה</button>',
        onMount: function (root, close) {
          root.querySelector('.js-go').addEventListener('click', close);
        }
      });
      return;
    }

    // כישלון — ברוב המקרים קישור ישן. אין טעם לשלוח לנסות שוב את אותו קישור
    var expired = /expired|otp_expired/i.test(res.code || '') ||
                  /expired/i.test(res.message || '');
    UI.modal({
      title: expired ? 'הקישור כבר לא בתוקף' : 'האישור לא הושלם',
      subtitle: expired ? 'קישורי אישור תקפים לזמן מוגבל' : '',
      body:
        '<p class="small">' +
        (expired
          ? 'הקישור שבמייל פג תוקף או שכבר נעשה בו שימוש. אפשר פשוט להתחבר עם האימייל והסיסמה שבחרת — ואם החשבון עדיין לא אושר, נשלח מייל חדש.'
          : 'משהו השתבש בדרך חזרה מהמייל. אפשר להתחבר ידנית עם האימייל והסיסמה.') +
        '</p>' +
        // הודעת השרת מגיעה באנגלית — מציגים אותה רק כשאין לנו הסבר טוב ממנה
        (!expired && res.message ? '<div class="hint">' + UI.esc(res.message) + '</div>' : '') +
        '<div class="btn-row mt">' +
          '<button class="btn ghost js-signin">התחברות</button>' +
          '<button class="btn js-resend">שליחת קישור חדש</button>' +
        '</div>',
      onMount: function (root, close) {
        root.querySelector('.js-signin').addEventListener('click', function () {
          close(); authForm('signin');
        });
        root.querySelector('.js-resend').addEventListener('click', function () {
          close(); resendForm('');
        });
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
    showAuthResult: showAuthResult, resendForm: resendForm,
    /* טופס ההתחברות, עם כתובת ידועה מראש — לשימוש התזכורת שב-confirm.js */
    signInForm: function (email) { authForm('signin', email); },
    actions: {
      'acc-signin':  function () {
        var w = (window.Confirm && Confirm.pending()) || null;
        authForm('signin', w ? w.email : '');
      },
      'acc-resend':  function () {
        var w = (window.Confirm && Confirm.pending()) || null;
        resendForm(w ? w.email : '');
      },
      'acc-signup':  function () { authForm('signup'); },
      /* התנתקות כדי להקים גן אחר, או כדי למסור את המכשיר, אינה אותו
         דבר כמו יציאה זמנית מהחשבון. הנתונים נשארו כאן תמיד, ואיתם
         setupDone — ולכן מי שהתנתק כדי להתחיל מחדש נחת בעמוד הבית של
         הגן הקודם בלי דרך חזרה לאשף. שתי הכוונות מקבלות כפתור משלהן. */
      /* ההתנתקות מחנה את הגן של החשבון במכשיר ומפנה אותו לחשבון הבא,
         ולכן אין בה עוד הכרעה — מי שבאמת רוצה למחוק הכול לפני מסירת
         מכשיר עושה זאת מ"מחיקת כל הנתונים" שבהגדרות. */
      'acc-signout': function () {
        UI.confirmBox('להתנתק?',
          Lang.t('parkedOnDevice') + ' ' + Lang.t('freeForNew'),
          function () {
            Cloud.signOut();
            App.render();
            UI.toast('התנתקת');
          },
          'התנתקות');
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
