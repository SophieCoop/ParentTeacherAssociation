/* ============================================================
   הצטרפות לוועד דרך קישור הזמנה — js/views/settings.js יוצר את
   הקישור (Cloud.createInvite), וכאן הוא נפתח אצל המוזמן/ת
   ------------------------------------------------------------
   הטוקן מגיע בפרמטר ?invite= בכתובת. הוא נשמר במכשיר (לא רק
   בכתובת) כי אישור מייל עשוי לקחת זמן: מי שפותח חשבון חדש דרך
   ההזמנה צריך את הטוקן גם אחרי חזרה מהקישור שבמייל, לא רק ברגע
   שבו הקישור נלחץ. Cloud.signUp קורא אותו מכאן (js/cloud.js,
   signUpRedirect) ומצרף אותו לכתובת שאליה חוזר קישור האישור.

   המסך הזה קודם לאשף ההקמה ולמסך הבית כאחד (App.render): מי שמגיע
   עם הזמנה פתוחה אמור להחליט עליה לפני שהוא רואה כל דבר אחר —
   גם אם יש לו כבר גן משלו במכשיר הזה.
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.join = (function () {

  var PENDING_KEY = 'vaad-gan-pending-invite-v1';

  /* cache — תוצאת הבדיקה מול השרת לטוקן הנוכחי, כדי שלא נשאל שוב
     על כל ציור מחדש של המסך */
  var cache = { token: '', info: null, loading: false, error: '' };

  function readPending() {
    try { return localStorage.getItem(PENDING_KEY) || ''; } catch (e) { return ''; }
  }
  function writePending(token) {
    try {
      if (token) localStorage.setItem(PENDING_KEY, token);
      else localStorage.removeItem(PENDING_KEY);
    } catch (e) {}
  }

  /* דגל היכולת — ראו js/config.js, Features.sharedCommittee. כל עוד
     הוא כבוי, קישור הזמנה לא נתפס ולא נשמר כלל: מי שפותח אותו רואה
     את האפליקציה הרגילה, לא מסך הצטרפות חצי-עובד. */
  function enabled() {
    return typeof Cloud !== 'undefined' && Cloud.partnersEnabled && Cloud.partnersEnabled();
  }

  /* נקרא פעם אחת מ-App.init, לפני ש-Cloud.init קורא את שאר הכתובת —
     כך שגם טוקן שמצטרף לקישור האישור (חוזר כפרמטר רגיל בכתובת, לא
     אחרי ה-#) נתפס באותה דרך כמו הקישור המקורי */
  function init() {
    if (!enabled()) return;
    try {
      var m = (location.search || '').match(/[?&]invite=([^&]+)/);
      if (!m) return;
      writePending(decodeURIComponent(m[1]));
      history.replaceState(null, document.title, location.pathname + location.hash);
    } catch (e) {}
  }

  function pendingToken() { return readPending(); }
  function active() { return enabled() && !!readPending(); }

  function clearPending() {
    writePending('');
    cache = { token: '', info: null, loading: false, error: '' };
  }

  /* ---------- בדיקת ההזמנה מול השרת ---------- */
  function load() {
    var token = pendingToken();
    if (!token || cache.token === token) return;
    cache = { token: token, info: null, loading: true, error: '' };
    Cloud.inviteInfo(token).then(function (info) {
      if (cache.token !== token) return;   // בינתיים נמחק או התחלף
      cache.loading = false;
      cache.info = info;
      App.render();
    }, function (err) {
      if (cache.token !== token) return;
      cache.loading = false;
      cache.error = (err && err.message) || 'לא הצלחנו לבדוק את ההזמנה';
      App.render();
    });
  }

  function render() {
    load();
    var token = pendingToken();

    if (cache.loading || cache.token !== token) {
      return '<div class="splash"><div class="art">💌</div><p>בודקים את ההזמנה…</p></div>';
    }

    if (cache.error || !cache.info || !cache.info.valid) {
      return '<div class="splash"><div class="art">⚠️</div><h1>הקישור לא בתוקף</h1>' +
        '<p>' + UI.esc(cache.error ||
          'ההזמנה כבר נוצלה, בוטלה, או שפג תוקפה. אפשר לבקש קישור חדש ממי ששלח/ה אותה.') +
        '</p>' +
        '<button class="btn" data-action="join-dismiss">המשך לאפליקציה</button></div>';
    }

    var ganName = cache.info.gan_name || 'הגן';
    var intro = '<p>הוזמנת/ה להיות שותפ/ה בוועד של <b>' + UI.esc(ganName) + '</b>. ' +
      'מרגע ההצטרפות שניכם רואים ועורכים יחד את אותם הנתונים.</p>';

    if (Cloud.signedIn()) {
      return '<div class="splash"><div class="art">🤝</div><h1>הצטרפות לוועד</h1>' + intro +
        '<div class="note" style="max-width:360px;text-align:start"><div class="n-ico">ℹ️</div><div>' +
          'מה שמוצג כרגע במכשיר הזה יוחלף בנתוני הגן המשותף. הנתונים הקודמים שלך לא נמחקים — ' +
          'הם נשארים בחשבון שלך, ואפשר לחזור אליהם מהגדרות ⚙️ ← עזיבת הוועד המשותף.' +
        '</div></div>' +
        '<button class="btn mt" data-action="join-accept">הצטרפות</button>' +
        '<button class="linkbtn" style="margin-top:12px" data-action="join-dismiss">לא עכשיו</button></div>';
    }

    return '<div class="splash"><div class="art">🤝</div><h1>הצטרפות לוועד</h1>' + intro +
      '<p class="small muted">כדי להמשיך, פותחים חשבון או מתחברים לחשבון קיים.</p>' +
      '<button class="btn" data-action="join-signup">פתיחת חשבון</button>' +
      '<button class="btn soft mt" data-action="join-signin">יש לי כבר חשבון — התחברות</button>' +
      '<button class="linkbtn" style="margin-top:14px" data-action="join-dismiss">לא עכשיו</button></div>';
  }

  return {
    init: init, render: render, active: active, pendingToken: pendingToken,
    actions: {
      /* הטפסים עצמם יושבים ב-js/views/account.js — אחרי שהם מצליחים
         הם קוראים ל-App.render, והטוקן עדיין ממתין אז המסך הזה חוזר
         ומציג את צעד ההצטרפות, הפעם כשכבר מחוברים */
      'join-signup': function () { Views.account.actions['acc-signup'](); },
      'join-signin': function () { Views.account.actions['acc-signin'](); },
      'join-dismiss': function () { clearPending(); App.render(); },
      'join-accept': function () {
        var token = pendingToken();
        UI.toast('מצטרפים…');
        Cloud.acceptInvite(token).then(function () {
          clearPending();
          App.render();
          UI.toast('הצטרפת לוועד ✓');
        }, function (err) {
          UI.toast((err && err.message) || 'ההצטרפות נכשלה');
        });
      }
    }
  };
})();
