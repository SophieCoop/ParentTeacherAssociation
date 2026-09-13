/* ============================================================
   רעיונות למתנות — סיעור מוחות
   כל ריבוע = רעיון להוצאה: קטגוריה, קהל יעד, שורות הוצאה וחלוקה לנפש
   ============================================================ */
var Views = (typeof Views === 'undefined') ? {} : Views;

Views.ideas = (function () {

  /* כמה נפשות יש בכל קהל יעד — מוצג בסוגריים כדי שהחישוב יהיה גלוי.
     "כיבוד" אינו נספר לפי נפש ולכן אינו מקבל מספר. */
  function audienceSize(id) {
    if (id === 'children') return (Store.state.children || []).length;
    if (id === 'staff')    return (Store.state.staff || []).length;
    return null;
  }

  /* צורת יחיד לקהלי היעד, לניסוח "לכל ילד" / "לכל איש צוות".
     "כיבוד" אינו נספר לפי נפש ולכן אינו מופיע כאן. */
  var ONE = { children: 'ילד', staff: 'איש צוות' };

  /* למי מיועדת המתנה — לפי מה שנבחר ברעיון */
  function perHeadLabel(idea) {
    var names = (idea.audiences || []).filter(function (id) { return ONE[id]; })
                                      .map(function (id) { return ONE[id]; });
    return names.length ? 'לכל ' + names.join('/') : 'לכל אחד';
  }

  /* שם הדרגה ביחיד או ברבים, לפי כמה אנשי צוות יש בה */
  function levelName(levelId, count) {
    if (levelId === 'all') return 'כל הצוות';
    var lv = Store.staffLevel(levelId);
    return (count === 1 || !lv.plural) ? lv.name : lv.plural;
  }

  /* הדרגות שיש בהן אנשי צוות בפועל, לפי סדר ההייררכיה */
  function staffMix() {
    var st = Store.state;
    return Store.STAFF_LEVELS.map(function (lv) {
      return { level: lv, count: Calc.staffAtLevel(st, lv.id) };
    }).filter(function (x) { return x.count > 0; });
  }

  function audienceLabel(id) {
    var au = Store.audience(id);
    var n = audienceSize(id);
    return au.name + (n === null ? '' : ' (' + n + ')');
  }


  /* ---------- כרטיס רעיון ---------- */
  function ideaCard(idea) {
    var st = Store.state;
    var cat = idea.categoryId ? Store.category(idea.categoryId) : null;
    var split = Calc.ideaSplit(st, idea);
    var vs = Calc.ideaVsBudget(st, idea);
    var accent = UI.toneHex(cat ? cat.tone : 'purple');

    var html = '<article class="idea' + (idea.chosen ? ' chosen' : '') + '" style="--accent:' + accent + '">';

    /* כותרת */
    html += '<div class="idea-head">' +
      '<span class="r-ico" style="background:' + UI.toneVar(cat ? cat.tone : 'purple') + '">' + (cat ? UI.catIcon(cat) : '💡') + '</span>' +
      '<h3>' + UI.esc(idea.title || 'רעיון חדש') +
        (idea.chosen ? ' <span class="badge ok">נבחר ✓</span>' : '') + '</h3>' +
      '<button class="iconbtn plain" data-action="idea-edit" data-id="' + idea.id + '" aria-label="עריכה">✏️</button>' +
      '</div>';

    /* קטגוריית תקציב וקהל יעד */
    html += '<div class="flex wrap" style="gap:6px;margin-bottom:10px">' +
      '<span class="badge info">🧮 ' +
        UI.esc(vs && vs.item ? itemName(vs.item) : (cat ? cat.name : 'ללא סעיף תקציב')) + '</span>' +
      (idea.audiences || []).map(function (a) {
        var au = Store.audience(a);
        return '<span class="badge" style="background:' + UI.toneVar(au.tone) + ';color:' + UI.toneInk(au.tone) + '">' +
          au.icon + ' ' + UI.esc(audienceLabel(a)) + '</span>';
      }).join('') +
      '</div>';

    /* שורות ההוצאה — תצוגה בלבד; העריכה נעשית בטופס הרעיון (✏️) */
    html += '<div class="lines">';
    if (!(idea.lines || []).length) {
      html += '<p class="muted small" style="margin:0 0 8px">עוד אין שורות הוצאה ברעיון הזה — אפשר להוסיף בעריכה ✏️</p>';
    } else {
      html += idea.lines.map(function (l) {
        return '<div class="idea-line">' +
          '<span class="il-name">' + UI.esc(l.label || 'סעיף') + '</span>' +
          '<span class="il-calc">' + Calc.lineQty(l, st) + ' \u00d7 ' + UI.money(l.amount) + '</span>' +
          '<b class="il-sum">' + UI.money(Calc.lineTotal(l, st)) + '</b>' +
          '</div>';
      }).join('');
    }
    html += '</div>';

    /* סה"כ */
    html += '<div class="flex-between" style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--line)">' +
      '<span class="small muted">סה״כ הרעיון</span>' +
      '<b style="font-size:19px">' + UI.money(split.total) + '</b></div>';

    /* כמה מתוך תקציב הסעיף הרעיון תופס */
    if (vs && vs.planned > 0) {
      var pct = Math.round((vs.total / vs.planned) * 100);
      var tone = pct > 100 ? 'over' : (pct > 90 ? 'warn' : 'ok');
      html += '<div class="of-budget">' +
        '<div class="flex-between">' +
          '<span class="small muted">מתוך תקציב ' + (vs.item ? 'הסעיף' : 'הקטגוריה') + '</span>' +
          '<b class="ob-val">' + UI.money(vs.total) + ' מתוך ' + UI.money(vs.planned) + '</b>' +
        '</div>' +
        '<div class="ob-bar">' +
          UI.bar(vs.total, vs.planned, 'thin ' + tone) +
          '<span class="ob-pct' + (pct > 100 ? ' neg' : '') + '">' + pct + '%</span>' +
        '</div>' +
        '</div>';
    }

    /* חלוקה לנפש */
    if (split.parts.length) {
      html += '<div class="split">' + split.parts.map(function (p) {
        var au = Store.audience(p.id);
        return '<div class="sp" style="background:' + UI.toneVar(au.tone) + ';color:' + UI.toneInk(au.tone) + '">' +
          '<div class="sp-ico">' + au.icon + '</div>' +
          '<div class="sp-val">' + UI.money(p.share) +
            (ONE[p.id] ? ' <span class="sp-per">לכל ' + ONE[p.id] + '</span>' : '') + '</div>' +
          '<div class="sp-lab">' + au.name + ' · ' + p.count + '</div></div>';
      }).join('') + '</div>';
      html += '<div class="small muted center" style="margin-top:8px">' +
        (split.heads > 0 ? split.heads + ' נפשות · ' + UI.money(split.perHead) + ' ' + perHeadLabel(idea)
                         : 'הוצאה כללית לגן') +
        ' · ' + UI.money(split.perParent) + ' לכל הורה</div>';
    }

    if (idea.note) {
      html += '<p class="small muted" style="margin:10px 0 0">📝 ' + UI.esc(idea.note) + '</p>';
    }

    /* פעולות */
    html += '<div class="btn-row mt">' +
      '<button class="btn wa sm" style="flex:1" data-action="idea-wa" data-id="' + idea.id + '">💬 שליחה להורים</button>' +
      (idea.chosen
        ? '<button class="btn ghost sm" style="flex:1" data-action="idea-unchoose" data-id="' + idea.id + '">ביטול בחירה</button>'
        : '<button class="btn sm" style="flex:1" data-action="idea-choose" data-id="' + idea.id + '">בחירת הרעיון</button>') +
      '</div>';

    html += '</article>';
    return html;
  }

  /* שם הסעיף כפי שהוא מוצג ברשימה: שם חופשי, ובהיעדרו שם הקטגוריה */
  function itemName(b) {
    var cat = Store.category(b.categoryId);
    return b.title || cat.name;
  }

  /* רשימת סעיפי התקציב לבחירה, מסודרת לפי סדר הקטגוריות ואז לפי תאריך */
  function budgetOptions() {
    var st = Store.state;
    var order = {};
    (st.categories || []).forEach(function (c, i) { order[c.id] = i; });

    var items = (st.budgetItems || []).slice().sort(function (a, b) {
      var d = (order[a.categoryId] === undefined ? 99 : order[a.categoryId]) -
              (order[b.categoryId] === undefined ? 99 : order[b.categoryId]);
      if (d) return d;
      if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
      return itemName(a).localeCompare(itemName(b), 'he');
    });

    return [{ value: '', label: '— ללא סעיף תקציב —' }].concat(items.map(function (b) {
      return { value: b.id,
               label: Store.category(b.categoryId).icon + '  ' + itemName(b) +
                      '  —  ' + UI.money(Calc.itemAmount(st, b)) };
    }));
  }

  /* כמה נותר בסעיף: המתוכנן פחות מה שכבר נרשם עליו בפועל */
  function itemLeft(itemId) {
    var st = Store.state;
    var b = Calc.budgetItem(st, itemId);
    if (!b) return null;
    var planned = Calc.itemAmount(st, b);
    var spent = Calc.expensesByBudgetItem(st)[b.id] || 0;
    return { planned: planned, spent: spent, left: Calc.round2(planned - spent) };
  }

  /* ---------- טופס רעיון ---------- */
  function ideaForm(idea) {
    var isNew = !idea;
    idea = idea || { title: '', budgetItemId: '', categoryId: '', audiences: ['children'],
                     note: '', lines: [], chosen: false };

    /* רעיון שנוצר לפני שהרעיונות הוצמדו לסעיף תקציב: אם בקטגוריה שלו יש
       בדיוק סעיף אחד, הוא נבחר מראש. אם יש כמה — לא מנחשים. */
    var startItem = idea.budgetItemId || '';
    if (!startItem && idea.categoryId) {
      var same = (Store.state.budgetItems || []).filter(function (b) {
        return b.categoryId === idea.categoryId;
      });
      if (same.length === 1) startItem = same[0].id;
    }

    /* שורות ההוצאה נערכות בתוך הטופס, כדי שאפשר יהיה להזין רעיון שלם בבת אחת */
    var lines = (idea.lines || []).map(function (l) {
      return { id: l.id || Store.uid('ln'), label: l.label,
               qty: (l.qty === undefined || l.qty === null || l.qty === '') ? 1 : l.qty,
               levelId: l.levelId || '', amount: l.amount };
    });

    /* קהל היעד שמסומן כרגע בטופס. כשהצוות מסומן, שורות ההוצאה
       מוצגות כטבלה שבה בוחרים למי מיועדת כל שורה, והכמות נגזרת מהרכב הצוות. */
    function pickedAudiences(root) {
      var el = root && root.querySelector('#f-audiences');
      if (!el) return idea.audiences || [];
      return el.value ? el.value.split(',') : [];
    }
    function staffMode(root) {
      return pickedAudiences(root).indexOf('staff') > -1;
    }

    /* דרגת הצוות נשמרת על השורה גם כשיוצאים מקהל היעד של צוות,
       כדי שחזרה אליו לא תאבד את הבחירה — אבל החישוב מתעלם ממנה בינתיים. */
    function lineSum(l, staff) {
      return Calc.lineTotal(staff ? l : { qty: l.qty, amount: l.amount }, Store.state);
    }

    function linesTotal(staff) {
      return lines.reduce(function (s, l) { return s + lineSum(l, staff); }, 0);
    }

    /* הסיכום יושב כולו בכרטיס התחתון, ולכן מספיק לצייר אותו מחדש */
    function refreshTotal(root) {
      drawTotalCard(root);
    }

    /* כרטיס הרכב הצוות — מנין נלקחות הכמויות בטבלה */
    function staffMixHTML() {
      var mix = staffMix();
      if (!mix.length) {
        return '<div class="note"><div class="n-ico">\ud83d\udc65</div><div>' +
          '<b>עוד לא נוספו אנשי צוות</b>' +
          'אפשר להוסיף אותם בלשונית "צוות הגן", ואז הכמויות יתמלאו כאן מעצמן.' +
          '</div></div>';
      }
      return '<div class="staff-mix">' +
        '<div class="sm-head">\ud83d\udc65 <b>הרכב צוות הגן</b></div>' +
        '<div class="sm-grid">' +
          mix.map(function (x) {
            return '<div class="sm-cell"><span class="sm-name">' +
              UI.esc(levelName(x.level.id, x.count)) + '</span>' +
              '<b class="sm-num">' + x.count + '</b></div>';
          }).join('') +
        '</div>' +
        '<p class="sm-hint">המספרים נלקחים מלשונית "צוות הגן" ומתעדכנים אוטומטית</p>' +
        '</div>';
    }

    /* אפשרויות "למי?" — כל הצוות, וכל דרגה שיש בה אנשי צוות */
    function levelOptions(l) {
      var st = Store.state;
      var opts = [];
      /* שורה שנוצרה לפני שהשורות הוצמדו לדרגות — מציגים את הכמות שלה
         כמו שהיא, ולא משנים אותה מאחורי הגב */
      if (!l.levelId) {
        opts.push({ id: '', label: 'כמות קבועה (' + Calc.lineQty({ qty: l.qty }) + ')' });
      }
      opts.push({ id: 'all', label: 'כל הצוות (' + (st.staff || []).length + ')' });
      staffMix().forEach(function (x) {
        opts.push({ id: x.level.id, label: levelName(x.level.id, x.count) + ' (' + x.count + ')' });
      });
      return opts.map(function (o) {
        return '<option value="' + o.id + '"' + (o.id === (l.levelId || '') ? ' selected' : '') + '>' +
          UI.esc(o.label) + '</option>';
      }).join('');
    }

    function linesTableHTML() {
      return '<div class="line-tbl"><table><thead><tr>' +
          '<th>מוצר / שירות</th><th>למי?</th>' +
          '<th class="end">מחיר לאדם</th><th class="end">סה״כ</th><th></th>' +
        '</tr></thead><tbody>' +
        lines.map(function (l, i) {
          return '<tr>' +
            '<td><input class="input" data-ln="label" data-i="' + i + '" ' +
              'placeholder="מוצר / שירות" value="' + UI.esc(l.label || '') + '"></td>' +
            '<td><select class="input" data-ln="levelId" data-i="' + i + '" aria-label="למי?">' +
              levelOptions(l) + '</select></td>' +
            '<td><input class="input end" data-ln="amount" data-i="' + i + '" type="number" ' +
              'inputmode="decimal" min="0" placeholder="0" aria-label="מחיר לאדם" ' +
              'value="' + UI.esc(l.amount === '' || l.amount === undefined ? '' : l.amount) + '"></td>' +
            '<td class="end"><b data-ln-sum="' + i + '">' + UI.money(lineSum(l, true)) + '</b></td>' +
            '<td><button type="button" class="iconbtn del" data-ln-del="' + i + '" ' +
              'aria-label="מחיקת שורה">✕</button></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';
    }

    function lineCardsHTML() {
      return lines.map(function (l, i) {
        return '<div class="line-card">' +
          '<div class="lc-top">' +
            '<input class="input" data-ln="label" data-i="' + i + '" placeholder="שם המתנה" ' +
              'value="' + UI.esc(l.label || '') + '">' +
            '<button type="button" class="iconbtn del" data-ln-del="' + i + '" ' +
              'aria-label="מחיקת שורה">✕</button>' +
          '</div>' +
          '<div class="lc-calc">' +
            '<div class="lc-field">' +
              '<span class="lc-lab">כמות</span>' +
              '<input class="input" data-ln="qty" data-i="' + i + '" type="number" inputmode="numeric" min="0" ' +
                'placeholder="1" value="' + UI.esc(l.qty === '' || l.qty === undefined ? '' : l.qty) + '" ' +
                'aria-label="כמות">' +
            '</div>' +
            '<span>×</span>' +
            '<input class="input" data-ln="amount" data-i="' + i + '" type="number" inputmode="decimal" min="0" ' +
              'placeholder="0" value="' + UI.esc(l.amount === '' || l.amount === undefined ? '' : l.amount) + '" ' +
              'aria-label="סכום ליחידה">' +
            '<span>₪ =</span>' +
            '<b data-ln-sum="' + i + '">' + UI.money(lineSum(l, false)) + '</b>' +
          '</div>' +
          '</div>';
      }).join('');
    }

    /* סיכום הרעיון — הסכום מול סעיף התקציב שנבחר */
    function totalCardHTML() {
      return '<div class="idea-total" id="idea-total"></div>';
    }

    function drawTotalCard(root) {
      var box = root.querySelector('#idea-total');
      if (!box) return;
      var total = linesTotal(staffMode(root));
      var sel = root.querySelector('#f-budgetItemId');
      var b = sel ? itemLeft(sel.value) : null;
      var planned = b && b.planned ? b.planned : 0;

      var main = '<div class="it-main">' +
        '<div class="it-lab">סה״כ הרעיון</div>' +
        '<div class="it-val">' + UI.money(total) + '</div>' +
        (planned ? '<div class="it-sub">מתוך ' + UI.money(planned) + '</div>' : '') +
        '</div>';

      if (!planned) {
        box.innerHTML = main +
          '<p class="it-hint">בחירת סעיף תקציב תציג כאן גם כמה ממנו הרעיון מנצל</p>';
        return;
      }
      var pct = Math.round((total / planned) * 100);
      var over = total > planned;
      box.innerHTML = main +
        UI.donut([
          { value: Math.min(total, planned), color: UI.toneHex(over ? 'pink' : 'purple') },
          { value: Math.max(0, planned - total), color: '#EFEAF3' }
        ], pct + '%', over ? 'חריגה מהתקציב' : 'מהתקציב בשימוש');
    }

    function drawLines(root) {
      var box = root.querySelector('#f-lines');
      if (!box) return;
      var staff = staffMode(root);

      box.innerHTML =
        (staff ? staffMixHTML() : '') +
        '<label>שורות ההוצאה</label>' +
        (lines.length ? (staff ? linesTableHTML() : lineCardsHTML())
                      : '<p class="small muted" style="margin:0 0 8px">עוד לא נוספו שורות הוצאה.</p>') +
        '<button type="button" class="btn soft sm" data-ln-add="1" style="width:100%">+ הוספת שורה</button>' +
        totalCardHTML();

      Array.prototype.forEach.call(box.querySelectorAll('[data-ln]'), function (inp) {
        var handler = function () {
          var i = parseInt(inp.getAttribute('data-i'), 10);
          if (!lines[i]) return;
          var key = inp.getAttribute('data-ln');
          lines[i][key] = (key === 'label' || key === 'levelId') ? inp.value
                        : (inp.value === '' ? '' : Calc.num(inp.value));
          var sum = box.querySelector('[data-ln-sum="' + i + '"]');
          if (sum) sum.textContent = UI.money(lineSum(lines[i], staff));
          refreshTotal(root);
        };
        inp.addEventListener('input', handler);
        inp.addEventListener('change', handler);
      });
      Array.prototype.forEach.call(box.querySelectorAll('[data-ln-del]'), function (btn) {
        btn.addEventListener('click', function () {
          lines.splice(parseInt(btn.getAttribute('data-ln-del'), 10), 1);
          drawLines(root);
          refreshTotal(root);
        });
      });
      var add = box.querySelector('[data-ln-add]');
      if (add) add.addEventListener('click', function () {
        lines.push({ id: Store.uid('ln'), label: '', qty: 1,
                     levelId: staff ? 'all' : '', amount: '' });
        drawLines(root);
        refreshTotal(root);
        var inputs = box.querySelectorAll('[data-ln="label"]');
        if (inputs.length) inputs[inputs.length - 1].focus();
      });

      drawTotalCard(root);
    }

    UI.formModal({
      title: isNew ? 'רעיון חדש' : 'עריכת רעיון',
      subtitle: 'סעיף התקציב, קהל יעד ופירוט ההוצאות',
      fields: [
        { name: 'title', label: 'שם הרעיון', value: idea.title, required: true,
          placeholder: 'למשל: מתנת סוף שנה — ספר וכוס' },
        { name: 'budgetItemId', label: 'סעיף התקציב', type: 'select', value: startItem,
          options: budgetOptions(),
          hint: (Store.state.budgetItems || []).length
                  ? 'הרעיון מוצמד לסעיף שתוכנן בתקציב, והחישוב נעשה מולו'
                  : 'עוד לא הוגדרו סעיפי תקציב — אפשר להוסיף בלשונית "תקציב"' },
        { name: 'audiences', label: 'קהל יעד', type: 'chips', multi: true, value: idea.audiences,
          options: Store.AUDIENCES.map(function (a) {
            return { value: a.id, label: audienceLabel(a.id), icon: a.icon };
          }),
          hint: 'המספר בסוגריים הוא הכמות שלפיה מחושבת החלוקה לנפש' },
        { name: 'lines', type: 'html', html: '' },
        { name: 'note', label: 'הערות', type: 'textarea', value: idea.note,
          placeholder: 'קישורים, ספקים, רעיונות…' }
      ],

      onMount: function (root) {
        drawLines(root);
        refreshTotal(root);
      },

      onFieldChange: function (name, value, root) {
        /* מעבר לקהל יעד של צוות מחליף את שורות ההוצאה בטבלה לפי דרגות,
           ויציאה ממנו מחזירה לכמות חופשית */
        if (name === 'audiences') {
          /* יציאה מקהל יעד של צוות מקבעת את הכמות שהדרגה הניבה, כך שתיבת
             הכמות נפתחת על המספר הנכון. הדרגה עצמה נשמרת למקרה שחוזרים. */
          if (!staffMode(root)) {
            lines.forEach(function (l) {
              if (l.levelId) l.qty = Calc.lineQty(l, Store.state);
            });
          }
          drawLines(root);
          return;
        }
        refreshTotal(root);
      },

      onSubmit: function (v) {
        // שורה ריקה לגמרי אינה נשמרת
        var clean = lines.filter(function (l) {
          return (l.label && l.label.trim()) || Calc.num(l.amount) > 0;
        });
        var forStaff = (v.audiences || []).indexOf('staff') > -1;
        clean = clean.map(function (l) {
          return { id: l.id, label: l.label,
                   qty: (l.qty === '' || l.qty === undefined) ? 1 : Calc.num(l.qty),
                   levelId: forStaff ? (l.levelId || '') : '',
                   amount: l.amount };
        });
        var bi = Calc.budgetItem(Store.state, v.budgetItemId);
        var data = {
          title: v.title,
          budgetItemId: v.budgetItemId || '',
          categoryId: bi ? bi.categoryId : '',
          audiences: v.audiences,
          note: v.note, lines: clean
        };
        if (isNew) {
          data.chosen = false;
          Store.add('ideas', data);
        } else {
          Store.update('ideas', idea.id, data);
        }
        App.render();
        UI.toast(isNew ? 'הרעיון נוסף 💡' : 'עודכן ✓');
      },
      onDelete: isNew ? null : function () {
        Store.remove('ideas', idea.id);
        App.render();
        UI.toast('הרעיון נמחק');
      }
    });
  }

  /* פירוט שורות הרעיון כטקסט — משמש גם לשיתוף וגם להערות ההוצאה.
     prefix מאפשר תבליט בהערות, ובלעדיו הטקסט נקי לוואטסאפ. */
  function linesText(idea, prefix) {
    var st = Store.state;
    return (idea.lines || []).map(function (l) {
      var q = Calc.lineQty(l, st);
      var who = l.levelId ? ' (' + levelName(l.levelId, q) + ')' : '';
      return (prefix || '') + (l.label || 'סעיף') + who + ' - ' +
        (q !== 1 ? q + ' × ' + UI.money(l.amount) + ' = ' + UI.money(Calc.lineTotal(l, st))
                 : UI.money(Calc.lineTotal(l, st)));
    }).join('\n');
  }

  /* ---------- טקסט לשיתוף בוואטסאפ ---------- */
  function shareText(idea) {
    var st = Store.state;
    var cat = idea.categoryId ? Store.category(idea.categoryId) : null;
    var bi = Calc.budgetItem(st, idea.budgetItemId);
    var split = Calc.ideaSplit(st, idea);
    var lines = linesText(idea);

    var aud = (idea.audiences || []).map(function (a) { return Store.audience(a).name; }).join(', ');

    return (st.gan.name || 'ועד ההורים') + ' - התייעצות\n\n' +
      'רעיון: ' + (idea.title || 'רעיון') + '\n' +
      (bi ? 'סעיף בתקציב: ' + itemName(bi) + '\n' : (cat ? 'קטגוריה: ' + cat.name + '\n' : '')) +
      (aud ? 'עבור: ' + aud + '\n' : '') +
      '\nפירוט ההוצאות:\n' + (lines || 'אין עדיין שורות') +
      '\n\nסה״כ: ' + UI.money(split.total) +
      (split.heads > 0
        ? '\n' + UI.money(split.perHead) + ' ' + perHeadLabel(idea) + ', ' + split.heads + ' נפשות'
        : '') +
      '\n' + UI.money(split.perParent) + ' לכל הורה' +
      (idea.note ? '\n\nהערות: ' + idea.note : '') +
      '\n\nמה דעתכם?';
  }

  /* הערות ההוצאה שנוצרת מרעיון: מאיפה היא הגיעה, ופירוט השורות
     שהיו ברעיון — כדי שהפירוט יישאר גם אם הרעיון ישתנה או יימחק */
  function expenseNote(idea, total) {
    var detail = linesText(idea, '• ');
    return 'נוצר מרעיון בסיעור מוחות' +
      (detail ? '\n\n' + detail + '\nסה״כ: ' + UI.money(total) : '') +
      (idea.note ? '\n\nהערות: ' + idea.note : '');
  }

  /* ---------- המסך ---------- */
  function render() {
    var st = Store.state;
    var ideas = st.ideas || [];
    var html = UI.pageHead({
      title: 'רעיונות למתנות',
      subtitle: 'סיעור מוחות — משווים אפשרויות ובוחרים',
      art: 'ideas', tone: 'purple', back: 'home'
    });

    html += '<div class="flex-between" style="margin-bottom:14px">' +
      '<span class="small muted">' + ideas.length + ' רעיונות' +
      (ideas.filter(function (i) { return i.chosen; }).length ? ' · ' + ideas.filter(function (i) { return i.chosen; }).length + ' נבחרו' : '') + '</span>' +
      '<button class="btn sm" data-action="idea-add">+ הוספת רעיון</button></div>';

    if (!ideas.length) {
      return html + UI.empty({
        art: 'ideas', title: 'בואו נעשה סיעור מוחות',
        text: 'כל רעיון הוא ריבוע נפרד: בוחרים קטגוריה וקהל יעד, מוסיפים שורות הוצאה — והמערכת מחשבת כמה זה יוצא לכל ילד ולכל הורה.',
        action: { act: 'idea-add', label: '+ הרעיון הראשון' }
      });
    }

    html += '<div class="cols">' + ideas.map(ideaCard).join('') + '</div>';

    /* השוואה בין הרעיונות */
    if (ideas.length > 1) {
      html += '<div class="section-title"><span>השוואה מהירה</span></div>';
      html += '<div class="card"><div class="scroll-x"><table class="tbl">' +
        '<thead><tr><th>רעיון</th><th class="end">סה״כ</th><th class="end">לנפש</th><th class="end">להורה</th></tr></thead><tbody>' +
        ideas.slice().sort(function (a, b) { return Calc.ideaTotal(a, st) - Calc.ideaTotal(b, st); }).map(function (i) {
          var s = Calc.ideaSplit(st, i);
          return '<tr' + (i.chosen ? ' style="background:var(--green)"' : '') + '>' +
            '<td>' + (i.chosen ? '✓ ' : '') + UI.esc(i.title || 'רעיון') + '</td>' +
            '<td class="end">' + UI.money(s.total) + '</td>' +
            '<td class="end">' + UI.money(s.perHead) + '</td>' +
            '<td class="end">' + UI.money(s.perParent) + '</td></tr>';
        }).join('') +
        '</tbody></table></div></div>';
    }

    html += '<button class="btn" data-action="idea-add">+ הוספת רעיון</button>';
    return html;
  }

  return {
    render: render,
    // נחשפים כדי שייצוא התמונה יציג בדיוק את אותם שמות
    itemName: itemName,
    audienceLabel: audienceLabel,
    perHeadLabel: perHeadLabel,
    perOneLabel: function (id) { return ONE[id] ? 'לכל ' + ONE[id] : ''; },
    actions: {
      'idea-add': function () { ideaForm(null); },
      'idea-edit': function (el) { ideaForm(Store.find('ideas', el.getAttribute('data-id'))); },

      'idea-choose': function (el) {
        var idea = Store.find('ideas', el.getAttribute('data-id'));
        if (!idea) return;
        var total = Calc.ideaTotal(idea, Store.state);
        if (total <= 0) { UI.toast('צריך להוסיף שורות הוצאה לפני הבחירה'); return; }
        var vs = Calc.ideaVsBudget(Store.state, idea);
        UI.modal({
          title: 'בחירת הרעיון',
          subtitle: idea.title,
          body: '<p class="small">הרעיון ייכנס ללשונית ההוצאות בפועל, והעלות (' + UI.money(total) + ') תרד מהתקציב' +
                (vs ? ' של ' + (vs.item ? 'הסעיף' : 'הקטגוריה') + ' "' +
                      UI.esc(vs.item ? itemName(vs.item) : Store.category(idea.categoryId).name) + '"' : '') + '.</p>' +
                (vs && !vs.fits ? '<div class="note" style="background:#FDF0F2"><div class="n-ico">⚠️</div><div>' +
                  '<b>שימו לב</b>הסכום חורג מהתקציב שנותר ב' + (vs.item ? 'סעיף' : 'קטגוריה') +
                  ' ב-' + UI.money(Math.abs(vs.diff)) + '.</div></div>' : '') +
                '<div class="btn-row mt"><button class="btn ghost js-cancel">ביטול</button>' +
                '<button class="btn js-ok">אישור והוספה להוצאות</button></div>',
          onMount: function (root, close) {
            root.querySelector('.js-cancel').addEventListener('click', close);
            root.querySelector('.js-ok').addEventListener('click', function () {
              Store.state.expenses = Store.state.expenses.filter(function (e) { return e.ideaId !== idea.id; });
              Store.add('expenses', {
                categoryId: idea.categoryId,
                budgetItemId: idea.budgetItemId || '',
                title: idea.title || 'רעיון שנבחר',
                amount: total,
                date: UI.todayISO(),
                note: expenseNote(idea, total),
                ideaId: idea.id
              });
              Store.update('ideas', idea.id, { chosen: true });
              close();
              App.setView('expenses');
              UI.toast('הרעיון נבחר ונוסף להוצאות ✓');
            });
          }
        });
      },

      'idea-unchoose': function (el) {
        var id = el.getAttribute('data-id');
        Store.state.expenses = Store.state.expenses.filter(function (e) { return e.ideaId !== id; });
        Store.update('ideas', id, { chosen: false });
        App.render();
        UI.toast('הבחירה בוטלה וההוצאה הוסרה');
      },

      'idea-wa': function (el) {
        var idea = Store.find('ideas', el.getAttribute('data-id'));
        if (!idea) return;
        var text = shareText(idea);

        var m = UI.modal({
          title: 'שליחה להתייעצות',
          subtitle: 'שיתוף הרעיון עם ההורים',
          body: '<div id="wa-img" class="wa-img"><p class="small muted center">מכינים תמונה…</p></div>' +
            '<div class="btn-row mt">' +
              '<button class="btn ghost js-text">📝 כטקסט</button>' +
              '<button class="btn wa js-share" disabled>💬 שיתוף התמונה</button>' +
            '</div>' +
            '<p class="small muted center" style="margin:10px 0 0" id="wa-hint">&nbsp;</p>',
          onMount: function (root, close) {

            /* ----- התמונה ----- */
            IdeaImage.render(idea, function (canvas, err) {
              var box = root.querySelector('#wa-img');
              if (!box) return;
              if (err || !canvas) {
                box.innerHTML = '<p class="small muted center">לא הצלחנו להכין תמונה — אפשר לשלוח כטקסט.</p>';
                return;
              }
              box.innerHTML = '<img alt="הרעיון כתמונה" src="' + canvas.toDataURL('image/png') + '">';

              var share = root.querySelector('.js-share');
              var hint = root.querySelector('#wa-hint');
              var name = (idea.title || 'רעיון').replace(/[\\/:*?"<>|]/g, '') + '.png';

              canvas.toBlob(function (blob) {
                if (!blob) return;
                var file = null;
                try { file = new File([blob], name, { type: 'image/png' }); } catch (e) { file = null; }
                var canShare = !!(file && navigator.share && navigator.canShare &&
                                  navigator.canShare({ files: [file] }));

                share.disabled = false;
                if (canShare) {
                  hint.textContent = 'נפתחת בחירת האפליקציה — בוחרים וואטסאפ ואת הקבוצה';
                  share.addEventListener('click', function () {
                    navigator.share({ files: [file], title: idea.title || 'רעיון' })
                      .catch(function () { /* המשתמשת ביטלה */ });
                  });
                } else {
                  share.textContent = '⬇️ שמירת התמונה';
                  hint.textContent = 'שומרים את התמונה ומצרפים אותה בוואטסאפ';
                  share.addEventListener('click', function () {
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url; a.download = name;
                    document.body.appendChild(a); a.click(); a.remove();
                    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
                    UI.toast('התמונה נשמרה');
                  });
                }
              }, 'image/png');
            });

            /* ----- גיבוי: שליחה כטקסט ----- */
            root.querySelector('.js-text').addEventListener('click', function () {
              m.setBody(
                '<pre class="card flat small" style="white-space:pre-wrap;font-family:inherit;margin-bottom:14px">' +
                  UI.esc(text) + '</pre>' +
                '<div class="btn-row"><button class="btn ghost js-copy">📋 העתקה</button>' +
                '<button class="btn wa js-wa">💬 פתיחת וואטסאפ</button></div>');
              var b = m.el;
              b.querySelector('.js-copy').addEventListener('click', function () { UI.copyText(text); });
              b.querySelector('.js-wa').addEventListener('click', function () { UI.whatsapp(text); close(); });
            });
          }
        });
      }
    }
  };
})();
