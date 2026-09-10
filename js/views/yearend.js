/* ============================================================
   סוף שנה — חישוב היתרה וההחזר לכל הורה
   ההחזר יחסי לסכום ששולם בפועל, כך שילדים שהצטרפו באמצע שנה
   מקבלים החזר בהתאם לאחוז ההשתתפות שלהם
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.yearend = (function () {

  function render() {
    var st = Store.state;
    var rf = Calc.refunds(st);
    var positive = rf.pot > 0;

    var html = UI.pageHead({
      title: 'סטטוס סוף שנה',
      subtitle: 'חישוב ההחזר להורים',
      icon: '🎈', tone: 'pink', back: 'expenses'
    });

    html += '<div class="note"><div class="n-ico">💗</div><div><b>חישוב החזר להורים</b>' +
      'בסוף השנה יש לחשב מה להחזיר לכל הורה, תוך התחשבות בילדים שהצטרפו באמצע שנה ' +
      'ובאחוז ההשתתפות המופחת שלהם.</div></div>';

    html += '<div class="summary" style="background:' + (positive ? 'var(--green)' : (rf.pot < 0 ? 'var(--pink)' : '#fff')) + '">' +
      '<div class="sum-label">' + (positive ? 'יתרה בקופה' : rf.pot < 0 ? 'חסר בקופה' : 'הקופה מאוזנת') + '</div>' +
      '<div class="sum-value">' + UI.money(Math.abs(rf.pot)) + '</div>' +
      '<div class="stat-grid">' +
        '<div class="stat"><div class="s-val">' + UI.money(rf.collected) + '</div><div class="s-lab">נגבה</div></div>' +
        '<div class="stat"><div class="s-val">' + UI.money(rf.spent) + '</div><div class="s-lab">הוצא</div></div>' +
        '<div class="stat"><div class="s-val">' + UI.money(rf.costPerUnit) + '</div><div class="s-lab">עלות לילד מלא</div></div>' +
      '</div>' +
      '<div class="flex-between mt small">' +
        '<span class="pos">💗 סה״כ להחזר: <b>' + UI.money(rf.totalRefund) + '</b></span>' +
        (rf.totalOwed > 0 ? '<span class="neg">להשלמה: <b>' + UI.money(rf.totalOwed) + '</b></span>' : '') +
      '</div></div>';

    if (!st.children.length) {
      return html + UI.empty({ icon: '🧒', title: 'אין ילדים ברשימה', text: 'הוסיפו ילדים כדי לחשב החזרים.' });
    }

    if (rf.pot === 0) {
      html += '<div class="note"><div class="n-ico">⚖️</div><div><b>אין מה להחזיר</b>' +
        'הכסף שנגבה שווה בדיוק להוצאות בפועל.</div></div>';
    } else if (rf.pot < 0) {
      html += '<div class="note" style="background:#FDF0F2"><div class="n-ico">⚠️</div><div>' +
        '<b>ההוצאות עברו את הגבייה</b>חסרים ' + UI.money(Math.abs(rf.pot)) + ' בקופה. ' +
        'בטבלה מוצג כמה כל הורה צריך להשלים, לפי אותו מפתח יחסי.</div></div>';
    }

    html += '<div class="section-title"><span>פירוט לכל הורה</span>' +
      '<button class="btn sm soft" data-action="ye-share">💬 שיתוף</button></div>';

    html += '<div class="card"><div class="scroll-x"><table class="tbl wide">' +
      '<thead><tr><th>ילד/ה</th><th class="end">מאזן</th><th class="end">שולם</th>' +
      '<th class="end">חלקו בהוצאות</th><th class="end">%</th></tr></thead><tbody>' +
      rf.rows.map(function (r) {
        return '<tr><td>' + UI.esc(r.child.name) + '</td>' +
          '<td class="end ' + (r.balance >= 0 ? 'pos' : 'neg') + '"><b>' +
            (r.balance >= 0 ? 'החזר ' : 'להשלים ') + UI.money(Math.abs(r.balance)) + '</b></td>' +
          '<td class="end' + (r.paid > r.due + 0.5 ? ' over-paid' : '') + '">' + UI.money(r.paid) + '</td>' +
          '<td class="end">' + UI.money(r.fairCost) + '</td>' +
          '<td class="end">' + r.percent + '%</td></tr>';
      }).join('') +
      '<tr style="background:var(--primary-soft)"><td><b>סה״כ</b></td>' +
      '<td class="end pos"><b>' + UI.money(rf.totalRefund) + '</b></td>' +
      '<td class="end"><b>' + UI.money(rf.collected) + '</b></td>' +
      '<td class="end"><b>' + UI.money(rf.spent) + '</b></td><td></td></tr>' +
      '</tbody></table></div>' +
      '<p class="hint">"מאזן" = מה ששולם פחות חלקו האמיתי של ההורה בהוצאות.</p></div>';

    /* כרטיסי הורים */
    html += '<div class="section-title"><span>כרטיסי החזר</span></div>';
    html += rf.rows.map(function (r) {
      var parent = r.child.parents && r.child.parents[0] ? r.child.parents[0] : null;
      return '<div class="row">' +
        '<div class="avatar" style="background:' + UI.toneVar(UI.toneFor(r.child.name)) + '">' + UI.faceFor(r.child.name) + '</div>' +
        '<div class="r-body"><div class="r-name">' + UI.esc(parent ? parent.name : r.child.name) + '</div>' +
        '<div class="r-sub" style="white-space:normal">' + UI.esc(r.child.name) +
        (r.percent < 100 ? ' · ' + r.percent + '%' : '') +
        ' · שילם ' + UI.money(r.paid) + ' · חלקו ' + UI.money(r.fairCost) + '</div></div>' +
        '<div class="r-end"><div class="r-amount ' + (r.balance >= 0 ? 'pos' : 'neg') + '">' +
        UI.money(Math.abs(r.balance)) + '</div>' +
        '<div class="r-pct">' + (r.balance >= 0 ? 'להחזר' : 'להשלמה') + '</div>' +
        (parent && parent.phone ? '<button class="btn sm soft" style="margin-top:4px;padding:4px 10px" ' +
          'data-action="ye-one" data-id="' + r.child.id + '">💬</button>' : '') + '</div></div>';
    }).join('');

    /* הסבר החישוב */
    html += '<div class="card mt"><div class="card-title"><h2>איך זה מחושב?</h2></div>' +
      '<ol class="small muted" style="padding-inline-start:18px;margin:0;line-height:1.9">' +
      '<li>סוכמים את כל ההוצאות בפועל: <b>' + UI.money(rf.spent) + '</b>.</li>' +
      '<li>מחלקים אותן ביחידות ההשתתפות (' + rf.units.toFixed(2) + ') — ילד מלא = 1, ' +
      'ילד שהצטרף באמצע שנה = החלק היחסי שלו. יוצא <b>' + UI.money(rf.costPerUnit) + '</b> לילד מלא.</li>' +
      '<li>לכל הורה מחשבים את חלקו האמיתי בהוצאות לפי האחוז שלו, ומחסרים ממה ששילם בפועל.</li>' +
      '<li>מי ששילם יותר מחלקו — מקבל החזר. מי ששילם פחות — משלים את ההפרש.</li>' +
      '</ol>' +
      '<div class="hint">כך ילד שהצטרף באמצע שנה משלם ומקבל בחזרה רק לפי אחוז ההשתתפות שלו.</div></div>';

    return html;
  }

  function summaryText() {
    var st = Store.state;
    var rf = Calc.refunds(st);
    return '🎈 *' + (st.gan.name || 'ועד ההורים') + ' — סיכום סוף שנה*\n\n' +
      '💰 נגבה מההורים: ' + UI.money(rf.collected) + '\n' +
      '🧾 הוצאות בפועל: ' + UI.money(rf.spent) + '\n' +
      (rf.pot >= 0 ? '💗 יתרה להחזר: ' + UI.money(rf.pot) : '⚠️ חסר בקופה: ' + UI.money(Math.abs(rf.pot))) + '\n\n' +
      '*פירוט:*\n' +
      rf.rows.map(function (r) {
        return '• ' + r.child.name + (r.percent < 100 ? ' (' + r.percent + '%)' : '') + ' — ' +
          (r.balance >= 0 ? 'החזר ' : 'להשלים ') + UI.money(Math.abs(r.balance));
      }).join('\n') +
      '\n\nתודה על שנה נפלאה! ❤️';
  }

  return {
    render: render,
    actions: {
      'ye-share': function () {
        var text = summaryText();
        UI.modal({
          title: 'שיתוף סיכום סוף שנה',
          body: '<pre class="card flat small" style="white-space:pre-wrap;font-family:inherit;margin-bottom:14px">' + UI.esc(text) + '</pre>' +
            '<div class="btn-row"><button class="btn ghost js-copy">📋 העתקה</button>' +
            '<button class="btn wa js-wa">💬 וואטסאפ</button></div>',
          onMount: function (root, close) {
            root.querySelector('.js-copy').addEventListener('click', function () { UI.copyText(text); });
            root.querySelector('.js-wa').addEventListener('click', function () { UI.whatsapp(text); close(); });
          }
        });
      },
      'ye-one': function (el) {
        var st = Store.state;
        var rf = Calc.refunds(st);
        var id = el.getAttribute('data-id');
        var row = rf.rows.filter(function (r) { return r.child.id === id; })[0];
        if (!row) return;
        var parent = row.child.parents && row.child.parents[0] ? row.child.parents[0] : null;
        var text = 'היי' + (parent ? ' ' + parent.name : '') + ' 🌸\n' +
          'סיכום סוף שנה בוועד ההורים של ' + (st.gan.name || 'הגן') + ':\n' +
          'שילמתם ' + UI.money(row.paid) +
          (row.percent < 100 ? ' (' + row.percent + '% — הצטרפות באמצע השנה)' : '') + '\n' +
          'חלקכם בהוצאות בפועל: ' + UI.money(row.fairCost) + '\n' +
          (row.balance >= 0 ? 'מגיע לכם החזר של ' + UI.money(row.balance)
                            : 'נדרשת השלמה של ' + UI.money(-row.balance)) + '\n' +
          'תודה על שנה נפלאה! ❤️';
        UI.whatsapp(text, parent ? parent.phone : '');
      }
    }
  };
})();
