// Step 4. Checks every image file, flags photos used twice, and builds contact sheets of 30 images
// for checking by eye. data/image-review.json holds that verdict for each SKU ("correct", "wrong"
// or "unclear"), and only "correct" sets matchChecked. Anything else goes back to its next candidate.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { photoKey } from './photoKey.js';

const DATA = new URL('../../data/', import.meta.url);
const IMAGES = new URL('images.json', DATA);
const REVIEW = new URL('image-review.json', DATA);
const SHEETS = new URL('reports/sheets/', DATA);
const PRODUCTS = new URL('products-300.verified.json', DATA);
const FILES = new URL('../../../frontend/public/products/', import.meta.url);

const SIZE = 800;
const MAX_BYTES = 150 * 1024;
const MIN_STDDEV = 8;
const SAME_PHOTO_DISTANCE = 5;
const PER_SHEET = 30;
const COLUMNS = 6;
const CELL = 245;
const CAPTION = 46;
const INK = '#1F1D1A';

const escapeXml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

async function dHash(file) {
  const { data, info } = await sharp(file).removeAlpha().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const at = (row, column) => data[(row * 9 + column) * info.channels];
  let hash = 0n;
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      hash = (hash << 1n) | (at(row, column) > at(row, column + 1) ? 1n : 0n);
    }
  }
  return hash;
}

const distance = (a, b) => (a ^ b).toString(2).replace(/0/g, '').length;

async function checkFile(sku) {
  const problems = [];
  const file = new URL(`${sku}.webp`, FILES);
  if (!existsSync(file)) return ['file missing'];
  if (!existsSync(new URL(`${sku}-thumb.webp`, FILES))) problems.push('thumb missing');
  const path = file.pathname;
  const { width, height } = await sharp(path).metadata();
  if (width !== SIZE || height !== SIZE) problems.push(`${width}x${height}`);
  if (statSync(file).size > MAX_BYTES) problems.push('over 150 KB');
  const { channels } = await sharp(path).stats();
  if (Math.max(...channels.map(({ stdev }) => stdev)) <= MIN_STDDEV) problems.push('almost blank');
  return problems;
}

function caption(sku, name) {
  const short = name.length > 34 ? `${name.slice(0, 33)}…` : name;
  return `<text x="4" y="16" font-family="Menlo, monospace" font-size="14" font-weight="700" fill="${INK}">${sku}</text>
<text x="4" y="36" font-family="Helvetica, Arial, sans-serif" font-size="12.5" fill="${INK}">${escapeXml(short)}</text>`;
}

async function buildSheet(items, number, names) {
  const rows = Math.ceil(items.length / COLUMNS);
  const height = rows * (CELL + CAPTION);
  const layers = await Promise.all(items.flatMap((sku, index) => {
    const left = (index % COLUMNS) * CELL;
    const top = Math.floor(index / COLUMNS) * (CELL + CAPTION);
    return [
      sharp(new URL(`${sku}-thumb.webp`, FILES).pathname).resize(CELL - 8, CELL - 8).png().toBuffer().then(input => ({ input, left: left + 4, top: top + 2 })),
      Promise.resolve({ input: Buffer.from(`<svg width="${CELL}" height="${CAPTION}" xmlns="http://www.w3.org/2000/svg">${caption(sku, names[sku])}</svg>`), left, top: top + CELL - 2 })
    ];
  }));
  const name = `${typeof number === 'number' ? `sheet-${String(number).padStart(2, '0')}` : number}.png`;
  await sharp({ create: { width: COLUMNS * CELL, height, channels: 3, background: '#FFFFFF' } }).composite(layers).png().toFile(new URL(name, SHEETS).pathname);
  return name;
}

async function main() {
  const images = JSON.parse(readFileSync(IMAGES, 'utf8'));
  const names = Object.fromEntries(JSON.parse(readFileSync(PRODUCTS, 'utf8')).map(({ productId, productName }) => [productId, productName]));
  const review = existsSync(REVIEW) ? JSON.parse(readFileSync(REVIEW, 'utf8')) : {};
  const ready = Object.keys(images).filter(sku => images[sku].status === 'ok').sort();

  const problems = {};
  const hashes = [];
  for (const sku of ready) {
    const found = await checkFile(sku);
    if (found.length) problems[sku] = found;
    else hashes.push([sku, await dHash(new URL(`${sku}.webp`, FILES).pathname)]);
  }
  const twins = [];
  for (let i = 0; i < hashes.length; i += 1) {
    for (let j = i + 1; j < hashes.length; j += 1) {
      if (distance(hashes[i][1], hashes[j][1]) <= SAME_PHOTO_DISTANCE) twins.push([hashes[i][0], hashes[j][0]]);
    }
  }

  // A verdict counts only for the photo it was made on. A new photo needs checking again.
  for (const sku of ready) {
    const verdict = review[sku];
    images[sku].matchChecked = verdict?.verdict === 'correct' && photoKey(verdict.url) === photoKey(images[sku].originalUrl);
  }
  writeFileSync(IMAGES, `${JSON.stringify(images, null, 1)}\n`);

  const pending = ready.filter(sku => photoKey(review[sku]?.url) !== photoKey(images[sku].originalUrl));
  rmSync(SHEETS, { recursive: true, force: true });
  mkdirSync(SHEETS, { recursive: true });
  const sheets = [];
  for (let index = 0; index < pending.length; index += PER_SHEET) {
    const part = pending.slice(index, index + PER_SHEET);
    sheets.push({ name: await buildSheet(part, sheets.length + 1, names), skus: part });
  }
  writeFileSync(new URL('index.json', SHEETS), JSON.stringify(sheets, null, 1));

  // The confirmed set, for showing to a person. Ignores earlier sheets of unchecked photos.
  const confirmed = ready.filter(sku => images[sku].matchChecked);
  for (let index = 0; index < confirmed.length; index += PER_SHEET) {
    await buildSheet(confirmed.slice(index, index + PER_SHEET), `confirmed-${Math.floor(index / PER_SHEET) + 1}`, names);
  }

  console.log(`Files ok: ${ready.length - Object.keys(problems).length} of ${ready.length}. Photo used twice: ${twins.length} pairs.`);
  if (Object.keys(problems).length) console.log('Problems:', problems);
  if (twins.length) console.log('Same photo:', twins.map(pair => pair.join(' = ')).join(', '));
  console.log(`To review: ${pending.length} on ${sheets.length} sheets. Checked correct: ${Object.values(images).filter(image => image.matchChecked).length}.`);
}

await main();
