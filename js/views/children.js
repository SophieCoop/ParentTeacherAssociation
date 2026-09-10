/* ============================================================
   ילדי הגן — ימי הולדת, שמות ההורים וטלפונים
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.children = (function () {

  function tabList() {
    var st = Store.state;
    var kids = st.children.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'he'); });

    var html = '<button class="btn ghost" data-action="child-add" style="margin-bottom:14px">+ הוספת ילד</button>';

    if (!kids.length) {
      return html + UI.empty({ icon: '🧒', title: 'עוד אין ילדים ברשימה', text: 'הוסיפו את ילדי הגן, ההורים והטלפונים.', action: { act: 'child-add', label: '+ הוספת הילד הראשון' } });
    }

    html += kids.map(function (c) {
      var pct = Calc.sharePercent(c, st.settings);
      var parents = (c.parents || []).map(function (p) { return p.name; }).join(' · ');
      return '<div class="row" data-action="child-open" data-id="' + c.id + '">' +
        '<div class="avatar" style="background:' + UI.toneVar(UI.toneFor(c.name)) + '">' + UI.faceFor(c.name) + '</div>' +
        '<div class="r-body"><div class="r-name">' + UI.esc(c.name) + '</div>' +
        '<div class="r-sub">' + (c.birthDate ? '🎂 ' + UI.dateShort(c.birthDate) : 'ללא תאריך לידה') +
        (parents ? ' · ' + UI.esc(parents) : '') + '</div></div>' +
        '<div class="r-end">' +
          (Calc.childOutOfYear(c, st.settings)
            ? '<span class="badge over">מחוץ לשנה</span>'
            : (pct < 100 ? '<span class="badge warn">' + pct + '%</span>' : '')) + '</div>' +
        '</div>';
    }).join('');

    return html;
  }

  function tabContacts() {
    var kids = Store.state.children;
    if (!kids.length) return UI.empty({ icon: '📇', title: 'אין אנשי קשר', text: 'הוסיפו ילדים והורים לרשימה.' });

    return kids.map(function (c) {
      var parents = c.parents || [];
      return '<div class="card">' +
        '<div class="flex" style="margin-bottom:10px">' +
          '<div class="avatar" style="background:' + UI.toneVar(UI.toneFor(c.name)) + '">' + UI.faceFor(c.name) + '</div>' +
          '<div><div class="r-name">' + UI.esc(c.name) + '</div>' +
          '<div class="r-sub">' + (c.birthDate ? '🎂 ' + UI.dateShort(c.birthDate) + ' · ' + UI.ageText(c.birthDate) : '') + '</div></div>' +
        '</div>' +
        (parents.length ? parents.map(function (p, i) {
          return '<div class="row" style="box-shadow:none;background:#FAF8FD;margin-bottom:7px">' +
            '<div class="r-ico" style="background:#fff">👤</div>' +
            '<div class="r-body"><div class="r-name">' + UI.esc(p.name || 'הורה ' + (i + 1)) + '</div>' +
            '<div class="r-sub">' + UI.esc(p.phone || 'ללא טלפון') + '</div></div>' +
            (p.phone ? '<a class="iconbtn" href="tel:' + UI.esc(p.phone) + '">📞</a>' +
                       '<button class="iconbtn" data-action="child-wa" data-phone="' + UI.esc(p.phone) + '">💬</button>' : '') +
            '</div>';
        }).join('') : '<p class="muted small mb0">לא הוזנו פרטי הורים.</p>') +
        '</div>';
    }).join('');
  }

  /* ---------- כרטיס ילד ---------- */

  var openCard = null;

  function childCardBody(id) {
    var st = Store.state;
    var c = Store.find('children', id);
    if (!c) return '';
    var pct = Calc.sharePercent(c, st.settings);
    var auto = Calc.autoSharePercent(c, st.settings);
    var r = Calc.childCollection(st, c);

    var body = '<div class="row" style="background:' + UI.toneVar(UI.toneFor(c.name)) + ';box-shadow:none">' +
        '<div class="avatar" style="background:#fff">' + UI.faceFor(c.name) + '</div>' +
        '<div class="r-body"><div class="r-name">' + UI.esc(c.name) + '</div>' +
        '<div class="r-sub">' + (c.birthDate ? UI.dateShort(c.birthDate) + ' · ' + UI.ageText(c.birthDate) : 'ללא תאריך לידה') + '</div></div>' +
      '</div>' +
      '<div class="stat-grid" style="margin-bottom:14px">' +
        '<div class="stat"><div class="s-val">' + pct + '%</div><div class="s-lab">אחוז השתתפות</div></div>' +
        '<div class="stat"><div class="s-val">' + UI.money(r.due) + '</div><div class="s-lab">לתשלום</div></div>' +
        '<div class="stat"><div class="s-val ' + (r.over ? 'over-paid' : 'pos') + '">' + UI.money(r.paid) + '</div><div class="s-lab">שולם</div></div>' +
      '</div>' +
      (r.over
        ? '<div class="note" style="background:var(--orange)"><div class="n-ico">⚠️</div><div>' +
          '<b>הסכום ששולם עבר את המכסה</b>שולמו ' + UI.money(r.paid) + ' מתוך מכסה של ' +
          UI.money(r.due) + ' — עודף של ' + UI.money(r.overAmount) + '.</div></div>'
        : '');

    if (Calc.childOutOfYear(c, st.settings)) {
      body += '<div class="note" style="background:var(--orange)"><div class="n-ico">⚠️</div><div>' +
        '<b>תאריך ההצטרפות מחוץ לשנת הלימודים</b>' +
        'ההצטרפות נרשמה ב-' + UI.dateShort(c.joinDate) + ', אחרי סוף השנה שהוגדרה (' +
        UI.dateShort(st.settings.yearEnd) + '), ולכן אחוז ההשתתפות הוא 0 והסכומים מתאפסים. ' +
        'צריך לתקן את תאריכי שנת הלימודים בהגדרות או את תאריך ההצטרפות.</div></div>';
    } else if (c.joinDate) {
      body += '<div class="note"><div class="n-ico">📆</div><div><b>תאריך הצטרפות</b>' +
        'הצטרף/ה ב-' + UI.dateShort(c.joinDate) + '. החישוב האוטומטי: ' + auto + '% מהסכום המלא' +
        (c.sharePercentOverride ? ' (נקבע ידנית ' + pct + '%)' : '') + '.</div></div>';
    }

    body += '<div class="section-title" style="margin-top:6px"><span>הורים</span></div>';
    body += (c.parents || []).map(function (p) {
      return '<div class="row" style="box-shadow:none;background:#FAF8FD">' +
        '<div class="r-ico" style="background:#fff">👤</div>' +
        '<div class="r-body"><div class="r-name">' + UI.esc(p.name) + '</div>' +
        '<div class="r-sub">' + UI.esc(p.phone || '—') + '</div></div>' +
        (p.phone ? '<button class="iconbtn" data-action="child-wa" data-phone="' + UI.esc(p.phone) + '">💬</button>' : '') +
        '</div>';
    }).join('') || '<p class="muted small">לא הוזנו הורים.</p>';

    body += '<div class="btn-row mt">' +
      '<button class="btn ghost" data-action="child-edit" data-id="' + c.id + '">✏️ עריכה</button>' +
      '<button class="btn" data-action="pay-add" data-child="' + c.id + '">+ תשלום</button>' +
      '</div>';

    return body;
  }

  function openChild(id) {
    if (!Store.find('children', id)) return;
    var m = UI.modal({ title: 'פרטי הילד/ה', body: childCardBody(id) });
    openCard = { id: id, api: m };
  }

  /* הכרטיס הפתוח מתרענן אחרי עריכה, במקום להישאר עם נתונים ישנים */
  function refreshCard() {
    if (!openCard) return;
    if (!openCard.api.isOpen()) { openCard = null; return; }
    if (!Store.find('children', openCard.id)) { openCard.api.close(); openCard = null; return; }
    openCard.api.setBody(childCardBody(openCard.id));
  }

  /* תחילת שנת הלימודים — ברירת המחדל לתאריך ההצטרפות,
     כך שילד חדש נחשב משתתף מלא אלא אם מעדכנים אחרת */
  function yearStart() {
    var s = Store.state.settings.yearStart;
    if (s) return s;
    var now = new Date();
    var y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return y + '-09-01';
  }

  /* ---------- טופס ילד ---------- */
  function childForm(child) {
    var isNew = !child;
    child = child || { name: '', birthDate: '', joinDate: yearStart(), sharePercentOverride: '', parents: [] };
    var p1 = child.parents && child.parents[0] ? child.parents[0] : { name: '', phone: '' };
    var p2 = child.parents && child.parents[1] ? child.parents[1] : { name: '', phone: '' };

    UI.formModal({
      title: isNew ? 'הוספת ילד/ה' : 'עריכת פרטים',
      subtitle: 'שם, יום הולדת ופרטי ההורים',
      fields: [
        { name: 'name', label: 'שם הילד/ה', value: child.name, required: true, placeholder: 'נועה כהן' },
        { name: 'birthDate', label: 'תאריך לידה', type: 'date', value: child.birthDate },
        { name: 'p1name', label: 'שם הורה 1', value: p1.name, placeholder: 'שרה כהן', half: true },
        { name: 'p1phone', label: 'טלפון הורה 1', type: 'tel', value: p1.phone, placeholder: '052-1234567', half: true },
        { name: 'p2name', label: 'שם הורה 2', value: p2.name, placeholder: 'אופציונלי', half: true },
        { name: 'p2phone', label: 'טלפון הורה 2', type: 'tel', value: p2.phone, placeholder: 'אופציונלי', half: true },
        { name: 'joinDate', label: 'תאריך הצטרפות לגן', type: 'date',
          value: child.joinDate || yearStart(),
          hint: 'ברירת המחדל היא תחילת שנת הלימודים. משנים רק אם הילד/ה הצטרף/ה מאוחר יותר — ואז הסכום מחושב יחסית' },
        { name: 'sharePercentOverride', label: 'אחוז השתתפות ידני (%)', type: 'number',
          value: child.sharePercentOverride === null ? '' : child.sharePercentOverride,
          min: 0, max: 100, placeholder: 'ריק = חישוב אוטומטי',
          hint: 'משאירים ריק כדי שהמערכת תחשב לבד לפי תאריך ההצטרפות' }
      ],
      onSubmit: function (v) {
        var parents = [];
        if (v.p1name || v.p1phone) parents.push({ name: v.p1name, phone: v.p1phone });
        if (v.p2name || v.p2phone) parents.push({ name: v.p2name, phone: v.p2phone });
        var data = {
          name: v.name, birthDate: v.birthDate, joinDate: v.joinDate,
          sharePercentOverride: v.sharePercentOverride === '' ? null : Calc.num(v.sharePercentOverride),
          parents: parents
        };
        if (isNew) Store.add('children', data);
        else Store.update('children', child.id, data);
        App.render();
        refreshCard();
        UI.toast(isNew ? 'הילד/ה נוסף/ה ✓' : 'הפרטים עודכנו ✓');
      },
      onDelete: isNew ? null : function () {
        Store.state.payments = Store.state.payments.filter(function (p) { return p.childId !== child.id; });
        Store.remove('children', child.id);
        App.render();
        refreshCard();
        UI.toast('נמחק');
      }
    });
  }

  function render() {
    var tab = App.vs('kidTab', 'list');
    var html = UI.pageHead({ title: 'ילדי הגן', subtitle: Store.state.children.length + ' ילדים רשומים', icon: '🧒', tone: 'blue', back: 'home' });
    html += '<div class="segment">' +
      '<button data-action="kid-tab" data-tab="contacts" class="' + (tab === 'contacts' ? 'on' : '') + '">פרטים</button>' +
      '<button data-action="kid-tab" data-tab="list" class="' + (tab === 'list' ? 'on' : '') + '">רשימה</button>' +
      '</div>';
    html += tab === 'contacts' ? tabContacts() : tabList();
    return html;
  }

  return {
    render: render,
    childForm: childForm,
    actions: {
      'kid-tab': function (el) { App.setVs('kidTab', el.getAttribute('data-tab')); App.render(); },
      'child-add': function () { childForm(null); },
      'child-open': function (el) { openChild(el.getAttribute('data-id')); },
      'child-edit': function (el, ev) {
        if (ev) ev.stopPropagation();
        childForm(Store.find('children', el.getAttribute('data-id')));
      },
      'child-wa': function (el) {
        var phone = el.getAttribute('data-phone');
        UI.whatsapp('היי! הודעה מוועד ההורים של ' + (Store.state.gan.name || 'הגן') + ' 🌸', phone);
      }
    }
  };
})();
