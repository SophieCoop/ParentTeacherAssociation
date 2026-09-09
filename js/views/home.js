/* ============================================================
   מסך הבית — מבט על, אריחי ניווט ואירועים קרובים
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.home = (function () {

  function render() {
    var st = Store.state;
    var ov = Calc.overview(st);
    var col = Calc.collectionSummary(st);
    var up = Calc.upcoming(st, 4);
    var name = st.gan.name || 'הגן שלנו';

    var html = '';

    /* כותרת מותאמת אישית */
    html += '<header class="pagehead" style="--tint:var(--purple)">' +
      '<button class="head-action" data-action="nav" data-view="settings" aria-label="הגדרות">⚙️</button>' +
      '<div class="ph-icon">🌈</div>' +
      '<h1>ועד הורים ' + UI.esc(name) + '</h1>' +
      '<p>יחד עושים טוב לילדים ❤️ · שנת ' + UI.esc(st.gan.yearLabel || '') + '</p>' +
      '</header>';

    /* סיכום כספי */
    html += '<div class="summary">' +
      '<div class="sum-top">' +
        '<div><div class="sum-label">תקציב שנתי מתוכנן</div>' +
        '<div class="sum-value">' + UI.money(ov.budget) + '</div>' +
        '<div class="small ' + (ov.budgetLeft >= 0 ? 'pos' : 'neg') + '">נותר לניצול: ' + UI.money(ov.budgetLeft) + '</div></div>' +
        UI.donut([
          { value: ov.spent, color: UI.toneHex('pink') },
          { value: Math.max(0, ov.budgetLeft), color: '#EFEAF3' }
        ], ov.usePct + '%', 'נוצל') +
      '</div>' +
      '<div class="stat-grid">' +
        '<div class="stat"><div class="s-val">' + UI.money(ov.collected) + '</div><div class="s-lab">נגבה מההורים</div></div>' +
        '<div class="stat"><div class="s-val">' + UI.money(ov.spent) + '</div><div class="s-lab">הוצאות בפועל</div></div>' +
        '<div class="stat"><div class="s-val ' + (ov.cashLeft >= 0 ? 'pos' : 'neg') + '">' + UI.money(ov.cashLeft) + '</div><div class="s-lab">בקופה</div></div>' +
      '</div>' +
      '</div>';

    /* אריחי ניווט */
    html += '<div class="tiles">' +
      tile('budget', 't-pink', '🧮', 'תקציב', UI.money(ov.budget)) +
      tile('collection', 't-green', '💰', 'גבייה', col.pct + '% נגבו') +
      tile('expenses', 't-yellow', '🧾', 'הוצאות', UI.money(ov.spent)) +
      tile('ideas', 't-purple', '💡', 'רעיונות', (st.ideas.length || 0) + ' רעיונות') +
      tile('children', 't-blue', '🧒', 'ילדי הגן', st.children.length + ' ילדים') +
      tile('staff', 't-mint', '👩‍🏫', 'צוות הגן', st.staff.length + ' אנשי צוות') +
      tile('dates', 't-peach', '📅', 'תאריכים', up.length ? UI.relativeDays(up[0].next) : 'אין אירועים') +
      tile('yearend', 't-pink', '🎈', 'סוף שנה', 'חישוב החזרים') +
      '</div>';

    /* גבייה — מבט מהיר */
    html += '<div class="section-title"><span>מצב הגבייה</span>' +
      '<button class="btn sm soft" data-action="nav" data-view="collection">לפירוט</button></div>';
    html += '<div class="card">' +
      '<div class="flex-between"><span class="small muted">נגבה ' + UI.money(col.paid) + ' מתוך ' + UI.money(col.due) + '</span>' +
      '<b>' + col.pct + '%</b></div>' +
      UI.bar(col.paid, col.due, col.pct >= 100 ? 'ok' : '') +
      '<div class="flex wrap mt" style="gap:8px">' +
        '<span class="badge ok">שילמו במלואו · ' + col.fullCount + '</span>' +
        '<span class="badge warn">שילמו חלקית · ' + col.partialCount + '</span>' +
        '<span class="badge no">טרם שילמו · ' + col.noneCount + '</span>' +
      '</div></div>';

    /* אירועים קרובים */
    html += '<div class="section-title"><span>אירועים קרובים</span>' +
      '<button class="btn sm soft" data-action="nav" data-view="dates">ללוח השנה</button></div>';
    if (!up.length) {
      html += UI.empty({ icon: '📅', title: 'אין אירועים קרובים', text: 'הוסיפו ימי הולדת ותאריכים בלשונית התאריכים.' });
    } else {
      html += up.map(function (it) {
        return '<div class="row tinted" style="background:' + UI.toneVar(it.tone) + '">' +
          '<div class="r-ico" style="background:rgba(255,255,255,.7)">' + it.icon + '</div>' +
          '<div class="r-body"><div class="r-name">' + UI.esc(it.title) + '</div>' +
          '<div class="r-sub" style="color:inherit;opacity:.7">' + UI.dateShort(
            it.next.getFullYear() + '-' + String(it.next.getMonth() + 1).padStart(2, '0') + '-' + String(it.next.getDate()).padStart(2, '0')
          ) + '</div></div>' +
          '<div class="r-end"><span class="badge" style="background:rgba(255,255,255,.75)">' + UI.relativeDays(it.next) + '</span></div>' +
          '</div>';
      }).join('');
    }

    html += '<div class="note mt"><div class="n-ico">💡</div><div>' +
      '<b>טיפ</b>כל הנתונים נשמרים במכשיר שלכם בלבד. אפשר לגבות אותם לקובץ דרך ההגדרות ⚙️' +
      '</div></div>';

    return html;
  }

  function tile(view, cls, ico, name, sub) {
    return '<button class="tile ' + cls + '" data-action="nav" data-view="' + view + '">' +
      '<div class="t-ico">' + ico + '</div>' +
      '<div><div class="t-name">' + UI.esc(name) + '</div><div class="t-sub">' + UI.esc(sub) + '</div></div>' +
      '</button>';
  }

  return { render: render, actions: {} };
})();
