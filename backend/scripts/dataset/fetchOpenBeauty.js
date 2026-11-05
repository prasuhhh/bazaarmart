// Finds Body care photos in the Open Beauty Facts and Open Food Facts bulk exports. Their robots.txt
// disallows the search API, so this reads the published exports once instead. Photos are CC BY-SA,
// credited to each project's contributors. Writes data/open-beauty.json for fetchImages.js.
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { searchName } from './fetchImages.js';

const DATA = new URL('../../data/', import.meta.url);
const BEAUTY_URL = 'https://static.openbeautyfacts.org/data/en.openbeautyfacts.org.products.csv.gz';
const FOOD_URL = 'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz';
const DUMP = fileURLToPath(new URL('cache/openbeautyfacts.csv.gz', DATA));
const OUTPUT = new URL('open-beauty.json', DATA);
const USER_AGENT = 'BazaarMartLabDataset/1.0 (student project)';
const LICENCE = 'CC BY-SA 3.0';

async function download() {
  if (existsSync(DUMP)) return;
  mkdirSync(new URL('cache/', DATA), { recursive: true });
  const response = await fetch(BEAUTY_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Export returned ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(DUMP));
}

const words = text => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const GENERIC = new Set(['eau', 'de', 'toilette', 'parfum', 'cologne', 'ml', 'g', 'for', 'men', 'the', 'and', 'with', 'face', 'cream', 'serum']);

// Generic words would let "Dior Addict Eau de Toilette" pass as Dior Sauvage, so every distinctive
// word of the name has to appear.
function exactMatch(text, product) {
  const found = new Set(words(text));
  const brand = words(product.brand);
  const wanted = words(searchName(product.productName)).filter(word => !GENERIC.has(word) && !brand.includes(word) && !/^\d+$/.test(word));
  return brand.every(word => found.has(word)) && wanted.length > 0 && wanted.every(word => found.has(word));
}

async function scan(input, wanted, found, project, host) {
  const brandWords = [...new Set(wanted.flatMap(({ brand }) => words(brand).slice(0, 1)))];
  let columns;
  let rows = 0;
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    if (!columns) { columns = Object.fromEntries(line.split('\t').map((name, index) => [name, index])); continue; }
    rows += 1;
    const lower = line.toLowerCase();
    if (!brandWords.some(word => lower.includes(word))) continue;
    const cells = line.split('\t');
    const image = cells[columns.image_url];
    if (!image) continue;
    const name = cells[columns.product_name];
    const text = `${cells[columns.brands]} ${name}`;
    for (const product of wanted) {
      if (found[product.productId] || !exactMatch(text, product)) continue;
      found[product.productId] = {
        source: project.toLowerCase().replace(/ /g, ''), title: name, sourcePage: `https://${host}/product/${cells[columns.code]}`,
        originalUrl: image.replace(/\.\d+\.jpg$/, '.full.jpg'), width: null, height: null, licence: LICENCE, author: `${project} contributors`,
        attribution: `"${name}" by ${project} contributors, ${LICENCE}, via ${project}`
      };
    }
  }
  console.log(`${project}: read ${rows} products.`);
}

async function main() {
  await download();
  const products = JSON.parse(readFileSync(new URL('products-300.verified.json', DATA), 'utf8')).filter(({ zoneCode }) => zoneCode === 'B');
  const images = JSON.parse(readFileSync(new URL('images.json', DATA), 'utf8'));
  const wanted = products.filter(({ productId }) => images[productId]?.status !== 'ok');
  const found = {};
  const save = () => writeFileSync(OUTPUT, `${JSON.stringify(found, null, 1)}\n`);
  await scan(createReadStream(DUMP).pipe(createGunzip()), wanted, found, 'Open Beauty Facts', 'world.openbeautyfacts.org');
  save();

  // Streamed and thrown away: the Food Facts export is 1.5 GB, so it isn't kept on disk.
  const food = await fetch(FOOD_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (food.ok) {
    // The connection can drop near the end of a file this size. Whatever was read still counts.
    const gunzip = createGunzip();
    const body = Readable.fromWeb(food.body);
    const stop = error => { console.log(`Open Food Facts stream ended early: ${error.message}`); gunzip.end(); };
    body.on('error', stop);
    gunzip.on('error', error => console.log(`Open Food Facts decompress ended: ${error.message}`));
    await scan(body.pipe(gunzip), wanted.filter(({ productId }) => !found[productId]), found, 'Open Food Facts', 'world.openfoodfacts.org');
  } else console.log(`Open Food Facts export returned ${food.status}.`);

  save();
  console.log(`Matched ${Object.keys(found).length} of ${wanted.length}.`);
  for (const [sku, { title, source }] of Object.entries(found)) console.log(` ${sku} [${source}] ${title}`);
}

await main();
