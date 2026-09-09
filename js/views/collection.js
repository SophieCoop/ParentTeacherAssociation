/* ============================================================
   גבייה מההורים — כמה כל הורה שילם, באיזה אמצעי, וכמה נשאר
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.collection = (function () {

  function statusBadge(r) {
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
      '</div></div>';

    html += '<div class="field"><input class="input" placeholder="🔍 חיפוש הורה או ילד…" ' +
      'data-input="col-search" value="' + UI.esc(q) + '"></div>';

    if (!st.children.length) {
      return html + UI.empty({ icon: '🧒', title: 'אין ילדים ברשימה', text: 'הוסיפו את ילדי הגן כדי להתחיל בגבייה.', action: { act: 'nav-children', label: 'לרשימת הילדים' } });
    }

    html += rows.map(function (r) {
      var c = r.child;
      var parent = (c.parents && c.parents[0]) ? c.parents[0].name : 'הורה';
      return '<div class="row" data-action="col-open" data-id="' + c.id + '">' +
        '<div class="avatar" style="background:' + UI.toneVar(UI.toneFor(c.name)) + '">' + UI.faceFor(c.name) + '</div>' +
        '<div class="r-body">' +
          '<div class="r-name">' + UI.esc(parent) + '</div>' +
          '<div class="r-sub">' + UI.esc(c.name) + ' · ' + UI.money(r.paid) + ' מתוך ' + UI.money(r.due) +
            (r.percent < 100 ? ' · ' + r.percent + '%' : '') + '</div>' +
          UI.bar(r.paid, r.due, r.status === 'full' ? 'ok' : 'thin') +
        '</div>' +
        '<div class="r-end">' + statusBadge(r) +
        '<div class="r-pct" style="margin-top:4px">' + (r.remaining > 0 ? 'נותר ' + UI.money(r.remaining) : '✓') + '</div></div>' +
        '</div>';
    }).join('');

    html += '<div class="row" style="background:var(--green);box-shadow:none;margin-top:14px">' +
      '<div class="r-ico" style="background:#fff">💰</div>' +
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

    var html = '<button class="btn ghost" data-action="pay-add" style="margin-bottom:14px">+ רישום תשלום חדש</button>';

    if (!pays.length) {
      return html + UI.empty({ icon: '🧾', title: 'עוד לא נרשמו תשלומים', text: 'כל תשלום שנרשם מתעדכן מיד במצב הגבייה.', action: { act: 'pay-add', label: '+ רישום התשלום הראשון' } });
    }

    html += pays.map(function (p) {
      var c = Store.find('children', p.childId);
      var parent = c && c.parents && c.parents[0] ? c.parents[0].name : (c ? c.name : 'לא ידוע');
      return '<div class="row" data-action="pay-edit" data-id="' + p.id + '">' +
        '<div class="r-ico" style="background:var(--blue)">' + Store.methodIcon(p.method) + '</div>' +
        '<div class="r-body"><div class="r-name">' + UI.esc(parent) + '</div>' +
        '<div class="r-sub">' + UI.esc(Store.methodName(p.method)) + ' · ' + UI.dateShort(p.date) +
        (p.installments > 1 ? ' · ' + p.installments + ' תשלומים' : '') + '</div></div>' +
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
    var units = Calc.totalShareUnits(st);
    var used = Store.PAY_METHODS.filter(function (m) { return methods[m.id]; });

    var html = '<div class="card">' +
      '<div class="card-title"><h2>איך מחושב הסכום לכל הורה?</h2></div>' +
      '<table class="tbl"><tbody>' +
        row('סה״כ תקציב מתוכנן', UI.money(Calc.budgetTotal(st))) +
        row('יחידות השתתפות', units.toFixed(2) + ' (ילד מלא = 1)') +
        row('סכום לילד מלא', '<b>' + UI.money(perFull) + '</b>') +
        row('סה״כ לגבייה', UI.money(sum.due)) +
        row('נגבה בפועל', '<span class="pos">' + UI.money(sum.paid) + '</span>') +
        row('נותר לגבייה', '<span class="' + (sum.remaining > 0 ? 'neg' : 'pos') + '">' + UI.money(sum.remaining) + '</span>') +
      '</tbody></table></div>';

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
        'ילד שיצטרף באמצע השנה יקבל אוטומטית אחוז מופחת לפי תאריך ההצטרפות.</div></div>';
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
      '<div class="r-ico" style="background:#fff">📅</div>' +
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

  function row(label, value) {
    return '<tr><td>' + UI.esc(label) + '</td><td class="end">' + value + '</td></tr>';
  }

  /* ---------- כרטיס הורה ---------- */
  function openChild(childId) {
    var c = Store.find('children', childId);
    if (!c) return;
    var r = Calc.childCollection(Store.state, c);
    var parent = c.parents && c.parents[0] ? c.parents[0] : { name: c.name, phone: '' };

    var body = '<div class="row" style="background:' + UI.toneVar(UI.toneFor(c.name)) + ';box-shadow:none">' +
        '<div class="avatar" style="background:#fff">' + UI.faceFor(c.name) + '</div>' +
        '<div class="r-body"><div class="r-name">' + UI.esc(parent.name) + '</div>' +
        '<div class="r-sub">הורה של ' + UI.esc(c.name) + (r.percent < 100 ? ' · ' + r.percent + '%' : '') + '</div></div>' +
      '</div>' +
      '<div class="stat-grid" style="margin-bottom:14px">' +
        '<div class="stat"><div class="s-val">' + UI.money(r.due) + '</div><div class="s-lab">לתשלום</div></div>' +
        '<div class="stat"><div class="s-val pos">' + UI.money(r.paid) + '</div><div class="s-lab">שולם</div></div>' +
        '<div class="stat"><div class="s-val ' + (r.remaining > 0 ? 'neg' : 'pos') + '">' + UI.money(Math.max(0, r.remaining)) + '</div><div class="s-lab">נותר</div></div>' +
      '</div>';

    if (r.installments > 1) {
      body += '<div class="note"><div class="n-ico">📅</div><div><b>פריסה ל-' + r.installments + ' תשלומים</b>' +
        UI.money(r.perInstallment) + ' לתשלום · שולמו ' + r.payments.length + ' תשלומים</div></div>';
    }

    body += '<div class="section-title" style="margin-top:6px"><span>היסטוריית תשלומים</span></div>';
    body += r.payments.length ? r.payments.map(function (p) {
      return '<div class="row" style="box-shadow:none;background:#FAF8FD">' +
        '<div class="r-ico" style="background:#fff">' + Store.methodIcon(p.method) + '</div>' +
        '<div class="r-body"><div class="r-name">' + UI.money(p.amount) + '</div>' +
        '<div class="r-sub">' + UI.esc(Store.methodName(p.method)) + ' · ' + UI.dateShort(p.date) + '</div></div>' +
        '<button class="iconbtn plain" data-action="pay-edit" data-id="' + p.id + '">✏️</button></div>';
    }).join('') : '<p class="muted small">עוד לא נרשמו תשלומים.</p>';

    body += '<div class="btn-row mt">' +
      '<button class="btn ghost" data-action="col-remind" data-id="' + c.id + '">📲 תזכורת</button>' +
      '<button class="btn" data-action="pay-add" data-child="' + c.id + '">+ תשלום</button>' +
      '</div>' +
      '<button class="btn soft" style="margin-top:9px" data-action="col-plan" data-id="' + c.id + '">הגדרת פריסה לתשלומים</button>';

    UI.modal({ title: 'פרטי תשלום', subtitle: c.name, body: body });
  }

  /* ---------- טופס תשלום ---------- */
  function payForm(pay, presetChild) {
    var isNew = !pay;
    var kids = Store.state.children;
    if (!kids.length) { UI.toast('קודם צריך להוסיף ילדים'); return; }

    pay = pay || {
      childId: presetChild || kids[0].id, amount: '', method: 'paybox',
      date: UI.todayISO(), installments: 1, note: ''
    };

    UI.formModal({
      title: isNew ? 'רישום תשלום' : 'עריכת תשלום',
      fields: [
        { name: 'childId', label: 'ההורה של', type: 'select', value: pay.childId, required: true,
          options: kids.map(function (c) {
            var p = c.parents && c.parents[0] ? c.parents[0].name : c.name;
            return { value: c.id, label: p + ' (' + c.name + ')' };
          }) },
        { name: 'amount', label: 'סכום (₪)', type: 'number', value: pay.amount, required: true, placeholder: '0', min: 0 },
        { name: 'method', label: 'אמצעי תשלום', type: 'chips', value: pay.method,
          options: Store.PAY_METHODS.map(function (m) { return { value: m.id, label: m.name, icon: m.icon }; }) },
        { name: 'date', label: 'תאריך', type: 'date', value: pay.date || UI.todayISO(), half: true },
        { name: 'installments', label: 'מס׳ תשלומים', type: 'number', value: pay.installments || 1, min: 1, max: 12, half: true },
        { name: 'note', label: 'הערה', value: pay.note, placeholder: 'אופציונלי' }
      ],
      onSubmit: function (v) {
        v.installments = Math.max(1, Calc.num(v.installments) || 1);
        if (isNew) Store.add('payments', v);
        else Store.update('payments', pay.id, v);
        App.render();
        UI.toast('התשלום נשמר ✓');
      },
      onDelete: isNew ? null : function () {
        Store.remove('payments', pay.id);
        App.render();
        UI.toast('התשלום נמחק');
      }
    });
  }

  function render() {
    var tab = App.vs('colTab', 'list');
    var html = UI.pageHead({ title: 'גבייה מההורים', subtitle: 'מי שילם, כמה, ובאיזה אמצעי', icon: '💰', tone: 'green', back: 'home' });
    html += '<div class="segment">' +
      '<button data-action="col-tab" data-tab="calc" class="' + (tab === 'calc' ? 'on' : '') + '">חישוב</button>' +
      '<button data-action="col-tab" data-tab="payments" class="' + (tab === 'payments' ? 'on' : '') + '">תשלומים</button>' +
      '<button data-action="col-tab" data-tab="list" class="' + (tab === 'list' ? 'on' : '') + '">רשימה</button>' +
      '</div>';
    if (tab === 'calc') html += tabCalc();
    else if (tab === 'payments') html += tabPayments();
    else html += tabList();
    html += '<button class="btn" style="margin-top:14px" data-action="pay-add">+ רישום תשלום</button>';
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
                     hint: 'הסכום לתשלום יחושב אוטומטית מתוך החוב' }],
          onSubmit: function (v) {
            Store.update('children', c.id, { installmentsPlan: Math.max(1, Calc.num(v.installmentsPlan) || 1) });
            App.render();
            UI.toast('הפריסה נשמרה ✓');
          }
        });
      },
      'col-remind': function (el) {
        var c = Store.find('children', el.getAttribute('data-id'));
        if (!c) return;
        var r = Calc.childCollection(Store.state, c);
        var p = c.parents && c.parents[0] ? c.parents[0] : null;
        var txt = 'היי' + (p ? ' ' + p.name : '') + ' 🌸\n' +
          'תזכורת מוועד ההורים של ' + (Store.state.gan.name || 'הגן') + ':\n' +
          'סכום ההשתתפות של ' + c.name + ' לשנה הוא ' + UI.money(r.due) +
          (r.percent < 100 ? ' (' + r.percent + '% — הצטרפות באמצע השנה)' : '') + '.\n' +
          'שולם עד כה: ' + UI.money(r.paid) + '\n' +
          'נותר לתשלום: ' + UI.money(Math.max(0, r.remaining)) + '\n' +
          'אפשר להעביר בפייבוקס / ביט / העברה בנקאית. תודה רבה! ❤️';
        UI.whatsapp(txt, p ? p.phone : '');
      }
    }
  };
})();
