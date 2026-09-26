#!/usr/bin/env node
/* ============================================================
   מעתיק את קבצי האתר אל native/www — התיקייה ש-Capacitor אורז
   ------------------------------------------------------------
   האתר נשאר איפה שהוא: הטסטים טוענים את js/ לפי נתיב מהשורש,
   ו-Vercel מגיש את השורש כמו שהוא. לכן לא מכוונים את webDir לשורש
   עצמו (הוא היה אורז גם את native/ ואת node_modules), אלא מעתיקים
   רק את מה שברשימה.

   לצד הקבצים נכתב bundle.json עם הגרסה, כדי שהאפליקציה תדע איזו
   גרסה ארוזה בה כשהיא משווה מול מה שהאתר מציע.
   ============================================================ */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MANIFEST, NATIVE, ROOT, contentVersion, listShipped, minBuild } from './web-bundle.mjs';

const www = join(NATIVE, 'www');
const files = listShipped();
const version = contentVersion(files);

rmSync(www, { recursive: true, force: true });
for (const file of files) {
  mkdirSync(dirname(join(www, file)), { recursive: true });
  cpSync(join(ROOT, file), join(www, file));
}
writeFileSync(join(www, MANIFEST), JSON.stringify({ version, minBuild: minBuild() }, null, 2) + '\n');

console.log('www: ' + files.length + ' קבצים, גרסה ' + version);
