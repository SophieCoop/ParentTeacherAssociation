/* ============================================================
   הגדרות — פרטי הוועד, דוח כספי ואיפוס
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.settings = (function () {

  /* נתוני דוגמה מוצעים רק כשאין חשבון שאפשר לדרוס */
  function demoAllowed() { return !(window.Cloud && Cloud.signedIn()); }

  /* הטלפון של בעל האתר, לכתיבה בוואטסאפ. יושב ב-js/config.js;
     בלעדיו אין למי לפנות, ועדיף בלי כפתור מאשר כפתור שאינו מגיע לאיש. */
  function supportPhone() {
    return ((window.SupportConfig && SupportConfig.phone) || '').trim();
  }

  /* בחירת סוג הוועד — אותה בחירה שבאשף ההקמה, כדי שאפשר יהיה לתקן
     אותה בלי להריץ את ההקמה מחדש. שינוי כאן מחליף את השפה מיד. */
  function kindPicker() {
    var cur = Lang.kind();
    return '<div class="kind-pick compact" role="radiogroup" aria-label="סוג הוועד">' +
      '<div class="cb-q">סוג הוועד</div>' +
      '<div class="small muted">השפה באפליקציה מותאמת לבחירה</div>' +
      '<div class="kind-grid">' + Lang.KINDS.map(function (k) {
        var on = k.id === cur;
        return '<button type="button" class="kind-card' + (on ? ' on' : '') + '" role="radio" ' +
          'aria-checked="' + (on ? 'true' : 'false') + '" ' +
          'data-action="set-kind" data-kind="' + k.id + '">' +
          '<span class="kc-radio" aria-hidden="true"></span>' +
          '<span class="kc-art" aria-hidden="true">' + k.icon + '</span>' +
          '<span class="kc-name">' + UI.esc(k.label) + '</span>' +
          '</button>';
      }).join('') + '</div></div>';
  }

  function render() {
    var st = Store.state;
    var html = UI.pageHead({ title: 'הגדרות', subtitle: 'פרטי הוועד, דוח כספי ואיפוס', icon: '⚙️', tone: 'mint', back: 'home' });

    html += Views.account.panel();

    html += '<div class="card">' +
      '<div class="card-title"><h2>פרטי הוועד</h2></div>' +
      kindPicker() +
      '<div class="count-sep"></div>' +
      '<div class="field"><label>' + Lang.t('placeName') + '</label>' +
        '<input class="input" data-change="set-gan" data-key="name" value="' + UI.esc(st.gan.name) + '" placeholder="' + UI.esc(Lang.t('placeNamePh')) + '"></div>' +
      '<div class="field mb0"><label>שנת לימודים</label>' +
        '<input class="input" data-change="set-gan" data-key="yearLabel" value="' + UI.esc(st.gan.yearLabel) + '"></div>' +
      '</div>';

    html += '<div class="card">' +
      '<div class="card-title"><h2>שנת הלימודים</h2></div>' +
      '<div class="grid-2 date-pair">' +
        '<div class="field"><label>תחילת שנה</label>' +
          '<input class="input" type="date" data-change="set-cfg" data-key="yearStart" value="' + UI.esc(st.settings.yearStart) + '"></div>' +
        '<div class="field"><label>סוף שנה</label>' +
          '<input class="input" type="date" data-change="set-cfg" data-key="yearEnd" value="' + UI.esc(st.settings.yearEnd) + '"></div>' +
      '</div>' +
      '<div class="hint mb0">התאריכים קובעים את חודשי הפעילות של סעיפים חודשיים. ' +
        'החלוקה בין ההורים נעשית סעיף-סעיף: כל סעיף מתחלק בין הילדים שכבר היו ' + Lang.t('placeIn') + ' ' +
        'בתאריך שלו, כך שילד שהצטרף באמצע אינו משלם על מה שקדם לו.</div>' +
      '</div>';

    html += '<div class="card">' +
      '<div class="card-title"><h2>הנתונים שלי</h2></div>' +
      '<p class="small muted">' +
      (Cloud.info().signedIn
        ? 'הנתונים נשמרים במכשיר וגם מסונכרנים לחשבון שלכם בענן. '
        : 'הנתונים נשמרים במכשיר הזה בלבד. ') +
      'אפשר לייצא מהם דוח כספי לאקסל בכל רגע.</p>' +
      '<button class="btn ghost mt" data-action="set-xlsx">📊 ייצוא דוח לאקסל</button>' +
      '<div class="hint">הדוח כולל את ההכנסות לקופה, תכנון התקציב, ההוצאות בפועל, ' +
        'כמה נשאר — ומאזן ההחזרים להורים, אם יש כזה.</div>' +
      '<div class="stat-grid" style="margin-top:14px">' +
        '<div class="stat"><div class="s-val">' + st.children.length + '</div><div class="s-lab">ילדים</div></div>' +
        '<div class="stat"><div class="s-val">' + st.payments.length + '</div><div class="s-lab">תשלומים</div></div>' +
        '<div class="stat"><div class="s-val">' + st.expenses.length + '</div><div class="s-lab">הוצאות</div></div>' +
      '</div>' +
      /* עמוד סטטי מחוץ לאפליקציה, ולכן קישור רגיל ולא data-action */
      '<p class="small muted mt mb0">באפליקציה יושבים פרטים של ילדים והורים. ' +
      '<a href="privacy.html" target="_blank" rel="noopener">מדיניות הפרטיות</a> ' +
      'מפרטת מה נשמר, איפה, ומי יכול לגשת.</p>' +
      '</div>';

    /* ההצעה קופצת מעצמה אחרי כמה כניסות, ומי שדחה אותה צריך דרך
       לחזור אליה — וגם מי שרוצה להתקין את האפליקציה במכשיר נוסף */
    if (window.Install && Install.canInstall()) {
      var onHome = Install.standalone();
      html += '<div class="card">' +
        '<div class="card-title"><h2>האפליקציה במסך הבית</h2></div>' +
        '<p class="small muted' + (onHome ? ' mb0' : '') + '">' +
        (onHome
          ? 'האפליקציה כבר רצה מהאייקון שבמסך הבית של המכשיר הזה ✓ ' +
            'במכשיר נוסף מוסיפים אותה מתוך הדפדפן, באותה דרך.'
          : 'אפשר להוסיף את האתר למסך הבית ולהפעיל אותו כמו אפליקציה — ' +
            'פתיחה בלחיצה אחת, במסך מלא ובלי סרגלי הדפדפן.') +
        '</p>' +
        (onHome ? '' : '<button class="btn ghost mt" data-action="set-install">📲 הוספה למסך הבית</button>') +
        '</div>';
    }

    html += '<div class="card">' +
      '<div class="card-title"><h2>עזרה</h2></div>' +
      '<p class="small muted">סיור קצר שמראה מה יש בכל חלק של האפליקציה. ' +
      'רץ פעם אחת בכניסה הראשונה, ומכאן אפשר להריץ אותו שוב בכל רגע.</p>' +
      '<button class="btn ghost mt" data-action="set-tour">🧭 סיור היכרות</button>' +
      (supportPhone()
        ? '<p class="small muted" style="margin-top:16px">משהו לא עובד כמו שצריך, או שיש שאלה? ' +
          'אפשר לכתוב ישירות לבעל האתר.</p>' +
          '<button class="btn wa mt" data-action="set-support">כתיבה בוואטסאפ</button>'
        : '') +
      '</div>';

    /* נתוני הדוגמה מחליפים את המצב כולו, והמצב כולו נדחף לענן —
       כך שלמי שמחובר לחשבון הכפתור הזה מוחק את הנתונים האמיתיים
       מכל המכשירים. הוא נועד להתרשמות ראשונית, לא למי שכבר עובד. */
    html += '<div class="card">' +
      '<div class="card-title"><h2>אזור מסוכן</h2></div>' +
      (demoAllowed()
        ? '<button class="btn danger" data-action="set-demo" style="margin-bottom:9px">🌸 טעינת נתוני דוגמה</button>'
        : '<div class="hint" style="margin:0 0 12px">נתוני הדוגמה אינם זמינים כשמחוברים לחשבון — הם היו מחליפים ' +
          'את הנתונים האמיתיים גם בענן וגם בכל מכשיר אחר שמחובר אליו.</div>') +
      '<button class="btn danger" data-action="set-reset">🗑 מחיקת כל הנתונים</button>' +
      /* מחיקת החשבון היא פעולה אחרת ממחיקת הנתונים שבמכשיר, והיא
         נפרדת ממנה בכוונה: זו מוחקת גם את מה שבענן ואת החשבון עצמו */
      (window.Cloud && Cloud.signedIn()
        ? '<button class="btn danger" data-action="set-delete-account" style="margin-top:9px">' +
          '☁️ מחיקת החשבון לצמיתות</button>'
        : '') +
      '</div>';

    html += '<p class="center small muted mt">' + Lang.t('brand') + ' · יחד למען הילדים ❤️<br>' +
      'גרסה ' + UI.esc(window.APP_VERSION || '—') + '</p>';
    return html;
  }

  return {
    render: render,
    actions: {
      /* הסיור יושב על מסך הבית, ולכן חוזרים אליו לפני שמתחילים */
      'set-tour': function () {
        App.setView('home');
        setTimeout(function () { Tour.start(); }, 260);
      },
      'set-install': function () { Install.open(false); },
      /* השיחה נפתחת ריקה למעט שורת פתיחה שאומרת מאיפה הפנייה —
         בעל האתר מקבל הודעה ממספר שאינו מוכר לו */
      'set-support': function () {
        var phone = supportPhone();
        if (!phone) return;
        UI.whatsapp('שלום, אני פונה בנוגע לאתר "' + Lang.t('brand') + '":\n', phone);
      },
      /* שינוי סוג הוועד — השפה מתחלפת מיד, ורשומות הצוות הזמניות
         מתעדכנות איתה (Store.setKind) */
      'set-kind': function (el) {
        var k = el.getAttribute('data-kind');
        if (k === Lang.kind()) return;
        Store.setKind(k);
        App.render();
        UI.toast('השפה עודכנה ל' + Lang.kindInfo().label + ' ✓');
      },
      'set-gan': function (el) { Store.state.gan[el.getAttribute('data-key')] = el.value; Store.save(); UI.toast('נשמר ✓'); },
      'set-cfg': function (el) {
        var key = el.getAttribute('data-key');
        Store.state.settings[key] = key === 'roundShare' ? Calc.num(el.value) : el.value;
        Store.save();
        UI.toast('נשמר ✓');
      },
      /* ---------- ייצוא דוח לאקסל ----------
         בקובץ יושבים שמות של ילדים ושל הורים, והוא יוצא מהאפליקציה
         אל המכשיר ומשם לכל מקום שאליו ישלחו אותו. לכן ההורדה עוברת
         דרך אישור מפורש: מה יש בקובץ, ומה האחריות שעוברת למי
         שמוריד אותו. */
      'set-xlsx': function () {
        var rf = Calc.refunds(Store.state);
        var hasRefunds = rf.totalRefund > 0 || rf.totalOwed > 0;

        UI.modal({
          title: 'ייצוא דוח כספי לאקסל 📊',
          subtitle: 'לפני ההורדה — רגע אחד על מה שיוצא מכאן',
          body:
            '<p class="small" style="line-height:1.75;margin:0 0 10px">בקובץ יהיו:</p>' +
            '<ul class="bullets" style="margin-bottom:14px">' +
              '<li>סיכום — כמה נגבה, כמה תוכנן, כמה יצא וכמה נשאר בקופה.</li>' +
              '<li>ההכנסות לקופה, תשלום־תשלום, עם שמות הילדים וההורים.</li>' +
              '<li>תכנון התקציב וההוצאות בפועל.</li>' +
              (hasRefunds ? '<li>מאזן ההחזרים להורים.</li>' : '') +
            '</ul>' +
            '<div class="note" style="background:#FDF0F2;margin-bottom:14px"><div class="n-ico">⚠️</div><div>' +
              '<b>הקובץ מכיל פרטים אישיים</b>' +
              'שמות של ילדים ושל הורים. מרגע ההורדה הוא יושב במכשיר שלכם ואינו ' +
              'מוגן עוד על ידי האפליקציה — שמרו אותו במקום בטוח, ושתפו רק עם מי שצריך.' +
            '</div></div>' +
            '<label class="check-line"><input type="checkbox" class="js-ok">' +
              '<span>קראתי את <a href="privacy.html" target="_blank" rel="noopener">מדיניות הפרטיות</a> ' +
              'ואני מאשר/ת את הורדת הקובץ</span></label>' +
            '<button class="btn mt js-go" disabled>⬇️ הורדת הקובץ</button>',
          onMount: function (root, close) {
            var ok = root.querySelector('.js-ok');
            var go = root.querySelector('.js-go');
            ok.addEventListener('change', function () { go.disabled = !ok.checked; });
            go.addEventListener('click', function () {
              go.disabled = true;
              go.textContent = 'מכין את הקובץ…';
              Report.download().then(function () {
                close();
                UI.toast('הדוח הורד ✓');
              }, function (err) {
                go.disabled = false;
                go.textContent = '⬇️ הורדת הקובץ';
                UI.toast((err && err.message) || 'הכנת הקובץ נכשלה');
              });
            });
          }
        });
      },
      'set-demo': function () {
        // שמירת ביטחון: הכפתור מוסתר, אבל הפעולה עצמה גלובלית
        if (!demoAllowed()) { UI.toast('אי אפשר לטעון נתוני דוגמה כשמחוברים לחשבון'); return; }
        UI.confirmBox('טעינת נתוני דוגמה?', 'הנתונים הקיימים יוחלפו בנתוני דוגמה.', function () {
          Store.loadDemo();
          App.setView('home');
          UI.toast('נטענו נתוני דוגמה 🌸');
        });
      },
      /* מחיקת חשבון היא הפעולה היחידה באפליקציה שאי אפשר לחזור ממנה
         בשום דרך — גם לא מהענן, כי הענן עצמו נמחק. לכן החלון מפרט מה
         נמחק, ומציע להוריד קודם את הדוח הכספי. */
      'set-delete-account': function () {
        var email = (Cloud.info().email || '');
        UI.modal({
          title: 'מחיקת החשבון לצמיתות?',
          subtitle: email ? 'החשבון ' + email : '',
          body:
            '<p class="small" style="line-height:1.75;margin:0 0 12px">מה יימחק:</p>' +
            '<ul class="bullets" style="margin-bottom:14px">' +
              '<li>החשבון עצמו, ואיתו האפשרות להתחבר איתו שוב.</li>' +
              '<li>כל הנתונים ששמורים בענן — ילדים, הורים, תשלומים והוצאות.</li>' +
              '<li>' + Lang.t('savedOnDevice') + '</li>' +
            '</ul>' +
            '<div class="note" style="background:#FDF0F2;margin-bottom:14px"><div class="n-ico">⚠️</div><div>' +
            'הפעולה מיידית ואינה הפיכה. מכשיר אחר שמחובר לחשבון יינתק בפעם ' +
            'הבאה שינסה להסתנכרן, אבל העותק ששמור בו יישאר שם עד שיימחק בנפרד.' +
            '</div></div>' +
            '<button class="btn ghost js-backup">📊 ייצוא דוח אקסל קודם</button>' +
            '<div class="btn-row mt">' +
              '<button class="btn soft js-no">ביטול</button>' +
              '<button class="btn js-yes" style="background:var(--danger);color:#fff">מחיקת החשבון</button>' +
            '</div>',
          onMount: function (root, close) {
            root.querySelector('.js-backup').addEventListener('click', function () {
              Views.settings.actions['set-xlsx']();
            });
            root.querySelector('.js-no').addEventListener('click', close);
            root.querySelector('.js-yes').addEventListener('click', function (e) {
              var btn = e.currentTarget;
              btn.disabled = true;
              btn.textContent = 'מוחק…';
              Cloud.deleteAccount().then(function () {
                close();
                App.setVs('resumeWizard', false);
                App.setVs('wizStep', 0);
                App.setView('home');
                UI.toast('החשבון נמחק');
              }, function (err) {
                btn.disabled = false;
                btn.textContent = 'מחיקת החשבון';
                UI.toast((err && err.message) || 'מחיקת החשבון נכשלה');
              });
            });
          }
        });
      },
      'set-reset': function () {
        UI.confirmBox('מחיקת כל הנתונים?', 'כל הילדים, התשלומים וההוצאות יימחקו לצמיתות — כולל גנים של חשבונות אחרים שחונים במכשיר. פעולה זו אינה הפיכה.', function () {
          Store.clearAllSlots();
          App.setVs('wizStep', 0);
          App.setView('home');
          UI.toast('הכל נמחק');
        });
      }
    }
  };
})();
