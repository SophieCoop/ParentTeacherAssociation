/* ============================================================
   תכנון תקציב — הגדרות הוועד, סעיפי הוצאה מתוכננים וסיכום
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.budget = (function () {

  function catOptions() {
    return Store.state.categories.map(function (c) {
      return { value: c.id, label: c.icon + '  ' + c.name };
    });
  }

  /* ---------- לשונית: הגדרות ---------- */
  function tabSettings() {
    var st = Store.state;
    var levels = {};
    st.staff.forEach(function (t) { levels[t.level] = (levels[t.level] || 0) + 1; });
    var full = st.children.filter(function (c) { return Calc.sharePercentOf(st, c) >= 100; }).length;
    var partial = st.children.length - full;

    var f = Calc.budgetFrame(st);
    var html = '';

    /* הכיוון שבו הוועד עובד — הדבר הראשון בהגדרות, כי הוא משנה את
       משמעות כל המספרים שמתחתיו */
    if (Calc.budgetDirectionsOn()) html += '<div class="card">' +
      '<div class="card-title"><h2>כיוון העבודה</h2>' +
      '<button class="btn sm soft" data-action="bud-collect">' +
        (f.mode === 'collect' ? 'שינוי הסכום' : 'קביעת סכום') + '</button></div>' +
      (f.mode === 'collect'
        ? '<div class="flex-between">' +
            '<div><div class="sum-value">' + UI.money(f.perChild) + '</div>' +
            '<div class="small muted">נגבה מכל ילד</div></div>' +
            '<span class="badge ok">גבייה קודם</span>' +
          '</div>' +
          '<div class="hint mt">התקציב הזמין הוא ' + UI.money(f.available) + ', וסעיפי ההוצאה נמדדים מולו. ' +
            'ביטול הסכום יחזיר את הגבייה להיגזר מהתכנון.</div>'
        : '<div class="flex-between">' +
            '<div><div class="sum-value">' + UI.money(f.perChildPlanned) + '</div>' +
            '<div class="small muted">נגזר לכל ילד מהתכנון</div></div>' +
            '<span class="badge info">תכנון קודם</span>' +
          '</div>' +
          '<div class="hint mt">הגבייה נגזרת מסעיפי ההוצאה ומתעדכנת עם כל שינוי. ' +
            'אפשר במקום זאת לקבוע סכום גבייה מראש ולתכנן בתוכו.</div>') +
      '</div>';

    html += '<div class="card">' +
      '<div class="card-title"><h2>' + Lang.t('childrenCount') + '</h2>' +
      '<button class="btn sm soft" data-action="nav" data-view="children">ניהול הרשימה</button></div>' +
      '<div class="flex-between">' +
        '<div><div class="sum-value">' + Calc.childCount(st) + '</div>' +
        '<div class="small muted">ילדים רשומים</div></div>' +
        '<div class="flex" style="gap:6px">' +
          '<span class="badge ok">' + full + ' מלא</span>' +
          (partial ? '<span class="badge warn">' + partial + ' יחסי</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="hint mt">אפשר לעדכן את הרשימה בכל שלב — התקציב לכל הורה מתעדכן אוטומטית.</div>' +
      '</div>';

    html += '<div class="card">' +
      '<div class="card-title"><h2>' + Lang.t('staffTeam') + ' <span class="sub">אופציונלי</span></h2>' +
      '<button class="btn sm soft" data-action="nav" data-view="staff">ניהול הצוות</button></div>' +
      '<div class="flex-between">' +
        '<div><div class="sum-value">' + Calc.staffCount(st) + '</div>' +
        '<div class="small muted">אנשי צוות</div></div>' +
      '</div>' +
      (st.staff.length ? '<div class="flex wrap mt" style="gap:6px">' +
        Store.STAFF_LEVELS.filter(function (l) { return levels[l.id]; }).map(function (l) {
          return '<span class="badge" style="background:' + UI.toneVar(l.tone) + ';color:' + UI.toneInk(l.tone) + '">' +
            l.icon + ' ' + l.name + ' · ' + levels[l.id] + '</span>';
        }).join('') + '</div>' : '<div class="hint mt">ההיררכיה עוזרת לחלק מתנות לפי תפקידים.</div>') +
      '</div>';

    html += '<div class="card">' +
      '<div class="card-title"><h2>שנת הלימודים</h2></div>' +
      '<div class="grid-2">' +
        '<div class="field mb0"><label>תחילת שנה</label>' +
          '<input class="input" type="date" data-change="bud-set" data-key="yearStart" value="' + UI.esc(st.settings.yearStart) + '"></div>' +
        '<div class="field mb0"><label>סוף שנה</label>' +
          '<input class="input" type="date" data-change="bud-set" data-key="yearEnd" value="' + UI.esc(st.settings.yearEnd) + '"></div>' +
      '</div>' +
      '<div class="hint mt">התאריכים האלה קובעים את חודשי הפעילות של סעיפים חודשיים, ' +
      'ואת ברירת המחדל לתאריך ההצטרפות של ילד חדש.</div>' +
      '</div>';

    return html;
  }

  /* ---------- לשונית: סעיפי תקציב ---------- */

  /* הרשימה מחולקת לפי קהל היעד, עם קו הפרדה וסכום ביניים לכל קבוצה */
  /* נבנית בכל ציור ולא פעם אחת, כי הניסוח תלוי בסוג הוועד וזה נקבע
     אחרי טעינת הסקריפטים */
  function groups() {
    return [
      { id: 'children',  icon: '🧒',    name: 'מתנות לילדים',
        desc: 'ימי הולדת, מתנות אישיות ואירועים לילדים' },
      { id: 'staff_edu', icon: '👩‍🏫',  name: 'מתנות לצוות החינוכי',
        desc: Lang.t('staffGifts') },
      { id: '',          icon: '💰',    name: 'סעיפים כלליים',
        desc: 'הוצאות שאינן מתחלקות לפי נפש' }
    ];
  }

  function groupHead(group, sum, count) {
    return '<div class="group-head">' +
      '<div class="gh-top">' +
        '<span class="g-label">' + group.icon + ' ' + UI.esc(group.name) + '</span>' +
        '<span class="g-line"></span>' +
        '<span class="g-sum">' + count + (count === 1 ? ' סעיף' : ' סעיפים') + ' · ' + UI.money(sum) + '</span>' +
      '</div>' +
      (group.desc ? '<div class="g-desc">' + UI.esc(group.desc) + '</div>' : '') +
      '</div>';
  }

  function itemRow(st, b) {
    var cat = Store.category(b.categoryId);
    var amount = Calc.itemAmount(st, b);
    var bd = Calc.itemBreakdown(st, b);
    var per = '';
    if (bd.perPerson || bd.monthly) {
      var bits = [UI.money(bd.rate)];
      if (bd.perPerson) bits.push('× ' + Calc.audienceLabel(bd.audience, bd.count));
      if (bd.monthly)   bits.push('× ' + bd.months + ' ח׳');
      if (bd.customWindow) {
        var pr = Calc.validPeriods(b);
        bits.push(pr.length > 1
          ? '(' + pr.length + ' תקופות)'
          : '(' + UI.dateDayMonth(pr.length ? pr[0].start : b.startDate) + '–' +
            UI.dateDayMonth(pr.length ? pr[0].end : b.endDate) + ')');
      }
      per = bits.join(' ');
    }
    return '<div class="bitem">' +
      '<button class="bi-main" data-action="budget-edit" data-id="' + b.id + '">' +
        '<span class="bi-ico" style="background:' + UI.toneVar(cat.tone) + '">' + UI.catIcon(cat) + '</span>' +
        '<span class="bi-body">' +
          '<span class="bi-name">' + UI.esc(b.title || cat.name) + '</span>' +
          (b.date ? '<span class="bi-date">🗓 ' + UI.dateShort(b.date) + '</span>' : '') +
          '<span class="bi-sub">' + (per ? per + ' · ' : '') + UI.esc(cat.name) + '</span>' +
        '</span>' +
        '<span class="bi-end"><b class="bi-amount">' + UI.money(amount) + '</b>' +
          '<span class="bi-chev">' + UI.svgIcon('chevron', 16) + '</span></span>' +
      '</button>' +
      '</div>';
  }

  /* ניהול הקטגוריות — יושב בלשונית התכנון, גם כשעוד אין סעיפים */
  function categoryManager(st) {
    return '<div class="section-title"><span>ניהול קטגוריות</span>' +
      UI.addBtn({ act: 'cat-add', label: 'הוספת קטגוריה', cls: 'soft sm' }) + '</div>' +
      '<div class="card"><div class="flex wrap" style="gap:8px">' +
      st.categories.map(function (c) {
        return '<button class="chip" data-action="cat-edit" data-id="' + c.id + '" ' +
          'style="background:' + UI.toneVar(c.tone) + ';color:' + UI.toneInk(c.tone) + '">' + UI.catIcon(c) + ' ' + UI.esc(c.name) + '</button>';
      }).join('') +
      '</div></div>';
  }

  /* ============================================================
     המסגרת התקציבית — הכרטיס שבראש מסך התכנון
     ------------------------------------------------------------
     שני ועדים עובדים בשני כיוונים הפוכים, ואותו מסך משרת את שניהם:

     תכנון קודם — מוסיפים סעיפי הוצאה, והמסך אומר כמה זה יוצא לכל
     ילד. זו הגבייה הנגזרת, והיא מתעדכנת עם כל סעיף.

     גבייה קודם — קובעים כמה גובים מכל הורה, והמסך הופך למד: כמה
     מהסכום כבר תוכנן וכמה נשאר לתכנן.

     ההכרעה בין הכיוונים אינה שאלה שנשאלת — היא נגזרת ממה שכבר
     הוזן (Calc.budgetFrame), וניתנת לשינוי בכל רגע.
     ============================================================ */
  function kidsChip(n) {
    return '<div class="bf-kids"><span class="bf-kids-n">' + n + '</span>' +
           '<span class="bf-kids-l">ילדים</span></div>';
  }

  function frameCard(st) {
    if (!Calc.budgetDirectionsOn()) return '';
    var f = Calc.budgetFrame(st);

    /* ---- גבייה קודם: הסכום ידוע, והתקציב נמדד מולו ---- */
    if (f.mode === 'collect') {
      var over = f.remaining < -0.5;
      return '<div class="bframe is-collect">' +
        '<div class="bf-top">' +
          '<div class="bf-main">' +
            '<div class="bf-ico">🪙</div>' +
            '<div><div class="bf-lab">התקציב הזמין</div>' +
            '<div class="bf-val">' + UI.money(f.available) + '</div>' +
            '<div class="bf-sub">' + UI.money(f.perChild) + ' × ' + f.kids + ' ילדים</div></div>' +
          '</div>' +
          '<div class="bf-side">' + kidsChip(f.kids) +
            '<button class="linkbtn bf-edit" data-action="bud-collect">✏️ עריכת גבייה</button>' +
          '</div>' +
        '</div>' +
        '<div class="bf-meter">' +
          '<div class="flex-between"><b>' + f.pct + '%</b>' +
            '<span class="small ' + (over ? 'neg' : 'muted') + '">' +
              (over ? 'חריגה של ' + UI.money(-f.remaining) : 'נותר לתכנון: ' + UI.money(f.remaining)) +
            '</span></div>' +
          UI.bar(f.planned, f.available, over ? 'over' : 'ok') +
          '<div class="small muted">תוכנן ' + UI.money(f.planned) + '</div>' +
        '</div>' +
        '</div>';
    }

    /* ---- תכנון קודם, ועוד אין סעיפים ---- */
    if (!f.items) {
      return '<div class="bframe">' +
        '<div class="bf-top"><div class="bf-main">' +
          '<div class="bf-ico">📊</div>' +
          '<div><div class="bf-lab">עדיין לא נוסף אף סעיף</div>' +
          '<div class="bf-sub">התחילו להוסיף סעיפי הוצאה כדי לבנות את התקציב</div></div>' +
        '</div></div>' +
        '<div class="bf-hint"><span>💡</span><div>לאחר שתוסיפו סעיפים, נחשב עבורכם את הסכום המומלץ לגבייה לכל ילד. ' +
          '<button class="linkbtn" data-action="bud-collect">או שתקבעו את סכום הגבייה מראש</button></div></div>' +
        '</div>';
    }

    /* ---- תכנון קודם, תוך כדי עבודה ---- */
    return '<div class="bframe">' +
      '<div class="bf-top">' +
        '<div class="bf-main">' +
          '<div class="bf-ico">📊</div>' +
          '<div><div class="bf-lab">התקציב שנבנה עד עכשיו</div>' +
          '<div class="bf-val">' + UI.money(f.planned) + '</div></div>' +
        '</div>' +
        kidsChip(f.kids) +
      '</div>' +
      '<button class="bf-per" data-action="bud-per-info">' +
        '<div><div class="bf-lab">על בסיס התכנון הנוכחי</div>' +
        '<div class="bf-per-val">כ-' + UI.money(f.perChildPlanned) + ' לילד</div></div>' +
        '<span class="bf-i">i</span>' +
      '</button>' +
      '</div>';
  }

  function tabItems() {
    var st = Store.state;
    var items = st.budgetItems.slice().sort(function (a, b) {
      return (a.date || '9999').localeCompare(b.date || '9999');
    });
    var total = Calc.budgetTotal(st);

    var html = frameCard(st);

    /* עם העזר, תקציב ריק פותח בהזמנה לבנות אותו יחד, וההוספה הידנית
       יורדת לקישור משני בתוכה */
    if (wizOn() && !items.length) return html + wizEmptyCard() + categoryManager(st);
    if (wizOn()) html += wizHelpCard(st);

    html += UI.addBtn({ act: 'budget-add', label: 'הוספת סעיף הוצאה', cls: 'mb-add' });

    if (!items.length) {
      return html + UI.empty({
        art: 'budget', title: 'עוד לא תכננתם תקציב',
        text: 'הוסיפו סעיפי הוצאה מתוך הקטגוריות — מתנות, כיבוד, חוגים ועוד.'
      }) + categoryManager(st);
    }

    groups().forEach(function (g) {
      var group = items.filter(function (b) { return (b.audience || '') === g.id; });
      if (!group.length) return;
      var sum = group.reduce(function (acc, b) { return acc + Calc.itemAmount(st, b); }, 0);
      html += groupHead(g, sum, group.length);
      html += group.map(function (b) { return itemRow(st, b); }).join('');
    });

    html += '<div class="row" style="background:var(--primary-soft);box-shadow:none;margin-top:18px">' +
      '<div class="r-ico has-art" style="background:#fff">' + UI.art('budget') + '</div>' +
      '<div class="r-body"><div class="r-name">סה״כ כל הקטגוריות</div>' +
      '<div class="r-sub">' + items.length + ' סעיפים</div></div>' +
      '<div class="r-end"><div class="r-amount">' + UI.money(total) + '</div></div></div>';

    html += categoryManager(st);
    return html;
  }

  /* ---------- לשונית: סיכום ---------- */

  /* בפילוח לפי קטגוריה, לחיצה על קטגוריה פותחת את הסעיפים שבה —
     למשל פסח וחנוכה תחת "מתנה לחג". כל סעיף נפתח לעריכה. */
  var AUD_LABEL = { children: 'לילדים', staff_edu: 'לצוות החינוכי' };

  function summaryItemRow(st, b) {
    var amount = Calc.itemAmount(st, b);
    var bd = Calc.itemBreakdown(st, b);
    var bits = [];
    if (AUD_LABEL[b.audience]) bits.push(AUD_LABEL[b.audience]);
    if (bd.perPerson) bits.push(UI.money(bd.rate) + ' × ' + Calc.audienceLabel(bd.audience, bd.count));
    if (bd.monthly) bits.push(bd.months + ' חודשים');
    if (b.date) bits.push(UI.dateShort(b.date));
    return '<button class="bcat-item" data-action="budget-edit" data-id="' + b.id + '">' +
      '<span class="bi-body"><span class="bi-name">' + UI.esc(b.title || Store.category(b.categoryId).name) + '</span>' +
        (bits.length ? '<span class="bi-sub">' + bits.join(' · ') + '</span>' : '') +
      '</span>' +
      '<b class="bi-amount">' + UI.money(amount) + '</b>' +
      '</button>';
  }

  function tabSummary() {
    var st = Store.state;
    var total = Calc.budgetTotal(st);
    var byCat = Calc.budgetByCategory(st);
    var spentByCat = Calc.expensesByCategory(st);
    var spent = Calc.expensesTotal(st);
    var perFull = Calc.fullChildShare(st);
    var units = Calc.totalShareUnits(st);

    var cats = st.categories.filter(function (c) { return byCat[c.id]; })
      .sort(function (a, b) { return byCat[b.id] - byCat[a.id]; });

    var html = '<div class="summary">' +
      '<div class="sum-top">' +
        '<div><div class="sum-label">סה״כ תקציב מתוכנן</div>' +
        '<div class="sum-value">' + UI.money(total) + '</div>' +
        '<div class="small muted">' + st.budgetItems.length + ' סעיפים · ' + cats.length + ' קטגוריות</div></div>' +
        UI.donut(cats.map(function (c) {
          return { value: byCat[c.id], color: UI.toneHex(c.tone) };
        }), UI.money(total).replace(' ₪', ''), '₪ סה״כ') +
      '</div>' +
      '<div class="stat-grid">' +
        '<div class="stat tone-pink"><div class="s-val">' + UI.money(spent) + '</div><div class="s-lab">הוצא בפועל</div></div>' +
        '<div class="stat tone-green"><div class="s-val ' + (total - spent >= 0 ? 'pos' : 'neg') + '">' + UI.money(total - spent) + '</div><div class="s-lab">נותר</div></div>' +
        '<div class="stat tone-purple"><div class="s-val">' + UI.money(perFull) + '</div><div class="s-lab">לילד מלא</div></div>' +
      '</div></div>';

    html += '<div class="note"><div class="n-ico">' + UI.art('budget') + '</div><div><b>כמה כל הורה משלם?</b>' +
      Lang.t('splitByDate') + ' ילד שהיה ' + Lang.t('placeIn') + ' מתחילת השנה ' +
      'משלם ' + UI.money(perFull) + ', וילד שהצטרף באמצע משלם רק על מה שבא אחריו.</div></div>';

    html += '<div class="section-title"><span>פילוח לפי קטגוריה</span></div>';

    if (!cats.length) {
      html += UI.empty({ icon: '🥧', title: 'אין עדיין נתונים לפילוח', text: 'הוסיפו סעיפי תקציב כדי לראות את החלוקה.' });
    } else {
      var open = App.vs('budgetOpenCats', {});
      var itemsByCat = {};
      st.budgetItems.forEach(function (b) { (itemsByCat[b.categoryId] = itemsByCat[b.categoryId] || []).push(b); });
      html += cats.map(function (c) {
        var amt = byCat[c.id] || 0;
        var used = spentByCat[c.id] || 0;
        var share = total > 0 ? (amt / total) * 100 : 0;
        var list = (itemsByCat[c.id] || []).slice().sort(function (a, b) {
          return (a.date || '9999').localeCompare(b.date || '9999');
        });
        var isOpen = !!open[c.id];
        return '<div class="card sumcat' + (isOpen ? ' open' : '') + '">' +
          '<button class="sumcat-head" data-action="budget-cat" data-id="' + c.id + '" ' +
            'aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
            '<div class="flex-between">' +
              '<div class="flex"><span class="r-ico" style="background:' + UI.toneVar(c.tone) + '">' + UI.catIcon(c) + '</span>' +
              '<div><div class="r-name">' + UI.esc(c.name) + '</div>' +
              '<div class="r-sub">' + share.toFixed(1) + '% מהתקציב · הוצא ' + UI.money(used) + '</div></div></div>' +
              '<div class="sc-end"><b class="nowrap">' + UI.money(amt) + '</b>' +
                '<span class="sc-chev">' + UI.svgIcon('chevron', 16) + '</span></div>' +
            '</div>' +
            UI.bar(used, amt, used > amt ? 'over' : (used === amt ? 'ok' : 'thin')) +
          '</button>' +
          (isOpen
            ? '<div class="bcat-body">' +
                list.map(function (b) { return summaryItemRow(st, b); }).join('') +
                UI.addBtn({ act: 'budget-add', label: 'הוספת סעיף ל' + c.name,
                            cls: 'soft sm bcat-add', data: { category: c.id } }) +
              '</div>'
            : '') +
          '</div>';
      }).join('');
    }

    return html;
  }

  /* ============================================================
     עזר התקציב — שלושה שלבים: מה כוללים, אילו חגים, ואיך מחלקים
     ------------------------------------------------------------
     נועד בעיקר למי שגבה קודם ועכשיו צריך להחליט מה לעשות עם הסכום,
     אבל עובד גם בכיוון השני, מול סכום שמקלידים. ההצעה עצמה נבנית
     ב-BudgetPlan; כאן רק הציור, והחלת השינויים בסוף.

     המצב נשמר ב-viewState ולא ב-Store: עד האישור שום דבר לא נכתב,
     ויציאה באמצע אינה משאירה סעיפים חצי־מוכנים.
     ============================================================ */
  function wizOn() { return Calc.budgetDirectionsOn() && typeof BudgetPlan !== 'undefined'; }
  function wiz() { return wizOn() ? App.vs('budWiz', null) : null; }

  /* בכיוון התכנון אין סכום שמחייב, ולכן הנקודה ההגיונית לפתוח ממנה
     היא מה שכבר בקופה — ואם עוד לא נגבה דבר, מה שכבר תוכנן */
  function wizDefaultTotal(st) {
    var c = Math.round(Calc.collectedTotal(st));
    return c > 0 ? c : Math.round(Calc.budgetTotal(st));
  }

  function wizAvailable(st, w) {
    var f = Calc.budgetFrame(st);
    return f.mode === 'collect' ? f.available : Math.max(0, Calc.num(w.total));
  }

  function wizHasHolidays(w) { return w.picks.indexOf('holidays') > -1; }

  /* ההצעה מחושבת מחדש בכל ציור. סכום שהמשתמש ערך נשאר כל עוד
     הבסיס שלו — הבחירות, המצב והתקציב — לא זז; כשהוא זז, סכום
     שנערך מול בסיס אחר כבר אינו אומר דבר, וההצעה מתחילה מחדש. */
  function wizPlan(st, w) {
    var available = wizAvailable(st, w);
    var plan = BudgetPlan.propose(st, function (b) { return Calc.itemAmount(st, b); }, {
      picks: w.picks, holidays: w.holidays, holAud: w.holAud, mode: w.mode, available: available
    });
    var sig = [w.picks.join(','), w.holidays.join(','), JSON.stringify(w.holAud || {}), w.mode, available].join('|');
    if (w.sig !== sig) { w.sig = sig; w.amounts = {}; }
    return plan;
  }

  function wizAmount(w, row) {
    var v = w.amounts[row.id];
    return v === undefined ? row.amount : v;
  }

  function wizTotals(plan, w) {
    var rows = plan.rows.reduce(function (s, r) { return s + Calc.num(wizAmount(w, r)); }, 0);
    var sum = Math.round(plan.fixed + rows);
    return { rows: rows, sum: sum, diff: plan.available - sum };
  }

  function wizPct(v, of) { return of > 0 ? Math.round(v / of * 100) : 0; }

  function wizArt(name) {
    return '<img class="art" src="assets/icons/' + name + '.webp" alt="" width="176" height="176" decoding="async">';
  }

  /* בחירת החגים היא פירוט של "מתנות לחג" ולא שלב בפני עצמו, ולכן
     היא נספרת כחלק מהשלב הראשון */
  function wizHead(w) {
    var label = w.step === 3 ? 'שלב 2 מתוך 2' : w.step === 2 ? 'שלב 1 מתוך 2 · בחירת חגים' : 'שלב 1 מתוך 2';
    return '<header class="pagehead" style="--tint:var(--pink)">' +
      '<button class="back" data-action="bud-wiz-back" aria-label="חזרה">→</button>' +
      '<div class="ph-icon has-art">' + UI.art('budget') + '</div>' +
      '<h1>תכנון תקציב</h1>' +
      '<p>' + label + '</p>' +
      '</header>';
  }

  function wizStep1(w) {
    var html = '<div class="bw-intro"><h2>מה תרצו לכלול בתקציב?</h2>' +
      '<p>סמנו את הסעיפים הרלוונטיים עבורכם. לאחר מכן נציע חלוקה בהתאם.</p></div>' +
      '<div class="bw-grid">';
    html += BudgetPlan.CHOICES.map(function (c) {
      var on = w.picks.indexOf(c.id) > -1;
      var more = '';
      if (c.id === 'holidays' && on) {
        more = '<button class="bw-more" data-action="bud-wiz-step" data-step="2">' +
          (w.holidays.length ? w.holidays.length + ' חגים · שינוי' : 'בחירת חגים') + ' ‹</button>';
      }
      return '<div class="bw-pick' + (on ? ' on' : '') + '">' +
        '<button class="bw-pick-main" data-action="bud-wiz-pick" data-id="' + c.id + '" ' +
          'role="checkbox" aria-checked="' + on + '">' +
          '<span class="bw-check" aria-hidden="true">' + (on ? '✓' : '') + '</span>' +
          '<span class="bw-pick-art">' + wizArt(c.art) + '</span>' +
          '<span class="bw-pick-name">' + UI.esc(c.name) + '</span>' +
        '</button>' + more +
        '</div>';
    }).join('');
    html += '</div>';

    html += '<div class="bw-actions">' +
      '<button class="btn" data-action="bud-wiz-next"' + (w.picks.length ? '' : ' disabled') + '>המשך ←</button>' +
      '<button class="linkbtn" data-action="bud-wiz-clear">איפוס בחירה</button>' +
      '</div>';
    return html;
  }

  /* ---------- כרטיסי החגים ----------
     לכל חג מתג הכללה, ומתחתיו "למי המתנה?" — ילדים, צוות או שניהם.
     אותם כרטיסים משמשים גם את מסך בחירת החגים וגם את חלון העריכה
     שבהצעה. במסך הם עובדים דרך data-action, ובחלון דרך מאזינים
     מקומיים על טיוטה, כדי ש"ביטול" באמת לא ישנה דבר. */
  function holToggle(d, id) {
    var i = d.holidays.indexOf(id);
    if (i > -1) { d.holidays.splice(i, 1); return; }
    d.holidays = BudgetPlan.HOLIDAYS.map(function (h) { return h.id; })
      .filter(function (x) { return x === id || d.holidays.indexOf(x) > -1; });
  }

  /* לפחות קהל אחד נשאר מסומן: חג בלי אף מקבל הוא חג כבוי, ולזה יש מתג */
  function holAudToggle(d, id, aud) {
    var cur = BudgetPlan.audsOf(d.holAud, id).slice();
    var i = cur.indexOf(aud);
    if (i > -1) { if (cur.length > 1) cur.splice(i, 1); }
    else cur.push(aud);
    d.holAud = Object.assign({}, d.holAud);
    d.holAud[id] = cur;
  }

  function holCards(d, page) {
    return '<div class="hc-list">' + BudgetPlan.HOLIDAYS.map(function (h) {
      var on = d.holidays.indexOf(h.id) > -1;
      var auds = BudgetPlan.audsOf(d.holAud, h.id);
      /* סדר השורה לפי העיצוב: מימין "למי המתנה?", אחריו שם החג,
         המתג, והאיור בקצה */
      return '<div class="hc' + (on ? ' on' : '') + '">' +
        '<div class="hc-aud"><span>למי המתנה?</span><div class="hc-seg">' +
          BudgetPlan.HOLIDAY_AUDS.map(function (a) {
            var sel = auds.indexOf(a.id) > -1;
            return '<button type="button" class="' + (sel ? 'on' : '') + '" aria-pressed="' + sel + '"' +
              (on ? '' : ' disabled') + ' data-hol-aud="' + a.id + '" data-hol-of="' + h.id + '"' +
              (page ? ' data-action="bud-wiz-hol-aud"' : '') + '>' + a.label + '</button>';
          }).join('') +
        '</div></div>' +
        '<span class="hc-body"><b>' + UI.esc(h.name) + '</b><small>' + UI.esc(h.when) + '</small></span>' +
        '<button type="button" class="hc-switch" role="switch" aria-checked="' + on + '" ' +
          'aria-label="' + UI.esc(h.name) + '" data-hol="' + h.id + '"' +
          (page ? ' data-action="bud-wiz-hol" data-id="' + h.id + '"' : '') + '><i></i></button>' +
        '<span class="hc-ico" aria-hidden="true">' + h.icon + '</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  function wizStep2(w) {
    var html = '<div class="bw-intro"><h2>בחרו אילו חגים לכלול</h2>' +
      '<p>בחרו עבור כל חג למי תרצו להעניק: ילדים, צוות או שניהם. לכל מתנה נוצר סעיף משלו, בתאריך החג של השנה.</p></div>';
    html += holCards(w, true);
    html += '<div class="bs-tip"><span aria-hidden="true">💡</span><div><b>טיפ מאיתנו</b>' +
      'אפשר לבחור שילוב שונה לכל חג. ילד שמצטרף באמצע השנה משתתף רק בחגים שאחרי ההצטרפות שלו.</div></div>';
    html += '<div class="bw-actions">' +
      '<button class="btn" data-action="bud-wiz-hol-done">→ שמירה וחזרה לסעיפים</button>' +
      '</div>';
    return html;
  }

  function wizAvailCard(st, w) {
    var f = Calc.budgetFrame(st);
    var avail = wizAvailable(st, w);
    var head = '<div class="bw-avail-art">' + UI.art('piggy') + '</div>';

    if (f.mode === 'collect') {
      return '<div class="bw-avail">' + head +
        '<div class="bw-avail-body"><div class="bf-lab">התקציב הזמין</div>' +
          '<div class="bf-val">' + UI.money(avail) + '</div>' +
          '<div class="bf-sub">מתוך גבייה של ' + UI.money(f.perChild) + ' × ' + f.kids + ' ילדים</div></div>' +
        '<button class="btn sm soft" data-action="bud-collect">✏️ עריכה</button>' +
        '</div>';
    }

    /* בכיוון התכנון הסכום מוקלד כאן. הוא אינו נשמר כסכום גבייה —
       הסעיפים שייווצרו ממנו הם שיקבעו כמה כל הורה משלם */
    var collected = Math.round(Calc.collectedTotal(st));
    var kids = Calc.childCount(st);
    var sub = [];
    if (collected > 0) {
      sub.push('נגבו עד כה ' + UI.money(collected) +
        (collected !== avail ? ' · <button class="bw-inline" data-action="bud-wiz-use-collected">לחלק את הסכום הזה</button>' : ''));
    }
    if (kids && avail > 0) sub.push('כ-' + UI.money(Math.round(avail / kids)) + ' לילד');
    return '<div class="bw-avail">' + head +
      '<div class="bw-avail-body"><label class="bf-lab" for="bw-total">כמה יש לחלוקה?</label>' +
        '<div class="bw-total-wrap"><span>₪</span><input class="input bw-total" id="bw-total" type="number" ' +
          'inputmode="numeric" min="0" step="1" placeholder="15000" data-change="bud-wiz-total" ' +
          'value="' + (w.total ? Math.round(w.total) : '') + '"></div>' +
        (sub.length ? '<div class="bf-sub">' + sub.join('<br>') + '</div>' : '') +
        '<button class="bw-inline" data-action="bud-collect">או שתקבעו סכום גבייה קבוע לכל ילד</button>' +
      '</div></div>';
  }

  /* השורה כולה היא כפתור שפותח את חלון העריכה. שדה הקלדה בתוך
     השורה היה צר מדי לאצבע בטלפון, ולא היה בו מקום להצעות ולהסבר */
  function wizRow(plan, w, r) {
    var cat = Store.category(r.choice.cat);
    var raw = wizAmount(w, r);
    var amt = Calc.num(raw);
    var p = wizPct(amt, plan.available);
    var note = r.holidays
      ? '<small>' + r.holidays.map(function (h) {
          var a = BudgetPlan.audsOf(w.holAud, h.id);
          return h.name + (a.length > 1 ? ' (ילדים וצוות)' : a[0] === 'staff' ? ' (צוות)' : '');
        }).join(', ') + '</small>'
      : (r.targets && r.targets.length ? '<small>מעדכן את הסעיף הקיים</small>' : '');
    return '<button class="bw-row" data-action="bud-wiz-edit" data-id="' + r.id + '" ' +
        'aria-label="עריכת הסכום של ' + UI.esc(r.choice.name) + '">' +
      '<span class="bw-chev" aria-hidden="true">‹</span>' +
      '<span class="bw-row-art">' + wizArt(r.choice.art) + '</span>' +
      '<span class="bw-row-body">' +
        '<span class="bw-row-name">' + UI.esc(r.choice.name) + note + '</span>' +
        '<span class="bar thin"><i style="width:' + Math.min(100, p) + '%;background:' + UI.toneInkHex(cat.tone) + '"></i></span>' +
      '</span>' +
      '<span class="bw-amt' + (raw === '' ? ' empty' : '') + '">' + (raw === '' ? 'הזינו סכום' : UI.money(amt)) + '</span>' +
      '<span class="bw-pct">' + p + '%</span>' +
      '</button>';
  }

  /* כרטיס המצב שמעל הסה״כ: מאוזן, נותר לחלק, או חריגה */
  function wizBalance(plan, t) {
    if (plan.available <= 0) {
      return '<div class="bw-balance"><span class="bw-bal-ico">💡</span><div><b>עוד אין תקציב לחלוקה</b>' +
        '<small>הזינו למעלה כמה יש לחלוקה, ונציע חלוקה.</small></div></div>';
    }
    var pct = wizPct(t.sum, plan.available);
    var sub = 'סה״כ הסכומים מסתכמים ל-' + pct + '% מהתקציב';
    if (Math.abs(t.diff) < 1) {
      return '<div class="bw-balance ok"><span class="bw-bal-ico">✓</span><div><b>התקציב מאוזן</b>' +
        '<small>' + sub + '</small></div></div>';
    }
    return t.diff > 0
      ? '<div class="bw-balance warn"><span class="bw-bal-ico">!</span><div><b>נותרו ' + UI.money(t.diff) + ' לחלוקה</b>' +
          '<small>' + sub + '</small></div></div>'
      : '<div class="bw-balance over"><span class="bw-bal-ico">!</span><div><b>חריגה של ' + UI.money(-t.diff) + '</b>' +
          '<small>' + sub + '</small></div></div>';
  }

  function wizStep3(st, w) {
    var plan = wizPlan(st, w);
    var t = wizTotals(plan, w);

    var html = '<div class="bw-intro"><h2>הצעת חלוקת התקציב ✨</h2>' +
      '<p>בהתבסס על הסעיפים שבחרתם ועל התקציב הזמין, זו ההצעה שלנו. אפשר לערוך כל סכום.</p></div>';
    html += wizAvailCard(st, w);

    /* מי שחוזר לעזר באמצע השנה מחליט קודם מה קורה למה שכבר תכנן */
    if (plan.hasExisting) {
      var left = plan.available - plan.planned;
      html += '<div class="bw-stats">' +
        '<div><small>כבר מתוכנן</small><b>' + UI.money(plan.planned) + '</b></div>' +
        '<div><small>' + (left < 0 ? 'חריגה' : 'נותרו לחלוקה') + '</small>' +
          '<b class="' + (left < 0 ? 'neg' : '') + '">' + UI.money(Math.abs(left)) + '</b></div>' +
        '</div>' +
        '<div class="bw-modes" role="radiogroup">' +
          wizMode(w, 'keep', 'לשמור על הסכומים הקיימים', 'ולהציע חלוקה ליתרה בלבד, בין הסעיפים החדשים') +
          wizMode(w, 'reset', 'להציע חלוקה מחדש לכל מה שנבחר', 'הסכומים של הסעיפים שנבחרו יוחלפו. סעיפים לא נמחקים') +
        '</div>';
    }

    /* מי שהמשיך בטעות מהשלב הקודם צריך דרך חזרה גם כשגלל למטה —
       החץ שבראש המסך כבר מחוץ לתצוגה */
    html += '<div class="section-title bw-sec"><span>הסעיפים שבחרתם' +
        (plan.rows.length ? '<small>לחצו על סעיף כדי לערוך את הסכום</small>' : '') + '</span>' +
      '<button class="btn sm soft" data-action="bud-wiz-step" data-step="1">✏️ שינוי הסעיפים</button></div>';

    if (!plan.rows.length) {
      html += '<div class="note"><div class="n-ico">💡</div><div>' +
        (plan.hasExisting && w.mode === 'keep'
          ? 'לכל מה שבחרתם כבר יש סעיף בתקציב. אפשר לבחור סעיפים נוספים, או לבחור "חלוקה מחדש".'
          : 'לא נבחרו סעיפים לחלוקה.') +
        '</div></div>';
    } else {
      html += '<div class="bw-list">' +
        plan.rows.map(function (r) { return wizRow(plan, w, r); }).join('') +
        (plan.fixed > 0
          ? '<div class="bw-fixed"><span>סעיפים קיימים שנשארים כמות שהם</span><b>' + UI.money(plan.fixed) + '</b></div>'
          : '') +
        '</div>';
    }

    html += wizBalance(plan, t);
    html += '<div class="bw-total-row">' +
      '<span>סה״כ</span><b>' + UI.money(t.sum) + '</b>' +
      '<span class="bw-pct">' + wizPct(t.sum, plan.available) + '%</span>' +
      '</div>';

    html += '<div class="bw-actions">' +
      (plan.rows.length ? '<button class="linkbtn" data-action="bud-wiz-self">אחלק בעצמי</button>' : '') +
      '<button class="btn ghost bw-back" data-action="bud-wiz-step" data-step="1">→ חזרה לבחירת הסעיפים</button>' +
      '</div>';

    /* הפעולות הראשיות צמודות לתחתית המסך, כדי שלא יהיה צורך לגלול
       אליהן אחרי כל עריכה */
    html += '<div class="bw-bar">' +
      '<button class="btn ghost bw-reset" data-action="bud-wiz-reset">↻ איפוס להצעה המקורית</button>' +
      '<button class="btn" data-action="bud-wiz-apply"' + (t.rows > 0 ? '' : ' disabled') + '>שמור והמשך ←</button>' +
      '</div>';
    return html;
  }

  function wizMode(w, id, title, sub) {
    var on = w.mode === id;
    return '<button class="bw-mode' + (on ? ' on' : '') + '" data-action="bud-wiz-mode" data-mode="' + id + '" ' +
      'role="radio" aria-checked="' + on + '">' +
      '<span class="bw-radio" aria-hidden="true"></span>' +
      '<span><b>' + title + '</b><small>' + sub + '</small></span>' +
      '</button>';
  }

  function wizRender(w) {
    var st = Store.state;
    if (w.step === 2 && !wizHasHolidays(w)) w.step = 1;
    return '<div class="bwiz">' + wizHead(w) +
      (w.step === 1 ? wizStep1(w) : w.step === 2 ? wizStep2(w) : wizStep3(st, w)) +
      '</div>';
  }

  /* ---------- חלון העריכה של סעיף בהצעה ----------
     סכום עם כפתורי פלוס ומינוס, שלוש הצעות לבחירה מהירה, והסבר
     קצר. שום דבר לא נשמר עד "שמירה" — סגירה משאירה את מה שהיה. */
  function wizPerUnit(st, r, v) {
    if (v <= 0) return '';
    var kids = Calc.childCount(st), staff = Calc.staffCount(st);
    if (r.pairs && r.pairs.length) {
      return 'כ-' + UI.money(Math.round(v / r.pairs.length)) + ' לכל מתנה' +
        (r.pairs.length > 1 ? ' (' + r.pairs.length + ' מתנות)' : '');
    }
    if (r.choice.audience === 'staff_edu') return staff ? 'כ-' + UI.money(Math.round(v / staff)) + ' לכל איש צוות' : '';
    return kids ? 'כ-' + UI.money(Math.round(v / kids)) + ' לילד' : '';
  }

  function wizSheet(w, id) {
    var st = Store.state;
    var plan = wizPlan(st, w);
    var r = plan.rows.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var info = BudgetPlan.about(id);
    var step = BudgetPlan.step(plan.available || r.amount);
    var value = Math.round(Calc.num(wizAmount(w, r)));
    var opts = BudgetPlan.options(r.amount, plan.available || r.amount);

    function optionsHTML() {
      if (!opts.length) return '';
      return '<div class="bs-sec">הצעות מהניסיון שלנו</div><div class="bs-opts">' +
        opts.map(function (v, i) {
          return '<button type="button" class="bs-opt' + (v === value ? ' on' : '') + '" data-v="' + v + '">' +
            (i === 0 ? '<span class="bs-badge">מומלץ ✨</span>' : '') +
            '<b>' + UI.money(v) + '</b><small>' + wizPct(v, plan.available) + '%</small></button>';
        }).join('') + '</div>';
    }

    var body =
      '<div class="bs-head">' +
        '<div><h3>' + UI.esc(r.choice.name) + '</h3>' +
          (info.desc ? '<p>' + UI.esc(info.desc) + '</p>' : '') + '</div>' +
        '<span class="bs-art">' + wizArt(r.choice.art) + '</span>' +
      '</div>' +
      '<div class="bs-box">' +
        '<div class="bs-amt"><label for="bs-input">סכום</label>' +
          '<div class="bs-stepper">' +
            '<button type="button" class="bs-step" data-d="1" aria-label="הוספה">+</button>' +
            '<span class="bs-field"><span>₪</span><input id="bs-input" type="number" inputmode="numeric" ' +
              'min="0" step="1" value="' + value + '"></span>' +
            '<button type="button" class="bs-step" data-d="-1" aria-label="הפחתה">−</button>' +
          '</div></div>' +
        '<div class="bs-pct"><label>אחוז מהתקציב</label><b></b></div>' +
      '</div>' +
      '<div class="bs-unit"></div>' +
      '<div class="bs-opts-wrap">' + optionsHTML() + '</div>' +
      (info.tip ? '<div class="bs-tip"><span aria-hidden="true">💡</span><div><b>טיפ מאיתנו</b>' + UI.esc(info.tip) + '</div></div>' : '') +
      '<button type="button" class="btn bs-save">שמירה</button>';

    UI.modal({
      body: body,
      onMount: function (root, close) {
        root.closest('.modal').classList.add('bw-sheet');
        var input = root.querySelector('#bs-input');

        function paint() {
          root.querySelector('.bs-pct b').textContent = wizPct(value, plan.available) + '%';
          root.querySelector('.bs-unit').textContent = wizPerUnit(st, r, value);
          Array.prototype.forEach.call(root.querySelectorAll('.bs-opt'), function (b) {
            b.classList.toggle('on', +b.getAttribute('data-v') === value);
          });
        }
        function set(v, fromInput) {
          value = Math.max(0, Math.round(Calc.num(v)));
          if (!fromInput) input.value = value;
          paint();
        }

        input.addEventListener('input', function () { set(input.value, true); });
        Array.prototype.forEach.call(root.querySelectorAll('.bs-step'), function (b) {
          b.addEventListener('click', function () {
            var d = +b.getAttribute('data-d');
            /* צעד מיישר קודם למדרגה, כדי ש-957 יהפוך ל-1,000 ולא ל-1,057 */
            var next = d > 0 ? Math.floor(value / step) * step + step
                             : Math.ceil(value / step) * step - step;
            set(next);
          });
        });
        Array.prototype.forEach.call(root.querySelectorAll('.bs-opt'), function (b) {
          b.addEventListener('click', function () { set(b.getAttribute('data-v')); });
        });
        root.querySelector('.bs-save').addEventListener('click', function () {
          w.amounts[id] = value;
          close();
          App.render();
        });
        paint();
      }
    });
  }

  /* ---------- חלון החגים בהצעה ----------
     סכום כולל לכל המתנות, ומתחתיו כרטיסי החגים. הדלקה או כיבוי של
     חג, או הוספת צוות, משנים את מספר המתנות, והסכום זז איתם כך
     שכל מתנה נשארת באותו גובה בערך. */
  function wizHolidaySheet(w) {
    var st = Store.state;
    var plan = wizPlan(st, w);
    var row = plan.rows.filter(function (x) { return x.id === 'holidays'; })[0];
    if (!row) return;
    var draft = { picks: w.picks.slice(), holidays: w.holidays.slice(), holAud: Object.assign({}, w.holAud) };
    var step = BudgetPlan.step(plan.available || row.amount);
    var value = Math.round(Calc.num(wizAmount(w, row)));
    var info = BudgetPlan.about('holidays');

    function pairsOf(d) {
      var p = BudgetPlan.propose(st, function (b) { return Calc.itemAmount(st, b); }, {
        picks: ['holidays'], holidays: d.holidays, holAud: d.holAud, mode: w.mode, available: 0
      });
      return p.rows.length ? p.rows[0].pairs.length : 0;
    }
    var pairs = pairsOf(draft);

    var body =
      '<div class="bs-head">' +
        '<div><h3>' + UI.esc(row.choice.name) + '</h3>' +
          '<p>בחרו עבור כל חג למי תרצו להעניק.</p>' +
          '<small class="bs-note">ניתן לבחור ילדים, צוות או שניהם. הסכום הכולל מתעדכן לפי הבחירה.</small></div>' +
        '<span class="bs-art">' + wizArt(row.choice.art) + '</span>' +
      '</div>' +
      '<div class="bs-box">' +
        '<div class="bs-amt"><label for="bs-input">סכום כולל למתנות לחגים</label>' +
          '<div class="bs-stepper">' +
            '<button type="button" class="bs-step" data-d="1" aria-label="הוספה">+</button>' +
            '<span class="bs-field"><span>₪</span><input id="bs-input" type="number" inputmode="numeric" ' +
              'min="0" step="1" value="' + value + '"></span>' +
            '<button type="button" class="bs-step" data-d="-1" aria-label="הפחתה">−</button>' +
          '</div></div>' +
        '<div class="bs-pct"><label>אחוז מהתקציב</label><b></b></div>' +
      '</div>' +
      '<div class="bs-unit"></div>' +
      '<div class="bs-cards"></div>' +
      '<div class="bs-tip"><span aria-hidden="true">💡</span><div><b>טיפ מאיתנו</b>' +
        'אפשר לבחור שילוב שונה לכל חג. התקציב מחושב לפי מספר החגים ולמי שבחרתם.</div></div>' +
      '<div class="btn-row bs-btns">' +
        '<button type="button" class="btn bs-save">שמירה</button>' +
        '<button type="button" class="btn ghost bs-cancel">ביטול</button>' +
      '</div>';

    UI.modal({
      body: body,
      onMount: function (root, close) {
        root.closest('.modal').classList.add('bw-sheet');
        var input = root.querySelector('#bs-input');

        function paint() {
          root.querySelector('.bs-pct b').textContent = wizPct(value, plan.available) + '%';
          root.querySelector('.bs-unit').textContent = pairs
            ? 'כ-' + UI.money(Math.round(value / pairs)) + ' לכל מתנה (' + pairs + (pairs === 1 ? ' מתנה)' : ' מתנות)')
            : 'לא נבחר אף חג';
        }
        function set(v, fromInput) {
          value = Math.max(0, Math.round(Calc.num(v)));
          if (!fromInput) input.value = value;
          paint();
        }
        function drawCards() {
          root.querySelector('.bs-cards').innerHTML = holCards(draft, false);
        }
        /* שינוי במספר המתנות מזיז את הסכום באותו יחס */
        function changed() {
          var before = pairs;
          pairs = pairsOf(draft);
          if (before > 0 && pairs !== before) {
            set(Math.round(value / before * pairs / step) * step);
          } else if (!before && pairs) {
            set(Math.round((row.amount / Math.max(1, row.pairs.length)) * pairs / step) * step);
          } else paint();
          drawCards();
        }

        input.addEventListener('input', function () { set(input.value, true); });
        Array.prototype.forEach.call(root.querySelectorAll('.bs-step'), function (b) {
          b.addEventListener('click', function () {
            var d = +b.getAttribute('data-d');
            set(d > 0 ? Math.floor(value / step) * step + step : Math.ceil(value / step) * step - step);
          });
        });
        root.querySelector('.bs-cards').addEventListener('click', function (e) {
          var sw = e.target.closest('[data-hol]');
          var au = e.target.closest('[data-hol-aud]');
          if (sw) { holToggle(draft, sw.getAttribute('data-hol')); changed(); }
          else if (au && !au.disabled) {
            holAudToggle(draft, au.getAttribute('data-hol-of'), au.getAttribute('data-hol-aud'));
            changed();
          }
        });
        root.querySelector('.bs-cancel').addEventListener('click', close);
        root.querySelector('.bs-save').addEventListener('click', function () {
          /* שאר הסכומים נשארים כפי שהם מוצגים עכשיו. בלי זה, שינוי
             ברשימת החגים היה מחשב את כל ההצעה מחדש ומוחק עריכות */
          var keep = {};
          plan.rows.forEach(function (x) { keep[x.id] = wizAmount(w, x); });
          w.holidays = draft.holidays;
          w.holAud = draft.holAud;
          if (!w.holidays.length) w.picks = w.picks.filter(function (x) { return x !== 'holidays'; });
          wizPlan(st, w);
          w.amounts = keep;
          w.amounts.holidays = value;
          close();
          App.render();
        });
        drawCards();
        paint();
      }
    });
  }

  function wizGo(w, step) {
    w.step = step;
    window.scrollTo(0, 0);
    App.render();
  }

  /* כרטיסי הכניסה לעזר, בלשונית התכנון */
  function wizEmptyCard() {
    return '<div class="bw-start">' +
      '<div class="bw-start-art">' + UI.art('budget') + '</div>' +
      '<b>בואו נבנה את התקציב</b>' +
      '<p>בחרו אילו אירועים ומתנות תרצו לכלול השנה, ונעזור לכם לבנות חלוקה ראשונית.</p>' +
      '<button class="btn" data-action="bud-wiz-start">✨ עזרו לי לבנות תקציב</button>' +
      '<button class="linkbtn" data-action="budget-add">+ הוספת סעיף ידני</button>' +
      '</div>';
  }

  function wizHelpCard(st) {
    var f = Calc.budgetFrame(st);
    var sub = (f.mode === 'collect' && f.remaining > 0.5)
      ? 'נותרו ' + UI.money(f.remaining) + ' לתכנון — קבלו הצעה לחלוקה'
      : 'עריכה מחדש של הסעיפים והסכומים';
    return '<button class="bw-help" data-action="bud-wiz-start">' +
      '<b>✨ עזרה בחלוקת התקציב</b><small>' + sub + '</small></button>';
  }

  function render() {
    var w = wiz();
    if (w) return wizRender(w);

    var tab = App.vs('budgetTab', 'items');
    var html = UI.pageHead({ title: 'תכנון תקציב', subtitle: 'סעיפי ההוצאה המתוכננים לשנה', art: 'budget', tone: 'pink', back: 'home' });

    html += '<div class="segment">' +
      seg('settings', 'הגדרות', tab) +
      seg('items', 'תכנון', tab) +
      seg('summary', 'סיכום', tab) +
      '</div>';

    if (tab === 'settings') html += tabSettings();
    else if (tab === 'summary') html += tabSummary();
    else html += tabItems();

    return html;
  }

  function seg(id, label, cur) {
    return '<button data-action="budget-tab" data-tab="' + id + '" class="' + (cur === id ? 'on' : '') + '">' + label + '</button>';
  }

  /* ---------- טופס סעיף תקציב ---------- */

  /* הסדר הוא סדר השכיחות: כמעט כל סעיף הוא לילדים, ו"כללי" — סעיף
     שאינו מתחלק לפי אנשים — הוא היוצא מן הכלל, ולכן הוא אחרון. */
  var AUDIENCES = [
    { value: 'children',  label: 'ילדים',       icon: '🧒' },
    { value: 'staff_edu', label: 'צוות חינוכי', icon: '👩‍🏫' },
    { value: '',          label: 'כללי',        icon: '💰' }
  ];
  /* וגם כאן: רוב הסעיפים נחשבים לאדם ומוכפלים במספר, ולכן זו
     האפשרות הראשונה וברירת המחדל. */
  var BASES = [
    { value: 'per_person', label: 'לאדם' },
    { value: 'total',      label: 'לכולם' }
  ];

  /* מועדים חד־פעמיים. "לחודש" חסר בהם משמעות — אין מתנת יום הולדת
     שחוזרת כל חודש — ולכן שורת התדירות יורדת מהטופס. */
  var ONE_TIME_CATS = ['cat-bday', 'cat-holiday', 'cat-yearend'];

  function isOneTime(categoryId) { return ONE_TIME_CATS.indexOf(categoryId) > -1; }
  var PERIODS = [
    { value: 'year',  label: 'לשנה' },
    { value: 'month', label: 'לחודש' }
  ];

  function amountLabel(basis, period) {
    return 'סכום ' + (basis === 'per_person' ? 'לאדם' : 'לכולם') +
           ' ' + (period === 'month' ? 'לחודש' : 'לשנה') + ' (₪)';
  }

  /* שורת החישוב החיה: מציגה את כל הגורמים ואת התוצאה השנתית,
     ולצידה כמה הסעיף מוסיף לכל הורה */
  function calcLine(draft) {
    var st = Store.state;
    var synth = {
      audience: draft.audience, basis: draft.basis, period: draft.period, rate: draft.rate,
      periods: draft.periods, startDate: draft.startDate, endDate: draft.endDate,
      date: draft.date || ''
    };
    var bd = Calc.itemBreakdown(st, synth);

    /* לפני שהוקלד סכום אין מה לחשב, ושורה שמכריזה "0 ₪ = 0 ₪" היא
       רעש. ההסבר מופיע ברגע שנכנסת הספרה הראשונה. */
    if (draft.rate === '' || draft.rate === null || draft.rate === undefined) {
      return '<div class="hint" style="margin:0">החישוב יוצג כאן ברגע שיוזן סכום.</div>';
    }

    if (bd.perPerson && bd.count === 0) {
      return '<div class="note" style="background:#FDF0F2;margin:0"><div class="n-ico">⚠️</div><div>' +
        (draft.audience === 'children'
          ? 'אין ילדים ברשימה — הוסיפו ילדים כדי שהסכום יחושב'
          : 'אין אנשי צוות ברשימה — הוסיפו צוות כדי שהסכום יחושב') +
        '</div></div>';
    }

    var parts = [UI.money(bd.rate) + (bd.perPerson ? ' לאדם' : '')];
    if (bd.perPerson) parts.push('× ' + Calc.audienceLabel(bd.audience, bd.count));
    if (bd.monthly) {
      parts.push('× ' + bd.months + ' חודשים' +
        (bd.customWindow ? ' של פעילות' : '') +
        (bd.periodCount > 1 ? ' (' + bd.periodCount + ' תקופות)' : ''));
    }

    var alloc = Calc.itemAllocation(st, synth);
    // כשיש ילדים שהצטרפו אחרי המועד, הסכום בפועל נמוך מהמכפלה
    var less = Calc.round2(bd.total - alloc.total);

    return '<div class="row" style="box-shadow:none;background:var(--primary-soft);margin:0">' +
      '<div class="r-body">' +
        '<div class="small muted" style="white-space:normal">' + parts.join('  ') + '</div>' +
        '<div class="r-name" style="font-size:18px">= ' + UI.money(alloc.total) + ' לשנה</div>' +
        (less > 0.5
          ? '<div class="small muted">' + UI.money(less) + ' פחות, בגלל ילדים שהצטרפו אחרי</div>'
          : '') +
        (alloc.full > 0 ? '<div class="small muted">≈ ' + UI.money(alloc.full) +
          ' להורה של ילד שהיה כל השנה</div>' : '') +
      '</div></div>';
  }

  /* סימון הצ׳יפ הנבחר כשהערך משתנה מהקוד ולא מלחיצה */
  function syncChips(root, name, value) {
    var box = root.querySelector('[data-chips="' + name + '"]');
    if (!box) return;
    Array.prototype.forEach.call(box.querySelectorAll('.chip'), function (c) {
      c.classList.toggle('on', c.getAttribute('data-chip') === value);
    });
  }

  function itemForm(item, presetCategory) {
    var isNew = !item;
    var startCategory = presetCategory && Store.find('categories', presetCategory)
      ? presetCategory
      : Store.state.categories[0].id;
    item = item || { categoryId: startCategory, title: '', date: '', note: '',
                     audience: 'children', basis: 'per_person', period: 'year', rate: '',
                     startDate: '', endDate: '' };

    /* תקופות הפעילות נערכות כרשימה, כדי לתמוך בחוג עם הפסקות באמצע */
    var periods = (item.periods && item.periods.length)
      ? item.periods.map(function (p) { return { id: p.id || Store.uid('per'), start: p.start, end: p.end }; })
      : (item.startDate && item.endDate
          ? [{ id: Store.uid('per'), start: item.startDate, end: item.endDate }]
          : []);

    /* ציור מחדש של שורת החישוב לפי מצב הטופס והתקופות שהוזנו */
    function refreshCalc(root) {
      var el = root.querySelector('#f-calc');
      if (!el) return;
      el.innerHTML = calcLine({
        audience: root.querySelector('#f-audience').value,
        basis: root.querySelector('#f-basis').value,
        period: root.querySelector('#f-period').value,
        rate: root.querySelector('#f-amount').value,
        periods: periods,
        date: (root.querySelector('#f-date') || {}).value || ''
      });
    }

    /* רשימת תקופות הפעילות — ניתנת להוספה, עריכה ומחיקה */
    function drawPeriods(root) {
      var box = root.querySelector('#f-periods');
      if (!box) return;

      box.innerHTML =
        '<label>תקופות פעילות</label>' +
        (periods.length ? periods.map(function (p, i) {
          return '<div class="period">' +
            '<div class="p-head">' +
              '<span>תקופה ' + (i + 1) + '</span>' +
              '<button type="button" class="iconbtn del" data-per-del="' + i + '" ' +
                'aria-label="מחיקת תקופה">✕</button>' +
            '</div>' +
            '<div class="p-dates">' +
              '<label>מתאריך<input class="input" type="date" data-per="start" data-i="' + i + '" ' +
                'value="' + UI.esc(p.start || '') + '"></label>' +
              '<label>עד תאריך<input class="input" type="date" data-per="end" data-i="' + i + '" ' +
                'value="' + UI.esc(p.end || '') + '"></label>' +
            '</div>' +
            '</div>';
        }).join('') : '<p class="small muted" style="margin:0 0 8px">לא הוגדרו תקופות — החישוב יתבצע לפי כל שנת הלימודים.</p>') +
        '<button type="button" class="btn add-btn soft sm" data-per-add="1" style="width:100%">' +
          '<span class="ab-label">הוספת תקופה</span><span class="ab-plus" aria-hidden="true">+</span></button>' +
        '<div class="hint">אפשר להוסיף כמה תקופות, למשל חוג שנעצר בחופשה וחוזר אחריה. ' +
        'החישוב מסכם את חודשי הפעילות בלבד.</div>';

      Array.prototype.forEach.call(box.querySelectorAll('[data-per]'), function (inp) {
        inp.addEventListener('change', function () {
          var i = parseInt(inp.getAttribute('data-i'), 10);
          if (periods[i]) periods[i][inp.getAttribute('data-per')] = inp.value;
          refreshCalc(root);
        });
      });
      Array.prototype.forEach.call(box.querySelectorAll('[data-per-del]'), function (btn) {
        btn.addEventListener('click', function () {
          periods.splice(parseInt(btn.getAttribute('data-per-del'), 10), 1);
          drawPeriods(root);
          refreshCalc(root);
        });
      });
      var add = box.querySelector('[data-per-add]');
      if (add) add.addEventListener('click', function () {
        periods.push({ id: Store.uid('per'), start: '', end: '' });
        drawPeriods(root);
        refreshCalc(root);
      });
    }

    /* מסתיר או מחזיר את שורת התדירות לפי הקטגוריה. סעיף ישן שנשמר
       כחודשי באחת מהקטגוריות החד־פעמיות ממשיך להציג אותה, כדי שלא
       נשנה לו את הסכום מאחורי הגב — רק מעבר מכוון לקטגוריה כזו
       מאפס אותה לשנתי. */
    function syncPeriod(root, force) {
      var cat = (root.querySelector('#f-categoryId') || {}).value || '';
      var el = root.querySelector('#f-period');
      var field = root.querySelector('#field-period');
      if (!el || !field) return;

      var oneTime = isOneTime(cat);
      if (oneTime && force && el.value !== 'year') {
        el.value = 'year';
        syncChips(root, 'period', 'year');
      }
      field.hidden = oneTime && el.value !== 'month';
    }

    var bd = Calc.itemBreakdown(Store.state, item);
    var startAudience = item.audience === undefined ? 'children' : item.audience;
    var startBasis  = item.basis  || (bd.perPerson ? 'per_person' : 'total');
    var startPeriod = item.period || 'year';
    /* בסעיף חדש השדה נשאר ריק. אפס מוקדם היה מחייב למחוק אותו לפני
       ההקלדה, ומי ששכח קיבל סכום עם ספרה מובילה מיותרת. */
    var startRate   = item.rate !== undefined && item.rate !== '' ? item.rate
                    : (isNew ? '' : bd.rate);

    UI.formModal({
      title: isNew ? 'סעיף תקציב חדש' : 'עריכת סעיף',
      subtitle: 'קטגוריה, קהל יעד, אופן חישוב הסכום ותאריך יעד',
      submitLabel: 'שמירה',
      fields: [
        { name: 'categoryId', label: 'קטגוריה', type: 'select', value: item.categoryId,
          options: catOptions(), required: true },
        { name: 'title', label: 'שם הסעיף', value: item.title, placeholder: 'למשל: מתנה לחג' },
        { name: 'audience', label: 'קהל יעד', type: 'chips', value: startAudience, options: AUDIENCES },
        { name: 'basis', label: 'הסכום הוא', type: 'chips', value: startBasis, options: BASES,
          hint: '"לאדם" מוכפל במספר הילדים או אנשי הצוות · "לכולם" הוא סכום אחד לכל הקבוצה' },
        { name: 'period', label: 'תדירות', type: 'chips', value: startPeriod, options: PERIODS,
          hint: '"לחודש" מוכפל במספר חודשי שנת הלימודים' },
        { name: 'periods', type: 'html', html: '' },
        { name: 'amount', label: amountLabel(startBasis, startPeriod), type: 'number',
          value: startRate, placeholder: '0', step: '1', min: 0 },
        { name: 'calc', type: 'html',
          html: calcLine({ audience: startAudience, basis: startBasis, period: startPeriod, rate: startRate,
                           periods: periods, date: item.date }) },
        { name: 'date', label: 'תאריך יעד', type: 'date', value: item.date,
          hint: 'לפי התאריך הזה נקבע מי משתתף בסעיף: ילד שהצטרף אחריו אינו משלם עליו' },
        { name: 'note', label: 'הערות', type: 'textarea', value: item.note, placeholder: 'אופציונלי' }
      ],

      onMount: function (root) {
        drawPeriods(root);
        syncPeriod(root, false);
      },

      onFieldChange: function (name, value, root) {
        // בחירה מכוונת של קטגוריה חד־פעמית מאפסת את התדירות לשנתי
        syncPeriod(root, name === 'categoryId');

        var audience = root.querySelector('#f-audience').value;
        var basisEl  = root.querySelector('#f-basis');
        var basis    = basisEl.value;

        // "לאדם" חסר משמעות בלי קהל יעד — מתקנים במקום להציג חישוב שגוי
        if (!audience && basis === 'per_person') {
          basis = 'total';
          basisEl.value = 'total';
          syncChips(root, 'basis', 'total');
        }

        var period = root.querySelector('#f-period').value;
        var rate = root.querySelector('#f-amount').value;

        // תקופות הפעילות רלוונטיות רק לסעיף חודשי
        var monthly = period === 'month';
        var box = root.querySelector('#f-periods');
        if (box) box.style.display = monthly ? '' : 'none';

        root.querySelector('label[for="f-amount"]').textContent = amountLabel(basis, period);
        refreshCalc(root);
      },

      onSubmit: function (v) {
        var audience = v.audience || '';
        var basis = (!audience && v.basis === 'per_person') ? 'total' : (v.basis || 'total');
        var period = v.period || 'year';
        var rate = Calc.num(v.amount);
        var monthly = period === 'month';
        var clean = monthly ? periods.filter(function (p) {
          return p.start && p.end && p.end > p.start;
        }) : [];
        var draft = { audience: audience, basis: basis, period: period, rate: rate, periods: clean };
        var data = {
          categoryId: v.categoryId, title: v.title, date: v.date, note: v.note,
          audience: audience, basis: basis, period: period, rate: rate,
          periods: clean, startDate: '', endDate: '',
          // הסכום השנתי נשמר גם הוא, ומחושב מחדש בתצוגה לפי הנתונים העדכניים
          amount: Calc.itemAmount(Store.state, draft)
        };
        if (isNew) Store.add('budgetItems', data);
        else Store.update('budgetItems', item.id, data);
        App.render();
        UI.toast(isNew ? 'הסעיף נוסף ✓' : 'הסעיף עודכן ✓');
      },
      onDelete: isNew ? null : function () {
        Store.remove('budgetItems', item.id);
        App.render();
        UI.toast('הסעיף נמחק');
      }
    });
  }

  /* ---------- טופס קטגוריה ---------- */
  function catForm(cat) {
    var isNew = !cat;
    cat = cat || { name: '', icon: '🎁', tone: 'purple' };
    UI.formModal({
      title: isNew ? 'קטגוריה חדשה' : 'עריכת קטגוריה',
      fields: [
        { name: 'name', label: 'שם הקטגוריה', value: cat.name, required: true, placeholder: 'למשל: ציוד יצירה' },
        { name: 'icon', label: 'אימוג׳י', value: cat.icon, placeholder: '🎁', half: true },
        { name: 'tone', label: 'צבע', type: 'select', value: cat.tone, half: true, options: [
          { value: 'pink', label: 'ורוד' }, { value: 'yellow', label: 'צהוב' },
          { value: 'green', label: 'ירוק' }, { value: 'purple', label: 'סגול' },
          { value: 'blue', label: 'כחול' }, { value: 'peach', label: 'אפרסק' },
          { value: 'mint', label: 'מנטה' }
        ] }
      ],
      onSubmit: function (v) {
        if (isNew) Store.add('categories', v);
        else Store.update('categories', cat.id, v);
        App.render();
        UI.toast('נשמר ✓');
      },
      onDelete: isNew ? null : function () {
        var used = Store.state.budgetItems.concat(Store.state.expenses)
          .filter(function (x) { return x.categoryId === cat.id; }).length;
        if (used) { UI.toast('לא ניתן למחוק — יש ' + used + ' רשומות בקטגוריה'); return; }
        Store.remove('categories', cat.id);
        App.render();
      }
    });
  }

  return {
    render: render,
    itemForm: itemForm,
    catOptions: catOptions,
    actions: {
      'budget-tab': function (el) { App.setVs('budgetTab', el.getAttribute('data-tab')); App.render(); },
      'budget-add': function (el) {
        itemForm(null, el && el.getAttribute ? el.getAttribute('data-category') : null);
      },
      'budget-cat': function (el) {
        var id = el.getAttribute('data-id');
        var open = App.vs('budgetOpenCats', {});
        open[id] = !open[id];
        App.render();
      },
      'budget-edit': function (el) { itemForm(Store.find('budgetItems', el.getAttribute('data-id'))); },
      'cat-add': function () { catForm(null); },
      'cat-edit': function (el) { catForm(Store.find('categories', el.getAttribute('data-id'))); },
      /* קביעת סכום הגבייה לילד — המעבר לכיוון "גבייה קודם".
         ריק או אפס מחזיר לכיוון השני, שבו הגבייה נגזרת מהתכנון. */
      'bud-collect': function () {
        var cur = Calc.collectPerChild(Store.state);
        var kids = Calc.childCount(Store.state);
        UI.formModal({
          title: cur ? 'עריכת סכום הגבייה' : 'קביעת סכום הגבייה',
          subtitle: 'כמה נגבה מכל הורה השנה',
          submitLabel: 'שמירה',
          fields: [
            { name: 'perChild', label: 'סכום לילד', type: 'number', min: 0, value: cur || '',
              placeholder: '500',
              hint: kids ? 'עם ' + kids + ' ילדים ברשימה, זה התקציב שיעמוד לרשותכם. ' +
                           'ילד שהצטרף באמצע השנה מחויב באופן יחסי.'
                         : 'עדיין אין ילדים ברשימה — הסכום יוכפל במספר שיוזן שם.' }
          ],
          onSubmit: function (v) {
            Store.state.settings.collectPerChild = Math.max(0, Calc.num(v.perChild));
            Store.save();
            App.render();
            UI.toast(Store.state.settings.collectPerChild ? 'סכום הגבייה נשמר ✓' : 'חזרנו לתכנון קודם');
          },
          onDelete: cur ? function () {
            Store.state.settings.collectPerChild = 0;
            Store.save();
            App.render();
            UI.toast('הסכום בוטל — הגבייה תיגזר מהתכנון');
          } : null,
          deleteLabel: 'ביטול הסכום'
        });
      },
      'bud-per-info': function () {
        var st = Store.state;
        UI.modal({
          title: 'איך חושב הסכום לילד?',
          subtitle: '',
          body: '<p class="small" style="line-height:1.8;margin:0 0 12px">' +
            'סכום כל סעיפי ההוצאה שתוכננו, מחולק בין הילדים שברשימה. ' +
            'ילד שהצטרף באמצע השנה משתתף רק בסעיפים שהיו אחרי תאריך ההצטרפות שלו, ' +
            'ולכן הסכום שלו נמוך יותר — והמספר כאן הוא של ילד שנמצא ' + Lang.t('placeIn') + ' כל השנה.</p>' +
            '<div class="note"><div class="n-ico">💡</div><div>' +
            'המספר מתעדכן עם כל סעיף שמוסיפים. אם אתם מעדיפים לקבוע מראש כמה לגבות ולתכנן בתוך הסכום — ' +
            'אפשר לעשות את זה בכל רגע.</div></div>' +
            '<button class="btn mt js-collect" type="button">קביעת סכום גבייה מראש</button>',
          onMount: function (root, close) {
            root.querySelector('.js-collect').addEventListener('click', function () {
              close();
              setTimeout(function () {
                var actions = Views.budget.actions;
                actions['bud-collect']();
              }, 180);
            });
          }
        });
      },
      /* ---------- עזר התקציב ---------- */
      'bud-wiz-start': function () {
        var st = Store.state;
        var init = BudgetPlan.initialPicks(st);
        App.setVs('budWiz', {
          step: 1, picks: init.picks, holidays: init.holidays, holAud: init.holAud || {},
          mode: 'keep', total: wizDefaultTotal(st), amounts: {}, sig: ''
        });
        window.scrollTo(0, 0);
        App.render();
      },
      'bud-wiz-back': function () {
        var w = wiz();
        if (!w) return;
        if (w.step === 1) { App.setVs('budWiz', null); window.scrollTo(0, 0); App.render(); return; }
        wizGo(w, 1);
      },
      'bud-wiz-pick': function (el) {
        var w = wiz(), id = el.getAttribute('data-id');
        if (!w) return;
        var i = w.picks.indexOf(id);
        if (i > -1) w.picks.splice(i, 1);
        else {
          /* שומרים על סדר הקטלוג, כדי שההצעה תוצג באותו סדר כמו הבחירה */
          w.picks = BudgetPlan.CHOICES.map(function (c) { return c.id; })
            .filter(function (x) { return x === id || w.picks.indexOf(x) > -1; });
          /* סימון "מתנות לחג" פותח מיד את בחירת החגים, שחוזרת לכאן */
          if (id === 'holidays') {
            if (!w.holidays.length) w.holidays = BudgetPlan.DEFAULT_HOLIDAYS.slice();
            wizGo(w, 2);
            return;
          }
        }
        App.render();
      },
      'bud-wiz-clear': function () {
        var w = wiz();
        if (!w) return;
        w.picks = [];
        App.render();
      },
      'bud-wiz-next': function () {
        var w = wiz();
        if (!w || !w.picks.length) return;
        wizGo(w, 3);
      },
      /* מסך החגים תמיד חוזר לבחירת הסעיפים ולא ממשיך להצעה. מי שהוריד
         את כל החגים בעצם ויתר על מתנות לחג, והסימון יורד גם מהכרטיס */
      'bud-wiz-hol-done': function () {
        var w = wiz();
        if (!w) return;
        if (!w.holidays.length) w.picks = w.picks.filter(function (x) { return x !== 'holidays'; });
        wizGo(w, 1);
      },
      'bud-wiz-step': function (el) {
        var w = wiz();
        if (w) wizGo(w, parseInt(el.getAttribute('data-step'), 10) || 1);
      },
      'bud-wiz-hol': function (el) {
        var w = wiz(), id = el.getAttribute('data-id');
        if (!w) return;
        var i = w.holidays.indexOf(id);
        if (i > -1) w.holidays.splice(i, 1);
        else w.holidays = BudgetPlan.HOLIDAYS.map(function (h) { return h.id; })
          .filter(function (x) { return x === id || w.holidays.indexOf(x) > -1; });
        App.render();
      },
      'bud-wiz-hol-aud': function (el) {
        var w = wiz();
        if (!w) return;
        holAudToggle(w, el.getAttribute('data-hol-of'), el.getAttribute('data-hol-aud'));
        App.render();
      },
      'bud-wiz-mode': function (el) {
        var w = wiz();
        if (!w) return;
        w.mode = el.getAttribute('data-mode') === 'reset' ? 'reset' : 'keep';
        App.render();
      },
      'bud-wiz-total': function (el) {
        var w = wiz();
        if (!w) return;
        w.total = Math.max(0, Math.round(Calc.num(el.value)));
        App.render();
      },
      'bud-wiz-use-collected': function () {
        var w = wiz();
        if (!w) return;
        w.total = Math.round(Calc.collectedTotal(Store.state));
        App.render();
      },
      'bud-wiz-edit': function (el) {
        var w = wiz();
        if (!w) return;
        var id = el.getAttribute('data-id');
        if (id === 'holidays') wizHolidaySheet(w);
        else wizSheet(w, id);
      },
      'bud-wiz-reset': function () {
        var w = wiz();
        if (!w) return;
        w.amounts = {};
        App.render();
      },
      /* הסכומים מתרוקנים והסעיפים נשארים: מי שמעדיף לחלק בעצמו עדיין
         נהנה מכרטיס היתרה שמתעדכן אחרי כל סעיף */
      'bud-wiz-self': function () {
        var w = wiz();
        if (!w) return;
        var st = Store.state;
        wizPlan(st, w).rows.forEach(function (r) { w.amounts[r.id] = ''; });
        App.render();
      },
      'bud-wiz-apply': function () {
        var w = wiz();
        if (!w) return;
        var st = Store.state;
        var amountOf = function (b) { return Calc.itemAmount(st, b); };
        var plan = wizPlan(st, w);
        var ch = BudgetPlan.changes(st, plan, w.amounts, amountOf);
        ch.update.forEach(function (u) { Store.update('budgetItems', u.id, u.data); });
        ch.add.forEach(function (d) { Store.add('budgetItems', d); });
        App.setVs('budWiz', null);
        App.setVs('budgetTab', 'items');
        window.scrollTo(0, 0);
        App.render();
        var n = ch.add.length, m = ch.update.length;
        UI.toast(n && m ? 'נוספו ' + n + ' סעיפים ועודכנו ' + m + ' ✓'
               : n ? (n === 1 ? 'נוסף סעיף אחד לתקציב ✓' : 'נוספו ' + n + ' סעיפים לתקציב ✓')
               : 'עודכנו ' + m + ' סעיפים ✓');
      },
      'bud-set': function (el) {
        Store.state.settings[el.getAttribute('data-key')] = el.value;
        Store.save();
        App.render();
      }
    }
  };
})();
