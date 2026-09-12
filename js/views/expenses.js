/* ============================================================
   הוצאות — הוצאות בפועל מול התקציב המתוכנן, ויתרה
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.expenses = (function () {

  /* ---------- קיבוץ לפי קהל יעד ---------- */
  /* ההוצאות נחלקות לפי מי שנהנה מהן — ילדים או צוות. הוצאה שלא סומן
     לה קהל יעד נספרת ככללית, בלי לנחש אותו מהקטגוריה. */
  var AUD_GROUPS = [
    { id: 'children',  svg: 'children', tone: 'pink',
      name: 'הוצאות לילדים',        label: 'ילדים',       chip: 'ילדים', short: 'לילדים' },
    { id: 'staff_edu', svg: 'staff',    tone: 'purple',
      name: 'הוצאות לצוות החינוכי', label: 'צוות חינוכי', chip: 'צוות',  short: 'לצוות החינוכי' },
    { id: '',          svg: 'general',  tone: 'yellow',
      name: 'הוצאות כלליות',        label: 'כללי',        chip: 'כללי',  short: 'כללית' }
  ];

  function audGroup(id) {
    return AUD_GROUPS.filter(function (g) { return g.id === (id || ''); })[0] || AUD_GROUPS[2];
  }

  function tint(g) {
    return '--tint:' + UI.toneVar(g.tone) + ';--tint-ink:' + UI.toneInk(g.tone);
  }

  function countLabel(n) {
    return n === 1 ? 'הוצאה אחת' : n + ' הוצאות';
  }

  /* ---------- לשונית: בפועל ---------- */

  function summaryCard(ov) {
    var cls = ov.spent > ov.budget ? 'over' : (ov.usePct > 85 ? 'warn' : 'ok');
    return '<div class="card">' +
      '<div class="exp-sum">' +
        '<div class="es-ico">' + UI.svgIcon('wallet', 38) + '</div>' +
        '<div class="es-body">' +
          '<div class="es-lab">סה״כ הוצאות</div>' +
          '<div class="es-nums"><b>' + UI.money(ov.spent) + '</b> מתוך ' + UI.money(ov.budget) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="exp-prog">' + UI.bar(ov.spent, ov.budget, cls) +
        '<span class="ep-pct">' + ov.usePct + '%</span></div>' +
      '</div>';
  }

  /* כרטיס לכל קבוצה — הסכום והנתח מתוך סך ההוצאות */
  function audCards(groups, totalSpent) {
    return '<div class="aud-grid">' + groups.map(function (x) {
      var pct = totalSpent > 0 ? Math.round((x.sum / totalSpent) * 100) : 0;
      return '<button class="aud-card" style="' + tint(x.g) + '" ' +
        'data-action="exp-aud" data-id="' + x.g.id + '">' +
        '<span class="ac-ico">' + UI.svgIcon(x.g.svg, 30) + '</span>' +
        '<span class="ac-name">' + UI.esc(x.g.label) + '</span>' +
        '<span class="ac-val">' + UI.money(x.sum) + '</span>' +
        '<span class="ac-pct">' + pct + '%</span>' +
        '</button>';
    }).join('') + '</div>';
  }

  function filterRow(groups, pick) {
    var all = { id: 'all', chip: 'הכול', svg: '' };
    return '<div class="gfilter">' + [all].concat(groups.map(function (x) { return x.g; }))
      .map(function (b, i) {
        return (i ? '<span class="gf-sep"></span>' : '') +
          '<button data-action="exp-group" data-id="' + b.id + '" ' +
          'class="' + (pick === b.id ? 'on' : '') + '">' +
          (b.svg ? UI.svgIcon(b.svg, 20) : '') + UI.esc(b.chip) + '</button>';
      }).join('') + '</div>';
  }

  function groupBlock(x) {
    return '<div class="gblock" style="' + tint(x.g) + '">' +
      '<button class="gblock-head" data-action="exp-aud" data-id="' + x.g.id + '">' +
        '<span class="gb-ico">' + UI.svgIcon(x.g.svg, 26) + '</span>' +
        '<span class="gb-name">' + UI.esc(x.g.name) + '</span>' +
        '<span class="gb-sum">' + countLabel(x.list.length) + ' · ' + UI.money(x.sum) + '</span>' +
        '<span class="gb-chev">' + UI.svgIcon('chevron', 18) + '</span>' +
      '</button>' +
      x.list.map(expRow).join('') +
      '</div>';
  }

  /* שורת הוצאה — הקטגוריה נשארת כטקסט משנה, והחץ פותח עריכה */
  function expRow(e) {
    var cat = Store.category(e.categoryId);
    var per = (e.basis === 'per_person' && e.audience && e.count > 1)
      ? UI.money(e.rate) + ' × ' + Calc.audienceLabel(e.audience, e.count) + ' · '
      : '';
    return '<div class="row exp-row" data-action="exp-edit" data-id="' + e.id + '" style="cursor:pointer">' +
      '<div class="r-ico" style="background:' + UI.toneVar(cat.tone) + '">' + cat.icon + '</div>' +
      '<div class="r-body">' +
        '<div class="r-name">' + UI.esc(e.title || cat.name) + '</div>' +
        '<div class="r-sub">' + per + UI.esc(cat.name) +
        (e.date ? ' · ' + UI.dateShort(e.date) : '') +
        (e.ideaId ? ' · 💡 מרעיון' : '') + '</div>' +
      '</div>' +
      '<div class="r-end"><div class="r-amount">' + UI.money(e.amount) + '</div></div>' +
      '<span class="r-chev">' + UI.svgIcon('chevron', 16) + '</span>' +
      '</div>';
  }

  function addButton() {
    return '<button class="exp-add" data-action="exp-add">' +
      '<span class="ea-btn">' + UI.svgIcon('plus', 24) + '</span>' +
      '<span class="ea-lab">הוספת הוצאה</span>' +
      '</button>';
  }

  function tabActual() {
    var st = Store.state;
    var ov = Calc.overview(st);
    var html = summaryCard(ov);

    if (ov.spent > ov.budget) {
      html += '<div class="note" style="background:#FDF0F2"><div class="n-ico">⚠️</div><div>' +
        '<b>חריגה מהתקציב</b>ההוצאות בפועל גבוהות ב-' + UI.money(ov.spent - ov.budget) + ' מהתכנון. ' +
        'אפשר לעדכן את סעיפי התקציב או לצמצם הוצאות.</div></div>';
    }

    var exps = st.expenses.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    if (!exps.length) {
      return html + UI.empty({ icon: '🧾', title: 'עוד לא נרשמו הוצאות', text: 'כל הוצאה שנרשמת יורדת מהתקציב באופן מיידי.', action: { act: 'exp-add', label: '+ רישום ההוצאה הראשונה' } });
    }

    var groups = AUD_GROUPS.map(function (g) {
      var list = exps.filter(function (e) { return (e.audience || '') === g.id; });
      return { g: g, list: list,
               sum: list.reduce(function (acc, e) { return acc + Calc.num(e.amount); }, 0) };
    }).filter(function (x) { return x.list.length; });

    html += audCards(groups, ov.spent);
    html += '<div class="section-title"><span>הוצאות לפי קבוצה</span></div>';

    /* הסינון חוזר ל"הכול" אם הקבוצה שנבחרה התרוקנה בינתיים */
    var pick = App.vs('expGroup', 'all');
    var exists = groups.filter(function (x) { return x.g.id === pick; }).length;
    if (pick !== 'all' && !exists) { pick = 'all'; App.setVs('expGroup', pick); }

    if (groups.length > 1) html += filterRow(groups, pick);
    html += groups.filter(function (x) { return pick === 'all' || x.g.id === pick; })
      .map(groupBlock).join('');
    html += addButton();

    return html;
  }

  /* ---------- לשונית: מתוכנן מול בפועל ---------- */
  function tabCompare() {
    var st = Store.state;
    var byCat = Calc.budgetByCategory(st);
    var spentByCat = Calc.expensesByCategory(st);
    var cats = st.categories.filter(function (c) { return byCat[c.id] || spentByCat[c.id]; });

    if (!cats.length) {
      return UI.empty({ icon: '📊', title: 'אין נתונים להשוואה', text: 'הוסיפו סעיפי תקציב והוצאות.' });
    }

    var html = '<div class="card"><div class="scroll-x"><table class="tbl">' +
      '<thead><tr><th>קטגוריה</th><th class="end">מתוכנן</th><th class="end">בפועל</th><th class="end">יתרה</th></tr></thead><tbody>';
    cats.forEach(function (c) {
      var p = byCat[c.id] || 0, s = spentByCat[c.id] || 0, d = p - s;
      html += '<tr data-action="exp-cat" data-id="' + c.id + '" style="cursor:pointer">' +
        '<td>' + c.icon + ' ' + UI.esc(c.name) + '</td>' +
        '<td class="end">' + UI.money(p) + '</td>' +
        '<td class="end">' + UI.money(s) + '</td>' +
        '<td class="end ' + (d >= 0 ? 'pos' : 'neg') + '">' + UI.money(d) + '</td></tr>';
    });
    var tp = Calc.budgetTotal(st), ts = Calc.expensesTotal(st);
    html += '<tr style="background:var(--primary-soft)"><td><b>סה״כ</b></td>' +
      '<td class="end"><b>' + UI.money(tp) + '</b></td>' +
      '<td class="end"><b>' + UI.money(ts) + '</b></td>' +
      '<td class="end ' + (tp - ts >= 0 ? 'pos' : 'neg') + '"><b>' + UI.money(tp - ts) + '</b></td></tr>';
    html += '</tbody></table></div></div>';

    html += '<button class="btn ghost" data-action="nav" data-view="yearend">🎈 חישוב החזרים לסוף שנה</button>';
    return html;
  }

  /* ---------- טופס הוצאה ---------- */

  var EXP_AUDIENCES = [
    { value: '',          label: 'כללי',        icon: '💰' },
    { value: 'children',  label: 'ילדים',       icon: '🧒' },
    { value: 'staff_edu', label: 'צוות חינוכי', icon: '👩‍🏫' }
  ];
  var EXP_BASES = [
    { value: 'total',      label: 'לכולם' },
    { value: 'per_person', label: 'לאדם' }
  ];

  function expAmountLabel(basis) {
    return 'סכום ' + (basis === 'per_person' ? 'לאדם' : 'כולל') + ' (₪)';
  }

  function expCount(audience, basis) {
    return (basis === 'per_person' && audience) ? Calc.audienceCount(Store.state, audience) : 1;
  }

  function expCalcLine(audience, basis, rate) {
    var count = expCount(audience, basis);
    var per = Calc.num(rate);

    if (basis === 'per_person' && audience && count === 0) {
      return '<div class="note" style="background:#FDF0F2;margin:0"><div class="n-ico">⚠️</div><div>' +
        (audience === 'children' ? 'אין ילדים ברשימה' : 'אין אנשי צוות ברשימה') +
        ' — לא ניתן לחשב סכום לאדם.</div></div>';
    }
    if (count <= 1) return '';

    return '<div class="row" style="box-shadow:none;background:var(--primary-soft);margin:0">' +
      '<div class="r-body">' +
        '<div class="small muted">' + UI.money(per) + ' לאדם  ×  ' +
          Calc.audienceLabel(audience, count) + '</div>' +
        '<div class="r-name" style="font-size:18px">= ' + UI.money(per * count) + '</div>' +
      '</div></div>';
  }

  function expForm(exp, presetCategory, presetAudience) {
    var isNew = !exp;
    // הוצאה שנפתחת מתוך קטגוריה או מתוך קבוצת קהל מגיעה מסומנת מראש
    var startCategory = presetCategory && Store.find('categories', presetCategory)
      ? presetCategory
      : Store.state.categories[0].id;
    var presetAud = EXP_AUDIENCES.filter(function (a) { return a.value === presetAudience; }).length
      ? presetAudience : '';
    exp = exp || { categoryId: startCategory, title: '', amount: '',
                   audience: presetAud, basis: 'total', rate: '', count: 1,
                   date: UI.todayISO(), note: '' };

    var startAudience = exp.audience || '';
    var startBasis = exp.basis || 'total';
    var startRate = (exp.rate !== undefined && exp.rate !== '') ? exp.rate : exp.amount;

    UI.formModal({
      title: isNew ? 'הוצאה חדשה' : 'עריכת הוצאה',
      subtitle: 'ההוצאה תרד מהתקציב של הקטגוריה',
      fields: [
        { name: 'categoryId', label: 'קטגוריה', type: 'select', value: exp.categoryId,
          required: true, options: Views.budget.catOptions() },
        { name: 'title', label: 'תיאור ההוצאה', value: exp.title,
          placeholder: 'למשל: מתנה ליומולדת של נועה' },
        { name: 'audience', label: 'עבור', type: 'chips', value: startAudience, options: EXP_AUDIENCES },
        { name: 'basis', label: 'הסכום הוא', type: 'chips', value: startBasis, options: EXP_BASES,
          hint: '"לאדם" מוכפל במספר הילדים או אנשי הצוות · "לכולם" הוא הסכום ששולם בסך הכל' },
        { name: 'amount', label: expAmountLabel(startBasis), type: 'number', value: startRate,
          required: true, placeholder: '0', min: 0 },
        { name: 'calc', type: 'html', html: expCalcLine(startAudience, startBasis, startRate) },
        { name: 'date', label: 'תאריך', type: 'date', value: exp.date || UI.todayISO() },
        { name: 'note', label: 'הערות (אופציונלי)', type: 'textarea', value: exp.note,
          placeholder: 'הוסיפו הערות…' }
      ],

      onFieldChange: function (name, value, root) {
        var audience = root.querySelector('#f-audience').value;
        var basisEl = root.querySelector('#f-basis');
        var basis = basisEl.value;

        // "לאדם" חסר משמעות בלי קהל יעד
        if (!audience && basis === 'per_person') {
          basis = 'total';
          basisEl.value = 'total';
          var box = root.querySelector('[data-chips="basis"]');
          if (box) Array.prototype.forEach.call(box.querySelectorAll('.chip'), function (c) {
            c.classList.toggle('on', c.getAttribute('data-chip') === 'total');
          });
        }

        var rate = root.querySelector('#f-amount').value;
        root.querySelector('label[for="f-amount"]').textContent = expAmountLabel(basis);
        root.querySelector('#f-calc').innerHTML = expCalcLine(audience, basis, rate);
      },

      onSubmit: function (v) {
        var audience = v.audience || '';
        var basis = (!audience && v.basis === 'per_person') ? 'total' : (v.basis || 'total');
        var rate = Calc.num(v.amount);
        var count = expCount(audience, basis);
        var data = {
          categoryId: v.categoryId, title: v.title, date: v.date, note: v.note,
          audience: audience, basis: basis, rate: rate, count: count,
          // הוצאה בפועל היא עובדה היסטורית — הסכום נקבע ברגע הרישום
          // ואינו משתנה אם מספר הילדים ישתנה בהמשך
          amount: rate * count
        };
        if (isNew) Store.add('expenses', data);
        else Store.update('expenses', exp.id, data);
        App.render();
        refreshDrill();
        UI.toast(isNew ? 'ההוצאה נרשמה ✓' : 'ההוצאה עודכנה ✓');
      },
      onDelete: isNew ? null : function () {
        Store.remove('expenses', exp.id);
        App.render();
        refreshDrill();
        UI.toast('ההוצאה נמחקה');
      }
    });
  }

  /* ---------- חלון פירוט הוצאות ---------- */
  /* אותו חלון משרת פירוט לפי קהל יעד (מלשונית "בפועל") ופירוט לפי
     קטגוריה (מטבלת "מתוכנן"), ומתרענן אחרי עריכה או מחיקה. */

  var openDrill = null;

  function drillStats(planned, spent) {
    return '<div class="stat-grid" style="margin-bottom:14px">' +
        '<div class="stat"><div class="s-val">' + UI.money(planned) + '</div><div class="s-lab">מתוכנן</div></div>' +
        '<div class="stat"><div class="s-val">' + UI.money(spent) + '</div><div class="s-lab">בפועל</div></div>' +
        '<div class="stat"><div class="s-val ' + (planned - spent >= 0 ? 'pos' : 'neg') + '">' +
          UI.money(planned - spent) + '</div><div class="s-lab">יתרה</div></div>' +
      '</div>';
  }

  function drillRow(e, sub) {
    return '<div class="row" data-action="exp-edit" data-id="' + e.id + '" ' +
      'style="box-shadow:none;background:#FAF8FD;cursor:pointer">' +
      '<div class="r-body"><div class="r-name">' + UI.esc(e.title || Store.category(e.categoryId).name) + '</div>' +
      '<div class="r-sub">' + sub + '</div></div>' +
      '<div class="r-end"><b>' + UI.money(e.amount) + '</b></div>' +
      '<button class="iconbtn plain" data-action="exp-edit" data-id="' + e.id + '" ' +
        'aria-label="עריכת הוצאה">✏️</button></div>';
  }

  function audienceBody(audId) {
    var st = Store.state;
    var g = audGroup(audId);
    var list = st.expenses.filter(function (e) { return (e.audience || '') === g.id; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    var planned = Calc.budgetByAudience(st)[g.id] || 0;
    var spent = list.reduce(function (s, e) { return s + Calc.num(e.amount); }, 0);

    return drillStats(planned, spent) +
      (list.length ? list.map(function (e) {
        var cat = Store.category(e.categoryId);
        return drillRow(e, cat.icon + ' ' + UI.esc(cat.name) + (e.date ? ' · ' + UI.dateShort(e.date) : ''));
      }).join('') : '<p class="muted small">אין עדיין הוצאות בקבוצה הזו.</p>') +
      '<button class="btn soft mt" data-action="exp-add" data-audience="' + g.id + '">' +
        '+ הוספת הוצאה ' + g.short + '</button>';
  }

  function categoryBody(catId) {
    var st = Store.state;
    var cat = Store.category(catId);
    var list = st.expenses.filter(function (e) { return e.categoryId === cat.id; });
    var planned = Calc.budgetByCategory(st)[cat.id] || 0;
    var spent = list.reduce(function (s, e) { return s + Calc.num(e.amount); }, 0);

    return drillStats(planned, spent) +
      (list.length ? list.map(function (e) {
        return drillRow(e, UI.dateShort(e.date));
      }).join('') : '<p class="muted small">אין עדיין הוצאות בקטגוריה הזו.</p>') +
      '<button class="btn soft mt" data-action="exp-add" data-category="' + cat.id + '">' +
        '+ הוספת הוצאה ל' + UI.esc(cat.name) + '</button>';
  }

  function openDrillDown(title, bodyFn) {
    var m = UI.modal({ title: title, body: bodyFn() });
    openDrill = { body: bodyFn, api: m };
  }

  /* החלון הפתוח מתרענן אחרי עריכה או מחיקה, במקום להציג נתונים ישנים */
  function refreshDrill() {
    if (!openDrill) return;
    if (!openDrill.api.isOpen()) { openDrill = null; return; }
    openDrill.api.setBody(openDrill.body());
  }

  function render() {
    var tab = App.vs('expTab', 'actual');
    var html = UI.pageHead({ title: 'הוצאות', subtitle: 'הוצאות בפועל מול התקציב', icon: '🧾', tone: 'yellow', back: 'home' });
    html += '<div class="segment">' +
      '<button data-action="exp-tab" data-tab="compare" class="' + (tab === 'compare' ? 'on' : '') + '">מתוכנן</button>' +
      '<button data-action="exp-tab" data-tab="actual" class="' + (tab === 'actual' ? 'on' : '') + '">בפועל</button>' +
      '</div>';
    html += tab === 'compare' ? tabCompare() : tabActual();
    return html;
  }

  return {
    render: render,
    expForm: expForm,
    actions: {
      'exp-tab': function (el) { App.setVs('expTab', el.getAttribute('data-tab')); App.render(); },
      'exp-group': function (el) { App.setVs('expGroup', el.getAttribute('data-id')); App.render(); },
      'exp-add': function (el) {
        var get = function (name) { return el && el.getAttribute ? el.getAttribute(name) : null; };
        expForm(null, get('data-category'), get('data-audience'));
      },
      'exp-edit': function (el) { expForm(Store.find('expenses', el.getAttribute('data-id'))); },
      'exp-aud': function (el) {
        var g = audGroup(el.getAttribute('data-id'));
        openDrillDown(g.name, function () { return audienceBody(g.id); });
      },
      'exp-cat': function (el) {
        var cat = Store.category(el.getAttribute('data-id'));
        openDrillDown(cat.icon + ' ' + cat.name, function () { return categoryBody(cat.id); });
      }
    }
  };
})();
