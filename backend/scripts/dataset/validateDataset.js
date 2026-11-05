// Step 5. Checks the catalogue before it can be imported. Prints a summary per zone and exits 1 on
// any error. A product with no confirmed photo is a warning: it shows the placeholder.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import Product from '../../models/Product.js';

const DATA = new URL('../../data/', import.meta.url);
const SOURCE = new URL('../../../docs/dataset-300/products-300.json', import.meta.url);
const FILES = new URL('../../../frontend/public/products/', import.meta.url);

const ZONES = { A: 'Audio', W: 'Wearables', D: 'Desk setup', L: 'Living', S: 'Style', G: 'Gaming', C: 'Carry', P: 'Phone+', B: 'Body care' };
const SKU = /^[AWDLSGCPB]-0[1-5]-\d{3}$/;
const IMAGE_PATH = /^\/products\/[A-Z]-\d{2}-\d{3}\.webp$/;
const CONNECTIVITY = new Set(['wired', 'wireless', 'n/a']);
const TOTAL = 300;
const MIN_ZONE = 30;
const MIN_BAY = 5;

const wholeNumber = value => Number.isInteger(value) && value >= 0;

function checkProduct(product, bayNames, problem) {
  const { productId: sku, zoneCode, bay, bayName, category, productName, brand, productPrice, quantity,
    colours, use, connectivity, specs, description, warrantyMonths, arrivesInDays } = product;
  if (!SKU.test(sku ?? '')) problem('bad SKU');
  const [zone, bayDigits] = (sku ?? '').split('-');
  if (zone !== zoneCode || Number(bayDigits) !== bay) problem('SKU does not match zone and bay');
  if (category !== ZONES[zoneCode]) problem(`category "${category}"`);
  if (bayName !== bayNames.get(`${zoneCode}-${bay}`)) problem(`bay name "${bayName}"`);
  if (typeof productName !== 'string' || productName.length < 3 || productName.length > 200) problem('name length');
  if (!brand) problem('no brand');
  if (!Number.isInteger(productPrice) || productPrice <= 0) problem(`price ${productPrice}`);
  if (!wholeNumber(quantity)) problem(`quantity ${quantity}`);
  if (!Array.isArray(colours) || colours.length < 1 || colours.length > 4 || !colours.every(c => typeof c === 'string' && c)) problem('colours');
  if (!Array.isArray(use) || use.length !== 2) problem('use must have 2 entries');
  if (!CONNECTIVITY.has(connectivity)) problem(`connectivity ${connectivity}`);
  const rows = Object.values(specs ?? {});
  if (rows.length < 2 || rows.length > 4 || !rows.every(value => typeof value === 'string' && value)) problem(`${rows.length} spec rows`);
  if (typeof description !== 'string' || description.length < 60 || description.length > 250) problem(`description ${description?.length} chars`);
  if (!wholeNumber(warrantyMonths)) problem('warrantyMonths');
  if (!wholeNumber(arrivesInDays)) problem('arrivesInDays');
}

function checkImage({ productId: sku, images, image }, hashes, problem) {
  if (image?.status !== 'ok') {
    if (images?.length) problem('has images[] but no confirmed photo');
    return false;
  }
  if (!image.matchChecked) problem('photo not confirmed by eye');
  for (const field of ['licence', 'sourcePage', 'attribution']) if (!image[field]) problem(`image.${field} empty`);
  if (!IMAGE_PATH.test(images?.[0] ?? '')) return problem(`images[0] "${images?.[0]}"`), false;
  const file = new URL(images[0].split('/').pop(), FILES);
  if (!existsSync(file)) return problem('image file missing'), false;
  if (!existsSync(new URL(`${sku}-thumb.webp`, FILES))) problem('thumb file missing');
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (hashes.has(hash)) problem(`same image file as ${hashes.get(hash)}`);
  hashes.set(hash, sku);
  return true;
}

export function validateDataset(products) {
  const bayNames = new Map(JSON.parse(readFileSync(SOURCE, 'utf8')).map(({ zoneCode, bay, bayName }) => [`${zoneCode}-${bay}`, bayName]));
  const errors = [];
  const missing = [];
  const hashes = new Map();
  const seen = { sku: new Set(), name: new Set() };

  if (products.length !== TOTAL) errors.push(`${products.length} products, expected ${TOTAL}`);
  for (const product of products) {
    const problem = message => errors.push(`${product.productId}: ${message}`);
    checkProduct(product, bayNames, problem);
    if (seen.sku.has(product.productId)) problem('duplicate SKU');
    seen.sku.add(product.productId);
    const name = String(product.productName).toLowerCase();
    if (seen.name.has(name)) problem('duplicate name');
    seen.name.add(name);
    if (!checkImage(product, hashes, problem)) missing.push(product.productId);

    const { isNew, verify, ...fields } = product;
    const invalid = new Product({ ...fields, isNewDrop: isNew }).validateSync();
    if (invalid) problem(`model: ${Object.keys(invalid.errors).join(', ')}`);
  }

  const zones = {};
  for (const { zoneCode, bay, quantity, productPrice, productId } of products) {
    const zone = zones[zoneCode] ??= { count: 0, stock: 0, min: Infinity, max: 0, bays: {} };
    zone.count += 1;
    zone.stock += quantity;
    zone.min = Math.min(zone.min, productPrice);
    zone.max = Math.max(zone.max, productPrice);
    zone.bays[bay] = (zone.bays[bay] ?? 0) + 1;
    zone.missing = (zone.missing ?? 0) + (missing.includes(productId) ? 1 : 0);
  }
  for (const [code, zone] of Object.entries(zones)) {
    if (zone.count < MIN_ZONE) errors.push(`Zone ${code}: only ${zone.count} products`);
    for (const [bay, count] of Object.entries(zone.bays)) if (count < MIN_BAY) errors.push(`Zone ${code} bay ${bay}: only ${count} products`);
  }
  return { errors, missing, zones };
}

function main() {
  const file = new URL(process.argv[2] ?? 'products-300.verified.json', DATA);
  const { errors, missing, zones } = validateDataset(JSON.parse(readFileSync(file, 'utf8')));
  const rows = Object.entries(zones).map(([code, { count, stock, min, max, missing: gaps }]) =>
    ({ zone: code, name: ZONES[code], count, stock, minPrice: min, maxPrice: max, imagesOk: count - gaps, missing: gaps }));
  console.table(rows);
  console.log(`Photos confirmed: ${TOTAL - missing.length}. Warning, on the placeholder: ${missing.length}.`);
  if (errors.length) {
    console.log(`${errors.length} errors:\n${errors.join('\n')}`);
    process.exitCode = 1;
  } else console.log('Dataset is valid.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
