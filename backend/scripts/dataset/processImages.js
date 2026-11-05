// Step 3. Downloads each chosen photo into data/cache/images and writes two square WebP files to
// frontend/public/products: <SKU>.webp (800 px) and <SKU>-thumb.webp (300 px), contained on cream.
// If a photo can't be used it moves on to the product's next candidate, and a product with none
// left is marked "missing". A file already made from the same source URL is not redone.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const DATA = new URL('../../data/', import.meta.url);
const IMAGES = new URL('images.json', DATA);
const ORIGINALS = new URL('cache/images/', DATA);
const OUTPUT = new URL('../../../frontend/public/products/', import.meta.url);

const USER_AGENT = 'BazaarMartLabDataset/1.0 (student project)';
const GAP_MS = 1000;
const GAPS = { 'upload.wikimedia.org': 5000 }; // Commons rate-limits image downloads hard
const RATE_LIMIT_TRIES = 3;
const TIMEOUT_MS = 30000;
const FULL = 800;
const THUMB = 300;
const CREAM = '#FAF6EC';
const SHORTEST_SIDE = 400; // agreed down from 600: the 800 px output is then at most a 2x upscale
const MAX_BYTES = 150 * 1024;
const QUALITIES = [80, 70, 60, 50];
const MAX_UPSCALE = 2;
const TIGHTEN = new Set(['A-01-102', 'A-01-103']);

const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms); });
const lastCall = new Map();

// A 429 is a request to slow down, so it waits as told and tries again before giving up.
async function download(url) {
  const { host } = new URL(url);
  for (let attempt = 1; ; attempt += 1) {
    const wait = Math.max((lastCall.get(host) ?? 0) + (GAPS[host] ?? GAP_MS) - Date.now(), 0);
    lastCall.set(host, Date.now() + wait);
    if (wait) await sleep(wait);
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (response.status !== 429 || attempt === RATE_LIMIT_TRIES) throw new Error(`HTTP ${response.status}`);
    const pause = (Number(response.headers.get('retry-after')) || 30) * 1000;
    lastCall.set(host, Date.now() + pause);
    await sleep(pause);
  }
}

// These CDNs serve a small rendition by default. Their own size option gets the same photo larger.
function largerVersion(url) {
  if (url.includes('images.samsung.com')) return `${url.split('?')[0]}?$1300_1038_PNG$`;
  if (url.includes('googleusercontent.com')) return `${url.split('=')[0]}=s1200`;
  if (url.includes('cdn.shopify.com')) return url.replace(/_\d*x\d*(?=\.[a-z]+(\?|$))/i, '');
  if (url.includes('scene7.com')) return `${url.split('?')[0]}?wid=1000`;
  return null;
}

function originalFile(sku, url) {
  const extension = /\.(png|webp|jpe?g)(\?|$)/i.exec(url)?.[1]?.toLowerCase() ?? 'jpg';
  const version = createHash('sha1').update(url).digest('hex').slice(0, 8);
  return new URL(`${sku}-${version}.${extension}`, ORIGINALS);
}

// Photos with wide empty margins lose them, but never past a 2x enlargement.
async function tightened(input) {
  const { data, info } = await sharp(input).rotate().flatten({ background: CREAM }).trim({ threshold: 18 }).png().toBuffer({ resolveWithObject: true });
  const side = Math.max(info.width, info.height, FULL / MAX_UPSCALE);
  const pad = (space, before = Math.floor(space / 2)) => [before, space - before];
  const [left, right] = pad(side - info.width);
  const [top, bottom] = pad(side - info.height);
  return sharp(data).extend({ left, right, top, bottom, background: CREAM }).png().toBuffer();
}

async function square(input, size, quality) {
  return sharp(input).rotate()
    .flatten({ background: CREAM })
    .resize(size, size, { fit: 'contain', background: CREAM })
    .webp({ quality }).toBuffer();
}

// Quality 80 where it fits. Busy photos step down to stay under the size limit.
async function underLimit(input) {
  for (const quality of QUALITIES) {
    const webp = await square(input, FULL, quality);
    if (webp.length <= MAX_BYTES) return webp;
  }
  throw new Error('over 150 KB at every quality');
}

async function fetchOriginal(sku, url) {
  const file = originalFile(sku, url);
  if (existsSync(file)) return readFileSync(file);
  const source = await download(url);
  writeFileSync(file, source);
  return source;
}

async function makeFiles(sku, candidate) {
  let source = await fetchOriginal(sku, candidate.originalUrl);
  let { width, height } = await sharp(source).metadata();
  const larger = Math.min(width, height) < SHORTEST_SIDE ? largerVersion(candidate.originalUrl) : null;
  if (larger) {
    const better = await fetchOriginal(sku, larger).catch(() => null);
    const size = better && await sharp(better).metadata().catch(() => null);
    if (size && Math.min(size.width, size.height) > Math.min(width, height)) ({ width, height } = size), source = better;
  }
  if (Math.min(width, height) < SHORTEST_SIDE) throw new Error(`only ${width}x${height}`);
  if (TIGHTEN.has(sku)) source = await tightened(source);
  writeFileSync(new URL(`${sku}.webp`, OUTPUT), await underLimit(source));
  writeFileSync(new URL(`${sku}-thumb.webp`, OUTPUT), await square(source, THUMB, QUALITIES[0]));
  return { width, height };
}

async function processOne(sku, image) {
  const rejected = new Set(image.rejected ?? []);
  const failures = { ...image.failures };
  const options = (image.candidates ?? []).filter(candidate => !rejected.has(candidate.originalUrl));
  for (const candidate of options) {
    const { source, sourcePage, originalUrl, licence, author, attribution } = candidate;
    const done = image.processedFrom === originalUrl && existsSync(new URL(`${sku}.webp`, OUTPUT));
    if (done) return { ...image, source, sourcePage, originalUrl, licence, author, attribution, status: 'ok' };
    try {
      const size = await makeFiles(sku, candidate);
      return { ...image, status: 'ok', source, sourcePage, originalUrl, licence, author, attribution, ...size, file: `/products/${sku}.webp`, processedFrom: originalUrl, matchChecked: false, failures };
    } catch (error) {
      failures[originalUrl] = error.message;
    }
  }
  const { file, processedFrom, width, height, ...rest } = image;
  return { ...rest, status: 'missing', source: null, sourcePage: null, originalUrl: null, licence: null, author: null, attribution: null, matchChecked: false, failures };
}

async function main() {
  mkdirSync(ORIGINALS, { recursive: true });
  mkdirSync(OUTPUT, { recursive: true });
  const images = JSON.parse(readFileSync(IMAGES, 'utf8'));
  const skus = Object.keys(images).filter(sku => !images[sku].matchChecked);

  // One queue per photo host, so a slow site doesn't hold up the others.
  const byHost = new Map();
  for (const sku of skus) {
    if (images[sku].status === 'ok' && images[sku].processedFrom === images[sku].originalUrl && !images[sku].rejected?.includes(images[sku].originalUrl)) continue;
    const host = images[sku].candidates?.[0] ? new URL(images[sku].candidates[0].originalUrl).host : 'none';
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(sku);
  }
  await Promise.all([...byHost.values()].map(async queue => {
    for (const sku of queue) images[sku] = await processOne(sku, images[sku]);
  }));
  writeFileSync(IMAGES, `${JSON.stringify(images, null, 1)}\n`);

  const made = Object.values(images).filter(image => image.status === 'ok');
  const bytes = made.reduce((sum, { file }) => {
    const name = file.split('/').pop();
    return sum + statSync(new URL(name, OUTPUT)).size + statSync(new URL(name.replace('.webp', '-thumb.webp'), OUTPUT)).size;
  }, 0);
  const reasons = {};
  for (const image of Object.values(images)) {
    if (image.status === 'ok') continue;
    for (const reason of Object.values(image.failures ?? {})) {
      const short = reason.startsWith('only ') ? 'too small' : reason;
      reasons[short] = (reasons[short] ?? 0) + 1;
    }
  }
  console.log(`Photos ready: ${made.length}. Total ${(bytes / 1048576).toFixed(1)} MB. Failures:`, reasons);
}

await main();
