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
    /* יש מספיק משלמים שונים כדי להסביר את כל מי שחסר — הכסף נכנס
       והשאלה נסגרה, גם אם אי אפשר לומר איזה תשלום שייך למי */
    if (r.status === 'covered') return '<span class="badge ok">שולם</span>';
    /* יש בקופה כסף שאיש לא יודע של מי — ייתכן שהוא של ההורה הזה */
    if (r.status === 'unknown') return '<span class="badge neutral">טרם ידוע</span>';
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
        (sum.unknownCount
          ? '<div class="stat"><div class="s-val muted">' + sum.unknownCount + '</div><div class="s-lab">טרם ידוע</div></div>'
          : '<div class="stat"><div class="s-val neg">' + sum.noneCount + '</div><div class="s-lab">טרם שילמו</div></div>') +
      '</div>' +
      (sum.overCount
        ? '<div class="flex-between small mt"><span class="over-paid">⚠️ ' + sum.overCount +
          (sum.overCount === 1 ? ' הורה שילם' : ' הורים שילמו') + ' מעבר למכסה</span>' +
          '<b class="over-paid">עודף ' + UI.money(sum.overTotal) + '</b></div>'
        : '') +
      /* הכסף הלא משויך נספר למעלה אבל לא בשורות שמתחת, ובלי המשפט
         הזה נראה כאילו איש לא שילם בזמן שהקופה מלאה. */
      (sum.unassigned
        ? '<div class="flex-between small mt"><span>💡 ' + UI.money(sum.unassigned) +
          ' נכנסו בלי שיוך להורה</span>' +
          '<button class="btn sm soft" data-action="col-unassigned">לשיוך</button></div>'
        : '') +
      '</div>';

    html += '<div class="field"><input class="input" placeholder="🔍 חיפוש הורה או ילד…" ' +
      'data-input="col-search" value="' + UI.esc(q) + '"></div>';

    if (!st.children.length) {
      return html + UI.empty({ art: 'children', title: 'אין ילדים ברשימה', text: 'הוסיפו את ' + Lang.t('childrenOf') + ' כדי להתחיל בגבייה.', action: { act: 'nav-children', label: 'לרשימת הילדים' } });
    }

    /* ---------- רשימה אחת ----------
       רשומה זמנית שאין עליה תשלום אינה אומרת דבר: "הורה · ילד 3 · —".
       כל עוד אין לצדה רשימת משלמים היא לפחות מזכירה שיש ילד כזה, אבל
       ברגע שנכנסו תשלומים בשם אמיתי היא מכפילה את אותו כסף פעם שנייה
       בשם ריק — שש שורות חלולות מעל תשע שורות שיש בהן מידע. במצב
       הזה היא יורדת מהמסך; מספר הילדים ממשיך להופיע בשורת הסיכום
       שבתחתית, ומסך הילדים נשאר בתפריט למי שבא להזין שמות. */
    var payers = Calc.payerGroups(st);
    if (payers.length && !q) {
      rows = rows.filter(function (r) { return !(r.child.placeholder && r.paid <= 0); });
    }
    /* כותרת נדרשת רק כששתי הרשימות על המסך יחד — אחרת היא רעש */
    if (rows.length && payers.length && !q) {
      html += '<div class="section-title" style="margin-top:4px"><span>לפי ילדים ברשימה</span></div>';
    }

    html += rows.map(function (r) {
      var c = r.child;
      var parent = (c.parents && c.parents[0]) ? c.parents[0].name : 'הורה';
      return '<div class="row" data-action="col-open" data-id="' + c.id + '">' +
        '<div class="avatar" style="background:' + UI.toneVar(UI.toneFor(c.name)) + '">' + UI.faceFor(c.name) + '</div>' +
        '<div class="r-body">' +
          '<div class="r-name">' + UI.esc(parent) + '</div>' +
          '<div class="r-sub">' + UI.esc(c.name) + ' · ' +
            /* אפס שקלים זו קביעה. כשהשאלה עדיין פתוחה מוטב קו מאשר מספר */
            (r.over ? '<b class="over-paid">' + UI.money(r.paid) + '</b>'
             : (r.status === 'unknown' || r.status === 'covered') ? '—' : UI.money(r.paid)) +
            ' מתוך ' + UI.money(r.due) +
            (r.percent < 100 ? ' · ' + r.percent + '%' : '') + '</div>' +
          UI.bar(r.paid, r.due, r.status === 'full' ? 'ok' : 'thin') +
        '</div>' +
        '<div class="r-end">' + statusBadge(r) +
        '<div class="r-pct" style="margin-top:4px">' +
          (r.over ? '<span class="over-paid">עודף ' + UI.money(r.overAmount) + '</span>'
                  : r.status === 'covered' ? '✓'
                  : r.status === 'unknown' ? '—'
                  : (r.remaining > 0 ? 'נותר ' + UI.money(r.remaining) : '✓')) + '</div></div>' +
        '</div>';
    }).join('');

    /* ההורים ששילמו ואין להם שורה משלהם ברשימה. בלי הקטע הזה הכסף
       שלהם נמצא בסיכום אבל שמם אינו מופיע בשום מקום במסך הגבייה. */
    var groups = payers;
    if (groups.length && !q) {
      html += '<div class="section-title" style="margin-top:18px"><span>שילמו — טרם שויכו להורה</span>' +
        '<span class="small muted">' + groups.length +
        (groups.length === 1 ? ' משלם' : ' משלמים') + '</span></div>';
      html += groups.map(function (g) {
        var name = g.name || 'ללא שם';
        /* פריסה לתשלומים בפייבוקס: אותו משלם, כמה שורות, אותו סכום
           בכולן. זה מה שמבדיל בינה לבין שני תשלומים על דברים שונים. */
        var how = g.count === 1 ? 'תשלום אחד'
          : g.sameAmount ? g.count + ' תשלומים של ' + UI.money(g.payments[0].amount)
          : g.count + ' תשלומים';
        return '<div class="row" data-action="col-payer" data-key="' + UI.esc(g.key) + '">' +
          '<div class="avatar" style="background:' + UI.toneVar(UI.toneFor(name)) + '">' + UI.faceFor(name) + '</div>' +
          '<div class="r-body"><div class="r-name">' + UI.esc(name) + '</div>' +
            '<div class="r-sub">' + UI.esc(how) + '</div></div>' +
          '<div class="r-end"><div class="r-amount">' + UI.money(g.total) + '</div>' +
            '<div class="r-pct"><span class="badge ok">שולם</span></div></div>' +
          '</div>';
      }).join('');
    }

    html += '<div class="row" style="background:var(--green);box-shadow:none;margin-top:14px">' +
      '<div class="r-ico has-art" style="background:#fff">' + UI.art('collection') + '</div>' +
      '<div class="r-body"><div class="r-name">סיכום גבייה</div>' +
      '<div class="r-sub" style="opacity:.75">' + st.children.length + ' ילדים' +
        (sum.unassigned ? ' · ' + UI.money(sum.unassigned) + ' ללא שיוך' : '') + '</div></div>' +
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

    /* סינון לתשלומים שאין להם הורה — הדרך מ"יש כסף בלי שם" אל
       השיוך עצמו, תשלום אחרי תשלום */
    if (App.vs('colUnassigned', false)) {
      pays = pays.filter(function (p) { return !Store.find('children', p.childId); });
      html += '<div class="flex-between small mb" style="margin-bottom:10px">' +
        '<span><b>' + pays.length + '</b> תשלומים ללא שיוך · הקישו על תשלום כדי לשייך</span>' +
        '<button class="btn sm soft" data-action="col-all-pays">הצגת הכל</button></div>';
      if (!pays.length) {
        return html + UI.empty({ art: 'collection', title: 'הכול משויך', text: 'לכל תשלום שנרשם יש הורה.' });
      }
    }

    html += pays.map(function (p) {
      var c = Store.find('children', p.childId);
      /* תשלום שלא שויך לילד נושא את שם המשלם שהגיע מהקובץ — הוא מה
         שמבדיל בין "לא ידוע" לבין שורה שאפשר לזהות ולשייך בהמשך */
      var parent = c && c.parents && c.parents[0] ? c.parents[0].name
                 : c ? c.name
                 : (p.payer || 'לא ידוע');
      return '<div class="row" data-action="pay-edit" data-id="' + p.id + '">' +
        '<div class="r-ico" style="background:var(--blue)">' + Store.methodIcon(p.method) + '</div>' +
        '<div class="r-body"><div class="r-name">' + UI.esc(parent) +
        (c ? '' : ' <span class="badge">ללא שיוך</span>') + '</div>' +
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
        /* כסף שנכנס בלי שם הורה — מהייבוא, או אחרי מחיקת ילד. הוא
           כלול בשורה שמעליו, והשורה הזאת רק אומרת כמה ממנו עוד לא
           יודעים על מי לרשום. */
        (sum.unassigned ? row('↳ מתוכם ללא שיוך להורה', UI.money(sum.unassigned)) : '') +
        /* בלי השורה הזאת החשבון נראה שבור: נגבו 4,000 ₪ מתוך תקציב
           של 4,000, ובכל זאת נותרו 3,000 לגבייה. ההסבר הוא שחלק
           מהכסף שנגבה שייך להורה ששילם יותר מחלקו וממתין להחזר. */
        (sum.overTotal ? row('↳ מתוכם שולם ביתר וממתין להחזר', UI.money(sum.overTotal)) : '') +
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

  /* ---------- כרטיס משלם שטרם שויך ----------
     אותה תצוגה מאוחדת שיש להורה ברשימה: שם אחד, סכום אחד, והתשלומים
     מתחתיו. ההבדל היחיד הוא שאין כאן ילד, ולכן אין "נותר" אישי —
     מה שאפשר להשוות אליו הוא המכסה הרגילה לילד. */
  function payerGroup(key) {
    return Calc.payerGroups(Store.state).filter(function (g) { return g.key === key; })[0] || null;
  }

  function payerCardBody(key) {
    var g = payerGroup(key);
    if (!g) return '<p class="muted small">התשלומים של המשלם הזה שויכו להורה ברשימה.</p>';
    var name = g.name || 'ללא שם';
    var share = Math.round(Calc.fullChildShare(Store.state));
    var left = Calc.round2(share - g.total);

    var body = '<div class="row" style="background:' + UI.toneVar(UI.toneFor(name)) + ';box-shadow:none">' +
        '<div class="avatar" style="background:#fff">' + UI.faceFor(name) + '</div>' +
        '<div class="r-body"><div class="r-name">' + UI.esc(name) + '</div>' +
        '<div class="r-sub">שילם/ה · טרם שויך להורה ברשימה</div></div>' +
      '</div>' +
      '<div class="stat-grid" style="margin-bottom:14px">' +
        '<div class="stat"><div class="s-val pos">' + UI.money(g.total) + '</div><div class="s-lab">שולם</div></div>' +
        '<div class="stat"><div class="s-val">' + g.count + '</div><div class="s-lab">' +
          (g.count === 1 ? 'תשלום' : 'תשלומים') + '</div></div>' +
        '<div class="stat"><div class="s-val">' + (share > 0 ? UI.money(share) : '—') +
          '</div><div class="s-lab">מכסה לילד</div></div>' +
      '</div>';

    /* פריסה לתשלומים אינה מוגדרת כאן ביד — היא נקראת מהקובץ: אותו
       משלם, כמה שורות, ובכולן אותו סכום בדיוק. */
    if (g.count > 1) {
      body += '<div class="note"><div class="n-ico">' + UI.art('dates') + '</div><div>' +
        '<b>' + (g.sameAmount ? 'פריסה ל-' + g.count + ' תשלומים' : g.count + ' תשלומים נפרדים') + '</b>' +
        (g.sameAmount
          ? 'כל תשלום ' + UI.money(g.payments[0].amount) + ', סך הכול ' + UI.money(g.total) + '.'
          : 'בסכומים שונים, סך הכול ' + UI.money(g.total) + '.') +
        '</div></div>';
    }

    if (share > 0 && left > 0.5) {
      body += '<div class="note" style="background:var(--orange)"><div class="n-ico">⏳</div><div>' +
        '<b>פחות מהמכסה הרגילה</b>המכסה לילד היא ' + UI.money(share) + ', וכאן נכנסו ' +
        UI.money(g.total) + ' — הפרש של ' + UI.money(left) + '.</div></div>';
    }

    body += '<div class="section-title" style="margin-top:6px"><span>היסטוריית תשלומים</span></div>';
    body += g.payments.slice().sort(function (a, b) {
      return String(a.date || '').localeCompare(String(b.date || ''));
    }).map(function (p) {
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
    }).join('');

    body += '<button class="btn mt" data-action="payer-assign" data-key="' + UI.esc(key) + '">' +
      'שיוך כל התשלומים להורה ברשימה</button>';
    return body;
  }

  function openPayer(key) {
    if (!payerGroup(key)) return;
    var m = UI.modal({ title: 'פרטי תשלום', subtitle: 'טרם שויך להורה', body: payerCardBody(key) });
    openCard = { payerKey: key, api: m };
  }

  /* שיוך כל התשלומים של אותו משלם לילד אחד, בפעולה אחת. זה מה
     שהופך את הייבוא ללא שיוך לשלב ביניים ולא למצב קבוע. */
  function assignPayer(key) {
    var g = payerGroup(key);
    var kids = Store.state.children;
    if (!g || !kids.length) return;
    UI.formModal({
      title: 'שיוך תשלומים',
      subtitle: (g.name || 'ללא שם') + ' · ' + g.count + (g.count === 1 ? ' תשלום' : ' תשלומים') +
        ' · ' + UI.money(g.total),
      fields: [{ name: 'childId', label: 'ההורה של', type: 'select', required: true,
        hint: 'כל התשלומים של ' + (g.name || 'המשלם') + ' יעברו לילד/ה שתבחרו, והייבוא הבא יזהה אותו לבד.',
        options: kids.map(function (c) {
          var pn = c.parents && c.parents[0] ? c.parents[0].name : c.name;
          return { value: c.id, label: pn + ' (' + c.name + ')' };
        }) }],
      submitLabel: 'שיוך',
      onSubmit: function (v) {
        if (!v.childId) return;
        g.payments.forEach(function (p) { Store.update('payments', p.id, { childId: v.childId }); });
        /* מה שנקבע ביד נשמר על הילד, כדי שהקובץ הבא יזהה את אותו
           משלם בלי לשאול שוב. הכרטיס מופיע גם כשמתג הייבוא כבוי —
           תשלומים מייבוא קודם נשארים — ולכן הלמידה מותנית. */
        if (typeof PayImport !== 'undefined') {
          Store.rememberPayer(v.childId, PayImport.keysForRecord({ name: g.name, phone: g.phone }));
        }
        if (openCard && openCard.payerKey === key) { openCard.api.close(); openCard = null; }
        App.render();
        UI.toast('שויכו ' + g.count + (g.count === 1 ? ' תשלום ✓' : ' תשלומים ✓'));
      }
    });
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
    openCard.api.setBody(openCard.payerKey
      ? payerCardBody(openCard.payerKey)
      : childCardBody(openCard.childId));
  }

  /* ---------- טופס תשלום ---------- */
  function payForm(pay, presetChild) {
    var isNew = !pay;
    var kids = Store.state.children;
    if (!kids.length) {
      UI.modal({
        title: 'עוד אין ילדים ברשימה',
        subtitle: 'כל תשלום משויך להורה של ילד/ה',
        body: '<p class="small">הגבייה מחושבת לפי ' + Lang.t('childrenOf') + ', ולכן צריך קודם להוסיף אותם ואת פרטי ההורים. ' +
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
          type: isNew ? 'multiselect' : 'select',
          value: isNew ? (presetChild ? [presetChild] : []) : pay.childId,
          /* בעריכה השיוך אינו חובה: תשלום שיובא בלי שיוך נשאר חוקי,
             וזה גם המקום לשייך אותו כשהילדים יקבלו שמות */
          required: isNew,
          hint: (!isNew && !pay.childId && pay.payer) ? 'שולם על ידי ' + pay.payer : '',
          options: (isNew ? [] : [{ value: '', label: '— ללא שיוך —' }]).concat(
            kids.map(function (c) {
              var p = c.parents && c.parents[0] ? c.parents[0].name : c.name;
              return { value: c.id, label: p + ' (' + c.name + ')' };
            })) },
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
     היכולת כולה תלויה במתג אחד ב-js/config.js. ברירת המחדל דולקת,
     וקובץ הגדרות ישן שאין בו את המתג אינו מכבה אותה בטעות. */
  function importEnabled() {
    if (typeof Features === 'undefined' || !Features) return true;
    return Features.payboxImport !== false;
  }
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
  /* הספרייה נטענת ממקום אחד (js/report.js), שגם הדוח לאקסל נשען עליו —
     כך יש כתובת CDN אחת ולא שתיים שעלולות להיפרד */
  function loadXLSX() { return Report.loadXLSX(); }

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

  function readBytes(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onerror = function () { reject(r.error); };
      r.onload = function () { resolve(new Uint8Array(r.result)); };
      r.readAsArrayBuffer(file);
    });
  }

  function sheetRows(bytes) {
    return loadXLSX().then(function (XLSX) {
      var wb = XLSX.read(bytes, { type: 'array', cellDates: true });
      var ws = wb.Sheets[wb.SheetNames[0]];
      return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    });
  }

  /* מבקש סיסמה שוב ושוב עד שהיא נכונה, או עד שמבטלים. ask מקבל את
     הודעת השגיאה מהניסיון הקודם (ריק בפעם הראשונה) ומחזיר הבטחה עם
     הסיסמה, או null לביטול. */
  function unlock(bytes, ask, note) {
    return ask(note).then(function (pass) {
      if (pass === null) { var c = new Error('cancelled'); c.cancelled = true; throw c; }
      return XlsxCrypt.decrypt(bytes, pass).catch(function (e) {
        if (e.cancelled) throw e;
        return unlock(bytes, ask, e.message || 'פתיחת הקובץ נכשלה');
      });
    });
  }

  /* ask — פונקציה שמציגה את שאלת הסיסמה. נדרשת רק לקובץ מוצפן. */
  function readRows(file, ask) {
    var name = (file.name || '').toLowerCase();
    if (/\.(csv|txt|tsv)$/.test(name) || /text\/(csv|plain)/.test(file.type)) {
      return readText(file).then(function (t) { return PayImport.parseCSV(t); });
    }
    return readBytes(file).then(function (bytes) {
      if (!XlsxCrypt.isEncrypted(bytes)) return sheetRows(bytes);
      if (!ask) throw new Error('הקובץ מוגן בסיסמה');
      return unlock(bytes, ask).then(sheetRows);
    });
  }

  function importModal() {
    var kids = Store.state.children;
    var rows = null, detected = null, plan = null, method = 'paybox';
    /* נפתח רק כשהמשתמש ביקש לשנות את העמודות, ונשאר פתוח משם והלאה */
    var showCols = false;
    var showMissing = false;
    /* איזו קבוצת שורות מוצגת: הכל / ממתינים / ללא שיוך / שויכו */
    var filter = 'all';

    /* גוף החלון, לשימוש שלבים שרצים מחוץ ל-onMount (שאלת הסיסמה) */
    var host = null, hostClose = null;

    var m = UI.modal({
      title: 'ייבוא תשלומים',
      subtitle: 'מ-PayBox, מ-Excel או מקובץ CSV',
      body: stepFileHTML(),
      onMount: function (root, close) { host = root; hostClose = close; mountStepFile(root, close); }
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

    /* ---------- שאלת הסיסמה לקובץ מוצפן ----------
       מוצגת בתוך אותו חלון במקום מסך בחירת הקובץ, כדי לא לערום
       חלון על חלון. מחזירה הבטחה עם הסיסמה, או null אם ביטלו. */
    function askPassword(note) {
      return new Promise(function (resolve) {
        host.innerHTML =
          '<div class="state-box">' +
            '<div class="state-ico info">🔒</div>' +
            '<b>הקובץ מוגן בסיסמה</b>' +
            '<p>פייבוקס מצפינה את הקובץ. הסיסמה נשארת במכשיר שלכם ' +
            'ואינה נשלחת לשום מקום.</p>' +
          '</div>' +
          '<div class="field" style="margin-top:4px"><label for="imp-pass">הסיסמה</label>' +
            '<input class="input" id="imp-pass" type="password" inputmode="numeric" ' +
              'autocomplete="off" placeholder="••••••">' +
            '<div class="hint">רמז: בדרך כלל זה <b>5 הספרות האחרונות של תעודת הזהות</b> ' +
            'של מי שהוציא את הדוח מפייבוקס.</div></div>' +
          (note ? '<div class="note" style="background:#FDF0F2"><div class="n-ico">⚠️</div><div>' +
                  UI.esc(note) + '</div></div>' : '') +
          '<button class="btn mt js-pass-go">פתיחת הקובץ</button>' +
          '<button class="btn soft js-pass-no" style="margin-top:9px">ביטול</button>';

        var box = host.querySelector('#imp-pass');
        var go = host.querySelector('.js-pass-go');
        box.focus();

        function submit() {
          if (!box.value) { box.focus(); return; }
          go.disabled = true;
          go.textContent = 'מפענח…';
          resolve(box.value);
        }
        go.addEventListener('click', submit);
        box.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
        host.querySelector('.js-pass-no').addEventListener('click', function () { resolve(null); });
      });
    }

    function mountStepFile(root, close) {
      var input = root.querySelector('#imp-pay-file');
      var status = root.querySelector('.imp-status');
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (!f) return;
        status.textContent = 'קורא את הקובץ…';
        readRows(f, askPassword).then(function (rs) {
          rows = rs;
          detected = PayImport.detectColumns(rows);
          if (detected.map.amount === undefined) throw new Error('no-amount');
          rebuildPlan();
          root.innerHTML = stepPreviewHTML();
          mountStepPreview(root, close);
        }).catch(function (e) {
          /* שאלת הסיסמה החליפה את גוף החלון, ולכן חוזרים למסך בחירת
             הקובץ לפני שמציגים הודעה — אחרת אין לאן לכתוב אותה */
          host.innerHTML = stepFileHTML();
          mountStepFile(host, hostClose);
          var st = host.querySelector('.imp-status');
          if (e && e.cancelled) return;                       // ביטלו — בלי הודעת שגיאה
          st.textContent = e && e.message === 'no-amount'
            ? 'לא נמצאה עמודת סכום בקובץ. אפשר לבדוק שהקובץ הוא דוח התשלומים ולא דף אחר.'
            : e && e.message === 'load failed'
              ? 'לא הצלחנו לטעון את קורא ה-Excel (אין חיבור?). אפשר לשמור את הקובץ כ-CSV ולנסות שוב.'
              : (e && e.message) || 'לא הצלחנו לקרוא את הקובץ. אפשר לשמור אותו כ-CSV ולנסות שוב.';
        });
      });
    }

    function rebuildPlan() {
      var recs = PayImport.toRecords(rows, detected);
      plan = PayImport.importPlan(recs, kids, Store.state.payments);
      /* ועד שהוזן בו רק מספר ילדים אינו יכול להתאים כלום לפי שם,
         אבל המקומות הפנויים ברשימה הם בדיוק מה שהמשלמים צריכים.
         ההצבה נעשית כאן ולא בזיהוי, כי היא מוצעת ולא נקבעת. */
      PayImport.allocatePlaceholders(plan, kids, Store.state.payments);
      /* שורה שלא זוהה לה הורה נכנסת בכל זאת, בלי שיוך: הכסף אמיתי
         והוא שייך לקופה. שם המשלם נשמר איתה, והשיוך אפשרי בכל רגע
         מאוחר יותר. רק שורה שסוננה (כפילות, בוטלה, שורת סיכום)
         נשארת בחוץ. */
      plan.forEach(function (r) { r.include = !r.skipped; });
    }

    /* ---------- שלוש דרגות ודאות ----------
       ✓ זוהה  — יש ראיה: טלפון, שיוך שנלמד, או שם הילד/ה שבקובץ.
       ✨ מוצע — יש דמיון או מקום פנוי, אבל לא ראיה. ממתין לאישור.
       ❗ לא זוהה — אין למה לשייך, והשורה תיכנס ללא שיוך. */
    function grade(r) {
      if (!r.childId) return 'none';
      if (r.approved) return 'sure';
      return (r.level === 'allocated' || r.level === 'reversed' || r.level === 'partial')
        ? 'guess' : 'sure';
    }

    /* תווית שאומרת על מה השיוך נשען. "מוצע" איננו סוג של זיהוי אלא
       היעדרו: יש מקום פנוי או דמיון בשם, ואין ראיה. */
    var LEVEL_TEXT = {
      phone: 'זוהה לפי טלפון', remembered: 'זוהה מייבוא קודם', child: 'לפי שם הילד/ה בקובץ',
      exact: 'זוהה לפי שם', reversed: 'שם בסדר הפוך', partial: 'דמיון בשם',
      allocated: 'הוצב במקום פנוי'
    };

    function counts() {
      var c = { sure: 0, guess: 0, none: 0 };
      plan.forEach(function (r) { if (!r.skipped) c[grade(r)]++; });
      return c;
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

    /* הזיהוי הסתדר לבד? הייצוא של פייבוקס נראה תמיד אותו דבר, ולכן
       ברוב המקרים אין מה לבחור — ובוררי העמודות הם חמישה פקדים של
       רעש מעל התוכן שבאמת מעניין. הם נשארים במקום אבל מקופלים,
       ונפתחים מאליהם כשהזיהוי לא הצליח, כדי שקובץ שאינו מפייבוקס
       לא יישאר בלי מוצא. */
    function detectedWell() {
      return detected && detected.map &&
        detected.map.name !== undefined && detected.map.amount !== undefined && plan && plan.length > 0;
    }

    function methodName() {
      var pm = Store.PAY_METHODS.filter(function (x) { return x.id === method; })[0];
      return pm ? pm.icon + ' ' + pm.name : '';
    }

    /* כמה מההורים שברשימה מיוצגים בקובץ, ומי לא. זה הצד השני של
       הייבוא: "4 ייובאו ללא שיוך" מספר על שורות שאין להן הורה, וכאן
       ההפך — הורים שאין להם שורה. השניים ביחד הם בדרך כלל אותם
       אנשים בשמות אחרים, ולראות אותם זה לצד זה מזמין לחבר ביניהם.
       ברשומות זמניות ("ילד 1") אין על מה לדבר, ולכן אין שורה כזאת. */
    function coverage() {
      var real = kids.filter(function (c) { return !c.placeholder; });
      if (!real.length) return null;
      var seen = {};
      plan.forEach(function (r) { if (r.include && r.childId) seen[r.childId] = true; });
      var missing = real.filter(function (c) { return !seen[c.id]; });
      return { total: real.length, covered: real.length - missing.length, missing: missing };
    }

    function coverageHTML() {
      var cov = coverage();
      if (!cov) return '';
      /* "מופיעים בקובץ" ולא "שילמו": מי שאינו בקובץ עשוי לשלם במזומן,
         או להופיע בו בשם שלא זוהה. זו תצפית, לא האשמה. */
      var html = '<div class="imp-cover"><span class="small muted">' +
        '<b>' + cov.covered + '</b> מתוך <b>' + cov.total + '</b> הורים ברשימה מופיעים בקובץ</span>' +
        (cov.missing.length
          ? '<button type="button" class="btn sm soft js-missing">' + (showMissing ? 'הסתרה' : 'מי לא') + '</button>'
          : '') + '</div>';
      if (showMissing && cov.missing.length) {
        html += '<div class="imp-missing">' + cov.missing.map(function (c) {
          var pn = c.parents && c.parents[0] && c.parents[0].name;
          return '<span class="badge neutral">' + UI.esc(pn || c.name) +
            (pn ? ' <span class="muted">(' + UI.esc(c.name) + ')</span>' : '') + '</span>';
        }).join('') + '</div>';
      }
      return html;
    }

    function stepPreviewHTML() {
      var ready = plan.filter(function (r) { return r.include; }).length;
      var dups = plan.filter(function (r) { return r.skipped === 'duplicate'; }).length;
      var c = counts();
      var open = showCols || !detectedWell();
      var html = open
        ? '<div class="imp-cols">' +
            columnSelect('name', 'שם המשלם') + columnSelect('amount', 'סכום') + columnSelect('date', 'תאריך') +
            /* עמודת שם הילד/ה מוצגת תמיד, גם כשלא זוהתה: היא הדרך
               הקצרה ביותר לשייך את כל השורות בבת אחת, ומי שיש לו
               כזאת בקובץ צריך לראות שאפשר להצביע עליה. */
            columnSelect('child', 'שם הילד/ה (לא חובה)') +
          '</div>' +
          '<div class="imp-method"><span class="small muted">אמצעי תשלום לכל השורות</span>' +
            '<select class="input" data-method>' + Store.PAY_METHODS.map(function (pm) {
              return '<option value="' + pm.id + '"' + (pm.id === method ? ' selected' : '') + '>' + pm.icon + ' ' + pm.name + '</option>';
            }).join('') + '</select></div>'
        : '<div class="imp-auto">' +
            '<span class="small muted">' + UI.esc(methodName()) + ' · העמודות זוהו מהקובץ</span>' +
            '<button type="button" class="btn sm soft js-cols">שינוי</button>' +
          '</div>';

      if (!plan.length) {
        return html + '<p class="small muted center" style="margin:14px 0">לא נמצאו שורות עם סכום. אפשר לבחור עמודות אחרות למעלה.</p>' +
          '<div class="btn-row mt imp-actions">' +
            '<button type="button" class="btn soft js-back">קובץ אחר</button>' +
            '<button type="button" class="btn js-done">סגירה</button></div>';
      }

      /* שלוש המשבצות עונות על השאלה הראשונה שמשתמש שואל מול רשימה
         ארוכה: כמה מזה אני בכלל צריך לעבור עליו. */
      html += '<p class="imp-lead">נקראו <b>' + plan.length + '</b> תשלומים מקובץ הגבייה</p>' +
        '<div class="imp-tiles">' +
          '<div class="imp-tile ok"><b>' + c.sure + '</b><span>שויכו אוטומטית</span></div>' +
          '<div class="imp-tile warn"><b>' + c.guess + '</b><span>ממתינים לאישור</span></div>' +
          '<div class="imp-tile no"><b>' + c.none + '</b><span>ללא שיוך</span></div>' +
        '</div>';

      if (c.guess || c.none) {
        html += '<div class="imp-hint"><span aria-hidden="true">💡</span><span>' +
          'השיוך נעשה לפי טלפון, שם, ושיוכים שנלמדו בייבוא קודם. ' +
          'אפשר לעבור רק על השורות המסומנות ולהשאיר את השאר.</span></div>';
      }

      var TABS = [['all', 'הכל', plan.length], ['guess', 'ממתינים', c.guess],
                  ['none', 'ללא שיוך', c.none], ['sure', 'שויכו', c.sure]];
      html += '<div class="imp-chips">' + TABS.filter(function (t) {
        return t[0] === 'all' || t[2];
      }).map(function (t) {
        return '<button type="button" class="imp-chip' + (filter === t[0] ? ' on' : '') +
          '" data-filter="' + t[0] + '">' + t[1] + ' (' + t[2] + ')</button>';
      }).join('') + '</div>';

      if (dups === plan.length) {
        html += '<p class="small center" style="margin:14px 0">✅ כל התשלומים שבקובץ כבר רשומים באפליקציה — אין מה לייבא.</p>';
      }

      var shown = plan.map(function (r, i) { return { r: r, i: i }; }).filter(function (x) {
        return filter === 'all' || grade(x.r) === filter;
      });
      html += '<div class="imp-list">' + (shown.length ? shown.map(function (x) {
        var r = x.r, i = x.i, g = grade(r);
        var ico = r.skipped === 'duplicate' ? '<span class="imp-st dup" title="כבר קיים">⟳</span>'
          : r.skipped ? '<span class="imp-st no" title="' + UI.esc(r.status || 'סוננה') + '">!</span>'
          : g === 'sure' ? '<span class="imp-st ok" title="שויך">✓</span>'
          : g === 'guess' ? '<span class="imp-st warn" title="ממתין לאישור">✨</span>'
          : '<span class="imp-st no" title="ללא שיוך">!</span>';
        var note = r.skipped === 'duplicate' ? 'כבר רשום באפליקציה'
          : r.skipped === 'status' ? (r.status || 'בוטל')
          : r.skipped === 'total' ? 'שורת סיכום'
          : LEVEL_TEXT[r.level] || 'לא זוהה';
        var opts = '<option value=""' + (r.childId ? '' : ' selected') + '>— ללא שיוך —</option>' +
          kids.map(function (k) {
            return '<option value="' + k.id + '"' + (r.childId === k.id ? ' selected' : '') + '>' + UI.esc(childLabel(k)) + '</option>';
          }).join('');
        return '<div class="imp-row ' + g + (r.include ? '' : ' off') + '" data-i="' + i + '">' +
          '<div class="imp-top">' +
            '<label class="imp-on"><input type="checkbox" data-on="' + i + '"' + (r.include ? ' checked' : '') +
              ' aria-label="לייבא את התשלום של ' + UI.esc(r.name || 'ללא שם') + '">' +
              '<span class="imp-name">' + UI.esc(r.name || 'ללא שם') + '</span></label>' +
            '<span class="imp-amt">' + UI.money(r.amount) + '</span></div>' +
          '<div class="imp-sub"><span class="small muted">' + (r.date ? UI.dateShort(r.date) : 'ללא תאריך') +
            ' · ' + UI.esc(note) + '</span>' + ico + '</div>' +
          '<select class="input imp-pick" data-pick="' + i + '" aria-label="שיוך להורה">' + opts + '</select>' +
          '</div>';
      }).join('') : '<p class="small muted center" style="margin:14px 0">אין שורות בקטגוריה הזאת.</p>') + '</div>';

      html += '<div class="imp-cover-box">' + coverageHTML() + '</div>';

      html += '<div class="btn-row mt imp-actions">' + footHTML() + '</div>';
      return html;
    }

    /* כשיש הצעות ממתינות, הפעולה הראשית היא לאשר את כולן בבת אחת —
       זו השורה התחתונה של המסך הזה, והייבוא יורד למקום השני עד
       שהשאלה נסגרת. מופרד מהמסך כולו כדי שאפשר יהיה לצייר מחדש רק
       אותו כשמסמנים שורה, בלי להקפיץ את הגלילה. */
    function footHTML() {
      var ready = plan.filter(function (r) { return r.include; }).length;
      var guess = counts().guess;
      if (guess) {
        return '<button type="button" class="btn soft js-import">ייבוא ' + ready + ' תשלומים</button>' +
          '<button type="button" class="btn js-approve">אישור כל ההתאמות (' + guess + ')</button>';
      }
      return '<button type="button" class="btn soft js-back">קובץ אחר</button>' +
        (ready
          ? '<button type="button" class="btn js-import">ייבוא ' + ready + ' תשלומים</button>'
          : '<button type="button" class="btn js-done">סגירה</button>');
    }

    function redraw(root, close) {
      root.innerHTML = stepPreviewHTML();
      mountStepPreview(root, close);
    }

    function mountStepPreview(root, close) {
      var cols = root.querySelector('.js-cols');
      if (cols) cols.addEventListener('click', function () {
        showCols = true;
        redraw(root, close);
      });
      root.querySelectorAll('[data-filter]').forEach(function (b) {
        b.addEventListener('click', function () {
          filter = b.getAttribute('data-filter');
          redraw(root, close);
        });
      });
      root.querySelectorAll('[data-col]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          var kind = sel.getAttribute('data-col');
          if (sel.value === '') delete detected.map[kind]; else detected.map[kind] = parseInt(sel.value, 10);
          if (detected.map.amount === undefined) { UI.toast('צריך לבחור עמודת סכום'); return; }
          rebuildPlan();
          redraw(root, close);
        });
      });
      var ms = root.querySelector('[data-method]');
      if (ms) ms.addEventListener('change', function () { method = ms.value; });
      /* התיבה קובעת אם השורה נכנסת. סימון ידני גובר על הסינון
         האוטומטי — כפילות, ביטול או שורת סיכום: המשתמש ראה את
         השורה והחליט בכל זאת להכניס אותה. */
      root.querySelectorAll('[data-on]').forEach(function (box) {
        box.addEventListener('change', function () {
          var r = plan[parseInt(box.getAttribute('data-on'), 10)];
          r.include = box.checked;
          if (box.checked) r.skipped = '';
          box.closest('.imp-row').classList.toggle('off', !r.include);
          refreshFoot();
        });
      });
      /* התפריט קובע רק למי השורה שייכת. בחירה ידנית היא ראיה
         לכל דבר, ולכן היא מסלקת את סימן השאלה מהשורה. */
      root.querySelectorAll('[data-pick]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          var r = plan[parseInt(sel.getAttribute('data-pick'), 10)];
          r.childId = sel.value;
          r.approved = !!sel.value;
          if (sel.value) r.level = r.level === 'allocated' ? 'allocated' : 'manual';
          redraw(root, close);
        });
      });
      function bindMissing() {
        var mb = root.querySelector('.js-missing');
        if (mb) mb.addEventListener('click', function () { showMissing = !showMissing; refreshCover(); });
      }
      function refreshCover() {
        var box = root.querySelector('.imp-cover-box');
        if (!box) return;
        box.innerHTML = coverageHTML();
        bindMissing();
      }
      bindMissing();
      /* מאזין אחד על שורת הפעולה, שמחליט לפי הכפתור שנלחץ: הכפתורים
         מתחלפים בתפקיד לפי מצב התוכנית, וקישור מחדש בכל שינוי היה
         מזמין מאזין יתום. */
      var actions = root.querySelector('.imp-actions');
      function refreshFoot() {
        actions.innerHTML = footHTML();
        refreshCover();
      }
      actions.addEventListener('click', function (ev) {
        var btn = ev.target.closest('button');
        if (!btn) return;
        if (btn.classList.contains('js-back')) {
          rows = null; plan = null;
          root.innerHTML = stepFileHTML();
          mountStepFile(root, close);
          return;
        }
        if (btn.classList.contains('js-done')) { close(); return; }
        if (btn.classList.contains('js-approve')) {
          plan.forEach(function (r) { if (grade(r) === 'guess') { r.approved = true; r.include = true; } });
          if (filter === 'guess') filter = 'all';
          redraw(root, close);
          return;
        }
        doImport(close);
      });
    }

    function doImport(close) {
        var picked = plan.filter(function (r) {
          if (!r.include) return false;
          return !r.childId || !!Store.find('children', r.childId);
        });
        if (!picked.length) { close(); return; }
        /* שיוך שנעשה ביד נשמר על הילד, כדי שהייבוא הבא יזהה את אותו
           משלם לבד. מה שזוהה מראש לפי טלפון כבר ידוע ואין מה לזכור. */
        var learned = 0, adopted = 0;
        picked.forEach(function (r) {
          /* כל שיוך שיצא מהמסך הזה — בין שזוהה, בין שאושר ובין
             שנבחר ביד — הוא אמירה על מי משלם עבור מי, ולכן הוא
             נרשם ברשומת הילד. זה מה שגורם לייבוא הבא לזהות את אותו
             הורה לבד, במקום לשאול שוב את אותה שאלה. */
          if (r.childId) {
            var kid = Store.find('children', r.childId);
            var parents = kid && PayImport.mergeParent(kid, r);
            if (parents) { Store.update('children', r.childId, { parents: parents }); adopted++; }
          }
          /* payer — שם המשלם כפי שהוא בקובץ. הוא מה שמזהה תשלום שלא
             שויך לילד, ובלעדיו הוא היה "לא ידוע" ברשימה.
             payerPhone — הראיה החזקה לזהות: הורה שפרס לתשלומים מופיע
             בקובץ כמה פעמים, ולפעמים בשם בסדר אחר, אבל תמיד מאותו
             מספר. בלעדיו הספירה של "כמה אנשים שילמו" תלויה באיות. */
          Store.add('payments', { childId: r.childId || '', payer: r.name || '',
            payerPhone: r.phone || '', amount: r.amount,
            method: method, date: r.date || UI.todayISO(), installments: 1, note: r.note || '' });
          if (r.level !== 'phone' && r.level !== 'remembered') {
            if (Store.rememberPayer(r.childId, PayImport.keysForRecord(r))) learned++;
          }
        });
        close();
        App.render();
        refreshCard();
        UI.toast('יובאו ' + picked.length + ' תשלומים ✓' +
          (adopted ? ' · ' + adopted + (adopted === 1 ? ' הורה נוסף' : ' הורים נוספו') + ' לרשימה' : '') +
          (learned ? ' · ' + learned + ' משלמים ייזכרו לפעם הבאה' : ''));
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
      : importEnabled()
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
    /* חשוף לבדיקה, ולכל מי שרוצה לשאול אם היכולת דולקת */
    importEnabled: importEnabled,
    actions: {
      'col-tab': function (el) {
        App.setVs('colTab', el.getAttribute('data-tab'));
        App.setVs('colUnassigned', false);        // מעבר בין לשוניות מנקה את הסינון
        App.render();
      },
      'col-unassigned': function () {
        App.setVs('colTab', 'payments');
        App.setVs('colUnassigned', true);
        App.render();
      },
      'col-all-pays': function () { App.setVs('colUnassigned', false); App.render(); },
      'col-search': function (el) {
        App.setVs('colQuery', el.value);
        var pos = el.selectionStart;
        App.render();
        var again = document.querySelector('[data-input="col-search"]');
        if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) {} }
      },
      'col-open': function (el) { openChild(el.getAttribute('data-id')); },
      'col-payer': function (el) { openPayer(el.getAttribute('data-key')); },
      'payer-assign': function (el) { assignPayer(el.getAttribute('data-key')); },
      'pay-add': function (el) { payForm(null, el.getAttribute('data-child')); },
      /* גם הפעולה עצמה נבדקת: הכפתורים נעלמים כשהמתג כבוי, אבל
         הפעולה גלובלית ואסור שתישאר פתוחה מאחוריהם */
      'pay-import': function () { if (importEnabled()) importModal(); },
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
          'תזכורת מוועד ההורים של ' + (Store.state.gan.name || Lang.t('placeThe')) + ':\n\n' +
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
