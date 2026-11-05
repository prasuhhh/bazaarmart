// One test per line of the acceptance checklists in CONTEXT.md section 11 (C) and
// DESIGN.md section 11 (D). Lines that only a browser can prove say so in the audit.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import Counter from '../models/Counter.js';
import Order from '../models/Order.js';
import Otp from '../models/Otp.js';
import Product from '../models/Product.js';
import Shelf from '../models/Shelf.js';
import User from '../models/User.js';
import Zone from '../models/Zone.js';
import { SKU } from './fixtures/skus.js';

process.env.JWT_SECRET = 'test-secret';
process.env.OTP_MOCK = 'true';

const app = createApp({ authRateLimit: 100000, otpRateLimit: 100000 });
const phone = '+919876543210';
const asha = { username: 'Asha', emailId: 'asha@example.com', age: 21, password: 'secret1' };
const ravi = { username: 'Ravi', emailId: 'ravi@example.com', age: 22, password: 'secret2' };
const lamp = { productId: 'L-01-900', productName: 'Test Lamp', productPrice: 899, category: 'Living', quantity: 5, description: 'A lamp.' };
const details = {
  address: { name: 'Asha', phone: '9876543210', line1: '221B Lake Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
  slot: { label: 'Tomorrow' },
  payment: { method: 'upi' }
};
const line = (productId = SKU.earbuds, qty = 1) => ({ productId, qty });

let mongo;
let token;
let otherToken;
let adminToken;

const api = (method, path, value) => {
  const req = request(app)[method](`/api${path}`);
  return value ? req.set({ Authorization: `Bearer ${value}` }) : req;
};
const signIn = async ({ emailId, password }) =>
  (await api('post', '/login').send({ emailId, password })).body.data.token;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'bazaarmart_acceptance_test' });
  await Promise.all([User.init(), Product.init(), Order.init(), Shelf.init()]);
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([User, Product, Order, Counter, Shelf, Otp, Zone].map(model => model.deleteMany({})));
  await api('post', '/users').send(asha);
  await api('post', '/users').send(ravi);
  await User.create({ username: 'Admin', emailId: 'admin@example.com', age: 30, password: 'adminpass', role: 'admin' });
  token = await signIn(asha);
  otherToken = await signIn(ravi);
  adminToken = await signIn({ emailId: 'admin@example.com', password: 'adminpass' });

  await Zone.create([{ code: 'A', name: 'Audio', order: 1 }, { code: 'W', name: 'Wearables', order: 2 }]);
  const base = { description: 'Small.', images: ['/products/a.webp'], arrivesInDays: 2 };
  await Product.create([
    { ...base, productId: SKU.earbuds, productName: 'Halo ANC Earbuds', productPrice: 3499, category: 'Audio', zoneCode: 'A', bay: 1, bayName: 'Earbuds', quantity: 50, brand: 'Kora', colours: ['Black', 'Sand'], use: ['commute'], connectivity: 'wireless' },
    { ...base, productId: 'A-01-118', productName: 'Wired Earphones', productPrice: 999, category: 'Audio', zoneCode: 'A', bay: 1, bayName: 'Earbuds', quantity: 40, brand: 'Tessera', colours: ['Black'], use: ['studio'], connectivity: 'wired' },
    { ...base, productId: 'W-01-101', productName: 'Pace Smartwatch', productPrice: 2499, category: 'Wearables', zoneCode: 'W', bay: 1, bayName: 'Watches', quantity: 90, brand: 'Orbit', colours: ['Olive'], use: ['gym'] }
  ]);
});

describe('CONTEXT.md section 11', () => {
  it('C1 duplicate email on register gives 409 "Email ID is already registered"', async () => {
    const res = await api('post', '/users').send(asha);
    assert.equal(res.status, 409);
    assert.match(res.body.message, /Email ID is already registered/);
  });

  it('C2 unknown email on login gives 404, wrong password gives 401', async () => {
    assert.equal((await api('post', '/login').send({ emailId: 'no@example.com', password: 'secret1' })).status, 404);
    assert.equal((await api('post', '/login').send({ emailId: asha.emailId, password: 'wrong-one' })).status, 401);
  });

  it('C3 with REQUIRE_AUTH_FOR_CATALOGUE=true, products need a valid JWT; bad or expired gives 401', async () => {
    process.env.REQUIRE_AUTH_FOR_CATALOGUE = 'true';
    try {
      const expired = jwt.sign({ userId: new mongoose.Types.ObjectId() }, process.env.JWT_SECRET, { expiresIn: -10 });
      assert.equal((await api('get', '/products')).status, 401);
      assert.equal((await api('get', '/products', 'not-a-token')).status, 401);
      assert.equal((await api('get', '/products', expired)).status, 401);
      assert.equal((await api('get', '/products/audio')).status, 401);
      assert.equal((await api('get', '/products', token)).status, 200);
    } finally {
      delete process.env.REQUIRE_AUTH_FOR_CATALOGUE;
    }
    assert.equal((await api('get', '/products')).status, 200);
  });

  it('C4 profile PUT, PATCH and DELETE work on your own account and give 403 on anyone else', async () => {
    const mine = `/users?emailId=${asha.emailId}`;
    const theirs = `/users?emailId=${ravi.emailId}`;
    const full = { username: 'Asha Rao', age: 25, password: 'secret9' };

    assert.equal((await api('put', theirs, token).send(full)).status, 403);
    assert.equal((await api('patch', theirs, token).send({ age: 30 })).status, 403);
    assert.equal((await api('delete', theirs, token)).status, 403);

    const put = await api('put', mine, token).send(full);
    assert.equal(put.status, 200);
    assert.equal(put.body.data.username, 'Asha Rao');
    const patch = await api('patch', mine, token).send({ age: 26 });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.data.age, 26);
    assert.equal(patch.body.data.username, 'Asha Rao');
    assert.equal((await api('delete', mine, token)).status, 204);
    assert.equal(await User.countDocuments({ emailId: ravi.emailId }), 1);
    assert.equal(await User.countDocuments({ emailId: asha.emailId }), 0);
  });

  it('C5 products: POST 201, GET 200 with count, category 200/404, PUT 200/404, DELETE 204/404', async () => {
    assert.equal((await api('post', '/products', adminToken).send(lamp)).status, 201);
    const list = await api('get', '/products');
    assert.equal(list.status, 200);
    assert.equal(list.body.count, 4);
    assert.deepEqual(list.body.data.map(product => product.productId), [SKU.earbuds, 'A-01-118', 'L-01-900', 'W-01-101']);
    const category = await api('get', '/products/LIVING');
    assert.equal(category.status, 200);
    assert.equal(category.body.count, 1);
    assert.equal((await api('get', '/products/nothing-here')).status, 404);
    const put = await api('put', `/products?productId=${lamp.productId}`, adminToken).send({ productPrice: 999 });
    assert.equal(put.status, 200);
    assert.equal(put.body.data.productPrice, 999);
    assert.equal((await api('put', '/products?productId=NOPE', adminToken).send({ productPrice: 1 })).status, 404);
    assert.equal((await api('delete', `/products?productId=${lamp.productId}`, adminToken)).status, 204);
    assert.equal((await api('delete', `/products?productId=${lamp.productId}`, adminToken)).status, 404);
  });

  it('C6 duplicate productId gives 409; missing productId query gives 400; invalid body gives 400', async () => {
    await api('post', '/products', adminToken).send(lamp);
    assert.equal((await api('post', '/products', adminToken).send(lamp)).status, 409);
    assert.equal((await api('put', '/products', adminToken).send({ productPrice: 1 })).status, 400);
    assert.equal((await api('delete', '/products', adminToken)).status, 400);
    assert.equal((await api('post', '/products', adminToken).send({ ...lamp, productId: 'X', productPrice: -1 })).status, 400);
    assert.equal((await api('post', '/products', adminToken).send({ productId: 'Y' })).status, 400);
    assert.equal((await api('put', '/products?productId=L-01-900', adminToken).send({ quantity: -1 })).status, 400);
  });

  it('C7 a non-admin cannot create, update or delete products', async () => {
    assert.equal((await api('post', '/products', token).send(lamp)).status, 403);
    assert.equal((await api('put', `/products?productId=${SKU.earbuds}`, token).send({ productPrice: 1 })).status, 403);
    assert.equal((await api('delete', `/products?productId=${SKU.earbuds}`, token)).status, 403);
    assert.equal((await Product.findOne({ productId: SKU.earbuds })).productPrice, 3499);
  });

  it('C8 no secrets are tracked: no .env file and no connection string with a password', () => {
    const root = new URL('../..', import.meta.url).pathname;
    const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
    assert.deepEqual(files.filter(file => /(^|\/)\.env(\.(?!example$).*)?$/.test(file)), []);
    const textFiles = files.filter(file => /\.(js|jsx|json|md|sh|example|yml|yaml)$/.test(file) && !file.endsWith('package-lock.json'));
    for (const file of textFiles) {
      assert.doesNotMatch(readFileSync(`${root}${file}`, 'utf8'), /mongodb(\+srv)?:\/\/[^\s:'"]+:[^\s@'"]+@(?!cluster\.example)/, file);
    }
    const envExample = readFileSync(`${root}backend/.env.example`, 'utf8');
    assert.match(envExample, /^MONGO_URI=$/m);
    assert.match(envExample, /^JWT_SECRET=$/m);
  });
});

describe('DESIGN.md section 11', () => {
  it('D2 GO TO: a SKU finds that product, and a word lists matches', async () => {
    const sku = await api('get', `/search?q=${SKU.earbuds.toLowerCase()}`);
    assert.equal(sku.body.data[0].productId, SKU.earbuds);
    const word = await api('get', '/search?q=earbuds');
    assert.equal(word.status, 200);
    assert.ok(word.body.data.some(product => product.productId === SKU.earbuds));
  });

  it('D3 zones report total stock for the tiles, and the first bay is available for the peek panel', async () => {
    const { body } = await api('get', '/zones');
    const audio = body.data.find(zone => zone.code === 'A');
    assert.equal(audio.totalStock, 90);
    assert.equal(audio.bays[0].bay, 1);
    const peek = await api('get', `/products?zone=A&bay=${audio.bays[0].bay}&limit=9`);
    assert.equal(peek.body.count, 2);
  });

  it('D4 price, wired or wireless, use, brand and colour each change the results', async () => {
    const skus = async query => (await api('get', `/products?zone=A&${query}`)).body.data.map(product => product.productId);
    assert.deepEqual(await skus('maxPrice=1000'), ['A-01-118']);
    assert.deepEqual(await skus('minPrice=1000'), [SKU.earbuds]);
    assert.deepEqual(await skus('connectivity=wireless'), [SKU.earbuds]);
    assert.deepEqual(await skus('use=studio'), ['A-01-118']);
    assert.deepEqual(await skus('brand=kora'), [SKU.earbuds]);
    assert.deepEqual(await skus('colour=Sand'), [SKU.earbuds]);
  });

  it('D6 a guest can check out, a member sees their order, and totals come from the server', async () => {
    const stock = (await Product.findOne({ productId: SKU.earbuds })).quantity;
    const guest = await api('post', '/orders').send({
      items: [{ ...line(), price: 1 }],
      total: 1,
      subtotal: 1,
      ...details,
      guest: { name: 'Guest', phone: '9876543210' }
    });
    assert.equal(guest.status, 201);
    assert.equal(guest.body.data.items[0].price, 3499);
    assert.equal(guest.body.data.total, 3499);
    assert.equal(guest.body.data.user, null);
    assert.equal((await Product.findOne({ productId: SKU.earbuds })).quantity, stock - 1);

    const member = await api('post', '/orders', token).send({ items: [line('A-01-118')], ...details });
    assert.equal(member.status, 201);
    const mine = await api('get', '/orders', token);
    assert.deepEqual(mine.body.data.map(order => order.orderNo), [member.body.data.orderNo]);
    assert.equal(member.body.data.total, 999); // free delivery starts at ₹999
  });

  it('D7 an admin status change shows in Orders, the live count and Track', async () => {
    const { orderNo } = (await api('post', '/orders', token).send({ items: [line()], ...details })).body.data;
    const live = async () => (await api('get', '/orders?status=live', token)).body.count;
    assert.equal(await live(), 1);

    for (const status of ['packed', 'shipped', 'out_for_delivery']) {
      assert.equal((await api('patch', `/admin/orders/${orderNo}/status`, adminToken).send({ status })).status, 200);
      const [order] = (await api('get', '/orders', token)).body.data;
      assert.equal(order.status, status);
      const track = await api('get', `/orders/${orderNo}/track`, token);
      assert.equal(track.body.data.status, status);
      assert.equal(track.body.data.events.at(-1).status, status);
    }
    const out = await api('get', `/orders/${orderNo}/track`, token);
    assert.match(out.body.data.deliveryOtp, /^\d{4}$/);

    await api('patch', `/admin/orders/${orderNo}/status`, adminToken).send({ status: 'delivered' });
    assert.equal(await live(), 0);
    assert.equal((await api('get', '/orders?status=delivered', token)).body.count, 1);
  });

  it('D8 OTP signs in with the mock code; a wrong code gives 401 and an expired one 400', async () => {
    const sent = await api('post', '/auth/otp/request').send({ phone });
    assert.equal(sent.status, 200);
    const code = sent.body.data.devCode;
    const wrong = code === '000000' ? '000001' : '000000';
    assert.equal((await api('post', '/auth/otp/verify').send({ phone, code: wrong })).status, 401);
    const verified = await api('post', '/auth/otp/verify').send({ phone, code });
    assert.equal(verified.status, 200);
    assert.ok(verified.body.data.token);

    const again = await api('post', '/auth/otp/request').send({ phone });
    await Otp.updateOne({ phone }, { expiresAt: new Date(Date.now() - 1000) });
    const expired = await api('post', '/auth/otp/verify').send({ phone, code: again.body.data.devCode });
    assert.equal(expired.status, 400);
    assert.match(expired.body.message, /expired/);
  });

  it('D9 shelves: create, price-drop watch, details to move to a receipt, and a public share link', async () => {
    const shelf = (await api('post', '/shelves', token).send({ name: 'New desk' })).body.data;
    await api('post', `/shelves/${shelf._id}/items`, token).send({ productId: SKU.earbuds });
    await api('put', `/products?productId=${SKU.earbuds}`, adminToken).send({ productPrice: 3079 });

    const [saved] = (await api('get', '/shelves', token)).body.data;
    const [item] = saved.items;
    assert.equal(item.percentChange, -12);
    assert.equal(item.currentPrice, 3079);
    assert.equal(item.stock, 50);
    assert.deepEqual(item.colours, ['Black', 'Sand']);

    const shared = await api('get', `/shelves/shared/${shelf.shareId}`);
    assert.equal(shared.status, 200);
    assert.equal(shared.body.data.items[0].productId, SKU.earbuds);
    assert.doesNotMatch(shared.text, /asha|"user"/i);
  });

  it('D12 shelf checkout: current prices and stock, and one order for all checked lines', async () => {
    const shelf = (await api('post', '/shelves', token).send({ name: 'Trip kit' })).body.data;
    await api('post', `/shelves/${shelf._id}/items`, token).send({ productId: SKU.earbuds });
    await api('put', `/products?productId=${SKU.earbuds}`, adminToken).send({ productPrice: 3079 });

    const { body } = await api('get', `/shelves/${shelf._id}/checkout`, token);
    assert.equal(body.data.shelfName, 'Trip kit');
    assert.equal(body.data.lines[0].price, 3079);
    assert.equal(body.data.lines[0].inStock, true);

    const placed = await api('post', '/orders', token).send({
      ...details, items: [line(SKU.earbuds, 3)], source: { type: 'shelf', shelfId: shelf._id }
    });
    assert.equal(placed.status, 201);
    assert.equal(placed.body.data.total, 3079 * 3);
    assert.match(placed.body.message, /placed from shelf Trip kit/);
    assert.equal((await api('get', '/orders', token)).body.count, 1);
  });

  it('D14 shared shelf checkout works as a guest; other shelves give 403 and unknown ones 404', async () => {
    const shelf = (await api('post', '/shelves', token).send({ name: 'Trip kit' })).body.data;
    await api('post', `/shelves/${shelf._id}/items`, token).send({ productId: SKU.earbuds });

    assert.equal((await api('get', `/shelves/shared/${shelf.shareId}/checkout`)).status, 200);
    const placed = await api('post', '/orders').send({
      ...details, guest: { name: 'Friend', phone }, items: [line()], source: { type: 'shelf', shareId: shelf.shareId }
    });
    assert.equal(placed.status, 201);

    assert.equal((await api('get', `/shelves/${shelf._id}/checkout`, otherToken)).status, 403);
    assert.equal((await api('get', '/shelves/64b000000000000000000000/checkout', token)).status, 404);
  });

  it('D15 a shelf order rejects stray items (400) and other shelves (403); removal takes only the ordered items', async () => {
    const shelf = (await api('post', '/shelves', token).send({ name: 'Trip kit' })).body.data;
    await api('post', `/shelves/${shelf._id}/items`, token).send({ productId: SKU.earbuds });
    await api('post', `/shelves/${shelf._id}/items`, token).send({ productId: 'A-01-118' });
    const source = { type: 'shelf', shelfId: shelf._id };

    assert.equal((await api('post', '/orders', otherToken).send({ ...details, items: [line()], source })).status, 403);

    await api('delete', `/shelves/${shelf._id}/items/A-01-118`, token);
    const stray = await api('post', '/orders', token).send({ ...details, items: [line('A-01-118')], source });
    assert.equal(stray.status, 400);

    await api('post', `/shelves/${shelf._id}/items`, token).send({ productId: 'A-01-118' });
    const placed = await api('post', '/orders', token).send({ ...details, items: [line()], source, removeFromShelf: true });
    assert.equal(placed.status, 201);
    const after = (await api('get', `/shelves/${shelf._id}`, token)).body.data;
    assert.deepEqual(after.items.map(item => item.productId), ['A-01-118']);
  });

  it('D10 profile: addresses CRUD, preference toggles, and 403 on another account', async () => {
    const address = { label: 'Home', ...details.address };
    const made = await api('post', '/users/me/addresses', token).send(address);
    assert.equal(made.status, 201);
    const { _id: id } = made.body.data;
    assert.equal((await api('get', '/users/me/addresses', token)).body.count, 1);
    const edited = await api('put', `/users/me/addresses/${id}`, token).send({ city: 'Madurai' });
    assert.equal(edited.body.data.city, 'Madurai');
    assert.equal((await api('delete', `/users/me/addresses/${id}`, token)).status, 204);
    assert.equal((await api('get', '/users/me/addresses', token)).body.count, 0);

    const prefs = await api('patch', '/users/me/prefs', token).send({ notificationPrefs: { priceDrops: false } });
    assert.equal(prefs.body.data.notificationPrefs.priceDrops, false);
    assert.equal(prefs.body.data.notificationPrefs.orderUpdates, true);

    assert.equal((await api('patch', `/users?emailId=${ravi.emailId}`, token).send({ age: 40 })).status, 403);
    assert.equal((await api('patch', `/users?emailId=${asha.emailId}`, otherToken).send({ age: 40 })).status, 403);
  });
});
