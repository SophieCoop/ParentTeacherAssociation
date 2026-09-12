/* ============================================================
   Calc — מנוע החישובים
   תקציב, גבייה יחסית לילדים שהצטרפו באמצע שנה, הוצאות והחזרים
   ============================================================ */
var Calc = (function () {

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }
  function round2(n) { return Math.round(n * 100) / 100; }

  /* ---------- תאריכים ---------- */
  function toDate(str) {
    if (!str) return null;
    var d = new Date(str + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }
  function monthsBetween(a, b) {
    // מספר החודשים המלאים-בקירוב בין שני תאריכים (כולל שברי חודש)
    if (!a || !b) return 0;
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() - a.getDate()) / 30;
  }

  /* ---------- נוכחות ילד בתאריך ---------- */
  /* ילד משתתף בהוצאה רק אם כבר הצטרף לגן במועד שלה. הוצאה ללא
     תאריך נחשבת כמשותפת לכולם, כי אין לה רגע מוגדר בזמן. */
  function childPresentAt(child, dateStr) {
    var d = toDate(dateStr);
    if (!d) return true;
    var join = toDate(child && child.joinDate);
    if (!join) return true;
    return join <= d;
  }

  function childrenPresentAt(state, dateStr) {
    return (state.children || []).filter(function (c) {
      return childPresentAt(c, dateStr);
    });
  }

  /* ---------- אחוז ההשתתפות של ילד ---------- */
  /* ילד שהצטרף באמצע השנה משלם רק על החלק היחסי של השנה שנותר.
     האחוז מחושב אוטומטית לפי תאריך ההצטרפות, וניתן לדריסה ידנית. */
  function autoSharePercent(child, settings) {
    var start = toDate(settings.yearStart);
    var end = toDate(settings.yearEnd);
    var join = toDate(child.joinDate);
    if (!start || !end || !join) return 100;
    if (join <= start) return 100;
    if (join >= end) return 0;
    var total = monthsBetween(start, end);
    var left = monthsBetween(join, end);
    if (total <= 0) return 100;
    var pct = (left / total) * 100;
    var step = num(settings.roundShare) || 0;
    if (step > 0) pct = Math.round(pct / step) * step;   // עיגול לקפיצות נוחות (למשל 10%)
    return Math.max(0, Math.min(100, Math.round(pct)));
  }

  /* ילד שתאריך ההצטרפות שלו נופל אחרי סוף שנת הלימודים המוגדרת מקבל 0%,
     וכל הסכומים שלו מתאפסים. זו כמעט תמיד טעות בהגדרת תאריכי השנה
     ולא כוונה, ולכן יש לזהות זאת ולהתריע במקום להציג אפסים. */
  function childOutOfYear(child, settings) {
    var end = toDate(settings && settings.yearEnd);
    var join = toDate(child && child.joinDate);
    return !!(end && join && join >= end);
  }

  function outOfYearChildren(state) {
    return (state.children || []).filter(function (c) {
      return childOutOfYear(c, state.settings);
    });
  }

  function hasOverride(child) {
    return child && child.sharePercentOverride !== null &&
           child.sharePercentOverride !== undefined && child.sharePercentOverride !== '';
  }

  /* כמה משלם ילד בפועל, לפי ההוצאות שהיה נוכח בהן.
     full — כמה משלם ילד שנמצא בגן מתחילת השנה.
     percent — היחס ביניהם, לתצוגה בלבד. */
  function childShare(state, child) {
    var alloc = budgetAllocation(state);
    var full = alloc.full;
    var due = alloc.per[child.id] || 0;

    if (hasOverride(child)) {
      var pct = Math.max(0, Math.min(100, num(child.sharePercentOverride)));
      return { due: round2(full * pct / 100), full: full, percent: pct, manual: true };
    }
    return {
      due: round2(due), full: full, manual: false,
      // בלי תקציב אין ממה לגזור יחס, ולכן נופלים לחישוב לפי תאריכים
      percent: full > 0 ? Math.round((due / full) * 100)
                        : autoSharePercent(child, state.settings)
    };
  }

  function sharePercentOf(state, child) { return childShare(state, child).percent; }

  /* פירוט לכל סעיף: כמה הילד משלם עליו, וכמה היה משלם אילו היה
     בגן מתחילת השנה. ההפרש הוא מה שקדם להצטרפות שלו. */
  function childBudgetDetail(state, child) {
    return (state.budgetItems || []).map(function (item) {
      var a = itemAllocation(state, item);
      return {
        item: item,
        amount: round2(a.per[child.id] || 0),
        full: a.full,
        exempt: round2(Math.max(0, a.full - (a.per[child.id] || 0)))
      };
    });
  }

  /* ---------- קהל יעד של סעיף תקציב ---------- */
  /* סעיף יכול להיות סכום כולל, או סכום לאדם שמוכפל במספר הילדים
     או אנשי הצוות. כשמתווסף ילד לרשימה, הסעיף מתעדכן מאליו. */
  var AUDIENCE_COUNTS = {
    children:  function (state) { return (state.children || []).length; },
    staff_edu: function (state) { return (state.staff || []).length; }
  };

  function audienceCount(state, audience) {
    var fn = AUDIENCE_COUNTS[audience];
    return fn ? fn(state) : 0;
  }

  function audienceLabel(audience, count) {
    if (audience === 'children')  return count + (count === 1 ? ' ילד/ה' : ' ילדים');
    if (audience === 'staff_edu') return count + (count === 1 ? ' איש/ת צוות' : ' אנשי צוות');
    return '';
  }

  /* מספר חודשי הפעילות בשנת הלימודים — לפי התאריכים שבהגדרות */
  function schoolMonths(settings) {
    var a = toDate(settings && settings.yearStart);
    var b = toDate(settings && settings.yearEnd);
    if (!a || !b || b <= a) return 12;
    return Math.max(1, Math.round(monthsBetween(a, b)));
  }

  /* מספר חודשי הפעילות של סעיף חודשי — לפי חלון הפעילות שלו
     (למשל חוג שרץ מנובמבר עד מרץ), ואם לא הוגדר — לפי שנת הלימודים */
  function validPeriods(item) {
    return ((item && item.periods) || []).filter(function (p) {
      var a = toDate(p && p.start), b = toDate(p && p.end);
      return a && b && b > a;
    });
  }

  function itemMonths(state, item) {
    // כמה תקופות פעילות — למשל חוג שנעצר בחופשה וממשיך אחריה
    var periods = validPeriods(item);
    if (periods.length) {
      var total = periods.reduce(function (sum, p) {
        return sum + monthsBetween(toDate(p.start), toDate(p.end));
      }, 0);
      return Math.max(1, Math.round(total));
    }
    // תאימות לסעיפים שנשמרו עם מקטע יחיד
    var a = toDate(item && item.startDate);
    var b = toDate(item && item.endDate);
    if (a && b && b > a) return Math.max(1, Math.round(monthsBetween(a, b)));
    return schoolMonths(state.settings);
  }

  /* פירוק סעיף תקציב לגורמי החישוב שלו:
     הסכום שהוקלד × מספר הנפשות (אם הוא לאדם) × מספר החודשים (אם הוא חודשי).
     "סכום לכל הקטגוריה" אינו מוכפל בנפשות — הוא סכום אחד לכל הקבוצה. */
  function itemBreakdown(state, item) {
    item = item || {};
    var legacy = item.basis === undefined && item.period === undefined;

    var rate, perPerson, monthly;
    if (legacy) {
      // סעיפים שנשמרו לפני שנוספו בסיס הסכום והתדירות
      perPerson = !!(item.audience && item.perPerson !== '' && item.perPerson !== null && item.perPerson !== undefined);
      monthly = false;
      rate = perPerson ? num(item.perPerson) : num(item.amount);
    } else {
      perPerson = item.basis === 'per_person' && !!item.audience;
      monthly = item.period === 'month';
      rate = num(item.rate);
    }

    var count = perPerson ? audienceCount(state, item.audience) : 1;
    var months = monthly ? itemMonths(state, item) : 1;

    return {
      rate: rate, perPerson: perPerson, monthly: monthly,
      audience: item.audience || '',
      count: count, months: months,
      customWindow: monthly && (validPeriods(item).length > 0 ||
                    !!(toDate(item.startDate) && toDate(item.endDate))),
      periodCount: validPeriods(item).length,
      total: round2(rate * count * months)
    };
  }

  /* ---------- מועדי הסעיף ---------- */
  /* כל סעיף מתפרק ל"מועדים": סעיף חד-פעמי הוא מועד אחד בתאריך היעד,
     וסעיף חודשי הוא מועד לכל חודש פעילות. הנוכחות נבדקת מול המועד,
     ולכן ילד שהצטרף אחרי חג מסוים אינו משלם עליו, אך משלם במלואו
     על כל מה שבא אחריו. */
  function itemOccasions(state, item) {
    var bd = itemBreakdown(state, item);
    if (!bd.monthly) return [item && item.date ? item.date : null];

    var windows = validPeriods(item).map(function (p) {
      return { a: toDate(p.start), b: toDate(p.end) };
    });
    if (!windows.length) {
      var a = toDate(item && item.startDate), b = toDate(item && item.endDate);
      if (a && b && b > a) windows = [{ a: a, b: b }];
    }
    if (!windows.length) {
      var ys = toDate(state.settings && state.settings.yearStart);
      var ye = toDate(state.settings && state.settings.yearEnd);
      if (ys && ye && ye > ys) windows = [{ a: ys, b: ye }];
    }
    if (!windows.length) return [null];

    var out = [];
    windows.forEach(function (w) {
      var y = w.a.getFullYear(), m = w.a.getMonth(), guard = 0;
      while (guard++ < 240) {
        if (new Date(y, m, 1) > w.b) break;
        var last = new Date(y, m + 1, 0);              // היום האחרון בחודש
        var ref = last < w.b ? last : w.b;
        out.push(iso(ref));
        if (++m > 11) { m = 0; y++; }
      }
    });
    return out.length ? out : [null];
  }

  function iso(d) {
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
      ('0' + d.getDate()).slice(-2);
  }

  /* ---------- חלוקת סעיף בין הילדים ---------- */
  /* לכל מועד נבדק מי מהילדים כבר הצטרף:
     • סכום לילד — כל ילד נוכח עולה את הסכום שהוקלד.
     • סכום כולל — הסכום של אותו מועד מתחלק בין הנוכחים בלבד.
     כך ילד שהצטרף באמצע אינו משלם על מה שהיה לפניו, ושאר ההורים
     משלמים פחות על מה שנותר, כי הוא מתחלק ביניהם ובינו. */
  function itemAllocation(state, item) {
    var bd = itemBreakdown(state, item);
    var kids = state.children || [];
    var per = {};
    kids.forEach(function (c) { per[c.id] = 0; });

    var occ = itemOccasions(state, item);
    // הסכום נשמר כפי שתוכנן: מספר החודשים שבחישוב מחולק למועדים בפועל
    var k = bd.monthly && occ.length ? bd.months / occ.length : 1;
    var perChildKids = bd.perPerson && bd.audience === 'children';
    var perOccasion = perChildKids ? num(bd.rate) * k
                                   : (bd.perPerson ? bd.rate * bd.count : bd.rate) * k;

    if (!kids.length) return { per: per, full: 0, total: round2(bd.total) };

    var full = 0;      // כמה משלם ילד שנמצא בגן מתחילת השנה
    occ.forEach(function (date) {
      var present = kids.filter(function (c) { return childPresentAt(c, date); });
      // אם אף ילד לא היה בגן במועד הזה, ההוצאה מתחלקת בין כולם
      if (!present.length) present = kids;
      var share = perChildKids ? perOccasion : perOccasion / present.length;
      full += share;
      present.forEach(function (c) { per[c.id] += share; });
    });

    var total = kids.reduce(function (sum, c) { return sum + per[c.id]; }, 0);
    return { per: per, full: round2(full), total: round2(total) };
  }

  /* הסכום השנתי האפקטיבי — סך מה שהילדים משלמים על הסעיף */
  function itemAmount(state, item) {
    return itemAllocation(state, item).total;
  }

  /* ---------- תקציב מתוכנן ---------- */
  /* חלוקת כל התקציב בין הילדים, במעבר אחד */
  function budgetAllocation(state) {
    var kids = state.children || [];
    var per = {};
    kids.forEach(function (c) { per[c.id] = 0; });
    var full = 0, total = 0;

    (state.budgetItems || []).forEach(function (item) {
      var a = itemAllocation(state, item);
      kids.forEach(function (c) { per[c.id] += a.per[c.id] || 0; });
      full += a.full;
      total += a.total;
    });
    return { per: per, full: round2(full), total: round2(total) };
  }

  function budgetTotal(state) {
    return budgetAllocation(state).total;
  }
  function budgetByCategory(state) {
    var map = {};
    (state.budgetItems || []).forEach(function (b) {
      map[b.categoryId] = (map[b.categoryId] || 0) + itemAmount(state, b);
    });
    return map;
  }

  /* תכנון לפי קהל יעד — ילדים, צוות חינוכי, או כללי */
  function budgetByAudience(state) {
    var map = {};
    (state.budgetItems || []).forEach(function (b) {
      var key = b.audience || '';
      map[key] = (map[key] || 0) + itemAmount(state, b);
    });
    return map;
  }

  /* ---------- הוצאות בפועל ---------- */
  function expensesTotal(state) {
    return (state.expenses || []).reduce(function (s, e) { return s + num(e.amount); }, 0);
  }
  /* סעיף תקציב לפי מזהה */
  function budgetItem(state, id) {
    if (!id) return null;
    return (state.budgetItems || []).filter(function (b) { return b.id === id; })[0] || null;
  }

  /* הוצאות שנרשמו על סעיף תקציב מסוים (נוצרות מרעיון שנבחר) */
  function expensesByBudgetItem(state) {
    var map = {};
    (state.expenses || []).forEach(function (e) {
      if (e.budgetItemId) map[e.budgetItemId] = (map[e.budgetItemId] || 0) + num(e.amount);
    });
    return map;
  }

  function expensesByCategory(state) {
    var map = {};
    (state.expenses || []).forEach(function (e) {
      map[e.categoryId] = (map[e.categoryId] || 0) + num(e.amount);
    });
    return map;
  }

  /* הוצאה שלא סומן לה קהל יעד נספרת ככללית — בלי לנחש מהקטגוריה */
  function expensesByAudience(state) {
    var map = {};
    (state.expenses || []).forEach(function (e) {
      var key = e.audience || '';
      map[key] = (map[key] || 0) + num(e.amount);
    });
    return map;
  }

  /* ---------- גבייה ---------- */
  function paymentsOf(state, childId) {
    return (state.payments || []).filter(function (p) { return p.childId === childId; });
  }
  function paidBy(state, childId) {
    return paymentsOf(state, childId).reduce(function (s, p) { return s + num(p.amount); }, 0);
  }
  function collectedTotal(state) {
    return (state.payments || []).reduce(function (s, p) { return s + num(p.amount); }, 0);
  }

  /* עלות לילד שנמצא בגן מתחילת השנה */
  function fullChildShare(state) {
    return budgetAllocation(state).full;
  }

  /* כמה "ילדים מלאים" שווה הגן — התקציב חלקי העלות לילד מלא.
     נשאר לתצוגה, אבל אינו מחלק עוד את התקציב: החלוקה נעשית
     סעיף-סעיף לפי מי שהיה בגן באותו מועד. */
  function totalShareUnits(state) {
    var a = budgetAllocation(state);
    return a.full > 0 ? round2(a.total / a.full) : 0;
  }

  /* גובה כל אחד מהתשלומים שנותרו: היתרה מחולקת במספר התשלומים שנותרו.
     אם כל התשלומים שתוכננו כבר בוצעו ועדיין יש יתרה, היא מוצגת כתשלום אחד. */
  function nextInstallmentOf(plan, paidCount, remaining) {
    if (plan <= 1) return 0;
    var left = Math.max(0, plan - paidCount);
    var owed = Math.max(0, remaining);
    if (owed <= 0.5) return 0;
    return left > 0 ? round2(owed / left) : round2(owed);
  }

  /* פירוט הגבייה לכל ילד */
  function childCollection(state, child) {
    var sh = childShare(state, child);
    var pct = sh.percent;
    var due = Math.round(sh.due);   // מעגלים לשקלים שלמים — נוח לגבייה
    var pays = paymentsOf(state, child.id);
    var paid = pays.reduce(function (s, p) { return s + num(p.amount); }, 0);
    var remaining = round2(due - paid);
    var plan = num(child.installmentsPlan) || 0;
    var over = round2(paid - due);
    return {
      child: child,
      percent: pct,
      due: due,
      paid: round2(paid),
      remaining: remaining,
      over: over > 0.5,              // שולם יותר מהמכסה
      overAmount: over > 0.5 ? over : 0,
      status: over > 0.5 ? 'over' : (remaining <= 0.5 ? 'full' : (paid > 0 ? 'partial' : 'none')),
      payments: pays,
      installments: plan,
      // החלוקה המקורית, לצורך השוואה בלבד
      perInstallment: plan > 1 ? round2(due / plan) : 0,
      // התשלומים שנותרו מחושבים מחדש מהיתרה בפועל, כך שהעברה בסכום
      // שונה מהמתוכנן מעדכנת מיד את גובה התשלומים הבאים
      paidCount: pays.length,
      installmentsLeft: Math.max(0, plan - pays.length),
      nextInstallment: nextInstallmentOf(plan, pays.length, remaining)
    };
  }

  function collectionRows(state) {
    return (state.children || []).map(function (c) { return childCollection(state, c); });
  }

  function collectionSummary(state) {
    var rows = collectionRows(state);
    var due = rows.reduce(function (s, r) { return s + r.due; }, 0);
    var paid = rows.reduce(function (s, r) { return s + r.paid; }, 0);
    return {
      rows: rows,
      due: round2(due),
      paid: round2(paid),
      remaining: round2(due - paid),
      fullCount: rows.filter(function (r) { return r.status === 'full' || r.status === 'over'; }).length,
      overCount: rows.filter(function (r) { return r.status === 'over'; }).length,
      overTotal: round2(rows.reduce(function (s, r) { return s + r.overAmount; }, 0)),
      partialCount: rows.filter(function (r) { return r.status === 'partial'; }).length,
      noneCount: rows.filter(function (r) { return r.status === 'none'; }).length,
      pct: due > 0 ? Math.min(100, Math.round((paid / due) * 100)) : 0
    };
  }

  /* פילוח אמצעי תשלום */
  function byMethod(state) {
    var map = {};
    (state.payments || []).forEach(function (p) {
      map[p.method] = (map[p.method] || 0) + num(p.amount);
    });
    return map;
  }

  /* ---------- מאזן כללי ---------- */
  function overview(state) {
    var budget = budgetTotal(state);
    var spent = expensesTotal(state);
    var collected = collectedTotal(state);
    return {
      budget: round2(budget),
      spent: round2(spent),
      collected: round2(collected),
      budgetLeft: round2(budget - spent),
      cashLeft: round2(collected - spent),
      usePct: budget > 0 ? Math.round((spent / budget) * 100) : 0
    };
  }

  /* ---------- חישוב החזרים בסוף שנה ---------- */
  /* עלות אמיתית לכל הורה = ההוצאות בפועל מחולקות לפי מפתח ההשתתפות
     (ילד מלא = 1, ילד שהצטרף באמצע שנה = החלק היחסי שלו).
     ההחזר = מה ששולם פחות העלות האמיתית. תוצאה שלילית = ההורה עדיין חייב. */
  /* חלוקת ההוצאות שבוצעו בפועל בין הילדים, לפי מי שכבר היה בגן
     בתאריך ההוצאה. הוצאה ללא תאריך מתחלקת בין כולם. */
  function expenseAllocation(state) {
    var kids = state.children || [];
    var per = {};
    kids.forEach(function (c) { per[c.id] = 0; });
    var full = 0;

    (state.expenses || []).forEach(function (e) {
      if (!kids.length) return;
      var amount = num(e.amount);
      var present = kids.filter(function (c) { return childPresentAt(c, e.date); });
      if (!present.length) present = kids;
      var share = amount / present.length;
      full += share;
      present.forEach(function (c) { per[c.id] += share; });
    });
    return { per: per, full: round2(full) };
  }

  function refunds(state) {
    var collected = collectedTotal(state);
    var spent = expensesTotal(state);
    var pot = round2(collected - spent);
    var rows = collectionRows(state);
    var alloc = expenseAllocation(state);
    var costPerUnit = alloc.full;                    // עלות לילד שהיה כל השנה
    var units = costPerUnit > 0 ? round2(spent / costPerUnit) : 0;

    var out = rows.map(function (r) {
      // ילד עם אחוז ידני משלם לפי האחוז שנקבע לו; אחרת לפי ההוצאות
      // שהיה נוכח בהן בפועל
      var fairCost = hasOverride(r.child)
        ? round2(costPerUnit * (r.percent / 100))
        : round2(alloc.per[r.child.id] || 0);
      var weight = costPerUnit > 0 ? round2(fairCost / costPerUnit) : 0;
      var balance = round2(r.paid - fairCost);
      return {
        child: r.child,
        percent: r.percent,
        due: r.due,
        paid: r.paid,
        remaining: r.remaining,
        weight: weight,
        fairCost: fairCost,
        balance: balance,
        refund: balance > 0 ? balance : 0,      // מגיע לו החזר
        extraOwed: balance < 0 ? -balance : 0   // עדיין חייב להשלים
      };
    });

    return {
      pot: pot,
      collected: round2(collected),
      spent: round2(spent),
      costPerUnit: round2(costPerUnit),
      units: units,
      rows: out,
      totalRefund: round2(out.reduce(function (s, r) { return s + r.refund; }, 0)),
      totalOwed: round2(out.reduce(function (s, r) { return s + r.extraOwed; }, 0))
    };
  }

  /* ---------- רעיונות (סיעור מוחות) ---------- */
  /* שורת רעיון: כמות × סכום. שורות ישנות ללא כמות נחשבות כיחידה אחת. */
  function lineQty(l) {
    if (!l || l.qty === undefined || l.qty === null || l.qty === '') return 1;
    return num(l.qty);
  }
  function lineTotal(l) {
    return round2(lineQty(l) * num(l && l.amount));
  }
  function ideaTotal(idea) {
    return round2((idea.lines || []).reduce(function (s, l) { return s + lineTotal(l); }, 0));
  }

  /* חלוקת עלות הרעיון לפי קהל היעד — כמה יוצא לכל ילד / איש צוות */
  function ideaSplit(state, idea) {
    var total = ideaTotal(idea);
    var aud = idea.audiences && idea.audiences.length ? idea.audiences : ['children'];
    var childCount = (state.children || []).length;
    var staffCount = (state.staff || []).length;

    var heads = 0;
    if (aud.indexOf('children') > -1) heads += childCount;
    if (aud.indexOf('staff') > -1) heads += staffCount;
    // "כיבוד" אינו לפי נפש — הוא מחושב כמנה אחת לכלל הגן
    var foodOnly = aud.length === 1 && aud[0] === 'food';

    var parts = [];
    if (aud.indexOf('children') > -1) {
      parts.push({ id: 'children', count: childCount, share: heads > 0 ? round2(total / heads) : 0 });
    }
    if (aud.indexOf('staff') > -1) {
      parts.push({ id: 'staff', count: staffCount, share: heads > 0 ? round2(total / heads) : 0 });
    }
    if (aud.indexOf('food') > -1) {
      parts.push({ id: 'food', count: 1, share: foodOnly ? round2(total) : 0 });
    }

    return {
      total: round2(total),
      heads: heads,
      perHead: heads > 0 ? round2(total / heads) : 0,
      perChild: childCount > 0 && aud.indexOf('children') > -1 ? round2(total / Math.max(1, heads)) : 0,
      parts: parts,
      /* כמה זה מוסיף לכל משפחה. רעיון הוא הוצאה עתידית, ולכן הוא
         מתחלק שווה בשווה בין כל הילדים שברשימה — גם מי שהצטרף
         באמצע השנה משתתף בו במלואו. */
      perParent: childCount > 0 ? round2(total / childCount) : 0
    };
  }

  /* השוואה מול הקטגוריה שנבחרה לרעיון */
  function ideaVsBudget(state, idea) {
    var item = budgetItem(state, idea.budgetItemId);
    var planned, spent;
    if (item) {
      planned = itemAmount(state, item);
      spent = expensesByBudgetItem(state)[item.id] || 0;
    } else {
      // רעיונות שנוצרו לפני שהרעיון הוצמד לסעיף תקציב — השוואה מול הקטגוריה
      if (!idea.categoryId) return null;
      planned = budgetByCategory(state)[idea.categoryId] || 0;
      spent = expensesByCategory(state)[idea.categoryId] || 0;
    }
    var left = planned - spent;
    var total = ideaTotal(idea);
    return {
      item: item,
      planned: round2(planned),
      spent: round2(spent),
      left: round2(left),
      total: round2(total),
      fits: total <= left,
      diff: round2(left - total)
    };
  }

  /* ---------- תאריכים ואירועים ---------- */
  function birthdayThisYear(dateStr, refDate) {
    var d = toDate(dateStr);
    if (!d) return null;
    var ref = refDate || new Date();
    var b = new Date(ref.getFullYear(), d.getMonth(), d.getDate());
    return b;
  }

  function allDates(state) {
    var out = [];
    (state.children || []).forEach(function (c) {
      if (!c.birthDate) return;
      out.push({ id: 'bd-' + c.id, type: 'birthday', title: 'יום הולדת — ' + c.name,
                 date: c.birthDate, icon: '🎂', tone: 'pink', kind: 'יום הולדת', refId: c.id });
    });
    (state.staff || []).forEach(function (t) {
      if (!t.birthDate) return;
      out.push({ id: 'bs-' + t.id, type: 'birthday', title: 'יום הולדת — ' + t.name + ' (צוות)',
                 date: t.birthDate, icon: '🎂', tone: 'purple', kind: 'יום הולדת · צוות', refId: t.id });
    });
    (state.budgetItems || []).forEach(function (b) {
      if (!b.date) return;
      var cat = Store.category(b.categoryId);
      out.push({ id: 'bi-' + b.id, type: 'budget', title: b.title || cat.name,
                 date: b.date, icon: cat.icon, tone: cat.tone, kind: cat.name, catId: cat.id, refId: b.id });
    });
    (state.events || []).forEach(function (e) {
      out.push({ id: 'ev-' + e.id, type: e.type || 'event', title: e.title,
                 date: e.date, icon: e.icon || '📅', tone: e.tone || 'blue',
                 kind: e.note || 'אירוע הגן', refId: e.id });
    });
    if (state.settings && state.settings.yearEnd) {
      out.push({ id: 'year-end', type: 'year', title: 'סוף שנת הלימודים',
                 date: state.settings.yearEnd, icon: '🎓', tone: 'yellow',
                 kind: 'סוף שנה', refId: '' });
    }
    return out;
  }

  /* המופע הקרוב הבא של תאריך (ימי הולדת חוזרים כל שנה) */
  function nextOccurrence(item, from) {
    var d = toDate(item.date);
    if (!d) return null;
    var ref = from || new Date();
    ref = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    if (item.type === 'birthday') {
      var n = new Date(ref.getFullYear(), d.getMonth(), d.getDate());
      if (n < ref) n = new Date(ref.getFullYear() + 1, d.getMonth(), d.getDate());
      return n;
    }
    return d;
  }

  function upcoming(state, limit) {
    var now = new Date();
    var items = allDates(state).map(function (it) {
      var n = nextOccurrence(it, now);
      return Object.assign({}, it, { next: n });
    }).filter(function (it) { return it.next; });
    items.sort(function (a, b) { return a.next - b.next; });
    var future = items.filter(function (it) { return it.next >= new Date(now.getFullYear(), now.getMonth(), now.getDate()); });
    return future.slice(0, limit || 5);
  }

  return {
    num: num, round2: round2, toDate: toDate,
    autoSharePercent: autoSharePercent,
    childShare: childShare, sharePercentOf: sharePercentOf, hasOverride: hasOverride,
    childBudgetDetail: childBudgetDetail,
    childPresentAt: childPresentAt, childrenPresentAt: childrenPresentAt,
    itemOccasions: itemOccasions, itemAllocation: itemAllocation,
    budgetAllocation: budgetAllocation, expenseAllocation: expenseAllocation,
    childOutOfYear: childOutOfYear, outOfYearChildren: outOfYearChildren,
    budgetTotal: budgetTotal, budgetByCategory: budgetByCategory,
    budgetByAudience: budgetByAudience, expensesByAudience: expensesByAudience,
    audienceCount: audienceCount, audienceLabel: audienceLabel,
    itemAmount: itemAmount, itemBreakdown: itemBreakdown,
    schoolMonths: schoolMonths, itemMonths: itemMonths, validPeriods: validPeriods,
    expensesTotal: expensesTotal, expensesByCategory: expensesByCategory,
    budgetItem: budgetItem, expensesByBudgetItem: expensesByBudgetItem,
    paymentsOf: paymentsOf, paidBy: paidBy, collectedTotal: collectedTotal,
    totalShareUnits: totalShareUnits, fullChildShare: fullChildShare,
    childCollection: childCollection, collectionRows: collectionRows,
    collectionSummary: collectionSummary, byMethod: byMethod,
    overview: overview, refunds: refunds,
    ideaTotal: ideaTotal, lineTotal: lineTotal, lineQty: lineQty,
    ideaSplit: ideaSplit, ideaVsBudget: ideaVsBudget,
    allDates: allDates, nextOccurrence: nextOccurrence, upcoming: upcoming
  };
})();
