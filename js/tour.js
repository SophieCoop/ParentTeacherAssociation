/* ============================================================
   סיור ההיכרות — זרקור על חלקי מסך הבית
   ------------------------------------------------------------
   מסך הבית הוא מפה של האפליקציה: כל אריח מוביל למסך אחר. לכן
   הסיור כולו יושב עליו ואינו מנווט בין מסכים — מה שמונע מצב שבו
   ציור מחדש של מסך אחר מושך את הקרקע מתחת לזרקור.

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
        text: 'מרכזים כאן רעיונות למתנות לצוות ולאירועים, עם פירוט עלויות — לפני שמחליטים.' },
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
      return;
    }

    hole.style.display = 'block';
    hole.style.top = r.top + 'px';
    hole.style.left = r.left + 'px';
    hole.style.width = r.width + 'px';
    hole.style.height = r.height + 'px';

    /* הבועה מתחת ליעד אם יש מקום, ומעליו אם אין */
    var vh = window.innerHeight, vw = window.innerWidth;
    var bh = bubble.offsetHeight || 150;
    var below = r.top + r.height + 12;
    var above = r.top - bh - 12;
    var onTop = (below + bh > vh - 10) && above > 10;

    bubble.className = 'tour-bubble ' + (onTop ? 'above' : 'below');
    bubble.style.top = (onTop ? above : below) + 'px';

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

    var el = s.target ? firstEl(s.target) : null;
    if (s.target && !el) { idx++; return show(); }   // האלמנט לא קיים — מדלגים על השלב

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
    live = false;
    markSeen();
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

  return { start: start, maybeStart: maybeStart, seen: seen };
})();
