/* ============================================================
   הגדרות — פרטי הגן, גיבוי נתונים ואיפוס
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.settings = (function () {

  function render() {
    var st = Store.state;
    var html = UI.pageHead({ title: 'הגדרות', subtitle: 'פרטי הגן וגיבוי נתונים', icon: '⚙️', tone: 'mint', back: 'home' });

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
      '<div class="card-title"><h2>שנת הלימודים והחישוב היחסי</h2></div>' +
      '<div class="grid-2">' +
        '<div class="field"><label>תחילת שנה</label>' +
          '<input class="input" type="date" data-change="set-cfg" data-key="yearStart" value="' + UI.esc(st.settings.yearStart) + '"></div>' +
        '<div class="field"><label>סוף שנה</label>' +
          '<input class="input" type="date" data-change="set-cfg" data-key="yearEnd" value="' + UI.esc(st.settings.yearEnd) + '"></div>' +
      '</div>' +
      '<div class="field mb0"><label>עיגול אחוז ההשתתפות</label>' +
        '<select class="input" data-change="set-cfg" data-key="roundShare">' +
          [['0', 'ללא עיגול'], ['5', 'לכפולות של 5%'], ['10', 'לכפולות של 10%'], ['25', 'לרבעונים (25%)']]
            .map(function (o) {
              return '<option value="' + o[0] + '"' + (String(st.settings.roundShare) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
            }).join('') +
        '</select>' +
        '<div class="hint">משפיע על החישוב האוטומטי לילדים שמצטרפים באמצע שנה.</div></div>' +
      '</div>';

    html += '<div class="card">' +
      '<div class="card-title"><h2>הנתונים שלי</h2></div>' +
      '<p class="small muted">כל הנתונים נשמרים במכשיר שלכם בלבד (localStorage) ולא נשלחים לשום שרת. ' +
      'מומלץ לייצא גיבוי מדי פעם ולשמור את הקובץ.</p>' +
      '<div class="btn-row mt">' +
        '<button class="btn ghost" data-action="set-export">⬇️ ייצוא גיבוי</button>' +
        '<button class="btn ghost" data-action="set-import">⬆️ טעינת גיבוי</button>' +
      '</div>' +
      '<div class="stat-grid" style="margin-top:14px">' +
        '<div class="stat"><div class="s-val">' + st.children.length + '</div><div class="s-lab">ילדים</div></div>' +
        '<div class="stat"><div class="s-val">' + st.payments.length + '</div><div class="s-lab">תשלומים</div></div>' +
        '<div class="stat"><div class="s-val">' + st.expenses.length + '</div><div class="s-lab">הוצאות</div></div>' +
      '</div></div>';

    html += '<div class="card">' +
      '<div class="card-title"><h2>אזור מסוכן</h2></div>' +
      '<button class="btn danger" data-action="set-demo" style="margin-bottom:9px">🌸 טעינת נתוני דוגמה</button>' +
      '<button class="btn danger" data-action="set-reset">🗑 מחיקת כל הנתונים</button>' +
      '</div>';

    html += '<p class="center small muted mt">ועד הורים גן שלנו · יחד למען הילדים ❤️</p>';
    return html;
  }

  return {
    render: render,
    actions: {
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
        UI.confirmBox('טעינת נתוני דוגמה?', 'הנתונים הקיימים יוחלפו בנתוני דוגמה.', function () {
          Store.loadDemo();
          App.setView('home');
          UI.toast('נטענו נתוני דוגמה 🌸');
        });
      },
      'set-reset': function () {
        UI.confirmBox('מחיקת כל הנתונים?', 'כל הילדים, התשלומים וההוצאות יימחקו לצמיתות. פעולה זו אינה הפיכה.', function () {
          Store.reset();
          App.setVs('wizStep', 0);
          App.setView('home');
          UI.toast('הכל נמחק');
        });
      }
    }
  };
})();
