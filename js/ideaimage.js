/* ============================================================
   ייצוא רעיון כתמונה — לשליחה בוואטסאפ
   הכרטיס מצויר על קנבס, בדיוק כמו שהוא נראה באתר, כדי שהתמונה
   תהיה קריאה גם מחוץ לאפליקציה (טקסט בלבד יוצא מבולגן).
   ============================================================ */
var IdeaImage = (function () {

  var W     = 760;   // רוחב לוגי של התמונה
  var S     = 2;     // הכפלת רזולוציה, כדי שהתמונה תהיה חדה
  var PAD   = 26;    // שוליים סביב הכרטיס
  var CPAD  = 26;    // ריפוד פנימי בכרטיס
  var ACC   = 8;     // עובי פס הצבע בראש הכרטיס
  var FONT  = "'Heebo','Segoe UI',Arial,sans-serif";

  var INK = '#4B4560', MUTED = '#9A93AC', LINE = '#EFEAF3',
      SOFT = '#FAF8FD', BG = '#FBF8F3', DANGER = '#D9707E';

  function font(size, weight) { return (weight || 400) + ' ' + size + 'px ' + FONT; }

  function roundPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }
  function roundFill(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color; roundPath(ctx, x, y, w, h, r); ctx.fill();
  }

  /* חיתוך טקסט ארוך לשורות ברוחב נתון */
  function wrap(ctx, text, maxW) {
    var words = String(text || '').split(/\s+/), out = [], cur = '';
    words.forEach(function (w) {
      var test = cur ? cur + ' ' + w : w;
      if (cur && ctx.measureText(test).width > maxW) { out.push(cur); cur = w; }
      else cur = test;
    });
    if (cur) out.push(cur);
    return out;
  }

  /* קיצור טקסט לשורה אחת עם שלוש נקודות */
  function clip(ctx, text, maxW) {
    var t = String(text || '');
    if (ctx.measureText(t).width <= maxW) return t;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  /* ---------- הציור עצמו ---------- */
  function paint(idea) {
    var st    = Store.state;
    var cat   = idea.categoryId ? Store.category(idea.categoryId) : null;
    var split = Calc.ideaSplit(st, idea);
    var vs    = Calc.ideaVsBudget(st, idea);
    var tone  = cat ? cat.tone : 'purple';

    // מצייר על קנבס גבוה, ובסוף חותכים לגובה שהתמלא בפועל
    var a = document.createElement('canvas');
    a.width = W * S; a.height = 3000 * S;
    var ctx = a.getContext('2d');
    ctx.scale(S, S);
    if ('direction' in ctx) ctx.direction = 'rtl';

    var right = W - PAD - CPAD;          // קצה ימני של התוכן
    var left  = PAD + CPAD;              // קצה שמאלי של התוכן
    var cw    = right - left;            // רוחב התוכן
    var y     = PAD + ACC + CPAD;

    /* ----- כותרת ----- */
    var R = 27;
    ctx.beginPath();
    ctx.arc(right - R, y + R, R, 0, Math.PI * 2);
    ctx.fillStyle = UI.toneSoftHex(tone); ctx.fill();
    ctx.font = font(26); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    ctx.fillText(cat ? cat.icon : '💡', right - R, y + R + 2);

    ctx.font = font(27, 800); ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillStyle = INK;
    var titleW = cw - 2 * R - 16;
    var titleLines = wrap(ctx, idea.title || 'רעיון', titleW);
    titleLines.slice(0, 2).forEach(function (ln, i) {
      ctx.fillText(ln, right - 2 * R - 16, y + 4 + i * 34);
    });
    y += Math.max(2 * R, titleLines.slice(0, 2).length * 34) + 16;

    /* ----- תגיות: סעיף התקציב וקהלי היעד ----- */
    var badges = [{ text: '🧮 ' + (vs && vs.item ? Views.ideas.itemName(vs.item)
                                                 : (cat ? cat.name : 'ללא סעיף תקציב')),
                    bg: '#EDE9FB', fg: '#8574D6' }];
    (idea.audiences || []).forEach(function (id) {
      var au = Store.audience(id);
      badges.push({ text: au.icon + ' ' + Views.ideas.audienceLabel(id),
                    bg: UI.toneSoftHex(au.tone), fg: UI.toneInkHex(au.tone) });
    });

    ctx.font = font(15, 700); ctx.textBaseline = 'middle';
    var bx = right, bh = 32;
    badges.forEach(function (b) {
      var tw = ctx.measureText(b.text).width, bw = tw + 26;
      if (bx - bw < left) { bx = right; y += bh + 8; }
      roundFill(ctx, bx - bw, y, bw, bh, bh / 2, b.bg);
      ctx.fillStyle = b.fg; ctx.textAlign = 'center';
      ctx.fillText(b.text, bx - bw / 2, y + bh / 2 + 1);
      bx -= bw + 8;
    });
    y += bh + 16;

    /* ----- שורות ההוצאה ----- */
    var lines = idea.lines || [];
    if (!lines.length) {
      ctx.font = font(15); ctx.fillStyle = MUTED; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText('עוד אין שורות הוצאה ברעיון הזה', right, y);
      y += 26;
    }
    lines.forEach(function (l) {
      var h = 52;
      roundFill(ctx, left, y, cw, h, 14, SOFT);
      var mid = y + h / 2 + 1;
      ctx.textBaseline = 'middle';

      ctx.font = font(18, 800); ctx.textAlign = 'left'; ctx.fillStyle = INK;
      ctx.fillText(UI.money(Calc.lineTotal(l)), left + 14, mid);

      ctx.font = font(14); ctx.textAlign = 'left'; ctx.fillStyle = MUTED;
      ctx.fillText(Calc.lineQty(l) + ' × ' + UI.money(l.amount), left + 124, mid);

      ctx.font = font(17, 700); ctx.textAlign = 'right'; ctx.fillStyle = INK;
      ctx.fillText(clip(ctx, l.label || 'סעיף', cw - 260), right - 14, mid);

      y += h + 8;
    });

    /* ----- קו מפריד וסה"כ ----- */
    y += 6;
    ctx.strokeStyle = LINE; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    ctx.setLineDash([]);
    y += 18;

    ctx.textBaseline = 'middle';
    ctx.font = font(15); ctx.fillStyle = MUTED; ctx.textAlign = 'right';
    ctx.fillText('סה״כ הרעיון', right, y + 14);
    ctx.font = font(30, 800); ctx.fillStyle = INK; ctx.textAlign = 'left';
    ctx.fillText(UI.money(split.total), left, y + 14);
    y += 38;

    /* ----- כמה מתוך תקציב הסעיף ----- */
    if (vs && vs.planned > 0) {
      var pct = Math.round((vs.total / vs.planned) * 100);
      ctx.font = font(14); ctx.fillStyle = MUTED; ctx.textAlign = 'right';
      ctx.fillText('מתוך תקציב ' + (vs.item ? 'הסעיף' : 'הקטגוריה'), right, y + 10);
      ctx.font = font(16, 700); ctx.fillStyle = INK; ctx.textAlign = 'left';
      ctx.fillText(UI.money(vs.total) + ' מתוך ' + UI.money(vs.planned), left, y + 10);
      y += 26;

      var pctW = 52, barX = left + pctW, barW = cw - pctW, barH = 9;
      roundFill(ctx, barX, y, barW, barH, barH / 2, '#F1EDF6');
      var fillW = Math.max(6, Math.min(1, vs.total / vs.planned) * barW);
      roundFill(ctx, barX + barW - fillW, y, fillW, barH, barH / 2,
                pct > 100 ? '#DC8291' : (pct > 90 ? '#E0B45C' : '#6FB98A'));
      ctx.font = font(13, 700); ctx.textAlign = 'left';
      ctx.fillStyle = pct > 100 ? DANGER : MUTED;
      ctx.fillText(pct + '%', left, y + barH / 2 + 1);
      y += barH + 16;
    }

    /* ----- חלוקה לנפש ----- */
    if (split.parts.length) {
      var n = split.parts.length, gap = 10;
      var bw2 = (cw - gap * (n - 1)) / n;

      /* "לכל ילד" נכתב לצד הסכום. בתיבה צרה מדי הוא יורד לשורה
         משלו, ואז כל התיבות מקבלות את הגובה הגדול יותר. */
      var per = split.parts.map(function (p) {
        var lbl = Views.ideas.perOneLabel(p.id);
        if (!lbl) return { label: '', two: false, w1: 0, w2: 0 };
        ctx.font = font(19, 800); var w1 = ctx.measureText(UI.money(p.share)).width;
        ctx.font = font(12, 700); var w2 = ctx.measureText(' ' + lbl).width;
        return { label: lbl, two: (w1 + w2) > bw2 - 16, w1: w1, w2: w2 };
      });
      var twoLine = per.some(function (x) { return x.two; });
      var bh2 = twoLine ? 100 : 86;

      split.parts.forEach(function (p, i) {
        var au = Store.audience(p.id);
        var x = right - bw2 - i * (bw2 + gap);
        var cx = x + bw2 / 2;
        roundFill(ctx, x, y, bw2, bh2, 16, UI.toneSoftHex(au.tone));
        ctx.fillStyle = UI.toneInkHex(au.tone);
        ctx.textAlign = 'center';
        ctx.font = font(20); ctx.fillText(au.icon, cx, y + 24);

        var e = per[i];
        if (e.label && !twoLine) {
          // סכום וכיתוב על שורה אחת: הסכום מימין, הכיתוב משמאלו
          var tot = e.w1 + e.w2, rightEdge = cx + tot / 2;
          ctx.textAlign = 'right';
          ctx.font = font(19, 800); ctx.fillText(UI.money(p.share), rightEdge, y + 52);
          ctx.font = font(12, 700); ctx.fillText(' ' + e.label, rightEdge - e.w1, y + 52);
          ctx.textAlign = 'center';
          ctx.font = font(12); ctx.fillText(au.name + ' · ' + p.count, cx, y + 72);
        } else if (e.label) {
          ctx.font = font(19, 800); ctx.fillText(UI.money(p.share), cx, y + 50);
          ctx.font = font(12, 700); ctx.fillText(e.label, cx, y + 70);
          ctx.font = font(12);      ctx.fillText(au.name + ' · ' + p.count, cx, y + 88);
        } else {
          ctx.font = font(19, 800); ctx.fillText(UI.money(p.share), cx, y + 52);
          ctx.font = font(12);      ctx.fillText(au.name + ' · ' + p.count, cx, y + 72);
        }
      });
      y += bh2 + 12;

      ctx.font = font(14); ctx.fillStyle = MUTED; ctx.textAlign = 'center';
      ctx.fillText((split.heads > 0
                      ? split.heads + ' נפשות · ' + UI.money(split.perHead) + ' ' +
                        Views.ideas.perHeadLabel(idea)
                      : 'הוצאה כללית לגן') +
                   ' · ' + UI.money(split.perParent) + ' לכל הורה', W / 2, y + 8);
      y += 26;
    }

    /* ----- הערות ----- */
    if (idea.note) {
      y += 4;
      ctx.font = font(14); ctx.fillStyle = MUTED; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      wrap(ctx, '📝 ' + idea.note, cw).slice(0, 3).forEach(function (ln, i) {
        ctx.fillText(ln, right, y + i * 21);
      });
      y += Math.min(3, wrap(ctx, '📝 ' + idea.note, cw).length) * 21 + 4;
    }

    var contentBottom = y;
    var cardH  = contentBottom + CPAD - PAD;
    var totalH = PAD + cardH + PAD + 30;   // 30 — שורת החתימה למטה

    /* ----- הרכבה: רקע, כרטיס, ואז התוכן שצויר ----- */
    var b = document.createElement('canvas');
    b.width = W * S; b.height = Math.round(totalH * S);
    var c = b.getContext('2d');
    c.scale(S, S);
    if ('direction' in c) c.direction = 'rtl';

    c.fillStyle = BG; c.fillRect(0, 0, W, totalH);

    roundPath(c, PAD, PAD, W - 2 * PAD, cardH, 22);
    c.fillStyle = '#FFFFFF'; c.fill();
    c.save(); c.clip();
    c.fillStyle = UI.toneHex(tone); c.fillRect(PAD, PAD, W - 2 * PAD, ACC);
    c.restore();

    c.drawImage(a, 0, 0, W * S, Math.round(totalH * S), 0, 0, W, totalH);

    c.font = font(13); c.fillStyle = MUTED; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('💡 ' + (st.gan.name || 'ועד ההורים') + ' · רעיון להתייעצות',
               W / 2, PAD + cardH + 18);

    return b;
  }

  /* הגופן נטען מהרשת — בלעדיו הקנבס יצייר בגופן ברירת מחדל */
  function ready(cb) {
    if (!document.fonts || !document.fonts.load) { cb(); return; }
    Promise.all([
      document.fonts.load('400 15px Heebo'),
      document.fonts.load('700 17px Heebo'),
      document.fonts.load('800 30px Heebo')
    ]).then(function () { cb(); }, function () { cb(); });
  }

  function render(idea, cb) {
    ready(function () {
      var canvas;
      try { canvas = paint(idea); }
      catch (e) { cb(null, e); return; }
      cb(canvas, null);
    });
  }

  return { render: render };
})();
