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
    var full = st.children.filter(function (c) { return Calc.sharePercent(c, st.settings) >= 100; }).length;
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
      '<div class="hint mt">לפי התאריכים האלה מחושב האחוז היחסי של ילד שמצטרף באמצע השנה.</div>' +
      '</div>';

    return html;
  }

  /* ---------- לשונית: סעיפי תקציב ---------- */
  function tabItems() {
    var st = Store.state;
    var items = st.budgetItems.slice().sort(function (a, b) {
      return (a.date || '9999').localeCompare(b.date || '9999');
    });
    var total = Calc.budgetTotal(st);

    var html = '<button class="btn ghost" data-action="budget-add" style="margin-bottom:14px">+ הוספת סעיף הוצאה</button>';

    if (!items.length) {
      return html + UI.empty({
        icon: '🧮', title: 'עוד לא תכננתם תקציב',
        text: 'הוסיפו סעיפי הוצאה מתוך הקטגוריות — מתנות, כיבוד, חוגים ועוד.',
        action: { act: 'budget-add', label: '+ הוספת הסעיף הראשון' }
      });
    }

    html += items.map(function (b) {
      var cat = Store.category(b.categoryId);
      var share = total > 0 ? (Calc.num(b.amount) / total) * 100 : 0;
      return '<div class="row" data-action="budget-edit" data-id="' + b.id + '" style="background:' + UI.toneVar(cat.tone) + '55">' +
        '<div class="r-ico" style="background:#fff">' + cat.icon + '</div>' +
        '<div class="r-body">' +
          '<div class="r-name">' + UI.esc(b.title || cat.name) + '</div>' +
          '<div class="r-sub">' + UI.esc(cat.name) + (b.date ? ' · 🗓 ' + UI.dateShort(b.date) : ' · ללא תאריך') + '</div>' +
        '</div>' +
        '<div class="r-end"><div class="r-amount">' + UI.money(b.amount) + '</div>' +
        '<div class="r-pct">' + share.toFixed(1) + '%</div></div>' +
        '</div>';
    }).join('');

    html += '<div class="row" style="background:var(--primary-soft);box-shadow:none;margin-top:14px">' +
      '<div class="r-ico" style="background:#fff">💰</div>' +
      '<div class="r-body"><div class="r-name">סה״כ כל הקטגוריות</div>' +
      '<div class="r-sub">' + items.length + ' סעיפים</div></div>' +
      '<div class="r-end"><div class="r-amount">' + UI.money(total) + '</div></div></div>';

    return html;
  }

  /* ---------- לשונית: סיכום ---------- */
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

    html += '<div class="note"><div class="n-ico">🧮</div><div><b>כמה כל הורה משלם?</b>' +
      'התקציב (' + UI.money(total) + ') מחולק ב־' + units.toFixed(2) + ' יחידות השתתפות ' +
      '(ילד מלא = 1, ילד שהצטרף באמצע שנה = החלק היחסי) ויוצא ' + UI.money(perFull) + ' לילד מלא.</div></div>';

    html += '<div class="section-title"><span>פילוח לפי קטגוריה</span></div>';

    if (!cats.length) {
      html += UI.empty({ icon: '🥧', title: 'אין עדיין נתונים לפילוח', text: 'הוסיפו סעיפי תקציב כדי לראות את החלוקה.' });
    } else {
      html += cats.map(function (c) {
        var amt = byCat[c.id] || 0;
        var used = spentByCat[c.id] || 0;
        var share = total > 0 ? (amt / total) * 100 : 0;
        return '<div class="card" style="padding:13px 14px">' +
          '<div class="flex-between">' +
            '<div class="flex"><span class="r-ico" style="background:' + UI.toneVar(c.tone) + '">' + c.icon + '</span>' +
            '<div><div class="r-name">' + UI.esc(c.name) + '</div>' +
            '<div class="r-sub">' + share.toFixed(1) + '% מהתקציב · הוצא ' + UI.money(used) + '</div></div></div>' +
            '<b class="nowrap">' + UI.money(amt) + '</b>' +
          '</div>' +
          UI.bar(used, amt, used > amt ? 'over' : (used === amt ? 'ok' : 'thin')) +
          '</div>';
      }).join('');
    }

    html += '<div class="section-title"><span>ניהול קטגוריות</span>' +
      '<button class="btn sm soft" data-action="cat-add">+ קטגוריה</button></div>';
    html += '<div class="card"><div class="flex wrap" style="gap:8px">' +
      st.categories.map(function (c) {
        return '<button class="chip" data-action="cat-edit" data-id="' + c.id + '" ' +
          'style="background:' + UI.toneVar(c.tone) + ';color:' + UI.toneInk(c.tone) + '">' + c.icon + ' ' + UI.esc(c.name) + '</button>';
      }).join('') +
      '</div></div>';

    return html;
  }

  function render() {
    var tab = App.vs('budgetTab', 'items');
    var html = UI.pageHead({ title: 'תכנון תקציב', subtitle: 'סעיפי ההוצאה המתוכננים לשנה', icon: '🧮', tone: 'pink', back: 'home' });

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
  function itemForm(item) {
    var isNew = !item;
    item = item || { categoryId: Store.state.categories[0].id, title: '', amount: '', date: '', note: '' };
    UI.formModal({
      title: isNew ? 'סעיף תקציב חדש' : 'עריכת סעיף',
      subtitle: 'בחרו קטגוריה, סכום מתוכנן ותאריך יעד',
      submitLabel: 'שמירה',
      fields: [
        { name: 'categoryId', label: 'קטגוריה', type: 'select', value: item.categoryId, options: catOptions(), required: true },
        { name: 'title', label: 'שם הסעיף', value: item.title, placeholder: 'למשל: מתנה לחג לילדים' },
        { name: 'amount', label: 'סכום מתוכנן (₪)', type: 'number', value: item.amount, placeholder: '0', step: '1', min: 0 },
        { name: 'date', label: 'תאריך יעד', type: 'date', value: item.date, hint: 'למתי צריך להביא את המתנה / לבצע את ההוצאה' },
        { name: 'note', label: 'הערות', type: 'textarea', value: item.note, placeholder: 'אופציונלי' }
      ],
      onSubmit: function (v) {
        if (isNew) Store.add('budgetItems', v);
        else Store.update('budgetItems', item.id, v);
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
      'budget-add': function () { itemForm(null); },
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
