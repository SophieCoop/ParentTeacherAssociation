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
  function loadLocal() {
    try {
      var s = localStorage.getItem(SESSION_KEY);
      if (s) session = JSON.parse(s);
      var m = localStorage.getItem(META_KEY);
      if (m) {
        var parsed = JSON.parse(m);
        Object.keys(parsed).forEach(function (k) { meta[k] = parsed[k]; });
      }
    } catch (e) {}
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
    return session;
  }
  function clearSession() {
    session = null;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }
  function saveMeta() {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {}
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
    }).then(function (d) {
      saveSession(d);
      meta.lastServerAt = null;          // מכשיר חדש — משווים מול הענן מאפס
      meta.dirty = hasLocalContent();    // יש נתונים מקומיים? הם לא ייעלמו בשקט
      saveMeta();
      return sync(true);
    });
  }

  function signUp(email, password) {
    return api('/auth/v1/signup', {
      method: 'POST', auth: false, body: { email: email, password: password }
    }).then(function (d) {
      if (d && d.access_token) {
        saveSession(d);
        meta.dirty = hasLocalContent();   // מה שכבר קיים במכשיר עוד לא הועלה
        saveMeta();
        return sync(true).then(function () { return { confirmed: true }; });
      }
      return { confirmed: false };
    });
  }

  function signOut() {
    var token = session && session.access_token;
    clearSession();
    meta = { lastServerAt: null, dirty: false, lastSyncAt: null };
    saveMeta();
    conflict = null;
    setStatus('signed-out');
    if (token) {
      api('/auth/v1/logout', { method: 'POST', auth: false, headers: { 'Authorization': 'Bearer ' + token } })
        .catch(function () {});
    }
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
      if (!row) return push().then(function () { setStatus('synced'); });

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
  function init() {
    loadLocal();
    if (!enabled())  { setStatus('off');        return; }
    if (!signedIn()) { setStatus('signed-out'); return; }
    setStatus(meta.dirty ? 'pending' : 'synced');
    sync();
    window.addEventListener('online', maybeSync);
    window.addEventListener('focus', maybeSync);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) maybeSync();
    });
  }

  return {
    init: init, info: info, onChange: onChange,
    enabled: enabled, signedIn: signedIn,
    signIn: signIn, signUp: signUp, signOut: signOut,
    sync: sync, onLocalChange: onLocalChange,
    getConflict: getConflict, resolveConflict: resolveConflict
  };
})();
