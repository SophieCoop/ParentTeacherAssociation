/* ============================================================
   ייבוא תשלומים מקובץ — PayBox, Excel או CSV
   ------------------------------------------------------------
   המודול הזה טהור: הוא מקבל שורות (מערך של מערכים) ומחזיר רשומות
   תשלום מזוהות, בלי לגעת ב-DOM או ב-Store — כך שהוא נבדק ב-node.
   קריאת הקובץ עצמו (FileReader / SheetJS) יושבת בתצוגת הגבייה.
   ============================================================ */
var PayImport = (function () {

  /* ---------- CSV ---------- */
  function detectDelimiter(line) {
    var best = ',', bestN = -1;
    [',', ';', '\t', '|'].forEach(function (d) {
      var n = 0, q = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') q = !q;
        else if (ch === d && !q) n++;
      }
      if (n > bestN) { bestN = n; best = d; }
    });
    return best;
  }

  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    var firstLine = text.split(/\r?\n/)[0] || '';
    var d = detectDelimiter(firstLine);
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; }
          else q = false;
        } else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === d) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        rows.push(row); row = [];
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }

  /* ---------- טקסט ---------- */
  function normName(s) {
    return String(s || '')
      .replace(/[֑-ׇ]/g, '')          // ניקוד
      .replace(/[׳״'"`״׳]/g, '')       // גרשיים וגרש
      .replace(/[()\[\]{}:,;|\/\\_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /* ---------- מספרים ותאריכים ---------- */
  function parseAmount(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    var s = String(v == null ? '' : v).replace(/[₪\s]|ILS|NIS|ש"ח|שח/g, '');
    if (!s) return NaN;
    // 1.250,50 (אירופאי) לעומת 1,250.50
    if (/^\-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(y, m, d) {
    if (!(y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return '';
    return y + '-' + pad(m) + '-' + pad(d);
  }

  function parseDate(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date) return isNaN(v) ? '' : iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === 'number') {                      // מספר סידורי של אקסל
      if (v < 20000 || v > 80000) return '';
      var d0 = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
      return iso(d0.getUTCFullYear(), d0.getUTCMonth() + 1, d0.getUTCDate());
    }
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);   // ISO
    if (m) return iso(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
    if (m) {
      var a = +m[1], b = +m[2], y = +m[3];
      if (y < 100) y += 2000;
      // ברירת המחדל ישראלית: יום/חודש. רק כשהיום אינו אפשרי מתפרש כאמריקאי.
      if (a > 12 && b <= 12) return iso(y, b, a);
      if (b > 12 && a <= 12) return iso(y, a, b);
      return iso(y, b, a);
    }
    var t = Date.parse(s);
    if (!isNaN(t)) { var d1 = new Date(t); return iso(d1.getFullYear(), d1.getMonth() + 1, d1.getDate()); }
    return '';
  }

  /* ---------- זיהוי עמודות ---------- */
  var KEYS = {
    name:   ['שם המשלם', 'שם משלם', 'משלם', 'שם', 'שם מלא', 'לקוח', 'מאת', 'שולח', 'name', 'payer', 'customer', 'from', 'sender', 'member'],
    amount: ['סכום', 'סה"כ', 'סהכ', 'סך', 'תשלום', 'amount', 'sum', 'total', 'price', 'paid'],
    date:   ['תאריך', 'מועד', 'זמן', 'date', 'time', 'created', 'paid at'],
    note:   ['תיאור', 'הערה', 'הערות', 'פרטים', 'עבור', 'מטרה', 'description', 'note', 'notes', 'details', 'memo', 'title', 'reason'],
    status: ['סטטוס', 'מצב', 'status', 'state']
  };

  function headerScore(cell, keys) {
    var c = normName(cell);
    if (!c) return 0;
    for (var i = 0; i < keys.length; i++) {
      var k = normName(keys[i]);
      if (c === k) return 3;
      if (c.indexOf(k) > -1 || k.indexOf(c) > -1 && c.length >= 3) return 1;
    }
    return 0;
  }

  /* מחפש את שורת הכותרות בעשר השורות הראשונות, וממפה ממנה עמודות.
     בלי כותרות — מנחש לפי התוכן: עמודת סכום היא המספרית ביותר, וכן הלאה. */
  function detectColumns(rows) {
    var best = { headerRow: -1, map: {}, score: 0 };
    for (var r = 0; r < Math.min(rows.length, 10); r++) {
      var row = rows[r] || [], map = {}, used = {}, total = 0;
      ['amount', 'date', 'name', 'status', 'note'].forEach(function (kind) {
        var bi = -1, bs = 0;
        row.forEach(function (cell, i) {
          if (used[i]) return;
          var s = headerScore(cell, KEYS[kind]);
          if (s > bs) { bs = s; bi = i; }
        });
        if (bi > -1) { map[kind] = bi; used[bi] = true; total += bs; }
      });
      if (map.amount !== undefined && map.name !== undefined && total > best.score) {
        best = { headerRow: r, map: map, score: total };
      }
    }
    if (best.headerRow > -1) return { headerRow: best.headerRow, map: best.map };

    // ניחוש לפי תוכן
    var width = rows.reduce(function (w, r) { return Math.max(w, r.length); }, 0);
    var stats = [];
    for (var c = 0; c < width; c++) {
      var nums = 0, dates = 0, texts = 0;
      rows.slice(0, 50).forEach(function (row) {
        var v = row[c];
        if (v === undefined || v === '') return;
        if (parseDate(v) && !(typeof v === 'number' && v < 20000)) dates++;
        else if (!isNaN(parseAmount(v))) nums++;
        else texts++;
      });
      stats.push({ c: c, nums: nums, dates: dates, texts: texts });
    }
    var byNum = stats.slice().sort(function (a, b) { return b.nums - a.nums; });
    var byDate = stats.slice().sort(function (a, b) { return b.dates - a.dates; });
    var byText = stats.slice().sort(function (a, b) { return b.texts - a.texts; });
    var map2 = {};
    if (byNum[0] && byNum[0].nums) map2.amount = byNum[0].c;
    if (byDate[0] && byDate[0].dates) map2.date = byDate[0].c;
    var textCol = byText.filter(function (s) { return s.c !== map2.amount && s.c !== map2.date && s.texts; })[0];
    if (textCol) map2.name = textCol.c;
    return { headerRow: -1, map: map2 };
  }

  var BAD_STATUS = ['בוטל', 'מבוטל', 'נכשל', 'נדחה', 'סורב', 'ממתין', 'לא שולם', 'cancel', 'fail', 'declin', 'reject', 'refund', 'pending', 'unpaid'];
  /* שורת סיכום בתחתית הדוח אינה תשלום */
  var TOTAL_WORDS = ['סהכ', 'סה כ', 'סך הכל', 'סיכום', 'total', 'sum', 'grand total', 'subtotal'];
  function isTotalRow(name) {
    var n = normName(name);
    return !n || TOTAL_WORDS.some(function (w) { return n === normName(w) || n.indexOf(normName(w)) === 0; });
  }

  /* ---------- מהשורות אל רשומות ---------- */
  function toRecords(rows, detected) {
    var map = detected.map || {}, out = [];
    if (map.amount === undefined) return out;
    rows.forEach(function (row, idx) {
      if (idx <= detected.headerRow) return;
      var amount = parseAmount(row[map.amount]);
      if (isNaN(amount) || amount <= 0) return;
      var name = map.name !== undefined ? String(row[map.name] == null ? '' : row[map.name]).trim() : '';
      var status = map.status !== undefined ? String(row[map.status] == null ? '' : row[map.status]) : '';
      var bad = BAD_STATUS.some(function (k) { return normName(status).indexOf(normName(k)) > -1; });
      out.push({
        row: idx + 1,
        name: name,
        amount: Math.round(amount * 100) / 100,
        date: map.date !== undefined ? parseDate(row[map.date]) : '',
        note: map.note !== undefined ? String(row[map.note] == null ? '' : row[map.note]).trim() : '',
        status: status.trim(),
        skipped: bad ? 'status' : (map.name !== undefined && isTotalRow(name) ? 'total' : '')
      });
    });
    return out;
  }

  /* ---------- התאמת שם משלם לילד ---------- */
  function labelsOf(child) {
    var out = [];
    (child.parents || []).forEach(function (p) { if (p && p.name) out.push(normName(p.name)); });
    if (child.name) out.push(normName(child.name));
    return out.filter(Boolean);
  }

  function matchChild(payer, children) {
    var p = normName(payer);
    if (!p) return { childId: '', level: '', candidates: [] };
    var exact = [], partial = [];
    (children || []).forEach(function (c) {
      var labels = labelsOf(c);
      if (labels.some(function (l) { return l === p; })) { exact.push(c.id); return; }
      var pt = p.split(' ');
      var hit = labels.some(function (l) {
        var lt = l.split(' ');
        if (l.indexOf(p) > -1 || p.indexOf(l) > -1) return true;          // האחד מכיל את השני
        if (pt[0] !== lt[0]) return false;                                  // שם פרטי שונה
        return pt.length === 1 || lt.length === 1 || pt[pt.length - 1] === lt[lt.length - 1];
      });
      if (hit) partial.push(c.id);
    });
    if (exact.length === 1) return { childId: exact[0], level: 'exact', candidates: exact };
    if (exact.length > 1) return { childId: '', level: 'ambiguous', candidates: exact };
    if (partial.length === 1) return { childId: partial[0], level: 'partial', candidates: partial };
    if (partial.length > 1) return { childId: '', level: 'ambiguous', candidates: partial };
    return { childId: '', level: '', candidates: [] };
  }

  /* ---------- תוכנית ייבוא: התאמות וכפילויות ---------- */
  function importPlan(records, children, payments) {
    var existing = {};
    (payments || []).forEach(function (p) {
      existing[p.childId + '|' + Math.round(Calcish(p.amount) * 100) + '|' + (p.date || '')] = true;
    });
    return records.map(function (r) {
      var m = matchChild(r.name, children);
      var dup = !!(m.childId && existing[m.childId + '|' + Math.round(r.amount * 100) + '|' + (r.date || '')]);
      return Object.assign({}, r, {
        childId: m.childId, level: m.level, candidates: m.candidates,
        duplicate: dup,
        skipped: r.skipped || (dup ? 'duplicate' : '')
      });
    });
  }
  function Calcish(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  return {
    parseCSV: parseCSV, normName: normName, parseAmount: parseAmount, parseDate: parseDate,
    detectColumns: detectColumns, toRecords: toRecords, matchChild: matchChild, importPlan: importPlan,
    KINDS: ['name', 'amount', 'date', 'note', 'status']
  };
})();
