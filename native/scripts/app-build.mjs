#!/usr/bin/env node
/* ============================================================
   מספר הבנייה הנייטיבי — אותו מספר בשלושת המקומות שחייבים להסכים
   ------------------------------------------------------------
   native/app-build.json (ממנו קוראים הסקריפטים), versionCode ב-
   android/app/build.gradle, ו-CURRENT_PROJECT_VERSION בפרויקט של
   Xcode (פעם לכל תצורה). חנות דוחה מספר שכבר ראתה, וחבילת עדכון
   חי מציינת את המספר הנמוך ביותר שהיא רצה עליו — ולכן המספר רק עולה.

     node scripts/app-build.mjs set <n>   כותב n בכל המקומות (n גדול מהנוכחי)
     node scripts/app-build.mjs check     יוצא בשגיאה אם הם לא מסכימים
   ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FILES = {
  json: 'app-build.json',
  gradle: 'android/app/build.gradle',
  pbxproj: 'ios/App/App.xcodeproj/project.pbxproj',
};

const GRADLE = /^(\s*versionCode )(\d+)$/m;
const PBXPROJ = /(CURRENT_PROJECT_VERSION = )(\d+)(;)/g;

export function readBuilds(root) {
  const json = JSON.parse(readFileSync(join(root, FILES.json), 'utf8'));
  const gradle = readFileSync(join(root, FILES.gradle), 'utf8').match(GRADLE);
  const pbx = [...readFileSync(join(root, FILES.pbxproj), 'utf8').matchAll(PBXPROJ)].map((m) => Number(m[2]));
  if (!gradle || pbx.length === 0) throw new Error('מספר הבנייה לא נמצא בפרויקטים הנייטיביים');
  return { json: Number(json.build), gradle: Number(gradle[2]), pbxproj: pbx };
}

export function check(root) {
  const builds = readBuilds(root);
  const all = [builds.json, builds.gradle, ...builds.pbxproj];
  return { agreed: all.every((v) => v === all[0]), build: builds.json, builds };
}

export function setBuild(root, next) {
  if (!Number.isInteger(next) || next <= 0) throw new Error('מספר בנייה הוא מספר שלם חיובי');
  const { build } = check(root);
  if (next <= build) throw new Error(`מספר הבנייה רק עולה: הנוכחי ${build}, התבקש ${next}`);

  const jsonPath = join(root, FILES.json);
  const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
  json.build = next;
  writeFileSync(jsonPath, JSON.stringify(json, null, 2) + '\n');

  const gradlePath = join(root, FILES.gradle);
  writeFileSync(gradlePath, readFileSync(gradlePath, 'utf8').replace(GRADLE, `$1${next}`));

  const pbxPath = join(root, FILES.pbxproj);
  writeFileSync(pbxPath, readFileSync(pbxPath, 'utf8').replace(PBXPROJ, `$1${next}$3`));
  return next;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const [command, value] = process.argv.slice(2);
  if (command === 'check') {
    const result = check(root);
    if (!result.agreed) {
      console.error('מספרי הבנייה לא מסכימים: ' + JSON.stringify(result.builds));
      process.exit(1);
    }
    console.log(`build ${result.build}`);
  } else if (command === 'set') {
    console.log(`build ${setBuild(root, Number(value))}`);
  } else {
    console.error('usage: app-build.mjs set <n> | check');
    process.exit(2);
  }
}
