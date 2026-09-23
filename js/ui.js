/* ============================================================
   UI — עזרי תצוגה: פורמט, מודאלים, טפסים, הודעות
   ============================================================ */
var UI = (function () {

  /* ---------- מלל ומספרים ---------- */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* opts.floor — עיגול כלפי מטה לשקל שלם. משמש בתצוגה בלבד ובמקום
     אחד — עמוד הבית. החישובים עצמם ממשיכים לעבוד על הסכום המלא. */
  function money(n, opts) {
    var v = Calc.num(n);
    if (opts && opts.floor) v = Math.floor(v);
    var neg = v < 0;
    var abs = Math.abs(v);
    var str = abs % 1 === 0 ? abs.toLocaleString('he-IL')
                            : abs.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    var out = str + ' ₪';
    if (neg) out = '-' + out;
    if (opts && opts.plus && v > 0) out = '+' + out;
    return out;
  }

  function pct(n) { return Math.round(Calc.num(n)) + '%'; }

  var MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
                'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  var MONTHS_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני',
                      'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
  var DOW = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

  function dateShort(str) {
    var d = Calc.toDate(str);
    if (!d) return '';
    return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear();
  }
  function dateDayMonth(str) {
    var d = Calc.toDate(str);
    if (!d) return '';
    return d.getDate() + '.' + (d.getMonth() + 1);
  }
  function ageText(str) {
    var d = Calc.toDate(str);
    if (!d) return '';
    var now = new Date();
    var years = now.getFullYear() - d.getFullYear();
    var m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years--;
    return years >= 0 ? 'בן/בת ' + years : '';
  }
  function daysUntil(dateObj) {
    if (!dateObj) return null;
    var now = new Date();
    var a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((dateObj - a) / 86400000);
  }
  function relativeDays(dateObj) {
    var d = daysUntil(dateObj);
    if (d === null) return '';
    if (d === 0) return 'היום';
    if (d === 1) return 'מחר';
    if (d < 0) return 'עבר';
    if (d < 31) return 'בעוד ' + d + ' ימים';
    var months = Math.round(d / 30);
    return 'בעוד ' + months + ' חודשים';
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/);
    if (!parts[0]) return '👤';
    return parts.slice(0, 2).map(function (p) { return p[0]; }).join('');
  }

  /* פרצוף ידידותי לפי שם — יציב לאותו שם */
  var FACES = ['🧒', '👧', '👦', '🧒', '👶', '👧', '👦', '🧒'];
  function faceFor(name) {
    var s = String(name || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
    return FACES[h % FACES.length];
  }
  var TONES = ['pink', 'yellow', 'green', 'purple', 'blue', 'peach', 'mint'];
  function toneFor(name) {
    var s = String(name || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 17 + s.charCodeAt(i)) % 7919;
    return TONES[h % TONES.length];
  }
  function toneVar(tone) { return 'var(--' + (tone || 'purple') + ')'; }
  function toneInk(tone) { return 'var(--' + (tone || 'purple') + '-ink)'; }

  /* ---------- הודעות קצרות ---------- */
  function toast(msg) {
    var root = document.getElementById('toast-root');
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 260);
    }, 2100);
  }

  /* ---------- מודאל בסיסי ---------- */
  var openModals = 0;
  function modal(opts) {
    var back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML =
      '<div class="modal' + (opts.wide ? ' modal-wide' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="grab"></div>' +
        '<button type="button" class="modal-close" aria-label="סגירה ללא שמירה">✕</button>' +
        (opts.title ? '<h3>' + esc(opts.title) + '</h3>' : '') +
        (opts.subtitle ? '<div class="m-sub">' + esc(opts.subtitle) + '</div>' : '') +
        '<div class="m-body">' + (opts.body || '') + '</div>' +
      '</div>';
    document.getElementById('modal-root').appendChild(back);
    openModals++;
    document.body.style.overflow = 'hidden';

    function close() {
      /* המקלדת נסגרת לפני שהחלון נעלם. שדה שנמחק בעודו בפוקוס סוגר
         אותה בבת אחת, ו-iOS משאיר אז את מה שמוצמד לתחתית — התפריט —
         בגובה שבו הייתה המקלדת */
      var active = document.activeElement;
      if (active && back.contains(active) && active.blur) active.blur();
      back.remove();
      openModals = Math.max(0, openModals - 1);
      if (!openModals) document.body.style.overflow = '';
    }
    back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    // סגירה ללא שמירה — מה שהוקלד בטופס אינו נשמר
    var closeBtn = back.querySelector('.modal-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    });
    /* רענון תוכן החלון בלי לסגור ולפתוח — חלון פתוח אינו מושפע
       מציור מחדש של העמוד, כי הוא יושב מחוץ לאזור האפליקציה */
    function setBody(html) {
      var body = back.querySelector('.m-body');
      if (body) body.innerHTML = html;
    }
    function isOpen() { return document.body.contains(back); }

    if (opts.onMount) opts.onMount(back.querySelector('.m-body'), close);
    var firstInput = back.querySelector('input,select,textarea');
    if (firstInput && !('ontouchstart' in window)) setTimeout(function () { firstInput.focus(); }, 60);
    return { el: back, close: close, setBody: setBody, isOpen: isOpen };
  }

  /* ---------- מודאל טופס גנרי ---------- */
  /* fields: [{name,label,type,value,options,placeholder,required,hint,min,max,step,half}] */
  function fieldHTML(f) {
    var id = 'f-' + f.name;
    var val = f.value === null || f.value === undefined ? '' : f.value;
    var req = f.required ? ' required' : '';
    var ph = f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '';
    var html = '';

    if (f.type === 'html') {
      // בלוק תצוגה בלבד — משמש לשורות חישוב שמתעדכנות תוך כדי הקלדה
      return '<div class="field" id="f-' + esc(f.name) + '">' + (f.html || '') + '</div>';
    }

    if (f.type === 'select') {
      html = '<select class="input" id="' + id + '" name="' + esc(f.name) + '"' + req + '>' +
        (f.options || []).map(function (o) {
          var sel = String(o.value) === String(val) ? ' selected' : '';
          return '<option value="' + esc(o.value) + '"' + sel + '>' + esc(o.label) + '</option>';
        }).join('') + '</select>';
    } else if (f.type === 'multiselect') {
      html = '<div class="multi-select" data-multiselect="' + esc(f.name) + '">' +
        '<div class="multi-control"><div class="multi-tags"></div>' +
        '<button type="button" class="multi-toggle" id="' + id + '" aria-expanded="false" aria-controls="' + id + '-panel">' +
        '<span class="multi-placeholder">בחירת הורים…</span><span aria-hidden="true">▾</span></button></div>' +
        '<div class="multi-panel" id="' + id + '-panel" hidden>' +
        '<input class="input multi-search" type="search" placeholder="חיפוש הורה או ילד…" aria-label="חיפוש הורה או ילד">' +
        '<div class="multi-options" role="group" aria-label="' + esc(f.label) + '">' +
        (f.options || []).map(function (o) {
          return '<label class="multi-option"><span>' + esc(o.label) + '</span>' +
            '<input type="checkbox" value="' + esc(o.value) + '"' +
            (Array.isArray(val) && val.indexOf(o.value) > -1 ? ' checked' : '') + '></label>';
        }).join('') + '</div><p class="multi-empty muted small" hidden>לא נמצאו הורים</p></div></div>';
    } else if (f.type === 'textarea') {
      html = '<textarea class="input" id="' + id + '" name="' + esc(f.name) + '"' + ph + req + '>' + esc(val) + '</textarea>';
    } else if (f.type === 'checkbox') {
      return '<div class="field" id="field-' + esc(f.name) + '"><label class="flex" style="gap:8px;cursor:pointer">' +
        '<input type="checkbox" id="' + id + '" name="' + esc(f.name) + '"' + (val ? ' checked' : '') + '>' +
        '<span>' + esc(f.label) + '</span></label>' +
        (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '</div>';
    } else if (f.type === 'chips') {
      html = '<div class="chips" data-chips="' + esc(f.name) + '" data-multi="' + (f.multi ? '1' : '0') + '">' +
        (f.options || []).map(function (o) {
          var on = f.multi ? (Array.isArray(val) && val.indexOf(o.value) > -1) : String(o.value) === String(val);
          return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-chip="' + esc(o.value) + '">' +
            (o.icon ? o.icon + ' ' : '') + esc(o.label) + '</button>';
        }).join('') +
        '</div><input type="hidden" id="' + id + '" name="' + esc(f.name) + '" value="' +
        esc(f.multi ? (Array.isArray(val) ? val.join(',') : '') : val) + '">';
    } else {
      var extra = '';
      if (f.min !== undefined) extra += ' min="' + f.min + '"';
      if (f.max !== undefined) extra += ' max="' + f.max + '"';
      if (f.step !== undefined) extra += ' step="' + f.step + '"';
      if (f.type === 'number') extra += ' inputmode="decimal"';
      // רשימת הצעות לשדה טקסט חופשי — מציעה בלי להגביל
      var list = '';
      if (f.suggestions && f.suggestions.length) {
        var listId = id + '-list';
        extra += ' list="' + listId + '"';
        list = '<datalist id="' + listId + '">' +
          f.suggestions.map(function (o) { return '<option value="' + esc(o) + '"></option>'; }).join('') +
          '</datalist>';
      }
      html = '<input class="input" type="' + (f.type || 'text') + '" id="' + id + '" name="' + esc(f.name) + '" value="' + esc(val) + '"' + ph + req + extra + '>' + list;
    }

    return '<div class="field" id="field-' + esc(f.name) + '"' + (f.half ? ' style="margin-bottom:0"' : '') + '>' +
      '<label for="' + id + '">' + esc(f.label) + (f.required ? ' *' : '') + '</label>' +
      html +
      (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') +
      '</div>';
  }

  function formModal(opts) {
    var fields = opts.fields || [];
    var body = '<form class="js-form" novalidate>';
    var i = 0;
    while (i < fields.length) {
      var f = fields[i];
      if (f.half && fields[i + 1] && fields[i + 1].half) {
        body += '<div class="grid-2" style="margin-bottom:14px">' + fieldHTML(f) + fieldHTML(fields[i + 1]) + '</div>';
        i += 2;
      } else {
        body += fieldHTML(f);
        i++;
      }
    }
    body += '<div class="btn-row mt">' +
      (opts.onDelete ? '<button type="button" class="btn danger js-del">' +
        esc(opts.deleteLabel || 'מחיקה') + '</button>' : '') +
      '<button type="submit" class="btn">' + esc(opts.submitLabel || 'שמירה') + '</button>' +
      '</div></form>';

    var m = modal({
      title: opts.title, subtitle: opts.subtitle, body: body, wide: opts.wide,
      onMount: function (root, close) {
        var form = root.querySelector('.js-form');

        root.querySelectorAll('[data-multiselect]').forEach(function (box) {
          var toggle = box.querySelector('.multi-toggle');
          var panel = box.querySelector('.multi-panel');
          var search = box.querySelector('.multi-search');
          var tags = box.querySelector('.multi-tags');
          var checks = Array.prototype.slice.call(box.querySelectorAll('input[type="checkbox"]'));
          function setOpen(open) {
            panel.hidden = !open;
            toggle.setAttribute('aria-expanded', String(open));
            box.classList.toggle('is-open', open);
            /* במכשיר מגע המקלדת הייתה מכסה את הרשימה, ולכן החיפוש לא מקבל פוקוס אוטומטית. */
            if (open && !('ontouchstart' in window)) search.focus();
          }
          function refresh() {
            tags.innerHTML = '';
            checks.forEach(function (check) {
              check.closest('label').classList.toggle('is-selected', check.checked);
              if (!check.checked) return;
              var label = check.closest('label').querySelector('span').textContent;
              var tag = document.createElement('button');
              tag.type = 'button';
              tag.className = 'multi-tag';
              tag.setAttribute('aria-label', 'הסרת ' + label);
              tag.innerHTML = '<span>' + esc(label) + '</span><span class="multi-remove" aria-hidden="true">×</span>';
              tag.addEventListener('click', function () {
                check.checked = false;
                refresh();
                toggle.focus();
              });
              tags.appendChild(tag);
            });
            box.classList.toggle('has-selection', checks.some(function (c) { return c.checked; }));
          }
          toggle.addEventListener('click', function () { setOpen(panel.hidden); });
          checks.forEach(function (check) { check.addEventListener('change', refresh); });
          search.addEventListener('input', function () {
            var query = search.value.trim().toLocaleLowerCase();
            var visible = 0;
            checks.forEach(function (check) {
              var row = check.closest('label');
              row.hidden = row.textContent.toLocaleLowerCase().indexOf(query) === -1;
              if (!row.hidden) visible++;
            });
            box.querySelector('.multi-empty').hidden = visible > 0;
          });
          box.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !panel.hidden) {
              e.stopPropagation();
              setOpen(false);
              toggle.focus();
            }
            if (e.key === 'Enter' && e.target === search) e.preventDefault();
          });
          /* סגירה רק במעבר מקלדת אל מחוץ לתיבה. לחיצה על שורה ברשימה מאבדת את הפוקוס
             מהחיפוש בלי יעד (relatedTarget ריק), ובספארי גם תיבת הסימון עצמה אינה מקבלת פוקוס —
             סגירה במקרה הזה הסתירה את השורה לפני שהלחיצה הגיעה אליה. */
          box.addEventListener('focusout', function (e) {
            if (e.relatedTarget && !box.contains(e.relatedTarget)) setOpen(false);
          });
          root.closest('.modal-back').addEventListener('pointerdown', function (e) {
            if (!box.contains(e.target)) setOpen(false);
          });
          refresh();
        });

        // צ׳יפים לבחירה
        root.querySelectorAll('[data-chips]').forEach(function (box) {
          var name = box.getAttribute('data-chips');
          var multi = box.getAttribute('data-multi') === '1';
          var hidden = root.querySelector('#f-' + name);
          box.addEventListener('click', function (e) {
            var b = e.target.closest('[data-chip]');
            if (!b) return;
            if (multi) {
              b.classList.toggle('on');
              var vals = Array.prototype.slice.call(box.querySelectorAll('.chip.on'))
                .map(function (x) { return x.getAttribute('data-chip'); });
              hidden.value = vals.join(',');
            } else {
              box.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
              b.classList.add('on');
              hidden.value = b.getAttribute('data-chip');
            }
            if (opts.onChipChange) opts.onChipChange(name, hidden.value, root);
            if (opts.onFieldChange) opts.onFieldChange(name, hidden.value, root);
          });
        });

        if (opts.onFieldChange) {
          var notify = function (e) {
            var t = e.target;
            if (!t || !t.name) return;
            opts.onFieldChange(t.name, t.value, root);
          };
          form.addEventListener('input', notify);
          form.addEventListener('change', notify);
          opts.onFieldChange(null, null, root);   // ציור ראשוני
        }

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var values = {};
          fields.forEach(function (f) {
            if (f.type === 'html') return;
            var input = root.querySelector('#f-' + f.name);
            if (!input) return;
            if (f.type === 'multiselect') {
              values[f.name] = Array.prototype.slice.call(input.closest('[data-multiselect]').querySelectorAll('input[type="checkbox"]:checked'))
                .map(function (check) { return check.value; });
            } else if (f.type === 'checkbox') values[f.name] = input.checked;
            else if (f.type === 'number') values[f.name] = input.value === '' ? '' : Calc.num(input.value);
            else if (f.type === 'chips' && f.multi) values[f.name] = input.value ? input.value.split(',') : [];
            else values[f.name] = input.value.trim ? input.value.trim() : input.value;
          });
          var missing = fields.filter(function (f) {
            return f.required && (values[f.name] === '' || values[f.name] === null || values[f.name] === undefined ||
              (Array.isArray(values[f.name]) && !values[f.name].length));
          });
          if (missing.length) { toast('נא למלא: ' + missing[0].label); return; }
          if (opts.onSubmit(values, close) !== false) close();
        });

        /* תיבת הערות מתאימה את גובהה לתוכן, כדי שהערה ארוכה
           (למשל פירוט שורות של רעיון) תיקרא בלי גלילה פנימית */
        Array.prototype.forEach.call(root.querySelectorAll('textarea.input'), function (ta) {
          function fit() {
            ta.style.height = 'auto';
            ta.style.height = Math.min(300, Math.max(78, ta.scrollHeight + 2)) + 'px';
          }
          ta.addEventListener('input', fit);
          fit();
        });

        if (opts.onMount) opts.onMount(root, close);

        var del = root.querySelector('.js-del');
        if (del) del.addEventListener('click', function () {
          confirmBox('למחוק?', opts.deleteText || 'הפריט יימחק לצמיתות.', function () {
            opts.onDelete();
            close();
          });
        });
      }
    });
    return m;
  }

  /* ---------- תיבת אישור ---------- */
  /* okLabel — לאישורים שאינם מחיקה. בלעדיו הכפתור האדום היה אומר
     "מחיקה" גם על שאלה כמו "להתנתק?", ומבטיח משהו שלא עומד לקרות. */
  function confirmBox(title, text, onYes, okLabel) {
    var danger = !okLabel;
    modal({
      title: title,
      subtitle: text,
      body: '<div class="btn-row mt"><button class="btn ghost js-no">ביטול</button>' +
        '<button class="btn js-yes' + (danger ? ' danger' : '') + '"' +
        (danger ? ' style="background:var(--danger);color:#fff;border:none"' : '') + '>' +
        esc(okLabel || 'מחיקה') + '</button></div>',
      onMount: function (root, close) {
        root.querySelector('.js-no').addEventListener('click', close);
        root.querySelector('.js-yes').addEventListener('click', function () { onYes(); close(); });
      }
    });
  }

  /* ---------- רכיבי תצוגה ---------- */
  function pageHead(o) {
    return '<header class="pagehead" style="--tint:' + toneVar(o.tone) + '">' +
      (o.back ? '<button class="back" data-action="nav" data-view="' + esc(o.back) + '" aria-label="חזרה">→</button>' : '') +
      (o.action ? '<button class="head-action' + (o.action.text ? ' wide' : '') + '" data-action="' + esc(o.action.act) + '" ' +
        'aria-label="' + esc(o.action.label) + '">' + o.action.icon +
        (o.action.text ? '<span>' + esc(o.action.text) + '</span>' : '') + '</button>' : '') +
      (o.art ? '<div class="ph-icon has-art">' + art(o.art) + '</div>'
             : o.icon ? '<div class="ph-icon">' + o.icon + '</div>' : '') +
      '<h1>' + esc(o.title) + '</h1>' +
      (o.subtitle ? '<p>' + esc(o.subtitle) + '</p>' : '') +
      '</header>';
  }

  /* ---------- איורים ---------- */
  /* ארבעה איורים קבועים לעמוד ההוצאות. הצבע מגיע מ-currentColor,
     כך שאותו איור משרת כרטיס ורוד, סגול או צהוב בלי כפילות. */
  var ICONS = {
    wallet:
      '<rect x="3" y="7.5" width="26" height="19" rx="6" fill="currentColor" opacity=".16"/>' +
      '<rect x="3" y="7.5" width="26" height="19" rx="6" stroke="currentColor" stroke-width="2.2"/>' +
      '<path d="M3 13.2h26" stroke="currentColor" stroke-width="2.2" opacity=".45"/>' +
      '<path d="M29 17h-4.6a2.9 2.9 0 0 0 0 5.8H29" fill="#fff"/>' +
      '<path d="M29 17h-4.6a2.9 2.9 0 0 0 0 5.8H29" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<circle cx="25.6" cy="19.9" r="1.5" fill="currentColor"/>',
    children:
      '<circle cx="6.6" cy="12.6" r="3.5" fill="currentColor" opacity=".55"/>' +
      '<circle cx="25.4" cy="12.6" r="3.5" fill="currentColor" opacity=".55"/>' +
      '<circle cx="16" cy="17.2" r="8.6" fill="currentColor" opacity=".16"/>' +
      '<circle cx="16" cy="17.2" r="8.6" stroke="currentColor" stroke-width="2.2"/>' +
      '<path d="M8.4 14.9c2-2.7 4.6-4.1 7.6-4.1s5.6 1.4 7.6 4.1" ' +
        'stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="13" cy="18" r="1.3" fill="currentColor"/>' +
      '<circle cx="19" cy="18" r="1.3" fill="currentColor"/>' +
      '<path d="M13.8 21.3c1.3 1.2 3.1 1.2 4.4 0" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    staff:
      '<circle cx="16" cy="12" r="5.2" fill="currentColor" opacity=".16"/>' +
      '<circle cx="16" cy="12" r="5.2" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M6.5 26.5c0-4.7 4.3-8.5 9.5-8.5s9.5 3.8 9.5 8.5" fill="currentColor" opacity=".16"/>' +
      '<path d="M6.5 26.5c0-4.7 4.3-8.5 9.5-8.5s9.5 3.8 9.5 8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    general:
      '<circle cx="11.8" cy="13.4" r="3.9" fill="currentColor" opacity=".3"/>' +
      '<circle cx="20.2" cy="13.4" r="3.9" fill="currentColor" opacity=".3"/>' +
      '<circle cx="16" cy="10.9" r="4.4" fill="currentColor" opacity=".3"/>' +
      '<path d="M9.4 17h13.2l-1.4 8a2.4 2.4 0 0 1-2.4 2h-5.6a2.4 2.4 0 0 1-2.4-2L9.4 17Z" ' +
        'fill="currentColor" opacity=".16"/>' +
      '<path d="M9.4 17h13.2l-1.4 8a2.4 2.4 0 0 1-2.4 2h-5.6a2.4 2.4 0 0 1-2.4-2L9.4 17Z" ' +
        'stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M13.6 19.2l-.4 5.4M18.4 19.2l.4 5.4" ' +
        'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>' +
      '<path d="M9.4 17a3.9 3.9 0 0 1 2.3-6.6 4.7 4.7 0 0 1 8.6 0A3.9 3.9 0 0 1 22.6 17" ' +
        'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="16" cy="6.2" r="1.7" fill="currentColor"/>',
    /* ייבוא: חץ עולה מתוך מגש, ומסמך עם חץ עולה */
    upload:
      '<path d="M16 21V7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M10.5 12.5 16 7l5.5 5.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M6 19v4.5A2.5 2.5 0 0 0 8.5 26h15a2.5 2.5 0 0 0 2.5-2.5V19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    'file-up':
      '<path d="M8 4.5h11l6 6V26a2.5 2.5 0 0 1-2.5 2.5h-14A2.5 2.5 0 0 1 6 26V7A2.5 2.5 0 0 1 8.5 4.5Z" fill="currentColor" opacity=".14"/>' +
      '<path d="M8.5 4.5h10.5l6 6V26a2.5 2.5 0 0 1-2.5 2.5h-14A2.5 2.5 0 0 1 6 26V7a2.5 2.5 0 0 1 2.5-2.5Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M19 4.5v6h6" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M11 15.5h6M11 19.5h9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>' +
      '<circle cx="23" cy="22" r="5.5" fill="#fff" stroke="currentColor" stroke-width="2.2"/>' +
      '<path d="M23 25v-6M20.6 21.4 23 19l2.4 2.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    chevron:
      '<path d="M19 9l-7 7 7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    plus:
      '<path d="M16 8.5v15M8.5 16h15" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    /* כפתור השיתוף של אייפון ומק — הריבוע עם החץ כלפי מעלה */
    share:
      '<path d="M16 4.5v15" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M11 9.5L16 4.5l5 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M9.5 13H8a2.5 2.5 0 0 0-2.5 2.5V25A2.5 2.5 0 0 0 8 27.5h16a2.5 2.5 0 0 0 2.5-2.5v-9.5A2.5 2.5 0 0 0 24 13h-1.5" ' +
        'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    /* תפריט שלוש הנקודות של כרום ואדג׳ */
    dots:
      '<circle cx="16" cy="7.5" r="2.4" fill="currentColor"/>' +
      '<circle cx="16" cy="16" r="2.4" fill="currentColor"/>' +
      '<circle cx="16" cy="24.5" r="2.4" fill="currentColor"/>'
  };

  /* איורי האפליקציה — אותם שמונה איורים של אריחי הבית, בכל מקום שמייצג
     את אותו אזור. הגודל נקבע ב-CSS לפי ההקשר (ניווט, כותרת, מצב ריק). */
  var ARTS = ['budget', 'collection', 'expenses', 'ideas', 'children', 'staff', 'dates', 'yearend', 'piggy', 'home'];

  function art(name) {
    if (ARTS.indexOf(name) < 0) return '';
    return '<img class="art" src="assets/icons/' + name + '.webp" alt="" ' +
      'width="176" height="176" decoding="async">';
  }

  /* איורי הקטגוריות. איור מוצג רק כשהקטגוריה עדיין עם האמוג׳י המקורי שלה —
     מי ששינה אמוג׳י בטופס רואה את הבחירה שלו. */
  var CAT_ART = {
    'cat-bday': '🎁', 'cat-holiday': '🎊', 'cat-yearend': '🎓', 'cat-clubs': '🎨', 'cat-food': '🧁',
    'cat-events': '🎪', 'cat-gear': '🔧', 'cat-other': '💗'
  };

  function catIcon(cat) {
    if (!cat) return '';
    if (CAT_ART[cat.id] && CAT_ART[cat.id] === cat.icon) {
      return '<img class="art cat-art" src="assets/icons/' + cat.id + '.webp" alt="" ' +
        'width="176" height="176" decoding="async">';
    }
    return cat.icon || '';
  }

  function svgIcon(name, size) {
    var d = ICONS[name];
    if (!d) return '';
    var px = size || 32;
    return '<svg class="svg-ico" viewBox="0 0 32 32" width="' + px + '" height="' + px + '" ' +
      'fill="none" aria-hidden="true" focusable="false">' + d + '</svg>';
  }

  /* ---------- כפתור ההוספה ----------
     פקד אחד לכל מסך: אותו מראה, אותו מקום, אותה אנטומיה — התווית
     ולצידה סימן החיבור, מופרד בקו. עד כה כל מסך הרכיב אותו בעצמו
     (btn, btn ghost, btn sm) והדביק את ה-"+" לתוך הטקסט, ולכן אותה
     פעולה נראתה אחרת בכל עמוד.
     o: { act, label, cls, data } — data הוא מפת data-* נוספים לפעולה. */
  function addBtn(o) {
    o = o || {};
    var data = o.data || {};
    var attrs = Object.keys(data).map(function (k) {
      return ' data-' + k + '="' + esc(data[k]) + '"';
    }).join('');
    return '<button class="btn add-btn' + (o.cls ? ' ' + o.cls : '') + '"' +
      ' data-action="' + esc(o.act) + '"' + attrs +
      ' aria-label="' + esc(o.label) + '">' +
      '<span class="ab-label">' + esc(o.label) + '</span>' +
      '<span class="ab-plus" aria-hidden="true">+</span>' +
      '</button>';
  }

  function empty(o) {
    return '<div class="empty">' +
      '<div class="e-ico">' + (o.art ? art(o.art) : (o.icon || '🌱')) + '</div>' +
      '<b>' + esc(o.title) + '</b>' +
      '<p>' + esc(o.text || '') + '</p>' +
      (o.action ? '<button class="btn auto" data-action="' + esc(o.action.act) + '">' + esc(o.action.label) + '</button>' : '') +
      '</div>';
  }

  function bar(value, total, cls) {
    var p = total > 0 ? Math.min(100, (value / total) * 100) : 0;
    return '<div class="bar ' + (cls || '') + '"><i style="width:' + p.toFixed(1) + '%"></i></div>';
  }

  /* טבעת התקדמות (דונאט) מ-conic-gradient לפי פילוח */
  function donut(segments, centerTop, centerBottom) {
    var total = segments.reduce(function (s, x) { return s + Math.max(0, x.value); }, 0);
    var acc = 0, stops = [];
    if (total <= 0) {
      stops.push('#EFEAF3 0turn 1turn');
    } else {
      segments.forEach(function (sg) {
        var start = acc / total;
        acc += Math.max(0, sg.value);
        var end = acc / total;
        stops.push(sg.color + ' ' + start.toFixed(4) + 'turn ' + end.toFixed(4) + 'turn');
      });
    }
    return '<div class="donut" style="background:conic-gradient(' + stops.join(',') + ');border-radius:50%">' +
      '<div class="hole"><b>' + esc(centerTop || '') + '</b><small>' + esc(centerBottom || '') + '</small></div></div>';
  }

  var TONE_HEX = {
    pink: '#F0A0B8', yellow: '#EDCB78', green: '#8FCBA2', purple: '#B2A2ED',
    blue: '#8FB4E4', peach: '#EDA57C', mint: '#7FC7C0'
  };
  function toneHex(t) { return TONE_HEX[t] || '#B2A2ED'; }

  /* אותם צבעים כערכים ממשיים — הקנבס אינו מבין var(--x) */
  var TONE_SOFT = {
    pink: '#FADCE5', yellow: '#FCEDC8', green: '#D8EFDD', purple: '#E6DDF9',
    blue: '#DBE7F8', peach: '#FCE1D2', mint: '#D5EFEC', orange: '#FBE1CB'
  };
  var TONE_INK = {
    pink: '#C9718F', yellow: '#C79A3B', green: '#5D9E72', purple: '#8B79CE',
    blue: '#5B87C2', peach: '#CE7F55', mint: '#4E9E97', orange: '#D97F2E'
  };
  function toneSoftHex(t) { return TONE_SOFT[t] || TONE_SOFT.purple; }
  function toneInkHex(t) { return TONE_INK[t] || TONE_INK.purple; }

  /* ---------- שיתוף בוואטסאפ ---------- */
  function whatsapp(text, phone) {
    var base = phone ? 'https://wa.me/' + normalizePhone(phone) : 'https://wa.me/';
    var url = base + '?text=' + encodeURIComponent(text);
    window.open(url, '_blank', 'noopener');
  }
  function normalizePhone(p) {
    var digits = String(p || '').replace(/\D/g, '');
    if (digits.indexOf('972') === 0) return digits;
    if (digits.indexOf('0') === 0) return '972' + digits.slice(1);
    return digits;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('הועתק ✓'); },
        function () { toast('ההעתקה נכשלה'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('הועתק ✓'); } catch (e) { toast('ההעתקה נכשלה'); }
      ta.remove();
    }
  }

  return {
    esc: esc, money: money, pct: pct, MONTHS: MONTHS, MONTHS_SHORT: MONTHS_SHORT, DOW: DOW,
    dateShort: dateShort, dateDayMonth: dateDayMonth, ageText: ageText,
    daysUntil: daysUntil, relativeDays: relativeDays, todayISO: todayISO,
    initials: initials, faceFor: faceFor, toneFor: toneFor,
    toneVar: toneVar, toneInk: toneInk, toneHex: toneHex,
    toneSoftHex: toneSoftHex, toneInkHex: toneInkHex,
    toast: toast, modal: modal, formModal: formModal, confirmBox: confirmBox,
    addBtn: addBtn,
    pageHead: pageHead, empty: empty, bar: bar, donut: donut, svgIcon: svgIcon, art: art, catIcon: catIcon,
    whatsapp: whatsapp, normalizePhone: normalizePhone, copyText: copyText
  };
})();
