/* ============================================================
   App — ניתוב בין המסכים, ניווט תחתון וטיפול באירועים
   ============================================================ */
var App = (function () {

  var TABS = [
    { id: 'home',       label: 'בית' },
    { id: 'budget',     label: 'תקציב' },
    { id: 'collection', label: 'גבייה' },
    { id: 'expenses',   label: 'הוצאות' },
    { id: 'ideas',      label: 'רעיונות' },
    { id: 'dates',      label: 'תאריכים' }
  ];

  var current = 'home';
  var viewState = {};   // מצב זמני לכל מסך (לשוניות פנימיות, חודש בלוח שנה וכו')

  /* שלב האשף הוא היחיד מתוך viewState ששורד רענון. בלעדיו, מי שאישר
     את המייל באמצע ההקמה היה חוזר לדף ריק במקום להמשיך מהמקום שבו עצר.
     נשמר במכשיר בלבד ולא בענן — זהו מצב של המסך, לא נתון של הגן. */
  var WIZ_KEY = 'vaad-gan-wizard-v1';

  /* נמחק כשהאשף מגיע לסופו (wizStep חוזר ל-0) ולא כשמדלגים עליו,
     כדי ש"המשך בתהליך ההקמה" יחזיר לשלב שבו עצרנו */
  function saveWizStep() {
    try {
      var n = viewState.wizStep;
      if (!n) localStorage.removeItem(WIZ_KEY);
      else localStorage.setItem(WIZ_KEY, JSON.stringify({ step: n }));
    } catch (e) {}
  }

  function loadWizStep() {
    try {
      var raw = localStorage.getItem(WIZ_KEY);
      if (!raw) return 0;
      var n = parseInt(JSON.parse(raw).step, 10);
      return n > 0 ? n : 0;
    } catch (e) { return 0; }
  }

  function state() { return Store.state; }

  function setView(name, params) {
    current = name;
    if (params) Object.assign(viewState, params);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'auto' : 'auto' });
    render();
    try { history.replaceState(null, '', '#' + name); } catch (e) {}
    // המסכים מתחלפים בלי לעבור כתובת, ולכן הדיווח נעשה כאן ולא אוטומטית.
    // ניווט של סיור ההיכרות אינו ביקור של המשתמש ואינו נספר.
    if (window.Analytics && !(window.Tour && Tour.running && Tour.running())) Analytics.view(name);
  }

  function vs(key, def) {
    if (viewState[key] === undefined) viewState[key] = def;
    return viewState[key];
  }
  function setVs(key, val) {
    viewState[key] = val;
    if (key === 'wizStep') saveWizStep();
  }

  function tabIcon(id) {
    return UI.art(id);
  }

  function tabbar() {
    return '<nav class="tabbar">' + TABS.map(function (t) {
      var on = (t.id === current) || (current === 'children' && t.id === 'home') ||
               (current === 'staff' && t.id === 'home') ||
               (current === 'yearend' && t.id === 'expenses') || (current === 'settings' && t.id === 'home');
      return '<button data-action="nav" data-view="' + t.id + '" class="' + (on ? 'on' : '') + '">' +
        '<span class="tb-ico">' + tabIcon(t.id) + '</span><span>' + t.label + '</span></button>';
    }).join('') + '</nav>';
  }

  function render() {
    var root = document.getElementById('app');
    var st = state();

    /* כל עוד ההקמה לא הושלמה, האשף הוא המסך — גם למי שכבר מחובר
       לחשבון. פתיחת החשבון היא השלב הראשון באשף עצמו, ולכן תנאי
       שמדלג עליו בגלל התחברות היה זורק החוצה את מי שאישר את המייל
       באמצע. מי שמחובר ורק רוצה למשוך נתונים ממכשיר אחר מקבל את
       כפתור הסנכרון במסך הפתיחה של האשף.

       resumeWizard הוא חזרה מכוונת לאשף אחרי שדילגו עליו. הוא מקומי
       ולא נוגע ב-setupDone, שמסונכרן — אחרת חזרה להקמה במכשיר אחד
       הייתה פותחת את האשף גם בכל שאר המכשירים. */
    if (!st.setupDone || viewState.resumeWizard) {
      root.className = 'shell shell-plain';
      root.innerHTML = '<div class="page">' + Views.onboarding.render(vs, setVs) + '</div>';
      return;
    }

    var view = Views[current] || Views.home;
    root.className = 'shell';
    root.innerHTML = tabbar() + '<div class="page">' + view.render(vs, setVs) + '</div>';
    if (view.mount) view.mount();

    // סיור ההיכרות רץ פעם אחת, בהגעה הראשונה למסך הבית אחרי ההקמה
    if (current === 'home' && window.Tour) Tour.maybeStart();
    // סיור הרעיון מחכה בכניסה הראשונה למסך שלו
    if (current === 'ideas' && window.Tour && Tour.maybeStartIdea) Tour.maybeStartIdea();
    /* התזכורת לאישור המייל קודמת להצעת ההוספה למסך הבית: כל עוד
       החשבון לא אושר שום דבר אינו מגובה, וזה דחוף יותר */
    if (current === 'home' && window.Confirm) Confirm.maybeRemind();
    // וההצעה להוסיף את האפליקציה למסך הבית — רק אחרי כמה כניסות
    if (current === 'home' && window.Install) Install.maybeOffer();
  }

  /* ---------- אירועים גלובליים בשיטת האצלה (delegation) ---------- */
  function collectActions() {
    var map = {};
    Object.keys(Views).forEach(function (k) {
      var v = Views[k];
      if (v && v.actions) Object.keys(v.actions).forEach(function (a) { map[a] = v.actions[a]; });
    });
    map.nav = function (el) { setView(el.getAttribute('data-view')); };
    return map;
  }

  function handle(ev, attr) {
    var el = ev.target.closest ? ev.target.closest('[' + attr + ']') : null;
    if (!el) return;
    var name = el.getAttribute(attr);
    var actions = collectActions();
    var fn = actions[name];
    if (!fn) return;
    if (attr === 'data-action') ev.preventDefault();
    fn(el, ev);
  }

  function bind() {
    document.addEventListener('click', function (e) { handle(e, 'data-action'); });
    document.addEventListener('change', function (e) { handle(e, 'data-change'); });
    document.addEventListener('input', function (e) { handle(e, 'data-input'); });
    document.addEventListener('submit', function (e) {
      var el = e.target.closest('[data-submit]');
      if (!el) return;
      e.preventDefault();
      var actions = collectActions();
      var fn = actions[el.getAttribute('data-submit')];
      if (fn) fn(el, e);
    });
  }

  function init() {
    Store.load();
    bind();
    // ספירת הכניסה — לפני הציור, כדי שההצעה שבמסך הבית תראה מספר מעודכן
    if (window.Install) Install.init();
    // כשמגיעים מקישור האישור שבמייל, init מחזיר הבטחה עם תוצאת ההתחברות
    var fromEmail = null;
    if (window.Cloud) {
      fromEmail = Cloud.init();
      // עדכון שבב המצב במקום, בלי ציור מחדש שיגזול מיקוד משדות פתוחים
      Cloud.onChange(function () {
        if (Views.account) Views.account.refreshChip();
      });
    }
    // חזרה לאשף באותו שלב שבו נעצר, אחרי רענון או אחרי אישור המייל
    if (!Store.state.setupDone) {
      var saved = loadWizStep();
      if (saved) viewState.wizStep = saved;
    }

    var hash = (location.hash || '').replace('#', '');
    if (hash && Views[hash] && Store.state.setupDone) current = hash;
    render();
    if (fromEmail && fromEmail.then) {
      fromEmail.then(function (res) {
        render();
        if (Views.account) Views.account.showAuthResult(res);
      });
    }
    // המסך הראשון. מי שעדיין באשף ידווח דרך שלבי האשף עצמם.
    if (window.Analytics && Store.state.setupDone) Analytics.view(current);
  }

  return {
    init: init, render: render, setView: setView, state: state,
    vs: vs, setVs: setVs, savedWizStep: loadWizStep, TABS: TABS,
    view: function () { return current; }
  };
})();

/* הפעלה — עמידה גם במצב שבו הסקריפט נטען אחרי שהמסמך כבר מוכן */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', App.init);
} else {
  App.init();
}
