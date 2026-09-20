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
    var kids = st.children.length;

    var html = UI.pageHead({
      title: 'סטטוס סוף שנה',
      subtitle: 'סיכום החזר כספי להורים',
      art: 'yearend', tone: 'pink', back: 'expenses',
      action: kids ? { act: 'ye-share', icon: '💬', text: 'שיתוף', label: 'שיתוף סיכום סוף שנה' } : null
    });

    /* ---------- כרטיס הסיכום ---------- */
    html += '<div class="summary ye-sum ' + (positive ? 'ok' : rf.pot < 0 ? 'no' : '') + '">' +
      '<div class="ye-top">' +
        '<div class="ye-main">' +
          '<div class="sum-label">' +
            (positive ? 'יתרה בקופה' : rf.pot < 0 ? 'חסר בקופה' : 'הקופה מאוזנת') + '</div>' +
          '<div class="ye-value ' + (rf.pot >= 0 ? 'pos' : 'neg') + '">' + UI.money(Math.abs(rf.pot)) + '</div>' +
        '</div>' +
        '<div class="ye-art">' + UI.art('piggy') + '</div>' +
      '</div>' +
      '<div class="stat-grid">' +
        '<div class="stat"><div class="s-val">' + UI.money(rf.collected) + '</div>' +
          '<div class="s-lab">סה״כ גבייה</div></div>' +
        '<div class="stat"><div class="s-val">' + UI.money(rf.spent) + '</div>' +
          '<div class="s-lab">סה״כ הוצאה</div></div>' +
        '<div class="stat"><div class="s-val">' + UI.money(rf.costPerUnit) + '</div>' +
          '<div class="s-lab">עלות לילד מלא</div></div>' +
      '</div>' +
    '</div>';

    if (!kids) {
      return html + UI.empty({ art: 'children', title: 'אין ילדים ברשימה',
                               text: 'הוסיפו ילדים כדי לחשב החזרים.' });
    }

    if (rf.pot === 0) {
      html += '<div class="note"><div class="n-ico">⚖️</div><div><b>אין מה להחזיר</b>' +
        'הכסף שנגבה שווה בדיוק להוצאות בפועל.</div></div>';
    } else if (rf.pot < 0) {
      html += '<div class="note" style="background:#FDF0F2"><div class="n-ico">⚠️</div><div>' +
        '<b>ההוצאות עברו את הגבייה</b>חסרים ' + UI.money(Math.abs(rf.pot)) + ' בקופה. ' +
        'בטבלה מוצג כמה כל הורה צריך להשלים, לפי אותו מפתח יחסי.</div></div>';
    }

    /* ---------- טבלה אחת: שורה לכל ילד, ובה גם ההודעה להורה ---------- */
    var anyPhone = false;

    html += '<div class="card">' +
      '<div class="card-title"><h2>פירוט החזר לכל הורה</h2>' +
        '<span class="sub">' + kids + ' ילדים</span></div>' +
      '<table class="tbl slim ye-tbl">' +
        '<thead><tr><th>ילד/ה</th><th class="end">שילם</th><th class="end">החזר</th></tr></thead>' +
        '<tbody>' +
        rf.rows.map(function (r) {
          var parent = r.child.parents && r.child.parents[0] ? r.child.parents[0] : null;
          var phone = !!(parent && parent.phone);
          if (phone) anyPhone = true;
          var back = r.balance >= 0;
          var sub = [];
          if (parent && parent.name) sub.push(parent.name);
          if (r.percent < 100) sub.push(r.percent + '% מהשנה');
          return '<tr class="ye-row"' +
              (phone ? ' data-action="ye-one" data-id="' + r.child.id + '"' : '') + '>' +
            '<td><div class="ye-who">' +
              '<div class="avatar" style="background:' + UI.toneVar(UI.toneFor(r.child.name)) + '">' +
                UI.faceFor(r.child.name) + '</div>' +
              '<div class="ye-name"><b>' + UI.esc(r.child.name) + '</b>' +
                /* שם ההורה, ואחוז ההשתתפות רק כשהוא אומר משהו — ילד שהצטרף באמצע */
                (sub.length ? '<small>' + UI.esc(sub.join(' · ')) + '</small>' : '') +
              '</div></div></td>' +
            '<td class="end ye-paid">' + UI.money(r.paid) + '</td>' +
            '<td class="end ye-back' + (back ? '' : ' neg') + '">' + UI.money(Math.abs(r.balance)) +
              (back ? '' : '<small>להשלמה</small>') + '</td>' +
            '</tr>';
        }).join('') +
        '</tbody>' +
        '<tfoot><tr>' +
          '<td><b>סה״כ</b></td>' +
          '<td class="end"><span class="ye-tot-val ye-paid">' + UI.money(rf.collected) + '</span>' +
            '<span class="ye-tot-lab">תשלומים</span></td>' +
          '<td class="end"><span class="ye-tot-val pos">' + UI.money(rf.totalRefund) + '</span>' +
            '<span class="ye-tot-lab">החזרים</span></td>' +
        '</tr></tfoot>' +
      '</table>' +
      (rf.totalOwed > 0
        ? '<div class="hint neg">מתוך אלה, ' + UI.money(rf.totalOwed) + ' עדיין להשלמה מצד הורים ששילמו פחות מחלקם.</div>'
        : '') +
      '<div class="hint">"החזר" = מה ששולם, פחות חלקו האמיתי של ההורה בהוצאות.' +
        (anyPhone ? ' לחיצה על שורה פותחת הודעת וואטסאפ להורה.' : '') + '</div>' +
    '</div>';

    /* ---------- הסבר החישוב ---------- */
    html += '<div class="card mt"><div class="card-title"><h2>איך זה מחושב?</h2></div>' +
      '<ol class="small muted" style="padding-inline-start:18px;margin:0;line-height:1.9">' +
      '<li>סוכמים את כל ההוצאות בפועל: <b>' + UI.money(rf.spent) + '</b>.</li>' +
      '<li>כל הוצאה מתחלקת בין הילדים שכבר היו ' + Lang.t('placeIn') + ' <b>בתאריך שלה</b>. ' +
      'ילד שהצטרף אחרי אותה הוצאה אינו משתתף בה כלל.</li>' +
      '<li>' + Lang.t('wasAllYear') + ' יוצא <b>' + UI.money(rf.costPerUnit) + '</b>.</li>' +
      '<li>לכל הורה מסכמים את חלקו בהוצאות שהיה נוכח בהן, ומחסרים ממה ששילם בפועל.</li>' +
      '<li>מי ששילם יותר מחלקו — מקבל החזר. מי ששילם פחות — משלים את ההפרש.</li>' +
      '</ol>' +
      '<div class="hint">ילד שהצטרף באמצע השנה אינו משלם על מה שכבר היה לפני שהגיע, ' +
      'ומשלם מחיר מלא על כל מה שבא אחריו. ההוצאות שנותרו מתחלקות בין יותר ילדים, ' +
      'ולכן שאר ההורים מקבלים החזר.</div></div>';

    return html;
  }

  function summaryText() {
    var st = Store.state;
    var rf = Calc.refunds(st);
    return (st.gan.name || 'ועד ההורים') + ' - סיכום סוף שנה\n\n' +
      'נגבה מההורים: ' + UI.money(rf.collected) + '\n' +
      'הוצאות בפועל: ' + UI.money(rf.spent) + '\n' +
      (rf.pot >= 0 ? 'יתרה להחזר: ' + UI.money(rf.pot) : 'חסר בקופה: ' + UI.money(Math.abs(rf.pot))) + '\n\n' +
      'פירוט:\n' +
      rf.rows.map(function (r) {
        return r.child.name + ' - ' +
          (r.balance >= 0 ? 'החזר ' : 'להשלים ') + UI.money(Math.abs(r.balance));
      }).join('\n') +
      '\n\nתודה על שנה נפלאה!';
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
        var text = 'היי' + (parent ? ' ' + parent.name : '') + ',\n' +
          'סיכום סוף שנה בוועד ההורים של ' + (st.gan.name || Lang.t('placeThe')) + ':\n\n' +
          'שילמתם: ' + UI.money(row.paid) + '\n' +
          'חלקכם בהוצאות בפועל: ' + UI.money(row.fairCost) +
          (row.percent < 100 ? ' (מותאם לתאריך ההצטרפות)' : '') + '\n' +
          (row.balance >= 0 ? 'מגיע לכם החזר של ' + UI.money(row.balance)
                            : 'נדרשת השלמה של ' + UI.money(-row.balance)) + '\n\n' +
          'תודה על שנה נפלאה!';
        UI.whatsapp(text, parent ? parent.phone : '');
      }
    }
  };
})();
