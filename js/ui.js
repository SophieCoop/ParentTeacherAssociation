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

  function money(n, opts) {
    var v = Calc.num(n);
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
      '<div class="modal" role="dialog" aria-modal="true">' +
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
      (opts.onDelete ? '<button type="button" class="btn danger js-del">מחיקה</button>' : '') +
      '<button type="submit" class="btn">' + esc(opts.submitLabel || 'שמירה') + '</button>' +
      '</div></form>';

    var m = modal({
      title: opts.title, subtitle: opts.subtitle, body: body,
      onMount: function (root, close) {
        var form = root.querySelector('.js-form');

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
            if (f.type === 'checkbox') values[f.name] = input.checked;
            else if (f.type === 'number') values[f.name] = input.value === '' ? '' : Calc.num(input.value);
            else if (f.type === 'chips' && f.multi) values[f.name] = input.value ? input.value.split(',') : [];
            else values[f.name] = input.value.trim ? input.value.trim() : input.value;
          });
          var missing = fields.filter(function (f) {
            return f.required && (values[f.name] === '' || values[f.name] === null || values[f.name] === undefined);
          });
          if (missing.length) { toast('נא למלא: ' + missing[0].label); return; }
          if (opts.onSubmit(values, close) !== false) close();
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
  function confirmBox(title, text, onYes) {
    modal({
      title: title,
      subtitle: text,
      body: '<div class="btn-row mt"><button class="btn ghost js-no">ביטול</button><button class="btn danger js-yes" style="background:var(--danger);color:#fff;border:none">מחיקה</button></div>',
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
      (o.action ? '<button class="head-action" data-action="' + esc(o.action.act) + '" aria-label="' + esc(o.action.label) + '">' + o.action.icon + '</button>' : '') +
      (o.icon ? '<div class="ph-icon">' + o.icon + '</div>' : '') +
      '<h1>' + esc(o.title) + '</h1>' +
      (o.subtitle ? '<p>' + esc(o.subtitle) + '</p>' : '') +
      '</header>';
  }

  function empty(o) {
    return '<div class="empty">' +
      '<div class="e-ico">' + (o.icon || '🌱') + '</div>' +
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
    esc: esc, money: money, pct: pct, MONTHS: MONTHS, DOW: DOW,
    dateShort: dateShort, dateDayMonth: dateDayMonth, ageText: ageText,
    daysUntil: daysUntil, relativeDays: relativeDays, todayISO: todayISO,
    initials: initials, faceFor: faceFor, toneFor: toneFor,
    toneVar: toneVar, toneInk: toneInk, toneHex: toneHex,
    toneSoftHex: toneSoftHex, toneInkHex: toneInkHex,
    toast: toast, modal: modal, formModal: formModal, confirmBox: confirmBox,
    pageHead: pageHead, empty: empty, bar: bar, donut: donut,
    whatsapp: whatsapp, normalizePhone: normalizePhone, copyText: copyText
  };
})();
