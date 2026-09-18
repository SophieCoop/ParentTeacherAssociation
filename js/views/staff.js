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

    var html = UI.pageHead({ title: 'צוות הגן', subtitle: st.staff.length + ' אנשי צוות', art: 'staff', tone: 'green', back: 'home' });

    html += '<div class="chips" style="margin-bottom:14px">' +
      '<button class="chip ' + (filter === 'all' ? 'on' : '') + '" data-action="staff-filter" data-level="all">הכל</button>' +
      Store.STAFF_LEVELS.map(function (l) {
        var n = st.staff.filter(function (t) { return t.level === l.id; }).length;
        return '<button class="chip ' + (filter === l.id ? 'on' : '') + '" data-action="staff-filter" data-level="' + l.id + '">' +
          l.icon + ' ' + UI.esc(l.name) + (n ? ' · ' + n : '') + '</button>';
      }).join('') +
      /* קטגוריה שאינה ברשימה הקבועה — למשל צוות מטבח או הסעות */
      '<button class="chip chip-add" data-action="staff-level-add" aria-label="הוספת קטגוריית צוות">+ קטגוריה</button>' +
      '</div>';

    /* קטגוריה שהוסיפו ידנית ניתנת לעריכה ולמחיקה כשהיא מסוננת */
    var custom = Store.staffLevel(filter);
    if (custom.custom) {
      html += '<div class="level-bar">' +
        '<span class="small muted">קטגוריה שהוספתם · דרגה ' + Calc.levelRank(st, custom.id) + '</span>' +
        '<button class="btn sm soft" data-action="staff-level-edit" data-level="' + custom.id + '">עריכת הקטגוריה</button>' +
        '</div>';
    }

    html += UI.addBtn({ act: 'staff-add', label: 'הוספת איש צוות', cls: 'mb-add' });

    if (!st.staff.length) {
      return html + UI.empty({ art: 'staff', title: 'עוד לא הוספתם צוות', text: 'הצוות עוזר בחישוב מתנות לחגים ולסוף שנה.' });
    }

    /* קיבוץ לפי היררכיה */
    if (filter === 'all') {
      Store.STAFF_LEVELS.forEach(function (l) {
        var group = st.staff.filter(function (t) { return t.level === l.id; });
        if (!group.length) return;
        html += '<div class="section-title"><span>' + l.icon + ' ' + UI.esc(l.name) + '</span><span class="sub">' + group.length + '</span></div>';
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
          options: Store.STAFF_LEVELS.map(function (l) { return { value: l.id, label: l.name, icon: l.icon }; }),
          hint: 'חסרה קטגוריה? אפשר להוסיף אחת בכפתור "+ קטגוריה" שבראש דף הצוות' },
        { name: 'role', label: 'תפקיד', value: t.role, placeholder: 'גננת / סייעת / מטפלת / צהרון',
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

  /* ---------- קטגוריית צוות שמוסיפים ידנית ---------- */
  /* המספר שעל המסך הוא הדרגה בהיררכיה (1 = הגבוהה), כמו בחלון הרעיונות;
     הוא מתורגם למשקל שנשמר על הקטגוריה. */
  function rankOptions() {
    var out = [];
    for (var r = 1; r <= Calc.lowestRank(); r++) {
      var like = Store.BUILTIN_STAFF_LEVELS.filter(function (l) {
        return l.edu && Calc.levelRank({ settings: {} }, l.id) === r;
      }).map(function (l) { return l.name; });
      out.push({ value: String(r), label: 'דרגה ' + r +
        (r === Calc.lowestRank() ? ' · ללא חלק בתקציב' : like.length ? ' · כמו ' + like.slice(0, 2).join(', ') : '') });
    }
    return out;
  }

  function levelForm(level) {
    var isNew = !level;
    level = level || { name: '', plural: '', icon: Store.LEVEL_ICONS[0], weight: 2 };
    UI.formModal({
      title: isNew ? 'קטגוריית צוות חדשה' : 'עריכת קטגוריה',
      subtitle: 'הקטגוריה מצטרפת לצוות החינוכי ומופיעה בבחירת הדרגה לכל איש צוות',
      fields: [
        { name: 'name', label: 'שם הקטגוריה', value: level.name, required: true, placeholder: 'צוות מטבח / הסעות / חצר' },
        { name: 'icon', label: 'סמל', type: 'chips', value: level.icon,
          options: (Store.LEVEL_ICONS.indexOf(level.icon) > -1 ? Store.LEVEL_ICONS : [level.icon].concat(Store.LEVEL_ICONS))
            .map(function (i) { return { value: i, label: i }; }) },
        { name: 'rank', label: 'דרגה בהיררכיה', type: 'chips',
          value: String(Math.max(1, Math.min(Calc.lowestRank(), Calc.lowestRank() - level.weight))),
          options: rankOptions(), hint: 'הדרגה משמשת רק לחלוקת תקציב מתנות — דרגה 1 מקבלת הכי הרבה' },
        { name: 'plural', label: 'שם ברבים', value: level.plural === level.name ? '' : level.plural,
          placeholder: 'אופציונלי — למשל "אנשי צוות המטבח"', hint: 'מוצג כשמדובר בכמה אנשים מהקטגוריה' }
      ],
      onSubmit: function (v) {
        var patch = { name: v.name, icon: v.icon, plural: v.plural, weight: Calc.rankToWeight(v.rank) };
        var saved = isNew ? Store.addStaffLevel(patch) : Store.updateStaffLevel(level.id, patch);
        if (!saved) { UI.toast('לא הצלחנו לשמור את הקטגוריה'); return false; }
        App.setVs('staffFilter', saved.id);
        App.render();
        UI.toast(isNew ? 'הקטגוריה נוספה ✓' : 'נשמר ✓');
      },
      deleteText: 'הקטגוריה תימחק מרשימת הדרגות. אפשר למחוק רק קטגוריה שאין בה אנשי צוות.',
      onDelete: isNew ? null : function () {
        if (!Store.removeStaffLevel(level.id)) {
          UI.toast('קודם העבירו את אנשי הצוות שבקטגוריה לדרגה אחרת');
          return false;
        }
        App.setVs('staffFilter', 'all');
        App.render();
        UI.toast('הקטגוריה נמחקה');
      }
    });
  }

  return {
    render: render,
    actions: {
      'staff-filter': function (el) { App.setVs('staffFilter', el.getAttribute('data-level')); App.render(); },
      'staff-add': function () { staffForm(null); },
      'staff-level-add': function () { levelForm(null); },
      'staff-level-edit': function (el) { levelForm(Store.staffLevel(el.getAttribute('data-level'))); },
      'staff-edit': function (el) { staffForm(Store.find('staff', el.getAttribute('data-id'))); },
      'staff-wa': function (el, ev) {
        if (ev) ev.stopPropagation();
        UI.whatsapp('היי, הודעה מוועד ההורים של ' + (Store.state.gan.name || 'הגן'), el.getAttribute('data-phone'));
      }
    }
  };
})();
