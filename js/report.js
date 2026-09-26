/* ============================================================
   דוח אקסל — התמונה הכספית של הוועד בקובץ אחד
   ------------------------------------------------------------
   חמישה גיליונות: סיכום, ההכנסות לקופה, תכנון התקציב, ההוצאות
   בפועל, ומאזן ההחזרים להורים — האחרון רק כשיש מה להחזיר או
   להשלים. הסכומים נכתבים כמספרים ולא כטקסט, כדי שאפשר יהיה
   לסכם ולסנן אותם באקסל.

   בניית הגיליונות (sheets) היא פונקציה טהורה: מצב נכנס, מערכי
   שורות יוצאים, בלי DOM ובלי Store — ולכן היא נבדקת ב-node.
   הכתיבה לקובץ עצמה נשענת על SheetJS, שנטענת לפי דרישה מאותו
   CDN שממנו נטען ייבוא התשלומים (ראו js/views/collection.js).

   בקובץ יושבים שמות של ילדים והורים, ולכן ההורדה עוברת דרך
   אישור מדיניות הפרטיות — ראו Views.settings.
   ============================================================ */
var Report = (function () {

  var XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = XLSX_URL;
      sc.onload = function () { window.XLSX ? resolve(window.XLSX) : reject(new Error('no XLSX')); };
      sc.onerror = function () { reject(new Error('טעינת הספרייה נכשלה')); };
      document.head.appendChild(sc);
    });
  }

  /* ---------- עזרים ---------- */
  function n(v) { return Calc.round2(Calc.num(v)); }

  /* תאריך אמיתי ולא טקסט, כדי שאקסל ידע למיין ולסנן לפיו.
     נבנה מהרכיבים ולא מהמחרוזת: new Date('2026-09-01') הוא חצות
     UTC, ובאזור זמן שלילי היה נופל ליום הקודם. */
  function day(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : '';
  }

  function childName(state, id) {
    var c = (state.children || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.name : 'ללא שיוך';
  }

  function parentsOf(state, id) {
    var c = (state.children || []).filter(function (x) { return x.id === id; })[0];
    if (!c) return '';
    return (c.parents || []).map(function (p) { return p.name; })
      .filter(Boolean).join(', ');
  }

  function catName(state, id) {
    var c = (state.categories || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.name : 'ללא קטגוריה';
  }

  var AUDIENCE = {
    children: 'ילדים', staff: 'צוות', staff_edu: 'צוות חינוכי', food: 'כיבוד'
  };
  function audienceName(id) { return id ? (AUDIENCE[id] || id) : 'כללי'; }

  var BASIS = { per_person: 'לאדם', total: 'סכום כולל' };
  var PERIOD = { year: 'לשנה', month: 'לחודש' };

  function methodName(id) {
    var known = { cash: 'מזומן', paybox: 'פייבוקס', bit: 'ביט', transfer: 'העברה בנקאית', check: 'צ׳ק' };
    return known[id] || id || '';
  }

  /* ---------- הגיליונות ---------- */

  /* סיכום — התשובה ל"כמה נכנס, כמה תוכנן, כמה יצא וכמה נשאר" */
  function summarySheet(state, now) {
    var o = Calc.overview(state);
    var coll = Calc.collectionSummary(state);
    var rows = [
      ['דוח כספי — ' + (state.gan.name || Lang.t('placeOurs'))],
      ['שנת לימודים', state.gan.yearLabel || ''],
      ['הופק בתאריך', now],
      [],
      ['סעיף', 'סכום'],
      ['הכנסות — נגבה בפועל לקופה', n(o.collected)],
      ['נותר לגבות מההורים', n(coll.remaining)],
      [],
      ['תקציב מתוכנן לשנה', n(o.budget)],
      ['הוצאות בפועל', n(o.spent)],
      ['נותר מהתקציב המתוכנן', n(o.budgetLeft)],
      [],
      ['נשאר בקופה (נגבה פחות הוצאות)', n(o.cashLeft)],
      [],
      ['נתונים', ''],
      ['מספר ילדים', (state.children || []).length],
      ['מספר אנשי צוות', (state.staff || []).length],
      ['מספר תשלומים שנרשמו', (state.payments || []).length],
      ['מספר הוצאות שנרשמו', (state.expenses || []).length]
    ];
    return { name: 'סיכום', rows: rows, money: [1], widths: [38, 16] };
  }

  /* ההכנסות — כל תשלום ותשלום, ובסופם הסך הכול */
  function incomeSheet(state) {
    var rows = [['תאריך', 'שם הילד/ה', 'הורה', 'סכום', 'אמצעי תשלום', 'מספר תשלומים', 'הערה']];
    var list = (state.payments || []).slice().sort(function (a, b) {
      return String(a.date || '').localeCompare(String(b.date || ''));
    });
    list.forEach(function (p) {
      rows.push([
        /* תשלום בלי שיוך נושא את שם המשלם שהגיע מהקובץ — בלעדיו
           העמודה היתה ריקה, והדוח לא היה אומר מי שילם */
        day(p.date), childName(state, p.childId), parentsOf(state, p.childId) || p.payer || '',
        n(p.amount), methodName(p.method), Calc.num(p.installments) || 1, p.note || ''
      ]);
    });
    rows.push([]);
    rows.push(['סך הכול נגבה', '', '', n(Calc.collectedTotal(state)), '', '', '']);
    return { name: 'הכנסות', rows: rows, money: [3], dates: [0], widths: [12, 20, 24, 12, 16, 14, 28] };
  }

  /* תכנון התקציב — סעיף־סעיף, כפי שתוכנן */
  function budgetSheet(state) {
    var rows = [['קטגוריה', 'שם הסעיף', 'קהל יעד', 'אופן חישוב', 'תדירות', 'תעריף', 'סכום מתוכנן', 'תאריך יעד']];
    (state.budgetItems || []).forEach(function (b) {
      rows.push([
        catName(state, b.categoryId), b.title || catName(state, b.categoryId),
        audienceName(b.audience), BASIS[b.basis] || BASIS.total,
        PERIOD[b.period] || PERIOD.year, n(b.rate),
        n(Calc.itemAmount(state, b)), day(b.date)
      ]);
    });
    rows.push([]);
    rows.push(['סך הכול מתוכנן', '', '', '', '', '', n(Calc.budgetTotal(state)), '']);
    return { name: 'תכנון תקציב', rows: rows, money: [5, 6], dates: [7],
             widths: [22, 26, 14, 14, 10, 12, 14, 12] };
  }

  /* ההוצאות בפועל — מה שיצא מהקופה */
  function expenseSheet(state) {
    var rows = [['תאריך', 'קטגוריה', 'תיאור ההוצאה', 'קהל יעד', 'סכום', 'הערה']];
    var list = (state.expenses || []).slice().sort(function (a, b) {
      return String(a.date || '').localeCompare(String(b.date || ''));
    });
    list.forEach(function (e) {
      rows.push([
        day(e.date), catName(state, e.categoryId), e.title || '',
        audienceName(e.audience), n(e.amount), e.note || ''
      ]);
    });
    rows.push([]);
    rows.push(['', '', 'סך הכול הוצאות', '', n(Calc.expensesTotal(state)), '']);
    return { name: 'הוצאות בפועל', rows: rows, money: [4], dates: [0],
             widths: [12, 22, 30, 14, 12, 28] };
  }

  /* מאזן ההחזרים — רק כשיש מה להחזיר או מה להשלים */
  function refundSheet(state) {
    var rf = Calc.refunds(state);
    if (!(rf.totalRefund > 0 || rf.totalOwed > 0)) return null;

    var rows = [
      ['עלות בפועל לילד שהיה ' + Lang.t('placeIn') + ' כל השנה', n(rf.costPerUnit)],
      [],
      ['שם הילד/ה', 'הורה', 'שיעור השתתפות', 'שולם', 'עלות בפועל', 'מאזן', 'החזר להורה', 'להשלמה']
    ];
    rf.rows.forEach(function (r) {
      rows.push([
        r.child.name, parentsOf(state, r.child.id), n(r.percent) / 100,
        n(r.paid), n(r.fairCost), n(r.balance), n(r.refund), n(r.extraOwed)
      ]);
    });
    rows.push([]);
    rows.push(['סך הכול', '', '', n(rf.collected), n(rf.spent), n(rf.pot), n(rf.totalRefund), n(rf.totalOwed)]);
    return { name: 'החזרים להורים', rows: rows, money: [3, 4, 5, 6, 7], pct: [2],
             widths: [20, 24, 14, 12, 14, 12, 14, 12] };
  }

  /* כל הגיליונות, לפי הסדר. now מתקבל מבחוץ כדי שהבדיקה תהיה יציבה. */
  function sheets(state, now) {
    return [
      summarySheet(state, now || new Date()),
      incomeSheet(state),
      budgetSheet(state),
      expenseSheet(state),
      refundSheet(state)
    ].filter(Boolean);
  }

  /* ---------- כתיבה לקובץ ---------- */
  /* שם הקובץ באותיות לטיניות בכוונה. שם עברי ב-download של עוגן
     נזרק בחלק מהדפדפנים, והקובץ יורד בשם "download" בלי סיומת —
     גרוע בהרבה משם באנגלית. שם הוועד ממילא יושב בשורה הראשונה של
     גיליון הסיכום. */
  function fileName() {
    return 'vaad-report-' + UI.todayISO() + '.xlsx';
  }

  function build(XLSX, state) {
    var money = '#,##0.00 "' + ((state.settings && state.settings.currency) || '₪') + '"';
    var wb = XLSX.utils.book_new();
    /* גיליון בעברית נקרא מימין לשמאל. ההגדרה יושבת על החוברת ולא על
       הגיליון: ws['!views'] נקרא בטעינה אך אינו נכתב בחזרה. */
    wb.Workbook = { Views: [{ RTL: true }] };

    sheets(state).forEach(function (s) {
      var ws = XLSX.utils.aoa_to_sheet(s.rows, { cellDates: true });
      ws['!cols'] = (s.widths || []).map(function (w) { return { wch: w }; });

      /* תבנית לכל תא לפי סוג העמודה. בלעדיה הסכומים מוצגים כמספר
         יבש והתאריכים כמספר סידורי. */
      var range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (var r = range.s.r; r <= range.e.r; r++) {
        for (var c = range.s.c; c <= range.e.c; c++) {
          var cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
          if (!cell) continue;
          if (cell.t === 'd') cell.z = 'dd/mm/yyyy';
          else if (cell.t === 'n') {
            if ((s.pct || []).indexOf(c) > -1) cell.z = '0%';
            else if ((s.money || []).indexOf(c) > -1) cell.z = money;
          }
        }
      }
      XLSX.utils.book_append_sheet(wb, ws, s.name);
    });

    return wb;
  }

  /* ההורדה נעשית כאן ולא ב-XLSX.writeFile, כדי שלקובץ יהיה השם
     שקבענו לו: writeFile מוריד אותו בשם גנרי. */
  function download(state) {
    state = state || Store.state;
    return loadXLSX().then(function (XLSX) {
      var buf = XLSX.write(build(XLSX, state), { bookType: 'xlsx', type: 'array' });
      var blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      /* ב-WebView של האפליקציה אין הורדות; הקובץ נמסר לחלון השיתוף של
         הטלפון, שממנו שומרים אותו, שולחים או פותחים ב-Excel */
      if (window.Native && Native.is()) return Native.saveFile(fileName(), blob, 'דוח ועד ההורים');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName();
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      return true;
    });
  }

  return {
    sheets: sheets, fileName: fileName, download: download,
    loadXLSX: loadXLSX, build: build
  };
})();
