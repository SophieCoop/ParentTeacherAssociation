/* ============================================================
   הצעד הבא — כרטיס במסך הבית שאומר מה לעשות עכשיו
   ------------------------------------------------------------
   רוב מי שסיים את ההקמה לא חזר: מסך הבית הראה ₪0 ו-0%, ולא אמר
   מה עושים איתו. הכרטיס עונה על השאלה הזאת בכל רגע, לפי הסדר שבו
   הוועד באמת עובד — ילדים, תקציב, גבייה, הוצאות. רק הצעד הראשון
   שעוד לא נעשה מוצג, כי רשימה של חמש משימות היא עוד מסך שצריך
   להבין; משימה אחת היא כפתור שלוחצים עליו.

   כשהכול נעשה הכרטיס נעלם. אין צורך לסמן "בוצע": כל צעד נבדק מול
   הנתונים עצמם, ולכן הוא חוזר אם מישהו מחק את מה שהשלים אותו.
   ============================================================ */
var NextStep = (function () {

  function steps(state) {
    var kids = Calc.childCount(state);
    var col = Calc.collectionSummary(state);
    var perChild = kids ? Math.round(col.due / kids) : 0;
    var open = col.noneCount + col.partialCount;

    return [
      { id: 'children', view: 'children', button: 'להוספת הילדים',
        done: kids > 0,
        title: 'הוסיפו את הילדים בגן',
        text: 'לפי מספר הילדים נחשב כמה כל הורה משלם.' },
      { id: 'budget', view: 'budget', button: 'לתכנון התקציב',
        done: (state.budgetItems || []).length > 0,
        title: 'תכננו את התקציב',
        text: 'מתנות לחגים, ימי הולדת וסוף שנה — ומהם נגזר הסכום לכל הורה.' },
      /* "תשלומי ההורים" ולא "התשלום הראשון": רושמים כמה בבת אחת, ומי
         שגובה בפייבוקס מייבא את כולם מהקובץ — ייבוא שמוצע רק כשהוא דלוק */
      { id: 'payment', view: 'collection', button: 'לרישום תשלומים',
        done: (state.payments || []).length > 0,
        title: 'רשמו את תשלומי ההורים',
        text: (perChild ? 'כל הורה משלם בערך ' + UI.money(perChild) + '. ' : '') +
              'אפשר לרשום כמה תשלומים בבת אחת' +
              (typeof Features !== 'undefined' && Features.payboxImport
                ? ', או לייבא קובץ אקסל מפייבוקס.' : '.') },
      { id: 'collect', view: 'collection', button: 'למצב הגבייה',
        done: col.done || col.due <= 0,
        title: open > 0
          ? open + (open === 1 ? ' משפחה עוד לא שילמה' : ' משפחות עוד לא שילמו') + ' במלואן'
          : 'הגבייה עוד לא הושלמה',
        text: 'נותרו ' + UI.money(col.remaining) + ' לגבייה. אפשר לשלוח תזכורת מתוך מסך הגבייה.' },
      { id: 'expense', view: 'expenses', button: 'לרישום הוצאה',
        done: (state.expenses || []).length > 0,
        title: 'רשמו את ההוצאה הראשונה',
        text: 'כל קנייה נרשמת מול הסעיף שלה בתקציב, וכך רואים כמה נשאר בקופה.' }
    ];
  }

  /* הצעד הראשון שעוד לא נעשה, עם מיקומו ברשימה; null כשהכול נעשה */
  function current(state) {
    var list = steps(state);
    for (var i = 0; i < list.length; i++) {
      if (!list[i].done) return Object.assign({}, list[i], { n: i + 1, of: list.length });
    }
    return null;
  }

  function cardHTML(state) {
    var s = current(state);
    if (!s) return '';
    return '<div class="card next-step">' +
      '<div class="ns-label">הצעד הבא · ' + s.n + ' מתוך ' + s.of + '</div>' +
      '<div class="ns-title">' + UI.esc(s.title) + '</div>' +
      '<p class="ns-text">' + UI.esc(s.text) + '</p>' +
      '<button class="btn" data-action="nav" data-view="' + s.view + '">' + UI.esc(s.button) + '</button>' +
      '</div>';
  }

  return { steps: steps, current: current, cardHTML: cardHTML };
})();
