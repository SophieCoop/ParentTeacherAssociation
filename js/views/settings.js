/* ============================================================
   הגדרות — פרטי הגן, גיבוי נתונים ואיפוס
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.settings = (function () {

  /* נתוני דוגמה מוצעים רק כשאין חשבון שאפשר לדרוס */
  function demoAllowed() { return !(window.Cloud && Cloud.signedIn()); }

  function render() {
    var st = Store.state;
    var html = UI.pageHead({ title: 'הגדרות', subtitle: 'פרטי הגן וגיבוי נתונים', icon: '⚙️', tone: 'mint', back: 'home' });

    html += Views.account.panel();

    html += '<div class="card">' +
      '<div class="card-title"><h2>פרטי הגן</h2></div>' +
      '<div class="field"><label>שם הגן</label>' +
        '<input class="input" data-change="set-gan" data-key="name" value="' + UI.esc(st.gan.name) + '" placeholder="גן צבעוני"></div>' +
      '<div class="field"><label>כתובת</label>' +
        '<input class="input" data-change="set-gan" data-key="address" value="' + UI.esc(st.gan.address) + '"></div>' +
      '<div class="field"><label>שנת לימודים</label>' +
        '<input class="input" data-change="set-gan" data-key="yearLabel" value="' + UI.esc(st.gan.yearLabel) + '"></div>' +
      '<div class="grid-2">' +
        '<div class="field mb0"><label>איש קשר</label>' +
          '<input class="input" data-change="set-gan" data-key="contactName" value="' + UI.esc(st.gan.contactName) + '"></div>' +
        '<div class="field mb0"><label>טלפון</label>' +
          '<input class="input" type="tel" data-change="set-gan" data-key="phone" value="' + UI.esc(st.gan.phone) + '"></div>' +
      '</div></div>';

    html += '<div class="card">' +
      '<div class="card-title"><h2>שנת הלימודים</h2></div>' +
      '<div class="grid-2">' +
        '<div class="field"><label>תחילת שנה</label>' +
          '<input class="input" type="date" data-change="set-cfg" data-key="yearStart" value="' + UI.esc(st.settings.yearStart) + '"></div>' +
        '<div class="field"><label>סוף שנה</label>' +
          '<input class="input" type="date" data-change="set-cfg" data-key="yearEnd" value="' + UI.esc(st.settings.yearEnd) + '"></div>' +
      '</div>' +
      '<div class="hint mb0">התאריכים קובעים את חודשי הפעילות של סעיפים חודשיים. ' +
        'החלוקה בין ההורים נעשית סעיף-סעיף: כל סעיף מתחלק בין הילדים שכבר היו בגן ' +
        'בתאריך שלו, כך שילד שהצטרף באמצע אינו משלם על מה שקדם לו.</div>' +
      '</div>';

    html += '<div class="card">' +
      '<div class="card-title"><h2>הנתונים שלי</h2></div>' +
      '<p class="small muted">' +
      (Cloud.info().signedIn
        ? 'הנתונים נשמרים במכשיר וגם מסונכרנים לחשבון שלכם בענן. '
        : 'הנתונים נשמרים במכשיר הזה בלבד. ') +
      'בכל מקרה מומלץ לייצא גיבוי מדי פעם ולשמור את הקובץ.</p>' +
      '<div class="btn-row mt">' +
        '<button class="btn ghost" data-action="set-export">⬇️ ייצוא גיבוי</button>' +
        '<button class="btn ghost" data-action="set-import">⬆️ טעינת גיבוי</button>' +
      '</div>' +
      '<div class="stat-grid" style="margin-top:14px">' +
        '<div class="stat"><div class="s-val">' + st.children.length + '</div><div class="s-lab">ילדים</div></div>' +
        '<div class="stat"><div class="s-val">' + st.payments.length + '</div><div class="s-lab">תשלומים</div></div>' +
        '<div class="stat"><div class="s-val">' + st.expenses.length + '</div><div class="s-lab">הוצאות</div></div>' +
      '</div></div>';

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
      '</div>';

    html += '<p class="center small muted mt">ועד הורים גן שלנו · יחד למען הילדים ❤️<br>' +
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
      'set-gan': function (el) { Store.state.gan[el.getAttribute('data-key')] = el.value; Store.save(); UI.toast('נשמר ✓'); },
      'set-cfg': function (el) {
        var key = el.getAttribute('data-key');
        Store.state.settings[key] = key === 'roundShare' ? Calc.num(el.value) : el.value;
        Store.save();
        UI.toast('נשמר ✓');
      },
      'set-export': function () {
        var data = Store.exportJSON();
        var name = 'vaad-gan-' + UI.todayISO() + '.json';
        try {
          var blob = new Blob([data], { type: 'application/json' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = name;
          document.body.appendChild(a);
          a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
          UI.toast('הגיבוי הורד ✓');
        } catch (e) {
          UI.copyText(data);
          UI.toast('הנתונים הועתקו ללוח');
        }
      },
      'set-import': function () {
        UI.modal({
          title: 'טעינת גיבוי',
          subtitle: 'בחרו קובץ גיבוי או הדביקו את תוכנו',
          body: '<div class="field"><input class="input" type="file" accept="application/json,.json" id="imp-file"></div>' +
            '<div class="field"><label>או הדבקת JSON</label><textarea class="input" id="imp-text" style="min-height:120px"></textarea></div>' +
            '<button class="btn js-go">טעינה</button>' +
            '<p class="small muted mt">שימו לב: הטעינה תחליף את כל הנתונים הקיימים.</p>',
          onMount: function (root, close) {
            var file = root.querySelector('#imp-file');
            var text = root.querySelector('#imp-text');
            file.addEventListener('change', function () {
              var f = file.files && file.files[0];
              if (!f) return;
              var reader = new FileReader();
              reader.onload = function () { text.value = reader.result; };
              reader.readAsText(f);
            });
            root.querySelector('.js-go').addEventListener('click', function () {
              try {
                Store.importJSON(text.value);
                close();
                App.setView('home');
                UI.toast('הגיבוי נטען ✓');
              } catch (e) {
                UI.toast('הקובץ אינו תקין');
              }
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
