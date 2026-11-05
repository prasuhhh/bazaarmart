// Step 7. Puts the verified catalogue into MongoDB. Upserts by SKU, so running it again is safe.
//   npm run catalogue:import                 import
//   npm run catalogue:import -- --dry-run    print what would change, write nothing
//   npm run catalogue:import -- --prune-old  list old-catalogue records, delete them after "yes"
// Users are never touched.
import 'dotenv/config';
import { copyFileSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import mongoose from 'mongoose';
import { connectDB } from '../../config/db.js';
import Order from '../../models/Order.js';
import Product from '../../models/Product.js';
import Shelf from '../../models/Shelf.js';
import { validateDataset } from './validateDataset.js';

const DATA = new URL('../../data/', import.meta.url);
const VERIFIED = new URL('products-300.verified.json', DATA);
const FINAL = new URL('products-300.json', DATA);
const OLD_CATALOGUE = new URL('products.json', DATA);
const RETIRED = new URL('retiredSkus.json', DATA);

export const SOURCE = 'bazaarmart:real-300-v1';
const BATCH = 100;

export const toDocument = ({ isNew, verify, ...product }) => ({ ...product, isNewDrop: isNew });
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const plain = value => JSON.parse(JSON.stringify(value ?? null));

// Cast the file's values the way the model stores them, then compare only the fields the file sets.
function differs(fields, stored) {
  const wanted = new Product(fields).toObject({ flattenMaps: true });
  return Object.keys(fields).some(key => !isDeepStrictEqual(plain(wanted[key]), plain(stored[key])));
}

// Stock is live, so a product already from this catalogue keeps it and every other field the file
// sets is overwritten. `changed` counts the refreshed products that actually differ. A SKU that still
// holds an old product takes every field from the file. keepCurrent leaves products from this catalogue
// untouched, which is how a reseed keeps edits made on the Admin page.
export async function importProducts(documents, { dryRun = false, keepCurrent = false } = {}) {
  const existing = new Map((await Product.find().lean()).map(product => [product.productId, product]));
  const counts = { added: 0, replacedOld: 0, refreshed: 0, changed: 0, kept: 0 };
  const operations = documents.flatMap(document => {
    const { productId, quantity, ...fields } = document;
    const stored = existing.get(productId);
    const isCurrent = stored?.source === document.source;
    if (isCurrent && keepCurrent) {
      counts.kept += 1;
      return [];
    }
    counts[!stored ? 'added' : isCurrent ? 'refreshed' : 'replacedOld'] += 1;
    if (isCurrent && differs(fields, stored)) counts.changed += 1;
    return [{
      updateOne: {
        filter: { productId },
        update: isCurrent ? { $set: fields } : { $set: { ...fields, quantity } },
        upsert: true
      }
    }];
  });
  if (!dryRun) {
    for (let start = 0; start < operations.length; start += BATCH) {
      await Product.bulkWrite(operations.slice(start, start + BATCH));
    }
  }
  return counts;
}

// Old SKUs come from the retired catalogue files. An order line counts as old when its SKU is one
// of those and its name no longer matches the product now holding that SKU.
export async function findOldRecords(documents, oldSkus) {
  const names = new Map(documents.map(({ productId, productName }) => [productId, productName]));
  const old = new Set(oldSkus);
  const products = await Product.find({ source: { $ne: SOURCE } }, 'productId productName').lean();
  for (const { productId } of products) old.add(productId);

  const pointsAtOld = ({ productId, name }) => old.has(productId) && names.get(productId) !== name;
  const orders = (await Order.find({}, 'orderNo items').lean()).filter(({ items }) => items.some(pointsAtOld));
  const shelves = (await Shelf.find({}, 'name items').lean()).filter(({ items }) => items.some(({ product }) => old.has(product)));
  return { products, orders, shelves };
}

export async function deleteOldRecords({ products, orders, shelves }) {
  const removed = {
    products: (await Product.deleteMany({ _id: { $in: products.map(({ _id }) => _id) } })).deletedCount,
    orders: (await Order.deleteMany({ _id: { $in: orders.map(({ _id }) => _id) } })).deletedCount,
    shelves: (await Shelf.deleteMany({ _id: { $in: shelves.map(({ _id }) => _id) } })).deletedCount
  };
  return removed;
}

async function prune(documents) {
  const oldSkus = [...readJson(OLD_CATALOGUE).map(({ productId }) => productId), ...readJson(RETIRED)];
  const records = await findOldRecords(documents, oldSkus);
  const { products, orders, shelves } = records;
  console.log(`Old products: ${products.length}`);
  for (const { productId, productName } of products) console.log(`  ${productId} ${productName}`);
  console.log(`Orders pointing at old products: ${orders.length}`);
  for (const { orderNo, items } of orders) console.log(`  ${orderNo}: ${items.map(({ productId }) => productId).join(', ')}`);
  console.log(`Shelves pointing at old products: ${shelves.length}`);
  for (const { name, items } of shelves) console.log(`  ${name}: ${items.map(({ product }) => product).join(', ')}`);

  if (!products.length && !orders.length && !shelves.length) return;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question('Delete all of the above? Type yes to confirm: ');
  prompt.close();
  if (answer.trim() !== 'yes') {
    console.log('Nothing deleted.');
    return;
  }
  console.log('Deleted:', await deleteOldRecords(records));
}

async function main() {
  const flags = new Set(process.argv.slice(2));
  const products = readJson(VERIFIED);
  const { errors, missing } = validateDataset(products);
  if (errors.length) {
    console.error(`Refusing to import, ${errors.length} validation errors:\n${errors.join('\n')}`);
    process.exitCode = 1;
    return;
  }
  const documents = products.map(toDocument);

  await connectDB();
  try {
    const dryRun = flags.has('--dry-run');
    const counts = await importProducts(documents, { dryRun });
    console.log(`${dryRun ? 'Would import' : 'Imported'}: ${JSON.stringify(counts)}. Photos: ${products.length - missing.length}, placeholders: ${missing.length}.`);
    if (!dryRun) copyFileSync(VERIFIED, FINAL);
    if (flags.has('--prune-old')) await prune(documents);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
