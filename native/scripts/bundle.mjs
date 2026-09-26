#!/usr/bin/env node
/* ============================================================
   חבילת העדכון החי — הקבצים שהאפליקציה מורידה מהאתר
   ------------------------------------------------------------
   רץ ב-Vercel בכל פריסה (buildCommand ב-vercel.json), ומוסיף לאתר
   את app-bundle/: קובץ zip של אותם קבצים בדיוק שנארזים באפליקציה
   (native/web-files.json), ולצידו bundle.json שמתאר אותו. האפליקציה
   קוראת את bundle.json, ואם הגרסה שונה משלה — מורידה את ה-zip ועוברת
   אליו בפעם הבאה שהיא יוצאת לרקע (js/native.js).

   בלי תלויות ובלי תוכנת zip: הסביבה של Vercel אינה מבטיחה אחת, והאתר
   אינו מתקין חבילות. לכן ה-zip נכתב כאן ביד — בכוונה בצורה הפשוטה
   ביותר: גדלים בכותרת של כל קובץ (ZipInputStream של אנדרואיד קורא את
   הקובץ ברצף, ולא יודע לחזור לסוף כדי למצוא אותם), שעה קבועה, וסדר
   קבוע — כך שאותם קבצים נותנים תמיד בדיוק אותו zip.

     node native/scripts/bundle.mjs [תיקיית פלט]   ברירת מחדל: app-bundle/ בשורש
   ============================================================ */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as zlib from 'node:zlib';
import { MANIFEST, ROOT, contentVersion, listShipped, minBuild } from './web-bundle.mjs';

/* zlib.crc32 קיים מ-Node 20.15 / 22.2. הגרסה של Vercel נקבעת בהגדרות
   הפרויקט, ולכן יש גם חישוב ידני — שלא תיכשל פריסה בגלל גרסת Node. */
let table = null;
export function crc32js(buf) {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export const crc32 = typeof zlib.crc32 === 'function' ? (buf) => zlib.crc32(buf) >>> 0 : crc32js;

// 1 בינואר 1980, חצות — התאריך הראשון שפורמט ה-zip יודע לכתוב
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

/* entries: [{ name, data }] ← Buffer של קובץ zip שלם */
export function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    // תמונות כבר דחוסות; שם עדיף לשמור אותן כמו שהן
    const stored = deflated.length >= data.length;
    const body = stored ? data : deflated;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);            // הגרסה שנדרשת לפתיחה: 2.0
    local.writeUInt16LE(0, 6);             // בלי דגלים — ובלי data descriptor
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(stored ? 0 : 8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);     // כל שאר השדות אפס
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

/* בונה את החבילה אל out ומחזיר את התיאור שנכתב ל-bundle.json.
   בתוך ה-zip יש גם bundle.json משלו — כמו זה ש-copy-web.mjs כותב
   לאפליקציה — כדי שחבילה תדע לזהות את עצמה. */
export function makeBundle({ root = ROOT, out = join(root, 'app-bundle'), now = new Date() } = {}) {
  const files = listShipped(root);
  const version = contentVersion(files, root);
  const min = minBuild(root);
  const entries = files.map((name) => ({ name, data: readFileSync(join(root, name)) }));
  entries.push({ name: MANIFEST, data: Buffer.from(JSON.stringify({ version, minBuild: min }, null, 2) + '\n') });

  const buf = zip(entries);
  const file = `vaad-${version}.zip`;
  const checksum = createHash('sha256').update(buf).digest('hex');
  const manifest = { version, file, checksum, minBuild: min, builtAt: now.toISOString() };

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, file), buf);
  writeFileSync(join(out, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
  return { ...manifest, bytes: buf.length, files: entries.length };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const out = process.argv[2] ? resolve(process.argv[2]) : undefined;
  const m = makeBundle({ out });
  console.log(`app-bundle: ${m.file} — ${m.files} קבצים, ${Math.round(m.bytes / 1024)}KB, minBuild ${m.minBuild}`);
}
