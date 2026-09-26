/* ============================================================
   תזכורות — שבוע לפני כל תאריך, ושוב יומיים לפניו
   ------------------------------------------------------------
   אין כאן שרת: התזכורת נבדקת בכל פתיחה של האפליקציה ובכל חזרה
   אליה. לכן היא מופיעה בשני מקומות — פס במסך הבית, שנראה תמיד,
   והתראת מערכת בטלפון או במחשב, למי שאישר אותה. מי שלא פתח את
   האפליקציה בכלל לא יקבל התראה; התראה כשהאפליקציה סגורה דורשת
   שרת שישלח אותה.

   כל תאריך עובר שני שלבים: "שבוע" (3–7 ימים לפני) ו"יומיים"
   (0–2 ימים לפני). התראת המערכת יוצאת פעם אחת לכל שלב. מי שפתח
   את האפליקציה לראשונה רק יום לפני מקבל רק את התזכורת הקרובה —
   תזכורת "בעוד שבוע" על משהו שקורה מחר מבלבלת.
   ============================================================ */
var Reminders = (function () {

  var KEY = 'vaad-gan-reminders-v1';
  var WEEK = 7, SOON = 2;
  /* יותר מזה בבת אחת — התראה אחת מסכמת, ולא שורה של התראות */
  var MAX_SEPARATE = 3;

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
  }

  function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  /* התאריכים שבתוך חלון התזכורת, מהקרוב לרחוק */
  function due(state, today) {
    var ref = dayStart(today || new Date());
    return Calc.allDates(state).map(function (it) {
      var next = Calc.nextOccurrence(it, ref);
      if (!next) return null;
      var days = Math.round((dayStart(next) - ref) / 86400000);
      if (days < 0 || days > WEEK) return null;
      return Object.assign({}, it, {
        next: next, days: days, stage: days <= SOON ? 'soon' : 'week',
        /* התאריך בתוך המפתח: יום הולדת חוזר כל שנה, ואירוע שתאריכו
           הוזז צריך תזכורת חדשה */
        key: it.id + '|' + iso(next) + '|' + (days <= SOON ? 'soon' : 'week')
      });
    }).filter(Boolean).sort(function (a, b) { return a.days - b.days; });
  }

  function when(days) {
    if (days === 0) return 'היום';
    if (days === 1) return 'מחר';
    return 'בעוד ' + days + ' ימים';
  }

  /* ---------- זיכרון: אילו התראות כבר יצאו ---------- */
  function readSent() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeSent(sent, live) {
    /* רק מה שעדיין בחלון נשמר — אחרת הרשימה גדלה לנצח */
    var keep = {};
    live.forEach(function (k) { if (sent[k]) keep[k] = 1; });
    try { localStorage.setItem(KEY, JSON.stringify(keep)); } catch (e) {}
  }

  /* ---------- תזמון מראש, באפליקציה שבחנויות ----------
     באתר אין מי שישלח התראה כשהאפליקציה סגורה, ולכן היא נבדקת רק
     בפתיחה. באפליקציה הטלפון עצמו מציג התראה בזמן שנקבע מראש — ולכן
     שם מתזמנים כל תזכורת לתחילת השלב שלה, בתשע בבוקר, גם אם האפליקציה
     לא תיפתח עד אז. שלב שכבר התחיל אינו מתוזמן: האפליקציה פתוחה ממילא
     והפס שבמסך הבית מציג אותו. כך גם אין צורך לזכור מה כבר נשלח —
     כל בדיקה מבטלת את כל מה שתוזמן ומתזמנת מחדש, ושום דבר לא יוצא פעמיים. */
  var HOUR = 9;
  var MAX_PENDING = 60;   // אייפון שומר עד 64 התראות מתוזמנות לכל אפליקציה

  function plan(state, now, opts) {
    opts = opts || {};
    var hour = opts.hour == null ? HOUR : opts.hour;
    var max = opts.max || MAX_PENDING;
    now = now || new Date();
    var ref = dayStart(now);
    var slots = {};
    Calc.allDates(state).forEach(function (it) {
      var next = Calc.nextOccurrence(it, ref);
      if (!next) return;
      [WEEK, SOON].forEach(function (before) {
        var at = new Date(next.getFullYear(), next.getMonth(), next.getDate() - before, hour);
        if (at <= now) return;
        var t = at.getTime();
        (slots[t] = slots[t] || []).push({ it: it, days: before });
      });
    });
    var out = [];
    Object.keys(slots).map(Number).sort(function (a, b) { return a - b; }).forEach(function (t) {
      var group = slots[t];
      if (group.length > MAX_SEPARATE) {
        out.push({ at: new Date(t), title: '🔔 ' + group.length + ' תאריכים קרובים',
          body: group.map(function (g) { return g.it.title + ' — ' + when(g.days); }).join('\n') });
      } else {
        group.forEach(function (g) {
          out.push({ at: new Date(t), title: '🔔 ' + g.it.title,
            body: when(g.days) + (g.it.kind ? ' · ' + g.it.kind : '') });
        });
      }
    });
    return out.slice(0, max).map(function (n, i) { n.id = i + 1; return n; });
  }

  function isNative() { return !!(window.Native && Native.is()); }
  var CHANNEL = 'reminders';

  /* בדיקות רצופות (פתיחה, חזרה לאפליקציה, שינוי בנתונים) רצות בזו
     אחר זו: שתיים במקביל היו עלולות להשאיר התראה מהתזמון הישן */
  var queue = Promise.resolve();
  function nativeCheck() {
    queue = queue.then(function () {
      var ln = Native.plugin('LocalNotifications');
      if (!ln) return;
      var jobs = Native.notifyPermission() === 'granted' ? plan(Store.state, new Date()) : [];
      return ln.getPending().then(function (res) {
        var ids = ((res && res.notifications) || []).map(function (n) { return { id: n.id }; });
        return ids.length ? ln.cancel({ notifications: ids }) : null;
      }).then(function () {
        if (!jobs.length) return;
        return ln.schedule({ notifications: jobs.map(function (j) {
          return {
            id: j.id, title: j.title, body: j.body, channelId: CHANNEL,
            // אובייקט Date עובר כמו שהוא: הגשר של Capacitor ממיר אותו בשתי הפלטפורמות
            schedule: { at: j.at, allowWhileIdle: true },
            /* בלי זה התוסף מבקש התראה מדויקת לדקה, ובאנדרואיד — כשאין הרשאה
               לכך (ואין, ראו AndroidManifest.xml) — הוא פותח למשתמש את מסך
               ההגדרות "שעונים מעוררים ותזכורות" במקום לתזמן. נמצא באמולטור. */
            isExactNotification: false
          };
        }) });
      });
    }).catch(function () {});
    return queue;
  }

  function nativeInit() {
    var ln = Native.plugin('LocalNotifications');
    if (!ln) return;
    // ערוץ משלו באנדרואיד, כדי שבהגדרות הטלפון ייראה בשם "תזכורות"
    if (Native.platform() === 'android') {
      ln.createChannel({ id: CHANNEL, name: 'תזכורות', importance: 4,
        description: 'שבוע ויומיים לפני כל תאריך' }).catch(function () {});
    }
    // לחיצה על התראה פותחת את לוח התאריכים
    ln.addListener('localNotificationActionPerformed', function () {
      if (window.App && Store.state.setupDone) App.setView('dates');
    });
  }

  /* ---------- התראות מערכת ---------- */
  function supported() {
    if (isNative()) return !!Native.plugin('LocalNotifications');
    return typeof window !== 'undefined' && 'Notification' in window &&
      'serviceWorker' in navigator;
  }
  function permission() {
    if (isNative()) return supported() ? Native.notifyPermission() : 'unsupported';
    return supported() ? Notification.permission : 'unsupported';
  }

  /* באנדרואיד ובאייפון אי אפשר לפתוח התראה ישירות מהדף, רק דרך
     Service Worker. ה-worker כאן לא מטפל בבקשות רשת בכלל, כך שהוא
     לא משנה דבר באופן שבו האתר נטען. */
  var swReady = null;
  function worker() {
    if (!swReady) {
      swReady = navigator.serviceWorker.register('sw.js')
        .then(function () { return navigator.serviceWorker.ready; });
    }
    return swReady;
  }

  function show(title, body, tag) {
    return worker().then(function (reg) {
      return reg.showNotification(title, {
        body: body, tag: tag, lang: 'he', dir: 'rtl',
        icon: 'assets/icon-192.png', badge: 'assets/icon-192.png'
      });
    });
  }

  function check() {
    if (isNative()) { nativeCheck(); return; }
    if (permission() !== 'granted') return;
    var list = due(Store.state);
    var sent = readSent();
    var fresh = list.filter(function (it) { return !sent[it.key]; });
    if (!fresh.length) return;

    var jobs;
    if (fresh.length > MAX_SEPARATE) {
      jobs = [show('🔔 ' + fresh.length + ' תאריכים קרובים',
        fresh.map(function (it) { return it.title + ' — ' + when(it.days); }).join('\n'),
        'vaad-gan-summary')];
    } else {
      jobs = fresh.map(function (it) {
        return show('🔔 ' + it.title, when(it.days) + (it.kind ? ' · ' + it.kind : ''), it.key);
      });
    }
    /* מסמנים רק אחרי שההתראה באמת יצאה, כדי שכישלון לא יבלע אותה */
    Promise.all(jobs).then(function () {
      fresh.forEach(function (it) { sent[it.key] = 1; });
      writeSent(sent, list.map(function (it) { return it.key; }));
    }, function () {});
  }

  /* חייב לרוץ מתוך לחיצה — הדפדפן חוסם בקשת הרשאה שלא יזם המשתמש */
  function enable() {
    if (isNative()) {
      Native.requestNotify().then(function (p) {
        if (p === 'granted') {
          UI.toast('ההתראות הופעלו 🔔');
          check();
        } else {
          UI.toast('ההתראות לא הופעלו. אפשר להפעיל אותן בהגדרות הטלפון.');
        }
        if (window.App && App.render) App.render();
      });
      return;
    }
    if (!supported()) {
      UI.toast('המכשיר הזה לא תומך בהתראות. באייפון — הוסיפו קודם את האתר למסך הבית.');
      return;
    }
    Notification.requestPermission().then(function (p) {
      if (p === 'granted') {
        UI.toast('ההתראות הופעלו 🔔');
        check();
      } else {
        UI.toast('ההתראות לא הופעלו. אפשר לשנות זאת בהגדרות הדפדפן.');
      }
      if (window.App && App.render) App.render();
    });
  }

  /* ---------- הפס במסך הבית ---------- */
  function bannerHTML() {
    var list = due(Store.state);
    var ask = permission() === 'default';
    if (!list.length && !ask) return '';

    var html = '<div class="note mt"><div class="n-ico">🔔</div><div>';
    if (list.length) {
      html += '<b>תזכורות</b>' + list.map(function (it) {
        return UI.esc(it.title) + ' — ' + when(it.days);
      }).join('<br>');
    } else {
      html += '<b>תזכורות לפני כל תאריך</b>' +
        'שבוע לפני כל אירוע, יום הולדת או סעיף מתוזמן, ושוב יומיים לפניו.';
    }
    if (ask) {
      html += '<div class="btn-row mt"><button class="btn" data-action="rem-enable">' +
        'הפעלת התראות בטלפון</button></div>';
    }
    return html + '</div></div>';
  }

  function init() {
    if (isNative()) nativeInit();
    check();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') check();
    });
  }

  return {
    due: due, when: when, plan: plan, check: check, enable: enable,
    bannerHTML: bannerHTML, init: init, permission: permission
  };
})();
