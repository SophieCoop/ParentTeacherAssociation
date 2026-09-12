/* ============================================================
   תאריכים — האירוע הבא, וכל התאריכים מקובצים לפי חודש
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.dates = (function () {

  /* כל התאריכים — ימי הולדת, סעיפי תקציב, אירועים וסוף שנה —
     כשלכל אחד המופע הקרוב שלו, ממוינים מהקרוב לרחוק */
  function items() {
    return Calc.allDates(Store.state).map(function (it) {
      return Object.assign({}, it, { next: Calc.nextOccurrence(it) });
    }).filter(function (it) { return it.next; })
      .sort(function (a, b) { return a.next - b.next; });
  }

  function monthKey(d) { return d.getFullYear() + '-' + d.getMonth(); }
  function monthLabel(d) { return UI.MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }

  function tint(tone) {
    return '--tint:' + UI.toneVar(tone) + ';--tint-ink:' + UI.toneInk(tone);
  }

  /* סעיף תקציב מקבל את איור הקטגוריה שלו; שאר התאריכים — את האמוג׳י */
  function dateIcon(it) {
    return it.catId ? UI.catIcon(Store.category(it.catId)) : it.icon;
  }

  function badge(it) {
    return '<span class="d-badge" style="' + tint(it.tone) + '">' +
      '<b>' + it.next.getDate() + '</b>' +
      '<i>' + UI.MONTHS_SHORT[it.next.getMonth()] + '</i></span>';
  }

  /* אירועי הגן ניתנים לעריכה; ימי הולדת וסעיפי תקציב מגיעים ממקום אחר */
  function editable(it) {
    return it.type === 'event' && it.refId;
  }

  function dateRow(it) {
    var act = editable(it)
      ? ' data-action="date-edit" data-id="' + it.refId + '" style="cursor:pointer"'
      : '';
    return '<div class="drow"' + act + '>' +
      '<span class="d-ico" style="background:' + UI.toneVar(it.tone) + '">' + dateIcon(it) + '</span>' +
      '<span class="d-body">' +
        '<span class="d-name">' + UI.esc(it.title) + '</span>' +
        '<span class="d-sub">' + UI.relativeDays(it.next) +
          (it.kind ? ' · ' + UI.esc(it.kind) : '') + '</span>' +
      '</span>' +
      badge(it) +
      '</div>';
  }

  function nextUp(it) {
    return '<div class="next-up" style="' + tint(it.tone) + '">' +
      '<span class="d-ico lg" style="background:rgba(255,255,255,.7)">' + dateIcon(it) + '</span>' +
      '<span class="d-body">' +
        '<span class="nu-label">האירוע הבא</span>' +
        '<span class="d-name">' + UI.esc(it.title) + '</span>' +
        '<span class="d-sub">' + UI.relativeDays(it.next) + ' · ' + monthLabel(it.next) + '</span>' +
      '</span>' +
      badge(it) +
      '</div>';
  }

  function monthGroup(key, label, list, open) {
    return '<div class="mgroup">' +
      '<button class="mgroup-head" data-action="date-month" data-id="' + key + '" ' +
        'aria-expanded="' + (open ? 'true' : 'false') + '">' +
        '<span class="mg-name">' + UI.esc(label) + '</span>' +
        '<span class="mg-chev' + (open ? '' : ' closed') + '">' + UI.svgIcon('chevron', 16) + '</span>' +
      '</button>' +
      (open ? '<div class="mgroup-body">' + list.map(dateRow).join('') + '</div>' : '') +
      '</div>';
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
    var html = UI.pageHead({ title: 'תאריכים מיוחדים',
      subtitle: 'חגים, ימי הולדת, סוף שנה ואירועי הגן',
      art: 'dates', tone: 'blue', back: 'home',
      action: { act: 'date-add', label: 'הוספת תאריך', icon: '+' } });

    var list = items();
    if (!list.length) {
      return html + UI.empty({ art: 'dates', title: 'אין תאריכים',
        text: 'הוסיפו ימי הולדת לילדים או אירועים לגן.',
        action: { act: 'date-add', label: '+ הוספת תאריך' } });
    }

    html += nextUp(list[0]);

    var closed = App.vs('dateClosed', {});
    var order = [], groups = {};
    list.forEach(function (it) {
      var k = monthKey(it.next);
      if (!groups[k]) { groups[k] = { label: monthLabel(it.next), list: [] }; order.push(k); }
      groups[k].list.push(it);
    });

    html += order.map(function (k) {
      return monthGroup(k, groups[k].label, groups[k].list, !closed[k]);
    }).join('');

    return html;
  }

  return {
    render: render,
    badge: badge,
    dateIcon: dateIcon,
    actions: {
      'date-add': function () { dateForm(null); },
      'date-edit': function (el) { dateForm(Store.find('events', el.getAttribute('data-id'))); },
      'date-month': function (el) {
        var k = el.getAttribute('data-id');
        var closed = App.vs('dateClosed', {});
        closed[k] = !closed[k];
        App.render();
      }
    }
  };
})();
