/* ============================================================
   צוות הגן / הכיתה — שמות, תפקידים והיררכיה
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.staff = (function () {

  /* ---------- המסך: קבוצה לכל קטגוריה, ולכל קבוצה דרגה ----------
     הדרגה (1 = הגבוהה) קובעת איזה חלק מתקציב המתנות מגיע לכל איש צוות
     בקבוצה. עד עכשיו אפשר היה לשנות אותה רק מתוך חלון הרעיון; כאן היא
     יושבת במקום הטבעי שלה, ליד האנשים עצמם. הערך נשמר באותו מקום
     (settings.levelWeights), כך ששני המסכים תמיד מסכימים. */
  function render() {
    var st = Store.state;
    var filter = App.vs('staffFilter', 'all');
    var levels = Store.STAFF_LEVELS;
    if (filter !== 'all' && !levels.some(function (l) { return l.id === filter; })) filter = 'all';

    var html = UI.pageHead({ title: Lang.t('staffTeam'), subtitle: st.staff.length + ' אנשי צוות', art: 'staff', tone: 'green', back: 'home' });

    /* הצ'יפים הם גם מונה וגם מסנן: לחיצה מציגה רק את הקבוצה, לחיצה
       חוזרת מחזירה את כולן */
    html += '<div class="chips st-chips">' +
      levels.map(function (l) {
        var n = st.staff.filter(function (t) { return t.level === l.id; }).length;
        return '<button class="chip ' + (filter === l.id ? 'on' : '') + '" data-action="staff-filter" data-level="' + l.id + '">' +
          l.icon + ' ' + UI.esc(l.name) + ' (' + n + ')</button>';
      }).join('') +
      /* קטגוריה שאינה ברשימה הקבועה — למשל צוות מטבח או הסעות */
      '<button class="chip chip-add" data-action="staff-level-add" aria-label="הוספת קטגוריית צוות">+ קטגוריה</button>' +
      '</div>';

    /* קטגוריה שהוסיפו ידנית ניתנת לעריכה ולמחיקה כשהיא מסוננת */
    var custom = Store.staffLevel(filter);
    if (custom.custom) {
      html += '<div class="level-bar">' +
        '<span class="small muted">קטגוריה שהוספתם</span>' +
        '<button class="btn sm soft" data-action="staff-level-edit" data-level="' + custom.id + '">עריכת הקטגוריה</button>' +
        '</div>';
    }

    html += UI.addBtn({ act: 'staff-add', label: 'הוספת איש צוות', cls: 'mb-add', data: filter !== 'all' ? { level: filter } : {} });

    html += '<div class="st-info"><span class="st-i" aria-hidden="true">i</span>' +
      'דרגה 1 היא הגבוהה ביותר, והיא משמשת לחישוב חלוקת תקציב המתנות. ' +
      'דרגה ' + Calc.lowestRank() + ' אינה מקבלת חלק בתקציב.</div>';

    var shown = filter === 'all' ? levels : levels.filter(function (l) { return l.id === filter; });
    html += shown.map(function (l) {
      return groupCard(l, st.staff.filter(function (t) { return t.level === l.id; }));
    }).join('');

    if (filter === 'all') {
      var unknown = st.staff.filter(function (t) {
        return !levels.some(function (l) { return l.id === t.level; });
      });
      if (unknown.length) html += groupCard(null, unknown);
    }
    return html;
  }

  function rankSelect(level) {
    var cur = Calc.levelRank(Store.state, level.id);
    var low = Calc.lowestRank();
    var opts = '';
    for (var r = 1; r <= low; r++) {
      opts += '<option value="' + r + '"' + (r === cur ? ' selected' : '') + '>דרגה ' + r + '</option>';
    }
    return '<label class="st-rank"><span class="sr-only">דרגה בהיררכיה של ' + UI.esc(level.name) + '</span>' +
      '<select data-change="staff-rank" data-level="' + level.id + '">' + opts + '</select></label>';
  }

  function groupCard(level, people) {
    var lv = level || { id: '', name: 'אחר', icon: '👤', tone: 'purple' };
    return '<section class="st-group">' +
      '<div class="st-ghead">' +
        '<span class="st-gname">' + lv.icon + ' ' + UI.esc(lv.name) + '</span>' +
        '<span class="st-count" aria-label="' + people.length + ' אנשי צוות">' + people.length + '</span>' +
        (level ? rankSelect(level) : '') +
      '</div>' +
      (people.length
        ? people.map(function (t) { return staffRow(t, level || Store.staffLevel(t.level)); }).join('')
        : '<button class="st-empty" data-action="staff-add" data-level="' + lv.id + '">+ הוספת איש צוות</button>') +
      '</section>';
  }

  function staffRow(t, level) {
    return '<div class="st-row">' +
      '<button class="st-main" data-action="staff-edit" data-id="' + t.id + '">' +
        '<span class="avatar" style="background:' + UI.toneVar(level.tone) + '">' + level.icon + '</span>' +
        '<span class="st-body"><span class="st-name">' + UI.esc(t.name) + '</span>' +
          '<span class="st-sub">' + UI.esc(t.role || level.name) +
          (t.birthDate ? ' · 🎂 ' + UI.dateDayMonth(t.birthDate) : '') + '</span></span>' +
        '<span class="st-chev" aria-hidden="true">' + UI.svgIcon('chevron', 16) + '</span>' +
      '</button>' +
      '<button class="st-more" data-action="staff-more" data-id="' + t.id + '" aria-label="פעולות נוספות">⋮</button>' +
      '</div>';
  }

  /* התפריט של ⋮: הפעולות שאינן עריכה — הודעה בוואטסאפ, והעברה מהירה
     לקטגוריה אחרת בלי לפתוח את כל הטופס */
  function moreMenu(t) {
    var cur = t.level;
    UI.modal({
      title: t.name,
      subtitle: Store.staffLevel(t.level).name,
      body:
        '<div class="st-menu">' +
          '<button class="btn soft js-edit" type="button">✏️ עריכת פרטים</button>' +
          (t.phone ? '<button class="btn soft js-wa" type="button">💬 הודעה בוואטסאפ</button>' : '') +
          '<div class="field mt"><label>העברה לקטגוריה</label><div class="chips">' +
            Store.STAFF_LEVELS.map(function (l) {
              return '<button type="button" class="chip' + (l.id === cur ? ' on' : '') + '" data-move="' + l.id + '">' +
                l.icon + ' ' + UI.esc(l.name) + '</button>';
            }).join('') +
          '</div></div>' +
          '<button class="btn danger js-del" type="button">מחיקה</button>' +
        '</div>',
      onMount: function (root, close) {
        root.querySelector('.js-edit').addEventListener('click', function () {
          close(); setTimeout(function () { staffForm(Store.find('staff', t.id)); }, 150);
        });
        var wa = root.querySelector('.js-wa');
        if (wa) wa.addEventListener('click', function () {
          UI.whatsapp('היי, הודעה מוועד ההורים של ' + (Store.state.gan.name || Lang.t('placeThe')), t.phone);
        });
        Array.prototype.forEach.call(root.querySelectorAll('[data-move]'), function (b) {
          b.addEventListener('click', function () {
            Store.update('staff', t.id, { level: b.getAttribute('data-move') });
            close();
            App.render();
            UI.toast('הועבר ל' + Store.staffLevel(b.getAttribute('data-move')).name + ' ✓');
          });
        });
        root.querySelector('.js-del').addEventListener('click', function () {
          close();
          UI.confirmBox('למחוק את ' + t.name + '?', 'איש הצוות יימחק מהרשימה.', function () {
            Store.remove('staff', t.id);
            App.render();
            UI.toast('נמחק');
          });
        });
      }
    });
  }

  function staffForm(t, presetLevel) {
    var isNew = !t;
    t = t || { name: '', role: '', level: presetLevel || 'assistant', phone: '', birthDate: '' };
    UI.formModal({
      title: isNew ? 'הוספת איש צוות' : 'עריכת פרטים',
      fields: [
        { name: 'name', label: 'שם מלא', value: t.name, required: true, placeholder: 'הדס כהן' },
        { name: 'level', label: 'דרגה בהיררכיה', type: 'chips', value: t.level,
          options: Store.STAFF_LEVELS.map(function (l) { return { value: l.id, label: l.name, icon: l.icon }; }),
          hint: 'חסרה קטגוריה? אפשר להוסיף אחת בכפתור "+ קטגוריה" שבראש דף הצוות' },
        { name: 'role', label: 'תפקיד', value: t.role, placeholder: Lang.t('rolesPlaceholder'),
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
          value: String(isNew ? Math.max(1, Math.min(Calc.lowestRank(), Calc.lowestRank() - level.weight))
                              : Calc.levelRank(Store.state, level.id)),
          options: rankOptions(), hint: 'הדרגה משמשת רק לחלוקת תקציב מתנות — דרגה 1 מקבלת הכי הרבה' },
        { name: 'plural', label: 'שם ברבים', value: level.plural === level.name ? '' : level.plural,
          placeholder: 'אופציונלי — למשל "אנשי צוות המטבח"', hint: 'מוצג כשמדובר בכמה אנשים מהקטגוריה' }
      ],
      onSubmit: function (v) {
        var patch = { name: v.name, icon: v.icon, plural: v.plural, weight: Calc.rankToWeight(v.rank) };
        var saved = isNew ? Store.addStaffLevel(patch) : Store.updateStaffLevel(level.id, patch);
        /* דרגה שנקבעה מהמסך נשמרת כדריסה; מה שנבחר כאן הוא עכשיו הקובע */
        var over = Store.state.settings.levelWeights;
        if (saved && over) delete over[saved.id];
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
      'staff-filter': function (el) {
        var id = el.getAttribute('data-level');
        App.setVs('staffFilter', App.vs('staffFilter', 'all') === id ? 'all' : id);
        App.render();
      },
      'staff-add': function (el) {
        var lv = el && el.getAttribute ? el.getAttribute('data-level') : '';
        staffForm(null, lv && Store.STAFF_LEVELS.some(function (l) { return l.id === lv; }) ? lv : null);
      },
      'staff-more': function (el) { moreMenu(Store.find('staff', el.getAttribute('data-id'))); },
      /* הדרגה מתורגמת למשקל, ונשמרת באותו מקום שבו חלון הרעיון שומר אותה */
      'staff-rank': function (el) {
        var id = el.getAttribute('data-level');
        Store.state.settings.levelWeights = Store.state.settings.levelWeights || {};
        Store.state.settings.levelWeights[id] = Calc.rankToWeight(el.value);
        Store.save();
        App.render();
        UI.toast(Store.staffLevel(id).name + ' — דרגה ' + Calc.levelRank(Store.state, id) + ' ✓');
      },
      'staff-level-add': function () { levelForm(null); },
      'staff-level-edit': function (el) { levelForm(Store.staffLevel(el.getAttribute('data-level'))); },
      'staff-edit': function (el) { staffForm(Store.find('staff', el.getAttribute('data-id'))); },
      'staff-wa': function (el, ev) {
        if (ev) ev.stopPropagation();
        UI.whatsapp('היי, הודעה מוועד ההורים של ' + (Store.state.gan.name || Lang.t('placeThe')), el.getAttribute('data-phone'));
      }
    }
  };
})();
