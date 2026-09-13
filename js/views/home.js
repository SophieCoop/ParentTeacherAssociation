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
      '<div class="ph-icon app-icon"><img src="assets/icon-192.png" alt="" width="192" height="192"></div>' +
      '<h1>ועד הורים ' + UI.esc(name) + '</h1>' +
      '<p>יחד עושים טוב לילדים ❤️ · שנת ' + UI.esc(st.gan.yearLabel || '') + '</p>' +
      (Views.account.chipHTML() ? '<div style="margin-top:8px">' + Views.account.chipHTML() + '</div>' : '') +
      '</header>';

    /* עדיין לא הוקם הגן — מציעים את אשף ההקמה במקום להסתיר אותו */
    if (!st.setupDone) {
      html += '<div class="note"><div class="n-ico">🌱</div><div>' +
        '<b>הגן עדיין לא הוקם</b>' +
        'אפשר להריץ את אשף ההקמה — פרטי הגן, ילדים, צוות ותקציב. ' +
        'אם הנתונים כבר קיימים במכשיר אחר, ודאו שהוא מחובר ומסונכרן.' +
        '<div class="btn-row mt">' +
          '<button class="btn ghost" data-action="acc-sync">🔄 סנכרון עכשיו</button>' +
          '<button class="btn" data-action="run-wizard">אשף ההקמה</button>' +
        '</div></div></div>';
    }

    /* הקופה — כמה נותר מתוך כל מה שנאסף, ומי עדיין לא שילם */
    html += potHTML(ov, col);

    /* אריחי ניווט */
    html += '<div class="tiles">' +
      tile('budget', 't-pink', 'budget', 'תקציב', money(ov.budget)) +
      tile('collection', 't-green', 'collection', 'גבייה', col.pct + '% נגבו') +
      tile('expenses', 't-yellow', 'expenses', 'הוצאות', money(ov.spent)) +
      tile('ideas', 't-purple', 'ideas', 'רעיונות', (st.ideas.length || 0) + ' רעיונות') +
      tile('children', 't-blue', 'children', 'ילדי הגן', st.children.length + ' ילדים') +
      tile('staff', 't-mint', 'staff', 'צוות הגן', st.staff.length + ' אנשי צוות') +
      tile('dates', 't-peach', 'dates', 'תאריכים', up.length ? UI.relativeDays(up[0].next) : 'אין אירועים') +
      tile('yearend', 't-pink', 'yearend', 'סוף שנה', 'חישוב החזרים') +
      '</div>';

    /* גבייה — מבט מהיר */
    html += '<div class="section-title"><span>מצב הגבייה</span>' +
      '<button class="btn sm soft" data-action="nav" data-view="collection">לפירוט</button></div>';
    html += '<button class="card tappable" data-action="nav" data-view="collection" ' +
      'aria-label="פירוט מצב הגבייה">' +
      '<div class="flex-between"><span class="small muted">נגבה ' + money(col.paid) + ' מתוך ' + money(col.due) + '</span>' +
      '<b>' + col.pct + '%</b></div>' +
      UI.bar(col.paid, col.due, col.pct >= 100 ? 'ok' : '') +
      '<div class="flex wrap mt" style="gap:8px">' +
        '<span class="badge ok">שילמו במלואו · ' + col.fullCount + '</span>' +
        '<span class="badge warn">שילמו חלקית · ' + col.partialCount + '</span>' +
        '<span class="badge no">טרם שילמו · ' + col.noneCount + '</span>' +
      '</div></button>';

    /* אירועים קרובים — כרטיס אחד, באותו מבנה שורה של עמוד התאריכים */
    if (!up.length) {
      html += '<div class="section-title"><span>אירועים קרובים</span></div>';
      html += UI.empty({ art: 'dates', title: 'אין אירועים קרובים', text: 'הוסיפו ימי הולדת ותאריכים בלשונית התאריכים.' });
    } else {
      html += '<div class="card home-events">' +
        '<div class="he-head"><h2>אירועים קרובים</h2>' +
          '<button class="btn sm soft he-all" data-action="nav" data-view="dates">לכל האירועים ' +
            UI.svgIcon('chevron', 14) + '</button></div>' +
        up.map(function (it) {
          var iso = it.next.getFullYear() + '-' + String(it.next.getMonth() + 1).padStart(2, '0') +
                    '-' + String(it.next.getDate()).padStart(2, '0');
          return '<div class="drow">' +
            '<span class="d-ico" style="background:' + UI.toneVar(it.tone) + '">' + Views.dates.dateIcon(it) + '</span>' +
            '<span class="d-body">' +
              '<span class="d-name">' + UI.esc(it.title) + '</span>' +
              '<span class="d-sub">' + UI.relativeDays(it.next) + ' · ' + UI.dateShort(iso) + '</span>' +
            '</span>' +
            Views.dates.badge(it) +
            '</div>';
        }).join('') +
        '</div>';
    }

    var synced = window.Cloud && Cloud.signedIn();
    html += '<div class="note mt"><div class="n-ico">💡</div><div>' +
      '<b>טיפ</b>' +
      (synced
        ? 'הנתונים נשמרים במכשיר וגם מסונכרנים לחשבון שלכם — אפשר להמשיך לערוך מכל מכשיר.'
        : 'כל הנתונים נשמרים במכשיר שלכם בלבד. אפשר לגבות אותם לקובץ דרך ההגדרות ⚙️') +
      '</div></div>';

    return html;
  }

  /* בעמוד הבית מוצגים שקלים שלמים, מעוגלים כלפי מטה, כדי שהמבט
     המהיר יישאר נקי. הסכומים המלאים, עם האגורות, מופיעים בשאר העמודים. */
  function money(n) {
    return UI.money(n, { floor: true });
  }

  /* כרטיס הקופה — היתרה הזמינה מתוך כל מה שנאסף מההורים,
     שיעור הניצול שלה, וכמה הורים טרם שילמו */
  function potHTML(ov, col) {
    /* האחוז נמדד מול מה שנאסף בפועל, כך שהסרגל מתאר בדיוק את שני המספרים שלמעלה */
    var usePct = ov.collected > 0 ? Math.min(100, Math.round((ov.spent / ov.collected) * 100)) : 0;
    var level = usePct >= 100 ? 'over' : (usePct >= 75 ? 'warn' : '');
    var waiting = col.noneCount;
    var hasKids = (col.rows || []).length > 0;

    return '<div class="summary pot">' +
      '<div class="pot-top">' +
        '<div class="pot-main">' +
          '<div class="pot-label">נותר בקופה</div>' +
          '<div class="pot-value ' + (ov.cashLeft >= 0 ? 'pos' : 'neg') + '">' + money(ov.cashLeft) + '</div>' +
          '<div class="pot-sub">מתוך ' + money(ov.collected) + ' שנאסף</div>' +
        '</div>' +
        '<div class="pot-art">' + UI.art('piggy') + '</div>' +
      '</div>' +
      '<div class="pot-bar">' +
        UI.bar(ov.spent, ov.collected, level) +
        '<span class="pot-pct ' + (level ? 'is-' + level : '') + '"><b>' + usePct + '%</b> נוצל</span>' +
      '</div>' +
      '<button class="pot-foot" data-action="nav" data-view="collection" aria-label="למצב הגבייה">' +
        '<span class="pf-cell">' +
          (!hasKids
            ? '<span class="pf-ico">🌱</span><span class="pf-text"><b class="lead">טרם נוספו ילדים</b></span>'
            : waiting === 0
              ? '<span class="pf-ico ok">✔</span><span class="pf-text"><b class="lead pos">כל ההורים שילמו!</b></span>'
              : '<span class="pf-ico warn">⏳</span><span class="pf-text"><b>' + money(col.remaining) + '</b>' +
                '<small>נותר לגבות</small></span>') +
        '</span>' +
        '<i class="pf-div"></i>' +
        '<span class="pf-cell">' +
          '<span class="pf-ico kids">' + UI.svgIcon('children', 24) + '</span>' +
          '<span class="pf-text"><b>' + waiting + '</b><small>הורים טרם שילמו</small></span>' +
        '</span>' +
      '</button>' +
      '</div>';
  }

  /* אריח ניווט — הטקסט מימין והאיור לצידו, כמו בעיצוב */
  function tile(view, cls, art, name, sub) {
    return '<button class="tile ' + cls + '" data-action="nav" data-view="' + view + '">' +
      '<span class="t-text"><span class="t-name">' + UI.esc(name) + '</span>' +
      '<span class="t-sub">' + UI.esc(sub) + '</span></span>' +
      '<img class="t-art" src="assets/icons/' + art + '.webp" alt="" ' +
        'width="176" height="176" loading="lazy" decoding="async">' +
      '</button>';
  }

  return { render: render, actions: {} };
})();
