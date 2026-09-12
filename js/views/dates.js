/* ============================================================
   תאריכים — ימי הולדת ואירועי הגן
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.dates = (function () {

  /* ---------- רשימות ---------- */
  function listAll() {
    var items = Calc.allDates(Store.state).map(function (it) {
      return Object.assign({}, it, { next: Calc.nextOccurrence(it) });
    }).filter(function (it) { return it.next; })
      .sort(function (a, b) { return a.next - b.next; });

    if (!items.length) return UI.empty({ icon: '📅', title: 'אין תאריכים', text: 'הוסיפו ימי הולדת לילדים או אירועים לגן.', action: { act: 'date-add', label: '+ הוספת תאריך' } });

    var add = '<button class="btn ghost" data-action="date-add" style="margin-bottom:14px">+ הוספת תאריך</button>';
    return add + items.map(function (it) {
      return '<div class="row">' +
        '<div class="r-ico" style="background:' + UI.toneVar(it.tone) + '">' + it.icon + '</div>' +
        '<div class="r-body"><div class="r-name">' + UI.esc(it.title) + '</div>' +
        '<div class="r-sub">' + UI.relativeDays(it.next) + '</div></div>' +
        '<div class="r-end"><b class="nowrap">' + it.next.getDate() + '.' + (it.next.getMonth() + 1) + '</b></div>' +
        '</div>';
    }).join('');
  }

  function listBirthdays() {
    var st = Store.state;
    var all = st.children.filter(function (c) { return c.birthDate; })
      .map(function (c) { return { name: c.name, date: c.birthDate, who: 'ילד/ה', tone: UI.toneFor(c.name), face: UI.faceFor(c.name) }; })
      .concat(st.staff.filter(function (t) { return t.birthDate; })
        .map(function (t) { return { name: t.name, date: t.birthDate, who: 'צוות', tone: 'purple', face: '👩‍🏫' }; }));

    if (!all.length) return UI.empty({ icon: '🎂', title: 'אין ימי הולדת', text: 'הוסיפו תאריכי לידה בכרטיסי הילדים והצוות.' });

    all.forEach(function (x) { x.next = Calc.nextOccurrence({ date: x.date, type: 'birthday' }); });
    all.sort(function (a, b) { return a.next - b.next; });

    var budget = Calc.budgetByCategory(Store.state)['cat-bday'] || 0;
    var perKid = st.children.length ? budget / st.children.length : 0;

    var html = '';
    if (budget) {
      html += '<div class="note"><div class="n-ico">🎁</div><div><b>תקציב מתנות יום הולדת</b>' +
        UI.money(budget) + ' לשנה · כ-' + UI.money(perKid) + ' למתנה לילד</div></div>';
    }

    return html + all.map(function (x) {
      return '<div class="row">' +
        '<div class="avatar" style="background:' + UI.toneVar(x.tone) + '">' + x.face + '</div>' +
        '<div class="r-body"><div class="r-name">' + UI.esc(x.name) + '</div>' +
        '<div class="r-sub">' + x.who + ' · ' + UI.dateShort(x.date) + ' · ' + UI.ageText(x.date) + '</div></div>' +
        '<div class="r-end"><span class="badge ' + (UI.daysUntil(x.next) <= 14 ? 'warn' : 'neutral') + '">' +
        UI.relativeDays(x.next) + '</span></div></div>';
    }).join('');
  }

  function listEvents() {
    var st = Store.state;
    var html = '<button class="btn ghost" data-action="date-add" style="margin-bottom:14px">+ הוספת תאריך</button>';
    if (!st.events.length) {
      return html + UI.empty({ icon: '🎪', title: 'אין אירועים', text: 'טיולים, מסיבות, ישיבות ועד וחגים.', action: { act: 'date-add', label: '+ הוספת אירוע' } });
    }
    return html + st.events.slice().sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); })
      .map(function (e) {
        return '<div class="row" data-action="date-edit" data-id="' + e.id + '">' +
          '<div class="r-ico" style="background:' + UI.toneVar(e.tone || 'blue') + '">' + (e.icon || '📅') + '</div>' +
          '<div class="r-body"><div class="r-name">' + UI.esc(e.title) + '</div>' +
          '<div class="r-sub">' + UI.dateShort(e.date) + (e.note ? ' · ' + UI.esc(e.note) : '') + '</div></div>' +
          '<div class="r-end"><b class="nowrap small">' + UI.dateDayMonth(e.date) + '</b></div></div>';
      }).join('');
  }

  function dateForm(ev) {
    var isNew = !ev;
    ev = ev || { title: '', date: UI.todayISO(), icon: '📅', tone: 'blue', note: '', type: 'event' };
    UI.formModal({
      title: isNew ? 'תאריך חדש' : 'עריכת תאריך',
      fields: [
        { name: 'title', label: 'כותרת', value: ev.title, required: true, placeholder: 'למשל: יום גיבוש גן' },
        { name: 'date', label: 'תאריך', type: 'date', value: ev.date, required: true },
        { name: 'icon', label: 'אימוג׳י', value: ev.icon, placeholder: '📅', half: true },
        { name: 'tone', label: 'צבע', type: 'select', value: ev.tone, half: true, options: [
          { value: 'blue', label: 'כחול' }, { value: 'pink', label: 'ורוד' },
          { value: 'green', label: 'ירוק' }, { value: 'yellow', label: 'צהוב' },
          { value: 'purple', label: 'סגול' }, { value: 'peach', label: 'אפרסק' }
        ] },
        { name: 'note', label: 'הערה', value: ev.note, placeholder: 'אופציונלי' }
      ],
      onSubmit: function (v) {
        v.type = 'event';
        if (isNew) Store.add('events', v);
        else Store.update('events', ev.id, v);
        App.render();
        UI.toast('נשמר ✓');
      },
      onDelete: isNew ? null : function () {
        Store.remove('events', ev.id);
        App.render();
      }
    });
  }

  function render() {
    var tab = App.vs('dateTab', 'all');
    var html = UI.pageHead({ title: 'תאריכים מיוחדים',
      subtitle: 'חגים מהתקציב, ימי הולדת, סוף השנה ואירועי הגן',
      icon: '📅', tone: 'blue', back: 'home' });
    html += '<div class="segment">' +
      '<button data-action="date-tab" data-tab="events" class="' + (tab === 'events' ? 'on' : '') + '">אירועים</button>' +
      '<button data-action="date-tab" data-tab="birthdays" class="' + (tab === 'birthdays' ? 'on' : '') + '">ימי הולדת</button>' +
      '<button data-action="date-tab" data-tab="all" class="' + (tab === 'all' ? 'on' : '') + '">כל התאריכים</button>' +
      '</div>';
    html += '<div class="section-title"><span>' +
      (tab === 'events' ? 'אירועי הגן' : tab === 'birthdays' ? 'ימי הולדת' : 'כל התאריכים') + '</span></div>';
    if (tab === 'events') html += listEvents();
    else if (tab === 'birthdays') html += listBirthdays();
    else html += listAll();
    return html;
  }

  return {
    render: render,
    actions: {
      'date-tab': function (el) { App.setVs('dateTab', el.getAttribute('data-tab')); App.render(); },
      'date-add': function () { dateForm(null); },
      'date-edit': function (el) { dateForm(Store.find('events', el.getAttribute('data-id'))); }
    }
  };
})();
