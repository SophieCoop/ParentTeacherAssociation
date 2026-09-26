/* ============================================================
   Cloud — סנכרון לענן (Supabase) בגישת "מקומי קודם"
   ------------------------------------------------------------
   האפליקציה ממשיכה לעבוד מהזיכרון המקומי ולכן נשארת מיידית
   וזמינה גם בלי אינטרנט. מעליה רצה שכבה שמעלה את המצב לענן
   ומושכת אותו במכשיר אחר.

   המצב כולו נשמר כמסמך JSON אחד בשורה אחת לכל משתמש, ולכן
   ההכרעה בין שתי גרסאות היא "האחרון מנצח" — ואם שני המכשירים
   השתנו במקביל, המשתמש נשאל במקום שגרסה תימחק בשקט.
   ============================================================ */
var Cloud = (function () {

  var SESSION_KEY = 'vaad-gan-session-v1';
  var META_KEY    = 'vaad-gan-sync-v1';
  var PENDING_KEY = 'vaad-gan-pending-signup-v1';
  var CONFIRMED_KEY = 'vaad-gan-confirmed-v1';
  var PUSH_DELAY  = 1500;   // המתנה אחרי שינוי לפני העלאה
  var POLL_GUARD  = 5000;   // מרווח מזערי בין סנכרונים יזומים

  var session = null;
  var meta = { lastServerAt: null, dirty: false, lastSyncAt: null };
  var status = 'off';
  var lastError = '';
  var conflict = null;
  var pushTimer = null;
  var lastAuto = 0;
  var listeners = [];

  var LABELS = {
    'off':        { icon: '📴', text: 'מקומי בלבד',      tone: 'neutral' },
    'signed-out': { icon: '🔑', text: 'לא מחובר',        tone: 'neutral' },
    'synced':     { icon: '✅', text: 'מסונכרן',          tone: 'ok' },
    'pending':    { icon: '🕒', text: 'ממתין לסנכרון',   tone: 'warn' },
    'syncing':    { icon: '🔄', text: 'מסנכרן…',          tone: 'info' },
    'offline':    { icon: '📡', text: 'אין חיבור',        tone: 'warn' },
    'conflict':   { icon: '⚠️', text: 'התנגשות גרסאות',  tone: 'no' },
    'error':      { icon: '⚠️', text: 'שגיאת סנכרון',    tone: 'no' }
  };

  /* ---------- מצב ומאזינים ---------- */
  function enabled()  { return !!(window.CloudConfig && CloudConfig.url && CloudConfig.key); }
  function signedIn() { return !!(session && session.access_token); }
  function onChange(fn) { listeners.push(fn); }
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }

  function setStatus(s, err) {
    status = s;
    lastError = err || '';
    emit();
  }

  function info() {
    var l = LABELS[status] || LABELS.off;
    return {
      status: status, icon: l.icon, text: l.text, tone: l.tone,
      error: lastError, email: session && session.user ? session.user.email : '',
      lastSyncAt: meta.lastSyncAt, signedIn: signedIn(), enabled: enabled()
    };
  }

  /* ---------- אחסון מקומי של ההתחברות ---------- */
  /* מצב הסנכרון מתאר את היחסים של חשבון אחד מול השרת, ולכן הוא נשמר
     לכל חשבון בנפרד. מפתח משותף היה שולח את החשבון האחד עם הסמן של
     השני, ו"האחרון מנצח" היה מכריע על סמך השוואה שגויה. */
  function metaKey() {
    var id = session && session.user && session.user.id;
    return id ? META_KEY + ':' + id : META_KEY;
  }

  function loadLocal() {
    try {
      var s = localStorage.getItem(SESSION_KEY);
      if (s) session = JSON.parse(s);
      var m = localStorage.getItem(metaKey());
      if (m) {
        var parsed = JSON.parse(m);
        Object.keys(parsed).forEach(function (k) { meta[k] = parsed[k]; });
      }
    } catch (e) {}
  }
  /* ---------- הרשמה שממתינה לאישור במייל ----------
     חשבון שנפתח ועדיין לא אושר אינו מקבל טוקן, ולכן אין סשן ואין
     שום זכר לכך במכשיר: ברענון הבא האפליקציה שוב אינה יודעת שיש
     אישור שממתין, והנתונים ממשיכים להיצבר מקומית בלבד. הרשומה כאן
     היא הזיכרון הזה, והיא שמאפשרת לתזכר על כך בהמשך (js/confirm.js).

     הסיסמה אינה נשמרת — די בכתובת כדי לשלוח את המייל מחדש. */
  /* ---------- רישום חיובי: הכתובות שידוע שאושרו ----------
     מחיקת הרשומה הממתינה מספיקה כל עוד האישור מגיע יחד עם סשן, אבל
     יש מסלולים שבהם ידוע שהמייל אושר ובכל זאת אין סשן במכשיר הזה:
     לחיצה שנייה על הקישור (הוא חד־פעמי ולכן חוזר כשגיאה), נפילת רשת
     אחרי שהטוקן כבר התקבל, או אישור שנעשה במכשיר אחר ונודע לנו רק
     כששליחת המייל מחדש נענית ב"כבר מאושר". בלי הרישום הזה התזכורת
     הייתה ממשיכה לקפוץ למי שכבר סיים. */
  function confirmedList() {
    try {
      var a = JSON.parse(localStorage.getItem(CONFIRMED_KEY) || '[]');
      return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string' && x; }) : [];
    } catch (e) { return []; }
  }

  function norm(email) { return String(email || '').trim().toLowerCase(); }

  function isConfirmed(email) {
    var e = norm(email);
    return !!e && confirmedList().indexOf(e) > -1;
  }

  /* הרשימה קצרה בכוונה — מכשיר משותף מחזיק חשבון או שניים, לא היסטוריה */
  function markConfirmed(email) {
    var e = norm(email);
    if (!e) return;
    var list = confirmedList().filter(function (x) { return x !== e; });
    list.push(e);
    try { localStorage.setItem(CONFIRMED_KEY, JSON.stringify(list.slice(-5))); } catch (e2) {}
    var p = rawPending();
    if (p && norm(p.email) === e) clearPendingSignup();
  }

  /* התחברות שנדחתה כי המייל טרם אושר היא עדות הפוכה — ומתקנת סימון
     שגוי, אם איכשהו נרשם כזה */
  function unmarkConfirmed(email) {
    var e = norm(email);
    if (!e || !isConfirmed(e)) return;
    var list = confirmedList().filter(function (x) { return x !== e; });
    try { localStorage.setItem(CONFIRMED_KEY, JSON.stringify(list)); } catch (e2) {}
  }

  function rawPending() {
    try {
      var o = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
      return (o && o.email) ? { email: String(o.email), at: parseInt(o.at, 10) || 0 } : null;
    } catch (e) { return null; }
  }

  /* הרשומה מוחזרת רק כשבאמת אין אישור. כתובת שידוע שאושרה מסירה את
     הרשומה כאן ועכשיו, כך שאף קורא לא יראה משימה שכבר נסגרה. */
  function pendingSignup() {
    var p = rawPending();
    if (!p) return null;
    if (isConfirmed(p.email)) { clearPendingSignup(); return null; }
    return p;
  }
  /* הרשמה לכתובת שכבר אושרה אינה משימה פתוחה. Supabase מחזיר על
     כתובת רשומה תשובה חיובית בלי טוקן — בדיוק כמו על הרשמה חדשה
     שממתינה לאישור — כדי לא לגלות מי רשום; בלי הבדיקה כאן היינו
     פותחים תזכורת על חשבון מאושר לגמרי. */
  function setPendingSignup(email) {
    if (isConfirmed(email)) return;
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ email: email, at: Date.now() }));
    } catch (e) {}
  }
  function clearPendingSignup() {
    try { localStorage.removeItem(PENDING_KEY); } catch (e) {}
  }

  function saveSession(data) {
    if (!data || !data.access_token) return null;
    session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || (session && session.refresh_token),
      expires_at: data.expires_at || (Math.floor(Date.now() / 1000) + (data.expires_in || 3600)),
      user: data.user ? { id: data.user.id, email: data.user.email } : (session && session.user)
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
    /* סשן תקף פירושו שהאישור כבר מאחורינו — בין אם דרך הקישור שבמייל
       ובין אם בהתחברות רגילה. נרשם גם בחיוב, ולא רק במחיקה, כדי שגם
       אחרי התנתקות לא נתחיל להזכיר מחדש משימה שנסגרה. */
    if (session.user && session.user.email) markConfirmed(session.user.email);
    clearPendingSignup();
    return session;
  }
  function clearSession() {
    session = null;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }
  function saveMeta() {
    try { localStorage.setItem(metaKey(), JSON.stringify(meta)); } catch (e) {}
  }
  function readMeta() {
    try { return JSON.parse(localStorage.getItem(metaKey()) || 'null'); } catch (e) { return null; }
  }

  /* כניסה לחשבון — משותפת להתחברות, להרשמה ולחזרה מקישור המייל.
     הגן של החשבון נטען מהמכשיר אם הוא כבר חונה בו, גן מקומי שאין לו
     בעלים נאמץ לתוכו, ובכל מקרה אחר מתקבל מצב נקי שממנו מתחיל האשף.
     המצב מול השרת מתחיל מאפס: הענן הוא מקור האמת להשוואה, ומה שכבר
     במכשיר מסומן כממתין להעלאה כדי שלא ייעלם בשקט. */
  /* בחירת התא של החשבון. גן מקומי שאין לו בעלים עובר לבעלותו — וזה
     גם המסלול של מכשיר שהתעדכן לגרסה הזו: הנתונים שכבר היו בו נשמרו
     לפני שהיו תאים, ולכן הם חסרי בעלים ושייכים למי שמחובר. בלי זה
     ההתחברות הייתה נראית כאילו מחקה אותם. */
  function adoptOrUseSlot(id) {
    if (!id || !window.Store || !Store.useSlot) return;
    if (!Store.currentOwner() && !Store.hasSlot(id) && hasLocalContent()) Store.adoptInto(id);
    else Store.useSlot(id);
  }

  function enterAccount() {
    var id = session && session.user && session.user.id;
    adoptOrUseSlot(id);
    /* הסמן מול השרת נשמר לכל חשבון בנפרד, ולכן אפשר להמשיך ממנו
       במקום להשוות מאפס: מי שמתנתק ומתחבר בחזרה לא ייראה כאילו שני
       הצדדים השתנו, ולא יישאל על התנגשות שלא הייתה. שינוי שלא הספיק
       לעלות לפני ההתנתקות נשאר מסומן, ונדחף בהתחברות הבאה.
       חשבון שלא היה במכשיר מתחיל בלי סמן — הענן הוא מקור ההשוואה,
       ומה שכבר במכשיר (גן שנאמץ זה עתה) מסומן להעלאה. */
    var stored = readMeta();
    meta = stored
      ? { lastServerAt: stored.lastServerAt || null, dirty: !!stored.dirty,
          lastSyncAt: stored.lastSyncAt || null }
      : { lastServerAt: null, dirty: hasLocalContent(), lastSyncAt: null };
    saveMeta();
  }

  /* ---------- קריאות לשרת ---------- */
  function api(path, opts) {
    opts = opts || {};
    var headers = { 'apikey': CloudConfig.key, 'Content-Type': 'application/json' };
    Object.keys(opts.headers || {}).forEach(function (k) { headers[k] = opts.headers[k]; });
    if (opts.auth !== false && signedIn()) headers['Authorization'] = 'Bearer ' + session.access_token;

    return fetch(CloudConfig.url + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        if (text) { try { data = JSON.parse(text); } catch (e) { data = { message: text }; } }
        if (!res.ok) {
          var msg = (data && (data.error_description || data.msg || data.message || data.error)) ||
                    ('שגיאה ' + res.status);
          var err = new Error(translateError(msg, res.status));
          err.status = res.status;
          // קוד השגיאה של השרת — מאפשר למסך להגיב למקרה מסוים, בלי לנחש לפי הטקסט
          err.code = (data && (data.error_code || data.error)) || '';
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  /* הודעות השרת מגיעות באנגלית — מתרגמים את הנפוצות */
  function translateError(msg, code) {
    var m = String(msg || '');
    if (/Invalid login credentials/i.test(m))        return 'אימייל או סיסמה שגויים';
    if (/Email not confirmed/i.test(m))              return 'צריך לאשר את המייל שנשלח לפני ההתחברות';
    if (/User already registered/i.test(m))          return 'כתובת המייל כבר רשומה — אפשר פשוט להתחבר';
    if (/Password should be at least/i.test(m))      return 'הסיסמה קצרה מדי (לפחות 6 תווים)';
    if (/Unable to validate email/i.test(m))         return 'כתובת המייל אינה תקינה';
    if (/rate limit|too many/i.test(m))              return 'יותר מדי ניסיונות — נסו שוב בעוד כמה דקות';
    var wait = m.match(/only request this after (\d+) second/i);
    if (wait)                                        return 'אפשר לבקש מייל נוסף רק בעוד ' + wait[1] + ' שניות';
    if (/already confirmed|already been confirmed/i.test(m)) return 'החשבון כבר מאושר — אפשר פשוט להתחבר';
    if (/should be different|same.*password/i.test(m))        return 'הסיסמה החדשה זהה לקודמת — בחרו אחרת';
    if (/weak|pwned|compromised/i.test(m))                    return 'הסיסמה חלשה מדי — בחרו סיסמה אחרת';
    if (/signups? not allowed|not found/i.test(m))   return 'לא מצאנו חשבון עם הכתובת הזו';
    if (code === 401 || code === 403)                return 'תוקף ההתחברות פג';
    return m;
  }

  function fresh() {
    if (!signedIn()) return Promise.reject(new Error('לא מחוברים לחשבון'));
    var now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at - now > 60) return Promise.resolve();
    if (!session.refresh_token) return Promise.reject(new Error('תוקף ההתחברות פג'));
    return api('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', auth: false, body: { refresh_token: session.refresh_token }
    }).then(function (d) { saveSession(d); });
  }

  /* האם יש במכשיר נתונים אמיתיים שעוד לא הועלו לענן?
     שינויים שנעשו לפני ההתחברות אינם מסומנים כ"ממתינים", ובלי הבדיקה
     הזו התחברות ראשונה הייתה מאמצת את גרסת הענן ומוחקת אותם בשקט. */
  function hasLocalContent() {
    var st = Store.state;
    var lists = ['children', 'staff', 'budgetItems', 'payments', 'expenses', 'ideas', 'events'];
    for (var i = 0; i < lists.length; i++) {
      if ((st[lists[i]] || []).length) return true;
    }
    return !!(st.gan && st.gan.name);
  }

  /* ---------- התחברות ---------- */
  function signIn(email, password) {
    return api('/auth/v1/token?grant_type=password', {
      method: 'POST', auth: false, body: { email: email, password: password }
    }).then(null, function (err) {
      if (/לאשר את המייל/.test((err && err.message) || '')) unmarkConfirmed(email);
      throw err;
    }).then(function (d) {
      saveSession(d);
      enterAccount();
      return sync(true).then(function (r) {
        // ההתחברות משנה את המסך שצריך להיות מוצג, לא רק את הנתונים
        if (window.App && App.render) App.render();
        return r;
      });
    });
  }

  /* לאן יחזור הקישור שבמייל. Supabase מקבל את הכתובת רק אם היא ברשימה
     המאושרת שבהגדרות הפרויקט, ואחרת חוזר מעצמו לכתובת האתר הראשית.

     הכתובת מקובעת לדומיין הרשמי (js/config.js) ואינה נגזרת מהחלון
     שבו נרשמו: מי שנכנס מכתובת תצוגה מקדימה של Vercel, או מ-www
     במקום מהדומיין הראשי, היה מקבל קישור שחוזר לשם — כתובת שעלולה
     לא להיות ברשימה המאושרת, ודומיין שונה בכל מייל.

     שימו לב שזהו הפרמטר redirect_to בלבד — לאן הדפדפן מופנה *אחרי*
     שהאסימון אומת. הוא אינו נוגע לאסימון עצמו ואינו משנה את אופן
     האימות. בפיתוח מקומי לא נוגעים בכלום: שם חוזרים לאן שעובדים.

     באפליקציה שבחנויות שם המחשב הוא גם כן localhost, אבל זו אינה סביבת
     פיתוח: הקישור שבמייל נפתח בדפדפן של הטלפון, ולכן הוא חוזר לאתר.
     שם החשבון מאושר, ובאפליקציה לוחצים "כבר אישרתי — התחברות". */
  function isLocal() {
    if (window.Native && Native.is()) return false;
    try {
      return location.protocol === 'file:' ||
             /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname);
    } catch (e) { return false; }
  }

  function returnUrl() {
    try {
      // הנתיב שבתוך האפליקציה (‎/index.html) אינו אומר דבר לאתר
      var path = (window.Native && Native.is()) ? '/' : (location.pathname || '/');
      if (isLocal()) return location.origin + path;
      var site = (window.SiteConfig && SiteConfig.url) || '';
      return site ? site.replace(/\/+$/, '') + path : location.origin + path;
    } catch (e) { return ''; }
  }

  function signUp(email, password) {
    var back = returnUrl();
    return api('/auth/v1/signup' + (back ? '?redirect_to=' + encodeURIComponent(back) : ''), {
      method: 'POST', auth: false, body: { email: email, password: password }
    }).then(function (d) {
      if (d && d.access_token) {
        saveSession(d);
        enterAccount();
        return sync(true).then(function () { return { confirmed: true }; });
      }
      // הפרויקט דורש אישור מייל. נרשם כאן כדי שנוכל לתזכר על כך בהמשך
      setPendingSignup(email);
      return { confirmed: false };
    });
  }

  /* שליחת מייל האישור מחדש — למי שהמייל לא הגיע אליו או שאבד */
  function resendConfirm(email) {
    var back = returnUrl();
    return api('/auth/v1/resend' + (back ? '?redirect_to=' + encodeURIComponent(back) : ''), {
      method: 'POST', auth: false, body: { type: 'signup', email: email }
    }).then(function () { return true; }, function (err) {
      /* "החשבון כבר מאושר" אינו כישלון של המשתמש אלא תשובה: אין מה
         לאשר. נרשם, וההודעה עולה כרגיל */
      if (/כבר מאושר/.test((err && err.message) || '')) markConfirmed(email);
      throw err;
    });
  }

  /* ---------- שחזור סיסמה ----------
     הסיסמה נבחרת באשף ההקמה ונשכחת מיד: היא נכתבת פעם אחת ולא
     נדרשת שוב כל עוד ההתחברות מחזיקה. מי שהקישור שבמייל פג אצלו
     נשאר בלי שום דרך להיכנס לחשבון — והנתונים שהזין יושבים אצלו
     במכשיר בלי להסתנכרן לעולם. לכן יש כאן שחזור.

     הקישור חוזר לאותה כתובת כמו קישור האישור, עם type=recovery,
     ומגיע עם סשן — ולכן אפשר לקבוע איתו סיסמה חדשה. */
  function sendRecovery(email) {
    var back = returnUrl();
    return api('/auth/v1/recover' + (back ? '?redirect_to=' + encodeURIComponent(back) : ''), {
      method: 'POST', auth: false, body: { email: email }
    }).then(function () { return true; });
  }

  /* קביעת סיסמה חדשה. דורשת סשן פעיל — זה שהגיע מקישור השחזור. */
  function updatePassword(password) {
    if (!signedIn()) return Promise.reject(new Error('צריך להיכנס מקישור השחזור שבמייל'));
    return fresh().then(function () {
      return api('/auth/v1/user', { method: 'PUT', body: { password: String(password || '') } });
    }).then(function () { return true; });
  }

  function signOut() {
    var token = session && session.access_token;
    clearSession();
    /* הגן נשאר על המכשיר, אבל תחת המפתח של בעליו ולא בדרכו של החשבון
       הבא. המכשיר חוזר לתא המקומי — ריק ברוב המקרים, ואז האשף נפתח. */
    if (window.Store && Store.useSlot) Store.useSlot('');
    meta = { lastServerAt: null, dirty: false, lastSyncAt: null };
    saveMeta();
    conflict = null;
    setStatus('signed-out');
    if (token) {
      api('/auth/v1/logout', { method: 'POST', auth: false, headers: { 'Authorization': 'Bearer ' + token } })
        .catch(function () {});
    }
  }

  /* ---------- מחיקת החשבון ---------- */
  /* מחיקה אמיתית, לא רק ניתוק: השורה בענן והמשתמש עצמו נמחקים.
     דפדפן אינו רשאי למחוק משתמש, ולכן הפעולה עוברת דרך פונקציה
     בשרת (delete_account) שמוחקת אך ורק את מי שקרא לה — המזהה
     נלקח מהטוקן ולא מפרמטר.

     סדר הפעולות חשוב: קודם השרת, ורק אחרי שהוא אישר נמחק גם מה
     שבמכשיר. מחיקה מקומית מוקדמת הייתה משאירה את הנתונים בענן בלי
     שום דרך להגיע אליהם. התא של החשבון נמחק לבדו — ייתכן שחונה
     כאן גם גן של חשבון אחר. */
  function deleteAccount() {
    if (!enabled())  return Promise.reject(new Error('הסנכרון כבוי'));
    if (!signedIn()) return Promise.reject(new Error('לא מחוברים לחשבון'));

    var uid = session.user && session.user.id;
    return fresh().then(function () {
      return api('/rest/v1/rpc/delete_account', { method: 'POST', body: {} });
    }).then(function () {
      try { localStorage.removeItem(META_KEY + ':' + uid); } catch (e) {}
      clearSession();
      if (window.Store && Store.dropSlot) Store.dropSlot(uid);
      meta = { lastServerAt: null, dirty: false, lastSyncAt: null };
      conflict = null;
      clearTimeout(pushTimer);
      setStatus('signed-out');
      return true;
    });
  }

  /* ---------- משיכה ודחיפה ---------- */
  function pull() {
    return fresh().then(function () {
      return api('/rest/v1/' + CloudConfig.table +
                 '?select=data,updated_at&user_id=eq.' + encodeURIComponent(session.user.id));
    }).then(function (rows) { return (rows && rows[0]) || null; });
  }

  function push() {
    return fresh().then(function () {
      return api('/rest/v1/' + CloudConfig.table + '?on_conflict=user_id', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: [{ user_id: session.user.id, data: Store.state, device: deviceLabel() }]
      });
    }).then(function (rows) {
      var row = rows && rows[0];
      meta.dirty = false;
      if (row && row.updated_at) meta.lastServerAt = row.updated_at;
      meta.lastSyncAt = new Date().toISOString();
      saveMeta();
      return row;
    });
  }

  function adopt(data) {
    Store.replaceState(data);
    if (window.App && App.render) App.render();
  }

  function failed(err) {
    if (err && (err.status === 401 || err.status === 403)) {
      clearSession();
      setStatus('signed-out', 'תוקף ההתחברות פג — יש להתחבר מחדש');
      return;
    }
    var offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
    setStatus(offline ? 'offline' : 'error', err && err.message);
  }

  /* הסנכרון: מושכים, ואז מכריעים לפי מה השתנה ואיפה */
  function sync(force) {
    if (!enabled())  { setStatus('off');        return Promise.resolve(); }
    if (!signedIn()) { setStatus('signed-out'); return Promise.resolve(); }
    if (status === 'conflict' && !force) return Promise.resolve();

    setStatus('syncing');
    return pull().then(function (row) {
      if (!row) {
        // אין עדיין דבר בענן. אם גם במכשיר אין נתונים, אין מה להעלות —
        // דחיפת מצב ריק רק הייתה תופסת את המקום לפני המכשיר שיש בו נתונים.
        if (!hasLocalContent()) {
          meta.dirty = false;
          meta.lastServerAt = null;
          saveMeta();
          setStatus('synced');
          return;
        }
        return push().then(function () { setStatus('synced'); });
      }

      var serverChanged = row.updated_at !== meta.lastServerAt;

      if (!meta.dirty) {
        // אין שינויים מקומיים שלא הועלו — הענן הוא המקור
        if (serverChanged) adopt(row.data);
        meta.lastServerAt = row.updated_at;
        meta.lastSyncAt = new Date().toISOString();
        saveMeta();
        setStatus('synced');
        return;
      }
      if (!serverChanged) {
        // רק המכשיר הזה השתנה — בטוח להעלות
        return push().then(function () { setStatus('synced'); });
      }
      // שני הצדדים השתנו — שואלים במקום למחוק גרסה
      conflict = { data: row.data, at: row.updated_at };
      setStatus('conflict');
    }).catch(failed);
  }

  /* סנכרון יזום (חזרה למסך, חזרת רשת) — עם מרווח מזערי */
  function maybeSync() {
    var now = Date.now();
    if (now - lastAuto < POLL_GUARD) return;
    lastAuto = now;
    sync();
  }

  function getConflict() {
    if (!conflict) return null;
    return { at: conflict.at, remote: conflict.data, local: Store.state };
  }

  function resolveConflict(choice) {
    if (!conflict) return Promise.resolve();
    var c = conflict;
    conflict = null;

    if (choice === 'cloud') {
      adopt(c.data);
      meta.lastServerAt = c.at;
      meta.dirty = false;
      meta.lastSyncAt = new Date().toISOString();
      saveMeta();
      setStatus('synced');
      return Promise.resolve();
    }
    // הגרסה שבמכשיר מנצחת — מאשרים את הגרסה שראינו ודוחפים מעליה
    meta.lastServerAt = c.at;
    saveMeta();
    setStatus('syncing');
    return push().then(function () { setStatus('synced'); }).catch(failed);
  }

  /* ---------- שינוי מקומי ---------- */
  function onLocalChange() {
    if (!enabled() || !signedIn()) return;
    meta.dirty = true;
    saveMeta();
    if (status !== 'conflict') setStatus('pending');
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      if (status === 'conflict') return;
      sync();
    }, PUSH_DELAY);
  }

  function deviceLabel() {
    var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone / iPad';
    if (/Android/i.test(ua))          return 'Android';
    if (/Macintosh/i.test(ua))        return 'Mac';
    if (/Windows/i.test(ua))          return 'Windows';
    return 'דפדפן';
  }

  /* ---------- הפעלה ---------- */
  /* ---------- חזרה מקישור האישור שבמייל ---------- */
  /* Supabase מאמת את הכתובת ומפנה חזרה לאתר, כשהסשן מצורף
     לכתובת אחרי ה-# (ושגיאה, אם הקישור פג או כבר נוצל). */
  function parsePairs(str) {
    var out = {};
    (str || '').replace(/^[#?]/, '').split('&').forEach(function (part) {
      if (!part) return;
      var i = part.indexOf('=');
      var k = decodeURIComponent(i < 0 ? part : part.slice(0, i));
      var v = i < 0 ? '' : decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '));
      if (k) out[k] = v;
    });
    return out;
  }

  /* קורא את פרטי החזרה ומנקה אותם מהכתובת — טוקן התחברות
     לא אמור להישאר בשורת הכתובת, בהיסטוריה או בקישור משותף. */
  function takeAuthRedirect() {
    var p = parsePairs(location.hash);
    if (!p.access_token && !p.error && !p.error_description) {
      var q = parsePairs(location.search);
      if (!q.error && !q.error_description) return null;
      p = q;
    }
    try {
      history.replaceState(null, document.title, location.pathname);
    } catch (e) { location.hash = ''; }
    return p;
  }

  /* הסשן שחזר מהמייל אינו כולל את פרטי המשתמש, ו-pull/push
     זקוקים ל-user.id — לכן מושכים אותם לפני שמסמנים התחברות. */
  function adoptRedirect(back) {
    return api('/auth/v1/user', {
      auth: false, headers: { 'Authorization': 'Bearer ' + back.access_token }
    }).then(function (u) {
      if (!u || !u.id) throw new Error('לא התקבלו פרטי המשתמש');
      saveSession({
        access_token: back.access_token,
        refresh_token: back.refresh_token,
        expires_in: parseInt(back.expires_in, 10) || 3600,
        user: u
      });
      enterAccount();
      return sync(true).then(function () {
        return { ok: true, type: back.type || '', email: u.email || '' };
      });
    }).catch(function (e) {
      /* הטוקן שהגיע מהקישור היה תקף, ולכן האישור עצמו הצליח — רק
         ההמשך נפל. נרשם ככזה, אחרת התזכורת הייתה קופצת למי שאישר */
      if (back.type === 'signup' || back.type === 'invite') {
        var p = rawPending();
        if (p) markConfirmed(p.email);
      }
      clearSession();
      setStatus('signed-out');
      return { ok: false, message: (e && e.message) || 'ההתחברות לא הושלמה' };
    });
  }

  function listen() {
    window.addEventListener('online', maybeSync);
    window.addEventListener('focus', maybeSync);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) maybeSync();
    });
  }

  /* מחזיר Promise רק כשהגענו לכאן מקישור שבמייל, כדי שהמסך יוכל להציג חיווי */
  function init() {
    loadLocal();
    if (!enabled()) { setStatus('off'); return null; }

    var back = takeAuthRedirect();
    if (back && back.access_token) {
      setStatus('syncing');
      listen();
      return adoptRedirect(back);
    }
    if (back) {
      if (!signedIn()) setStatus('signed-out');
      return Promise.resolve({
        ok: false,
        code: back.error_code || back.error || '',
        message: back.error_description || ''
      });
    }

    if (!signedIn()) { setStatus('signed-out'); return null; }
    /* התא הפעיל וההתחברות נכתבים תמיד יחד, אבל בטעינה הראשונה אחרי
       העדכון עוד אין מצביע — והנתונים שבמכשיר שייכים למי שמחובר. */
    adoptOrUseSlot(session.user && session.user.id);
    setStatus(meta.dirty ? 'pending' : 'synced');
    sync();
    listen();
    return null;
  }

  return {
    init: init, info: info, onChange: onChange,
    enabled: enabled, signedIn: signedIn,
    signIn: signIn, signUp: signUp, signOut: signOut, resendConfirm: resendConfirm,
    sendRecovery: sendRecovery, updatePassword: updatePassword,
    pendingSignup: pendingSignup, clearPendingSignup: clearPendingSignup,
    isConfirmed: isConfirmed, markConfirmed: markConfirmed,
    deleteAccount: deleteAccount,
    sync: sync, onLocalChange: onLocalChange,
    getConflict: getConflict, resolveConflict: resolveConflict
  };
})();
