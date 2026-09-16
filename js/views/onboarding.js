/* ============================================================
   אשף ההקמה — מסך פתיחה וחמישה שלבים (אפשר לדלג על כל אחד)
   ------------------------------------------------------------
   החשבון הוא השלב הראשון: מרגע שהוא נפתח, כל מה שנכנס בשלבים
   הבאים נשמר בענן תוך כדי ההקמה, ואין שלב שמירה נפרד בסוף.
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.onboarding = (function () {

  function step() { return App.vs('wizStep', 0); }

  /* ============================================================
     שלב הענן (5) — מצב מקומי למסך בלבד
     ------------------------------------------------------------
     המצב לא נשמר ב-Store: הוא רלוונטי רק כל עוד המסך פתוח,
     והסיסמה אינה אמורה להגיע לאחסון המקומי.
     ============================================================ */
  var cloud = { mode: 'form', email: '', password: '', busyText: '', error: '' };

  /* סדר השלבים. שלב החשבון קיים רק כשמוגדר ענן להתחבר אליו. */
  function stepList() {
    var list = (window.Cloud && Cloud.enabled()) ? [stepAccount] : [];
    return list.concat([stepGan, stepChildren, stepStaff, stepBudget]);
  }
  function lastStep() { return stepList().length; }
  function accountStep() { return (window.Cloud && Cloud.enabled()) ? 1 : 0; }
  /* השלב הראשון שאפשר לחזור אליו. פתיחת החשבון אינה בכללם: אחרי שנשלח
     מייל או נפתח חשבון, חזרה לשם רק מבלבלת — ואת המייל אפשר לשנות
     מההגדרות. */
  function firstStep() { return accountStep() + 1; }

  function paint() { App.render(); }

  /* ---------- מסך פתיחה ---------- */
  function splash() {
    return '<div class="splash">' +
      '<div class="art">🏫</div>' +
      '<h1>ועד הורים<br>גן שלנו</h1>' +
      '<p>יחד למען הילדים ❤️<br>ניהול תקציב, גבייה והוצאות במקום אחד</p>' +
      '<button class="btn" data-action="wiz-start">בואו נתחיל</button>' +
      cloudBlock() +
      exitLink() +
      '</div>';
  }

  /* אזור החשבון במסך הפתיחה.
     בלי זה, מכשיר שכבר מחובר אך עדיין ריק נותר תקוע כאן: כפתור
     ההתחברות מוסתר כי יש חשבון, ומסך ההגדרות נגיש רק אחרי סיום ההקמה. */
  function cloudBlock() {
    if (!Cloud.enabled()) return '';
    var i = Cloud.info();

    if (!i.signedIn) {
      // באפליקציה שנוספה למסך הבית המקור הוא לרוב הדפדפן שבאותו מכשיר
      var from = (window.Install && Install.standalone()) ? 'בדפדפן או במכשיר אחר' : 'במכשיר אחר';
      return '<button class="btn soft" style="max-width:320px;margin-top:10px" data-action="acc-signin">' +
        'כבר יש לי חשבון — התחברות</button>' +
        '<p class="small muted" style="max-width:320px;margin-top:14px">' +
        'מתחברים כאן כדי למשוך לכאן נתונים שכבר הזנתם ' + from + '.</p>';
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
    var last = lastStep();
    for (var i = 1; i <= last; i++) dots += '<i class="' + (i <= n ? 'on' : '') + '"></i>';
    return '<div class="wiz-steps">' + dots + '</div>' +
           '<div class="wiz-count">שלב ' + n + ' מתוך ' + last + '</div>';
  }

  function head(n, title, sub, noBack) {
    return '<div style="padding-top:18px">' +
      (n > firstStep() && !noBack
        ? '<button class="iconbtn plain" data-action="wiz-back" aria-label="חזרה לשלב הקודם" ' +
          'style="margin-bottom:6px">→</button>'
        : '') +
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
      (n === lastStep() ? '' :
        '<button class="btn soft" style="margin-top:9px" data-action="wiz-skip">דילוג על השלב הזה</button>') +
      exitLink() +
      '</div>';
  }

  /* מוצא מההקמה בלי לעבור שלב־שלב. השלב שבו עצרנו נשמר, וההקמה
     ממשיכה משם דרך הכפתור שבעמוד הראשי */
  function exitLink() {
    return '<button class="linkbtn" style="margin-top:12px" data-action="wiz-exit">' +
      'לדלג על ההקמה ולהיכנס לאפליקציה</button>';
  }

  /* ---------- פרטי הגן ---------- */
  function stepGan(n) {
    var g = Store.state.gan, s = Store.state.settings;
    return head(n, 'פרטי הגן', 'בואו נתחיל עם הפרטים של הגן שלנו') +
      '<div class="card">' +
        '<div class="field"><label>שם הגן</label>' +
          '<input class="input" data-input="wiz-gan" data-key="name" value="' + UI.esc(g.name) + '" placeholder="גן צבעוני"></div>' +
        '<div class="field"><label>כתובת הגן</label>' +
          '<input class="input" data-input="wiz-gan" data-key="address" value="' + UI.esc(g.address) + '" placeholder="רחוב הגן 12, תל אביב"></div>' +
        '<div class="field"><label>שנת לימודים</label>' +
          '<input class="input" data-input="wiz-gan" data-key="yearLabel" value="' + UI.esc(g.yearLabel) + '" placeholder="2025/2026"></div>' +
        '<div class="grid-2 date-pair">' +
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
      footer(n);
  }

  /* ---------- ילדי הגן ---------- */
  function stepChildren(n) {
    var kids = Store.state.children;
    return head(n, 'ילדי הגן', 'אפשר להוסיף עכשיו או בהמשך, מתוך לשונית "ילדי הגן"') +
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
      footer(n);
  }

  /* ---------- צוות הגן ---------- */
  function stepStaff(n) {
    var staff = Store.state.staff;
    return head(n, 'צוות הגן', 'שמות הצוות והיררכיה — אופציונלי, עוזר בחישוב מתנות') +
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
      footer(n);
  }

  /* ---------- תכנון תקציב (השלב האחרון) ---------- */
  function stepBudget(n) {
    var items = Store.state.budgetItems;
    var total = Calc.budgetTotal(Store.state);
    return head(n, 'תכנון תקציב', 'סעיפי ההוצאה המתוכננים לשנה — אפשר לעדכן בכל רגע') +
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
      footer(n, 'סיימנו — כניסה לאפליקציה');
  }

  /* ============================================================
     שלב 1: פתיחת חשבון
     ------------------------------------------------------------
     השלב לא ממתין לאישור המייל. אם הפרויקט דורש אישור, המייל נשלח
     וההקמה ממשיכה מיד; האישור מזוהה ברקע, ומה שהוזן בינתיים עולה
     לענן ברגע שהוא מגיע.
     ============================================================ */

  /* זיהוי האישור ברקע: בכל חזרה אל הלשונית, ובנוסף כל 20 שניות
     למשך חמש דקות. המרווח רחב בכוונה — כדי לא להיתקל בהגבלת
     הקצב של שרת ההתחברות. */
  var watchTimer = null, watchFrom = 0, lastCheck = 0;

  function startWatch() {
    stopWatch();
    watchFrom = Date.now();
    watchTimer = setInterval(function () {
      // אחרי חמש דקות מפסיקים לשאול מיוזמתנו; החזרה ללשונית והכפתור עדיין בודקים
      if (Date.now() - watchFrom > 300000) { clearInterval(watchTimer); watchTimer = null; return; }
      check(false);
    }, 20000);
    window.addEventListener('focus', onBack);
    document.addEventListener('visibilitychange', onVisible);
  }

  function stopWatch() {
    clearInterval(watchTimer);
    watchTimer = null;
    window.removeEventListener('focus', onBack);
    document.removeEventListener('visibilitychange', onVisible);
  }

  function onBack()    { check(false); }
  function onVisible() { if (!document.hidden) check(false); }

  function check(manual) {
    if (cloud.mode !== 'sent') return;
    var now = Date.now();
    if (!manual && now - lastCheck < 6000) return;   // מרווח מזערי בין בדיקות
    lastCheck = now;
    if (manual) { cloud.mode = 'busy'; cloud.busyText = 'בודקים את האישור…'; paint(); }

    Cloud.signIn(cloud.email, cloud.password).then(function () { succeed(); }, function (err) {
      if (cloud.mode === 'done') return;
      cloud.mode = 'sent';
      if (!manual) return;
      var msg = (err && err.message) || '';
      cloud.error = /לאשר את המייל/.test(msg) ? 'עוד לא אישרתם — הקישור מחכה במייל שנשלח' : msg;
      paint();
    });
  }

  function succeed() {
    stopWatch();
    cloud.mode = 'done';
    cloud.error = '';

    var later = (step() !== accountStep() || Store.state.setupDone);
    if (window.Analytics) Analytics.account(later ? 'confirmed' : 'signup');

    // האישור הגיע אחרי שכבר המשכנו הלאה — די בהודעה קצרה
    if (later) {
      UI.toast('החשבון אושר ✓ הנתונים נשמרים בענן');
      App.render();
      return;
    }

    paint();
    // רגע של הצלחה לפני המעבר לשלב הבא
    setTimeout(function () {
      if (cloud.mode !== 'done') return;
      // נמשכו נתונים מהענן של חשבון קיים — ההקמה כבר מאחורינו
      if (Store.state.setupDone) { App.render(); return; }
      advance();
    }, 1400);
  }

  function signup() {
    var email = (cloud.email || '').trim();
    var pass  = cloud.password || '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { cloud.error = 'כתובת המייל אינה תקינה'; return paint(); }
    if (pass.length < 6) { cloud.error = 'הסיסמה צריכה להיות באורך 6 תווים לפחות'; return paint(); }

    cloud.email = email;
    cloud.error = '';
    cloud.mode = 'busy';
    cloud.busyText = 'פותחים חשבון ומעלים את הנתונים…';
    paint();

    Cloud.signUp(email, pass).then(function (res) {
      // אין טוקן בתשובה — הפרויקט דורש אישור מייל. לא עוצרים בשבילו:
      // ממשיכים בהקמה, והאישור מזוהה ברקע.
      if (res && res.confirmed === false) {
        cloud.mode = 'sent';
        paint();
        startWatch();
        setTimeout(function () {
          if (cloud.mode === 'sent' && step() === accountStep()) advance();
        }, 3000);
        return;
      }
      succeed();
    }, function (err) {
      var msg = (err && err.message) || 'פתיחת החשבון נכשלה';
      // כתובת שכבר רשומה היא לרוב כניסה חוזרת — מנסים להתחבר איתה
      if (/כבר רשומה/.test(msg)) {
        cloud.busyText = 'הכתובת כבר רשומה — מתחברים…';
        paint();
        Cloud.signIn(email, pass).then(succeed, function (e2) {
          cloud.mode = 'form';
          cloud.error = (e2 && e2.message) || msg;
          paint();
        });
        return;
      }
      cloud.mode = 'form';
      cloud.error = msg;
      paint();
    });
  }

  function errorNote(extra) {
    if (!cloud.error) return '';
    return '<div class="note" style="background:#FDF0F2' + (extra || '') + '"><div class="n-ico">⚠️</div><div>' +
           UI.esc(cloud.error) + '</div></div>';
  }

  function stepAccount(n) {
    // אין חזרה אחורה אחרי שהפנייה לשרת יצאה לדרך
    var busyNow = cloud.mode !== 'form' || Cloud.signedIn();
    var top = head(n, 'פתיחת חשבון', 'כדי שכל מה שתזינו יישמר בענן ויהיה זמין בטלפון ובמחשב', busyNow);

    /* כבר מחוברים לחשבון — אין מה לפתוח */
    if (cloud.mode !== 'done' && Cloud.signedIn()) {
      return top +
        '<div class="card"><div class="state-box">' +
          '<div class="state-ico">✓</div><b>החשבון מחובר</b>' +
          '<p>' + UI.esc(Cloud.info().email || '') + '<br>מכאן כל שינוי נשמר בענן אוטומטית</p>' +
        '</div></div>' +
        '<div class="mt"><button class="btn" data-action="wiz-next">המשך להקמה</button></div>';
    }

    if (cloud.mode === 'busy') {
      return top +
        '<div class="card"><div class="state-box" role="status" aria-live="polite">' +
          '<div class="spinner"></div>' +
          '<b>' + UI.esc(cloud.busyText || 'רגע אחד…') + '</b>' +
          '<p>לא לסגור את החלון</p>' +
        '</div></div>';
    }

    /* המייל נשלח — ממשיכים הלאה, לא ממתינים לו */
    if (cloud.mode === 'sent') {
      return top +
        '<div class="card"><div class="state-box" role="status" aria-live="polite">' +
          '<div class="state-ico info">📬</div>' +
          '<b>המייל בדרך</b>' +
          '<p>שלחנו אישור אל<br><span class="mail">' + UI.esc(cloud.email) + '</span><br>' +
          'אפשר להמשיך בהקמה כרגיל — נזהה את האישור לבד, וכל מה שהוזן בינתיים יעלה לענן.</p>' +
        '</div></div>' +
        errorNote() +
        '<div class="mt">' +
          '<button class="btn" data-action="wiz-next">המשך להקמה</button>' +
          '<button class="btn soft" style="margin-top:9px" data-action="wiz-cloud-check">כבר אישרתי — בדיקה עכשיו</button>' +
          '<button class="linkbtn" style="margin-top:11px" data-action="wiz-cloud-resend">המייל לא הגיע? שליחה מחדש</button>' +
        '</div>';
    }

    if (cloud.mode === 'done') {
      return top +
        '<div class="card"><div class="state-box" role="status" aria-live="polite">' +
          '<div class="state-ico">✓</div>' +
          '<b>החשבון נפתח 🎉</b>' +
          '<p>מכאן כל שינוי נשמר בענן אוטומטית</p>' +
        '</div></div>';
    }

    /* ברירת המחדל — הטופס */
    return top +
      '<div class="card">' +
        '<p class="small muted" style="margin:0 0 14px">' +
          'החשבון נפתח עכשיו, וכל מה שתזינו בשלבים הבאים נשמר בענן תוך כדי. ' +
          'כך הנתונים מגובים מהרגע הראשון, ואפשר להמשיך לעבוד מכל מכשיר.' +
        '</p>' +
        '<div class="field"><label for="cloud-email">אימייל</label>' +
          '<input class="input" id="cloud-email" type="email" inputmode="email" autocomplete="email" ' +
          'data-input="wiz-cloud" data-key="email" value="' + UI.esc(cloud.email) + '" placeholder="dana@example.com"></div>' +
        '<div class="field" style="margin-bottom:0"><label for="cloud-pass">סיסמה</label>' +
          '<input class="input" id="cloud-pass" type="password" autocomplete="new-password" ' +
          'data-input="wiz-cloud" data-key="password" value="' + UI.esc(cloud.password) + '" placeholder="••••••">' +
          '<div class="hint">לפחות 6 תווים. הסיסמה משמשת רק לכניסה לחשבון שלכם.</div></div>' +
        errorNote(';margin:14px 0 0') +
      '</div>' +
      '<div class="mt">' +
        '<button class="btn" data-action="wiz-cloud-signup">פתיחת חשבון והמשך</button>' +
        '<button class="btn ghost" style="margin-top:9px" data-action="acc-signin">כבר יש לי חשבון — התחברות</button>' +
        '<button class="btn soft" style="margin-top:9px" data-action="wiz-skip">דילוג — בלי חשבון</button>' +
      '</div>' +
      '<div class="hint" style="text-align:center">אפשר לפתוח חשבון בכל רגע גם מההגדרות ⚙️</div>';
  }

  function render() {
    var n = step();
    if (n === 0) return splash();
    var list = stepList();
    var i = Math.min(Math.max(n, 1), list.length);
    return list[i - 1](i);
  }

  function finish() {
    stopWatch();
    Store.state.setupDone = true;
    Store.save();
    App.setVs('resumeWizard', false);
    App.setVs('wizStep', 0);   // אפס מוחק את השלב השמור — ההקמה תמה
    App.setView('home');
    var withAccount = !!(window.Cloud && Cloud.signedIn());
    // בלי חשבון לא נשמר דבר מחוץ למכשיר — והטקסט לא יתיימר שכן
    UI.toast(withAccount ? 'הכול מוכן 🎉 הנתונים נשמרים בענן' : 'ההקמה הושלמה 🎉');
    if (window.Analytics) Analytics.setupDone(withAccount);
  }

  /* מעבר לשלב הבא, או סיום אם זה היה האחרון */
  function advance() {
    var n = step();
    if (n >= lastStep()) return finish();
    App.setVs('wizStep', n + 1);
    App.render();
    if (window.Analytics) Analytics.wizardStep(n + 1);
  }

  function resetCloud() {
    stopWatch();
    cloud = { mode: 'form', email: '', password: '', busyText: '', error: '' };
  }

  return {
    render: render,
    actions: {
      'wiz-start': function () {
        resetCloud();
        App.setVs('wizStep', 1);
        App.render();
      },
      /* "המשך בתהליך ההקמה" — ממשיכים מהשלב שנשמר, ורק מי שסיים
         את ההקמה וביקש להריץ אותה שוב מתחיל מהתחלה */
      'run-wizard': function () {
        resetCloud();
        App.setVs('resumeWizard', true);
        App.setVs('wizStep', App.savedWizStep() || 1);
        App.render();
      },
      'wiz-exit': function () {
        Store.state.setupDone = true;   // "אל תכפו עליי את ההקמה", לא "סיימתי"
        Store.save();
        App.setVs('resumeWizard', false);
        App.setView('home');
        UI.toast('אפשר להשלים את ההקמה בכל רגע מהעמוד הראשי');
      },
      /* המידע נשמר ב-Store תוך כדי ההקלדה, ולכן חזרה אחורה מציגה אותו
         כפי שהוא — אין כאן מה לשחזר */
      'wiz-back': function () {
        App.setVs('wizStep', Math.max(firstStep(), step() - 1));
        App.render();
      },
      'wiz-next': advance,
      'wiz-skip': advance,
      'wiz-cloud': function (el) { cloud[el.getAttribute('data-key')] = el.value; },
      'wiz-cloud-signup': signup,
      'wiz-cloud-check': function () { check(true); },
      'wiz-cloud-resend': function () { Views.account.resendForm(cloud.email); },
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
