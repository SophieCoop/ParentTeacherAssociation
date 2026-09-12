/* ============================================================
   אשף ההקמה — מסך פתיחה ו-4 שלבים (אפשר לדלג על כל שלב)
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.onboarding = (function () {

  function step() { return App.vs('wizStep', 0); }

  /* ---------- מסך פתיחה ---------- */
  function splash() {
    return '<div class="splash">' +
      '<div class="art">🏫</div>' +
      '<h1>ועד הורים<br>גן שלנו</h1>' +
      '<p>יחד למען הילדים ❤️<br>ניהול תקציב, גבייה והוצאות במקום אחד</p>' +
      '<button class="btn" data-action="wiz-start">בואו נתחיל</button>' +
      '<button class="btn ghost" style="max-width:320px;margin-top:10px" data-action="wiz-demo">הצגת נתוני דוגמה</button>' +
      cloudBlock() +
      '</div>';
  }

  /* אזור החשבון במסך הפתיחה.
     בלי זה, מכשיר שכבר מחובר אך עדיין ריק נותר תקוע כאן: כפתור
     ההתחברות מוסתר כי יש חשבון, ומסך ההגדרות נגיש רק אחרי סיום ההקמה. */
  function cloudBlock() {
    if (!Cloud.enabled()) return '';
    var i = Cloud.info();

    if (!i.signedIn) {
      return '<button class="btn soft" style="max-width:320px;margin-top:10px" data-action="acc-signin">' +
        'כבר יש לי חשבון — התחברות</button>' +
        '<p class="small muted" style="max-width:320px;margin-top:14px">' +
        'מתחברים כאן כדי למשוך למכשיר הזה נתונים שכבר הזנתם במכשיר אחר.</p>';
    }

    return '<div class="card" style="max-width:320px;margin-top:20px;text-align:start">' +
      '<div class="flex-between" style="margin-bottom:10px">' +
        '<span class="badge ' + i.tone + '">' + i.icon + ' ' + UI.esc(i.text) + '</span>' +
        '<span class="small muted">' + UI.esc(i.email || '') + '</span>' +
      '</div>' +
      '<p class="small muted" style="margin:0 0 10px">המכשיר הזה מחובר לחשבון, אבל עדיין אין בו נתונים. ' +
      'אם כבר הזנתם נתונים במכשיר אחר — ודאו שהוא מחובר, ואז משכו אותם לכאן.</p>' +
      '<button class="btn" data-action="acc-sync">משיכת הנתונים מהענן</button>' +
      '<button class="btn soft" style="margin-top:8px" data-action="acc-signout">התנתקות</button>' +
      (i.error ? '<div class="hint">' + UI.esc(i.error) + '</div>' : '') +
      '</div>';
  }

  function stepsBar(n) {
    var dots = '';
    for (var i = 1; i <= 4; i++) dots += '<i class="' + (i <= n ? 'on' : '') + '"></i>';
    return '<div class="wiz-steps">' + dots + '</div>' +
           '<div class="wiz-count">שלב ' + n + ' מתוך 4</div>';
  }

  function head(n, title, sub) {
    return '<div style="padding-top:18px">' +
      (n > 1 ? '<button class="iconbtn plain" data-action="wiz-back" style="margin-bottom:6px">→</button>' : '') +
      stepsBar(n) +
      '<h1 style="font-size:24px;text-align:center;margin-top:10px">' + UI.esc(title) + '</h1>' +
      '<p class="center muted small" style="margin:6px 0 20px">' + UI.esc(sub) + '</p>' +
      '</div>';
  }

  function footer(n, nextLabel) {
    // בשלב האחרון אין על מה לדלג — כפתור אחד בלבד, אחרת שני הכפתורים
    // אומרים את אותו הדבר
    return '<div class="mt">' +
      '<button class="btn" data-action="wiz-next">' + UI.esc(nextLabel || 'המשך') + '</button>' +
      (n === 4 ? '' :
        '<button class="btn soft" style="margin-top:9px" data-action="wiz-skip">דילוג על השלב הזה</button>') +
      '</div>';
  }

  /* ---------- שלב 1: פרטי הגן ---------- */
  function step1() {
    var g = Store.state.gan, s = Store.state.settings;
    return head(1, 'פרטי הגן', 'בואו נתחיל עם הפרטים של הגן שלנו') +
      '<div class="card">' +
        '<div class="field"><label>שם הגן</label>' +
          '<input class="input" data-input="wiz-gan" data-key="name" value="' + UI.esc(g.name) + '" placeholder="גן צבעוני"></div>' +
        '<div class="field"><label>כתובת הגן</label>' +
          '<input class="input" data-input="wiz-gan" data-key="address" value="' + UI.esc(g.address) + '" placeholder="רחוב הגן 12, תל אביב"></div>' +
        '<div class="field"><label>שנת לימודים</label>' +
          '<input class="input" data-input="wiz-gan" data-key="yearLabel" value="' + UI.esc(g.yearLabel) + '" placeholder="2025/2026"></div>' +
        '<div class="grid-2">' +
          '<div class="field"><label>תחילת שנה</label>' +
            '<input class="input" type="date" data-input="wiz-set" data-key="yearStart" value="' + UI.esc(s.yearStart) + '"></div>' +
          '<div class="field"><label>סוף שנה</label>' +
            '<input class="input" type="date" data-input="wiz-set" data-key="yearEnd" value="' + UI.esc(s.yearEnd) + '"></div>' +
        '</div>' +
        '<div class="hint">תאריכי השנה משמשים לחישוב היחסי של ילדים שמצטרפים באמצע שנה.</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="field"><label>איש קשר בוועד</label>' +
          '<input class="input" data-input="wiz-gan" data-key="contactName" value="' + UI.esc(g.contactName) + '" placeholder="דנה לוי"></div>' +
        '<div class="grid-2">' +
          '<div class="field"><label>טלפון</label>' +
            '<input class="input" type="tel" data-input="wiz-gan" data-key="phone" value="' + UI.esc(g.phone) + '" placeholder="050-1234567"></div>' +
          '<div class="field"><label>אימייל</label>' +
            '<input class="input" type="email" data-input="wiz-gan" data-key="email" value="' + UI.esc(g.email) + '" placeholder="dana@example.com"></div>' +
        '</div>' +
      '</div>' +
      footer(1);
  }

  /* ---------- שלב 2: ילדי הגן ---------- */
  function step2() {
    var kids = Store.state.children;
    return head(2, 'ילדי הגן', 'אפשר להוסיף עכשיו או בהמשך, מתוך לשונית "ילדי הגן"') +
      '<div class="card">' +
        '<div class="flex-between"><div><b>' + kids.length + ' ילדים</b>' +
        '<div class="small muted">רשומים כרגע</div></div>' +
        '<button class="btn sm" data-action="child-add">+ הוספת ילד</button></div>' +
      '</div>' +
      (kids.length ? kids.map(function (c) {
        return '<div class="row"><div class="avatar" style="background:' + UI.toneVar(UI.toneFor(c.name)) + '">' + UI.faceFor(c.name) + '</div>' +
          '<div class="r-body"><div class="r-name">' + UI.esc(c.name) + '</div>' +
          '<div class="r-sub">' + (c.birthDate ? UI.dateShort(c.birthDate) : 'ללא תאריך לידה') + '</div></div>' +
          '<button class="iconbtn plain" data-action="child-edit" data-id="' + c.id + '">✏️</button></div>';
      }).join('') : UI.empty({ art: 'children', title: 'עוד אין ילדים ברשימה', text: 'אפשר להוסיף עכשיו, או לדלג ולהוסיף אחר כך.', action: { act: 'child-add', label: '+ הוספת ילד ראשון' } })) +
      footer(2);
  }

  /* ---------- שלב 3: צוות הגן ---------- */
  function step3() {
    var staff = Store.state.staff;
    return head(3, 'צוות הגן', 'שמות הצוות והיררכיה — אופציונלי, עוזר בחישוב מתנות') +
      '<div class="card">' +
        '<div class="flex-between"><div><b>' + staff.length + ' אנשי צוות</b>' +
        '<div class="small muted">רשומים כרגע</div></div>' +
        '<button class="btn sm" data-action="staff-add">+ הוספת איש צוות</button></div>' +
      '</div>' +
      (staff.length ? staff.map(function (t) {
        var lv = Store.staffLevel(t.level);
        return '<div class="row"><div class="avatar" style="background:' + UI.toneVar(lv.tone) + '">' + lv.icon + '</div>' +
          '<div class="r-body"><div class="r-name">' + UI.esc(t.name) + '</div>' +
          '<div class="r-sub">' + UI.esc(t.role || lv.name) + '</div></div>' +
          '<button class="iconbtn plain" data-action="staff-edit" data-id="' + t.id + '">✏️</button></div>';
      }).join('') : UI.empty({ art: 'staff', title: 'עוד לא הוספתם צוות', text: 'השלב הזה אופציונלי לגמרי.', action: { act: 'staff-add', label: '+ הוספת איש צוות' } })) +
      footer(3);
  }

  /* ---------- שלב 4: תכנון תקציב ---------- */
  function step4() {
    var items = Store.state.budgetItems;
    var total = Calc.budgetTotal(Store.state);
    return head(4, 'תכנון תקציב', 'סעיפי ההוצאה המתוכננים לשנה — אפשר לעדכן בכל רגע') +
      '<div class="summary"><div class="sum-top"><div>' +
        '<div class="sum-label">סה״כ תקציב מתוכנן</div>' +
        '<div class="sum-value">' + UI.money(total) + '</div></div>' +
        '<button class="btn sm" data-action="budget-add">+ סעיף</button></div></div>' +
      (items.length ? items.map(function (b) {
        var cat = Store.category(b.categoryId);
        return '<div class="row"><div class="r-ico" style="background:' + UI.toneVar(cat.tone) + '">' + UI.catIcon(cat) + '</div>' +
          '<div class="r-body"><div class="r-name">' + UI.esc(b.title || cat.name) + '</div>' +
          '<div class="r-sub">' + UI.esc(cat.name) + (b.date ? ' · ' + UI.dateShort(b.date) : '') + '</div></div>' +
          '<div class="r-end"><div class="r-amount">' + UI.money(Calc.itemAmount(Store.state, b)) + '</div></div></div>';
      }).join('') : UI.empty({ art: 'budget', title: 'עוד אין סעיפי תקציב', text: 'כמו מתנות ליום הולדת, כיבוד, חוגים ועוד.', action: { act: 'budget-add', label: '+ הוספת סעיף תקציב' } })) +
      footer(4, 'סיימנו — כניסה לאפליקציה');
  }

  function render() {
    var n = step();
    if (n === 0) return splash();
    if (n === 1) return step1();
    if (n === 2) return step2();
    if (n === 3) return step3();
    return step4();
  }

  function finish() {
    Store.state.setupDone = true;
    Store.save();
    App.setVs('forceWizard', false);
    App.setVs('wizStep', 0);
    App.setView('home');
    UI.toast('ההרשמה הושלמה בהצלחה 🎉');
  }

  return {
    render: render,
    actions: {
      'wiz-start': function () { App.setVs('wizStep', 1); App.render(); },
      'run-wizard': function () {
        App.setVs('forceWizard', true);
        App.setVs('wizStep', 1);
        App.render();
      },
      'wiz-demo': function () {
        Store.loadDemo();
        App.setVs('wizStep', 0);
        App.setView('home');
        UI.toast('נטענו נתוני דוגמה 🌸');
      },
      'wiz-back': function () { App.setVs('wizStep', Math.max(1, step() - 1)); App.render(); },
      'wiz-next': function () {
        if (step() >= 4) return finish();
        App.setVs('wizStep', step() + 1); App.render();
      },
      'wiz-skip': function () {
        if (step() >= 4) return finish();
        App.setVs('wizStep', step() + 1); App.render();
      },
      'wiz-gan': function (el) {
        Store.state.gan[el.getAttribute('data-key')] = el.value;
        Store.save();
      },
      'wiz-set': function (el) {
        Store.state.settings[el.getAttribute('data-key')] = el.value;
        Store.save();
      }
    }
  };
})();
