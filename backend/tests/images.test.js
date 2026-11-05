import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import { products } from '../data/catalogue.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Shelf from '../models/Shelf.js';
import { matchesProduct, searchName } from '../scripts/dataset/fetchImages.js';
import { SOURCE, deleteOldRecords, findOldRecords, importProducts, toDocument } from '../scripts/dataset/importCatalogue.js';
import { validateDataset } from '../scripts/dataset/validateDataset.js';

const FILES = new URL('../../frontend/public/products/', import.meta.url);
const raw = JSON.parse(readFileSync(new URL('../data/products-300.json', import.meta.url), 'utf8'));
const copy = () => structuredClone(raw);

describe('the catalogue', () => {
  it('passes validation, with missing photos only a warning', () => {
    const { errors, missing } = validateDataset(raw);
    assert.deepEqual(errors, []);
    assert.equal(raw.length - missing.length, raw.filter(({ image }) => image.status === 'ok').length);
  });

  it('rejects bad data', () => {
    const bad = copy();
    bad[0].productPrice = 10.5;
    bad[1].connectivity = 'bluetooth';
    bad[2].specs = {};
    bad[3].productName = bad[4].productName;
    const { errors } = validateDataset(bad);
    for (const text of ['price 10.5', 'connectivity bluetooth', '0 spec rows', 'duplicate name']) {
      assert.ok(errors.some(error => error.includes(text)), text);
    }
  });

  it('rejects a photo nobody checked', () => {
    const bad = copy();
    bad.find(({ images }) => images.length).image.matchChecked = false;
    assert.ok(validateDataset(bad).errors.some(error => error.includes('not confirmed')));
  });

  it('gives each confirmed product a credited photo and thumb on disk', () => {
    for (const { productId, images, image } of products.filter(({ image: { status } }) => status === 'ok')) {
      assert.deepEqual(images, [`/products/${productId}.webp`]);
      assert.ok(image.attribution && image.sourcePage, productId);
      assert.ok(existsSync(new URL(`${productId}.webp`, FILES)), productId);
      assert.ok(existsSync(new URL(`${productId}-thumb.webp`, FILES)), productId);
    }
  });

  it('leaves a product with no photo on the placeholder', () => {
    for (const { images, image } of products.filter(({ image: { status } }) => status !== 'ok')) {
      assert.deepEqual(images, []);
      assert.equal(image.source, null);
    }
  });
});

describe('matching a photo to a product', () => {
  const sony = { brand: 'Sony', productName: 'Sony WH-1000XM5' };
  const flip = { brand: 'JBL', productName: 'JBL Flip 6' };

  it('tells close models apart', () => {
    assert.ok(matchesProduct('Sony WH-1000XM5 headphones.jpg', sony));
    assert.equal(matchesProduct('Sony WH-1000XM4 black', sony), false);
    assert.equal(matchesProduct('JBL Flip 5 speaker', flip), false);
  });

  it('does not read a model number out of a camera file name', () => {
    assert.equal(matchesProduct('JBL Flip 3 bluetooth speaker (DSCF2653)', flip), false);
  });

  it('accepts a model split across two words', () => {
    assert.ok(matchesProduct('Sony WH 1000XM5', { brand: 'Sony', productName: 'Sony WH1000XM5' }));
  });

  it('searches without the bracketed detail', () => {
    assert.equal(searchName('Apple AirPods Pro 2 (USB-C)'), 'Apple AirPods Pro 2');
  });
});

describe('the catalogue import', () => {
  let mongo;
  const documents = products.slice(0, 3);
  const [first, second] = documents;

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'bazaarmart' });
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('writes nothing on a dry run', async () => {
    assert.equal((await importProducts(documents, { dryRun: true })).added, 3);
    assert.equal(await Product.countDocuments(), 0);
  });

  it('adds the products, then is safe to run again', async () => {
    assert.equal((await importProducts(documents)).added, 3);
    const counts = await importProducts(documents);
    assert.deepEqual(counts, { added: 0, replacedOld: 0, refreshed: 3, changed: 0, kept: 0 });
    assert.equal(await Product.countDocuments(), 3);
  });

  it('keeps live stock on a product from this catalogue', async () => {
    await Product.updateOne({ productId: first.productId }, { quantity: 1 });
    await importProducts(documents);
    assert.equal((await Product.findOne({ productId: first.productId })).quantity, 1);
  });

  it('leaves current products alone when asked, so a reseed keeps Admin edits', async () => {
    await Product.updateOne({ productId: first.productId }, { productPrice: 1 });
    const counts = await importProducts(documents, { keepCurrent: true });
    assert.deepEqual(counts, { added: 0, replacedOld: 0, refreshed: 0, changed: 0, kept: 3 });
    assert.equal((await Product.findOne({ productId: first.productId })).productPrice, 1);
    assert.equal((await importProducts(documents, { dryRun: true })).changed, 1);
    assert.equal((await Product.findOne({ productId: first.productId })).productPrice, 1);
    await importProducts(documents);
    assert.equal((await Product.findOne({ productId: first.productId })).productPrice, first.productPrice);
  });

  it('takes every field when a SKU still holds an old product', async () => {
    await Product.updateOne({ productId: second.productId }, { source: 'old', quantity: 1, productName: 'Old thing' });
    assert.equal((await importProducts(documents)).replacedOld, 1);
    const product = await Product.findOne({ productId: second.productId });
    assert.equal(product.productName, second.productName);
    assert.equal(product.quantity, second.quantity);
  });

  it('finds old products with the orders and shelves that use them, and leaves users alone', async () => {
    const base = { productPrice: 1, category: 'Audio', quantity: 1, description: 'Old.' };
    const old = await Product.create({ ...base, productId: 'Z-OLD', productName: 'Old', source: 'seed' });
    const line = { productId: 'Z-OLD', name: 'Old', price: 1, qty: 1 };
    const address = { name: 'A', phone: '9876543210', line1: 'x', city: 'x', state: 'x', pincode: '600001' };
    const guest = { name: 'A', phone: '9876543210', email: 'a@b.co' };
    const order = await Order.create({ orderNo: 'BM-1', guest, items: [line], subtotal: 1, total: 1, address, slot: { label: 'x', date: new Date() }, payment: { method: 'cod' } });
    const shelf = await Shelf.create({ user: new mongoose.Types.ObjectId(), name: 'Old', items: [{ product: 'Z-OLD', savedPrice: 1 }] });

    const records = await findOldRecords(documents, []);
    assert.deepEqual(records.products.map(({ _id }) => String(_id)), [String(old._id)]);
    assert.deepEqual(records.orders.map(({ _id }) => String(_id)), [String(order._id)]);
    assert.deepEqual(records.shelves.map(({ _id }) => String(_id)), [String(shelf._id)]);

    assert.deepEqual(await deleteOldRecords(records), { products: 1, orders: 1, shelves: 1 });
    assert.equal(await Product.countDocuments({ source: SOURCE }), 3);
  });

  it('accepts a local or full image address and refuses anything else', async () => {
    const product = toDocument({ ...raw[0], isNew: false });
    assert.equal(new Product({ ...product, images: ['/products/x.webp', 'https://a.co/b.jpg'] }).validateSync(), undefined);
    assert.ok(new Product({ ...product, images: ['javascript:alert(1)'] }).validateSync());
    assert.ok(new Product({ ...product, images: ['a.jpg'] }).validateSync());
  });
});

describe('GET /api/credits', () => {
  let mongo;

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'bazaarmart' });
    await importProducts(products);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('lists every photo credit with no login', async () => {
    const res = await request(createApp()).get('/api/credits');
    assert.equal(res.status, 200);
    assert.equal(res.body.count, products.filter(({ image }) => image.status === 'ok').length);
    assert.ok(res.body.data.every(({ image }) => image.attribution && image.sourcePage));
  });
});
