/* ============================================================
   Analytics — מדידת שימוש (Vercel Web Analytics)
   ------------------------------------------------------------
   באפליקציה יושבים שמות של ילדים, שמות הורים ומספרי טלפון.
   לכן המודול הזה בנוי כרשימה סגורה: רק שמות אירועים ומסכים
   שמופיעים כאן נשלחים, וכל ערך אחר נזרק. שינוי עתידי בקוד לא
   יוכל להדליף שדה מהנתונים דרך כאן, גם לא בטעות.

   בלי Vercel (פיתוח מקומי) הסקריפט לא נטען, הקריאות נאספות
   לתור ריק ונעלמות — ואין שום השפעה על האפליקציה.
   ============================================================ */
var Analytics = (function () {

  /* המסכים שמותר לדווח עליהם — מקבילים ל-Views שבאפליקציה */
  var SCREENS = [
    'home', 'budget', 'collection', 'expenses', 'ideas', 'dates',
    'children', 'staff', 'yearend', 'settings'
  ];

  /* שמות האירועים המותרים, והערכים המותרים לכל שדה בהם */
  var EVENTS = {
    'view':        { screen: SCREENS },
    'wizard-step': { step: ['1', '2', '3', '4', '5'] },
    'setup-done':  { account: ['yes', 'no'] },
    'account':     { action: ['signup', 'signin', 'confirmed'] }
  };

  function send(name, data) {
    var allowed = EVENTS[name];
    if (!allowed) return;
    if (typeof window === 'undefined' || typeof window.va !== 'function') return;

    // כל שדה נבדק מול הערכים המותרים שלו; מה שלא ברשימה לא נשלח
    var clean = {};
    Object.keys(data || {}).forEach(function (k) {
      var values = allowed[k];
      var v = String(data[k]);
      if (values && values.indexOf(v) > -1) clean[k] = v;
    });

    // שדה שנפסל מבטל את האירוע כולו. אירוע ריק אינו אומר דבר, והוא
    // עדיין נספר במכסה החודשית.
    var expected = Object.keys(allowed);
    for (var i = 0; i < expected.length; i++) {
      if (!(expected[i] in clean)) return;
    }

    try { window.va('event', { name: name, data: clean }); } catch (e) {}
  }

  return {
    /* מעבר בין מסכי האפליקציה */
    view: function (screen) { send('view', { screen: screen }); },

    /* התקדמות באשף ההקמה — כדי לראות היכן נוטשים */
    wizardStep: function (n) { send('wizard-step', { step: n }); },

    /* סיום ההקמה, עם או בלי חשבון */
    setupDone: function (hasAccount) { send('setup-done', { account: hasAccount ? 'yes' : 'no' }); },

    /* פעולות חשבון — בלי כתובת המייל, כמובן */
    account: function (action) { send('account', { action: action }); }
  };
})();
