#!/usr/bin/env node
/* ============================================================
   Google Play דרך ה-Android Publisher API
   ------------------------------------------------------------
   אותו חשבון שירות שמעלה את פטק (~/petek-android/petek-publisher.json,
   ו-PLAY_KEY משנה את הנתיב). צריך להזמין אותו פעם אחת לאפליקציה הזו
   ב-Play Console ← משתמשים והרשאות, אחרת כל קריאה נענית ב-403.

     node scripts/play-upload.mjs status
     node scripts/play-upload.mjs release <aab> <track> <notes.txt> [lang] [--draft]
     node scripts/play-upload.mjs screenshots <dir> [lang]

   release מעלה את החבילה והופך אותה לגרסה של המסלול, עם ההערות.
   ‎--draft משאיר אותה כטיוטה — הכרחי כל עוד האפליקציה עצמה עדיין
   טיוטה ב-Play Console (לפני שהגרסה הראשונה פורסמה ידנית): שם ה-API
   מסרב לכל גרסה שאינה טיוטה. lang ברירת מחדל iw-IL (עברית של Play).
   ============================================================ */
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { GoogleAuth } from 'google-auth-library';

// שם החבילה מגיע מהגדרות Capacitor, כדי שלא יהיה מקום שני שבו הוא כתוב
const PACKAGE = createRequire(import.meta.url)('../capacitor.config.js').appId;
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;

const auth = new GoogleAuth({
  keyFile: process.env.PLAY_KEY ?? join(homedir(), 'petek-android', 'petek-publisher.json'),
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const client = await auth.getClient();

async function call(method, url, { data, body, type } = {}) {
  try {
    const res = await client.request({
      method,
      url,
      data: body ?? data,
      headers: type ? { 'Content-Type': type } : undefined,
    });
    return res.data;
  } catch (error) {
    const message = error.response?.data?.error?.message ?? error.message;
    throw new Error(`${method} ${url.replace(API, '').replace(UPLOAD, '')} -> ${error.response?.status ?? '?'} ${message}`);
  }
}

async function withEdit(work, commit) {
  const { id } = await call('POST', `${API}/edits`, { data: {} });
  try {
    await work(id);
    if (commit) {
      await call('POST', `${API}/edits/${id}:commit`);
      console.log('committed');
    }
  } finally {
    if (!commit) await call('DELETE', `${API}/edits/${id}`).catch(() => {});
  }
}

const argv = process.argv.slice(2);
const draft = argv.includes('--draft');
const [command, ...args] = argv.filter((a) => a !== '--draft');

if (command === 'status') {
  await withEdit(async (edit) => {
    const { tracks = [] } = await call('GET', `${API}/edits/${edit}/tracks`);
    for (const track of tracks) {
      for (const release of track.releases ?? []) {
        console.log(`${track.track}: ${release.status} ${release.name ?? ''} codes=${(release.versionCodes ?? []).join(',')}`);
      }
    }
    const { listings = [] } = await call('GET', `${API}/edits/${edit}/listings`);
    for (const listing of listings) {
      const { images = [] } = await call('GET', `${API}/edits/${edit}/listings/${listing.language}/phoneScreenshots`);
      console.log(`listing ${listing.language}: "${listing.title}", ${images.length} phone screenshots`);
    }
  }, false);
} else if (command === 'release') {
  const [aab, track, notesFile, lang = 'iw-IL'] = args;
  if (!aab || !track || !notesFile) throw new Error('usage: release <aab> <track> <notes.txt> [lang] [--draft]');
  const text = readFileSync(notesFile, 'utf8').trim();
  const status = draft ? 'draft' : 'completed';
  await withEdit(async (edit) => {
    const bundle = await call('POST', `${UPLOAD}/edits/${edit}/bundles?uploadType=media`, {
      body: readFileSync(aab),
      type: 'application/octet-stream',
    });
    console.log(`uploaded bundle versionCode ${bundle.versionCode}`);
    await call('PUT', `${API}/edits/${edit}/tracks/${track}`, {
      data: {
        track,
        releases: [{ versionCodes: [String(bundle.versionCode)], status, releaseNotes: [{ language: lang, text }] }],
      },
    });
    console.log(`${track}: versionCode ${bundle.versionCode} ${status}`);
  }, true);
} else if (command === 'screenshots') {
  const [dir, lang = 'iw-IL'] = args;
  if (!dir) throw new Error('usage: screenshots <dir> [lang]');
  const files = readdirSync(dir).filter((file) => file.endsWith('.png')).sort();
  await withEdit(async (edit) => {
    await call('DELETE', `${API}/edits/${edit}/listings/${lang}/phoneScreenshots`);
    for (const file of files) {
      await call('POST', `${UPLOAD}/edits/${edit}/listings/${lang}/phoneScreenshots?uploadType=media`, {
        body: readFileSync(join(dir, file)),
        type: 'image/png',
      });
      console.log(`uploaded ${file}`);
    }
  }, true);
} else {
  console.log('usage: play-upload.mjs status | release <aab> <track> <notes.txt> [lang] [--draft] | screenshots <dir> [lang]');
  process.exit(1);
}
