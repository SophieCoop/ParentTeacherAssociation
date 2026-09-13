/* ============================================================
   אשף ההקמה — מסך פתיחה ו-4 שלבים (אפשר לדלג על כל שלב)
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

  /* השלב האחרון קיים רק כשמוגדר ענן להתחבר אליו */
  function lastStep() { return (window.Cloud && Cloud.enabled()) ? 5 : 4; }

  function paint() { App.render(); }

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
    var last = lastStep();
    for (var i = 1; i <= last; i++) dots += '<i class="' + (i <= n ? 'on' : '') + '"></i>';
    return '<div class="wiz-steps">' + dots + '</div>' +
           '<div class="wiz-count">שלב ' + n + ' מתוך ' + last + '</div>';
  }

  function head(n, title, sub, noBack) {
    return '<div style="padding-top:18px">' +
      (n > 1 && !noBack ? '<button class="iconbtn plain" data-action="wiz-back" style="margin-bottom:6px">→</button>' : '') +
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
      footer(4, lastStep() === 4 ? 'סיימנו — כניסה לאפליקציה' : 'המשך');
  }

  /* ============================================================
     שלב 5: שמירה בענן
     ------------------------------------------------------------
     השלב יושב בסוף בכוונה: רק כאן כבר יש נתונים אמיתיים להעלות,
     וגם אם אישור המייל משתהה — ההקמה עצמה כבר מאחורינו.
     ============================================================ */

  /* בדיקת אישור המייל רצה ברקע: בכל חזרה אל הלשונית, ובנוסף כל 20
     שניות למשך חמש דקות. המרווח רחב בכוונה — כדי לא להיתקל בהגבלת
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
    if (cloud.mode !== 'waiting') return;
    var now = Date.now();
    if (!manual && now - lastCheck < 6000) return;   // מרווח מזערי בין בדיקות
    lastCheck = now;
    if (manual) { cloud.mode = 'busy'; cloud.busyText = 'בודקים את האישור…'; paint(); }

    Cloud.signIn(cloud.email, cloud.password).then(succeed, function (err) {
      if (cloud.mode === 'done') return;
      cloud.mode = 'waiting';
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
    paint();
    // רגע של הצלחה לפני שהמסך מתחלף
    setTimeout(function () {
      if (cloud.mode !== 'done' || Store.state.setupDone) return;
      finish(true);
    }, 1600);
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
      // אין טוקן בתשובה — הפרויקט דורש אישור מייל, וממתינים לו
      if (res && res.confirmed === false) { cloud.mode = 'waiting'; paint(); startWatch(); return; }
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

  function step5() {
    // אין חזרה אחורה אחרי שהפנייה לשרת יצאה לדרך
    var busyNow = cloud.mode !== 'form' || Cloud.signedIn();
    var top = head(5, 'שמירה בענן', 'שלב אחרון — כדי שהנתונים לא יישארו רק במכשיר הזה', busyNow);

    /* כבר מחוברים לחשבון — אין מה לפתוח */
    if (cloud.mode !== 'done' && Cloud.signedIn()) {
      return top +
        '<div class="card"><div class="state-box">' +
          '<div class="state-ico">✓</div><b>החשבון מחובר</b>' +
          '<p>' + UI.esc(Cloud.info().email || '') + '</p>' +
        '</div></div>' +
        '<div class="mt"><button class="btn" data-action="wiz-next">סיום — כניסה לאפליקציה</button></div>';
    }

    if (cloud.mode === 'busy') {
      return top +
        '<div class="card"><div class="state-box" role="status" aria-live="polite">' +
          '<div class="spinner"></div>' +
          '<b>' + UI.esc(cloud.busyText || 'רגע אחד…') + '</b>' +
          '<p>לא לסגור את החלון</p>' +
        '</div></div>';
    }

    if (cloud.mode === 'waiting') {
      return top +
        '<div class="card"><div class="state-box" role="status" aria-live="polite">' +
          '<div class="spinner"></div>' +
          '<b>ממתינים לאישור המייל</b>' +
          '<p>שלחנו מייל אישור אל<br><span class="mail">' + UI.esc(cloud.email) + '</span><br>' +
          'צריך ללחוץ על הקישור שבו כדי להפעיל את החשבון.</p>' +
        '</div></div>' +
        '<div class="note"><div class="n-ico">💡</div><div>' +
          '<b>הקישור ייפתח בעמוד ריק — זה תקין.</b>' +
          'האישור מתבצע בלחיצה עצמה. אחרי הלחיצה חוזרים לכאן, והמסך יתעדכן לבד.' +
        '</div></div>' +
        errorNote() +
        '<div class="mt">' +
          '<button class="btn ghost" data-action="wiz-cloud-check">כבר אישרתי — בדיקה עכשיו</button>' +
          '<button class="btn soft" style="margin-top:9px" data-action="wiz-skip">לדלג — אפשר להשלים אחר כך</button>' +
        '</div>';
    }

    if (cloud.mode === 'done') {
      return top +
        '<div class="card"><div class="state-box" role="status" aria-live="polite">' +
          '<div class="state-ico">✓</div>' +
          '<b>ההרשמה הושלמה בהצלחה 🎉</b>' +
          '<p>הנתונים נשמרו בענן ויסתנכרנו בכל מכשיר שתתחברו בו</p>' +
        '</div></div>';
    }

    /* ברירת המחדל — הטופס */
    var st = Store.state, counts = [];
    if ((st.children || []).length)    counts.push(st.children.length + ' ילדים');
    if ((st.staff || []).length)       counts.push(st.staff.length + ' אנשי צוות');
    if ((st.budgetItems || []).length) counts.push(st.budgetItems.length + ' סעיפי תקציב');

    return top +
      '<div class="card">' +
        '<p class="small muted" style="margin:0 0 14px">' +
          (counts.length
            ? 'מה שהזנתם — ' + UI.esc(counts.join(' · ')) + ' — שמור כרגע במכשיר הזה בלבד. '
            : 'הנתונים נשמרים כרגע במכשיר הזה בלבד. ') +
          'חשבון שומר עותק בענן, ומאפשר לפתוח את אותם נתונים גם בטלפון וגם במחשב.' +
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
        '<button class="btn" data-action="wiz-cloud-signup">פתיחת חשבון ושמירה בענן</button>' +
        '<button class="btn ghost" style="margin-top:9px" data-action="acc-signin">כבר יש לי חשבון — התחברות</button>' +
        '<button class="btn soft" style="margin-top:9px" data-action="wiz-skip">לא עכשיו — לדלג</button>' +
      '</div>' +
      '<div class="hint" style="text-align:center">אפשר לפתוח חשבון בכל רגע גם מההגדרות ⚙️</div>';
  }

  function render() {
    var n = step();
    if (n === 0) return splash();
    if (n === 1) return step1();
    if (n === 2) return step2();
    if (n === 3) return step3();
    if (n === 5) return step5();
    return step4();
  }

  function finish(registered) {
    stopWatch();
    Store.state.setupDone = true;
    Store.save();
    App.setVs('forceWizard', false);
    App.setVs('wizStep', 0);
    App.setView('home');
    // בלי חשבון לא נרשם דבר בשום מקום — והטקסט לא יתיימר שכן
    UI.toast(registered ? 'ההרשמה הושלמה בהצלחה 🎉' : 'ההקמה הושלמה 🎉');
  }

  /* מעבר לשלב הבא, או סיום אם זה היה האחרון */
  function advance() {
    var n = step();
    if (n >= lastStep()) return finish(!!(window.Cloud && Cloud.signedIn()));
    var next = n + 1;
    // בשלב הענן ההתחברות מדליקה signedIn, ובלי הסימון הזה מסך ההקמה
    // היה נעלם באמצע הדרך (ראו את תנאי הניתוב ב-App.render)
    if (next === 5) App.setVs('forceWizard', true);
    App.setVs('wizStep', next);
    App.render();
  }

  function resetCloud() {
    stopWatch();
    cloud = { mode: 'form', email: '', password: '', busyText: '', error: '' };
  }

  return {
    render: render,
    actions: {
      'wiz-start': function () { resetCloud(); App.setVs('wizStep', 1); App.render(); },
      'run-wizard': function () {
        resetCloud();
        App.setVs('forceWizard', true);
        App.setVs('wizStep', 1);
        App.render();
      },
      'wiz-demo': function () {
        resetCloud();
        Store.loadDemo();
        App.setVs('wizStep', 0);
        App.setView('home');
        UI.toast('נטענו נתוני דוגמה 🌸');
      },
      'wiz-back': function () { App.setVs('wizStep', Math.max(1, step() - 1)); App.render(); },
      'wiz-next': advance,
      'wiz-skip': advance,
      'wiz-cloud': function (el) { cloud[el.getAttribute('data-key')] = el.value; },
      'wiz-cloud-signup': signup,
      'wiz-cloud-check': function () { check(true); },
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
