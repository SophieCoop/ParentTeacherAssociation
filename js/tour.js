/* ============================================================
   סיור ההיכרות — זרקור על חלקי המסך
   ------------------------------------------------------------
   רובו יושב על מסך הבית, שהוא מפה של האפליקציה. החלק השני נכנס
   פנימה אל מסך הרעיונות, כי שם יש תהליך שאי אפשר להסביר מבחוץ:
   איך נראה טופס רעיון, ומה קורה כשרעיון נבחר.

   שלב שמבקש מסך אחר (view) או טופס (modal) מקבל שהות לציור לפני
   שהזרקור נמדד — אחרת המדידה נעשית על מסך שכבר אינו קיים.

   הזרקור עצמו הוא חלון שקוף עם צל ענק סביבו, ולכן הוא חושף את
   האלמנט האמיתי ולא עותק שלו.
   ============================================================ */
var Tour = (function () {

  var KEY = 'vaad-gan-tour-v1';

  var back = null;      // שכבת החושך
  var hole = null;      // חלון הזרקור
  var bubble = null;    // בועת ההסבר
  var idx = 0;
  var steps = [];
  var live = false;
  var homeView = null;   // המסך שממנו יצאנו, כדי לחזור אליו בסיום
  var modalFn = null;    // הטופס שהסיור פתח בעצמו

  /* ---------- השלבים ---------- */
  /* target: בורר או מערך בוררים שהזרקור יקיף את כולם יחד.
     בלי target — בועה ממורכזת, בלי זרקור. */
  function stepList() {
    var list = [
      { title: 'ברוכים הבאים 👋',
        text: 'סיור קצר שמראה מה יש כאן. אפשר לדלג בכל רגע, ולהריץ אותו שוב מההגדרות.' },
      { target: '.pot',
        title: 'הקופה',
        text: 'כמה כסף נשאר מתוך מה שנאסף מההורים, וכמה ממנו כבר נוצל. זו התמונה שהכי חשוב לעקוב אחריה.' },
      { target: ['.tile[data-view="budget"]', '.tile[data-view="expenses"]'],
        title: 'תקציב והוצאות',
        text: 'בתקציב מתכננים כמה להוציא על כל נושא, ובהוצאות רושמים מה יצא בפועל. ההפרש ביניהם הוא מה שנותר.' },
      { target: '.tile[data-view="collection"]',
        title: 'גבייה מההורים',
        text: 'כמה צריך לגבות מכל ילד, מי כבר שילם ומי עוד לא. אפשר לסמן תשלומים ולשלוח תזכורת.' },
      { target: '.tile[data-view="ideas"]',
        title: 'רעיונות למתנות',
        text: 'מרכזים כאן רעיונות למתנות לצוות ולאירועים, עם פירוט עלויות — לפני שמחליטים. ניכנס לרגע פנימה.' },

      /* ---- מסך הרעיונות מקרוב ---- */
      { view: 'ideas', target: '[data-action="idea-add"]',
        title: 'פותחים רעיון חדש',
        text: 'לחיצה כאן פותחת רעיון ריק. אפשר לפתוח כמה רעיונות לאותו אירוע, להשוות ביניהם, ורק אז להחליט.' },

      { view: 'ideas', modal: openIdeaForm, target: '#field-title',
        title: 'כך נראה רעיון מלא',
        text: 'לפניכם רעיון לדוגמה לצוות החינוכי. מתחילים בשם — הוא שיופיע אחר כך ברשימת ההוצאות.' },

      { view: 'ideas', modal: openIdeaForm, target: '.staff-mix', soft: true,
        title: 'הרכב צוות הגן',
        text: 'כמה אנשים בכל דרגה, ומה החלק המומלץ לכל אחת מהן. מכאן נגזרים האחוזים שליד כל שורה.' },

      { view: 'ideas', modal: openIdeaForm, target: '#field-budgetItemId',
        title: 'סעיף התקציב',
        text: 'הרעיון נצמד לסעיף שתכננתם בתקציב, וכך רואים תוך כדי אם הוא נכנס בו או חורג ממנו.' },

      { view: 'ideas', modal: openIdeaForm, target: '#field-audiences',
        title: 'קהל היעד',
        text: 'למי המתנה — ילדים, צוות או כיבוד. הבחירה קובעת לפי כמה אנשים מחושבת העלות.' },

      { view: 'ideas', modal: openIdeaForm, target: '#f-lines',
        title: 'שורות ההוצאה',
        text: 'כל פריט בשורה משלו: מה קונים, למי בצוות, וכמה זה עולה לאדם. עמודת האחוזים מראה כמה מהסעיף כל שורה תופסת מול המומלץ לדרגה.' },

      { view: 'ideas', modal: openIdeaForm, target: '#lines-total',
        title: 'הסכום המתגלגל',
        text: 'סה״כ הרעיון מול מה שמתוכנן בסעיף — כאן רואים מיד אם הוא נכנס בתקציב.' },

      { view: 'ideas', target: '[data-action="idea-choose"]', soft: true,
        title: 'בחירת הרעיון',
        text: 'זה הרגע שבו רעיון הופך להחלטה: העלות נרשמת אוטומטית כהוצאה, והיתרה בקופה יורדת בהתאם. ביטול הבחירה מסיר את ההוצאה בחזרה.' },

      { view: 'expenses', target: ['.summary', '.exp-row'], soft: true,
        title: 'וההוצאה נרשמת כאן',
        text: 'הרעיון שנבחר נכנס לרשימה הזו עם הסכום שחושב בו, סך ההוצאות עולה בהתאם — והיתרה בקופה יורדת. מכאן והלאה זה כסף שיצא, לא תוכנית.' },
      { target: ['.tile[data-view="children"]', '.tile[data-view="staff"]'],
        title: 'ילדי הגן והצוות',
        text: 'הרשימות שמזינות את כל השאר: מספר הילדים קובע את הגבייה, והצוות קובע את חישובי המתנות.' },
      { target: ['.tile[data-view="dates"]', '.tile[data-view="yearend"]'],
        title: 'תאריכים וסוף שנה',
        text: 'ימי הולדת, חגים ואירועים — ובסוף השנה, חישוב אוטומטי של החזרים להורים.' }
    ];

    if (document.getElementById('sync-chip')) {
      list.push({ target: '#sync-chip',
        title: 'סנכרון',
        text: 'השבב מראה אם הכול שמור בענן. כך אותם נתונים נפתחים גם בטלפון וגם במחשב.' });
    }

    list.push({ target: '.tabbar',
      title: 'זהו, אפשר להתחיל 🎉',
      text: 'התפריט התחתון מלווה אתכם בכל מסך. בהצלחה!' });

    return list;
  }

  /* ---------- ניווט בתוך הסיור ---------- */
  /* הסיור הוא הגורם היחיד שמנווט בזמן שהוא רץ, ולכן די להשוות למסך
     הנוכחי כדי לא לצייר מחדש בכל שלב ולאבד את מיקום הגלילה. */
  function goTo(view) {
    if (!view || !window.App || !App.view || App.view() === view) return false;
    App.setView(view);
    return true;
  }

  /* איזה רעיון להראות בטופס. טופס ריק אינו מלמד דבר: אין בו שורות,
     אין הרכב צוות ואין אחוזים. לכן מעדיפים רעיון אמיתי של המשתמש, ובו
     דווקא רעיון לצוות — המסך שלו הוא העשיר ביותר. רק כשאין במה
     להשתמש נבנה רעיון הדגמה. */
  function tourIdea() {
    var withLines = (Store.state.ideas || []).filter(function (i) { return (i.lines || []).length; });
    var staffy = withLines.filter(function (i) {
      return (i.audiences || []).indexOf('staff') > -1;
    })[0];
    var pick = staffy || withLines[0];
    // עותק עמוק: גם אם משהו בטופס ייגע בו, הרעיון של המשתמש לא ייפגע
    if (pick) { try { return JSON.parse(JSON.stringify(pick)); } catch (e) { return pick; } }
    return demoIdea();
  }

  /* רעיון הדגמה — חי בזיכרון בלבד, לא נוסף ל-Store ולא נשמר.
     שלוש שורות לדרגות שונות, כדי שטבלת השורות ועמודת האחוזים יראו
     כמו במסך אמיתי. */
  function demoIdea() {
    var b = (Store.state.budgetItems || []).filter(function (x) {
      return (x.audiences || []).indexOf('staff') > -1;
    })[0] || (Store.state.budgetItems || [])[0];

    return {
      id: 'tour-demo',
      title: 'מתנת סוף שנה לצוות החינוכי',
      budgetItemId: b ? b.id : '',
      categoryId: b ? b.categoryId : 'cat-yearend',
      audiences: ['staff'],
      note: '',
      chosen: false,
      lines: [
        { id: 'tour-l1', label: 'עציץ',        levelId: 'lead',      amount: 45 },
        { id: 'tour-l2', label: 'כוס עם שם',   levelId: 'assistant', amount: 30 },
        { id: 'tour-l3', label: 'זר למנהלת',   levelId: 'manager',   amount: 120 }
      ]
    };
  }

  function openIdeaForm() {
    if (window.Views && Views.ideas && Views.ideas.form) Views.ideas.form(tourIdea());
  }

  /* הטופס נפתח דרך הפעולה הרגילה של המסך, ולכן אין בידנו מזהה לסגירה —
     סוגרים אותו כמו שמשתמש היה סוגר, בכפתור ה-✕ שלו. רעיון ריק שנסגר
     אינו נשמר, והסיור אינו מייצר נתונים. */
  function closeModal() {
    var x = document.querySelector('#modal-root .modal-close');
    if (x) x.click();
    modalFn = null;
  }

  /* ---------- עזרה ---------- */
  function seen() {
    try { return localStorage.getItem(KEY) === 'done'; } catch (e) { return false; }
  }
  function markSeen() {
    try { localStorage.setItem(KEY, 'done'); } catch (e) {}
  }

  /* מלבן שמקיף את כל היעדים של השלב, עם מרווח נשימה סביבם */
  function rectOf(target) {
    var sel = Array.isArray(target) ? target : [target];
    var box = null;
    sel.forEach(function (s) {
      var el = document.querySelector(s);
      if (!el) return;
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      box = box ? {
        top: Math.min(box.top, r.top), left: Math.min(box.left, r.left),
        right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom)
      } : { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
    });
    if (!box) return null;
    var pad = 6;
    return {
      top: box.top - pad, left: box.left - pad,
      width: (box.right - box.left) + pad * 2,
      height: (box.bottom - box.top) + pad * 2
    };
  }

  function firstEl(target) {
    var sel = Array.isArray(target) ? target : [target];
    for (var i = 0; i < sel.length; i++) {
      var el = document.querySelector(sel[i]);
      if (el) return el;
    }
    return null;
  }

  /* ---------- ציור ---------- */
  function bubbleHTML(s) {
    var last = idx === steps.length - 1;
    var dots = steps.map(function (_, i) {
      return '<i class="' + (i === idx ? 'on' : '') + '"></i>';
    }).join('');
    return '<div class="tour-arrow"></div>' +
      '<h4>' + UI.esc(s.title) + '</h4>' +
      '<p>' + UI.esc(s.text) + '</p>' +
      '<div class="tour-foot">' +
        '<div class="tour-dots">' + dots + '</div>' +
        '<div class="tour-btns">' +
          (last ? '' : '<button type="button" class="tour-skip">דילוג</button>') +
          '<button type="button" class="tour-next">' + (last ? 'סיום' : 'הבא') + '</button>' +
        '</div>' +
      '</div>';
  }

  function place(s) {
    var r = s.target ? rectOf(s.target) : null;

    if (!r) {   // בועה ממורכזת, בלי זרקור
      hole.style.display = 'none';
      bubble.className = 'tour-bubble center';
      bubble.style.top = '';
      bubble.style.left = '';
      bubble.style.transform = '';
      return;
    }

    hole.style.display = 'block';
    hole.style.top = r.top + 'px';
    hole.style.left = r.left + 'px';
    hole.style.width = r.width + 'px';
    hole.style.height = r.height + 'px';

    /* הבועה מתחת ליעד אם יש מקום, ומעליו אם אין. יעד שגבוה מהמסך —
       למשל אזור שורות ההוצאה בטופס רעיון מלא — אינו מותיר מקום לא
       מעליו ולא מתחתיו, ואז הבועה נצמדת לתחתית המסך ומוותרת על החץ.
       בלי זה היא נופלת מחוץ למסך, וכפתור "הבא" אינו נגיש. */
    var vh = window.innerHeight, vw = window.innerWidth;
    var bh = bubble.offsetHeight || 150;
    var below = r.top + r.height + 12;
    var above = r.top - bh - 12;
    var fitsBelow = below + bh <= vh - 10;
    var fitsAbove = above >= 10;
    var top, cls;

    if (fitsBelow)       { top = below; cls = 'below'; }
    else if (fitsAbove)  { top = above; cls = 'above'; }
    else                 { top = vh - bh - 12; cls = 'center'; }

    bubble.className = 'tour-bubble ' + cls;
    if (cls === 'center') {
      // מיקום ידני בתחתית, ולכן בלי המרכוז שמגיע עם המחלקה
      bubble.style.transform = 'none';
    } else {
      bubble.style.transform = '';
    }
    bubble.style.top = top + 'px';

    var bw = Math.min(330, vw - 24);
    bubble.style.width = bw + 'px';
    var mid = r.left + r.width / 2;
    var left = Math.max(12, Math.min(vw - bw - 12, mid - bw / 2));
    bubble.style.left = left + 'px';

    // החץ מצביע על מרכז היעד, גם כשהבועה הוסטה כדי להיכנס למסך
    var arrow = bubble.querySelector('.tour-arrow');
    if (arrow) arrow.style.insetInlineStart = '';
    if (arrow) arrow.style.left = Math.max(14, Math.min(bw - 26, mid - left - 6)) + 'px';
  }

  function show() {
    var s = steps[idx];
    if (!s) return finish();

    // שלב שמבקש מסך אחר או טופס — מציירים קודם, ומודדים אחרי
    var moved = goTo(s.view);
    if (modalFn && modalFn !== s.modal) closeModal();
    var opened = false;
    if (s.modal && modalFn !== s.modal) { s.modal(); modalFn = s.modal; opened = true; }
    if (moved || opened) { setTimeout(function () { if (live) draw(); }, 140); return; }
    draw();
  }

  function draw() {
    var s = steps[idx];
    if (!s) return finish();

    // הטופס מחזיר את הגלילה לגוף העמוד כשהוא נסגר, והסיור עדיין רץ
    document.body.style.overflow = 'hidden';

    var el = s.target ? firstEl(s.target) : null;
    /* אלמנט חסר: שלב רגיל מדלגים עליו, אבל שלב שסומן soft נושא מסר
       שאינו תלוי במה שיש על המסך — ומוצג כבועה ממורכזת */
    if (s.target && !el) {
      if (!s.soft) { idx++; return show(); }
      s = { title: s.title, text: s.text };
      steps[idx] = s;
    }

    bubble.innerHTML = bubbleHTML(s);
    bubble.querySelector('.tour-next').addEventListener('click', next);
    var skip = bubble.querySelector('.tour-skip');
    if (skip) skip.addEventListener('click', finish);

    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(function () { if (live) place(s); }, 320);
      place(s);           // מיקום ראשוני מיידי, כדי שלא תהיה הבהוב
    } else {
      place(s);
    }
  }

  function next() {
    idx++;
    if (idx >= steps.length) return finish();
    show();
  }

  function reposition() {
    if (live && steps[idx]) place(steps[idx]);
  }

  function finish() {
    markSeen();
    if (modalFn) closeModal();
    // החזרה למסך שממנו יצאנו נעשית בעוד הסיור מסומן כפעיל, כדי שלא
    // תיספר כביקור של המשתמש במדידת השימוש
    if (homeView) { goTo(homeView); homeView = null; }
    live = false;
    window.removeEventListener('resize', reposition);
    window.removeEventListener('scroll', reposition, true);
    document.removeEventListener('keydown', onKey);
    if (back) back.remove();
    back = hole = bubble = null;
    document.body.style.overflow = '';
  }

  function onKey(e) {
    if (e.key === 'Escape') finish();
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); }
  }

  /* ---------- הפעלה ---------- */
  function start() {
    if (live) return;
    steps = stepList();
    idx = 0;
    live = true;
    modalFn = null;
    homeView = (window.App && App.view) ? App.view() : null;

    back = document.createElement('div');
    back.className = 'tour-back';
    back.innerHTML = '<div class="tour-hole"></div>' +
                     '<div class="tour-bubble" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(back);
    hole = back.querySelector('.tour-hole');
    bubble = back.querySelector('.tour-bubble');

    document.body.style.overflow = 'hidden';
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('keydown', onKey);

    show();
  }

  /* ריצה אוטומטית בהגעה הראשונה למסך הבית, פעם אחת בלבד */
  function maybeStart() {
    if (live || seen()) return;
    if (!Store.state.setupDone) return;
    setTimeout(function () {
      if (!live && !seen() && document.querySelector('.tile')) start();
    }, 700);
  }

  return { start: start, maybeStart: maybeStart, seen: seen,
           running: function () { return live; } };
})();
