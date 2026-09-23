/* ============================================================
   עזר התקציב — הצעת חלוקה של סכום ידוע בין סעיפים מוכרים
   ------------------------------------------------------------
   הכיוון "גבייה קודם" משאיר את הוועד עם סכום ביד ובלי תשובה לשאלה
   מה עושים איתו. כאן יושבת ההצעה: אילו סעיפים נפוצים, איזה משקל
   יש לכל אחד, ואילו שינויים ברשימת הסעיפים יוצאים מהבחירה.

   המודול אינו נוגע ב-Store ואינו מצייר. הוא מקבל מצב ומחזיר מספרים
   ושינויים, והמסך (js/views/budget.js) מחיל אותם — כך אפשר לבדוק
   את ההצעה בלי דפדפן.

   שני עקרונות שמכתיבים את הצורה:
   • סעיף קיים לעולם אינו נמחק. גם "חלוקה מחדש" רק מעדכנת את הסכום
     שלו, כי ייתכן שכבר נרשמו עליו הוצאות.
   • כל סעיף שנוצר כאן הוא סכום כולל ("לכולם"), כך שסכום הסעיפים
     שווה בדיוק לסכום שחולק, גם כשיש ילדים שהצטרפו באמצע השנה.
   ============================================================ */
var BudgetPlan = (function () {

  /* המשקלות לקוחים מהתפלגות מקובלת בוועדי גנים, והם רק נקודת פתיחה:
     כל סכום בהצעה ניתן לעריכה לפני שהוא נשמר. */
  var CHOICES = [
    { id: 'yearend_kids',  name: 'מתנות סוף שנה לילדים',        cat: 'cat-yearend', audience: 'children',  weight: 20, art: 'cat-holiday' },
    { id: 'yearend_staff', name: 'מתנות סוף שנה לצוות החינוכי', cat: 'cat-yearend', audience: 'staff_edu', weight: 17, art: 'cat-yearend' },
    { id: 'party',         name: 'מסיבת סוף שנה',               cat: 'cat-events',  audience: 'children',  weight: 13, art: 'cat-events' },
    { id: 'holidays',      name: 'מתנות לחג',                   cat: 'cat-holiday', audience: 'children',  weight: 0,  art: 'cat-holiday' },
    { id: 'birthdays',     name: 'ימי הולדת לילדים',            cat: 'cat-bday',    audience: 'children',  weight: 10, art: 'cat-bday' },
    { id: 'clubs',         name: 'חוגים ומימון אישי',           cat: 'cat-clubs',   audience: 'children',  weight: 12, art: 'cat-clubs' },
    { id: 'gear',          name: 'ציוד ותחזוקה',                cat: 'cat-gear',    audience: '',          weight: 7,  art: 'cat-gear' },
    { id: 'food',          name: 'כיבוד ואירועים נוספים',       cat: 'cat-food',    audience: '',          weight: 10, art: 'cat-food' },
    { id: 'reserve',       name: 'רזרבה / הוצאות בלתי צפויות',  cat: 'cat-other',   audience: '',          weight: 10, art: 'cat-other' }
  ];

  /* מה שמסומן כשפותחים את העזר בתקציב ריק — הסעיפים שכמעט כל ועד מתכנן */
  var DEFAULT_PICKS = ['yearend_kids', 'yearend_staff', 'party', 'holidays'];

  /* משקל החגים תלוי במספר החגים: ארבעה חגים שווים יחד כרבע מהתקציב */
  var HOLIDAY_WEIGHT = 23 / 4;

  /* heb — היום והחודש העבריים, שמהם נגזר התאריך המדויק בשנה הנוכחית.
     approx — [הפרש שנים משנת הפתיחה, חודש, יום] למקרה שהדפדפן אינו
     מכיר את הלוח העברי: תאריך קרוב מספיק כדי לקבוע מי השתתף. */
  var HOLIDAYS = [
    { id: 'rosh',     name: 'ראש השנה',    gift: 'מתנה לראש השנה',   when: 'ספטמבר–אוקטובר', icon: '🍯', heb: [1, 'tish'],    approx: [0, 9, 20] },
    { id: 'hanukkah', name: 'חנוכה',       gift: 'מתנה לחנוכה',      when: 'דצמבר',          icon: '🕎', heb: [25, 'kislev'], approx: [0, 12, 20] },
    { id: 'family',   name: 'יום המשפחה',  gift: 'מתנה ליום המשפחה', when: 'פברואר',         icon: '👨‍👩‍👧', heb: [30, 'sh'],     approx: [1, 2, 15] },
    { id: 'purim',    name: 'פורים',       gift: 'מתנה לפורים',      when: 'מרץ',            icon: '🎭', heb: [14, 'adar'],   approx: [1, 3, 10] },
    { id: 'pesach',   name: 'פסח',         gift: 'מתנה לפסח',        when: 'אפריל',          icon: '🫓', heb: [15, 'nisan'],  approx: [1, 4, 10] },
    { id: 'shavuot',  name: 'שבועות',      gift: 'מתנה לשבועות',     when: 'מאי–יוני',       icon: '🌾', heb: [6, 'sivan'],   approx: [1, 5, 25] }
  ];
  var DEFAULT_HOLIDAYS = ['rosh', 'hanukkah', 'family', 'purim'];

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function choice(id) { return CHOICES.filter(function (c) { return c.id === id; })[0] || null; }
  function holiday(id) { return HOLIDAYS.filter(function (h) { return h.id === id; })[0] || null; }

  function pad(n) { return ('0' + n).slice(-2); }

  /* ---------- תאריכי החגים ----------
     החגים זזים משנה לשנה, ותאריך היעד של סעיף קובע מי משתתף בו
     (ילד שהצטרף אחרי חנוכה אינו משלם על מתנת חנוכה). לכן התאריך
     נמצא בלוח העברי של הדפדפן, יום אחרי יום בתוך שנת הלימודים. */
  var hebFmt;
  function hebParts(d) {
    if (hebFmt === undefined) {
      try { hebFmt = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long', timeZone: 'UTC' }); }
      catch (e) { hebFmt = null; }
    }
    if (!hebFmt || !hebFmt.formatToParts) return null;
    var out = {};
    hebFmt.formatToParts(d).forEach(function (p) { out[p.type] = p.value; });
    return { day: parseInt(out.day, 10), month: String(out.month || '').toLowerCase() };
  }

  /* פורים בשנה מעוברת חל באדר ב׳, ואדר א׳ אינו החודש שלו */
  function monthMatches(month, key) {
    if (key === 'adar') return month === 'adar' || month === 'adar ii';
    if (key === 'sh') return month.indexOf('sh') === 0 && month.indexOf('v') > -1;   // Shevat / Shvat
    return month.indexOf(key) === 0;
  }

  function parseISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  }

  function holidayDate(settings, id) {
    var h = holiday(id);
    if (!h) return '';
    var start = parseISO(settings && settings.yearStart);
    var end = parseISO(settings && settings.yearEnd);
    var y0 = start ? start.getUTCFullYear() : new Date().getFullYear();

    if (start && end && end > start && hebParts(start)) {
      for (var d = new Date(start.getTime()), guard = 0; d <= end && guard < 400; guard++) {
        var p = hebParts(d);
        if (p && p.day === h.heb[0] && monthMatches(p.month, h.heb[1])) {
          return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
        }
        d.setUTCDate(d.getUTCDate() + 1);
      }
    }
    return (y0 + h.approx[0]) + '-' + pad(h.approx[1]) + '-' + pad(h.approx[2]);
  }

  /* ---------- איזה סעיף קיים שייך לאיזו בחירה ----------
     סעיף שנוצר כאן נושא את הבחירה שלו ב-plan. סעיף ישן, או כזה
     שהוזן ביד, משויך לפי הקטגוריה — וכך מי שחוזר לעזר באמצע השנה
     מוצא את מה שכבר תכנן מסומן. */
  function holidayOfTitle(title) {
    var t = String(title || '');
    var h = HOLIDAYS.filter(function (x) { return t.indexOf(x.name) > -1; })[0];
    return h ? h.id : '';
  }

  function keyOf(item) {
    if (!item) return null;
    if (item.plan) {
      var parts = String(item.plan).split(':');
      if (choice(parts[0])) return { choice: parts[0], holiday: parts[1] || '' };
    }
    var title = String(item.title || '');
    switch (item.categoryId) {
      case 'cat-holiday': return { choice: 'holidays', holiday: holidayOfTitle(title) };
      case 'cat-yearend':
        if (title.indexOf('מסיב') > -1) return { choice: 'party', holiday: '' };
        return { choice: item.audience === 'staff_edu' ? 'yearend_staff' : 'yearend_kids', holiday: '' };
      case 'cat-bday':   return { choice: 'birthdays', holiday: '' };
      case 'cat-events': return { choice: 'party', holiday: '' };
      case 'cat-clubs':  return { choice: 'clubs', holiday: '' };
      case 'cat-food':   return { choice: 'food', holiday: '' };
      case 'cat-gear':   return { choice: 'gear', holiday: '' };
      case 'cat-other':  return { choice: 'reserve', holiday: '' };
    }
    return null;
  }

  /* מה לסמן כשהעזר נפתח: בתקציב ריק — ברירת המחדל, ובתקציב קיים —
     מה שכבר נמצא בו */
  function initialPicks(state) {
    var items = (state && state.budgetItems) || [];
    if (!items.length) return { picks: DEFAULT_PICKS.slice(), holidays: DEFAULT_HOLIDAYS.slice() };
    var picks = [], hols = [];
    items.forEach(function (b) {
      var k = keyOf(b);
      if (!k) return;
      if (picks.indexOf(k.choice) < 0) picks.push(k.choice);
      if (k.holiday && hols.indexOf(k.holiday) < 0) hols.push(k.holiday);
    });
    if (picks.indexOf('holidays') > -1 && !hols.length) hols = DEFAULT_HOLIDAYS.slice();
    return {
      picks: CHOICES.map(function (c) { return c.id; }).filter(function (id) { return picks.indexOf(id) > -1; }),
      holidays: HOLIDAYS.map(function (h) { return h.id; }).filter(function (id) { return hols.indexOf(id) > -1; })
    };
  }

  /* ---------- עיגול ----------
     הצעה של 2,537 ₪ נראית כמו חישוב ולא כמו המלצה. הסכומים מעוגלים
     לפי גודל התקציב, והשארית נופלת על הרזרבה — או על הסעיף הגדול
     ביותר — כדי שהסך יישאר בדיוק הסכום שחולק. */
  function roundStep(total, rows) {
    if (total >= 10000) return 100;
    if (total >= 2000) return 50;
    if (total >= rows * 20) return 10;
    return 1;
  }

  function split(total, weights, sinkIndex) {
    total = Math.max(0, Math.round(num(total)));
    var sum = weights.reduce(function (s, w) { return s + w; }, 0);
    if (!weights.length) return [];
    if (sum <= 0 || total <= 0) return weights.map(function () { return 0; });

    var step = roundStep(total, weights.length);
    var out = weights.map(function (w) { return Math.round(total * w / sum / step) * step; });
    var diff = total - out.reduce(function (s, v) { return s + v; }, 0);
    var sink = sinkIndex > -1 ? sinkIndex : out.indexOf(Math.max.apply(null, out));
    out[sink] += diff;
    /* עיגול כלפי מעלה בכמה סעיפים עלול להפוך את הסעיף הקולט לשלילי
       בתקציב זעיר — ואז מתחלקים בלי עיגול בכלל */
    if (out[sink] < 0) {
      out = weights.map(function (w) { return Math.floor(total * w / sum); });
      out[sink] += total - out.reduce(function (s, v) { return s + v; }, 0);
    }
    return out;
  }

  /* ---------- ההצעה ----------
     opts: { picks, holidays, mode: 'keep' | 'reset', available }

     keep  — הסעיפים הקיימים נשארים בסכומם, וההצעה מחלקת רק את
             היתרה, בין הבחירות שעוד אין להן סעיף.
     reset — כל הבחירות מקבלות סכום חדש מתוך כל התקציב. סעיפים
             קיימים שלא נבחרו נשארים כמות שהם ונספרים כ"קבוע".

     מחזיר את השורות להצגה, יחד עם הסעיפים שכל שורה תעדכן. */
  function propose(state, amountOf, opts) {
    var items = (state && state.budgetItems) || [];
    var mode = opts.mode === 'reset' ? 'reset' : 'keep';
    var picks = CHOICES.filter(function (c) { return (opts.picks || []).indexOf(c.id) > -1; });
    var hols = HOLIDAYS.filter(function (h) { return (opts.holidays || []).indexOf(h.id) > -1; });

    var byChoice = {}, byHoliday = {};
    items.forEach(function (b) {
      var k = keyOf(b);
      if (!k) return;
      (byChoice[k.choice] = byChoice[k.choice] || []).push(b);
      if (k.choice === 'holidays' && k.holiday) (byHoliday[k.holiday] = byHoliday[k.holiday] || []).push(b);
    });

    var planned = items.reduce(function (s, b) { return s + amountOf(b); }, 0);
    var rows = [];
    var replaced = {};   // מזהי הסעיפים שהסכום שלהם ייקבע מחדש

    picks.forEach(function (c) {
      if (c.id === 'holidays') {
        var chosen = hols.filter(function (h) { return mode === 'reset' || !byHoliday[h.id]; });
        if (!chosen.length) return;
        chosen.forEach(function (h) {
          (byHoliday[h.id] || []).forEach(function (b) { replaced[b.id] = true; });
        });
        rows.push({ id: c.id, choice: c, holidays: chosen, weight: HOLIDAY_WEIGHT * chosen.length });
        return;
      }
      var existing = byChoice[c.id] || [];
      if (mode === 'keep' && existing.length) return;
      existing.forEach(function (b) { replaced[b.id] = true; });
      rows.push({ id: c.id, choice: c, targets: existing, weight: c.weight });
    });

    var fixed = items.reduce(function (s, b) { return s + (replaced[b.id] ? 0 : amountOf(b)); }, 0);
    var available = Math.max(0, Math.round(num(opts.available)));
    var toSplit = Math.max(0, available - Math.round(fixed));

    var sink = -1;
    rows.forEach(function (r, i) { if (r.id === 'reserve') sink = i; });
    var amounts = split(toSplit, rows.map(function (r) { return r.weight; }), sink);
    rows.forEach(function (r, i) { r.amount = amounts[i]; });

    return {
      mode: mode, available: available, planned: Math.round(planned),
      fixed: Math.round(fixed), toSplit: toSplit, rows: rows,
      hasExisting: items.length > 0
    };
  }

  /* ---------- מהצעה לשינויים ברשימת הסעיפים ----------
     amounts — הסכומים הסופיים לפי מזהה שורה, אחרי העריכה של המשתמש.
     מחזיר { add: [נתוני סעיף חדש], update: [{ id, data }] }. */
  function newItem(c, title, amount, date, plan) {
    return {
      categoryId: c.cat, title: title, date: date || '', note: '',
      audience: c.audience, basis: 'total', period: 'year', rate: amount,
      periods: [], startDate: '', endDate: '', amount: amount, plan: plan
    };
  }

  function amountPatch(amount) {
    return { basis: 'total', period: 'year', rate: amount, periods: [], startDate: '', endDate: '', amount: amount };
  }

  /* סכום אחד בין כמה יעדים, לפי המשקלות ובשלמים */
  function spread(total, weights) {
    var sum = weights.reduce(function (s, w) { return s + w; }, 0);
    if (sum <= 0) weights = weights.map(function () { return 1; });
    return split(total, weights, 0);
  }

  function changes(state, plan, amounts, amountOf) {
    var add = [], update = [];
    var settings = (state && state.settings) || {};
    var items = (state && state.budgetItems) || [];

    plan.rows.forEach(function (r) {
      var total = Math.max(0, Math.round(num(amounts && amounts[r.id] !== undefined ? amounts[r.id] : r.amount)));
      var c = r.choice;

      if (r.holidays) {
        var parts = spread(total, r.holidays.map(function () { return 1; }));
        r.holidays.forEach(function (h, i) {
          var existing = items.filter(function (b) {
            var k = keyOf(b);
            return k && k.choice === 'holidays' && k.holiday === h.id;
          });
          if (existing.length) {
            var sub = spread(parts[i], existing.map(function (b) { return amountOf(b); }));
            existing.forEach(function (b, j) { update.push({ id: b.id, data: amountPatch(sub[j]) }); });
          } else {
            add.push(newItem(c, h.gift, parts[i], holidayDate(settings, h.id), 'holidays:' + h.id));
          }
        });
        return;
      }

      if (r.targets && r.targets.length) {
        var shares = spread(total, r.targets.map(function (b) { return amountOf(b); }));
        r.targets.forEach(function (b, j) { update.push({ id: b.id, data: amountPatch(shares[j]) }); });
      } else {
        add.push(newItem(c, c.name, total, '', c.id));
      }
    });

    return { add: add, update: update };
  }

  return {
    CHOICES: CHOICES, HOLIDAYS: HOLIDAYS,
    DEFAULT_PICKS: DEFAULT_PICKS, DEFAULT_HOLIDAYS: DEFAULT_HOLIDAYS,
    choice: choice, holiday: holiday, keyOf: keyOf,
    initialPicks: initialPicks, holidayDate: holidayDate,
    split: split, propose: propose, changes: changes
  };
})();
