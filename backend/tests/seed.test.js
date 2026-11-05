import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { after, before, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import { demoOrders, kits, products, zones } from '../data/catalogue.js';
import Kit from '../models/Kit.js';
import Order from '../models/Order.js';
import Product, { ZONE_CODES } from '../models/Product.js';
import User from '../models/User.js';
import Zone from '../models/Zone.js';
import { SKU } from './fixtures/skus.js';

process.env.JWT_SECRET = 'test-secret';

const ADMIN = { emailId: 'admin@bazaarmart.test', password: 'admin-pass-1' };
const DEMO = { emailId: 'demo@bazaarmart.test', password: 'demo-pass-1' };
const DB_NAME = 'bazaarmart';

let mongo;
const app = createApp({ authRateLimit: 100000 });

function runSeed(extraEnv = {}) {
  const env = {
    ...process.env,
    MONGO_URI: mongo.getUri(),
    SEED_ADMIN_EMAIL: ADMIN.emailId,
    SEED_ADMIN_PASSWORD: ADMIN.password,
    SEED_DEMO_EMAIL: DEMO.emailId,
    SEED_DEMO_PASSWORD: DEMO.password,
    ...extraEnv
  };
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['seed.js'], { env });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    child.on('exit', code => resolve({ code, output }));
  });
}

const login = credentials => request(app).post('/api/login').send(credentials);

describe('catalogue data', () => {
  it('has 300 products with unique, well-formed SKUs', () => {
    assert.equal(products.length, 300);
    assert.equal(new Set(products.map(product => product.productId)).size, products.length);
    for (const { productId, zoneCode, bay } of products) {
      assert.match(productId, /^[AWDLSGCPB]-\d{2}-\d{3}$/);
      assert.ok(productId.startsWith(`${zoneCode}-${String(bay).padStart(2, '0')}-`), productId);
    }
  });

  it('includes the SKUs the tests rely on', () => {
    const skus = new Set(products.map(product => product.productId));
    for (const sku of Object.values(SKU)) assert.ok(skus.has(sku), sku);
    assert.match(products.find(product => product.productId === SKU.shirt).productName, /Shirt/);
  });

  it('every product is valid against the model', async () => {
    for (const product of products) await new Product(product).validate();
  });

  it('covers all 9 zones with very uneven stock and a few new drops', () => {
    assert.deepEqual(zones.map(zone => zone.code).sort(), [...ZONE_CODES].sort());
    const stock = code => products.filter(p => p.zoneCode === code).reduce((sum, p) => sum + p.quantity, 0);
    const totals = ZONE_CODES.map(stock);
    assert.ok(Math.min(...totals) > 0);
    assert.ok(Math.max(...totals) >= Math.min(...totals) * 4, totals.join());
    const drops = products.filter(product => product.isNewDrop).length;
    assert.ok(drops >= 5 && drops <= 40, `${drops} new drops`);
  });

  it('every demo order uses a real SKU', () => {
    const skus = new Set(products.map(product => product.productId));
    for (const order of demoOrders) for (const [sku] of order.items) assert.ok(skus.has(sku), sku);
    assert.notEqual(demoOrders[0].status, demoOrders[1].status);
  });
});

describe('npm run seed', () => {
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: DB_NAME });
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('fills an empty database', async () => {
    const { code, output } = await runSeed();
    assert.equal(code, 0, output);
    assert.equal(await Zone.countDocuments(), 9);
    assert.equal(await Kit.countDocuments(), kits.length);
    assert.equal(await Product.countDocuments(), products.length);
    assert.equal(await Order.countDocuments(), 2);
  });

  it('gives zones their layout spans and varied stock through the API', async () => {
    const { body } = await request(app).get('/api/zones');
    const byCode = Object.fromEntries(body.data.map(zone => [zone.code, zone]));
    assert.deepEqual(byCode.L.layout, { col: 3, row: 2 });
    assert.deepEqual(byCode.B.layout, { col: 1, row: 1 });
    assert.ok(byCode.S.totalStock > byCode.G.totalStock * 4);
    assert.ok(byCode.A.bays.length === 5);
    assert.equal(byCode.A.bays[0].bayName, 'Earbuds');
  });

  it('lets the admin and demo user log in, with the right roles', async () => {
    const admin = await login(ADMIN);
    assert.equal(admin.status, 200);
    assert.equal(admin.body.data.user.role, 'admin');
    const demo = await login(DEMO);
    assert.equal(demo.status, 200);
    assert.equal(demo.body.data.user.role, 'user');
  });

  it('gives the demo user two orders in different statuses, with catalogue prices', async () => {
    const { body: login_ } = await login(DEMO);
    const res = await request(app).get('/api/orders').set({ Authorization: `Bearer ${login_.data.token}` });
    assert.equal(res.body.count, 2);
    assert.deepEqual(res.body.data.map(order => order.status).sort(), ['out_for_delivery', 'packed']);
    assert.deepEqual(res.body.data.map(order => order.orderNo).sort(), ['BM-2041', 'BM-2042']);

    const shirt = res.body.data.flatMap(order => order.items).find(item => item.productId === SKU.shirt);
    const listed = products.find(({ productId }) => productId === SKU.shirt);
    assert.equal(shirt.price, listed.productPrice);
    assert.equal(shirt.name, listed.productName);
    for (const order of res.body.data) {
      assert.equal(order.total, order.items.reduce((sum, item) => sum + item.price * item.qty, 0));
      assert.equal(order.events.at(-1).status, order.status);
    }
  });

  it('is safe to run again: nothing is duplicated', async () => {
    const { code, output } = await runSeed();
    assert.equal(code, 0, output);
    assert.equal(await Zone.countDocuments(), 9);
    assert.equal(await Kit.countDocuments(), kits.length);
    assert.equal(await Product.countDocuments(), products.length);
    assert.equal(await User.countDocuments(), 2);
    assert.equal(await Order.countDocuments(), 2);
    assert.match(output, /Products added: 0/);
  });

  it('keeps edits, live stock and a changed admin password', async () => {
    await Product.updateOne({ productId: SKU.earbuds }, { productPrice: 1, quantity: 3 });
    await login(ADMIN).then(async ({ body }) => {
      const res = await request(app).put('/api/users').query({ emailId: ADMIN.emailId })
        .set({ Authorization: `Bearer ${body.data.token}` })
        .send({ username: 'Store Admin', age: 30, password: 'changed-pass' });
      assert.equal(res.status, 200);
    });

    assert.equal((await runSeed()).code, 0);
    const product = await Product.findOne({ productId: SKU.earbuds });
    assert.equal(product.productPrice, 1);
    assert.equal(product.quantity, 3);
    assert.equal((await login({ emailId: ADMIN.emailId, password: 'changed-pass' })).status, 200);
  });

  it('restores only the product that went missing', async () => {
    await Product.deleteOne({ productId: 'B-02-202' });
    const { output } = await runSeed();
    assert.match(output, /Products added: 1/);
    assert.ok(await Product.exists({ productId: 'B-02-202' }));
  });

  it('replaces a reused SKU, keeps other products, and moves only the demo orders', async () => {
    const old = { productPrice: 2499, category: 'Wearables', quantity: 9, description: 'Old.', images: ['/products/W-01-111.svg'] };
    await Product.create({ ...old, productId: 'X-01-001', productName: 'Added on the Admin page' });
    await Product.updateOne({ productId: SKU.earbuds }, { source: 'old', productName: 'Halo ANC Earbuds', productPrice: 1, quantity: 3 });

    const demo = await User.findOne({ emailId: DEMO.emailId });
    await Order.updateOne({ user: demo._id, orderNo: 'BM-2041' }, {
      $set: { items: [{ productId: 'W-01-111', name: 'Pace Smartwatch', price: 2499, qty: 2, image: '/products/W-01-111.svg' }], subtotal: 4998, total: 4998 }
    });
    const stranger = await Order.create({ guest: { phone: '+919000000001' }, items: [{ productId: 'W-01-111', name: 'Pace Smartwatch', price: 2499, qty: 1 }], subtotal: 2499, total: 2499 });

    assert.equal((await runSeed()).code, 0);

    assert.ok(await Product.exists({ productId: 'X-01-001' }));
    const earbuds = products.find(({ productId }) => productId === SKU.earbuds);
    const reused = await Product.findOne({ productId: SKU.earbuds });
    assert.equal(reused.productName, earbuds.productName);
    assert.equal(reused.productPrice, earbuds.productPrice);
    assert.equal(reused.quantity, earbuds.quantity);

    const watch = products.find(({ productId }) => productId === 'W-01-101');
    const moved = await Order.findOne({ orderNo: 'BM-2041' }).lean();
    assert.equal(moved.items[0].productId, 'W-01-101');
    assert.equal(moved.total, watch.productPrice * 2);
    assert.equal((await Order.findById(stranger._id).lean()).items[0].productId, 'W-01-111');
    await Product.deleteOne({ productId: 'X-01-001' });
    await Order.deleteOne({ _id: stranger._id });
  });

  it('points every kit at SKUs that exist, and clears the old filters', async () => {
    await Kit.updateOne({ title: kits[0].title }, { $set: { query: { zone: 'D' } } });
    assert.equal((await runSeed()).code, 0);
    const skus = new Set(products.map(({ productId }) => productId));
    for (const kit of await Kit.find()) {
      assert.ok(kit.productIds.length >= 5, kit.title);
      assert.equal(kit.query, undefined);
      for (const sku of kit.productIds) assert.ok(skus.has(sku), sku);
    }
  });

  it('never leaves a pre-registered account with its own password as admin', async () => {
    const emailId = 'taken@bazaarmart.test';
    await request(app).post('/api/users').send({ username: 'Sneaky', emailId, age: 30, password: 'attacker-pass' });
    assert.equal((await runSeed({ SEED_ADMIN_EMAIL: emailId, SEED_ADMIN_PASSWORD: 'real-admin-pass' })).code, 0);
    assert.equal((await login({ emailId, password: 'attacker-pass' })).status, 401);
    const real = await login({ emailId, password: 'real-admin-pass' });
    assert.equal(real.body.data.user.role, 'admin');
  });

  it('skips the demo user when its settings are blank, and fails without admin settings', async () => {
    await User.deleteOne({ emailId: DEMO.emailId });
    const skipped = await runSeed({ SEED_DEMO_EMAIL: '', SEED_DEMO_PASSWORD: '' });
    assert.equal(skipped.code, 0);
    assert.match(skipped.output, /Demo user skipped/);
    assert.equal(await User.exists({ emailId: DEMO.emailId }), null);

    const failed = await runSeed({ SEED_ADMIN_EMAIL: '', SEED_ADMIN_PASSWORD: '' });
    assert.equal(failed.code, 1);
    assert.match(failed.output, /SEED_ADMIN_EMAIL/);
  });

  it('never writes a secret into the committed data file', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL('../data/catalogue.js', import.meta.url), 'utf8');
    assert.equal(/password/i.test(source), false);
  });
});
