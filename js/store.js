/* ============================================================
   Store — ניהול המצב של האפליקציה ושמירה מקומית (localStorage)
   ============================================================ */
var Store = (function () {
  var KEY = 'vaad-gan-state-v1';

  /* ---------- קטגוריות ברירת מחדל של סעיפי הוצאה ---------- */
  var DEFAULT_CATEGORIES = [
    { id: 'cat-bday',    name: 'מתנה לילד ליום הולדת',            icon: '🎁', tone: 'pink' },
    { id: 'cat-holiday', name: 'מתנה לחג לילדים ולצוות',          icon: '🎊', tone: 'yellow' },
    { id: 'cat-yearend', name: 'מתנת סוף שנה לילדים ולצוות',      icon: '🎓', tone: 'green' },
    { id: 'cat-clubs',   name: 'חוגים במימון אישי',               icon: '🎨', tone: 'purple' },
    { id: 'cat-food',    name: 'כיבוד',                            icon: '🧁', tone: 'peach' },
    { id: 'cat-events',  name: 'פעילויות ותרבות',                 icon: '🎪', tone: 'blue' },
    { id: 'cat-gear',    name: 'ציוד ותחזוקה',                    icon: '🔧', tone: 'mint' },
    { id: 'cat-other',   name: 'אחר / קרן חירום',                 icon: '💗', tone: 'pink' }
  ];

  /* ---------- אמצעי תשלום ---------- */
  var PAY_METHODS = [
    { id: 'cash',     name: 'מזומן',           icon: '💵' },
    { id: 'paybox',   name: 'פייבוקס',         icon: '📱' },
    { id: 'bit',      name: 'ביט',             icon: '💜' },
    { id: 'transfer', name: 'העברה בנקאית',    icon: '🏦' },
    { id: 'check',    name: 'צ׳ק',             icon: '🧾' }
  ];

  /* ---------- קהלי יעד להוצאה ---------- */
  var AUDIENCES = [
    { id: 'children', name: 'ילדים', icon: '🧒', tone: 'blue' },
    { id: 'staff',    name: 'צוות',  icon: '👩‍🏫', tone: 'green' },
    { id: 'food',     name: 'כיבוד', icon: '🧁', tone: 'yellow' }
  ];

  /* ---------- דרגות בהיררכיית הצוות ---------- */
  var STAFF_LEVELS = [
    { id: 'lead',      name: 'גננת / מנהלת',  icon: '👩‍🏫', tone: 'purple', weight: 3 },
    { id: 'assistant', name: 'סייעת',          icon: '🧑‍🍼', tone: 'pink',   weight: 2 },
    { id: 'aide',      name: 'מטפלת / עוזרת',  icon: '🤱',   tone: 'green',  weight: 2 },
    { id: 'external',  name: 'מורה לחוג',      icon: '🎵',   tone: 'blue',   weight: 1 }
  ];

  /* ---------- שנת לימודים ברירת מחדל ---------- */
  function defaultYear() {
    var now = new Date();
    var y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1; // אוגוסט ואילך = שנה חדשה
    return {
      label: y + '/' + (y + 1),
      start: y + '-09-01',
      end: (y + 1) + '-06-30'
    };
  }

  function blankState() {
    var yr = defaultYear();
    return {
      version: 1,
      setupDone: false,
      gan: { name: '', address: '', yearLabel: yr.label, contactName: '', phone: '', email: '' },
      settings: { yearStart: yr.start, yearEnd: yr.end, currency: '₪', roundShare: 10 },
      children: [],
      staff: [],
      categories: DEFAULT_CATEGORIES.slice(),
      budgetItems: [],
      payments: [],
      expenses: [],
      ideas: [],
      events: []
    };
  }

  var state = blankState();

  /* ---------- שמירה וטעינה ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      state = migrate(parsed);
      return true;
    } catch (e) {
      console.warn('טעינת הנתונים נכשלה, מתחילים מחדש', e);
      return false;
    }
  }

  function migrate(data) {
    var base = blankState();
    Object.keys(base).forEach(function (k) {
      if (data[k] === undefined) data[k] = base[k];
    });
    // שמירה על מבנה אובייקטים מקוננים
    data.gan = Object.assign({}, base.gan, data.gan || {});
    data.settings = Object.assign({}, base.settings, data.settings || {});
    if (!Array.isArray(data.categories) || !data.categories.length) data.categories = base.categories;
    return data;
  }

  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (e) {
        console.warn('שמירה נכשלה', e);
      }
    }, 60);
  }

  /* ---------- עזרים ---------- */
  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function list(name) { return state[name] || []; }

  function find(name, id) {
    var arr = state[name] || [];
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }

  function add(name, obj) {
    if (!state[name]) state[name] = [];
    if (!obj.id) obj.id = uid(name.slice(0, 3));
    state[name].push(obj);
    save();
    return obj;
  }

  function update(name, id, patch) {
    var item = find(name, id);
    if (!item) return null;
    Object.assign(item, patch);
    save();
    return item;
  }

  function remove(name, id) {
    var arr = state[name] || [];
    var i = arr.findIndex(function (x) { return x.id === id; });
    if (i > -1) arr.splice(i, 1);
    save();
  }

  function reset() {
    state = blankState();
    save();
  }

  function exportJSON() {
    return JSON.stringify(state, null, 2);
  }

  function importJSON(text) {
    var parsed = JSON.parse(text);
    state = migrate(parsed);
    save();
  }

  /* ---------- הדגמה: נתוני דוגמה ---------- */
  function loadDemo() {
    var s = blankState();
    var Y = parseInt(s.settings.yearStart.slice(0, 4), 10);   // שנת פתיחת הלימודים
    var N = Y + 1;
    function d(year, m, day) { return year + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0'); }

    s.setupDone = true;
    s.gan.name = 'גן צבעוני';
    s.gan.address = 'רחוב הגן 12, תל אביב';
    s.gan.contactName = 'דנה לוי';
    s.gan.phone = '050-1234567';

    // [שם, תאריך לידה, הורה 1, טלפון, הורה 2, טלפון, תאריך הצטרפות]
    var kids = [
      ['נועה כהן',   d(Y - 6, 3, 12),  'שרה כהן',   '052-1234561', 'ודי כהן',   '052-1234562', ''],
      ['עידן לוי',   d(Y - 5, 6, 5),   'דנה לוי',   '054-9876543', 'אלון לוי',  '054-9876544', ''],
      ['מיכל שחר',   d(Y - 4, 11, 18), 'איתי שחר',  '050-5555555', 'יעל שחר',   '050-5555556', ''],
      ['גיא מזרחי',  d(Y - 4, 7, 3),   'יעל מזרחי', '052-4444444', '', '', ''],
      ['אלון בר',    d(Y - 5, 1, 22),  'רונית בר',  '053-7777777', '', '', d(N, 1, 1)],
      ['תמר רוזן',   d(Y - 4, 5, 9),   'שירה רוזן', '058-2222222', 'עומר רוזן', '058-2222223', ''],
      ['עומר שגב',   d(Y - 5, 9, 30),  'אורית שגב', '050-3333333', '', '', d(N, 3, 1)],
      ['עמית אלון',  d(Y - 4, 2, 14),  'קרן אלון',  '054-6666666', '', '', '']
    ];
    kids.forEach(function (k) {
      s.children.push({
        id: uid('chi'), name: k[0], birthDate: k[1], group: 'גן ב׳',
        joinDate: k[6] || '', sharePercentOverride: null, note: '',
        parents: [
          { name: k[2], phone: k[3] },
          k[4] ? { name: k[4], phone: k[5] } : null
        ].filter(Boolean)
      });
    });

    [['הדס כהן', 'גננת', 'lead'], ['נועה לוי', 'סייעת', 'assistant'],
     ['מיכל רוזן', 'סייעת', 'assistant'], ['אורית שגב', 'מטפלת', 'aide'],
     ['דנה אלון', 'מורה לחוג מוזיקה', 'external']].forEach(function (t) {
      s.staff.push({ id: uid('stf'), name: t[0], role: t[1], level: t[2], phone: '', birthDate: '' });
    });

    // [קטגוריה, שם הסעיף, סכום, תאריך יעד]
    [['cat-bday',    'מתנות ליום הולדת',              1200, d(N, 5, 15)],
     ['cat-holiday', 'מתנה לחג לילדים ולצוות',        2100, d(Y, 9, 15)],
     ['cat-yearend', 'מתנת סוף שנה לילדים ולצוות',    2400, d(N, 6, 15)],
     ['cat-clubs',   'חוגים במימון אישי',             1800, d(N, 6, 30)],
     ['cat-food',    'כיבוד לאירועים',                1680, d(N, 6, 30)],
     ['cat-other',   'קרן חירום',                     1000, '']].forEach(function (b) {
      s.budgetItems.push({ id: uid('bud'), categoryId: b[0], title: b[1], amount: b[2], date: b[3], note: '' });
    });

    [['cat-bday', 'מתנה ליומולדת של נועה', 320, d(Y, 12, 5)],
     ['cat-food', 'כיבוד לאירוע ראש השנה', 480, d(Y, 9, 20)],
     ['cat-holiday', 'מתנות חג לצוות', 1450, d(Y, 9, 22)]].forEach(function (e) {
      s.expenses.push({ id: uid('exp'), categoryId: e[0], title: e[1], amount: e[2], date: e[3], note: '', ideaId: null });
    });

    s.events.push({ id: uid('evt'), title: 'ישיבת ועד הורים', date: d(Y, 12, 9), icon: '👥', tone: 'pink', note: '', type: 'event' });
    s.events.push({ id: uid('evt'), title: 'יום גיבוש גן', date: d(N, 2, 22), icon: '🎪', tone: 'blue', note: '', type: 'event' });

    s.ideas.push({
      id: uid('ide'), title: 'מתנת סוף שנה — ספר וכוס', categoryId: 'cat-yearend',
      audiences: ['children', 'staff'], note: 'הצעה של דנה', chosen: false,
      lines: [
        { id: uid('ln'), label: 'ספר אישי', amount: 1400 },
        { id: uid('ln'), label: 'כוס עם שם', amount: 700 },
        { id: uid('ln'), label: 'אריזה', amount: 200 }
      ]
    });
    s.ideas.push({
      id: uid('ide'), title: 'מתנת סוף שנה — ערכת יצירה', categoryId: 'cat-yearend',
      audiences: ['children'], note: '', chosen: false,
      lines: [
        { id: uid('ln'), label: 'ערכת יצירה', amount: 1600 },
        { id: uid('ln'), label: 'ברכה מעוצבת', amount: 240 }
      ]
    });

    state = s;

    // תשלומים — מחושבים מול הסכום האמיתי שכל הורה חייב
    var methods = ['paybox', 'bit', 'transfer', 'cash', 'paybox', 'bit', 'transfer', 'cash'];
    s.children.forEach(function (c, i) {
      var due = Calc.childCollection(s, c).due;
      if (i % 4 === 3) return;                       // הורה אחד מכל ארבעה עדיין לא שילם
      var amount = (i % 3 === 1) ? Math.round(due / 2) : due;   // חלק שילמו חצי
      s.payments.push({
        id: uid('pay'), childId: c.id, amount: amount, method: methods[i % methods.length],
        date: d(Y, 9, 3 + i), note: '', installments: (i % 3 === 1) ? 2 : 1
      });
    });

    save();
  }

  return {
    KEY: KEY,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
    PAY_METHODS: PAY_METHODS,
    AUDIENCES: AUDIENCES,
    STAFF_LEVELS: STAFF_LEVELS,
    get state() { return state; },
    load: load, save: save, reset: reset,
    uid: uid, list: list, find: find, add: add, update: update, remove: remove,
    exportJSON: exportJSON, importJSON: importJSON, loadDemo: loadDemo,
    methodName: function (id) {
      var m = PAY_METHODS.filter(function (x) { return x.id === id; })[0];
      return m ? m.name : id;
    },
    methodIcon: function (id) {
      var m = PAY_METHODS.filter(function (x) { return x.id === id; })[0];
      return m ? m.icon : '💳';
    },
    category: function (id) {
      return find('categories', id) || { id: id, name: 'ללא קטגוריה', icon: '📌', tone: 'purple' };
    },
    audience: function (id) {
      var a = AUDIENCES.filter(function (x) { return x.id === id; })[0];
      return a || { id: id, name: id, icon: '•', tone: 'purple' };
    },
    staffLevel: function (id) {
      var l = STAFF_LEVELS.filter(function (x) { return x.id === id; })[0];
      return l || { id: id, name: 'צוות', icon: '👤', tone: 'purple', weight: 1 };
    }
  };
})();
