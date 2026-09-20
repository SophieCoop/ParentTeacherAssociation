/* ============================================================
   תזכורת לאישור המייל — חלון שקופץ אחרי כמה כניסות
   ------------------------------------------------------------
   פתיחת חשבון שדורשת אישור מייל אינה עוצרת את ההקמה: המייל נשלח
   וממשיכים הלאה (ראו js/views/onboarding.js). זו החלטה נכונה —
   אבל היא משאירה מצב שקט ומסוכן: החשבון נפתח, המשתמש ממשיך
   להזין ילדים, תקציב וגבייה, וכל זה יושב במכשיר בלבד. עד
   שהקישור שבמייל לא נלחץ אין סשן, אין סנכרון ואין גיבוי — ומחיקת
   הדפדפן או החלפת מכשיר מוחקת הכול.

   המייל עצמו נוטה להיעלם: הוא נוחת בספאם או ב"קידומי מכירות",
   נקבר תחת מיילים חדשים, או פשוט נשכח. לכן אחרי חמש כניסות
   לאפליקציה החלון הזה מזכיר שהאישור ממתין, מכוון לחפש בספאם,
   ומציע לשלוח את המייל שוב או להתחבר למי שכבר אישר במכשיר אחר.

   מה נחשב כניסה: אותה הגדרה בדיוק שבהצעה להוסיף למסך הבית —
   פתיחה של האתר, כשטעינות חוזרות בתוך חצי שעה הן אותה כניסה.
   המונה משותף לשתיהן (Install.visits), כדי שלא תהיינה שתי
   ספירות שונות לאותו דבר.

   "אולי אחר כך" מרחיק את התזכורת בחמש כניסות; "לא להציג שוב"
   מכבה אותה. ברגע שהאישור מגיע — הרשומה שב-Cloud נמחקת מאליה
   והתזכורת נעלמת בלי שיידרש דבר.

   וחשוב מכל: מי שכבר אישר לא רואה אותה לעולם. Cloud שומר גם רישום
   חיובי של הכתובות שידוע שאושרו, ולא רק מוחק את הממתינה — כי יש
   מסלולים שבהם האישור הצליח ובכל זאת אין סשן במכשיר הזה (לחיצה
   שנייה על הקישור החד־פעמי, נפילת רשת אחרי שהטוקן התקבל, או אישור
   שנעשה במכשיר אחר).
   ============================================================ */
var Confirm = (function () {

  var KEY = 'vaad-gan-confirm-v1';
  var SHOW_AT = 5;    // הכניסה שבה התזכורת מופיעה לראשונה
  var SNOOZE  = 5;    // כמה כניסות ממתינים אחרי "אולי אחר כך"

  var shown = false;  // הוצגה פעם אחת בטעינה הזו, גם אם המסך צויר מחדש
  var box = null;

  /* ---------- זיכרון ---------- */
  /* בלי localStorage אי אפשר לזכור דחייה, ולכן גם לא מזכירים —
     תזכורת שחוזרת בכל טעינה גרועה מתזכורת שלא הופיעה כלל */
  function read() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { next: parseInt(o.next, 10) || SHOW_AT, off: !!o.off };
    } catch (e) {
      return { next: SHOW_AT, off: true };
    }
  }

  function write(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }

  function silence() { var s = read(); s.off = true; write(s); }

  function snooze() {
    var s = read();
    s.next = visits() + SNOOZE;
    write(s);
  }

  function visits() {
    return (window.Install && Install.visits) ? Install.visits() : 0;
  }

  /* ---------- האם יש בכלל אישור שממתין ---------- */
  /* התזכורת קופצת אך ורק כשהמייל באמת טרם אושר. שלוש שכבות מבטיחות
     זאת: מי שמחובר כבר עבר את האישור; Cloud.pendingSignup מחזיר null
     לכתובת שרשומה אצלו כמאושרת (גם כשאין סשן במכשיר הזה); והרשומה
     עצמה נמחקת בכל סשן תקף. */
  function pending() {
    if (!window.Cloud || !Cloud.enabled() || Cloud.signedIn()) return null;
    return Cloud.pendingSignup ? Cloud.pendingSignup() : null;
  }

  /* ---------- החלון ---------- */
  function body(email) {
    return '<div class="state-box" role="status" aria-live="polite">' +
        '<div class="state-ico info">📬</div>' +
        '<b>המייל מחכה לכם</b>' +
        '<p>שלחנו קישור אישור אל<br><span class="mail">' + UI.esc(email) + '</span></p>' +
      '</div>' +
      '<div class="note" style="background:#FDF0F2"><div class="n-ico">⚠️</div><div>' +
        '<b>עד שלא לוחצים עליו, הנתונים יושבים במכשיר הזה בלבד</b>' +
        'כל מה שהזנתם — ילדים, תקציב, גבייה והוצאות — עדיין לא מגובה בענן. ' +
        'ניקוי של הדפדפן או מעבר למכשיר אחר ימחקו את הכול.' +
      '</div></div>' +
      '<div class="note"><div class="n-ico">🔎</div><div>' +
        '<b>לא מוצאים את המייל?</b>' +
        'כדאי לחפש בתיקיית הספאם / "דואר זבל", ובג׳ימייל גם בלשונית ' +
        '"קידומי מכירות". אם הוא שם — כדאי לסמן אותו כ"לא ספאם", ' +
        'כדי שגם המיילים הבאים יגיעו.' +
      '</div></div>' +
      '<button class="btn mt js-resend">שליחת המייל שוב</button>' +
      '<button class="btn soft js-signin" style="margin-top:9px">כבר אישרתי — התחברות</button>' +
      '<button class="linkbtn js-forgot" style="margin-top:11px">שכחתי את הסיסמה</button>' +
      '<div class="inst-foot">' +
        '<button class="btn ghost js-later">אולי אחר כך</button>' +
        '<button class="inst-never js-never">לא להציג שוב</button>' +
      '</div>';
  }

  /* auto — נפתח מאליו אחרי ספירת הכניסות, ולא בלחיצה של המשתמש.
     הדחייה נרשמת מיד עם הפתיחה, ולכן סגירה שקטה (✕, רקע, Escape)
     אינה מחזירה את החלון בטעינה הבאה. */
  function open(auto) {
    var p = pending();
    if (!p) return;
    if (box && box.isOpen && box.isOpen()) return;
    if (auto) snooze();

    box = UI.modal({
      title: 'כמעט סיימנו — נשאר לאשר את המייל 📬',
      subtitle: 'האישור הוא מה שמפעיל את החשבון ומתחיל לשמור את הנתונים בענן',
      body: body(p.email),
      onMount: function (root, close) {
        root.querySelector('.js-resend').addEventListener('click', function () {
          close();
          Views.account.resendForm(p.email);
          if (window.Analytics) Analytics.confirmReminder('resend');
        });
        root.querySelector('.js-signin').addEventListener('click', function () {
          close();
          Views.account.signInForm(p.email);
          if (window.Analytics) Analytics.confirmReminder('signin');
        });
        root.querySelector('.js-forgot').addEventListener('click', function () {
          close();
          Views.account.recoverForm(p.email);
          if (window.Analytics) Analytics.confirmReminder('signin');
        });
        root.querySelector('.js-later').addEventListener('click', function () {
          snooze();
          close();
          if (window.Analytics) Analytics.confirmReminder('later');
        });
        root.querySelector('.js-never').addEventListener('click', function () {
          silence();
          close();
          UI.toast('לא נזכיר שוב. אפשר לאשר בכל רגע מההגדרות ⚙️');
          if (window.Analytics) Analytics.confirmReminder('never');
        });
      }
    });

    if (window.Analytics) Analytics.confirmReminder(auto ? 'shown' : 'manual');
  }

  /* נקראת בכל ציור של מסך הבית; החלון עצמו נפתח פעם אחת בטעינה */
  function maybeRemind() {
    if (shown || !pending()) return;
    var s = read();
    if (s.off || visits() < s.next) return;
    if (!Store.state.setupDone) return;
    // סיור ההיכרות קודם — שני חלונות זה מעל זה הם חלון אחד שלא נקרא
    if (window.Tour && (Tour.running() || !Tour.seen())) return;

    shown = true;
    setTimeout(function () {
      if (document.querySelector('#modal-root .modal-back')) return;
      if (window.Tour && Tour.running()) return;
      open(true);
    }, 900);
  }

  return { maybeRemind: maybeRemind, open: open, pending: pending };
})();
