/* ============================================================
   הוצאות — הוצאות בפועל מול התקציב המתוכנן, ויתרה
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.expenses = (function () {

  /* ---------- לשונית: בפועל ---------- */
  function tabActual() {
    var st = Store.state;
    var ov = Calc.overview(st);
    var byCat = Calc.budgetByCategory(st);
    var spentByCat = Calc.expensesByCategory(st);

    var html = '<div class="summary">' +
      '<div class="flex" style="gap:8px;margin-bottom:10px">' +
        '<div class="stat" style="flex:1;background:var(--pink)"><div class="s-val">' + UI.money(ov.spent) + '</div>' +
        '<div class="s-lab">הוצאות בפועל</div></div>' +
        '<div class="stat" style="flex:1;background:var(--green)"><div class="s-val">' + UI.money(ov.budget) + '</div>' +
        '<div class="s-lab">תקציב כולל</div></div>' +
      '</div>' +
      UI.bar(ov.spent, ov.budget, ov.spent > ov.budget ? 'over' : (ov.usePct > 85 ? 'warn' : 'ok')) +
      '<div class="flex-between small mt">' +
        '<span class="muted">' + ov.usePct + '% מהתקציב נוצל</span>' +
        '<b class="' + (ov.budgetLeft >= 0 ? 'pos' : 'neg') + '">' +
          (ov.budgetLeft >= 0 ? 'נותר ' : 'חריגה ') + UI.money(Math.abs(ov.budgetLeft)) + '</b>' +
      '</div>' +
      '<div class="stat-grid">' +
        '<div class="stat"><div class="s-val">' + UI.money(ov.collected) + '</div><div class="s-lab">נגבה</div></div>' +
        '<div class="stat"><div class="s-val ' + (ov.cashLeft >= 0 ? 'pos' : 'neg') + '">' + UI.money(ov.cashLeft) + '</div><div class="s-lab">בקופה</div></div>' +
        '<div class="stat"><div class="s-val">' + st.expenses.length + '</div><div class="s-lab">רשומות</div></div>' +
      '</div></div>';

    if (ov.spent > ov.budget) {
      html += '<div class="note" style="background:#FDF0F2"><div class="n-ico">⚠️</div><div>' +
        '<b>חריגה מהתקציב</b>ההוצאות בפועל גבוהות ב-' + UI.money(ov.spent - ov.budget) + ' מהתכנון. ' +
        'אפשר לעדכן את סעיפי התקציב או לצמצם הוצאות.</div></div>';
    }

    html += '<button class="btn ghost" data-action="exp-add" style="margin-bottom:14px">+ הוספת הוצאה</button>';

    var exps = st.expenses.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    if (!exps.length) {
      return html + UI.empty({ icon: '🧾', title: 'עוד לא נרשמו הוצאות', text: 'כל הוצאה שנרשמת יורדת מהתקציב באופן מיידי.', action: { act: 'exp-add', label: '+ רישום ההוצאה הראשונה' } });
    }

    html += '<div class="section-title"><span>לפי קטגוריה</span></div>';
    var cats = st.categories.filter(function (c) { return spentByCat[c.id] || byCat[c.id]; });
    html += cats.map(function (c) {
      var planned = byCat[c.id] || 0;
      var spent = spentByCat[c.id] || 0;
      var over = spent > planned;
      return '<div class="card" style="padding:13px 14px" data-action="exp-cat" data-id="' + c.id + '">' +
        '<div class="flex-between">' +
          '<div class="flex"><span class="r-ico" style="background:' + UI.toneVar(c.tone) + '">' + c.icon + '</span>' +
          '<div><div class="r-name">' + UI.esc(c.name) + '</div>' +
          '<div class="r-sub">' + UI.money(spent) + ' מתוך ' + UI.money(planned) + '</div></div></div>' +
          '<b class="nowrap ' + (over ? 'neg' : '') + '">' + (planned > 0 ? Math.round((spent / planned) * 100) + '%' : '—') + '</b>' +
        '</div>' + UI.bar(spent, planned, over ? 'over' : 'ok') +
        '</div>';
    }).join('');

    html += '<div class="section-title"><span>כל ההוצאות</span><span class="sub">' + exps.length + ' רשומות</span></div>';
    html += exps.map(function (e) {
      var cat = Store.category(e.categoryId);
      return '<div class="row" data-action="exp-edit" data-id="' + e.id + '">' +
        '<div class="r-ico" style="background:' + UI.toneVar(cat.tone) + '">' + cat.icon + '</div>' +
        '<div class="r-body"><div class="r-name">' + UI.esc(e.title || cat.name) + '</div>' +
        '<div class="r-sub">' + UI.esc(cat.name) + (e.date ? ' · ' + UI.dateShort(e.date) : '') +
        (e.ideaId ? ' · 💡 מרעיון' : '') + '</div></div>' +
        '<div class="r-end"><div class="r-amount">' + UI.money(e.amount) + '</div></div></div>';
    }).join('');

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
      html += '<tr><td>' + c.icon + ' ' + UI.esc(c.name) + '</td>' +
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
  function expForm(exp) {
    var isNew = !exp;
    exp = exp || { categoryId: Store.state.categories[0].id, title: '', amount: '', date: UI.todayISO(), note: '' };
    UI.formModal({
      title: isNew ? 'הוצאה חדשה' : 'עריכת הוצאה',
      subtitle: 'ההוצאה תרד מהתקציב של הקטגוריה',
      fields: [
        { name: 'categoryId', label: 'קטגוריה', type: 'select', value: exp.categoryId, required: true, options: Views.budget.catOptions() },
        { name: 'title', label: 'תיאור ההוצאה', value: exp.title, placeholder: 'למשל: מתנה ליומולדת של נועה' },
        { name: 'amount', label: 'סכום (₪)', type: 'number', value: exp.amount, required: true, placeholder: '0.00', min: 0 },
        { name: 'date', label: 'תאריך', type: 'date', value: exp.date || UI.todayISO() },
        { name: 'note', label: 'הערות (אופציונלי)', type: 'textarea', value: exp.note, placeholder: 'הוסיפו הערות…' }
      ],
      onSubmit: function (v) {
        if (isNew) Store.add('expenses', v);
        else Store.update('expenses', exp.id, v);
        App.render();
        UI.toast(isNew ? 'ההוצאה נרשמה ✓' : 'ההוצאה עודכנה ✓');
      },
      onDelete: isNew ? null : function () {
        Store.remove('expenses', exp.id);
        App.render();
        UI.toast('ההוצאה נמחקה');
      }
    });
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
      'exp-add': function () { expForm(null); },
      'exp-edit': function (el) { expForm(Store.find('expenses', el.getAttribute('data-id'))); },
      'exp-cat': function (el) {
        var cat = Store.category(el.getAttribute('data-id'));
        var list = Store.state.expenses.filter(function (e) { return e.categoryId === cat.id; });
        var planned = Calc.budgetByCategory(Store.state)[cat.id] || 0;
        var spent = list.reduce(function (s, e) { return s + Calc.num(e.amount); }, 0);
        var body = '<div class="stat-grid" style="margin-bottom:14px">' +
          '<div class="stat"><div class="s-val">' + UI.money(planned) + '</div><div class="s-lab">מתוכנן</div></div>' +
          '<div class="stat"><div class="s-val">' + UI.money(spent) + '</div><div class="s-lab">בפועל</div></div>' +
          '<div class="stat"><div class="s-val ' + (planned - spent >= 0 ? 'pos' : 'neg') + '">' + UI.money(planned - spent) + '</div><div class="s-lab">יתרה</div></div>' +
          '</div>' +
          (list.length ? list.map(function (e) {
            return '<div class="row" style="box-shadow:none;background:#FAF8FD">' +
              '<div class="r-body"><div class="r-name">' + UI.esc(e.title || cat.name) + '</div>' +
              '<div class="r-sub">' + UI.dateShort(e.date) + '</div></div>' +
              '<div class="r-end"><b>' + UI.money(e.amount) + '</b></div></div>';
          }).join('') : '<p class="muted small">אין עדיין הוצאות בקטגוריה הזו.</p>');
        UI.modal({ title: cat.icon + ' ' + cat.name, body: body });
      }
    }
  };
})();
