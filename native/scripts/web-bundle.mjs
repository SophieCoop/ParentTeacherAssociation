/* ============================================================
   אילו קבצים של האתר נארזים באפליקציה, ואיזו גרסה הם
   ------------------------------------------------------------
   הרשימה עצמה יושבת ב-native/web-files.json, כדי שגם הטסטים
   (שהם CommonJS) יוכלו לקרוא אותה בלי לייבא מודול ES.

   הגרסה היא גיבוב של הנתיבים והתוכן, ולא מספר רץ: אותם קבצים
   מקבלים תמיד אותה גרסה. כך אפליקציה שנבנתה מהקומיט שפורס יודעת
   שכבר יש לה בדיוק את מה שהאתר מציע, ולא מורידה אותו שוב.
   ============================================================ */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const NATIVE = fileURLToPath(new URL('..', import.meta.url));
export const ROOT = join(NATIVE, '..');
export const MANIFEST = 'bundle.json';

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/* כל הקבצים שנארזים, כנתיבים יחסיים לשורש האתר, ממוינים — כדי
   שהגיבוב לא יהיה תלוי בסדר שבו מערכת הקבצים מחזירה אותם.
   קבצים מוסתרים (‎.DS_Store וכדומה) אינם חלק מהאתר. */
export function listShipped(root = ROOT) {
  const entries = readJson(join(root, 'native', 'web-files.json'));
  const out = [];
  const walk = (rel) => {
    const full = join(root, rel);
    const st = statSync(full, { throwIfNoEntry: false });
    if (!st) throw new Error('חסר באתר: ' + rel);
    if (st.isDirectory()) {
      for (const name of readdirSync(full)) {
        if (name.startsWith('.')) continue;
        walk(rel.replace(/\/$/, '') + '/' + name);
      }
    } else {
      out.push(rel);
    }
  };
  entries.forEach(walk);
  return [...new Set(out)].sort();
}

/* שתים־עשרה ספרות הקס על פני כל נתיב ותוכנו */
export function contentVersion(files, root = ROOT) {
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    hash.update('\0');
    hash.update(readFileSync(join(root, file)));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

export function minBuild(root = ROOT) {
  return readJson(join(root, 'native', 'app-build.json')).bundleMinBuild;
}
