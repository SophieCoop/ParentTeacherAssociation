/* ============================================================
   פתיחת קובץ אקסל מוצפן — בדפדפן, עם הסיסמה של המשתמש
   ------------------------------------------------------------
   פייבוקס מייצאת קבצים מוצפנים: מיכל OLE ובתוכו החבילה המוצפנת
   (ECMA-376 Agile — AES-256-CBC, SHA-512, 100,000 סיבובים).
   SheetJS בגרסה החופשית מזהה את ההצפנה אך אינה מפענחת אותה —
   היא קוראת ל-decrypt_agile שקיימת רק בגרסת התשלום, ולכן זורקת
   "File is password-protected" גם כשמוסרים לה סיסמה.

   לכן הפענוח נעשה כאן, ב-xlsx-populate, ומה שיוצא ממנו הוא קובץ
   xlsx רגיל שעובר הלאה ל-SheetJS כאילו לא היה מוצפן מעולם.

   הספרייה כבדה (כ-640KB) ולכן היא נטענת אך ורק כשמזוהה קובץ
   מוצפן: מי שמעלה קובץ רגיל או CSV אינו משלם עליה דבר.

   הסיסמה: נשארת במשתנה מקומי לאורך הפענוח ונעלמת איתו. היא אינה
   נשמרת, אינה נכתבת ל-localStorage ואינה נשלחת לשום מקום —
   האתר כולו רץ בדפדפן, ואין שרת שיכול לראות אותה.
   ============================================================ */
var XlsxCrypt = (function () {

  var URL_POPULATE = 'https://cdn.jsdelivr.net/npm/xlsx-populate@1.21.0/browser/xlsx-populate.min.js';

  /* חתימת מיכל OLE/CFB. קובץ xlsx רגיל הוא zip ומתחיל ב-"PK"; קובץ
     מוצפן עטוף במיכל הזה, וזה מה שמבדיל ביניהם בלי לנסות לפתוח. */
  var CFB_MAGIC = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];

  function isEncrypted(bytes) {
    if (!bytes || bytes.length < 8) return false;
    for (var i = 0; i < CFB_MAGIC.length; i++) {
      if (bytes[i] !== CFB_MAGIC[i]) return false;
    }
    return true;
  }

  var loading = null;
  function loadPopulate() {
    if (window.XlsxPopulate) return Promise.resolve(window.XlsxPopulate);
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = URL_POPULATE;
      sc.onload = function () {
        window.XlsxPopulate ? resolve(window.XlsxPopulate)
                            : reject(new Error('טעינת מפענח הקבצים נכשלה'));
      };
      sc.onerror = function () { reject(new Error('טעינת מפענח הקבצים נכשלה — נדרש חיבור לאינטרנט')); };
      document.head.appendChild(sc);
    });
    loading.catch(function () { loading = null; });   // כישלון רשת לא ינעל ניסיון נוסף
    return loading;
  }

  /* סיסמה שגויה מפיקה מפתח שגוי, ומה שיוצא אינו zip תקין. השגיאה
     שחוזרת משם מדברת על "end of central directory" ואינה אומרת דבר
     למשתמש — לכן היא מתורגמת כאן לסיבה האמיתית. */
  function wrongPassword(msg) {
    return /central directory|corrupt|invalid|end of data|zip/i.test(String(msg || ''));
  }

  /* מחזיר Uint8Array של קובץ xlsx רגיל, מפוענח.

     שימו לב להבחנה שבשגיאות: סיסמה שגויה היא דבר אחד, וקובץ שפוענח
     אך המבנה שלו אינו נעכל הוא דבר אחר לגמרי. הראשון הוא טעות של
     המשתמש ויש לבקש שוב; השני אינו באשמתו, ולכן מקבל הסבר והצעה
     מעשית במקום "הסיסמה אינה נכונה" שרק יבלבל. */
  function decrypt(bytes, password) {
    return loadPopulate().then(function (XlsxPopulate) {
      return XlsxPopulate.fromDataAsync(bytes, { password: String(password || '') });
    }).then(function (wb) {
      return wb.outputAsync('uint8array');
    }).catch(function (e) {
      var msg = (e && e.message) || '';
      if (wrongPassword(msg)) {
        var bad = new Error('הסיסמה אינה נכונה');
        bad.wrongPassword = true;
        throw bad;
      }
      /* טעינת הספרייה נכשלה — ההודעה כבר מנוסחת למשתמש */
      if (/מפענח הקבצים/.test(msg)) throw e;
      throw new Error('הקובץ נפתח, אבל לא הצלחנו לקרוא את המבנה שלו. ' +
        'אפשר לפתוח אותו באקסל, לשמור כ-CSV, ולייבא את הקובץ הזה.');
    });
  }

  return { isEncrypted: isEncrypted, decrypt: decrypt, loadPopulate: loadPopulate };
})();
