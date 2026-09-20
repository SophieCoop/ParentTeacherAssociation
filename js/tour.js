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
  var IDEA_KEY = 'vaad-gan-tour-idea-v1';

  var back = null;      // שכבת החושך
  var hole = null;      // חלון הזרקור
  var bubble = null;    // בועת ההסבר
  var idx = 0;
  var steps = [];
  var live = false;
  var homeView = null;   // המסך שממנו יצאנו, כדי לחזור אליו בסיום
  var stack = [];        // מחסנית החלונות שהסיור פתח: טופס, ומעליו בוחר האנשים
  var onDone = null;     // פעולה שתרוץ בסיום (למשל פתיחת טופס ריק)

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
        text: 'מרכזים כאן רעיונות למתנות לצוות ולאירועים, עם פירוט עלויות — לפני שמחליטים. ' +
              'בכניסה הראשונה לשם יחכה סיור קצר על הרעיון עצמו.' },

      { view: 'home', target: ['.tile[data-view="children"]', '.tile[data-view="staff"]'],
        title: Lang.t('childrenOf') + ' והצוות',
        text: 'הרשימות שמזינות את כל השאר: מספר הילדים קובע את הגבייה, והצוות קובע את חישובי המתנות.' },
      { view: 'home', target: ['.tile[data-view="dates"]', '.tile[data-view="yearend"]'],
        title: 'תאריכים וסוף שנה',
        text: 'ימי הולדת, חגים ואירועים — ובסוף השנה, חישוב אוטומטי של החזרים להורים.' }
    ];

    if (document.getElementById('sync-chip')) {
      list.push({ view: 'home', target: '#sync-chip',
        title: 'סנכרון',
        text: 'השבב מראה אם הכול שמור בענן. כך אותם נתונים נפתחים גם בטלפון וגם במחשב.' });
    }

    list.push({ view: 'home', target: '.tabbar',
      title: 'זהו, אפשר להתחיל 🎉',
      text: 'התפריט התחתון מלווה אתכם בכל מסך. בהצלחה!' });

    return list;
  }

  /* שלבי הטופס עצמו. מוגדרים בנפרד כי הם משמשים גם את הסיור המלא
     וגם את הסיור הקצר שרץ בלחיצה הראשונה על "הוספת רעיון". */
  function ideaSteps() {
    var form = [openIdeaForm];
    var picker = [openIdeaForm, openPicker];
    /* הטופס מציג רעיון אמיתי של המשתמש כשיש כזה, ורק אחרת את רעיון
       ההדגמה. הטקסט מתאר את מה שנמצא על המסך, ולכן הוא נגזר מזה. */
    var demo = tourIdea().id === 'tour-demo';

    return [
      { view: 'ideas', modals: form, target: '#field-title',
        title: 'כך נראה רעיון מלא',
        text: (demo ? 'לפניכם רעיון לדוגמה לצוות החינוכי.' : 'לפניכם רעיון לצוות החינוכי.') +
              ' מתחילים בשם — הוא שיופיע אחר כך ברשימת ההוצאות.' },

      { view: 'ideas', modals: form, target: '#field-budgetItemId',
        title: 'סעיף התקציב',
        text: 'הרעיון נצמד לסעיף שתכננתם בתקציב, וכך רואים תוך כדי אם הוא נכנס בו או חורג ממנו.' },

      { view: 'ideas', modals: form, target: '#field-audiences',
        title: 'קהל היעד',
        text: 'למי המתנה — ילדים, צוות או כיבוד. הבחירה קובעת לפי כמה אנשים מחושבת העלות.' },

      { view: 'ideas', modals: form, target: '.staff-mix', soft: true,
        title: Lang.t('staffComposition'),
        text: 'כמה אנשים בכל דרגה, ומה הסכום המומלץ לכל אחד מהם. הפס שמעל הסכום מתמלא לפי שורות ההוצאה שיועדו לאותה דרגה.' },

      { view: 'ideas', modals: form, target: '#f-lines',
        title: 'שורות ההוצאה',
        text: 'כל פריט בשורה משלו: מה קונים, למי בצוות, וכמה זה עולה לאדם.' +
              (demo ? ' בדוגמה — שי ל' + Lang.t('lead') + ' ומזכרת לסייעות.' : '') },

      { view: 'ideas', modals: picker, target: '.pk-list', soft: true,
        title: 'בחירת אנשי הצוות',
        text: 'לחיצה על "למי?" פותחת את המסך הזה. מסמנים דרגה שלמה או אנשים מסוימים, ואפשר גם להוסיף שם שאינו ברשימה.' },

      { view: 'ideas', modals: picker, target: '.pk-shared', soft: true,
        title: 'פריט אחד משותף',
        text: 'מסמנים כשקונים דבר אחד לכולם — עוגה, למשל — כדי שהמחיר לא יוכפל במספר האנשים.' },

      { view: 'ideas', modals: form, target: '#lines-total',
        title: 'הסכום המתגלגל',
        text: 'סה״כ הרעיון מול מה שמתוכנן בסעיף — כאן רואים מיד אם הוא נכנס בתקציב.' },

      { view: 'ideas', target: '[data-action="idea-choose"]', soft: true,
        title: 'בחירת הרעיון',
        text: 'זה הרגע שבו רעיון הופך להחלטה: העלות נרשמת אוטומטית כהוצאה, והיתרה בקופה יורדת בהתאם. ביטול הבחירה מסיר את ההוצאה בחזרה.' },

      { view: 'expenses', target: ['.summary', '.exp-row'], soft: true,
        title: 'וההוצאה נרשמת כאן',
        text: 'הרעיון שנבחר נכנס לרשימה הזו עם הסכום שחושב בו, סך ההוצאות עולה בהתאם — והיתרה בקופה יורדת. מכאן והלאה זה כסף שיצא, לא תוכנית.' }
    ];
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
     אין הרכב צוות ואין סכומים. לכן מעדיפים רעיון אמיתי של המשתמש, ובו
     דווקא רעיון לצוות — המסך שלו הוא העשיר ביותר. רק כשאין במה
     להשתמש נבנה רעיון הדגמה. */
  function tourIdea() {
    var staffy = (Store.state.ideas || []).filter(function (i) {
      return (i.lines || []).length && (i.audiences || []).indexOf('staff') > -1;
    })[0];
    /* רק רעיון לצוות מציג את הדרגות ואת בוחר אנשי הצוות, ושלושה
       מהשלבים מדברים עליהם. רעיון לילדים היה משאיר אותם בלי מסך
       להצביע עליו, ולכן עדיף עליו רעיון ההדגמה — שהוא תמיד לצוות. */
    // עותק עמוק: גם אם משהו בטופס ייגע בו, הרעיון של המשתמש לא ייפגע
    if (staffy) { try { return JSON.parse(JSON.stringify(staffy)); } catch (e) { return staffy; } }
    return demoIdea();
  }

  /* רעיון הדגמה — חי בזיכרון בלבד, לא נוסף ל-Store ולא נשמר.
     שתי שורות לשתי דרגות, כדי שטבלת השורות וכרטיס הרכב הצוות
     ייראו כמו במסך אמיתי. */
  function demoIdea() {
    var b = (Store.state.budgetItems || []).filter(function (x) {
      return (x.audiences || []).indexOf('staff') > -1;
    })[0] || (Store.state.budgetItems || [])[0];
    var planned = b ? Calc.itemAmount(Store.state, b) : 0;

    /* המחיר בדוגמה נגזר מהסכום המומלץ לאותה דרגה, ולא נקוב מראש:
       הפס שמעל הסכום המומלץ מודד בדיוק את היחס הזה, וסכום קבוע מול
       תקציב אמיתי היה מצייר פס ריק שאינו מלמד דבר. שורה אחת קרובה
       להמלצה והשנייה בערך בחציה, כדי ששני המצבים ייראו זה לצד זה.
       בלי סעיף תקציב אין המלצה, ואז נשארים סכומים קטנים וקבועים. */
    function demoAmount(levelId, share, fallback) {
      var per = planned ? Calc.levelPerPerson(Store.state, levelId, planned) : 0;
      if (!per) return fallback;
      return Math.max(5, Math.round((per * share) / 5) * 5);
    }

    return {
      id: 'tour-demo',
      title: 'מתנת סוף שנה לצוות החינוכי',
      budgetItemId: b ? b.id : '',
      categoryId: b ? b.categoryId : 'cat-yearend',
      audiences: ['staff'],
      note: '',
      chosen: false,
      /* שתי דרגות בלבד — דוגמה צריכה להיות קלה לקריאה */
      lines: [
        { id: 'tour-l1', label: 'שי אישי',     levelId: 'lead',      amount: demoAmount('lead', 0.8, 25) },
        { id: 'tour-l2', label: 'מזכרת עם שם', levelId: 'assistant', amount: demoAmount('assistant', 0.45, 18) }
      ]
    };
  }

  function openIdeaForm() {
    if (window.Views && Views.ideas && Views.ideas.form) Views.ideas.form(tourIdea());
  }

  /* הטופס נפתח דרך הפעולה הרגילה של המסך, ולכן אין בידנו מזהה לסגירה —
     סוגרים אותו כמו שמשתמש היה סוגר, בכפתור ה-✕ שלו. רעיון ריק שנסגר
     אינו נשמר, והסיור אינו מייצר נתונים. */
  function modalCount() {
    return document.querySelectorAll('#modal-root .modal-back').length;
  }

  function closeTop() {
    var backs = document.querySelectorAll('#modal-root .modal-back');
    var top = backs[backs.length - 1];
    var x = top && top.querySelector('.modal-close');
    if (x) x.click();
    stack.pop();
  }

  /* מביא את מחסנית החלונות למצב שהשלב מבקש: סוגר מלמעלה מה שאינו
     נחוץ, ופותח את מה שחסר. כך בוחר האנשים נפתח מעל הטופס ונסגר
     בחזרה אליו, במקום שהשניים ייסגרו יחד. */
  function syncModals(want) {
    want = want || [];
    var same = 0;
    while (same < stack.length && same < want.length && stack[same] === want[same]) same++;
    while (stack.length > same) closeTop();
    var opened = false;
    for (var i = same; i < want.length; i++) {
      var before = modalCount();
      want[i]();
      /* חלון שלא נפתח — כי הפקד שפותח אותו אינו על המסך — אינו נרשם
         במחסנית. אחרת השלב הבא היה "סוגר" אותו, ובפועל סוגר את הטופס
         שמתחתיו והסיור היה ממשיך על מסך ריק. */
      if (modalCount() > before) { stack.push(want[i]); opened = true; }
    }
    return opened;
  }

  function openPicker() {
    var btn = document.querySelector('#modal-root [data-who]');
    if (btn) btn.click();
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
  /* מעל התקרה הזו שורת הנקודות ארוכה מהמקום שיש לה, ואיש גם אינו סופר
     עשרים נקודות — שם היא מוחלפת במונה קצר. סיור הרעיון, שקצר ממנה,
     ממשיך להציג נקודות. */
  var MAX_DOTS = 12;

  function bubbleHTML(s) {
    var last = idx === steps.length - 1;
    var dots = steps.length > MAX_DOTS
      ? '<span class="tour-count">שלב ' + (idx + 1) + ' מתוך ' + steps.length + '</span>'
      : steps.map(function (_, i) {
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
      back.classList.add('no-hole');   // ההחשכה עוברת לשכבה, במקום הצל שסביב הזרקור
      bubble.className = 'tour-bubble center';
      bubble.style.top = '';
      bubble.style.left = '';
      bubble.style.transform = '';
      return;
    }

    hole.style.display = 'block';
    back.classList.remove('no-hole');
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

    /* fitsAbove בדק רק את הקצה העליון, ולכן יעד שיושב נמוך במסך הניח
       את הבועה כך שתחתיתה — ואיתה הכפתורים — יורדת מתחת לקצה. כאן
       הבועה נצמדת לגבולות בכל מקרה. בועה גבוהה מהמסך נצמדת לתחתית
       דווקא, כי שם הכפתורים, ומוטב שהכותרת תיחתך מהם. */
    var fit = (bh > vh - 20) ? vh - bh - 10
                             : Math.max(10, Math.min(top, vh - bh - 10));
    /* אם היה צורך להזיז, החץ כבר אינו מצביע על היעד ואין טעם בו */
    if (Math.abs(fit - top) > 1) cls = 'center';
    top = fit;

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

    // שלב שמבקש מסך אחר או חלון — מציירים קודם, ומודדים אחרי
    var moved = goTo(s.view);
    var opened = syncModals(s.modals);
    if (moved || opened) { setTimeout(function () { if (live) draw(); }, 160); return; }
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
    while (stack.length) closeTop();
    // החזרה למסך שממנו יצאנו נעשית בעוד הסיור מסומן כפעיל, כדי שלא
    // תיספר כביקור של המשתמש במדידת השימוש
    if (homeView) { goTo(homeView); homeView = null; }
    live = false;
    var after = onDone; onDone = null;
    if (after) setTimeout(after, 120);
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
  /* הלחיצה הראשונה על "הוספת רעיון" מריצה את שלבי הטופס על רעיון
     לדוגמה, ורק בסופם נפתח הטופס הריק שהמשתמש ביקש. פעם אחת בלבד;
     בכל לחיצה אחרת מוחזר false והמסך מתנהג כרגיל. */
  function startIdea() {
    if (live) return false;
    try { if (localStorage.getItem(IDEA_KEY) === 'done') return false; } catch (e) { return false; }
    try { localStorage.setItem(IDEA_KEY, 'done'); } catch (e) {}

    /* כל שלבי הרעיון, ולא רק אלה שבתוך הטופס. הסינון ל-modals נולד
       כשהסיור הזה רץ לפני פתיחת טופס ריק ורצה רק את מה שבתוכו; מאז
       שסיור הבית אינו נכנס לרעיון, שני השלבים האחרונים — בחירת הרעיון
       וההוצאה שנרשמת ממנה — לא הוצגו בשום מקום. */
    steps = [{ title: 'ככה נראה רעיון 💡',
               text: 'נעבור יחד על רעיון לדוגמה — מה יש בו, איך הוא מחושב ומה קורה כשבוחרים בו. ' +
                     'אפשר לדלג בכל רגע.' }]
            .concat(ideaSteps());

    /* הסיור נפתח מעצמו בכניסה למסך, ולא בעקבות בקשה להוסיף רעיון,
       ולכן אינו מסיים בטופס ריק שאיש לא ביקש. שני השלבים האחרונים
       עוברים למסכים אחרים, ולכן בסופו חוזרים למסך שממנו התחלנו. */
    onDone = function () {
      if (window.App && App.setView) App.setView('ideas');
    };
    open();
    return true;
  }

  /* ריצה אוטומטית בכניסה הראשונה למסך הרעיונות, פעם אחת בלבד.
     המסך צריך להיות מצויר כבר, אחרת אין על מה להצביע. */
  function maybeStartIdea() {
    if (live) return;
    try { if (localStorage.getItem(IDEA_KEY) === 'done') return; } catch (e) { return; }
    if (!Store.state.setupDone) return;
    setTimeout(function () {
      if (!live && document.querySelector('[data-action="idea-add"]')) startIdea();
    }, 700);
  }

  function start() {
    if (live) return;
    steps = stepList();
    onDone = null;
    open();
  }

  function open() {
    idx = 0;
    live = true;
    stack = [];
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

  return { start: start, startIdea: startIdea, maybeStart: maybeStart,
           maybeStartIdea: maybeStartIdea, seen: seen,
           running: function () { return live; } };
})();
