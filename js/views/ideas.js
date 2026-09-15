/* ============================================================
   רעיונות למתנות — סיעור מוחות
   כל ריבוע = רעיון להוצאה: קטגוריה, קהל יעד, שורות הוצאה וחלוקה לנפש
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.ideas = (function () {

  /* כמה נפשות יש בכל קהל יעד — מוצג בסוגריים כדי שהחישוב יהיה גלוי.
     "כיבוד" אינו נספר לפי נפש ולכן אינו מקבל מספר. */
  function audienceSize(id) {
    if (id === 'children') return (Store.state.children || []).length;
    if (id === 'staff')    return (Store.state.staff || []).length;
    return null;
  }

  /* צורת יחיד לקהלי היעד, לניסוח "לכל ילד" / "לכל איש צוות".
     "כיבוד" אינו נספר לפי נפש ולכן אינו מופיע כאן. */
  var ONE = { children: 'ילד', staff: 'איש צוות' };

  /* למי מיועדת המתנה — לפי מה שנבחר ברעיון */
  function perHeadLabel(idea) {
    var names = (idea.audiences || []).filter(function (id) { return ONE[id]; })
                                      .map(function (id) { return ONE[id]; });
    return names.length ? 'לכל ' + names.join('/') : 'לכל אחד';
  }

  /* שם הדרגה ביחיד או ברבים, לפי כמה אנשי צוות יש בה */
  function levelName(levelId, count) {
    if (levelId === 'shared') return 'פריט משותף לכל הצוות';
    if (levelId === 'all') return 'כל הצוות';
    if (levelId === 'edu') return 'כל הצוות החינוכי';
    var lv = Store.staffLevel(levelId);
    return (count === 1 || !lv.plural) ? lv.name : lv.plural;
  }

  /* הדרגות שיש בהן אנשי צוות בפועל, לפי סדר ההייררכיה */
  function staffMix() {
    var st = Store.state;
    return Store.STAFF_LEVELS.map(function (lv) {
      return { level: lv, count: Calc.staffAtLevel(st, lv.id) };
    }).filter(function (x) { return x.count > 0; });
  }

  /* ---------- למי מיועדת שורת ההוצאה ---------- */
  /* שורה מצביעה על אנשי צוות מסוימים (staffIds) ועל שמות חופשיים (names).
     שורה שנשמרה לפני השינוי, עם levelId בלבד, ממשיכה לעבוד כפי שהיא,
     ומתורגמת לבחירה מפורשת רק ברגע שנפתח חלון הבחירה. */
  function linePicked(l) { return !!(l && (l.staffIds || l.names)); }
  function lineIds(l)    { return (l && l.staffIds) || []; }
  function lineNames(l)  { return (l && l.names) || []; }

  function staffById(id) {
    return (Store.state.staff || []).filter(function (t) { return t.id === id; })[0];
  }
  function idsOfLevel(levelId) {
    var st = Store.state;
    if (levelId === 'all') return (st.staff || []).map(function (t) { return t.id; });
    if (levelId === 'edu') {
      var edu = Store.eduLevelIds();
      return (st.staff || []).filter(function (t) { return edu.indexOf(t.level) > -1; })
                             .map(function (t) { return t.id; });
    }
    return (st.staff || []).filter(function (t) { return t.level === levelId; })
                           .map(function (t) { return t.id; });
  }

  /* תרגום שורה ישנה לבחירה מפורשת, כדי שחלון הבחירה ייפתח על המצב הקיים */
  function ensurePicked(l) {
    if (linePicked(l)) return;
    if (l.levelId === 'shared') { l.shared = true; l.staffIds = idsOfLevel('all'); }
    else if (l.levelId)         { l.staffIds = idsOfLevel(l.levelId); }
    else                        { l.staffIds = []; }
    l.names = [];
  }

  function sameSet(a, b) {
    return a.length === b.length && a.every(function (x) { return b.indexOf(x) > -1; });
  }
  /* "כל ה" משתלב רק בשם רבים של מילה אחת. "מטפלי פרא-רפואי" נשאר כפי שהוא. */
  function allOfLabel(level) {
    var pl = level.plural || level.name;
    return pl.indexOf(' ') > -1 ? pl : ('כל ה' + pl);
  }
  function peopleWord(n) {
    return n + (n === 1 ? ' איש/ת צוות' : ' אנשי צוות');
  }
  /* אם הבחירה היא בדיוק קבוצה מוכרת, מתארים אותה בשמה במקום למנות שמות */
  function groupLabelFor(ids) {
    if (!ids.length) return null;
    if (sameSet(ids, idsOfLevel('all'))) return 'כל הצוות';
    if (sameSet(ids, idsOfLevel('edu'))) return 'כל הצוות החינוכי';
    var out = null;
    staffMix().forEach(function (x) {
      if (sameSet(ids, idsOfLevel(x.level.id))) out = allOfLabel(x.level);
    });
    return out;
  }

  /* הטקסט שמופיע על כפתור "למי?" בשורה — שם הדרגה וכמה
     נבחרו ממנה, בלי שמות פרטיים */
  function whoLabel(l) {
    var tail = l.shared ? ' · פריט משותף' : '';
    if (!linePicked(l)) {
      if (l.levelId === 'shared') return 'פריט אחד';
      if (!l.levelId) return 'בחרו למי';
      var k = Calc.staffAtLevel(Store.state, l.levelId);
      return levelName(l.levelId, k) + ' (' + k + ')';
    }

    var ids = lineIds(l), names = lineNames(l), n = ids.length + names.length;
    /* פריט אחד משותף מתומחר בפני עצמו — המחיר אינו תלוי במי סומן */
    if (!n) return l.shared ? 'פריט אחד' : 'בחרו למי';

    /* בחירה שמכסה בדיוק קבוצה מוכרת מתוארת בשמה, ולא דרגה-דרגה */
    if (!names.length) {
      if (sameSet(ids, idsOfLevel('all'))) return 'כל הצוות (' + n + ')' + tail;
      if (sameSet(ids, idsOfLevel('edu'))) return 'כל הצוות החינוכי (' + n + ')' + tail;
    }

    var parts = [];
    staffMix().forEach(function (x) {
      var c = idsOfLevel(x.level.id).filter(function (id) { return ids.indexOf(id) > -1; }).length;
      if (c) parts.push(levelName(x.level.id, c) + ' (' + c + ')');
    });
    var known = Store.STAFF_LEVELS.map(function (lv) { return lv.id; });
    var others = (Store.state.staff || []).filter(function (t) {
      return known.indexOf(t.level) < 0 && ids.indexOf(t.id) > -1;
    }).length;
    if (others) parts.push('שאר הצוות (' + others + ')');
    if (names.length) parts.push('שמות חופשיים (' + names.length + ')');
    return parts.join(' · ') + tail;
  }

  function audienceLabel(id) {
    var au = Store.audience(id);
    var n = audienceSize(id);
    return au.name + (n === null ? '' : ' (' + n + ')');
  }


  /* ---------- כרטיס רעיון ---------- */
  function ideaCard(idea) {
    var st = Store.state;
    var cat = idea.categoryId ? Store.category(idea.categoryId) : null;
    var split = Calc.ideaSplit(st, idea);
    var vs = Calc.ideaVsBudget(st, idea);
    var accent = UI.toneHex(cat ? cat.tone : 'purple');

    var html = '<article class="idea' + (idea.chosen ? ' chosen' : '') + '" style="--accent:' + accent + '">';

    /* כותרת */
    html += '<div class="idea-head">' +
      '<span class="r-ico" style="background:' + UI.toneVar(cat ? cat.tone : 'purple') + '">' + (cat ? UI.catIcon(cat) : '💡') + '</span>' +
      '<h3>' + UI.esc(idea.title || 'רעיון חדש') +
        (idea.chosen ? ' <span class="badge ok">נבחר ✓</span>' : '') + '</h3>' +
      '<button class="iconbtn plain" data-action="idea-edit" data-id="' + idea.id + '" aria-label="עריכה">✏️</button>' +
      '</div>';

    /* קטגוריית תקציב וקהל יעד */
    html += '<div class="flex wrap" style="gap:6px;margin-bottom:10px">' +
      '<span class="badge info">🧮 ' +
        UI.esc(vs && vs.item ? itemName(vs.item) : (cat ? cat.name : 'ללא סעיף תקציב')) + '</span>' +
      (idea.audiences || []).map(function (a) {
        var au = Store.audience(a);
        return '<span class="badge" style="background:' + UI.toneVar(au.tone) + ';color:' + UI.toneInk(au.tone) + '">' +
          au.icon + ' ' + UI.esc(audienceLabel(a)) + '</span>';
      }).join('') +
      '</div>';

    /* שורות ההוצאה — תצוגה בלבד; העריכה נעשית בטופס הרעיון (✏️) */
    html += '<div class="lines">';
    if (!(idea.lines || []).length) {
      html += '<p class="muted small" style="margin:0 0 8px">עוד אין שורות הוצאה ברעיון הזה — אפשר להוסיף בעריכה ✏️</p>';
    } else {
      html += idea.lines.map(function (l) {
        return '<div class="idea-line">' +
          '<span class="il-name">' + UI.esc(l.label || 'סעיף') + '</span>' +
          '<span class="il-calc">' + Calc.lineQty(l, st) + ' \u00d7 ' + UI.money(l.amount) + '</span>' +
          '<b class="il-sum">' + UI.money(Calc.lineTotal(l, st)) + '</b>' +
          '</div>';
      }).join('');
    }
    html += '</div>';

    /* סה"כ */
    html += '<div class="flex-between" style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--line)">' +
      '<span class="small muted">סה״כ הרעיון</span>' +
      '<b style="font-size:19px">' + UI.money(split.total) + '</b></div>';

    /* כמה מתוך תקציב הסעיף הרעיון תופס */
    if (vs && vs.planned > 0) {
      var pct = Math.round((vs.total / vs.planned) * 100);
      var tone = pct > 100 ? 'over' : (pct > 90 ? 'warn' : 'ok');
      html += '<div class="of-budget">' +
        '<div class="flex-between">' +
          '<span class="small muted">מתוך תקציב ' + (vs.item ? 'הסעיף' : 'הקטגוריה') + '</span>' +
          '<b class="ob-val">' + UI.money(vs.total) + ' מתוך ' + UI.money(vs.planned) + '</b>' +
        '</div>' +
        '<div class="ob-bar">' +
          UI.bar(vs.total, vs.planned, 'thin ' + tone) +
          '<span class="ob-pct' + (pct > 100 ? ' neg' : '') + '">' + pct + '%</span>' +
        '</div>' +
        '</div>';
    }

    /* חלוקה לנפש */
    if (split.parts.length) {
      html += '<div class="split">' + split.parts.map(function (p) {
        var au = Store.audience(p.id);
        return '<div class="sp" style="background:' + UI.toneVar(au.tone) + ';color:' + UI.toneInk(au.tone) + '">' +
          '<div class="sp-ico">' + au.icon + '</div>' +
          '<div class="sp-val">' + UI.money(p.share) +
            (ONE[p.id] ? ' <span class="sp-per">לכל ' + ONE[p.id] + '</span>' : '') + '</div>' +
          '<div class="sp-lab">' + au.name + ' · ' + p.count + '</div></div>';
      }).join('') + '</div>';
      html += '<div class="small muted center" style="margin-top:8px">' +
        (split.heads > 0 ? split.heads + ' נפשות · ' + UI.money(split.perHead) + ' ' + perHeadLabel(idea)
                         : 'הוצאה כללית לגן') +
        ' · ' + UI.money(split.perParent) + ' לכל הורה</div>';
    }

    if (idea.note) {
      html += '<p class="small muted" style="margin:10px 0 0">📝 ' + UI.esc(idea.note) + '</p>';
    }

    /* פעולות */
    html += '<div class="btn-row mt">' +
      '<button class="btn wa sm" style="flex:1" data-action="idea-wa" data-id="' + idea.id + '">💬 שליחה להורים</button>' +
      (idea.chosen
        ? '<button class="btn ghost sm" style="flex:1" data-action="idea-unchoose" data-id="' + idea.id + '">ביטול בחירה</button>'
        : '<button class="btn sm" style="flex:1" data-action="idea-choose" data-id="' + idea.id + '">בחירת הרעיון</button>') +
      '</div>';

    html += '</article>';
    return html;
  }

  /* שם הסעיף כפי שהוא מוצג ברשימה: שם חופשי, ובהיעדרו שם הקטגוריה */
  function itemName(b) {
    var cat = Store.category(b.categoryId);
    return b.title || cat.name;
  }

  /* רשימת סעיפי התקציב לבחירה, מסודרת לפי סדר הקטגוריות ואז לפי תאריך */
  function budgetOptions() {
    var st = Store.state;
    var order = {};
    (st.categories || []).forEach(function (c, i) { order[c.id] = i; });

    var items = (st.budgetItems || []).slice().sort(function (a, b) {
      var d = (order[a.categoryId] === undefined ? 99 : order[a.categoryId]) -
              (order[b.categoryId] === undefined ? 99 : order[b.categoryId]);
      if (d) return d;
      if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
      return itemName(a).localeCompare(itemName(b), 'he');
    });

    return [{ value: '', label: '— ללא סעיף תקציב —' }].concat(items.map(function (b) {
      return { value: b.id,
               label: Store.category(b.categoryId).icon + '  ' + itemName(b) +
                      '  —  ' + UI.money(Calc.itemAmount(st, b)) };
    }));
  }

  /* כמה נותר בסעיף: המתוכנן פחות מה שכבר נרשם עליו בפועל */
  function itemLeft(itemId) {
    var st = Store.state;
    var b = Calc.budgetItem(st, itemId);
    if (!b) return null;
    var planned = Calc.itemAmount(st, b);
    var spent = Calc.expensesByBudgetItem(st)[b.id] || 0;
    return { planned: planned, spent: spent, left: Calc.round2(planned - spent) };
  }

  /* ---------- טופס רעיון ---------- */
  function ideaForm(idea) {
    var isNew = !idea;
    idea = idea || { title: '', budgetItemId: '', categoryId: '', audiences: ['children'],
                     note: '', lines: [], chosen: false };

    /* רעיון שנוצר לפני שהרעיונות הוצמדו לסעיף תקציב: אם בקטגוריה שלו יש
       בדיוק סעיף אחד, הוא נבחר מראש. אם יש כמה — לא מנחשים. */
    var startItem = idea.budgetItemId || '';
    if (!startItem && idea.categoryId) {
      var same = (Store.state.budgetItems || []).filter(function (b) {
        return b.categoryId === idea.categoryId;
      });
      if (same.length === 1) startItem = same[0].id;
    }

    /* שורות ההוצאה נערכות בתוך הטופס, כדי שאפשר יהיה להזין רעיון שלם בבת אחת */
    var lines = (idea.lines || []).map(function (l) {
      var out = { id: l.id || Store.uid('ln'), label: l.label,
                  qty: (l.qty === undefined || l.qty === null || l.qty === '') ? 1 : l.qty,
                  levelId: l.levelId || '', shared: !!l.shared, amount: l.amount };
      /* בחירת האנשים שנשמרה נטענת כמו שהיא, כדי שעריכה לא תאבד אותה */
      if (l.staffIds || l.names) {
        out.staffIds = (l.staffIds || []).slice();
        out.names = (l.names || []).slice();
      }
      return out;
    });

    /* קהל היעד שמסומן כרגע בטופס. כשהצוות מסומן, שורות ההוצאה
       מוצגות כטבלה שבה בוחרים למי מיועדת כל שורה, והכמות נגזרת מהרכב הצוות. */
    function pickedAudiences(root) {
      var el = root && root.querySelector('#f-audiences');
      if (!el) return idea.audiences || [];
      return el.value ? el.value.split(',') : [];
    }
    function staffMode(root) {
      return pickedAudiences(root).indexOf('staff') > -1;
    }

    /* דרגת הצוות נשמרת על השורה גם כשיוצאים מקהל היעד של צוות,
       כדי שחזרה אליו לא תאבד את הבחירה — אבל החישוב מתעלם ממנה בינתיים. */
    function lineSum(l, staff) {
      return Calc.lineTotal(staff ? l : { qty: l.qty, amount: l.amount }, Store.state);
    }

    /* יציאה מקהל יעד של צוות מקבעת את הכמות שהבחירה הניבה */
    function freezeQty(l) {
      l.qty = Calc.lineQty(l, Store.state) || 1;
    }

    function linesTotal(staff) {
      return lines.reduce(function (s, l) { return s + lineSum(l, staff); }, 0);
    }

    /* שורת הסיכום שמתחת לשורות */
    function totalText(root, total) {
      var sel = root && root.querySelector('#f-budgetItemId');
      var b = sel ? itemLeft(sel.value) : null;
      return 'סה״כ הוצאות <b>' + UI.money(total) + '</b>' +
        (b && b.planned ? '<small>(מתוך ' + UI.money(b.planned) + ')</small>'
                        : '<small>בחירת סעיף תקציב תציג גם כמה ממנו נוצל</small>');
    }

    /* רענון הסכומים בלי לצייר מחדש את כל הבלוק */
    function refreshTotal(root) {
      var total = linesTotal(staffMode(root));
      var el = root.querySelector('#lines-total');
      if (el) el.innerHTML = totalText(root, total);
      var box = root.querySelector('#f-lines');
      if (!box) return;
      var card = box.querySelector('.ib-card');
      var fresh = budgetCardHTML(root, total);
      if (card && fresh) card.outerHTML = fresh;
      else if (card) card.remove();
      else if (fresh) drawLines(root);
    }

    /* כרטיס תקציב הרעיון — כמה הסעיף נותן, כמה הרעיון מנצל ומה נותר */
    /* התקציב המתוכנן של הסעיף שנבחר — הבסיס לכל ההמלצות */
    function plannedOf(root) {
      var sel = root && root.querySelector('#f-budgetItemId');
      var b = sel ? itemLeft(sel.value) : null;
      return (b && b.planned) || 0;
    }

    function budgetCardHTML(root, total) {
      var sel = root && root.querySelector('#f-budgetItemId');
      var b = sel ? itemLeft(sel.value) : null;
      if (!b || !b.planned) return '';
      var left = Calc.round2(b.planned - total);
      var pct = Math.min(100, Math.round((total / b.planned) * 100));
      return '<div class="ib-card">' +
        '<div class="ib-head">' +
          '<span class="ib-ico">' + UI.art('collection') + '</span>' +
          '<span class="ib-main"><span class="ib-lab">תקציב לרעיון</span>' +
            '<b class="ib-val">' + UI.money(b.planned) + '</b></span>' +
        '</div>' +
        '<div class="ib-prog">' +
          UI.bar(total, b.planned, total > b.planned ? 'over' : 'ok') +
          '<div class="ib-sub">' + UI.money(total) + ' נוצלו מתוך ' + UI.money(b.planned) + '</div>' +
        '</div>' +
        '<div class="ib-left"><span class="ib-lab">' + (left >= 0 ? 'נותרו' : 'חריגה') + '</span>' +
          '<b class="' + (left >= 0 ? 'pos' : 'neg') + '">' + UI.money(Math.abs(left)) + '</b></div>' +
        '</div>';
    }

    /* כרטיס הרכב הצוות — מנין נלקחות הכמויות בטבלה */
    function staffMixHTML(planned) {
      var mix = staffMix();
      if (!mix.length) {
        return '<div class="note"><div class="n-ico">\ud83d\udc65</div><div>' +
          '<b>עוד לא נוספו אנשי צוות</b>' +
          'אפשר להוסיף אותם בלשונית "צוות הגן", ואז הכמויות יתמלאו כאן מעצמן.' +
          '</div></div>';
      }

      var total = mix.reduce(function (n, x) { return n + x.count; }, 0);
      /* אורך הפס יחסי לדרגה הגבוהה ביותר שיש בגן, ולא לסולם המלא —
         כך ההבדל בין הדרגות שקיימות בפועל נראה לעין */
      var maxW = mix.reduce(function (m, x) {
        return Math.max(m, Calc.levelWeight(Store.state, x.level.id));
      }, 1);

      return '<div class="staff-mix">' +
        '<div class="sm-head">' +
          '<b>\ud83d\udc65 הרכב צוות הגן</b>' +
          '<span class="sm-total">סה״כ ' + total + ' אנשי צוות</span>' +
        '</div>' +
        /* עמודה לכל דרגה, כך שכולן בשורה אחת ואין דרגה שנופלת לשורה משלה */
        '<div class="sm-grid" style="--cols:' + mix.length + '">' +
          mix.map(function (x) {
            var name = levelName(x.level.id, x.count);
            var w = Calc.levelWeight(Store.state, x.level.id);
            var per = Calc.levelPerPerson(Store.state, x.level.id, planned);
            return '<div class="sm-cell">' +
              '<button type="button" class="sm-top" data-mix="' + x.level.id + '" ' +
                'aria-label="הצגת השמות — ' + UI.esc(name) + '">' +
                '<span class="sm-name">' + UI.esc(name) + '</span>' +
                '<span class="sm-num">(' + x.count + ')</span></button>' +
              '<div class="sm-rank">' +
                '<button type="button" data-w="' + x.level.id + '" data-d="-1" ' +
                  'aria-label="הפחתת רמת התקציב">−</button>' +
                '<span class="sm-rlab">דרגה <b>' + w + '</b></span>' +
                '<button type="button" data-w="' + x.level.id + '" data-d="1" ' +
                  'aria-label="הגדלת רמת התקציב">+</button>' +
              '</div>' +
              '<div class="sm-bar"><i style="width:' + Math.round((w / maxW) * 100) + '%;' +
                'background:' + UI.toneInk(x.level.tone) + '"></i></div>' +
              '<div class="sm-per">' +
                (per ? '<b>' + UI.money(per) + '</b><span>מומלץ לאדם</span>'
                     : '<span>בחרו סעיף תקציב</span>') +
              '</div>' +
              '</div>';
          }).join('') +
        '</div>' +
        '<p class="sm-hint">הסכום המומלץ מחלק את תקציב הסעיף לפי הדרגה ומספר האנשים בה. ' +
          'הדרגה ניתנת לשינוי, והיא משמשת רק לחישוב — לא להערכה אישית. לחיצה על דרגה מציגה את השמות.</p>' +
        '</div>';
    }

    /* חלון בחירת אנשי הצוות של שורת ההוצאה */
    function peoplePicker(i, root) {
      var l = lines[i];
      ensurePicked(l);

      var sel    = lineIds(l).slice();
      var extra  = lineNames(l).slice();
      var shared = !!l.shared;
      var closed = {};
      var query  = '';

      UI.modal({
        title: 'בחרו אנשי צוות',
        subtitle: 'סמנו למי מיועדת המתנה',
        body:
          '<div class="pk-top">' +
            '<input class="input pk-search" type="search" placeholder="חיפוש בשם…" aria-label="חיפוש בשם">' +
            '<button type="button" class="btn sm soft pk-clear">נקה הכל</button>' +
          '</div>' +
          '<label class="pk-shared">' +
            '<input type="checkbox" class="pk-shared-in"' + (shared ? ' checked' : '') + '>' +
            '<span><b>פריט אחד משותף</b><small>רכישה אחת לכל הנבחרים, בלי הכפלה במספרם</small></span>' +
          '</label>' +
          '<div class="pk-list"></div>' +
          '<div class="pk-foot">' +
            '<button type="button" class="btn soft sm pk-add">✏️ + הוספת שם חופשי</button>' +
            '<button type="button" class="btn pk-ok">אישור</button>' +
          '</div>',

        onMount: function (body, close) {
          var list = body.querySelector('.pk-list');

          function count() { return sel.length + extra.length; }

          function updateFoot() {
            body.querySelector('.pk-ok').textContent =
              count() ? 'אישור (' + count() + ' נבחרו)' : 'אישור';
          }

          function matches(t) {
            return !query || (t.name || '').toLowerCase().indexOf(query) > -1;
          }

          function drawList() {
            var st = Store.state;
            var html = '';

            staffMix().forEach(function (x) {
              var people = (st.staff || []).filter(function (t) { return t.level === x.level.id; });
              var shown = people.filter(matches);
              if (!shown.length) return;
              var ids = people.map(function (t) { return t.id; });
              var allOn = ids.every(function (id) { return sel.indexOf(id) > -1; });
              var isClosed = !!closed[x.level.id];

              html += '<div class="pk-group">' +
                '<div class="pk-ghead">' +
                  '<button type="button" class="pk-gtog' + (isClosed ? ' closed' : '') + '" ' +
                    'data-tog="' + x.level.id + '" aria-label="קיפול הקבוצה">' +
                    UI.svgIcon('chevron', 14) + '</button>' +
                  '<span class="pk-gname">' + x.level.icon + ' ' +
                    UI.esc(levelName(x.level.id, people.length)) + ' (' + people.length + ')</span>' +
                  '<label class="pk-gall"><span>בחרו הכל</span>' +
                    '<input type="checkbox" data-gall="' + x.level.id + '"' + (allOn ? ' checked' : '') + '>' +
                  '</label>' +
                '</div>' +
                (isClosed ? '' : '<div class="pk-rows">' + shown.map(function (t) {
                  return '<label class="pk-row">' +
                    '<input type="checkbox" data-id="' + t.id + '"' +
                      (sel.indexOf(t.id) > -1 ? ' checked' : '') + '>' +
                    '<span class="avatar" style="background:' + UI.toneVar(x.level.tone) + '">' +
                      x.level.icon + '</span>' +
                    '<span class="pk-body"><span class="pk-name">' + UI.esc(t.name) + '</span>' +
                      '<span class="pk-role">' + UI.esc(t.role || x.level.name) + '</span></span>' +
                    '</label>';
                }).join('') + '</div>') +
                '</div>';
            });

            /* אנשי צוות שהדרגה שלהם אינה מוכרת — אחרת הם ייעלמו מהבחירה */
            var known = Store.STAFF_LEVELS.map(function (lv) { return lv.id; });
            var orphans = (st.staff || []).filter(function (t) { return known.indexOf(t.level) < 0; });
            var shownOrphans = orphans.filter(matches);
            if (shownOrphans.length) {
              var oIds = orphans.map(function (t) { return t.id; });
              var oAll = oIds.every(function (id) { return sel.indexOf(id) > -1; });
              html += '<div class="pk-group"><div class="pk-ghead">' +
                '<span class="pk-gname">👤 שאר הצוות (' + orphans.length + ')</span>' +
                '<label class="pk-gall"><span>בחרו הכל</span>' +
                  '<input type="checkbox" data-gother="1"' + (oAll ? ' checked' : '') + '></label>' +
                '</div><div class="pk-rows">' + shownOrphans.map(function (t) {
                  return '<label class="pk-row">' +
                    '<input type="checkbox" data-id="' + t.id + '"' +
                      (sel.indexOf(t.id) > -1 ? ' checked' : '') + '>' +
                    '<span class="avatar">👤</span>' +
                    '<span class="pk-body"><span class="pk-name">' + UI.esc(t.name) + '</span>' +
                      '<span class="pk-role">' + UI.esc(t.role || 'צוות') + '</span></span>' +
                    '</label>';
                }).join('') + '</div></div>';
            }

            var shownExtra = extra.filter(function (n) {
              return !query || n.toLowerCase().indexOf(query) > -1;
            });
            if (shownExtra.length) {
              html += '<div class="pk-group"><div class="pk-ghead">' +
                '<span class="pk-gname">✏️ שמות חופשיים (' + extra.length + ')</span></div>' +
                '<div class="pk-rows">' + shownExtra.map(function (n) {
                  return '<div class="pk-row static">' +
                    '<button type="button" class="iconbtn del" data-rm="' + UI.esc(n) + '" ' +
                      'aria-label="הסרת השם">✕</button>' +
                    '<span class="avatar" style="background:var(--purple)">✏️</span>' +
                    '<span class="pk-body"><span class="pk-name">' + UI.esc(n) + '</span>' +
                      '<span class="pk-role">שם חופשי</span></span>' +
                    '</div>';
                }).join('') + '</div></div>';
            }

            if (!html) {
              html = '<p class="small muted" style="text-align:center;margin:18px 0">' +
                (query ? 'אין תוצאות לחיפוש.' : 'עוד לא נוספו אנשי צוות בלשונית "צוות הגן".') + '</p>';
            }
            list.innerHTML = html;
            wireList();
            updateFoot();
          }

          function wireList() {
            Array.prototype.forEach.call(list.querySelectorAll('[data-id]'), function (cb) {
              cb.addEventListener('change', function () {
                var id = cb.getAttribute('data-id');
                var at = sel.indexOf(id);
                if (cb.checked && at < 0) sel.push(id);
                if (!cb.checked && at > -1) sel.splice(at, 1);
                drawList();
              });
            });
            Array.prototype.forEach.call(list.querySelectorAll('[data-gall]'), function (cb) {
              cb.addEventListener('change', function () {
                var ids = idsOfLevel(cb.getAttribute('data-gall'));
                ids.forEach(function (id) {
                  var at = sel.indexOf(id);
                  if (cb.checked && at < 0) sel.push(id);
                  if (!cb.checked && at > -1) sel.splice(at, 1);
                });
                drawList();
              });
            });
            var other = list.querySelector('[data-gother]');
            if (other) other.addEventListener('change', function () {
              var known = Store.STAFF_LEVELS.map(function (lv) { return lv.id; });
              (Store.state.staff || []).forEach(function (t) {
                if (known.indexOf(t.level) > -1) return;
                var at = sel.indexOf(t.id);
                if (other.checked && at < 0) sel.push(t.id);
                if (!other.checked && at > -1) sel.splice(at, 1);
              });
              drawList();
            });
            Array.prototype.forEach.call(list.querySelectorAll('[data-tog]'), function (btn) {
              btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-tog');
                closed[id] = !closed[id];
                drawList();
              });
            });
            Array.prototype.forEach.call(list.querySelectorAll('[data-rm]'), function (btn) {
              btn.addEventListener('click', function () {
                var n = btn.getAttribute('data-rm');
                var at = extra.indexOf(n);
                if (at > -1) extra.splice(at, 1);
                drawList();
              });
            });
          }

          body.querySelector('.pk-search').addEventListener('input', function (e) {
            query = (e.target.value || '').toLowerCase().trim();
            drawList();
          });
          body.querySelector('.pk-clear').addEventListener('click', function () {
            sel = []; extra = [];
            drawList();
          });
          body.querySelector('.pk-shared-in').addEventListener('change', function (e) {
            shared = e.target.checked;
          });
          body.querySelector('.pk-add').addEventListener('click', function () {
            addNameModal(function (name) {
              if (extra.indexOf(name) < 0) extra.push(name);
              drawList();
            });
          });
          body.querySelector('.pk-ok').addEventListener('click', function () {
            l.staffIds = sel.slice();
            l.names = extra.slice();
            l.shared = shared;
            l.levelId = '';          // הבחירה המפורשת מחליפה את הקיצור הישן
            close();
            drawLines(root);
            refreshTotal(root);
          });

          drawList();
        }
      });
    }

    /* הוספת שם של מי שאינו ברשימת הצוות */
    function addNameModal(onAdd) {
      UI.formModal({
        title: 'הוספת שם חופשי',
        subtitle: 'שם של מי שאינו ברשימת הצוות — למשל גננת מחליפה או ספק חיצוני',
        submitLabel: 'הוסף',
        fields: [{ name: 'pname', label: 'שם', value: '', required: true,
                   placeholder: 'הקלידו שם…' }],
        onSubmit: function (v) {
          var name = (v.pname || '').trim();
          if (!name) return false;
          onAdd(name);
        }
      });
    }

    /* לחיצה על ריבוע הכמות פותחת את רשימת השמות שבאותה דרגה */
    function staffListModal(levelId) {
      var lv = Store.staffLevel(levelId);
      var list = (Store.state.staff || []).filter(function (t) { return t.level === levelId; });
      UI.modal({
        title: levelName(levelId, list.length),
        subtitle: list.length + (list.length === 1 ? ' איש/ת צוות' : ' אנשי צוות'),
        body: list.length
          ? list.map(function (t) {
              return '<div class="row tinted" style="background:' + UI.toneVar(lv.tone) + '33">' +
                '<div class="avatar" style="background:' + UI.toneVar(lv.tone) + '">' + lv.icon + '</div>' +
                '<div class="r-body"><div class="r-name">' + UI.esc(t.name) + '</div>' +
                '<div class="r-sub">' + UI.esc(t.role || lv.name) + '</div></div>' +
                '</div>';
            }).join('')
          : '<p class="small muted mb0">אין אנשי צוות בדרגה הזו.</p>'
      });
    }

    /* הסכום המומלץ לאדם בשורה: ממוצע ההמלצה של הדרגות שנבחרו בה.
       שורה שכולה דרגה אחת מקבלת בדיוק את ההמלצה של אותה דרגה. */
    function recPerPerson(l, root) {
      var sel = root && root.querySelector('#f-budgetItemId');
      var b = sel ? itemLeft(sel.value) : null;
      if (!b || !b.planned || l.shared) return 0;

      var st = Store.state;
      // שורה עם דרגה בלבד — ההמלצה היא של אותה דרגה
      if (!linePicked(l)) {
        if (!l.levelId || l.levelId === 'shared') return 0;
        return Calc.levelPerPerson(st, l.levelId, b.planned);
      }

      var ids = lineIds(l);
      if (!ids.length) return 0;
      var sum = 0, n = 0;
      ids.forEach(function (id) {
        var t = staffById(id);
        if (!t) return;
        sum += Calc.levelPerPerson(st, t.level, b.planned);
        n++;
      });
      return n ? Calc.round2(sum / n) : 0;
    }

    function recHintHTML(l, root) {
      var per = recPerPerson(l, root);
      return per ? '<span class="ln-rec">מומלץ: ' + UI.money(per) + '</span>' : '';
    }

    function linesTableHTML(root) {
      return '<div class="line-tbl"><table><thead><tr>' +
          '<th>מוצר / שירות</th><th>למי?</th>' +
          '<th class="end">מחיר לאדם</th><th class="end">סה״כ</th><th></th>' +
        '</tr></thead><tbody>' +
        lines.map(function (l, i) {
          return '<tr>' +
            '<td data-lab="מוצר / שירות"><input class="input" data-ln="label" data-i="' + i + '" ' +
              'placeholder="מוצר / שירות" value="' + UI.esc(l.label || '') + '"></td>' +
            '<td data-lab="למי?"><button type="button" class="who-btn" data-who="' + i + '" aria-label="בחירת מקבלי המתנה">' +
              '<span class="who-txt">' + UI.esc(whoLabel(l)) + '</span>' +
              '<span class="who-chev">' + UI.svgIcon('chevron', 13) + '</span>' +
              '</button></td>' +
            '<td data-lab="מחיר לאדם"><input class="input end" data-ln="amount" data-i="' + i + '" type="number" ' +
              'inputmode="decimal" min="0" placeholder="0" aria-label="מחיר לאדם" ' +
              'value="' + UI.esc(l.amount === '' || l.amount === undefined ? '' : l.amount) + '">' +
              '<span data-ln-rec="' + i + '">' + recHintHTML(l, root) + '</span></td>' +
            '<td class="end" data-lab="סה״כ"><b data-ln-sum="' + i + '">' + UI.money(lineSum(l, true)) + '</b></td>' +
            '<td><button type="button" class="iconbtn del" data-ln-del="' + i + '" ' +
              'aria-label="מחיקת שורה">✕</button></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';
    }

    function lineCardsHTML() {
      return lines.map(function (l, i) {
        return '<div class="line-card">' +
          '<div class="lc-top">' +
            '<input class="input" data-ln="label" data-i="' + i + '" placeholder="שם המתנה" ' +
              'value="' + UI.esc(l.label || '') + '">' +
            '<button type="button" class="iconbtn del" data-ln-del="' + i + '" ' +
              'aria-label="מחיקת שורה">✕</button>' +
          '</div>' +
          '<div class="lc-calc">' +
            '<div class="lc-field">' +
              '<span class="lc-lab">כמות</span>' +
              '<input class="input" data-ln="qty" data-i="' + i + '" type="number" inputmode="numeric" min="0" ' +
                'placeholder="1" value="' + UI.esc(l.qty === '' || l.qty === undefined ? '' : l.qty) + '" ' +
                'aria-label="כמות">' +
            '</div>' +
            '<span>×</span>' +
            '<input class="input" data-ln="amount" data-i="' + i + '" type="number" inputmode="decimal" min="0" ' +
              'placeholder="0" value="' + UI.esc(l.amount === '' || l.amount === undefined ? '' : l.amount) + '" ' +
              'aria-label="סכום ליחידה">' +
            '<span>₪ =</span>' +
            '<b data-ln-sum="' + i + '">' + UI.money(lineSum(l, false)) + '</b>' +
          '</div>' +
          '</div>';
      }).join('');
    }

    function drawLines(root) {
      var box = root.querySelector('#f-lines');
      if (!box) return;
      var staff = staffMode(root);

      box.innerHTML =
        budgetCardHTML(root, linesTotal(staff)) +
        (staff ? staffMixHTML(plannedOf(root)) : '') +
        '<label>שורות ההוצאה</label>' +
        (lines.length ? (staff ? linesTableHTML(root) : lineCardsHTML())
                      : '<p class="small muted" style="margin:0 0 8px">עוד לא נוספו שורות הוצאה.</p>') +
        '<div class="ln-foot">' +
          '<button type="button" class="btn soft sm" data-ln-add="1">+ הוספת שורה</button>' +
          '<span class="ln-total" id="lines-total">' + totalText(root, linesTotal(staff)) + '</span>' +
        '</div>';

      Array.prototype.forEach.call(box.querySelectorAll('[data-w]'), function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-w');
          var next = Calc.levelWeight(Store.state, id) + Calc.num(btn.getAttribute('data-d'));
          Store.state.settings.levelWeights = Store.state.settings.levelWeights || {};
          Store.state.settings.levelWeights[id] = Math.max(0, Math.min(10, next));
          Store.save();
          drawLines(root);
        });
      });

      Array.prototype.forEach.call(box.querySelectorAll('[data-who]'), function (btn) {
        btn.addEventListener('click', function () {
          peoplePicker(parseInt(btn.getAttribute('data-who'), 10), root);
        });
      });

      Array.prototype.forEach.call(box.querySelectorAll('[data-mix]'), function (btn) {
        btn.addEventListener('click', function () {
          staffListModal(btn.getAttribute('data-mix'));
        });
      });

      Array.prototype.forEach.call(box.querySelectorAll('[data-ln]'), function (inp) {
        var handler = function () {
          var i = parseInt(inp.getAttribute('data-i'), 10);
          if (!lines[i]) return;
          var key = inp.getAttribute('data-ln');
          lines[i][key] = (key === 'label' || key === 'levelId') ? inp.value
                        : (inp.value === '' ? '' : Calc.num(inp.value));
          var sum = box.querySelector('[data-ln-sum="' + i + '"]');
          if (sum) sum.textContent = UI.money(lineSum(lines[i], staff));
          var rc = box.querySelector('[data-ln-rec="' + i + '"]');
          if (rc) rc.innerHTML = recHintHTML(lines[i], root);
          refreshTotal(root);
        };
        inp.addEventListener('input', handler);
        inp.addEventListener('change', handler);
      });
      Array.prototype.forEach.call(box.querySelectorAll('[data-ln-del]'), function (btn) {
        btn.addEventListener('click', function () {
          lines.splice(parseInt(btn.getAttribute('data-ln-del'), 10), 1);
          drawLines(root);
          refreshTotal(root);
        });
      });
      var add = box.querySelector('[data-ln-add]');
      if (add) add.addEventListener('click', function () {
        lines.push(staff
          ? { id: Store.uid('ln'), label: '', qty: 1, levelId: '',
              staffIds: idsOfLevel('all'), names: [], shared: false, amount: '' }
          : { id: Store.uid('ln'), label: '', qty: 1, levelId: '', amount: '' });
        drawLines(root);
        refreshTotal(root);
        var inputs = box.querySelectorAll('[data-ln="label"]');
        if (inputs.length) inputs[inputs.length - 1].focus();
      });
    }

    UI.formModal({
      title: isNew ? 'רעיון חדש' : 'עריכת רעיון',
      subtitle: 'סעיף התקציב, קהל יעד ופירוט ההוצאות',
      fields: [
        { name: 'title', label: 'שם הרעיון', value: idea.title, required: true,
          placeholder: 'למשל: מתנת סוף שנה — ספר וכוס' },
        { name: 'budgetItemId', label: 'סעיף התקציב', type: 'select', value: startItem,
          options: budgetOptions(),
          hint: (Store.state.budgetItems || []).length
                  ? 'הרעיון מוצמד לסעיף שתוכנן בתקציב, והחישוב נעשה מולו'
                  : 'עוד לא הוגדרו סעיפי תקציב — אפשר להוסיף בלשונית "תקציב"' },
        { name: 'audiences', label: 'קהל יעד', type: 'chips', multi: true, value: idea.audiences,
          options: Store.AUDIENCES.map(function (a) {
            return { value: a.id, label: audienceLabel(a.id), icon: a.icon };
          }),
          hint: 'המספר בסוגריים הוא הכמות שלפיה מחושבת החלוקה לנפש' },
        { name: 'lines', type: 'html', html: '' },
        { name: 'note', label: 'הערות', type: 'textarea', value: idea.note,
          placeholder: 'קישורים, ספקים, רעיונות…' }
      ],

      onMount: function (root) {
        drawLines(root);
        refreshTotal(root);
      },

      onFieldChange: function (name, value, root) {
        /* מעבר לקהל יעד של צוות מחליף את שורות ההוצאה בטבלה לפי דרגות,
           ויציאה ממנו מחזירה לכמות חופשית */
        if (name === 'audiences') {
          /* יציאה מקהל יעד של צוות מקבעת את הכמות שהדרגה הניבה, כך שתיבת
             הכמות נפתחת על המספר הנכון. הדרגה עצמה נשמרת למקרה שחוזרים. */
          if (!staffMode(root)) {
            lines.forEach(function (l) {
              if (l.levelId || linePicked(l)) freezeQty(l);
            });
          }
          drawLines(root);
          return;
        }
        refreshTotal(root);
      },

      onSubmit: function (v) {
        // שורה ריקה לגמרי אינה נשמרת
        var clean = lines.filter(function (l) {
          return (l.label && l.label.trim()) || Calc.num(l.amount) > 0;
        });
        var forStaff = (v.audiences || []).indexOf('staff') > -1;
        clean = clean.map(function (l) {
          var out = { id: l.id, label: l.label,
                      qty: (l.qty === '' || l.qty === undefined) ? 1 : Calc.num(l.qty),
                      levelId: forStaff ? (l.levelId || '') : '',
                      amount: l.amount };
          /* הבחירה נשמרת רק ברעיון שמיועד לצוות */
          if (forStaff && linePicked(l)) {
            out.staffIds = lineIds(l).slice();
            out.names = lineNames(l).slice();
            out.shared = !!l.shared;
          }
          return out;
        });
        var bi = Calc.budgetItem(Store.state, v.budgetItemId);
        var data = {
          title: v.title,
          budgetItemId: v.budgetItemId || '',
          categoryId: bi ? bi.categoryId : '',
          audiences: v.audiences,
          note: v.note, lines: clean
        };
        if (isNew) {
          data.chosen = false;
          Store.add('ideas', data);
        } else {
          Store.update('ideas', idea.id, data);
        }
        App.render();
        UI.toast(isNew ? 'הרעיון נוסף 💡' : 'עודכן ✓');
      },
      onDelete: isNew ? null : function () {
        Store.remove('ideas', idea.id);
        App.render();
        UI.toast('הרעיון נמחק');
      }
    });
  }

  /* פירוט שורות הרעיון כטקסט — משמש גם לשיתוף וגם להערות ההוצאה.
     prefix מאפשר תבליט בהערות, ובלעדיו הטקסט נקי לוואטסאפ. */
  function linesText(idea, prefix) {
    var st = Store.state;
    return (idea.lines || []).map(function (l) {
      var q = Calc.lineQty(l, st);
      var who = l.levelId ? ' (' + levelName(l.levelId, q) + ')' : '';
      return (prefix || '') + (l.label || 'סעיף') + who + ' - ' +
        (q !== 1 ? q + ' × ' + UI.money(l.amount) + ' = ' + UI.money(Calc.lineTotal(l, st))
                 : UI.money(Calc.lineTotal(l, st)));
    }).join('\n');
  }

  /* ---------- טקסט לשיתוף בוואטסאפ ---------- */
  function shareText(idea) {
    var st = Store.state;
    var cat = idea.categoryId ? Store.category(idea.categoryId) : null;
    var bi = Calc.budgetItem(st, idea.budgetItemId);
    var split = Calc.ideaSplit(st, idea);
    var lines = linesText(idea);

    var aud = (idea.audiences || []).map(function (a) { return Store.audience(a).name; }).join(', ');

    return (st.gan.name || 'ועד ההורים') + ' - התייעצות\n\n' +
      'רעיון: ' + (idea.title || 'רעיון') + '\n' +
      (bi ? 'סעיף בתקציב: ' + itemName(bi) + '\n' : (cat ? 'קטגוריה: ' + cat.name + '\n' : '')) +
      (aud ? 'עבור: ' + aud + '\n' : '') +
      '\nפירוט ההוצאות:\n' + (lines || 'אין עדיין שורות') +
      '\n\nסה״כ: ' + UI.money(split.total) +
      (split.heads > 0
        ? '\n' + UI.money(split.perHead) + ' ' + perHeadLabel(idea) + ', ' + split.heads + ' נפשות'
        : '') +
      '\n' + UI.money(split.perParent) + ' לכל הורה' +
      (idea.note ? '\n\nהערות: ' + idea.note : '') +
      '\n\nמה דעתכם?';
  }

  /* הערות ההוצאה שנוצרת מרעיון: מאיפה היא הגיעה, ופירוט השורות
     שהיו ברעיון — כדי שהפירוט יישאר גם אם הרעיון ישתנה או יימחק */
  function expenseNote(idea, total) {
    var detail = linesText(idea, '• ');
    return 'נוצר מרעיון בסיעור מוחות' +
      (detail ? '\n\n' + detail + '\nסה״כ: ' + UI.money(total) : '') +
      (idea.note ? '\n\nהערות: ' + idea.note : '');
  }

  /* ---------- המסך ---------- */
  function render() {
    var st = Store.state;
    var ideas = st.ideas || [];
    var html = UI.pageHead({
      title: 'רעיונות למתנות',
      subtitle: 'סיעור מוחות — משווים אפשרויות ובוחרים',
      art: 'ideas', tone: 'purple', back: 'home'
    });

    html += '<div class="flex-between" style="margin-bottom:14px">' +
      '<span class="small muted">' + ideas.length + ' רעיונות' +
      (ideas.filter(function (i) { return i.chosen; }).length ? ' · ' + ideas.filter(function (i) { return i.chosen; }).length + ' נבחרו' : '') + '</span>' +
      '<button class="btn sm" data-action="idea-add">+ הוספת רעיון</button></div>';

    if (!ideas.length) {
      return html + UI.empty({
        art: 'ideas', title: 'בואו נעשה סיעור מוחות',
        text: 'כל רעיון הוא ריבוע נפרד: בוחרים קטגוריה וקהל יעד, מוסיפים שורות הוצאה — והמערכת מחשבת כמה זה יוצא לכל ילד ולכל הורה.',
        action: { act: 'idea-add', label: '+ הרעיון הראשון' }
      });
    }

    html += '<div class="cols">' + ideas.map(ideaCard).join('') + '</div>';

    /* השוואה בין הרעיונות */
    if (ideas.length > 1) {
      html += '<div class="section-title"><span>השוואה מהירה</span></div>';
      html += '<div class="card"><div class="scroll-x"><table class="tbl">' +
        '<thead><tr><th>רעיון</th><th class="end">סה״כ</th><th class="end">לנפש</th><th class="end">להורה</th></tr></thead><tbody>' +
        ideas.slice().sort(function (a, b) { return Calc.ideaTotal(a, st) - Calc.ideaTotal(b, st); }).map(function (i) {
          var s = Calc.ideaSplit(st, i);
          return '<tr' + (i.chosen ? ' style="background:var(--green)"' : '') + '>' +
            '<td>' + (i.chosen ? '✓ ' : '') + UI.esc(i.title || 'רעיון') + '</td>' +
            '<td class="end">' + UI.money(s.total) + '</td>' +
            '<td class="end">' + UI.money(s.perHead) + '</td>' +
            '<td class="end">' + UI.money(s.perParent) + '</td></tr>';
        }).join('') +
        '</tbody></table></div></div>';
    }

    html += '<button class="btn" data-action="idea-add">+ הוספת רעיון</button>';
    return html;
  }

  return {
    render: render,
    // נחשפים כדי שייצוא התמונה יציג בדיוק את אותם שמות
    itemName: itemName,
    audienceLabel: audienceLabel,
    perHeadLabel: perHeadLabel,
    perOneLabel: function (id) { return ONE[id] ? 'לכל ' + ONE[id] : ''; },
    /* פתיחת הטופס על רעיון נתון — משמש את סיור ההיכרות, שמציג רעיון
       לדוגמה בלי לשמור אותו */
    form: ideaForm,
    actions: {
      /* בלחיצה הראשונה רץ סיור קצר על רעיון לדוגמה, ורק בסופו נפתח
         הטופס הריק. בכל לחיצה אחרת הסיור מחזיר false ולא קורה דבר. */
      'idea-add': function () {
        if (window.Tour && Tour.startIdea && Tour.startIdea()) return;
        ideaForm(null);
      },
      'idea-edit': function (el) { ideaForm(Store.find('ideas', el.getAttribute('data-id'))); },

      'idea-choose': function (el) {
        var idea = Store.find('ideas', el.getAttribute('data-id'));
        if (!idea) return;
        var total = Calc.ideaTotal(idea, Store.state);
        if (total <= 0) { UI.toast('צריך להוסיף שורות הוצאה לפני הבחירה'); return; }
        var vs = Calc.ideaVsBudget(Store.state, idea);
        UI.modal({
          title: 'בחירת הרעיון',
          subtitle: idea.title,
          body: '<p class="small">הרעיון ייכנס ללשונית ההוצאות בפועל, והעלות (' + UI.money(total) + ') תרד מהתקציב' +
                (vs ? ' של ' + (vs.item ? 'הסעיף' : 'הקטגוריה') + ' "' +
                      UI.esc(vs.item ? itemName(vs.item) : Store.category(idea.categoryId).name) + '"' : '') + '.</p>' +
                (vs && !vs.fits ? '<div class="note" style="background:#FDF0F2"><div class="n-ico">⚠️</div><div>' +
                  '<b>שימו לב</b>הסכום חורג מהתקציב שנותר ב' + (vs.item ? 'סעיף' : 'קטגוריה') +
                  ' ב-' + UI.money(Math.abs(vs.diff)) + '.</div></div>' : '') +
                '<div class="btn-row mt"><button class="btn ghost js-cancel">ביטול</button>' +
                '<button class="btn js-ok">אישור והוספה להוצאות</button></div>',
          onMount: function (root, close) {
            root.querySelector('.js-cancel').addEventListener('click', close);
            root.querySelector('.js-ok').addEventListener('click', function () {
              Store.state.expenses = Store.state.expenses.filter(function (e) { return e.ideaId !== idea.id; });
              Store.add('expenses', {
                categoryId: idea.categoryId,
                budgetItemId: idea.budgetItemId || '',
                title: idea.title || 'רעיון שנבחר',
                amount: total,
                date: UI.todayISO(),
                note: expenseNote(idea, total),
                ideaId: idea.id
              });
              Store.update('ideas', idea.id, { chosen: true });
              close();
              App.setView('expenses');
              UI.toast('הרעיון נבחר ונוסף להוצאות ✓');
            });
          }
        });
      },

      'idea-unchoose': function (el) {
        var id = el.getAttribute('data-id');
        Store.state.expenses = Store.state.expenses.filter(function (e) { return e.ideaId !== id; });
        Store.update('ideas', id, { chosen: false });
        App.render();
        UI.toast('הבחירה בוטלה וההוצאה הוסרה');
      },

      'idea-wa': function (el) {
        var idea = Store.find('ideas', el.getAttribute('data-id'));
        if (!idea) return;
        var text = shareText(idea);

        var m = UI.modal({
          title: 'שליחה להתייעצות',
          subtitle: 'שיתוף הרעיון עם ההורים',
          body: '<div id="wa-img" class="wa-img"><p class="small muted center">מכינים תמונה…</p></div>' +
            '<div class="btn-row mt">' +
              '<button class="btn ghost js-text">📝 כטקסט</button>' +
              '<button class="btn wa js-share" disabled>💬 שיתוף התמונה</button>' +
            '</div>' +
            '<p class="small muted center" style="margin:10px 0 0" id="wa-hint">&nbsp;</p>',
          onMount: function (root, close) {

            /* ----- התמונה ----- */
            IdeaImage.render(idea, function (canvas, err) {
              var box = root.querySelector('#wa-img');
              if (!box) return;
              if (err || !canvas) {
                box.innerHTML = '<p class="small muted center">לא הצלחנו להכין תמונה — אפשר לשלוח כטקסט.</p>';
                return;
              }
              box.innerHTML = '<img alt="הרעיון כתמונה" src="' + canvas.toDataURL('image/png') + '">';

              var share = root.querySelector('.js-share');
              var hint = root.querySelector('#wa-hint');
              var name = (idea.title || 'רעיון').replace(/[\\/:*?"<>|]/g, '') + '.png';

              canvas.toBlob(function (blob) {
                if (!blob) return;
                var file = null;
                try { file = new File([blob], name, { type: 'image/png' }); } catch (e) { file = null; }
                var canShare = !!(file && navigator.share && navigator.canShare &&
                                  navigator.canShare({ files: [file] }));

                share.disabled = false;
                if (canShare) {
                  hint.textContent = 'נפתחת בחירת האפליקציה — בוחרים וואטסאפ ואת הקבוצה';
                  share.addEventListener('click', function () {
                    navigator.share({ files: [file], title: idea.title || 'רעיון' })
                      .catch(function () { /* המשתמשת ביטלה */ });
                  });
                } else {
                  share.textContent = '⬇️ שמירת התמונה';
                  hint.textContent = 'שומרים את התמונה ומצרפים אותה בוואטסאפ';
                  share.addEventListener('click', function () {
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url; a.download = name;
                    document.body.appendChild(a); a.click(); a.remove();
                    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
                    UI.toast('התמונה נשמרה');
                  });
                }
              }, 'image/png');
            });

            /* ----- גיבוי: שליחה כטקסט ----- */
            root.querySelector('.js-text').addEventListener('click', function () {
              m.setBody(
                '<pre class="card flat small" style="white-space:pre-wrap;font-family:inherit;margin-bottom:14px">' +
                  UI.esc(text) + '</pre>' +
                '<div class="btn-row"><button class="btn ghost js-copy">📋 העתקה</button>' +
                '<button class="btn wa js-wa">💬 פתיחת וואטסאפ</button></div>');
              var b = m.el;
              b.querySelector('.js-copy').addEventListener('click', function () { UI.copyText(text); });
              b.querySelector('.js-wa').addEventListener('click', function () { UI.whatsapp(text); close(); });
            });
          }
        });
      }
    }
  };
})();
