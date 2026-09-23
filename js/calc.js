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

  /* ---------- שני כיווני עבודה ----------
     יש ועדים שמתכננים קודם את ההוצאות ורק אז יודעים כמה לגבות,
     ויש כאלה שקובעים סכום גבייה מראש ומתכננים בתוכו. השדה
     settings.collectPerChild הוא ההכרעה בין השניים: כל עוד הוא ריק
     הכיוון הוא תכנון קודם, וברגע שהוזן בו סכום הוא הופך למקור
     האמת של הגבייה, והתקציב נמדד מולו. */
  /* הכיוון השני נמצא מאחורי דגל תכונה. כשהוא כבוי הסכום השמור
     פשוט אינו נקרא, והחישוב כולו חוזר להתנהגות שקדמה לו. */
  function directionsOn() {
    return typeof Features !== 'undefined' && !!Features && Features.budgetDirections === true;
  }

  function collectPerChild(state) {
    if (!directionsOn()) return 0;
    var v = num(state && state.settings && state.settings.collectPerChild);
    return v > 0 ? v : 0;
  }
  function collectFirst(state) { return collectPerChild(state) > 0; }

  /* כמה משלם ילד בפועל, לפי ההוצאות שהיה נוכח בהן.
     full — כמה משלם ילד שנמצא בגן מתחילת השנה.
     percent — היחס ביניהם, לתצוגה בלבד. */
  function childShare(state, child) {
    var set = collectPerChild(state);
    var over = hasOverride(child);

    /* גבייה קודם: הסכום לילד מלא נקבע ביד. אין חלוקה סעיף-סעיף
       שממנה אפשר לגזור יחס, ולכן היחס נקבע לפי תאריך ההצטרפות —
       בדיוק כפי שהוא נקבע גם היום כשעדיין אין תקציב. */
    if (set > 0) {
      var p = over ? Math.max(0, Math.min(100, num(child.sharePercentOverride)))
                   : autoSharePercent(child, state.settings);
      return { due: round2(set * p / 100), full: round2(set), percent: p, manual: over };
    }

    var alloc = budgetAllocation(state);
    var full = alloc.full;
    var due = alloc.per[child.id] || 0;

    if (over) {
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
  /* ---------- כמה ילדים ואנשי צוות יש ----------
     הרשימה היא המקור היחיד: בהקמה המהירה נוצרות רשומות זמניות לפי
     המספר שהוזן (Store.setHeadcount), ולכן אין מונה נפרד. */
  function childCount(state) { return ((state && state.children) || []).length; }
  function staffCount(state) { return ((state && state.staff) || []).length; }

  var AUDIENCE_COUNTS = {
    children:  childCount,
    staff_edu: staffCount
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
    var set = collectPerChild(state);
    return set > 0 ? set : budgetAllocation(state).full;
  }

  /* ---------- המסגרת התקציבית ----------
     המספרים שבראש מסך התכנון, בשני הכיוונים. בכיוון הגבייה
     available אינו מכפלה פשוטה של הסכום במספר הילדים אלא סכום
     החיובים בפועל, כך שילד שהצטרף באמצע השנה משתקף בו. */
  function budgetFrame(state) {
    var kids = childCount(state);
    var planned = round2(budgetTotal(state));
    var per = collectPerChild(state);
    var items = ((state && state.budgetItems) || []).length;

    if (per <= 0) {
      return {
        mode: 'plan', kids: kids, perChild: 0, items: items,
        available: 0, planned: planned, remaining: 0, pct: 0,
        /* כמה ייצא לכל ילד מלא לפי מה שתוכנן עד עכשיו */
        perChildPlanned: Math.round(fullChildShare(state))
      };
    }

    var available = 0;
    (state.children || []).forEach(function (c) { available += childShare(state, c).due; });
    available = Math.round(available);

    return {
      mode: 'collect', kids: kids, perChild: per, items: items,
      available: available, planned: planned,
      remaining: round2(available - planned),
      pct: available > 0 ? Math.round(planned / available * 100) : 0,
      perChildPlanned: per
    };
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
      /* ילד שאין לו חיוב אינו "שילם במלואו". לפני שנקבע תקציב
         due הוא אפס לכולם, ו-remaining יוצא אפס גם הוא — כך ועד
         שרק הוקם ראה "9 שילמו מלא" בלי ששולמה אגורה. זה מצב
         משלו, ולא סוג של תשלום. */
      status: over > 0.5 ? 'over'
        : due <= 0 ? 'nodue'
        : (remaining <= 0.5 ? 'full' : (paid > 0 ? 'partial' : 'none')),
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

  /* כסף שנכנס לקופה בלי שהוא רשום על שם ילד מסוים — כך נראה ייבוא
     מפייבוקס לוועד שהוזן בו רק מספר הילדים, ואין למי לשייך. הוא נגבה
     לכל דבר, ולכן הוא נספר בסכום הגבייה; מה שחסר הוא רק הידיעה בשם
     מי. ההפרש מול סך התשלומים, ולא סינון לפי childId ריק, תופס גם
     תשלום ששויך לילד שנמחק מאז — כסף שאחרת היה נעלם מהמסך. */
  function unassignedTotal(state) {
    var assigned = (state.children || []).reduce(function (s, c) { return s + paidBy(state, c.id); }, 0);
    var rest = round2(collectedTotal(state) - assigned);
    return rest > 0.005 ? rest : 0;
  }

  /* ---------- מי שילם, ולא כמה פעמים ----------
     הספירה כאן היא של אנשים, לא של תשלומים: אותו הורה מופיע בקובץ
     של פייבוקס פעמיים כשהוא פורס לתשלומים, ושמו עשוי להופיע בסדר
     הפוך בין ייצוא לייצוא, ולפעמים עם טלפון ולפעמים בלעדיו. */

  /* טלפון בצורה אחת: ספרות בלבד, בלי קידומת הארץ ובלי האפס המוביל */
  function payerPhoneKey(v) {
    var d = String(v == null ? '' : v).replace(/\D/g, '');
    if (!d) return '';
    d = d.replace(/^00972/, '').replace(/^972/, '').replace(/^0+/, '');
    return d.length >= 8 ? d : '';
  }

  /* שם בצורה אחת. המילים ממוינות, ולכן "דורון וייסברג" ו"וייסברג
     דורון" הם אותו מפתח — זה בדיוק ההבדל בין שתי צורות של שם אחד
     לבין שני הורים. */
  function payerNameKey(v) {
    var n = String(v == null ? '' : v)
      .replace(/[\u0591-\u05C7]/g, '')
      .replace(/['"`\u05F3\u05F4]/g, '')
      .replace(/[()\[\]{}:,;|\/\\_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    return n ? n.split(' ').sort().join(' ') : '';
  }

  /* כמה אנשים שונים עומדים מאחורי הכסף שלא שויך. שני תשלומים הם
     אותו אדם אם הם חולקים טלפון או שם, והקשר מתגלגל: אם א' ו-ב'
     חולקים טלפון ו-ב' ו-ג' חולקים שם, שלושתם אדם אחד — ולכן איחוד
     קבוצות ולא ספירת מפתחות. תשלום בלי שם ובלי טלפון אינו נספר
     כלל: אי אפשר להעיד עליו, ומוטב לספור פחות מדי מאשר להכריז
     "כל ההורים שילמו" על סמך אנונימי. */
  function payerGroups(state) {
    var up = {};
    function add(k) { if (!(k in up)) up[k] = k; return k; }
    function find(k) { while (up[k] !== k) { up[k] = up[up[k]]; k = up[k]; } return k; }
    function union(a, b) { var ra = find(add(a)), rb = find(add(b)); if (ra !== rb) up[ra] = rb; }

    var mine = [];
    (state.payments || []).forEach(function (p) {
      if (p.childId) return;                       // משויך — נספר אצל הילד
      var phone = payerPhoneKey(p.payerPhone);
      var name = payerNameKey(p.payer);
      if (!phone && !name) return;
      if (phone && name) union('t:' + phone, 'n:' + name);
      mine.push({ p: p, key: add(phone ? 't:' + phone : 'n:' + name) });
    });
    var byRoot = {}, order = [];
    mine.forEach(function (m) {
      var root = find(m.key);
      if (!byRoot[root]) { byRoot[root] = { key: root, name: '', phone: '', total: 0, payments: [] }; order.push(root); }
      var g = byRoot[root];
      /* השם המלא ביותר מנצח: "אילנה וייסברג דורון" עדיף על "דורון" */
      if (String(m.p.payer || '').length > g.name.length) g.name = String(m.p.payer || '');
      if (!g.phone && m.p.payerPhone) g.phone = String(m.p.payerPhone);
      g.total = round2(g.total + num(m.p.amount));
      g.payments.push(m.p);
    });
    return order.map(function (root) {
      var g = byRoot[root];
      /* פריסה לתשלומים בפייבוקס נראית תמיד אותו דבר: אותו משלם,
         כמה שורות, ובכולן אותו סכום בדיוק. זה מה שמבדיל בין הורה
         שפרס את החוב לבין הורה ששילם פעמיים על דברים שונים. */
      var amounts = g.payments.map(function (p) { return Math.round(num(p.amount) * 100); });
      g.count = g.payments.length;
      g.sameAmount = g.count > 1 && amounts.every(function (a) { return a === amounts[0]; });
      g.installments = g.count > 1;
      return g;
    });
  }

  /* כמה אנשים שונים עומדים מאחורי הכסף שלא שויך. שני תשלומים הם
     אותו אדם אם הם חולקים טלפון או שם, והקשר מתגלגל: אם א' ו-ב'
     חולקים טלפון ו-ב' ו-ג' חולקים שם, שלושתם אדם אחד — ולכן איחוד
     קבוצות ולא ספירת מפתחות. תשלום בלי שם ובלי טלפון אינו נספר
     כלל: אי אפשר להעיד עליו, ומוטב לספור פחות מדי מאשר להכריז
     "כל ההורים שילמו" על סמך אנונימי. */
  function distinctPayers(state) {
    return payerGroups(state).length;
  }

  function collectionSummary(state) {
    var rows = collectionRows(state);
    var due = rows.reduce(function (s, r) { return s + r.due; }, 0);
    var assigned = rows.reduce(function (s, r) { return s + r.paid; }, 0);
    /* paid הוא כל מה שנגבה, כולל הלא משויך: זה המספר שהמשתמש מחפש
       במסך הגבייה, והוא זהה לסכום שבקופה במסך הבית. הפילוח לפי ילד
       נשאר ב-assigned ובשורות עצמן. */
    var unassigned = unassignedTotal(state);
    var paid = round2(assigned + unassigned);
    /* כל עוד יש בקופה כסף שלא שויך, אי אפשר לטעון שהורה ששורתו ריקה
       לא שילם — ייתכן מאוד שאחד מאותם תשלומים הוא בדיוק שלו. הוא לא
       חייב, הוא פשוט לא ידוע. ברגע שהכול משויך החזקה חוזרת להיות
       ודאית, והספירה חוזרת ל"טרם שילמו". */
    if (unassigned > 0) {
      rows.forEach(function (r) { if (r.status === 'none') r.status = 'unknown'; });
    }
    /* "נותר לגבות" הוא בעצם שני חסרים שונים שהתחפשו למספר אחד.
       cashGap הוא הפער מול התקציב, ו-owed הוא מה שהורים מסוימים
       עדיין חייבים. בדרך כלל הם זהים, אבל לא תמיד: הורה אחד ששילם
       לבדו את כל התקציב סוגר את הפער ומשאיר שלושה חייבים, והמסך
       הכריז "הגבייה הושלמה". מה שנותר לגבות הוא הגדול מביניהם.
       שורה שעדיין לא ידועה אינה חוב — ייתכן שהכסף שלה כבר בקופה
       בלי שם; רק מי שידוע שלא שילם או שילם חלקית נספר. */
    var cashGap = round2(due - paid);
    var owed = round2(rows.reduce(function (s, r) {
      return s + (r.status === 'none' || r.status === 'partial' ? Math.max(0, r.remaining) : 0);
    }, 0));
    var toCollect = Math.max(0, cashGap, owed);
    var done = toCollect <= rows.length * 0.5 + 0.5;
    /* ילדים שאין להם כיסוי משלהם — מי שלא שילם, מי ששילם חלקית, ומי
       שעדיין לא ידוע. כל עוד יש כזה, "כל ההורים שילמו" אינו נכון,
       אלא אם הכסף שלא שויך מגיע ממספיק משלמים שונים כדי להסביר
       בדיוק אותם. */
    var short = rows.filter(function (r) {
      return r.status !== 'full' && r.status !== 'over' && r.status !== 'nodue';
    }).length;
    /* בלי תקציב אין מה לגבות, ולכן גם אין על מה להכריז: ועד שרק
       הוקם עונה טכנית על "אף אחד לא חייב", וזו לא הכרזה שמישהו
       רוצה לראות במסך הבית. */
    var everyonePaid = rows.length > 0 && due > 0 && done &&
      (short === 0 || (unassigned > 0 && distinctPayers(state) >= short));
    /* יש מספיק משלמים שונים כדי להסביר את כל מי שחסר — אז כולם
       שילמו, וזו כבר לא שאלה פתוחה. הסטטוס נפרד מ-full כי הכסף
       עדיין אינו רשום על שם הילד: הסכום בשורה נשאר "—", אבל
       התשובה לשאלה "שילם?" היא כן. */
    if (everyonePaid) {
      rows.forEach(function (r) { if (r.status === 'unknown') r.status = 'covered'; });
    }
    return {
      rows: rows,
      due: round2(due),
      paid: paid,
      assigned: round2(assigned),
      unassigned: unassigned,
      /* remaining הוא מה שנותר לגבות בפועל — כך הוא מוצג בכל מסך.
         שני המרכיבים שלו חשופים לצדו למי שצריך להבחין ביניהם. */
      remaining: round2(toCollect),
      cashGap: cashGap,
      owed: owed,
      fullCount: rows.filter(function (r) {
        return r.status === 'full' || r.status === 'over' || r.status === 'covered';
      }).length,
      overCount: rows.filter(function (r) { return r.status === 'over'; }).length,
      overTotal: round2(rows.reduce(function (s, r) { return s + r.overAmount; }, 0)),
      partialCount: rows.filter(function (r) { return r.status === 'partial'; }).length,
      noneCount: rows.filter(function (r) { return r.status === 'none'; }).length,
      unknownCount: rows.filter(function (r) { return r.status === 'unknown'; }).length,
      /* האם הגבייה נסגרה. זו שאלה על הכסף, לא על השמות: אם כל מה
         שצריך לגבות נכנס, סיימנו — גם אם עוד לא יודעים מי שילם מה.
         חצי שקל לכל ילד הוא רעש של עיגול החיוב לשקל שלם. */
      done: done,
      /* "כל ההורים שילמו" היא קביעה על אנשים, והיא דורשת ראיה לכל
         אחד מהם. תשלום אחד גדול שסוגר את כל הסכום אינו ראיה כזאת —
         הוא רק אומר שהכסף נכנס. */
      everyonePaid: everyonePaid,
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
  /* כמה אנשי צוות יש בדרגה מסוימת. 'all' — כל הצוות,
     'edu' — הצוות החינוכי בלבד, ו-'shared' — פריט אחד משותף שאינו
     מוכפל במספר האנשים. */
  function staffAtLevel(state, levelId) {
    var staff = (state && state.staff) || [];
    if (!levelId) return 0;
    if (levelId === 'shared') return 1;
    if (levelId === 'all') return staff.length;
    if (levelId === 'edu') {
      var ids = Store.eduLevelIds();
      return staff.filter(function (t) { return ids.indexOf(t.level) > -1; }).length;
    }
    return staff.filter(function (t) { return t.level === levelId; }).length;
  }

  /* רמת התקציב של דרגה. ברירת המחדל מוגדרת על הדרגה עצמה,
     וניתן לדרוס אותה בהגדרות הגן. */
  function levelWeight(state, levelId) {
    var over = state && state.settings && state.settings.levelWeights;
    if (over && over[levelId] !== undefined && over[levelId] !== null && over[levelId] !== '') {
      return Math.max(0, num(over[levelId]));
    }
    return num(Store.staffLevel(levelId).weight) || 1;
  }

  /* ---------- מספר הדרגה שרואים על המסך ----------
     המשקל שלמעלה הוא כלי חישוב: ככל שהוא גדול יותר, כך גדל חלקה של
     הדרגה בתקציב. המספר שמוצג למשתמש הפוך לו — דרגה 1 היא הגבוהה
     ביותר (מנהלת/גננת), וככל שהמספר עולה הדרגה יורדת ואיתה הסכום
     המומלץ. ההיפוך נעשה סביב הדרגה הגבוהה בסולם: דרגה = (המשקל
     הגבוה בסולם + 1) פחות המשקל. לכן משקל 4 הוא דרגה 1, ומשקל 0 —
     הדרגה הנמוכה בסולם, שאינה מקבלת חלק בתקציב כלל. */

  /* המשקל הגבוה בסולם, נגזר מברירות המחדל כדי שהסולם יזוז מאליו
     אם תתווסף דרגה גבוהה יותר */
  function rankSpan() {
    var top = 1;
    (Store.STAFF_LEVELS || []).forEach(function (lv) {
      top = Math.max(top, num(lv.weight) || 1);
    });
    return top;
  }
  function clampRank(rank) {
    return Math.max(1, Math.min(rankSpan() + 1, Math.round(num(rank)) || 1));
  }
  /* הדרגה הנמוכה ביותר — זו שאינה מקבלת חלק בתקציב */
  function lowestRank() { return rankSpan() + 1; }

  function levelRank(state, levelId) {
    return clampRank(rankSpan() + 1 - levelWeight(state, levelId));
  }
  /* הדרך חזרה: ממספר הדרגה שעל המסך אל המשקל ששומרים ומחשבים לפיו */
  function rankToWeight(rank) {
    return rankSpan() + 1 - clampRank(rank);
  }

  /* סך "יחידות התקציב" של הצוות — רמת כל דרגה כפול מספר האנשים בה */
  function staffWeightUnits(state) {
    var total = 0;
    (Store.STAFF_LEVELS || []).forEach(function (lv) {
      total += levelWeight(state, lv.id) * staffAtLevel(state, lv.id);
    });
    return total;
  }

  /* החלק המומלץ של דרגה מתקציב הרעיון, כשבר בין 0 ל-1 */
  function levelShare(state, levelId) {
    var units = staffWeightUnits(state);
    if (units <= 0) return 0;
    return (levelWeight(state, levelId) * staffAtLevel(state, levelId)) / units;
  }

  /* הסכום המומלץ לאיש צוות בדרגה מסוימת: חלקה של הדרגה בתקציב הסעיף,
     מחולק במספר האנשים שבה. מתקצר ל-planned × משקל הדרגה / יחידות
     הצוות, ולכן מי שבדרגה גבוהה יותר מקבל יותר, וריבוי אנשים בדרגה
     מקטין את הסכום לאדם בלי לשנות את חלקה של הדרגה בתקציב. */
  function levelPerPerson(state, levelId, planned) {
    var n = staffAtLevel(state, levelId);
    if (!n || !planned) return 0;
    // שקלים שלמים: המלצה למתנה אינה נמדדת באגורות
    return Math.round((planned * levelShare(state, levelId)) / n);
  }

  /* כמות השורה. שורה שהוצמדה לדרגת צוות סופרת את אנשי הצוות
     שבאותה דרגה, כך שהמספר מתעדכן מאליו כשמשתנה הרכב הצוות. */
  function lineQty(l, state) {
    if (!l) return 1;
    /* פריט משותף — רכישה אחת, בלי קשר למספר הנמענים */
    if (l.shared || l.levelId === 'shared') return 1;
    /* בחירה מפורשת של אנשי צוות ושל שמות חופשיים. רשימה ריקה אינה
       בחירה אלא היעדר בחירה, ולכן היא אינה מבטלת את הדרגה שעל השורה. */
    var picked = (l.staffIds || []).length + (l.names || []).length;
    if (picked) return picked;
    if (l.levelId) return staffAtLevel(state, l.levelId);
    if (l.qty === undefined || l.qty === null || l.qty === '') return 1;
    return num(l.qty);
  }
  function lineTotal(l, state) {
    return round2(lineQty(l, state) * num(l && l.amount));
  }

  /* קהל היעד של הרעיון בשפת ההוצאות. מסך ההוצאות מקבץ לפי ילדים,
     צוות חינוכי וכללי — ולכן רעיון שמיועד גם וגם, או לכיבוד, נרשם
     ככללי, בדיוק כמו הוצאה שנרשמה ידנית בלי קהל יעד. */
  function ideaAudience(idea) {
    var aud = (idea && idea.audiences) || [];
    if (aud.length !== 1) return '';
    if (aud[0] === 'staff') return 'staff_edu';
    if (aud[0] === 'children') return 'children';
    return '';
  }

  /* האם הרעיון מיועד לצוות. רק אז שדות הצוות שעל השורה קובעים כמות. */
  function staffIdea(idea) {
    var aud = idea && idea.audiences;
    return !!(aud && aud.indexOf('staff') > -1);
  }

  /* שדות הצוות (דרגה, אנשים שנבחרו, פריט משותף) נשארים על השורה גם
     כשקהל היעד משתנה לילדים או לכיבוד, כדי שחזרה לצוות לא תאבד את
     הבחירה. כל עוד הרעיון אינו לצוות הם נזנחים, והכמות היא זו שנקבעה
     ידנית — אחרת שורה אחת הייתה נספרת לפי הרכב הצוות בטופס ולפי כמות
     בכרטיס, ושני המספרים לא היו מסתדרים. */
  function lineQtyFor(staff, l, state) {
    return lineQty(staff ? l : { qty: l && l.qty, amount: l && l.amount }, state);
  }
  function lineTotalFor(staff, l, state) {
    return round2(lineQtyFor(staff, l, state) * num(l && l.amount));
  }

  function ideaTotal(idea, state) {
    var staff = staffIdea(idea);
    return round2((idea.lines || []).reduce(function (s, l) {
      return s + lineTotalFor(staff, l, state);
    }, 0));
  }

  /* חלוקת עלות הרעיון לפי קהל היעד — כמה יוצא לכל ילד / איש צוות */
  function ideaSplit(state, idea) {
    var total = ideaTotal(idea, state);
    var aud = idea.audiences && idea.audiences.length ? idea.audiences : ['children'];
    var kids = childCount(state);
    var team = staffCount(state);

    var heads = 0;
    if (aud.indexOf('children') > -1) heads += kids;
    if (aud.indexOf('staff') > -1) heads += team;
    // "כיבוד" אינו לפי נפש — הוא מחושב כמנה אחת לכלל הגן
    var foodOnly = aud.length === 1 && aud[0] === 'food';

    var parts = [];
    if (aud.indexOf('children') > -1) {
      parts.push({ id: 'children', count: kids, share: heads > 0 ? round2(total / heads) : 0 });
    }
    if (aud.indexOf('staff') > -1) {
      parts.push({ id: 'staff', count: team, share: heads > 0 ? round2(total / heads) : 0 });
    }
    if (aud.indexOf('food') > -1) {
      parts.push({ id: 'food', count: 1, share: foodOnly ? round2(total) : 0 });
    }

    return {
      total: round2(total),
      heads: heads,
      perHead: heads > 0 ? round2(total / heads) : 0,
      perChild: kids > 0 && aud.indexOf('children') > -1 ? round2(total / Math.max(1, heads)) : 0,
      parts: parts,
      /* כמה זה מוסיף לכל משפחה. רעיון הוא הוצאה עתידית, ולכן הוא
         מתחלק שווה בשווה בין כל הילדים שברשימה — גם מי שהצטרף
         באמצע השנה משתתף בו במלואו. */
      perParent: kids > 0 ? round2(total / kids) : 0
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
    var total = ideaTotal(idea, state);
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
                 kind: e.note || Lang.t('eventOf'), refId: e.id });
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
    unassignedTotal: unassignedTotal, distinctPayers: distinctPayers, payerGroups: payerGroups,
    totalShareUnits: totalShareUnits, fullChildShare: fullChildShare,
    collectPerChild: collectPerChild, collectFirst: collectFirst, budgetFrame: budgetFrame,
    budgetDirectionsOn: directionsOn,
    childCollection: childCollection, collectionRows: collectionRows,
    collectionSummary: collectionSummary, byMethod: byMethod,
    overview: overview, refunds: refunds,
    ideaTotal: ideaTotal, lineTotal: lineTotal, lineQty: lineQty,
    staffIdea: staffIdea, lineTotalFor: lineTotalFor, lineQtyFor: lineQtyFor,
    ideaAudience: ideaAudience,
    childCount: childCount, staffCount: staffCount,
    staffAtLevel: staffAtLevel,
    levelWeight: levelWeight, staffWeightUnits: staffWeightUnits, levelShare: levelShare, levelPerPerson: levelPerPerson,
    levelRank: levelRank, rankToWeight: rankToWeight, lowestRank: lowestRank,
    ideaSplit: ideaSplit, ideaVsBudget: ideaVsBudget,
    allDates: allDates, nextOccurrence: nextOccurrence, upcoming: upcoming
  };
})();
