/* ============================================================
   צוות הגן — שמות, תפקידים והיררכיה
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.staff = (function () {

  function render() {
    var st = Store.state;
    var filter = App.vs('staffFilter', 'all');
    var list = st.staff.slice();
    if (filter !== 'all') list = list.filter(function (t) { return t.level === filter; });

    var html = UI.pageHead({ title: 'צוות הגן', subtitle: st.staff.length + ' אנשי צוות', icon: '👩‍🏫', tone: 'green', back: 'home' });

    html += '<div class="chips" style="margin-bottom:14px">' +
      '<button class="chip ' + (filter === 'all' ? 'on' : '') + '" data-action="staff-filter" data-level="all">הכל</button>' +
      Store.STAFF_LEVELS.map(function (l) {
        var n = st.staff.filter(function (t) { return t.level === l.id; }).length;
        return '<button class="chip ' + (filter === l.id ? 'on' : '') + '" data-action="staff-filter" data-level="' + l.id + '">' +
          l.icon + ' ' + l.name + (n ? ' · ' + n : '') + '</button>';
      }).join('') +
      '</div>';

    if (!st.staff.length) {
      return html + UI.empty({ icon: '👩‍🏫', title: 'עוד לא הוספתם צוות', text: 'הצוות עוזר בחישוב מתנות לחגים ולסוף שנה.', action: { act: 'staff-add', label: '+ הוספת איש צוות' } }) +
        '<button class="btn" data-action="staff-add">+ הוספת איש צוות</button>';
    }

    /* קיבוץ לפי היררכיה */
    if (filter === 'all') {
      Store.STAFF_LEVELS.forEach(function (l) {
        var group = st.staff.filter(function (t) { return t.level === l.id; });
        if (!group.length) return;
        html += '<div class="section-title"><span>' + l.icon + ' ' + l.name + '</span><span class="sub">' + group.length + '</span></div>';
        html += group.map(function (t) { return staffRow(t, l); }).join('');
      });
      var unknown = st.staff.filter(function (t) {
        return !Store.STAFF_LEVELS.some(function (l) { return l.id === t.level; });
      });
      if (unknown.length) {
        html += '<div class="section-title"><span>אחר</span></div>';
        html += unknown.map(function (t) { return staffRow(t, Store.staffLevel(t.level)); }).join('');
      }
    } else {
      html += list.map(function (t) { return staffRow(t, Store.staffLevel(t.level)); }).join('');
    }

    html += '<button class="btn" style="margin-top:14px" data-action="staff-add">+ הוספת איש צוות</button>';
    return html;
  }

  function staffRow(t, level) {
    return '<div class="row" data-action="staff-edit" data-id="' + t.id + '">' +
      '<div class="avatar" style="background:' + UI.toneVar(level.tone) + '">' + level.icon + '</div>' +
      '<div class="r-body"><div class="r-name">' + UI.esc(t.name) + '</div>' +
      '<div class="r-sub">' + UI.esc(t.role || level.name) +
      (t.birthDate ? ' · 🎂 ' + UI.dateDayMonth(t.birthDate) : '') + '</div></div>' +
      (t.phone ? '<button class="iconbtn" data-action="staff-wa" data-phone="' + UI.esc(t.phone) + '">💬</button>' : '') +
      '</div>';
  }

  function staffForm(t) {
    var isNew = !t;
    t = t || { name: '', role: '', level: 'assistant', phone: '', birthDate: '' };
    UI.formModal({
      title: isNew ? 'הוספת איש צוות' : 'עריכת פרטים',
      fields: [
        { name: 'name', label: 'שם מלא', value: t.name, required: true, placeholder: 'הדס כהן' },
        { name: 'level', label: 'דרגה בהיררכיה', type: 'chips', value: t.level,
          options: Store.STAFF_LEVELS.map(function (l) { return { value: l.id, label: l.name, icon: l.icon }; }) },
        { name: 'role', label: 'תפקיד', value: t.role, placeholder: 'גננת / סייעת / מטפלת',
          suggestions: Store.STAFF_ROLES, hint: 'אפשר לבחור מהרשימה או לכתוב תפקיד חופשי' },
        { name: 'phone', label: 'טלפון', type: 'tel', value: t.phone, placeholder: '050-1234567', half: true },
        { name: 'birthDate', label: 'יום הולדת', type: 'date', value: t.birthDate, half: true }
      ],
      onSubmit: function (v) {
        if (isNew) Store.add('staff', v);
        else Store.update('staff', t.id, v);
        App.render();
        UI.toast('נשמר ✓');
      },
      onDelete: isNew ? null : function () {
        Store.remove('staff', t.id);
        App.render();
        UI.toast('נמחק');
      }
    });
  }

  return {
    render: render,
    actions: {
      'staff-filter': function (el) { App.setVs('staffFilter', el.getAttribute('data-level')); App.render(); },
      'staff-add': function () { staffForm(null); },
      'staff-edit': function (el) { staffForm(Store.find('staff', el.getAttribute('data-id'))); },
      'staff-wa': function (el, ev) {
        if (ev) ev.stopPropagation();
        UI.whatsapp('היי! הודעה מוועד ההורים של ' + (Store.state.gan.name || 'הגן') + ' 🌸', el.getAttribute('data-phone'));
      }
    }
  };
})();
