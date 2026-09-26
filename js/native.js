/* ============================================================
   Native — הגשר לאפליקציה שבחנויות (אייפון ואנדרואיד)
   ------------------------------------------------------------
   אותם קבצים בדיוק רצים באתר ובתוך האפליקציה (ראו native/).
   ההבדל מתגלה כאן, בזמן ריצה: בתוך האפליקציה Capacitor מזריק את
   window.Capacitor לפני שכל סקריפט של העמוד רץ. באתר הוא לא קיים,
   וכל מה שבקובץ הזה אינו עושה דבר.

   התוספים נקראים דרך Capacitor.Plugins — העצמים שהצד הנייטיבי
   מזריק בעצמו. registerPlugin קיים רק בספריית ה-JS של Capacitor,
   שאינה נטענת כאן כי לאתר אין שלב בנייה.

   plugin() מחזיר null לתוסף שאינו קיים בגרסה המותקנת. קבצי האתר
   מגיעים לאפליקציה בעדכון חי, ולכן הם עשויים לרוץ בגרסה נייטיבית
   ישנה מהם — ואז עדיף שיכולת תיעלם מאשר שהאפליקציה תקרוס.
   ============================================================ */
var Native = (function () {

  var cap = window.Capacitor;
  var on = !!(cap && cap.isNativePlatform && cap.isNativePlatform());

  function noop() {}
  function is() { return on; }
  function platform() { return on ? cap.getPlatform() : 'web'; }
  function plugin(name) {
    if (!on || !cap.isPluginAvailable || !cap.isPluginAvailable(name)) return null;
    return cap.Plugins[name] || null;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* כתובת באתר עצמו. privacy.html, למשל, אינו נארז באפליקציה: הוא
     נפתח מהאתר, כדי שיהיה תמיד בגרסה שמתפרסמת גם לחנויות. */
  function siteUrl(rel) {
    var base = ((window.SiteConfig && SiteConfig.url) || '').replace(/\/+$/, '');
    return base + '/' + String(rel || '').replace(/^\.?\//, '');
  }

  if (!on) {
    return {
      is: is, platform: platform, plugin: plugin, siteUrl: siteUrl,
      ready: function () { return Promise.resolve(); },
      started: noop,
      openExternal: function (url) { window.open(url, '_blank', 'noopener'); },
      notifyPermission: function () { return 'unsupported'; },
      requestNotify: function () { return Promise.resolve('unsupported'); },
      info: {}
    };
  }

  var root = document.documentElement;
  root.classList.add('native', 'native-' + platform());

  /* ---------- עדכונים חיים ----------
     ראשון, לפני כל דבר שעלול להיכשל: חבילה שלא מודיעה שעלתה תוך
     עשר שניות מתגלגלת אחורה לקודמת (appReadyTimeout בהגדרות). */
  var updater = plugin('CapacitorUpdater');
  if (updater) updater.notifyAppReady().catch(noop);

  /* ---------- מסך הפתיחה ----------
     המסך הנייטיבי נשאר עד שהעמוד צויר (started), כדי שלא יופיע רגע
     של מסך ריק בין השניים. תקרה של 3 שניות: גם אם משהו נתקע בדרך,
     המשתמש לא נשאר מול מסך הפתיחה. */
  var splashDown = false;
  function hideSplash() {
    if (splashDown) return;
    splashDown = true;
    var s = plugin('SplashScreen');
    if (s) s.hide({ fadeOutDuration: 150 }).catch(noop);
  }
  setTimeout(hideSplash, 3000);

  function started() {
    // שתי מסגרות: הראשונה מציירת את העמוד, השנייה מבטיחה שהוא כבר על המסך
    requestAnimationFrame(function () { requestAnimationFrame(hideSplash); });
  }

  /* ---------- עותק של הנתונים מחוץ ל-WebView ----------
     אצל מי שעובד בלי חשבון, localStorage הוא העותק היחיד של נתוני
     הוועד, ומערכת ההפעלה רשאית לפנות אחסון של WebView כשהמקום
     במכשיר נגמר. לכן כל כתיבה של מפתח vaad-gan-* מועתקת גם לקובץ
     אחד בתיקיית האפליקציה — וגם הוא שנכלל בגיבוי של הטלפון (ראו
     כללי הגיבוי באנדרואיד).

     החלפה ב-Storage.prototype ולא ב-localStorage.setItem: השמה
     ישירה ל-localStorage.setItem רק שומרת פריט בשם "setItem".

     אסימון ההתחברות אינו נכלל: אסימוני הרענון של Supabase חד־פעמיים,
     ושחזור של אסימון שכבר הוחלף מבטל את כל ההתחברות. אחרי שחזור
     פשוט מתחברים מחדש. */
  var MIRROR = 'vaad-gan-backup.json';
  var SKIP = { 'vaad-gan-session-v1': 1 };
  var STATE_PREFIX = 'vaad-gan-state-v1';

  function mirrored(k) { return typeof k === 'string' && k.indexOf('vaad-gan-') === 0 && !SKIP[k]; }

  var proto = window.Storage && Storage.prototype;
  var rawSet = proto && proto.setItem;
  var rawRemove = proto && proto.removeItem;

  function store() { try { return window.localStorage; } catch (e) { return null; } }

  function snapshot() {
    var ls = store(), out = {};
    if (!ls) return out;
    for (var i = 0; i < ls.length; i++) {
      var k = ls.key(i);
      if (mirrored(k)) out[k] = ls.getItem(k);
    }
    return out;
  }

  function hasData() {
    var ls = store();
    if (!ls) return false;
    for (var i = 0; i < ls.length; i++) {
      if (String(ls.key(i)).indexOf('vaad-gan-') === 0) return true;
    }
    return false;
  }

  /* העותק אינו נכתב לפני שהשחזור הסתיים: כתיבה מוקדמת של מצב ריק
     הייתה דורסת את הגיבוי בדיוק ברגע שבו הוא נחוץ */
  var restored = false;
  var dirty = false, flushTimer = null, remindTimer = null;
  function flush() {
    clearTimeout(flushTimer);
    var fs = plugin('Filesystem');
    if (!restored || !dirty || !fs) return Promise.resolve();
    dirty = false;
    return fs.writeFile({
      path: MIRROR, directory: 'LIBRARY', encoding: 'utf8',
      data: JSON.stringify({ v: 1, savedAt: Date.now(), items: snapshot() })
    }).catch(function () { dirty = true; });
  }

  function touched(k) {
    if (!mirrored(k)) return;
    dirty = true;
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 1000);
    /* תאריך שנוסף, נמחק או זז משנה את התזכורות שכבר תוזמנו בטלפון */
    if (k.indexOf(STATE_PREFIX) === 0 && window.Reminders && Reminders.check) {
      clearTimeout(remindTimer);
      remindTimer = setTimeout(function () { Reminders.check(); }, 2000);
    }
  }

  if (proto) {
    proto.setItem = function (k, v) {
      rawSet.call(this, k, v);
      if (this === store()) touched(String(k));
    };
    proto.removeItem = function (k) {
      rawRemove.call(this, k);
      if (this === store()) touched(String(k));
    };
  }

  /* רק כשאין ב-WebView אף מפתח שלנו: אחסון שנמחק, או טלפון חדש
     שהגיע מגיבוי. אם יש נתונים — הם העדכניים, והעותק אינו נוגע בהם. */
  function restore() {
    var fs = plugin('Filesystem'), ls = store();
    if (!fs || !ls || hasData()) return Promise.resolve(false);
    return fs.readFile({ path: MIRROR, directory: 'LIBRARY', encoding: 'utf8' }).then(function (res) {
      var items = (JSON.parse(res.data) || {}).items || {};
      Object.keys(items).forEach(function (k) {
        if (mirrored(k) && typeof items[k] === 'string') rawSet.call(ls, k, items[k]);
      });
      return true;
    }).catch(function () { return false; });   // אין קובץ — התקנה ראשונה
  }

  /* מתחיל מיד, לפני ששאר הסקריפטים רצים. אין לו תקרת זמן: קריאה של
     קובץ מקומי אורכת אלפיות שנייה, ואפליקציה שעולה ריקה לפני שהשחזור
     הסתיים הייתה נראית כאילו הנתונים אבדו. */
  var restoring = restore().then(function (r) {
    restored = true;
    if (dirty) flush();
    return r;
  });

  /* ---------- התראות ----------
     ההרשאה נשמרת כאן כערך סינכרוני, כי הפס שבמסך הבית מצויר בבת אחת
     ושואל עליה. הערכים הם של ה-Notification API בדפדפן, כדי ש-Reminders
     יעבוד באותה צורה בשני המקומות. */
  var notify = 'default';
  function mapPermission(p) {
    var d = p && p.display;
    if (d === 'granted') return 'granted';
    if (d === 'denied') return 'denied';
    return 'default';
  }
  function refreshNotify() {
    var ln = plugin('LocalNotifications');
    if (!ln) { notify = 'unsupported'; return Promise.resolve(notify); }
    return ln.checkPermissions().then(function (p) { notify = mapPermission(p); return notify; },
      function () { return notify; });
  }
  function requestNotify() {
    var ln = plugin('LocalNotifications');
    if (!ln) return Promise.resolve('unsupported');
    return ln.requestPermissions().then(function (p) { notify = mapPermission(p); return notify; },
      function () { return notify; });
  }

  /* ---------- פרטי הגרסה המותקנת ---------- */
  var info = {};
  function loadInfo() {
    var app = plugin('App');
    if (!app) return Promise.resolve(info);
    return app.getInfo().then(function (i) {
      info.version = i.version;
      info.build = parseInt(i.build, 10) || 0;
      return info;
    }, function () { return info; });
  }

  /* מה שחייב להיות מוכן לפני הציור הראשון. השחזור — עד הסוף. ההרשאה
     ופרטי הגרסה — עם תקרה של שנייה וחצי: מסך שנתקע גרוע מפס תזכורות
     שמתעדכן רגע אחר כך. */
  var readyP = null;
  function ready() {
    if (!readyP) {
      readyP = Promise.all([
        restoring,
        Promise.race([Promise.all([refreshNotify(), loadInfo()]), wait(1500)])
      ]).then(noop, noop);
    }
    return readyP;
  }

  /* ---------- קישורים החוצה ----------
     ניווט של העמוד לכתובת שאינה של האפליקציה נמסר למערכת: וואטסאפ,
     חייגן או הדפדפן. כך בשתי הפלטפורמות (נבדק בקוד של Capacitor).
     window.open מתנהג אחרת בכל אחת מהן, ולכן אינו בשימוש כאן. */
  function openExternal(url) { window.location.href = url; }

  /* קישור עם target=_blank (מדיניות הפרטיות) — נפתח מהאתר, בדפדפן */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[target="_blank"]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    e.preventDefault();
    openExternal(/^[a-z][a-z0-9+.-]*:/i.test(href) ? href : siteUrl(href));
  }, true);

  /* ---------- שמירה ושיתוף של קובץ ----------
     ב-WebView אין הורדות: a[download] אינו עושה דבר, ובאנדרואיד אין
     גם navigator.share. הקובץ נכתב למטמון של האפליקציה, וחלון השיתוף
     של המערכת מציע לשמור אותו, לשלוח בוואטסאפ או לפתוח ב-Excel. */
  function base64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }

  function saveFile(name, blob, title) {
    var fs = plugin('Filesystem'), share = plugin('Share');
    if (!fs || !share) return Promise.reject(new Error('אין אפשרות לשתף קבצים בגרסה הזו'));
    return base64(blob).then(function (data) {
      return fs.writeFile({ path: name, data: data, directory: 'CACHE' });
    }).then(function (res) {
      return share.share({ title: title || name, files: [res.uri] }).then(function () { return true; },
        function (err) {
          // סגירת חלון השיתוף בלי לבחור — אינה שגיאה
          if (/cancel/i.test((err && (err.message || err.errorMessage)) || '')) return false;
          throw err;
        });
    });
  }

  /* ---------- מחזור החיים של האפליקציה ---------- */
  var app = plugin('App');
  if (app) {
    // יציאה לרקע: העותק נכתב מיד, בלי לחכות לשנייה של ההשהיה
    app.addListener('pause', function () { flush(); });
    // חזרה: ייתכן שההרשאה להתראות שונתה בינתיים בהגדרות הטלפון
    app.addListener('resume', function () {
      refreshNotify().then(function () {
        if (window.Reminders && Reminders.check) Reminders.check();
      });
    });

    /* כפתור החזרה של אנדרואיד. המסכים מתחלפים בלי היסטוריה (replaceState),
       ולכן "אחורה" של הדפדפן היה סוגר את האפליקציה מכל מקום. כאן הוא סוגר
       קודם את מה שפתוח, אחר כך חוזר לבית, ורק מהבית ממזער — כמו כל
       אפליקציה אחרת באנדרואיד. */
    app.addListener('backButton', function () {
      if (window.Tour && Tour.running && Tour.running()) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return;
      }
      if (window.UI && UI.closeTopModal && UI.closeTopModal()) return;
      if (window.App && App.view && window.Store && Store.state && Store.state.setupDone &&
          App.view() !== 'home') {
        App.setView('home');
        return;
      }
      app.minimizeApp().catch(noop);
    });
  }

  return {
    is: is, platform: platform, plugin: plugin, siteUrl: siteUrl,
    ready: ready, started: started, openExternal: openExternal, saveFile: saveFile,
    notifyPermission: function () { return notify; }, requestNotify: requestNotify,
    info: info
  };
})();
