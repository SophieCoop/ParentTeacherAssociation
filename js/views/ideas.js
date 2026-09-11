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
      '<span class="r-ico" style="background:' + UI.toneVar(cat ? cat.tone : 'purple') + '">' + (cat ? cat.icon : '💡') + '</span>' +
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
          '<span class="il-calc">' + Calc.lineQty(l) + ' \u00d7 ' + UI.money(l.amount) + '</span>' +
          '<b class="il-sum">' + UI.money(Calc.lineTotal(l)) + '</b>' +
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
          '<div class="sp-val">' + UI.money(p.share) + '</div>' +
          '<div class="sp-lab">' + au.name + ' · ' + p.count + '</div></div>';
      }).join('') + '</div>';
      html += '<div class="small muted center" style="margin-top:8px">' +
        (split.heads > 0 ? split.heads + ' נפשות · ' + UI.money(split.perHead) + ' לכל אחד' : 'הוצאה כללית לגן') +
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
               amount: l.amount };
    });

    function linesTotal() {
      return lines.reduce(function (s, l) { return s + Calc.lineTotal(l); }, 0);
    }

    function refreshTotal(root) {
      var total = linesTotal();
      var el = root.querySelector('#lines-total');
      if (el) el.textContent = UI.money(total);

      var sel = root.querySelector('#f-budgetItemId');
      var rem = root.querySelector('#budget-left');
      if (!sel || !rem) return;

      var b = itemLeft(sel.value);
      if (!b || !b.planned) {
        rem.parentNode.style.display = 'none';
        return;
      }
      rem.parentNode.style.display = '';
      var after = Calc.round2(b.left - total);
      rem.textContent = after >= 0 ? UI.money(after) : 'חריגה של ' + UI.money(-after);
      rem.className = after >= 0 ? 'pos' : 'neg';
      var lbl = root.querySelector('#budget-left-label');
      if (lbl) lbl.textContent = after >= 0 ? 'נותר בסעיף התקציב' : 'מעבר לסעיף התקציב';
    }

    function drawLines(root) {
      var box = root.querySelector('#f-lines');
      if (!box) return;

      box.innerHTML =
        '<label>שורות ההוצאה</label>' +
        (lines.length ? lines.map(function (l, i) {
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
              '<b data-ln-sum="' + i + '">' + UI.money(Calc.lineTotal(l)) + '</b>' +
            '</div>' +
            '</div>';
        }).join('') : '<p class="small muted" style="margin:0 0 8px">עוד לא נוספו שורות הוצאה.</p>') +
        '<button type="button" class="btn soft sm" data-ln-add="1" style="width:100%">+ הוספת שורה</button>' +
        '<div class="flex-between" style="margin-top:10px">' +
          '<span class="small muted">סה״כ הרעיון</span>' +
          '<b id="lines-total" style="font-size:16px">' + UI.money(linesTotal()) + '</b>' +
        '</div>' +
        '<div class="flex-between" style="margin-top:4px">' +
          '<span class="small muted" id="budget-left-label">נותר מתקציב הקטגוריה</span>' +
          '<b id="budget-left" class="pos">—</b>' +
        '</div>';

      Array.prototype.forEach.call(box.querySelectorAll('[data-ln]'), function (inp) {
        var handler = function () {
          var i = parseInt(inp.getAttribute('data-i'), 10);
          if (!lines[i]) return;
          var key = inp.getAttribute('data-ln');
          lines[i][key] = (key === 'label') ? inp.value
                        : (inp.value === '' ? '' : Calc.num(inp.value));
          var sum = box.querySelector('[data-ln-sum="' + i + '"]');
          if (sum) sum.textContent = UI.money(Calc.lineTotal(lines[i]));
          refreshTotal(root);
        };
        inp.addEventListener('input', handler);
        inp.addEventListener('change', handler);
      });
      Array.prototype.forEach.call(box.querySelectorAll('[data-ln-del]'), function (btn) {
        btn.addEventListener('click', function () {
          lines.splice(parseInt(btn.getAttribute('data-ln-del'), 10), 1);
          drawLines(root);
        });
      });
      var add = box.querySelector('[data-ln-add]');
      if (add) add.addEventListener('click', function () {
        lines.push({ id: Store.uid('ln'), label: '', qty: 1, amount: '' });
        drawLines(root);
        var inputs = box.querySelectorAll('[data-ln="label"]');
        if (inputs.length) inputs[inputs.length - 1].focus();
      });
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
        if (name === 'budgetItemId') refreshTotal(root);
      },

      onSubmit: function (v) {
        // שורה ריקה לגמרי אינה נשמרת
        var clean = lines.filter(function (l) {
          return (l.label && l.label.trim()) || Calc.num(l.amount) > 0;
        }).map(function (l) {
          return { id: l.id, label: l.label,
                   qty: (l.qty === '' || l.qty === undefined) ? 1 : Calc.num(l.qty),
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

  /* ---------- טקסט לשיתוף בוואטסאפ ---------- */
  function shareText(idea) {
    var st = Store.state;
    var cat = idea.categoryId ? Store.category(idea.categoryId) : null;
    var bi = Calc.budgetItem(st, idea.budgetItemId);
    var split = Calc.ideaSplit(st, idea);
    var lines = (idea.lines || []).map(function (l) {
      var q = Calc.lineQty(l);
      return '• ' + (l.label || 'סעיף') + ' — ' +
        (q !== 1 ? q + ' × ' + UI.money(l.amount) + ' = ' + UI.money(Calc.lineTotal(l))
                 : UI.money(Calc.lineTotal(l)));
    }).join('\n');

    var aud = (idea.audiences || []).map(function (a) { return Store.audience(a).name; }).join(' + ');

    return '🌸 *' + (st.gan.name || 'ועד ההורים') + ' — התייעצות* 🌸\n\n' +
      '💡 *' + (idea.title || 'רעיון') + '*\n' +
      (bi ? '📂 סעיף בתקציב: ' + itemName(bi) + '\n' : (cat ? '📂 קטגוריה: ' + cat.name + '\n' : '')) +
      (aud ? '🎯 עבור: ' + aud + '\n' : '') +
      '\n*פירוט ההוצאות:*\n' + (lines || '—') +
      '\n\n💰 *סה״כ: ' + UI.money(split.total) + '*' +
      (split.heads > 0 ? '\n👥 ' + split.heads + ' נפשות — ' + UI.money(split.perHead) + ' לכל אחד' : '') +
      '\n🏠 ' + UI.money(split.perParent) + ' לכל הורה' +
      (idea.note ? '\n\n📝 ' + idea.note : '') +
      '\n\nמה דעתכם? 😊';
  }

  /* ---------- המסך ---------- */
  function render() {
    var st = Store.state;
    var ideas = st.ideas || [];
    var html = UI.pageHead({
      title: 'רעיונות למתנות',
      subtitle: 'סיעור מוחות — משווים אפשרויות ובוחרים',
      icon: '💡', tone: 'purple', back: 'home'
    });

    html += '<div class="flex-between" style="margin-bottom:14px">' +
      '<span class="small muted">' + ideas.length + ' רעיונות' +
      (ideas.filter(function (i) { return i.chosen; }).length ? ' · ' + ideas.filter(function (i) { return i.chosen; }).length + ' נבחרו' : '') + '</span>' +
      '<button class="btn sm" data-action="idea-add">+ הוספת רעיון</button></div>';

    if (!ideas.length) {
      return html + UI.empty({
        icon: '💡', title: 'בואו נעשה סיעור מוחות',
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
        ideas.slice().sort(function (a, b) { return Calc.ideaTotal(a) - Calc.ideaTotal(b); }).map(function (i) {
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
    actions: {
      'idea-add': function () { ideaForm(null); },
      'idea-edit': function (el) { ideaForm(Store.find('ideas', el.getAttribute('data-id'))); },

      'idea-choose': function (el) {
        var idea = Store.find('ideas', el.getAttribute('data-id'));
        if (!idea) return;
        var total = Calc.ideaTotal(idea);
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
                note: 'נוצר מרעיון בסיעור מוחות',
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
        UI.modal({
          title: 'שליחה להתייעצות',
          subtitle: 'שיתוף רשימת ההוצאות עם ההורים',
          body: '<pre class="card flat small" style="white-space:pre-wrap;font-family:inherit;margin-bottom:14px">' + UI.esc(text) + '</pre>' +
            '<div class="btn-row"><button class="btn ghost js-copy">📋 העתקה</button>' +
            '<button class="btn wa js-wa">💬 פתיחת וואטסאפ</button></div>',
          onMount: function (root, close) {
            root.querySelector('.js-copy').addEventListener('click', function () { UI.copyText(text); });
            root.querySelector('.js-wa').addEventListener('click', function () { UI.whatsapp(text); close(); });
          }
        });
      }
    }
  };
})();
