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

  function sharePercent(child, settings) {
    if (child.sharePercentOverride !== null && child.sharePercentOverride !== undefined && child.sharePercentOverride !== '') {
      return Math.max(0, Math.min(100, num(child.sharePercentOverride)));
    }
    return autoSharePercent(child, settings);
  }

  /* ---------- קהל יעד של סעיף תקציב ---------- */
  /* סעיף יכול להיות סכום כולל, או סכום לאדם שמוכפל במספר הילדים
     או אנשי הצוות החינוכי. כשמתווסף ילד לרשימה, הסעיף מתעדכן מאליו. */
  var AUDIENCE_COUNTS = {
    children: function (state) { return (state.children || []).length; },
    staff_edu: function (state) {
      return (state.staff || []).filter(function (t) {
        return Store.staffLevel(t.level).edu === true;
      }).length;
    }
  };

  function audienceCount(state, audience) {
    var fn = AUDIENCE_COUNTS[audience];
    return fn ? fn(state) : 0;
  }

  function audienceLabel(audience, count) {
    if (audience === 'children')  return count + (count === 1 ? ' ילד/ה' : ' ילדים');
    if (audience === 'staff_edu') return count + (count === 1 ? ' איש/ת צוות' : ' אנשי צוות חינוכי');
    return '';
  }

  /* הסכום האפקטיבי של סעיף — מחושב מחדש בכל פעם, כדי שלא ייווצר
     פער בין הסכום השמור למספר הילדים בפועל */
  function itemAmount(state, item) {
    if (item && item.audience && item.perPerson !== '' && item.perPerson !== null && item.perPerson !== undefined) {
      return num(item.perPerson) * audienceCount(state, item.audience);
    }
    return num(item && item.amount);
  }

  /* ---------- תקציב מתוכנן ---------- */
  function budgetTotal(state) {
    return (state.budgetItems || []).reduce(function (s, b) { return s + itemAmount(state, b); }, 0);
  }
  function budgetByCategory(state) {
    var map = {};
    (state.budgetItems || []).forEach(function (b) {
      map[b.categoryId] = (map[b.categoryId] || 0) + itemAmount(state, b);
    });
    return map;
  }

  /* ---------- הוצאות בפועל ---------- */
  function expensesTotal(state) {
    return (state.expenses || []).reduce(function (s, e) { return s + num(e.amount); }, 0);
  }
  function expensesByCategory(state) {
    var map = {};
    (state.expenses || []).forEach(function (e) {
      map[e.categoryId] = (map[e.categoryId] || 0) + num(e.amount);
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

  /* סך יחידות ההשתתפות בגן — ילד מלא = 1, ילד ב-50% = 0.5 */
  function totalShareUnits(state) {
    return (state.children || []).reduce(function (s, c) {
      return s + sharePercent(c, state.settings) / 100;
    }, 0);
  }

  /* עלות לילד "מלא" — התקציב מחולק במספר יחידות ההשתתפות */
  function fullChildShare(state) {
    var units = totalShareUnits(state);
    if (units <= 0) return 0;
    return budgetTotal(state) / units;
  }

  /* פירוט הגבייה לכל ילד */
  function childCollection(state, child) {
    var pct = sharePercent(child, state.settings);
    var due = Math.round(fullChildShare(state) * (pct / 100));   // מעגלים לשקלים שלמים — נוח לגבייה
    var pays = paymentsOf(state, child.id);
    var paid = pays.reduce(function (s, p) { return s + num(p.amount); }, 0);
    var remaining = round2(due - paid);
    var plan = num(child.installmentsPlan) || 0;
    return {
      child: child,
      percent: pct,
      due: due,
      paid: round2(paid),
      remaining: remaining,
      status: remaining <= 0.5 ? 'full' : (paid > 0 ? 'partial' : 'none'),
      payments: pays,
      installments: plan,
      perInstallment: plan > 1 ? round2(due / plan) : 0,
      nextInstallment: plan > 1 ? round2(Math.max(0, remaining) / Math.max(1, plan - pays.length)) : 0
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
      fullCount: rows.filter(function (r) { return r.status === 'full'; }).length,
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
  function refunds(state) {
    var collected = collectedTotal(state);
    var spent = expensesTotal(state);
    var pot = round2(collected - spent);
    var rows = collectionRows(state);
    var units = totalShareUnits(state);
    var costPerUnit = units > 0 ? spent / units : 0;

    var out = rows.map(function (r) {
      var weight = r.percent / 100;
      var fairCost = round2(costPerUnit * weight);   // חלקו האמיתי של ההורה בהוצאות
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
  function ideaTotal(idea) {
    return (idea.lines || []).reduce(function (s, l) { return s + num(l.amount); }, 0);
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
      // כמה זה מוסיף לעלות לכל הורה (מתוך יחידות ההשתתפות)
      perParent: totalShareUnits(state) > 0 ? round2(total / totalShareUnits(state)) : 0
    };
  }

  /* השוואה מול הקטגוריה שנבחרה לרעיון */
  function ideaVsBudget(state, idea) {
    if (!idea.categoryId) return null;
    var planned = budgetByCategory(state)[idea.categoryId] || 0;
    var spent = expensesByCategory(state)[idea.categoryId] || 0;
    var left = planned - spent;
    var total = ideaTotal(idea);
    return {
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
                 date: c.birthDate, icon: '🎂', tone: 'pink', refId: c.id });
    });
    (state.staff || []).forEach(function (t) {
      if (!t.birthDate) return;
      out.push({ id: 'bs-' + t.id, type: 'birthday', title: 'יום הולדת — ' + t.name + ' (צוות)',
                 date: t.birthDate, icon: '🎂', tone: 'purple', refId: t.id });
    });
    (state.budgetItems || []).forEach(function (b) {
      if (!b.date) return;
      var cat = Store.category(b.categoryId);
      out.push({ id: 'bi-' + b.id, type: 'budget', title: b.title || cat.name,
                 date: b.date, icon: cat.icon, tone: cat.tone, refId: b.id });
    });
    (state.events || []).forEach(function (e) {
      out.push({ id: 'ev-' + e.id, type: e.type || 'event', title: e.title,
                 date: e.date, icon: e.icon || '📅', tone: e.tone || 'blue', refId: e.id });
    });
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
    autoSharePercent: autoSharePercent, sharePercent: sharePercent,
    budgetTotal: budgetTotal, budgetByCategory: budgetByCategory,
    audienceCount: audienceCount, audienceLabel: audienceLabel, itemAmount: itemAmount,
    expensesTotal: expensesTotal, expensesByCategory: expensesByCategory,
    paymentsOf: paymentsOf, paidBy: paidBy, collectedTotal: collectedTotal,
    totalShareUnits: totalShareUnits, fullChildShare: fullChildShare,
    childCollection: childCollection, collectionRows: collectionRows,
    collectionSummary: collectionSummary, byMethod: byMethod,
    overview: overview, refunds: refunds,
    ideaTotal: ideaTotal, ideaSplit: ideaSplit, ideaVsBudget: ideaVsBudget,
    allDates: allDates, nextOccurrence: nextOccurrence, upcoming: upcoming
  };
})();
