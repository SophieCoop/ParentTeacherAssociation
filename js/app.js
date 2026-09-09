/* ============================================================
   App — ניתוב בין המסכים, ניווט תחתון וטיפול באירועים
   ============================================================ */
var App = (function () {

  var TABS = [
    { id: 'home',       icon: '🏠', label: 'בית' },
    { id: 'budget',     icon: '🧮', label: 'תקציב' },
    { id: 'collection', icon: '💰', label: 'גבייה' },
    { id: 'expenses',   icon: '🧾', label: 'הוצאות' },
    { id: 'ideas',      icon: '💡', label: 'רעיונות' }
  ];

  var current = 'home';
  var viewState = {};   // מצב זמני לכל מסך (לשוניות פנימיות, חודש בלוח שנה וכו')

  function state() { return Store.state; }

  function setView(name, params) {
    current = name;
    if (params) Object.assign(viewState, params);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'auto' : 'auto' });
    render();
    try { history.replaceState(null, '', '#' + name); } catch (e) {}
  }

  function vs(key, def) {
    if (viewState[key] === undefined) viewState[key] = def;
    return viewState[key];
  }
  function setVs(key, val) { viewState[key] = val; }

  function tabbar() {
    return '<nav class="tabbar">' + TABS.map(function (t) {
      var on = (t.id === current) || (current === 'children' && t.id === 'home') ||
               (current === 'staff' && t.id === 'home') || (current === 'dates' && t.id === 'home') ||
               (current === 'yearend' && t.id === 'expenses') || (current === 'settings' && t.id === 'home');
      return '<button data-action="nav" data-view="' + t.id + '" class="' + (on ? 'on' : '') + '">' +
        '<span class="tb-ico">' + t.icon + '</span><span>' + t.label + '</span></button>';
    }).join('') + '</nav>';
  }

  function render() {
    var root = document.getElementById('app');
    var st = state();

    if (!st.setupDone) {
      root.className = 'shell shell-plain';
      root.innerHTML = '<div class="page">' + Views.onboarding.render(vs, setVs) + '</div>';
      return;
    }

    var view = Views[current] || Views.home;
    root.className = 'shell';
    root.innerHTML = tabbar() + '<div class="page">' + view.render(vs, setVs) + '</div>';
    if (view.mount) view.mount();
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
    if (window.Cloud) {
      Cloud.init();
      // עדכון שבב המצב במקום, בלי ציור מחדש שיגזול מיקוד משדות פתוחים
      Cloud.onChange(function () {
        if (Views.account) Views.account.refreshChip();
      });
    }
    var hash = (location.hash || '').replace('#', '');
    if (hash && Views[hash] && Store.state.setupDone) current = hash;
    render();
  }

  return {
    init: init, render: render, setView: setView, state: state,
    vs: vs, setVs: setVs, TABS: TABS
  };
})();

/* הפעלה — עמידה גם במצב שבו הסקריפט נטען אחרי שהמסמך כבר מוכן */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', App.init);
} else {
  App.init();
}
