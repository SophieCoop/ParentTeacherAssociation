# שליחת מיילים מהדומיין של האתר

מדריך צעד־אחר־צעד להעברת מיילי ההרשמה משרת ברירת המחדל של Supabase
לשירות משלנו, כך שהם יגיעו מ-`noreply@vaadhorim.com`.

**כל השלבים כאן חינמיים.** SMTP חיצוני זמין גם בתוכנית החינמית של
Supabase, ו-Resend נותן 3,000 מיילים בחודש (100 ביום) ללא תשלום.

## למה זה לא רק עניין של עיצוב

התיעוד של Supabase מגדיר את שרת המייל המובנה כלא מיועד לייצור, ומטיל
עליו שתי מגבלות:

> Unless you configure a custom SMTP server for your project, Supabase Auth
> will refuse to deliver messages to addresses that are not part of the
> project's team… All other addresses will fail with *Email address not authorized*.

ובנוסף מגבלת קצב שעשויה להשתנות בלי הודעה מראש. כלומר בלי SMTP משלנו,
היכולת של הורים חדשים להירשם תלויה בהחלטה של Supabase.

---

## שלב 1 — חשבון ב-Resend

1. להירשם ב-<https://resend.com> (אפשר עם חשבון Google).
2. בתפריט: **Domains › Add Domain**, ולהזין `vaadhorim.com`.
3. לבחור אזור — עדיף אירופה, קרוב יותר לישראל.

Resend יציג מסך עם רשומות DNS. **הערכים המדויקים משתנים לפי החשבון
והאזור, ולכן תמיד להעתיק מהמסך שלו** — לא מכאן. זה המבנה שיופיע:

| סוג | שם (Host) | ערך | הערה |
|---|---|---|---|
| `MX` | `send` | `feedback-smtp.<region>.amazonses.com` | עדיפות 10. מטפל בהחזרות |
| `TXT` | `send` | `v=spf1 include:amazonses.com ~all` | SPF — מי מורשה לשלוח בשם הדומיין |
| `TXT` | `resend._domainkey` | מחרוזת ארוכה שמתחילה ב-`p=` | DKIM — החתימה שמוכיחה שהמייל אותנטי |

מומלץ להוסיף גם, בעצמך:

| סוג | שם | ערך |
|---|---|---|
| `TXT` | `_dmarc` | `v=DMARC1; p=none; rua=mailto:sophie@cooperman.co.il` |

DMARC במצב `p=none` לא חוסם דבר — הוא רק מבקש מהשרתים לדווח. זו
הדרך לראות אם משהו בהגדרה לא תקין לפני שזה פוגע במסירה.

## שלב 2 — הוספת הרשומות ב-Namecheap

שרתי השמות של `vaadhorim.com` הם `dns1/dns2.registrar-servers.com`,
כלומר ה-DNS מנוהל ב-Namecheap עצמו:
**Domain List › Manage › Advanced DNS**.

### מה שכבר קיים שם, ואסור לשבור

בדומיין כבר מוגדרת העברת מיילים של Namecheap:

| סוג | Host | ערך | עדיפות |
|---|---|---|---|
| `MX` | `@` | `eforward1.registrar-servers.com` | 10 |
| `MX` | `@` | `eforward2.registrar-servers.com` | 10 |
| `MX` | `@` | `eforward3.registrar-servers.com` | 10 |
| `MX` | `@` | `eforward4.registrar-servers.com` | 15 |
| `MX` | `@` | `eforward5.registrar-servers.com` | 20 |
| `TXT` | `@` | `v=spf1 include:spf.efwd.registrar-servers.com ~all` | |

הרשומות של Resend יושבות על תת־הדומיין `send`, ולכן הן **אינן מתנגשות**
עם אלה — כל עוד לא מוחקים אותן.

**אסור שיהיו שתי רשומות SPF על אותו שם.** על השורש כבר יש אחת. אם אי־פעם
צריך SPF נוסף על `@` — ממזגים אותו לתוך הקיימת ולא מוסיפים שנייה; שתי
רשומות SPF על אותו שם מבטלות את SPF לחלוטין.

### המלכודת: Mail Settings

בעמוד Advanced DNS יש אזור **Mail Settings** נפרד, המוגדר כרגע
**Email Forwarding**. במצב זה Namecheap מנהל את רשומות ה-MX בעצמו ולרוב
לא יאפשר להוסיף MX ידנית — גם לא ל-`send`.

הפתרון: להחליף ל-**Custom MX**, ואז להזין מחדש ידנית את חמש רשומות
ה-`eforward` מהטבלה למעלה (כדי לא לאבד את העברת המיילים), ולצידן את
רשומת ה-MX של Resend על `send`.

### שדה ה-Host

Namecheap משלים את הדומיין לבד, ולכן מזינים **שם קצר**: `send`,
`resend._domainkey`, `_dmarc`. הזנת `send.vaadhorim.com` תיצור
`send.vaadhorim.com.vaadhorim.com`.

רשומת ה-DKIM ארוכה וקל לקטוע אותה בהעתקה — להעתיק הכול, בלי רווחים
בקצוות.

אחר כך חוזרים ל-Resend ולוחצים **Verify**. האימות לוקח דקות ספורות,
לפעמים עד שעה.

## שלב 3 — מפתח API

ב-Resend: **API Keys › Create API Key**, הרשאה **Sending access**.

המפתח (`re_…`) מוצג **פעם אחת בלבד**. להעתיק ולשמור אותו במקום בטוח.
הוא סוד — לא נכנס לריפו ולא נשלח בצ׳אט.

## שלב 4 — חיבור ב-Supabase

**Authentication › Emails › SMTP Settings**, להדליק **Enable Custom SMTP**:

| שדה | ערך |
|---|---|
| Sender email | `noreply@vaadhorim.com` |
| Sender name | `ועד הורים גן שלנו` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | מפתח ה-API מהשלב הקודם |

אם פורט 465 לא עובד, לנסות `587`. את הערכים המדויקים Resend מציג תחת
**SMTP** בלוח שלו.

## שלב 5 — מכסת השליחה

מיד אחרי ההפעלה Supabase מגביל ל-30 הרשמות בשעה כדי להגן על המוניטין
של הדומיין החדש. זה מספיק לגן אחד, ואם יום ההרשמה מרוכז — אפשר להעלות
ב-**Authentication › Rate Limits**.

## שלב 6 — התבנית המעוצבת

עכשיו כדאי לבדוק שוב את **Authentication › Emails › Templates ›
Confirm signup**. אם העורך פתוח:

- **Subject**: `אישור פתיחת החשבון — ועד הורים גן שלנו`
- **Message body**: התוכן של `confirm-signup.html` מהתיקייה הזו.

## שלב 7 — בדיקה

להירשם עם כתובת חדשה (לא כתובת שכבר רשומה), ולוודא:

1. המייל הגיע, והשולח הוא `ועד הורים גן שלנו <noreply@vaadhorim.com>`.
2. לא נחת בספאם. אם כן — בדרך כלל DKIM או SPF לא אומתו במלואם.
3. לחיצה על הקישור מגיעה לאתר ומציגה את מסך האישור.

הקישור חד־פעמי: לחיצה שנייה עליו תיכשל תמיד. לבדיקה חוזרת — מייל חדש.

---

## הערה על כיבוי אישור המייל

אפשרות שעולה לפעמים היא לכבות את אישור המייל (`Confirm email`) ולוותר
על כל התהליך. התיעוד של Supabase מציין את זה כמטרה של תוקפים דווקא:
בלי אישור, אפשר לפתוח חשבון בשמו של אדם אחר ואז להטעות אותו לעבוד
בחשבון שגם לתוקף יש אליו גישה.

לגן בודד זה סיכון קטן, אבל הוא אמיתי, ולכן עדיף לפתור את המייל כמו שצריך
ולא לעקוף אותו.
