/* ============================================================
   תכנון תקציב — הגדרות הגן, סעיפי הוצאה מתוכננים וסיכום
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.budget = (function () {

  function catOptions() {
    return Store.state.categories.map(function (c) {
      return { value: c.id, label: c.icon + '  ' + c.name };
    });
  }

  /* ---------- לשונית: הגדרות ---------- */
  function tabSettings() {
    var st = Store.state;
    var levels = {};
    st.staff.forEach(function (t) { levels[t.level] = (levels[t.level] || 0) + 1; });
    var full = st.children.filter(function (c) { return Calc.sharePercentOf(st, c) >= 100; }).length;
    var partial = st.children.length - full;

    var html = '';

    html += '<div class="card">' +
      '<div class="card-title"><h2>כמות הילדים בגן</h2>' +
      '<button class="btn sm soft" data-action="nav" data-view="children">ניהול הרשימה</button></div>' +
      '<div class="flex-between">' +
        '<div><div class="sum-value">' + st.children.length + '</div>' +
        '<div class="small muted">ילדים רשומים</div></div>' +
        '<div class="flex" style="gap:6px">' +
          '<span class="badge ok">' + full + ' מלא</span>' +
          (partial ? '<span class="badge warn">' + partial + ' יחסי</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="hint mt">אפשר לעדכן את הרשימה בכל שלב — התקציב לכל הורה מתעדכן אוטומטית.</div>' +
      '</div>';

    html += '<div class="card">' +
      '<div class="card-title"><h2>צוות הגן <span class="sub">אופציונלי</span></h2>' +
      '<button class="btn sm soft" data-action="nav" data-view="staff">ניהול הצוות</button></div>' +
      '<div class="flex-between">' +
        '<div><div class="sum-value">' + st.staff.length + '</div>' +
        '<div class="small muted">אנשי צוות</div></div>' +
      '</div>' +
      (st.staff.length ? '<div class="flex wrap mt" style="gap:6px">' +
        Store.STAFF_LEVELS.filter(function (l) { return levels[l.id]; }).map(function (l) {
          return '<span class="badge" style="background:' + UI.toneVar(l.tone) + ';color:' + UI.toneInk(l.tone) + '">' +
            l.icon + ' ' + l.name + ' · ' + levels[l.id] + '</span>';
        }).join('') + '</div>' : '<div class="hint mt">ההיררכיה עוזרת לחלק מתנות לפי תפקידים.</div>') +
      '</div>';

    html += '<div class="card">' +
      '<div class="card-title"><h2>שנת הלימודים</h2></div>' +
      '<div class="grid-2">' +
        '<div class="field mb0"><label>תחילת שנה</label>' +
          '<input class="input" type="date" data-change="bud-set" data-key="yearStart" value="' + UI.esc(st.settings.yearStart) + '"></div>' +
        '<div class="field mb0"><label>סוף שנה</label>' +
          '<input class="input" type="date" data-change="bud-set" data-key="yearEnd" value="' + UI.esc(st.settings.yearEnd) + '"></div>' +
      '</div>' +
      '<div class="hint mt">התאריכים האלה קובעים את חודשי הפעילות של סעיפים חודשיים, ' +
      'ואת ברירת המחדל לתאריך ההצטרפות של ילד חדש.</div>' +
      '</div>';

    return html;
  }

  /* ---------- לשונית: סעיפי תקציב ---------- */

  /* הרשימה מחולקת לפי קהל היעד, עם קו הפרדה וסכום ביניים לכל קבוצה */
  var GROUPS = [
    { id: 'children',  icon: '🧒',    name: 'מתנות לילדים' },
    { id: 'staff_edu', icon: '👩‍🏫',  name: 'מתנות לצוות החינוכי' },
    { id: '',          icon: '💰',    name: 'סעיפים כלליים' }
  ];

  function groupHead(group, sum, count) {
    return '<div class="group-head">' +
      '<span class="g-label">' + group.icon + ' ' + UI.esc(group.name) + '</span>' +
      '<span class="g-line"></span>' +
      '<span class="g-sum">' + count + (count === 1 ? ' סעיף' : ' סעיפים') + ' · ' + UI.money(sum) + '</span>' +
      '</div>';
  }

  function itemRow(st, b) {
    var cat = Store.category(b.categoryId);
    var amount = Calc.itemAmount(st, b);
    var bd = Calc.itemBreakdown(st, b);
    var per = '';
    if (bd.perPerson || bd.monthly) {
      var bits = [UI.money(bd.rate)];
      if (bd.perPerson) bits.push('× ' + Calc.audienceLabel(bd.audience, bd.count));
      if (bd.monthly)   bits.push('× ' + bd.months + ' ח׳');
      if (bd.customWindow) {
        var pr = Calc.validPeriods(b);
        bits.push(pr.length > 1
          ? '(' + pr.length + ' תקופות)'
          : '(' + UI.dateDayMonth(pr.length ? pr[0].start : b.startDate) + '–' +
            UI.dateDayMonth(pr.length ? pr[0].end : b.endDate) + ')');
      }
      per = bits.join(' ');
    }
    return '<div class="row" data-action="budget-edit" data-id="' + b.id + '" style="background:' + UI.toneVar(cat.tone) + '55">' +
      '<div class="r-ico" style="background:#fff">' + UI.catIcon(cat) + '</div>' +
      '<div class="r-body">' +
        '<div class="r-name">' + UI.esc(b.title || cat.name) + '</div>' +
        '<div class="r-sub" style="white-space:normal">' + (per ? per + ' · ' : '') + UI.esc(cat.name) +
          (b.date ? ' · 🗓 ' + UI.dateShort(b.date) : '') + '</div>' +
      '</div>' +
      '<div class="r-end"><div class="r-amount">' + UI.money(amount) + '</div></div>' +
      '</div>';
  }

  /* ניהול הקטגוריות — יושב בלשונית הקטגוריות, גם כשעוד אין סעיפים */
  function categoryManager(st) {
    return '<div class="section-title"><span>ניהול קטגוריות</span>' +
      '<button class="btn sm soft" data-action="cat-add">+ קטגוריה</button></div>' +
      '<div class="card"><div class="flex wrap" style="gap:8px">' +
      st.categories.map(function (c) {
        return '<button class="chip" data-action="cat-edit" data-id="' + c.id + '" ' +
          'style="background:' + UI.toneVar(c.tone) + ';color:' + UI.toneInk(c.tone) + '">' + UI.catIcon(c) + ' ' + UI.esc(c.name) + '</button>';
      }).join('') +
      '</div></div>';
  }

  function tabItems() {
    var st = Store.state;
    var items = st.budgetItems.slice().sort(function (a, b) {
      return (a.date || '9999').localeCompare(b.date || '9999');
    });
    var total = Calc.budgetTotal(st);

    var html = '<button class="btn ghost" data-action="budget-add" style="margin-bottom:14px">+ הוספת סעיף הוצאה</button>';

    if (!items.length) {
      return html + UI.empty({
        art: 'budget', title: 'עוד לא תכננתם תקציב',
        text: 'הוסיפו סעיפי הוצאה מתוך הקטגוריות — מתנות, כיבוד, חוגים ועוד.',
        action: { act: 'budget-add', label: '+ הוספת הסעיף הראשון' }
      }) + categoryManager(st);
    }

    GROUPS.forEach(function (g) {
      var group = items.filter(function (b) { return (b.audience || '') === g.id; });
      if (!group.length) return;
      var sum = group.reduce(function (acc, b) { return acc + Calc.itemAmount(st, b); }, 0);
      html += groupHead(g, sum, group.length);
      html += group.map(function (b) { return itemRow(st, b); }).join('');
    });

    html += '<div class="row" style="background:var(--primary-soft);box-shadow:none;margin-top:18px">' +
      '<div class="r-ico has-art" style="background:#fff">' + UI.art('budget') + '</div>' +
      '<div class="r-body"><div class="r-name">סה״כ כל הקטגוריות</div>' +
      '<div class="r-sub">' + items.length + ' סעיפים</div></div>' +
      '<div class="r-end"><div class="r-amount">' + UI.money(total) + '</div></div></div>';

    html += categoryManager(st);
    return html;
  }

  /* ---------- לשונית: סיכום ---------- */

  /* בפילוח לפי קטגוריה, לחיצה על קטגוריה פותחת את הסעיפים שבה —
     למשל פסח וחנוכה תחת "מתנה לחג". כל סעיף נפתח לעריכה. */
  var AUD_LABEL = { children: 'לילדים', staff_edu: 'לצוות החינוכי' };

  function summaryItemRow(st, b) {
    var amount = Calc.itemAmount(st, b);
    var bd = Calc.itemBreakdown(st, b);
    var bits = [];
    if (AUD_LABEL[b.audience]) bits.push(AUD_LABEL[b.audience]);
    if (bd.perPerson) bits.push(UI.money(bd.rate) + ' × ' + Calc.audienceLabel(bd.audience, bd.count));
    if (bd.monthly) bits.push(bd.months + ' חודשים');
    if (b.date) bits.push(UI.dateShort(b.date));
    return '<button class="bcat-item" data-action="budget-edit" data-id="' + b.id + '">' +
      '<span class="bi-body"><span class="bi-name">' + UI.esc(b.title || Store.category(b.categoryId).name) + '</span>' +
        (bits.length ? '<span class="bi-sub">' + bits.join(' · ') + '</span>' : '') +
      '</span>' +
      '<b class="bi-amount">' + UI.money(amount) + '</b>' +
      '</button>';
  }

  function tabSummary() {
    var st = Store.state;
    var total = Calc.budgetTotal(st);
    var byCat = Calc.budgetByCategory(st);
    var spentByCat = Calc.expensesByCategory(st);
    var spent = Calc.expensesTotal(st);
    var perFull = Calc.fullChildShare(st);
    var units = Calc.totalShareUnits(st);

    var cats = st.categories.filter(function (c) { return byCat[c.id]; })
      .sort(function (a, b) { return byCat[b.id] - byCat[a.id]; });

    var html = '<div class="summary">' +
      '<div class="sum-top">' +
        '<div><div class="sum-label">סה״כ תקציב מתוכנן</div>' +
        '<div class="sum-value">' + UI.money(total) + '</div>' +
        '<div class="small muted">' + st.budgetItems.length + ' סעיפים · ' + cats.length + ' קטגוריות</div></div>' +
        UI.donut(cats.map(function (c) {
          return { value: byCat[c.id], color: UI.toneHex(c.tone) };
        }), UI.money(total).replace(' ₪', ''), '₪ סה״כ') +
      '</div>' +
      '<div class="stat-grid">' +
        '<div class="stat"><div class="s-val">' + UI.money(spent) + '</div><div class="s-lab">הוצא בפועל</div></div>' +
        '<div class="stat"><div class="s-val ' + (total - spent >= 0 ? 'pos' : 'neg') + '">' + UI.money(total - spent) + '</div><div class="s-lab">נותר</div></div>' +
        '<div class="stat"><div class="s-val">' + UI.money(perFull) + '</div><div class="s-lab">לילד מלא</div></div>' +
      '</div></div>';

    html += '<div class="note"><div class="n-ico">' + UI.art('budget') + '</div><div><b>כמה כל הורה משלם?</b>' +
      'כל סעיף מתחלק בין הילדים שכבר היו בגן בתאריך שלו. ילד שהיה בגן מתחילת השנה ' +
      'משלם ' + UI.money(perFull) + ', וילד שהצטרף באמצע משלם רק על מה שבא אחריו.</div></div>';

    html += '<div class="section-title"><span>פילוח לפי קטגוריה</span></div>';

    if (!cats.length) {
      html += UI.empty({ icon: '🥧', title: 'אין עדיין נתונים לפילוח', text: 'הוסיפו סעיפי תקציב כדי לראות את החלוקה.' });
    } else {
      var open = App.vs('budgetOpenCats', {});
      var itemsByCat = {};
      st.budgetItems.forEach(function (b) { (itemsByCat[b.categoryId] = itemsByCat[b.categoryId] || []).push(b); });
      html += cats.map(function (c) {
        var amt = byCat[c.id] || 0;
        var used = spentByCat[c.id] || 0;
        var share = total > 0 ? (amt / total) * 100 : 0;
        var list = (itemsByCat[c.id] || []).slice().sort(function (a, b) {
          return (a.date || '9999').localeCompare(b.date || '9999');
        });
        var isOpen = !!open[c.id];
        return '<div class="card sumcat' + (isOpen ? ' open' : '') + '">' +
          '<button class="sumcat-head" data-action="budget-cat" data-id="' + c.id + '" ' +
            'aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
            '<div class="flex-between">' +
              '<div class="flex"><span class="r-ico" style="background:' + UI.toneVar(c.tone) + '">' + UI.catIcon(c) + '</span>' +
              '<div><div class="r-name">' + UI.esc(c.name) + '</div>' +
              '<div class="r-sub">' + share.toFixed(1) + '% מהתקציב · הוצא ' + UI.money(used) + '</div></div></div>' +
              '<div class="sc-end"><b class="nowrap">' + UI.money(amt) + '</b>' +
                '<span class="sc-chev">' + UI.svgIcon('chevron', 16) + '</span></div>' +
            '</div>' +
            UI.bar(used, amt, used > amt ? 'over' : (used === amt ? 'ok' : 'thin')) +
          '</button>' +
          (isOpen
            ? '<div class="bcat-body">' +
                list.map(function (b) { return summaryItemRow(st, b); }).join('') +
                '<button class="bcat-add" data-action="budget-add" data-category="' + c.id + '">' +
                  '+ הוספת סעיף ל' + UI.esc(c.name) + '</button>' +
              '</div>'
            : '') +
          '</div>';
      }).join('');
    }

    return html;
  }

  function render() {
    var tab = App.vs('budgetTab', 'items');
    var html = UI.pageHead({ title: 'תכנון תקציב', subtitle: 'סעיפי ההוצאה המתוכננים לשנה', art: 'budget', tone: 'pink', back: 'home' });

    html += '<div class="segment">' +
      seg('settings', 'הגדרות', tab) +
      seg('items', 'קטגוריות', tab) +
      seg('summary', 'סיכום', tab) +
      '</div>';

    if (tab === 'settings') html += tabSettings();
    else if (tab === 'summary') html += tabSummary();
    else html += tabItems();

    return html;
  }

  function seg(id, label, cur) {
    return '<button data-action="budget-tab" data-tab="' + id + '" class="' + (cur === id ? 'on' : '') + '">' + label + '</button>';
  }

  /* ---------- טופס סעיף תקציב ---------- */

  var AUDIENCES = [
    { value: '',          label: 'כללי',        icon: '💰' },
    { value: 'children',  label: 'ילדים',       icon: '🧒' },
    { value: 'staff_edu', label: 'צוות חינוכי', icon: '👩‍🏫' }
  ];
  var BASES = [
    { value: 'total',      label: 'לכולם' },
    { value: 'per_person', label: 'לאדם' }
  ];
  var PERIODS = [
    { value: 'year',  label: 'לשנה' },
    { value: 'month', label: 'לחודש' }
  ];

  function amountLabel(basis, period) {
    return 'סכום ' + (basis === 'per_person' ? 'לאדם' : 'לכולם') +
           ' ' + (period === 'month' ? 'לחודש' : 'לשנה') + ' (₪)';
  }

  /* שורת החישוב החיה: מציגה את כל הגורמים ואת התוצאה השנתית,
     ולצידה כמה הסעיף מוסיף לכל הורה */
  function calcLine(draft) {
    var st = Store.state;
    var synth = {
      audience: draft.audience, basis: draft.basis, period: draft.period, rate: draft.rate,
      periods: draft.periods, startDate: draft.startDate, endDate: draft.endDate,
      date: draft.date || ''
    };
    var bd = Calc.itemBreakdown(st, synth);

    if (bd.perPerson && bd.count === 0) {
      return '<div class="note" style="background:#FDF0F2;margin:0"><div class="n-ico">⚠️</div><div>' +
        (draft.audience === 'children'
          ? 'אין ילדים ברשימה — הוסיפו ילדים כדי שהסכום יחושב'
          : 'אין אנשי צוות ברשימה — הוסיפו צוות כדי שהסכום יחושב') +
        '</div></div>';
    }

    var parts = [UI.money(bd.rate) + (bd.perPerson ? ' לאדם' : '')];
    if (bd.perPerson) parts.push('× ' + Calc.audienceLabel(bd.audience, bd.count));
    if (bd.monthly) {
      parts.push('× ' + bd.months + ' חודשים' +
        (bd.customWindow ? ' של פעילות' : '') +
        (bd.periodCount > 1 ? ' (' + bd.periodCount + ' תקופות)' : ''));
    }

    var alloc = Calc.itemAllocation(st, synth);
    // כשיש ילדים שהצטרפו אחרי המועד, הסכום בפועל נמוך מהמכפלה
    var less = Calc.round2(bd.total - alloc.total);

    return '<div class="row" style="box-shadow:none;background:var(--primary-soft);margin:0">' +
      '<div class="r-body">' +
        '<div class="small muted" style="white-space:normal">' + parts.join('  ') + '</div>' +
        '<div class="r-name" style="font-size:18px">= ' + UI.money(alloc.total) + ' לשנה</div>' +
        (less > 0.5
          ? '<div class="small muted">' + UI.money(less) + ' פחות, בגלל ילדים שהצטרפו אחרי</div>'
          : '') +
        (alloc.full > 0 ? '<div class="small muted">≈ ' + UI.money(alloc.full) +
          ' להורה של ילד שהיה כל השנה</div>' : '') +
      '</div></div>';
  }

  /* סימון הצ׳יפ הנבחר כשהערך משתנה מהקוד ולא מלחיצה */
  function syncChips(root, name, value) {
    var box = root.querySelector('[data-chips="' + name + '"]');
    if (!box) return;
    Array.prototype.forEach.call(box.querySelectorAll('.chip'), function (c) {
      c.classList.toggle('on', c.getAttribute('data-chip') === value);
    });
  }

  function itemForm(item, presetCategory) {
    var isNew = !item;
    var startCategory = presetCategory && Store.find('categories', presetCategory)
      ? presetCategory
      : Store.state.categories[0].id;
    item = item || { categoryId: startCategory, title: '', date: '', note: '',
                     audience: '', basis: 'total', period: 'year', rate: '',
                     startDate: '', endDate: '' };

    /* תקופות הפעילות נערכות כרשימה, כדי לתמוך בחוג עם הפסקות באמצע */
    var periods = (item.periods && item.periods.length)
      ? item.periods.map(function (p) { return { id: p.id || Store.uid('per'), start: p.start, end: p.end }; })
      : (item.startDate && item.endDate
          ? [{ id: Store.uid('per'), start: item.startDate, end: item.endDate }]
          : []);

    /* ציור מחדש של שורת החישוב לפי מצב הטופס והתקופות שהוזנו */
    function refreshCalc(root) {
      var el = root.querySelector('#f-calc');
      if (!el) return;
      el.innerHTML = calcLine({
        audience: root.querySelector('#f-audience').value,
        basis: root.querySelector('#f-basis').value,
        period: root.querySelector('#f-period').value,
        rate: root.querySelector('#f-amount').value,
        periods: periods,
        date: (root.querySelector('#f-date') || {}).value || ''
      });
    }

    /* רשימת תקופות הפעילות — ניתנת להוספה, עריכה ומחיקה */
    function drawPeriods(root) {
      var box = root.querySelector('#f-periods');
      if (!box) return;

      box.innerHTML =
        '<label>תקופות פעילות</label>' +
        (periods.length ? periods.map(function (p, i) {
          return '<div class="period">' +
            '<div class="p-head">' +
              '<span>תקופה ' + (i + 1) + '</span>' +
              '<button type="button" class="iconbtn del" data-per-del="' + i + '" ' +
                'aria-label="מחיקת תקופה">✕</button>' +
            '</div>' +
            '<div class="p-dates">' +
              '<label>מתאריך<input class="input" type="date" data-per="start" data-i="' + i + '" ' +
                'value="' + UI.esc(p.start || '') + '"></label>' +
              '<label>עד תאריך<input class="input" type="date" data-per="end" data-i="' + i + '" ' +
                'value="' + UI.esc(p.end || '') + '"></label>' +
            '</div>' +
            '</div>';
        }).join('') : '<p class="small muted" style="margin:0 0 8px">לא הוגדרו תקופות — החישוב יתבצע לפי כל שנת הלימודים.</p>') +
        '<button type="button" class="btn soft sm" data-per-add="1" style="width:100%">+ הוספת תקופה</button>' +
        '<div class="hint">אפשר להוסיף כמה תקופות, למשל חוג שנעצר בחופשה וחוזר אחריה. ' +
        'החישוב מסכם את חודשי הפעילות בלבד.</div>';

      Array.prototype.forEach.call(box.querySelectorAll('[data-per]'), function (inp) {
        inp.addEventListener('change', function () {
          var i = parseInt(inp.getAttribute('data-i'), 10);
          if (periods[i]) periods[i][inp.getAttribute('data-per')] = inp.value;
          refreshCalc(root);
        });
      });
      Array.prototype.forEach.call(box.querySelectorAll('[data-per-del]'), function (btn) {
        btn.addEventListener('click', function () {
          periods.splice(parseInt(btn.getAttribute('data-per-del'), 10), 1);
          drawPeriods(root);
          refreshCalc(root);
        });
      });
      var add = box.querySelector('[data-per-add]');
      if (add) add.addEventListener('click', function () {
        periods.push({ id: Store.uid('per'), start: '', end: '' });
        drawPeriods(root);
        refreshCalc(root);
      });
    }

    var bd = Calc.itemBreakdown(Store.state, item);
    var startAudience = item.audience || '';
    var startBasis  = item.basis  || (bd.perPerson ? 'per_person' : 'total');
    var startPeriod = item.period || 'year';
    var startRate   = item.rate !== undefined && item.rate !== '' ? item.rate : bd.rate;

    UI.formModal({
      title: isNew ? 'סעיף תקציב חדש' : 'עריכת סעיף',
      subtitle: 'קטגוריה, קהל יעד, אופן חישוב הסכום ותאריך יעד',
      submitLabel: 'שמירה',
      fields: [
        { name: 'categoryId', label: 'קטגוריה', type: 'select', value: item.categoryId,
          options: catOptions(), required: true },
        { name: 'title', label: 'שם הסעיף', value: item.title, placeholder: 'למשל: מתנה לחג' },
        { name: 'audience', label: 'קהל יעד', type: 'chips', value: startAudience, options: AUDIENCES },
        { name: 'basis', label: 'הסכום הוא', type: 'chips', value: startBasis, options: BASES,
          hint: '"לאדם" מוכפל במספר הילדים או אנשי הצוות · "לכולם" הוא סכום אחד לכל הקבוצה' },
        { name: 'period', label: 'תדירות', type: 'chips', value: startPeriod, options: PERIODS,
          hint: '"לחודש" מוכפל במספר חודשי שנת הלימודים' },
        { name: 'periods', type: 'html', html: '' },
        { name: 'amount', label: amountLabel(startBasis, startPeriod), type: 'number',
          value: startRate, placeholder: '0', step: '1', min: 0 },
        { name: 'calc', type: 'html',
          html: calcLine({ audience: startAudience, basis: startBasis, period: startPeriod, rate: startRate,
                           periods: periods, date: item.date }) },
        { name: 'date', label: 'תאריך יעד', type: 'date', value: item.date,
          hint: 'לפי התאריך הזה נקבע מי משתתף בסעיף: ילד שהצטרף אחריו אינו משלם עליו' },
        { name: 'note', label: 'הערות', type: 'textarea', value: item.note, placeholder: 'אופציונלי' }
      ],

      onMount: function (root) {
        drawPeriods(root);
      },

      onFieldChange: function (name, value, root) {
        var audience = root.querySelector('#f-audience').value;
        var basisEl  = root.querySelector('#f-basis');
        var basis    = basisEl.value;

        // "לאדם" חסר משמעות בלי קהל יעד — מתקנים במקום להציג חישוב שגוי
        if (!audience && basis === 'per_person') {
          basis = 'total';
          basisEl.value = 'total';
          syncChips(root, 'basis', 'total');
        }

        var period = root.querySelector('#f-period').value;
        var rate = root.querySelector('#f-amount').value;

        // תקופות הפעילות רלוונטיות רק לסעיף חודשי
        var monthly = period === 'month';
        var box = root.querySelector('#f-periods');
        if (box) box.style.display = monthly ? '' : 'none';

        root.querySelector('label[for="f-amount"]').textContent = amountLabel(basis, period);
        refreshCalc(root);
      },

      onSubmit: function (v) {
        var audience = v.audience || '';
        var basis = (!audience && v.basis === 'per_person') ? 'total' : (v.basis || 'total');
        var period = v.period || 'year';
        var rate = Calc.num(v.amount);
        var monthly = period === 'month';
        var clean = monthly ? periods.filter(function (p) {
          return p.start && p.end && p.end > p.start;
        }) : [];
        var draft = { audience: audience, basis: basis, period: period, rate: rate, periods: clean };
        var data = {
          categoryId: v.categoryId, title: v.title, date: v.date, note: v.note,
          audience: audience, basis: basis, period: period, rate: rate,
          periods: clean, startDate: '', endDate: '',
          // הסכום השנתי נשמר גם הוא, ומחושב מחדש בתצוגה לפי הנתונים העדכניים
          amount: Calc.itemAmount(Store.state, draft)
        };
        if (isNew) Store.add('budgetItems', data);
        else Store.update('budgetItems', item.id, data);
        App.render();
        UI.toast(isNew ? 'הסעיף נוסף ✓' : 'הסעיף עודכן ✓');
      },
      onDelete: isNew ? null : function () {
        Store.remove('budgetItems', item.id);
        App.render();
        UI.toast('הסעיף נמחק');
      }
    });
  }

  /* ---------- טופס קטגוריה ---------- */
  function catForm(cat) {
    var isNew = !cat;
    cat = cat || { name: '', icon: '🎁', tone: 'purple' };
    UI.formModal({
      title: isNew ? 'קטגוריה חדשה' : 'עריכת קטגוריה',
      fields: [
        { name: 'name', label: 'שם הקטגוריה', value: cat.name, required: true, placeholder: 'למשל: ציוד יצירה' },
        { name: 'icon', label: 'אימוג׳י', value: cat.icon, placeholder: '🎁', half: true },
        { name: 'tone', label: 'צבע', type: 'select', value: cat.tone, half: true, options: [
          { value: 'pink', label: 'ורוד' }, { value: 'yellow', label: 'צהוב' },
          { value: 'green', label: 'ירוק' }, { value: 'purple', label: 'סגול' },
          { value: 'blue', label: 'כחול' }, { value: 'peach', label: 'אפרסק' },
          { value: 'mint', label: 'מנטה' }
        ] }
      ],
      onSubmit: function (v) {
        if (isNew) Store.add('categories', v);
        else Store.update('categories', cat.id, v);
        App.render();
        UI.toast('נשמר ✓');
      },
      onDelete: isNew ? null : function () {
        var used = Store.state.budgetItems.concat(Store.state.expenses)
          .filter(function (x) { return x.categoryId === cat.id; }).length;
        if (used) { UI.toast('לא ניתן למחוק — יש ' + used + ' רשומות בקטגוריה'); return; }
        Store.remove('categories', cat.id);
        App.render();
      }
    });
  }

  return {
    render: render,
    itemForm: itemForm,
    catOptions: catOptions,
    actions: {
      'budget-tab': function (el) { App.setVs('budgetTab', el.getAttribute('data-tab')); App.render(); },
      'budget-add': function (el) {
        itemForm(null, el && el.getAttribute ? el.getAttribute('data-category') : null);
      },
      'budget-cat': function (el) {
        var id = el.getAttribute('data-id');
        var open = App.vs('budgetOpenCats', {});
        open[id] = !open[id];
        App.render();
      },
      'budget-edit': function (el) { itemForm(Store.find('budgetItems', el.getAttribute('data-id'))); },
      'cat-add': function () { catForm(null); },
      'cat-edit': function (el) { catForm(Store.find('categories', el.getAttribute('data-id'))); },
      'bud-set': function (el) {
        Store.state.settings[el.getAttribute('data-key')] = el.value;
        Store.save();
        App.render();
      }
    }
  };
})();
