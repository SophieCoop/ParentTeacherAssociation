/* ============================================================
   חבילת העדכון החי (native/scripts/bundle.mjs)
   ------------------------------------------------------------
   ה-zip נכתב ביד, בלי ספרייה, ורץ בכל פריסה של האתר — ולכן נבדק
   כאן כמו שהאפליקציה תקרא אותו: כל קובץ נפרס ומושווה לקובץ שבמאגר,
   ה-checksum הוא של ה-zip עצמו, ואותם קבצים נותנים את אותו zip.
   ============================================================ */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const load = () => import(path.join(ROOT, 'native', 'scripts', 'bundle.mjs'));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vaad-bundle-'));

/* פריסה מינימלית של zip, דרך הספרייה המרכזית — כמו שעושים ZIPFoundation
   באייפון; ו-ZipInputStream של אנדרואיד נשען על הכותרות המקומיות, שגם
   הן נבדקות כאן מול הספרייה המרכזית */
function unzip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out = new Map();
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString('utf8');
    assert.equal(buf.readUInt32LE(local), 0x04034b50);
    assert.equal(buf.readUInt16LE(local + 6) & 0x08, 0, 'no data descriptor — sizes up front');
    assert.equal(buf.readUInt32LE(local + 18), csize, name + ': sizes in the local header');
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + csize);
    const data = method === 8 ? zlib.inflateRawSync(body) : Buffer.from(body);
    assert.equal(data.length, usize, name);
    assert.equal(zlib.crc32(data) >>> 0, crc, name + ': crc');
    out.set(name, data);
    p += 46 + nlen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}

test('every shipped file is in the zip, byte for byte, with index.html at its root', async () => {
  const { makeBundle } = await load();
  const out = tmp();
  const m = makeBundle({ out });
  const files = unzip(fs.readFileSync(path.join(out, m.file)));
  const { listShipped } = await import(path.join(ROOT, 'native', 'scripts', 'web-bundle.mjs'));
  const shipped = listShipped();
  assert.deepEqual([...files.keys()].sort(), [...shipped, 'bundle.json'].sort());
  assert.ok(files.has('index.html'));
  for (const f of shipped) assert.ok(files.get(f).equals(fs.readFileSync(path.join(ROOT, f))), f);
  assert.deepEqual(JSON.parse(files.get('bundle.json')), { version: m.version, minBuild: m.minBuild });
});

test('the description names the zip, and its checksum is the SHA-256 the updater checks', async () => {
  const { makeBundle } = await load();
  const out = tmp();
  const m = makeBundle({ out, now: new Date('2026-10-01T09:00:00Z') });
  const desc = JSON.parse(fs.readFileSync(path.join(out, 'bundle.json'), 'utf8'));
  assert.equal(desc.file, 'vaad-' + desc.version + '.zip');
  assert.equal(desc.checksum, crypto.createHash('sha256').update(fs.readFileSync(path.join(out, desc.file))).digest('hex'));
  assert.match(desc.checksum, /^[0-9a-f]{64}$/, 'lowercase hex, as iOS compares it');
  assert.equal(desc.minBuild, JSON.parse(fs.readFileSync(path.join(ROOT, 'native', 'app-build.json'), 'utf8')).bundleMinBuild);
  assert.equal(desc.builtAt, '2026-10-01T09:00:00.000Z');
  assert.deepEqual(fs.readdirSync(out).sort(), ['bundle.json', desc.file].sort(), 'nothing else is published');
  assert.equal(m.version, desc.version);
});

test('the same files always give the same zip — the version the app compares is stable', async () => {
  const { makeBundle } = await load();
  const a = tmp(), b = tmp();
  const ma = makeBundle({ out: a, now: new Date(0) });
  const mb = makeBundle({ out: b, now: new Date(1e12) });
  assert.equal(ma.version, mb.version);
  assert.ok(fs.readFileSync(path.join(a, ma.file)).equals(fs.readFileSync(path.join(b, mb.file))));
});

test('the hand-written CRC, for a Node without zlib.crc32, agrees with zlib', async () => {
  const { crc32js } = await load();
  const samples = ['', 'a', 'ועד הורים', 'x'.repeat(10000)].map(s => Buffer.from(s));
  samples.push(fs.readFileSync(path.join(ROOT, 'assets', 'icon-64.png')));
  for (const b of samples) assert.equal(crc32js(b), zlib.crc32(b) >>> 0);
});
