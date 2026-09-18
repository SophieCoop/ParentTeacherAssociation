/* ============================================================
   גבייה מההורים — כמה כל הורה שילם, באיזה אמצעי, וכמה נשאר
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.collection = (function () {

  function statusBadge(r) {
    if (r.over) return '<span class="badge over">שולם ביתר</span>';
    if (r.due <= 0) return '<span class="badge neutral">אין חיוב</span>';
    if (r.status === 'full') return '<span class="badge ok">שולם במלואו</span>';
    if (r.status === 'partial') return '<span class="badge warn">חלקי</span>';
    return '<span class="badge no">טרם שולם</span>';
  }

  /* ---------- לשונית: רשימת ההורים ---------- */
  function tabList() {
    var st = Store.state;
    var sum = Calc.collectionSummary(st);
    var q = (App.vs('colQuery', '') || '').trim();
    var rows = sum.rows;
    if (q) {
      rows = rows.filter(function (r) {
        var names = [r.child.name].concat((r.child.parents || []).map(function (p) { return p.name; })).join(' ');
        return names.indexOf(q) > -1;
      });
    }

    var html = '<div class="summary">' +
      '<div class="sum-top"><div>' +
        '<div class="sum-label">נגבה עד כה</div>' +
        '<div class="sum-value">' + UI.money(sum.paid) + '</div>' +
        '<div class="small muted">מתוך ' + UI.money(sum.due) + ' שצריך לגבות</div>' +
      '</div><div class="end"><div class="sum-value" style="font-size:20px">' + sum.pct + '%</div></div></div>' +
      UI.bar(sum.paid, sum.due, sum.pct >= 100 ? 'ok' : '') +
      '<div class="stat-grid">' +
        '<div class="stat"><div class="s-val pos">' + sum.fullCount + '</div><div class="s-lab">שילמו מלא</div></div>' +
        '<div class="stat"><div class="s-val" style="color:var(--warn)">' + sum.partialCount + '</div><div class="s-lab">חלקי</div></div>' +
        '<div class="stat"><div class="s-val neg">' + sum.noneCount + '</div><div class="s-lab">טרם שילמו</div></div>' +
      '</div>' +
      (sum.overCount
        ? '<div class="flex-between small mt"><span class="over-paid">⚠️ ' + sum.overCount +
          (sum.overCount === 1 ? ' הורה שילם' : ' הורים שילמו') + ' מעבר למכסה</span>' +
          '<b class="over-paid">עודף ' + UI.money(sum.overTotal) + '</b></div>'
        : '') +
      '</div>';

    html += '<div class="field"><input class="input" placeholder="🔍 חיפוש הורה או ילד…" ' +
      'data-input="col-search" value="' + UI.esc(q) + '"></div>';

    if (!st.children.length) {
      return html + UI.empty({ art: 'children', title: 'אין ילדים ברשימה', text: 'הוסיפו את ילדי הגן כדי להתחיל בגבייה.', action: { act: 'nav-children', label: 'לרשימת הילדים' } });
    }

    html += rows.map(function (r) {
      var c = r.child;
      var parent = (c.parents && c.parents[0]) ? c.parents[0].name : 'הורה';
      return '<div class="row" data-action="col-open" data-id="' + c.id + '">' +
        '<div class="avatar" style="background:' + UI.toneVar(UI.toneFor(c.name)) + '">' + UI.faceFor(c.name) + '</div>' +
        '<div class="r-body">' +
          '<div class="r-name">' + UI.esc(parent) + '</div>' +
          '<div class="r-sub">' + UI.esc(c.name) + ' · ' +
            (r.over ? '<b class="over-paid">' + UI.money(r.paid) + '</b>' : UI.money(r.paid)) +
            ' מתוך ' + UI.money(r.due) +
            (r.percent < 100 ? ' · ' + r.percent + '%' : '') + '</div>' +
          UI.bar(r.paid, r.due, r.status === 'full' ? 'ok' : 'thin') +
        '</div>' +
        '<div class="r-end">' + statusBadge(r) +
        '<div class="r-pct" style="margin-top:4px">' +
          (r.over ? '<span class="over-paid">עודף ' + UI.money(r.overAmount) + '</span>'
                  : (r.remaining > 0 ? 'נותר ' + UI.money(r.remaining) : '✓')) + '</div></div>' +
        '</div>';
    }).join('');

    html += '<div class="row" style="background:var(--green);box-shadow:none;margin-top:14px">' +
      '<div class="r-ico has-art" style="background:#fff">' + UI.art('collection') + '</div>' +
      '<div class="r-body"><div class="r-name">סיכום גבייה</div>' +
      '<div class="r-sub" style="opacity:.75">' + st.children.length + ' ילדים</div></div>' +
      '<div class="r-end"><div class="r-amount">' + UI.money(sum.paid) + '</div>' +
      '<div class="r-pct">נותר ' + UI.money(sum.remaining) + '</div></div></div>';

    return html;
  }

  /* ---------- לשונית: יומן תשלומים ---------- */
  function tabPayments() {
    var st = Store.state;
    var pays = st.payments.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });

    var html = '';

    if (!pays.length) {
      return html + UI.empty({ art: 'collection', title: 'עוד לא נרשמו תשלומים', text: 'כל תשלום שנרשם מתעדכן מיד במצב הגבייה.' });
    }

    html += pays.map(function (p) {
      var c = Store.find('children', p.childId);
      var parent = c && c.parents && c.parents[0] ? c.parents[0].name : (c ? c.name : 'לא ידוע');
      return '<div class="row" data-action="pay-edit" data-id="' + p.id + '">' +
        '<div class="r-ico" style="background:var(--blue)">' + Store.methodIcon(p.method) + '</div>' +
        '<div class="r-body"><div class="r-name">' + UI.esc(parent) + '</div>' +
        '<div class="r-sub">' + UI.esc(Store.methodName(p.method)) + ' · ' + UI.dateShort(p.date) +
        (p.installments > 1 ? ' · ' + p.installments + ' תשלומים' : '') +
        (p.note ? ' · 📝 ' + UI.esc(p.note) : '') + '</div></div>' +
        '<div class="r-end"><div class="r-amount">' + UI.money(p.amount) + '</div></div></div>';
    }).join('');

    return html;
  }

  /* ---------- לשונית: חישוב ופילוח ---------- */
  function tabCalc() {
    var st = Store.state;
    var sum = Calc.collectionSummary(st);
    var methods = Calc.byMethod(st);
    var perFull = Calc.fullChildShare(st);
    var used = Store.PAY_METHODS.filter(function (m) { return methods[m.id]; });

    /* התקציב המתוכנן וסך הגבייה הם אותו כסף משני כיוונים, ולכן
       אין טעם להציג שני מספרים זהים. החיוב של כל ילד מעוגל לשקל שלם,
       ולכן פער של עד חצי שקל לילד הוא רעש של עיגול. רק פער גדול מזה
       הוא מידע — ואז מוצגת השורה יחד עם הסבר מאיפה הוא נובע. */
    var budget = Calc.budgetTotal(st);
    var gap = Calc.round2(sum.due - budget);
    var slack = (st.children.length || 0) * 0.5 + 0.5;
    var showGap = Math.abs(gap) > slack;

    var html = '<div class="card">' +
      '<div class="card-title"><h2>איך מחושב הסכום לכל הורה?</h2></div>' +
      '<table class="tbl slim"><tbody>' +
        row('סה״כ תקציב מתוכנן', UI.money(budget)) +
        row('ילד שהיה כל השנה משלם', '<b>' + UI.money(perFull) + '</b>') +
        (showGap ? row('סה״כ לגבייה', UI.money(sum.due)) : '') +
        row('נגבה בפועל', '<span class="pos">' + UI.money(sum.paid) + '</span>') +
        row('נותר לגבייה', '<span class="' + (sum.remaining > 0 ? 'neg' : 'pos') + '">' + UI.money(sum.remaining) + '</span>') +
      '</tbody></table>' +
      (showGap ? gapNote(st, gap) : '') +
      '</div>';

    html += '<div class="card">' +
      '<div class="card-title"><h2>פילוח לפי אמצעי תשלום</h2></div>' +
      (used.length ?
        '<div class="flex" style="gap:16px">' +
          UI.donut(used.map(function (m, i) {
            return { value: methods[m.id], color: UI.toneHex(['pink', 'blue', 'purple', 'green', 'yellow'][i % 5]) };
          }), UI.money(sum.paid).replace(' ₪', ''), '₪ נגבו') +
          '<div style="flex:1">' + used.map(function (m, i) {
            var color = UI.toneHex(['pink', 'blue', 'purple', 'green', 'yellow'][i % 5]);
            return '<div class="flex-between small" style="margin-bottom:6px">' +
              '<span class="flex" style="gap:6px"><i style="width:10px;height:10px;border-radius:4px;background:' + color + ';display:inline-block"></i>' +
              m.icon + ' ' + m.name + '</span><b>' + UI.money(methods[m.id]) + '</b></div>';
          }).join('') + '</div>' +
        '</div>'
        : '<p class="muted small mb0">עוד לא נרשמו תשלומים.</p>') +
      '</div>';

    /* מחשבון פריסה לתשלומים.
       הסכום עוקב אחרי הסכום לילד במימון מלא, אלא אם המשתמש הקליד סכום משלו. */
    var live = Math.round(perFull);
    var edited = App.vs('instEdited', false);
    var calcAmount = edited ? Calc.num(App.vs('instAmount', live)) : live;
    var calcCount = Math.max(1, Calc.num(App.vs('instCount', 3)) || 1);

    html += '<div class="card">' +
      '<div class="card-title"><h2>מחשבון פריסה לתשלומים</h2>' +
        '<button class="btn sm soft" id="inst-reset" data-action="inst-reset"' +
          (edited && calcAmount !== live ? '' : ' style="display:none"') + '>עדכון ל-' + UI.money(live) + '</button>' +
      '</div>' +
      '<div class="grid-2">' +
        '<div class="field mb0"><label>סכום כולל (₪)</label>' +
          '<input class="input" type="number" id="inst-amount" data-input="inst-amount" value="' + calcAmount + '"></div>' +
        '<div class="field mb0"><label>מספר תשלומים</label>' +
          '<input class="input" type="number" min="1" max="12" id="inst-count" data-input="inst-count" value="' + calcCount + '"></div>' +
      '</div>' +
      '<div id="inst-result">' + instResult(calcAmount, calcCount) + '</div>' +
      (edited ? '' : '<div class="hint">הסכום מתעדכן אוטומטית לפי הסכום לילד במימון מלא</div>') +
      '</div>';

    /* ילדים בחישוב יחסי */
    var partials = sum.rows.filter(function (r) { return r.percent < 100; });
    html += '<div class="section-title"><span>ילדים בחישוב יחסי</span></div>';
    if (!partials.length) {
      html += '<div class="note"><div class="n-ico">✅</div><div><b>כל הילדים משלמים מלא</b>' +
        'ילד שיצטרף באמצע השנה לא יחויב על סעיפים שכבר היו לפני שהגיע, ' +
        'ויחויב במחיר מלא על כל מה שאחריהם.</div></div>';
    } else {
      html += partials.map(function (r) {
        return '<div class="row"><div class="avatar" style="background:' + UI.toneVar(UI.toneFor(r.child.name)) + '">' + UI.faceFor(r.child.name) + '</div>' +
          '<div class="r-body"><div class="r-name">' + UI.esc(r.child.name) + '</div>' +
          '<div class="r-sub">הצטרף/ה ' + (r.child.joinDate ? UI.dateShort(r.child.joinDate) : '—') + '</div></div>' +
          '<div class="r-end"><div class="r-amount">' + UI.money(r.due) + '</div>' +
          '<div class="r-pct">' + r.percent + '% מהסכום המלא</div></div></div>';
      }).join('');
    }

    return html;
  }

  function instResult(amount, count) {
    var per = Math.round((amount / Math.max(1, count)) * 100) / 100;
    return '<div class="row mt" style="background:var(--primary-soft);box-shadow:none;margin-bottom:0">' +
      '<div class="r-ico has-art" style="background:#fff">' + UI.art('dates') + '</div>' +
      '<div class="r-body"><div class="r-name">' + UI.money(per) + ' לתשלום</div>' +
      '<div class="r-sub">' + count + ' תשלומים חודשיים · סה״כ ' + UI.money(amount) + '</div></div>' +
      '</div>';
  }

  /* עדכון התוצאה במקום — ציור מחדש של כל העמוד היה גוזל את המיקוד תוך כדי הקלדה */
  function refreshInstResult() {
    var a = document.getElementById('inst-amount');
    var c = document.getElementById('inst-count');
    var box = document.getElementById('inst-result');
    if (!a || !c || !box) return;
    var amount = Calc.num(a.value);
    box.innerHTML = instResult(amount, Math.max(1, Calc.num(c.value) || 1));

    var live = Math.round(Calc.fullChildShare(Store.state));
    var reset = document.getElementById('inst-reset');
    if (reset) {
      reset.textContent = 'עדכון ל-' + UI.money(live);
      reset.style.display = (amount !== live) ? '' : 'none';
    }
  }

  /* מאיפה נובע הפער בין התקציב המתוכנן לסך הגבייה */
  function gapNote(st, gap) {
    var manual = (st.children || []).filter(Calc.hasOverride);
    var short = gap < 0;
    var why;
    if (!(st.children || []).length) {
      why = 'עדיין לא נוספו ילדים, ולכן אין בין מי לחלק את התקציב.';
    } else if (manual.length) {
      why = 'אצל ' + (manual.length === 1 ? 'ילד אחד' : manual.length + ' ילדים') +
        ' נקבע אחוז השתתפות ידנית, במקום החישוב לפי תאריך ההצטרפות: ' +
        manual.map(function (c) { return UI.esc(c.name); }).join(', ') + '.';
    } else {
      why = 'כדאי לעבור על תאריכי סעיפי התקציב ועל תאריכי ההצטרפות של הילדים.';
    }
    return '<div class="note mt" style="background:var(--orange)"><div class="n-ico">⚠️</div><div>' +
      '<b>' + (short ? 'הגבייה נמוכה מהתקציב ב-' : 'הגבייה גבוהה מהתקציב ב-') +
        UI.money(Math.abs(gap)) + '</b>' + why +
      (short ? ' ההפרש אינו מכוסה בגבייה וצריך לבוא ממקור אחר.' : '') +
      '</div></div>';
  }

  function row(label, value) {
    return '<tr><td>' + UI.esc(label) + '</td><td class="end">' + value + '</td></tr>';
  }

  /* ---------- כרטיס הורה ---------- */

  var openCard = null;   // הכרטיס הפתוח, כדי לרענן אותו אחרי שינוי

  function childCardBody(childId) {
    var c = Store.find('children', childId);
    if (!c) return '';
    var r = Calc.childCollection(Store.state, c);
    var parent = c.parents && c.parents[0] ? c.parents[0] : { name: c.name, phone: '' };

    var body = '<div class="row" style="background:' + UI.toneVar(UI.toneFor(c.name)) + ';box-shadow:none">' +
        '<div class="avatar" style="background:#fff">' + UI.faceFor(c.name) + '</div>' +
        '<div class="r-body"><div class="r-name">' + UI.esc(parent.name) + '</div>' +
        '<div class="r-sub">הורה של ' + UI.esc(c.name) + (r.percent < 100 ? ' · ' + r.percent + '%' : '') + '</div></div>' +
      '</div>' +
      '<div class="stat-grid" style="margin-bottom:14px">' +
        '<div class="stat"><div class="s-val">' + UI.money(r.due) + '</div><div class="s-lab">לתשלום</div></div>' +
        '<div class="stat"><div class="s-val ' + (r.over ? 'over-paid' : 'pos') + '">' + UI.money(r.paid) + '</div><div class="s-lab">שולם</div></div>' +
        '<div class="stat"><div class="s-val ' + (r.remaining > 0 ? 'neg' : 'pos') + '">' + UI.money(Math.max(0, r.remaining)) + '</div><div class="s-lab">נותר</div></div>' +
      '</div>';

    if (r.over) {
      body += '<div class="note" style="background:var(--orange)"><div class="n-ico">⚠️</div><div>' +
        '<b>הסכום ששולם עבר את המכסה</b>' +
        'המכסה היא ' + UI.money(r.due) + ' ושולמו ' + UI.money(r.paid) +
        ' — עודף של ' + UI.money(r.overAmount) + '. העודף יוחזר בחישוב סוף השנה.' +
        '</div></div>';
    }

    if (r.installments > 1) {
      var line;
      if (r.remaining <= 0.5) {
        line = 'הפריסה הושלמה — שולמו ' + r.paidCount + ' תשלומים, אין יתרה.';
      } else if (r.installmentsLeft > 0) {
        line = 'שולמו ' + r.paidCount + ' מתוך ' + r.installments + ' · נותרו ' +
          UI.money(r.remaining) + ', כלומר <b>' + UI.money(r.nextInstallment) + '</b> בכל אחד מ-' +
          r.installmentsLeft + ' התשלומים הבאים.';
      } else {
        line = 'כל ' + r.installments + ' התשלומים בוצעו, ועדיין נותרו <b>' +
          UI.money(r.remaining) + '</b> להשלמה.';
      }
      body += '<div class="note"><div class="n-ico">' + UI.art('dates') + '</div><div>' +
        '<b>פריסה ל-' + r.installments + ' תשלומים</b>' + line + '</div></div>';
    }

    body += '<div class="section-title" style="margin-top:6px"><span>היסטוריית תשלומים</span></div>';
    body += r.payments.length ? r.payments.map(function (p) {
      return '<div class="row" style="box-shadow:none;background:#FAF8FD">' +
        '<div class="r-ico" style="background:#fff">' + Store.methodIcon(p.method) + '</div>' +
        '<div class="r-body">' +
          '<div class="r-name" style="display:flex;align-items:baseline;gap:8px">' +
            '<span>' + UI.money(p.amount) + '</span>' +
            (p.note ? '<span class="pay-note" title="' + UI.esc(p.note) + '">' + UI.esc(p.note) + '</span>' : '') +
          '</div>' +
          '<div class="r-sub">' + UI.esc(Store.methodName(p.method)) + ' · ' + UI.dateShort(p.date) + '</div>' +
        '</div>' +
        '<button class="iconbtn plain" data-action="pay-edit" data-id="' + p.id + '">✏️</button></div>';
    }).join('') : '<p class="muted small">עוד לא נרשמו תשלומים.</p>';

    body += '<div class="btn-row mt">' +
      '<button class="btn ghost" data-action="col-remind" data-id="' + c.id + '">📲 תזכורת</button>' +
      '<button class="btn" data-action="pay-add" data-child="' + c.id + '">+ תשלום</button>' +
      '</div>' +
      '<button class="btn soft" style="margin-top:9px" data-action="col-plan" data-id="' + c.id + '">הגדרת פריסה לתשלומים</button>';

    return body;
  }

  function openChild(childId) {
    var c = Store.find('children', childId);
    if (!c) return;
    var m = UI.modal({ title: 'פרטי תשלום', subtitle: c.name, body: childCardBody(childId) });
    openCard = { childId: childId, api: m };
  }

  /* אחרי הוספה, עריכה או מחיקה של תשלום — הכרטיס הפתוח מתרענן במקום */
  function refreshCard() {
    if (!openCard) return;
    if (!openCard.api.isOpen()) { openCard = null; return; }
    openCard.api.setBody(childCardBody(openCard.childId));
  }

  /* ---------- טופס תשלום ---------- */
  function payForm(pay, presetChild) {
    var isNew = !pay;
    var kids = Store.state.children;
    if (!kids.length) {
      UI.modal({
        title: 'עוד אין ילדים ברשימה',
        subtitle: 'כל תשלום משויך להורה של ילד/ה',
        body: '<p class="small">הגבייה מחושבת לפי ילדי הגן, ולכן צריך קודם להוסיף אותם ואת פרטי ההורים. ' +
              'אחרי זה כל תשלום שתרשמו יתעדכן מיד במצב הגבייה.</p>' +
              '<button class="btn mt js-go">להוספת ילדים</button>',
        onMount: function (root, close) {
          root.querySelector('.js-go').addEventListener('click', function () {
            close();
            App.setView('children');
          });
        }
      });
      return;
    }

    pay = pay || {
      childId: presetChild || kids[0].id, amount: '', method: 'paybox',
      date: UI.todayISO(), installments: 1, note: ''
    };

    UI.formModal({
      title: isNew ? 'רישום תשלום' : 'עריכת תשלום',
      fields: [
        { name: isNew ? 'childIds' : 'childId', label: isNew ? 'בחרו הורה/ים' : 'ההורה של',
          type: isNew ? 'multiselect' : 'select', value: isNew ? (presetChild ? [presetChild] : []) : pay.childId, required: true,
          options: kids.map(function (c) {
            var p = c.parents && c.parents[0] ? c.parents[0].name : c.name;
            return { value: c.id, label: p + ' (' + c.name + ')' };
          }) },
        { name: 'amount', label: isNew ? 'סכום לכל הורה (₪)' : 'סכום (₪)', type: 'number', value: pay.amount, required: true, placeholder: '0', min: 0,
          hint: isNew ? 'הסכום ופרטי התשלום יירשמו בנפרד לכל הורה שנבחר.' : '' },
        { name: 'method', label: 'אמצעי תשלום', type: 'chips', value: pay.method,
          options: Store.PAY_METHODS.map(function (m) { return { value: m.id, label: m.name, icon: m.icon }; }) },
        { name: 'date', label: 'תאריך', type: 'date', value: pay.date || UI.todayISO(), half: true },
        { name: 'installments', label: 'מס׳ תשלומים', type: 'number', value: pay.installments || 1, min: 1, max: 12, half: true },
        { name: 'note', label: 'הערה', value: pay.note, placeholder: 'אופציונלי' }
      ],
      onSubmit: function (v) {
        v.installments = Math.max(1, Calc.num(v.installments) || 1);
        if (isNew) {
          var ids = Array.isArray(v.childIds) ? v.childIds.filter(function (id, i, all) { return all.indexOf(id) === i; }) : [];
          if (!ids.length || ids.some(function (id) { return !Store.find('children', id); })) {
            UI.toast('נא לבחור הורה מהרשימה');
            return false;
          }
          ids.forEach(function (id) {
            Store.add('payments', { childId: id, amount: v.amount, method: v.method,
              date: v.date, installments: v.installments, note: v.note });
          });
        }
        else Store.update('payments', pay.id, v);
        App.render();
        refreshCard();
        UI.toast(isNew && ids.length > 1 ? 'נשמרו ' + ids.length + ' תשלומים ✓' : 'התשלום נשמר ✓');
      },
      onDelete: isNew ? null : function () {
        Store.remove('payments', pay.id);
        App.render();
        refreshCard();
        UI.toast('התשלום נמחק');
      }
    });
  }

  /* אזהרה כשתאריכי ההצטרפות נופלים מחוץ לשנת הלימודים המוגדרת —
     במצב הזה כל הסכומים מתאפסים, וזה נראה כאילו הנתונים נעלמו */
  function yearMismatchNote() {
    var st = Store.state;
    if (!st.children.length) return '';
    var out = Calc.outOfYearChildren(st);
    if (!out.length) return '';
    var all = out.length === st.children.length;

    return '<div class="note" style="background:var(--orange)"><div class="n-ico">⚠️</div><div>' +
      '<b>תאריכי הצטרפות מחוץ לשנת הלימודים</b>' +
      (all ? 'כל ' + st.children.length + ' הילדים ' : out.length + ' מתוך ' + st.children.length + ' הילדים ') +
      'רשומים כמצטרפים אחרי סוף שנת הלימודים שהוגדרה (' +
      UI.dateShort(st.settings.yearStart) + ' – ' + UI.dateShort(st.settings.yearEnd) + '), ' +
      'ולכן אחוז ההשתתפות שלהם 0 והסכומים לתשלום יוצאים ריקים.' +
      '<div class="btn-row mt">' +
        '<button class="btn ghost" data-action="nav" data-view="children">בדיקת הילדים</button>' +
        '<button class="btn" data-action="nav" data-view="settings">עדכון שנת הלימודים</button>' +
      '</div></div></div>';
  }

  /* ---------- הוספה ידנית לצד ייבוא מקובץ ----------
     הייבוא מקובץ (PayBox / Excel) מוסתר בינתיים מהמסך; הלוגיקה נשארת
     (importModal, PayImport) ומופעלת שוב על ידי הפיכת הדגל ל-true. */
  var IMPORT_ENABLED = false;
  function payActions(tab) {
    var html = '<div class="pay-actions">' +
      '<button class="btn add-btn manual" data-action="pay-add" aria-label="הוספת תשלום ידנית">' +
        '<span class="ab-plus" aria-hidden="true">+</span><span class="ab-label">הוספת תשלום ידנית</span></button>' +
      '<button class="btn import-btn" data-action="pay-import" aria-label="ייבוא תשלומים מקובץ">' +
        '<span class="imp-ico" aria-hidden="true">' + UI.svgIcon('upload', 22) + '</span>' +
        '<span class="imp-txt"><b>ייבוא תשלומים</b><small>מ-PayBox או מקובץ Excel</small></span></button>' +
      '</div>';
    if (tab === 'list') {
      html += '<button type="button" class="import-note" data-action="pay-import">' +
        '<span class="in-art" aria-hidden="true">' + UI.svgIcon('file-up', 44) + '</span>' +
        '<span class="in-body"><b>ייבוא תשלומים מקובץ</b>' +
          '<span>יש לך קובץ תשלומים מ-PayBox? אפשר לייבא אותו ולחסוך הזנה ידנית.</span>' +
          '<span class="in-hint">ℹ️ תומך בקבצי CSV, Excel ובטבלאות תשלומים.</span></span>' +
        '</button>';
    }
    return html;
  }

  /* ============================================================
     ייבוא תשלומים מקובץ (PayBox / Excel / CSV)
     ------------------------------------------------------------
     שלב 1: בחירת קובץ. CSV נקרא ישירות; Excel דרך ספריית SheetJS
     שנטענת רק כשצריך. שלב 2: תצוגה מקדימה — כל שורה עם ההורה שזוהה
     (ניתן לשינוי), כפילויות מסומנות ומדולגות, ואז ייבוא בלחיצה.
     ============================================================ */
  var XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = XLSX_URL;
      sc.onload = function () { window.XLSX ? resolve(window.XLSX) : reject(new Error('no XLSX')); };
      sc.onerror = function () { reject(new Error('load failed')); };
      document.head.appendChild(sc);
    });
  }

  /* קובץ טקסט: UTF-8, ואם יצא ג׳יבריש — Windows-1255 (ייצוא ישן מאקסל) */
  function readText(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onerror = function () { reject(r.error); };
      r.onload = function () {
        var t = String(r.result || '');
        if ((t.match(/\uFFFD/g) || []).length > 3) {
          var r2 = new FileReader();
          r2.onload = function () { resolve(String(r2.result || '')); };
          r2.onerror = function () { resolve(t); };
          r2.readAsText(file, 'windows-1255');
        } else resolve(t);
      };
      r.readAsText(file);
    });
  }

  function readRows(file) {
    var name = (file.name || '').toLowerCase();
    if (/\.(csv|txt|tsv)$/.test(name) || /text\/(csv|plain)/.test(file.type)) {
      return readText(file).then(function (t) { return PayImport.parseCSV(t); });
    }
    return loadXLSX().then(function (XLSX) {
      return new Promise(function (resolve, reject) {
        var r = new FileReader();
        r.onerror = function () { reject(r.error); };
        r.onload = function () {
          try {
            var wb = XLSX.read(new Uint8Array(r.result), { type: 'array', cellDates: true });
            var ws = wb.Sheets[wb.SheetNames[0]];
            resolve(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }));
          } catch (e) { reject(e); }
        };
        r.readAsArrayBuffer(file);
      });
    });
  }

  function importModal() {
    var kids = Store.state.children;
    var rows = null, detected = null, plan = null, method = 'paybox';

    var m = UI.modal({
      title: 'ייבוא תשלומים',
      subtitle: 'מ-PayBox, מ-Excel או מקובץ CSV',
      body: stepFileHTML(),
      onMount: function (root, close) { mountStepFile(root, close); }
    });

    function stepFileHTML() {
      return '<label class="drop" for="imp-pay-file">' +
          '<span class="drop-ico" aria-hidden="true">' + UI.svgIcon('file-up', 40) + '</span>' +
          '<b>בחירת קובץ</b><span class="small muted">Excel ‏(xlsx) או CSV — כמו הייצוא מ-PayBox</span>' +
          '<input type="file" id="imp-pay-file" accept=".xlsx,.xls,.csv,.txt,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv">' +
        '</label>' +
        '<p class="imp-status small muted" aria-live="polite"></p>' +
        '<div class="hint">הקובץ צריך עמודה של שם המשלם ועמודה של סכום; תאריך והערה — אם יש. ' +
          'שם המשלם מותאם אוטומטית להורים שברשימת הילדים, ואפשר לתקן לפני הייבוא.</div>';
    }

    function mountStepFile(root, close) {
      var input = root.querySelector('#imp-pay-file');
      var status = root.querySelector('.imp-status');
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (!f) return;
        status.textContent = 'קורא את הקובץ…';
        readRows(f).then(function (rs) {
          rows = rs;
          detected = PayImport.detectColumns(rows);
          if (detected.map.amount === undefined) throw new Error('no-amount');
          rebuildPlan();
          root.innerHTML = stepPreviewHTML();
          mountStepPreview(root, close);
        }).catch(function (e) {
          status.textContent = e && e.message === 'no-amount'
            ? 'לא נמצאה עמודת סכום בקובץ. אפשר לבדוק שהקובץ הוא דוח התשלומים ולא דף אחר.'
            : e && e.message === 'load failed'
              ? 'לא הצלחנו לטעון את קורא ה-Excel (אין חיבור?). אפשר לשמור את הקובץ כ-CSV ולנסות שוב.'
              : 'לא הצלחנו לקרוא את הקובץ. אפשר לשמור אותו כ-CSV ולנסות שוב.';
          input.value = '';
        });
      });
    }

    function rebuildPlan() {
      var recs = PayImport.toRecords(rows, detected);
      plan = PayImport.importPlan(recs, kids, Store.state.payments);
      plan.forEach(function (r) { r.include = !r.skipped && !!r.childId; });
    }

    function childLabel(c) {
      var p = c.parents && c.parents[0] && c.parents[0].name;
      return (p ? p + ' (' + c.name + ')' : c.name);
    }

    function columnSelect(kind, label) {
      var header = detected.headerRow > -1 ? rows[detected.headerRow] : null;
      var width = rows.reduce(function (w, r) { return Math.max(w, r.length); }, 0);
      var opts = '<option value="">—</option>';
      for (var i = 0; i < width; i++) {
        var text = header && header[i] !== '' && header[i] != null ? String(header[i]) : 'עמודה ' + (i + 1);
        opts += '<option value="' + i + '"' + (detected.map[kind] === i ? ' selected' : '') + '>' + UI.esc(text) + '</option>';
      }
      return '<label class="imp-col"><span>' + label + '</span><select class="input" data-col="' + kind + '">' + opts + '</select></label>';
    }

    function stepPreviewHTML() {
      var ready = plan.filter(function (r) { return r.include; }).length;
      var dups = plan.filter(function (r) { return r.skipped === 'duplicate'; }).length;
      var unmatched = plan.filter(function (r) { return !r.childId && !r.skipped; }).length;
      var html = '<div class="imp-cols">' +
          columnSelect('name', 'שם המשלם') + columnSelect('amount', 'סכום') + columnSelect('date', 'תאריך') +
        '</div>' +
        '<div class="imp-method"><span class="small muted">אמצעי תשלום לכל השורות</span>' +
          '<select class="input" data-method>' + Store.PAY_METHODS.map(function (pm) {
            return '<option value="' + pm.id + '"' + (pm.id === method ? ' selected' : '') + '>' + pm.icon + ' ' + pm.name + '</option>';
          }).join('') + '</select></div>' +
        '<p class="small muted imp-summary">' +
          'נמצאו <b>' + plan.length + '</b> תשלומים בקובץ' +
          (dups ? ' · <b>' + dups + '</b> כבר רשומים' : '') +
          (unmatched ? ' · <b>' + unmatched + '</b> ללא הורה מזוהה' : '') + '</p>';

      if (!plan.length) {
        html += '<p class="small muted center" style="margin:14px 0">לא נמצאו שורות עם סכום. אפשר לבחור עמודות אחרות למעלה.</p>';
      }
      html += '<div class="imp-list">' + plan.map(function (r, i) {
        var badge = r.skipped === 'duplicate' ? '<span class="badge warn">כבר קיים</span>'
          : r.skipped === 'status' ? '<span class="badge no">' + UI.esc(r.status || 'בוטל') + '</span>'
          : r.skipped === 'total' ? '<span class="badge">שורת סיכום</span>'
          : r.level === 'exact' ? '<span class="badge ok">זוהה</span>'
          : r.level === 'partial' ? '<span class="badge info">זוהה חלקית</span>'
          : '<span class="badge no">לבדיקה</span>';
        var opts = '<option value="">— לא לייבא —</option>' + kids.map(function (c) {
          return '<option value="' + c.id + '"' + (r.childId === c.id ? ' selected' : '') + '>' + UI.esc(childLabel(c)) + '</option>';
        }).join('');
        return '<div class="imp-row' + (r.include ? '' : ' off') + '" data-i="' + i + '">' +
          '<div class="imp-top"><span class="imp-name">' + UI.esc(r.name || 'ללא שם') + '</span>' +
            '<span class="imp-amt">' + UI.money(r.amount) + '</span></div>' +
          '<div class="imp-sub"><span class="small muted">' + (r.date ? UI.dateShort(r.date) : 'ללא תאריך') +
            (r.note ? ' · ' + UI.esc(r.note) : '') + '</span>' + badge + '</div>' +
          '<select class="input imp-pick" data-pick="' + i + '" aria-label="שיוך להורה">' + opts + '</select>' +
          '</div>';
      }).join('') + '</div>' +
      '<div class="btn-row mt">' +
        '<button type="button" class="btn soft js-back">קובץ אחר</button>' +
        '<button type="button" class="btn js-import"' + (ready ? '' : ' disabled') + '>ייבוא ' + ready + ' תשלומים</button>' +
      '</div>';
      return html;
    }

    function mountStepPreview(root, close) {
      root.querySelectorAll('[data-col]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          var kind = sel.getAttribute('data-col');
          if (sel.value === '') delete detected.map[kind]; else detected.map[kind] = parseInt(sel.value, 10);
          if (detected.map.amount === undefined) { UI.toast('צריך לבחור עמודת סכום'); return; }
          rebuildPlan();
          root.innerHTML = stepPreviewHTML();
          mountStepPreview(root, close);
        });
      });
      var ms = root.querySelector('[data-method]');
      ms.addEventListener('change', function () { method = ms.value; });
      root.querySelectorAll('[data-pick]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          var r = plan[parseInt(sel.getAttribute('data-pick'), 10)];
          r.childId = sel.value;
          r.include = !!sel.value;
          if (r.skipped === 'duplicate' && sel.value) r.skipped = '';   // בחירה מפורשת גוברת על אזהרת הכפילות
          sel.closest('.imp-row').classList.toggle('off', !r.include);
          var ready = plan.filter(function (x) { return x.include; }).length;
          var btn = root.querySelector('.js-import');
          btn.disabled = !ready;
          btn.textContent = 'ייבוא ' + ready + ' תשלומים';
        });
      });
      root.querySelector('.js-back').addEventListener('click', function () {
        rows = null; plan = null;
        root.innerHTML = stepFileHTML();
        mountStepFile(root, close);
      });
      root.querySelector('.js-import').addEventListener('click', function () {
        var picked = plan.filter(function (r) { return r.include && r.childId && Store.find('children', r.childId); });
        if (!picked.length) return;
        picked.forEach(function (r) {
          Store.add('payments', { childId: r.childId, amount: r.amount, method: method,
            date: r.date || UI.todayISO(), installments: 1, note: r.note || '' });
        });
        close();
        App.render();
        refreshCard();
        UI.toast('יובאו ' + picked.length + ' תשלומים ✓');
      });
    }
    return m;
  }

  function render() {
    var tab = App.vs('colTab', 'list');
    var html = UI.pageHead({ title: 'גבייה מההורים', subtitle: 'מי שילם, כמה, ובאיזה אמצעי', art: 'collection', tone: 'green', back: 'home' });
    html += yearMismatchNote();
    html += '<div class="segment">' +
      '<button data-action="col-tab" data-tab="calc" class="' + (tab === 'calc' ? 'on' : '') + '">חישוב</button>' +
      '<button data-action="col-tab" data-tab="payments" class="' + (tab === 'payments' ? 'on' : '') + '">תשלומים</button>' +
      '<button data-action="col-tab" data-tab="list" class="' + (tab === 'list' ? 'on' : '') + '">רשימה</button>' +
      '</div>';
    html += !Store.state.children.length
      ? UI.addBtn({ act: 'nav', label: 'הוספת ילדים', cls: 'mb-add', data: { view: 'children' } })
      : IMPORT_ENABLED
        ? payActions(tab)
        : UI.addBtn({ act: 'pay-add', label: 'הוספת תשלום', cls: 'mb-add' });
    if (tab === 'calc') html += tabCalc();
    else if (tab === 'payments') html += tabPayments();
    else html += tabList();
    return html;
  }

  return {
    render: render,
    payForm: payForm,
    actions: {
      'col-tab': function (el) { App.setVs('colTab', el.getAttribute('data-tab')); App.render(); },
      'col-search': function (el) {
        App.setVs('colQuery', el.value);
        var pos = el.selectionStart;
        App.render();
        var again = document.querySelector('[data-input="col-search"]');
        if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) {} }
      },
      'col-open': function (el) { openChild(el.getAttribute('data-id')); },
      'pay-add': function (el) { payForm(null, el.getAttribute('data-child')); },
      'pay-import': function () { importModal(); },
      'pay-edit': function (el, ev) {
        if (ev) ev.stopPropagation();
        payForm(Store.find('payments', el.getAttribute('data-id')));
      },
      'nav-children': function () { App.setView('children'); },
      'inst-amount': function (el) {
        App.setVs('instEdited', true);
        App.setVs('instAmount', Calc.num(el.value));
        refreshInstResult();
      },
      'inst-count': function (el) {
        App.setVs('instCount', Math.max(1, Calc.num(el.value) || 1));
        refreshInstResult();
      },
      'inst-reset': function () {
        App.setVs('instEdited', false);
        App.render();
      },
      'col-plan': function (el) {
        var c = Store.find('children', el.getAttribute('data-id'));
        if (!c) return;
        UI.formModal({
          title: 'פריסה לתשלומים',
          subtitle: c.name,
          fields: [{ name: 'installmentsPlan', label: 'מספר תשלומים', type: 'number',
                     value: c.installmentsPlan || 1, min: 1, max: 12,
                     hint: 'גובה התשלומים הבאים מחושב מהיתרה שנותרה — אם יועבר סכום שונה מהמתוכנן, ' +
                           'שאר התשלומים יתעדכנו בהתאם' }],
          onSubmit: function (v) {
            Store.update('children', c.id, { installmentsPlan: Math.max(1, Calc.num(v.installmentsPlan) || 1) });
            App.render();
            refreshCard();
            UI.toast('הפריסה נשמרה ✓');
          }
        });
      },
      'col-remind': function (el) {
        var c = Store.find('children', el.getAttribute('data-id'));
        if (!c) return;
        var r = Calc.childCollection(Store.state, c);
        var p = c.parents && c.parents[0] ? c.parents[0] : null;
        var txt = 'היי' + (p ? ' ' + p.name : '') + ',\n' +
          'תזכורת מוועד ההורים של ' + (Store.state.gan.name || 'הגן') + ':\n\n' +
          'סכום ההשתתפות של ' + c.name + ' לשנה: ' + UI.money(r.due) +
          (r.percent < 100 ? ' (מותאם לתאריך ההצטרפות)' : '') + '\n' +
          'שולם עד כה: ' + UI.money(r.paid) + '\n' +
          'נותר לתשלום: ' + UI.money(Math.max(0, r.remaining)) + '\n\n' +
          'אפשר להעביר בפייבוקס, ביט או העברה בנקאית. תודה רבה!';
        UI.whatsapp(txt, p ? p.phone : '');
      }
    }
  };
})();
