/* ============================================================
   הוספה למסך הבית — הצעה שמופיעה אחרי כמה כניסות
   ------------------------------------------------------------
   האתר עובד כאפליקציה ברגע שהוא יושב במסך הבית: פתיחה בלחיצה
   אחת, מסך מלא בלי סרגלי הדפדפן, ואייקון משלו. ההוספה עצמה
   נעשית בדפדפן, ולכן רוב העבודה כאן היא להסביר איפה הכפתור —
   וההסבר שונה בין אייפון, אנדרואיד ומחשב.

   מתי מציעים: פעם אחת בלבד, בכניסה העשירית. לא בכניסה הראשונה —
   מי שזה עתה הגיע עדיין לא יודע אם האתר מעניין אותו, והצעה להתקין
   אותו מיד היא הפרעה; ולא שוב אחר כך — מי שראה את ההצעה וסגר
   אותה ענה, והצעה שחוזרת היא נדנוד. אחרי שהוצגה היא כבויה לתמיד,
   וההוספה נשארת זמינה בכל רגע מההגדרות ⚙️.

   מה נחשב כניסה: פתיחה של האתר. טעינות חוזרות בתוך חצי שעה הן
   אותה כניסה, כדי שרענון של המסך לא יקרב את ההצעה.

   בכרום ובאדג׳ הדפדפן עצמו מציע התקנה דרך אירוע
   beforeinstallprompt. שם אין צורך בהוראות: החלון מציג כפתור
   שמפעיל את חלון ההתקנה של הדפדפן.
   ============================================================ */
var Install = (function () {

  var KEY = 'vaad-gan-install-v1';
  var SHOW_AT = 10;                      // הכניסה שבה ההצעה מופיעה — פעם אחת
  var SAME_VISIT_MS = 30 * 60 * 1000;    // טעינות בתוך חצי שעה — אותה כניסה
  /* הערך שהיה ב-next למי שההצעה כבר הוצגה לו בגרסה הקודמת, שבה היא
     חזרה כל שלוש כניסות. ראו seenBefore. */
  var LEGACY_SHOW_AT = 3;

  var deferred = null;    // אירוע ההתקנה של כרום, כל עוד לא נוצל
  var offered = false;    // הוצע פעם אחת בטעינה הזו, גם אם המסך צויר מחדש
  var box = null;         // החלון הפתוח, כדי לסגור אותו כשההתקנה הסתיימה

  /* ---------- זיכרון ---------- */
  /* בלי localStorage אי אפשר לזכור סירוב, ולכן גם לא מציעים —
     הצעה שחוזרת בכל טעינה גרועה מהצעה שלא הופיעה כלל */
  function read() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || '{}');
      return {
        visits: parseInt(o.visits, 10) || 0,
        last:   parseInt(o.last, 10) || 0,
        next:   parseInt(o.next, 10) || 0,
        off:    !!o.off
      };
    } catch (e) {
      return { visits: 0, last: 0, next: 0, off: true };
    }
  }

  function write(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }

  function silence() { var s = read(); s.off = true; write(s); }

  /* מי שההצעה כבר הוצגה לו בגרסה הקודמת — לפני שהיא הפכה לחד־פעמית.
     שם כל הצגה דחפה את next קדימה, ולכן ערך גדול מברירת המחדל הישנה
     מעיד שההצעה כבר נראתה. בלי זה, "פעם אחת" היה מופר בדיוק אצל מי
     שכבר ראה אותה כמה פעמים. */
  function seenBefore(s) { return s.next > LEGACY_SHOW_AT; }

  /* ---------- זיהוי המכשיר והדפדפן ---------- */
  var ua = (navigator.userAgent || '');
  /* אייפד שמציג את עצמו כמחשב (ברירת המחדל באייפד) מזוהה לפי המגע:
     מקינטוש אמיתי אינו מדווח על נקודות מגע */
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
              (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  var isAndroid = /Android/.test(ua);
  var isFirefox = /Firefox|FxiOS/.test(ua);
  var isEdge = /Edg\//.test(ua);
  /* בכל דפדפני האייפון יושב מנוע ספארי, אבל כפתור השיתוף יושב במקום
     אחר בכל אחד מהם — ולכן ההוראות מבחינות ביניהם */
  var iosOther = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  var isSafariDesktop = !isIOS && !isAndroid &&
                        /Safari/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);

  function standalone() {
    // האפליקציה שבחנויות כבר מותקנת, גם אם display-mode שלה הוא browser
    if (window.Native && Native.is()) return true;
    try {
      if (navigator.standalone) return true;                       // אייפון
      if (window.matchMedia &&
          (matchMedia('(display-mode: standalone)').matches ||
           matchMedia('(display-mode: minimal-ui)').matches ||
           matchMedia('(display-mode: fullscreen)').matches)) return true;
      if (document.referrer.indexOf('android-app://') === 0) return true;
    } catch (e) {}
    return false;
  }

  /* פיירפוקס במחשב אינו יודע להתקין אתרים, ואין לו מסך בית —
     הוראות שם היו שולחות את המשתמש לחפש כפתור שאינו קיים */
  function canInstall() {
    if (window.Native && Native.is()) return false;
    if (deferred) return true;
    if (isIOS || isAndroid) return true;
    if (isFirefox) return false;
    return true;   // כרום, אדג׳ וספארי במחשב — יש להם התקנה
  }

  /* ---------- מה קורה לנתונים אחרי ההוספה ---------- */
  /* באייפון (וכך גם באפליקציית ספארי במק) האפליקציה שבמסך הבית מקבלת
     אחסון נפרד מזה של הדפדפן: מה שנשמר במכשיר דרך הדפדפן לא עובר
     אליה מעצמו. מי שמחובר לחשבון פשוט יתחבר שוב והנתונים יימשכו
     מהענן; מי שעובד מקומית צריך לדעת את זה לפני ההוספה ולא אחריה.
     בכרום ובאדג׳ האחסון משותף, ולכן שם אין מה להזהיר. */
  var separateStorage = isIOS || isSafariDesktop;

  function note() {
    var signedIn = !!(window.Cloud && Cloud.signedIn());
    if (!separateStorage) {
      return { tone: 'ok', text: 'אותה אפליקציה בדיוק — הנתונים והחשבון שבמכשיר נשארים כפי שהם.' };
    }
    if (signedIn) {
      return { tone: 'ok', text: 'הנתונים שלכם שמורים בענן. אחרי ההוספה מתחברים לחשבון גם ' +
                                 'באפליקציה החדשה, והכול נמשך אליה.' };
    }
    /* בלי ענן מוגדר אין חשבון להציע, ואין דרך להעביר את הנתונים —
       עדיף לומר זאת מאשר להצביע על פתרון שאינו קיים */
    if (!(window.Cloud && Cloud.enabled())) {
      return { tone: 'warn',
               text: 'שימו לב: האפליקציה שתיווצר מקבלת אחסון נפרד מהדפדפן, ולכן הנתונים ' +
                     'שהוזנו כאן לא יעברו אליה מעצמם, ויהיה צריך להזין אותם שוב. ' +
                     'אפשר להמשיך לעבוד כאן בדפדפן כרגיל.' };
    }
    /* מי שהגיע לכאן בלי חשבון דילג על שלב החשבון שבהקמה — כלומר בחר
       בכך. החלון מצביע על הדרך ואינו מנהל את הבחירה מחדש. */
    return { tone: 'warn',
             text: 'שימו לב: האפליקציה שתיווצר מקבלת אחסון נפרד מהדפדפן, ולכן הנתונים ' +
                   'שהוזנו כאן לא יעברו אליה מעצמם. לפני ההוספה כדאי לפתוח חשבון סנכרון ' +
                   'בהגדרות ⚙️ — ואז מתחברים באפליקציה החדשה והכול נמשך אליה.' };
  }

  /* ---------- ההוראות, לפי המכשיר ---------- */
  function guide() {
    if (isIOS) {
      return {
        intro: iosOther
          ? 'בדפדפן הזה כפתור השיתוף נמצא בסרגל שלמעלה. בספארי הוא בסרגל התחתון.'
          : 'שלושה צעדים קצרים בספארי:',
        steps: [
          { icon: UI.svgIcon('share', 20),
            title: 'לוחצים על כפתור השיתוף',
            text: iosOther ? 'הריבוע עם החץ כלפי מעלה, בסרגל שלמעלה.'
                           : 'הריבוע עם החץ כלפי מעלה, בסרגל שבתחתית המסך.' },
          { icon: '＋',
            title: 'בוחרים "הוספה למסך הבית"',
            text: 'גוללים מעט ברשימה שנפתחת — באנגלית: Add to Home Screen.' },
          { icon: '✓',
            title: 'מאשרים ב"הוספה"',
            text: 'האייקון נוסף למסך הבית, ומשם האתר נפתח כמו אפליקציה.' }
        ]
      };
    }

    if (isAndroid) {
      return {
        intro: 'שלושה צעדים קצרים בדפדפן:',
        steps: [
          { icon: UI.svgIcon('dots', 20),
            title: 'פותחים את תפריט הדפדפן',
            text: 'שלוש הנקודות בפינה העליונה.' },
          { icon: '＋',
            title: 'בוחרים "התקנת אפליקציה"',
            text: 'בחלק מהדפדפנים הפריט נקרא "הוספה למסך הבית".' },
          { icon: '✓',
            title: 'מאשרים',
            text: 'האייקון נוסף למסך הבית, ומשם האתר נפתח כמו אפליקציה.' }
        ]
      };
    }

    if (isSafariDesktop) {
      return {
        intro: 'בספארי במחשב:',
        steps: [
          { icon: UI.svgIcon('share', 20),
            title: 'לוחצים על כפתור השיתוף',
            text: 'בסרגל הכלים שלמעלה, ליד שורת הכתובת.' },
          { icon: '＋',
            title: 'בוחרים "הוספה ל-Dock"',
            text: 'באנגלית: Add to Dock.' },
          { icon: '✓',
            title: 'מאשרים',
            text: 'האתר נפתח בחלון משלו, בלי סרגלי הדפדפן.' }
        ]
      };
    }

    return {
      intro: 'בכרום או באדג׳ במחשב:',
      steps: [
        { icon: '⊕',
          title: 'לוחצים על אייקון ההתקנה שבשורת הכתובת',
          text: 'בקצה השמאלי של שורת הכתובת, ליד סימן הכוכב.' },
        { icon: UI.svgIcon('dots', 20),
          title: 'או דרך תפריט הדפדפן',
          text: isEdge ? 'אפליקציות → התקנת האתר הזה כאפליקציה.'
                       : 'שלוש הנקודות → העברה ושיתוף → התקנת האתר הזה כאפליקציה.' },
        { icon: '✓',
          title: 'מאשרים',
          text: 'האתר נפתח בחלון משלו, עם אייקון בשולחן העבודה.' }
      ]
    };
  }

  /* ---------- החלון ---------- */
  function heroHTML() {
    return '<div class="inst-hero">' +
      '<img src="assets/icon-192.png" alt="" width="192" height="192">' +
      '<div class="inst-hero-txt"><b>ועד הורים</b>' +
      '<span>כך זה ייראה במסך הבית</span></div></div>';
  }

  function stepsHTML(g) {
    return (g.intro ? '<p class="inst-intro">' + UI.esc(g.intro) + '</p>' : '') +
      '<ol class="inst-steps">' + g.steps.map(function (s, i) {
        return '<li><span class="is-num">' + (i + 1) + '</span>' +
          '<span class="is-body"><b>' + UI.esc(s.title) + '</b>' +
          '<span>' + UI.esc(s.text) + '</span></span>' +
          '<span class="is-ico">' + s.icon + '</span></li>';
      }).join('') + '</ol>';
  }

  function noteHTML() {
    var n = note();
    return '<div class="inst-note ' + n.tone + '">' +
      '<span class="in-ico">' + (n.tone === 'warn' ? '⚠️' : '☁️') + '</span>' +
      '<span>' + UI.esc(n.text) + '</span></div>';
  }

  function body() {
    var native = !!deferred;
    return heroHTML() +
      (native
        ? '<p class="inst-intro">הדפדפן יכול להוסיף אותה בשבילכם — לחיצה אחת, ' +
          'ואייקון האפליקציה יופיע במסך הבית.</p>' +
          '<button class="btn js-install">הוספה למסך הבית</button>' +
          '<button class="btn ghost mt js-how">או להוסיף ידנית, שלב אחרי שלב</button>'
        : stepsHTML(guide())) +
      noteHTML() +
      /* כפתור אחד: ההצעה חד־פעמית, ולכן "אולי אחר כך" ו"לא להציג שוב"
         היו אומרים בדיוק את אותו הדבר */
      '<div class="inst-foot">' +
        '<button class="btn ghost js-later">לא עכשיו</button>' +
      '</div>' +
      '<p class="wiz-note">אפשר להוסיף בכל רגע מההגדרות ⚙️</p>';
  }

  /* ההצעה נסגרת בכל דרך (✕, רקע, Escape) בלי לשנות דבר — היא נרשמת
     ככבויה ברגע שהחלון נפתח מאליו, ולכן גם סגירה שקטה היא תשובה.
     פתיחה מההגדרות אינה מכבה דבר: שם המשתמש ביקש לראות אותה. */
  function open(auto) {
    if (box && box.isOpen && box.isOpen()) return;
    if (auto) silence();

    if (standalone()) {
      box = UI.modal({
        title: 'האפליקציה כבר במסך הבית ✓',
        subtitle: 'אתם מריצים אותה עכשיו מהאייקון, ולא מתוך הדפדפן.',
        body: heroHTML()
      });
      return;
    }

    box = UI.modal({
      title: 'להוסיף את האפליקציה למסך הבית?',
      subtitle: 'פתיחה בלחיצה אחת, במסך מלא ובלי סרגלי הדפדפן — בדיוק כמו אפליקציה.',
      body: body(),
      onMount: function (root, close) {
        var btn = root.querySelector('.js-install');
        if (btn) btn.addEventListener('click', function () {
          var d = deferred;
          if (!d) return;
          deferred = null;          // אירוע ההתקנה תקף לשימוש אחד בלבד
          btn.disabled = true;
          try { d.prompt(); } catch (e) {}
          var choice = d.userChoice || Promise.resolve(null);
          choice.then(function (res) {
            if (res && res.outcome === 'accepted') {
              silence();
              close();
              if (window.Analytics) Analytics.install('accepted');
            } else {
              btn.disabled = false;
              // הדפדפן לא יציע שוב באותה טעינה — מכאן והלאה ההוראות הידניות
              box.setBody(body());
              wire(root, close);
              if (window.Analytics) Analytics.install('dismissed');
            }
          });
        });

        var how = root.querySelector('.js-how');
        if (how) how.addEventListener('click', function () {
          deferred = null;
          box.setBody(body());
          wire(root, close);
        });

        wire(root, close);
      }
    });

    if (window.Analytics) Analytics.install(auto ? 'shown' : 'manual');
  }

  /* הכפתורים התחתונים נקשרים מחדש בכל החלפת תוכן של החלון */
  function wire(root, close) {
    var later = root.querySelector('.js-later');
    if (later) later.addEventListener('click', function () {
      close();
      if (window.Analytics) Analytics.install('dismissed');
    });
  }

  /* ---------- ספירת הכניסות והצעה ---------- */
  function countVisit() {
    var s = read();
    var now = Date.now();
    if (now - s.last > SAME_VISIT_MS) {
      s.visits++;
      s.last = now;
      write(s);
    }
    return s;
  }

  /* נקראת בכל ציור של מסך הבית; ההצעה עצמה קורית פעם אחת בטעינה */
  function maybeOffer() {
    if (offered || !canInstall() || standalone()) return;
    var s = read();
    if (s.off || seenBefore(s) || s.visits < SHOW_AT) return;
    if (!Store.state.setupDone) return;
    // סיור ההיכרות קודם — שתי הצעות זו מעל זו הן הצעה אחת שלא נקראת
    if (window.Tour && (Tour.running() || !Tour.seen())) return;
    /* וכך גם התזכורת לאישור המייל: שם הנתונים עדיין לא מגובים בשום
       מקום, וזה דחוף יותר מהוספה למסך הבית */
    if (window.Confirm && Confirm.pending()) return;

    offered = true;
    setTimeout(function () {
      if (document.querySelector('#modal-root .modal-back')) return;
      if (window.Tour && Tour.running()) return;
      open(true);
    }, 900);
  }

  function init() {
    countVisit();
  }

  /* מונה הכניסות משותף: גם התזכורת לאישור המייל (js/confirm.js) נמדדת
     בו, כדי ש"כניסה" תהיה אותו דבר בשני המקומות ולא תיספר פעמיים */
  function visits() { return read().visits; }

  /* כרום ואדג׳ מודיעים שהאתר ניתן להתקנה. עוצרים את הפס שהדפדפן
     היה מציג בעצמו, ושומרים את האירוע לכפתור שבחלון שלנו. */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
  });

  window.addEventListener('appinstalled', function () {
    deferred = null;
    silence();
    if (box && box.isOpen && box.isOpen()) box.close();
    if (window.UI) UI.toast('האפליקציה נוספה למסך הבית ✓');
    if (window.Analytics) Analytics.install('installed');
  });

  return {
    init: init, open: open, maybeOffer: maybeOffer, visits: visits,
    standalone: standalone, canInstall: canInstall
  };
})();
