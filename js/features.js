/* ============================================================
   דגלי תכונות — מה דלוק ומה כבוי, בלי פריסה מחדש
   ------------------------------------------------------------
   הערכים שב-js/config.js הם ברירת המחדל, והם הקובעים כל עוד אין
   תשובה מהשרת: אפליקציה שנטענת בלי רשת, או לפני שהטבלה נקראה,
   מתנהגת בדיוק כפי שהיא מתנהגת היום. מה שיושב בטבלה
   feature_flags גובר עליהם.

   שלושה מועדים שבהם הדגלים מתעדכנים:
   1. מיד עם הטעינה, מהמטמון שבמכשיר — לפני הציור הראשון, כדי שלא
      יהיה הבזק של מסך אחד שמתחלף באחר.
   2. מיד אחרי זה, מהשרת ברקע. אם משהו השתנה, המסך מצויר מחדש.
   3. בכל חזרה ללשונית — כך שכיבוי דחוף תופס גם אצל מי שהשאיר את
      האפליקציה פתוחה.

   הקריאה פתוחה לכולם ואינה דורשת התחברות: אין כאן מידע אישי, ורק
   בעלת האתר יכולה לכתוב (ראו מדיניות ה-RLS שעל הטבלה).
   ============================================================ */
(function () {
  if (typeof Features === 'undefined' || !Features) return;

  var KEY = 'vaad-gan-flags-v1';

  function cached() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function remember(map) {
    try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (e) {}
  }

  /* מחיל מפה של דגלים ומחזיר אם משהו באמת השתנה */
  function apply(map) {
    var changed = false;
    Object.keys(map || {}).forEach(function (k) {
      var v = !!map[k];
      if (Features[k] !== v) { Features[k] = v; changed = true; }
    });
    return changed;
  }

  apply(cached());

  var busy = false, last = 0;

  function refresh() {
    if (busy || !window.CloudConfig || !CloudConfig.url || !CloudConfig.key) return;
    var now = Date.now();
    if (now - last < 20000) return;   // חזרה ללשונית אינה סיבה להציף את השרת
    last = now;
    busy = true;

    fetch(CloudConfig.url.replace(/\/+$/, '') + '/rest/v1/feature_flags?select=key,enabled', {
      headers: { apikey: CloudConfig.key }
    }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (rows) {
      busy = false;
      if (!rows || !rows.length) return;
      var map = {};
      rows.forEach(function (row) { if (row && row.key) map[row.key] = !!row.enabled; });
      remember(map);
      /* ציור מחדש רק כששינוי באמת קרה, ולא באמצע אשף ההקמה או
         כשחלון פתוח — שם ציור מחדש היה מוחק מה שהוקלד */
      if (apply(map) && window.App && App.render &&
          !document.querySelector('#modal-root .modal-back')) {
        App.render();
      }
    }, function () { busy = false; });
  }

  refresh();
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) refresh();
  });
})();
