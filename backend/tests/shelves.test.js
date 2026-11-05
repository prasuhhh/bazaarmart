import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Shelf from '../models/Shelf.js';
import User from '../models/User.js';
import { SKU } from './fixtures/skus.js';

process.env.JWT_SECRET = 'test-secret';

const app = createApp({ authRateLimit: 100000 });
let mongo;
let token;
let otherToken;

const auth = (req, value = token) => req.set({ Authorization: `Bearer ${value}` });
const newShelf = (name = 'New desk', value = token) => auth(request(app).post('/api/shelves'), value).send({ name });
const addItem = (id, productId, value = token) => auth(request(app).post(`/api/shelves/${id}/items`), value).send({ productId });

async function signIn(emailId) {
  await User.create({ username: 'Shopper', emailId, age: 21, password: 'secret123' });
  const res = await request(app).post('/api/login').send({ emailId, password: 'secret123' });
  return res.body.data.token;
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'bazaarmart_shelves_test' });
  await Promise.all([User.init(), Product.init(), Shelf.init(), Order.init()]);
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Shelf.deleteMany({}), Order.deleteMany({})]);
  await Product.create({
    productId: SKU.earbuds, productName: 'Halo Earbuds', productPrice: 1000, category: 'Audio',
    quantity: 5, description: 'Small.', images: ['/products/a.webp']
  });
  await Product.create({ productId: 'D-01-101', productName: 'Mouse', productPrice: 500, category: 'Desk setup', quantity: 5, description: 'Small.' });
  token = await signIn('asha@example.com');
  otherToken = await signIn('ravi@example.com');
});

describe('shelves', () => {
  it('creates, lists, renames and deletes own shelves', async () => {
    const created = await newShelf();
    assert.equal(created.status, 201);
    const { _id: id, shareId } = created.body.data;
    assert.ok(shareId);

    const list = await auth(request(app).get('/api/shelves'));
    assert.equal(list.body.count, 1);

    const renamed = await auth(request(app).patch(`/api/shelves/${id}`)).send({ name: 'Trip kit' });
    assert.equal(renamed.body.data.name, 'Trip kit');
    assert.equal((await auth(request(app).get(`/api/shelves/${id}`))).body.data.name, 'Trip kit');

    assert.equal((await auth(request(app).delete(`/api/shelves/${id}`))).status, 204);
    assert.equal((await auth(request(app).get(`/api/shelves/${id}`))).status, 404);
  });

  it('rejects a missing name and needs a login', async () => {
    assert.equal((await auth(request(app).post('/api/shelves')).send({})).status, 400);
    assert.equal((await request(app).get('/api/shelves')).status, 401);
  });

  it('lists only your own shelves', async () => {
    await newShelf('Mine');
    await newShelf('Theirs', otherToken);
    const res = await auth(request(app).get('/api/shelves'));
    assert.deepEqual(res.body.data.map(shelf => shelf.name), ['Mine']);
  });

  it('returns 403 for another user\'s shelf on every action', async () => {
    const { body } = await newShelf();
    const id = body.data._id;
    assert.equal((await auth(request(app).get(`/api/shelves/${id}`), otherToken)).status, 403);
    assert.equal((await auth(request(app).patch(`/api/shelves/${id}`), otherToken).send({ name: 'X' })).status, 403);
    assert.equal((await auth(request(app).delete(`/api/shelves/${id}`), otherToken)).status, 403);
    assert.equal((await addItem(id, SKU.earbuds, otherToken)).status, 403);
    assert.equal((await auth(request(app).delete(`/api/shelves/${id}/items/${SKU.earbuds}`), otherToken)).status, 403);
  });

  it('returns 404 for an unknown shelf and 400 for a malformed id', async () => {
    assert.equal((await auth(request(app).get(`/api/shelves/${new mongoose.Types.ObjectId()}`))).status, 404);
    assert.equal((await auth(request(app).get('/api/shelves/not-an-id'))).status, 400);
  });
});

describe('shelf items', () => {
  let id;

  beforeEach(async () => {
    id = (await newShelf()).body.data._id;
  });

  it('stores the price at the moment of saving', async () => {
    const res = await addItem(id, SKU.earbuds);
    assert.equal(res.status, 201);
    const [item] = res.body.data.items;
    assert.equal(item.savedPrice, 1000);
    assert.equal(item.currentPrice, 1000);
    assert.equal(item.percentChange, 0);
    assert.equal(item.productName, 'Halo Earbuds');
  });

  it('reports a price drop and a price rise since saving', async () => {
    await addItem(id, SKU.earbuds);
    await Product.updateOne({ productId: SKU.earbuds }, { productPrice: 880 });
    let [item] = (await auth(request(app).get('/api/shelves'))).body.data[0].items;
    assert.equal(item.currentPrice, 880);
    assert.equal(item.savedPrice, 1000);
    assert.equal(item.percentChange, -12);

    await Product.updateOne({ productId: SKU.earbuds }, { productPrice: 1250 });
    [item] = (await auth(request(app).get(`/api/shelves/${id}`))).body.data.items;
    assert.equal(item.percentChange, 25);
  });

  it('rejects a duplicate, an unknown product and a missing productId', async () => {
    await addItem(id, SKU.earbuds);
    assert.equal((await addItem(id, SKU.earbuds)).status, 409);
    assert.equal((await addItem(id, 'NOPE')).status, 404);
    assert.equal((await addItem(id, undefined)).status, 400);
  });

  it('removes an item, and returns 404 if it is not there', async () => {
    await addItem(id, SKU.earbuds);
    assert.equal((await auth(request(app).delete(`/api/shelves/${id}/items/${SKU.earbuds}`))).status, 204);
    assert.equal((await auth(request(app).delete(`/api/shelves/${id}/items/${SKU.earbuds}`))).status, 404);
  });

  it('keeps a deleted product on the shelf, marked unavailable', async () => {
    await addItem(id, SKU.earbuds);
    await Product.deleteOne({ productId: SKU.earbuds });
    const [item] = (await auth(request(app).get(`/api/shelves/${id}`))).body.data.items;
    assert.equal(item.available, false);
    assert.equal(item.savedPrice, 1000);
  });
});

describe('shared shelves', () => {
  it('is public, with live prices and no owner details', async () => {
    const { body } = await newShelf('Birthday ideas');
    await addItem(body.data._id, 'D-01-101');
    await Product.updateOne({ productId: 'D-01-101' }, { productPrice: 440 });

    const res = await request(app).get(`/api/shelves/shared/${body.data.shareId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.name, 'Birthday ideas');
    assert.equal(res.body.data.items[0].percentChange, -12);
    assert.equal(res.body.data.user, undefined);
    assert.equal(res.body.data._id, undefined);
    assert.equal(JSON.stringify(res.body).includes('asha@example.com'), false);
  });

  it('returns 404 for an unknown link', async () => {
    assert.equal((await request(app).get('/api/shelves/shared/nope')).status, 404);
  });
});

describe('shelf checkout lines', () => {
  async function fullShelf() {
    const { _id: id, shareId } = (await newShelf('Trip kit')).body.data;
    await addItem(id, SKU.earbuds);
    await addItem(id, 'D-01-101');
    return { id, shareId };
  }

  it('gives the owner current prices, stock and an inStock flag', async () => {
    const { id } = await fullShelf();
    await Product.updateOne({ productId: SKU.earbuds }, { productPrice: 880 });
    await Product.updateOne({ productId: 'D-01-101' }, { quantity: 0 });

    const res = await auth(request(app).get(`/api/shelves/${id}/checkout`));
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 2);
    assert.equal(res.body.data.shelfName, 'Trip kit');
    assert.deepEqual(res.body.data.lines[0], {
      productId: SKU.earbuds, name: 'Halo Earbuds', image: '/products/a.webp', price: 880, stock: 5, inStock: true
    });
    assert.equal(res.body.data.lines[1].inStock, false);
  });

  it('leaves out a deleted product', async () => {
    const { id } = await fullShelf();
    await Product.deleteOne({ productId: 'D-01-101' });
    const { body } = await auth(request(app).get(`/api/shelves/${id}/checkout`));
    assert.deepEqual(body.data.lines.map(line => line.productId), [SKU.earbuds]);
  });

  it('is 401 logged out, 403 for another user, 404 unknown, 400 malformed', async () => {
    const { id } = await fullShelf();
    assert.equal((await request(app).get(`/api/shelves/${id}/checkout`)).status, 401);
    assert.equal((await auth(request(app).get(`/api/shelves/${id}/checkout`), otherToken)).status, 403);
    assert.equal((await auth(request(app).get('/api/shelves/64b000000000000000000000/checkout'))).status, 404);
    assert.equal((await auth(request(app).get('/api/shelves/nope/checkout'))).status, 400);
  });

  it('is public through the share link, with no owner details', async () => {
    const { shareId } = await fullShelf();
    const res = await request(app).get(`/api/shelves/shared/${shareId}/checkout`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.lines.length, 2);
    assert.doesNotMatch(res.text, /asha|"user"/i);
    assert.equal((await request(app).get('/api/shelves/shared/nope/checkout')).status, 404);
  });
});

describe('orders from a shelf', () => {
  const delivery = {
    address: { name: 'Asha', phone: '9876543210', line1: '221B Lake Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
    slot: { label: 'Tomorrow' },
    payment: { method: 'cod' }
  };
  const guest = { name: 'Friend', phone: '9876543210' };
  const lines = (...skus) => skus.map(productId => ({ productId, qty: 2 }));
  const order = (body, value = token) => auth(request(app).post('/api/orders'), value).send({ ...delivery, ...body });
  const stock = async productId => (await Product.findOne({ productId })).quantity;
  const skusOn = async id => (await Shelf.findById(id)).items.map(item => item.product);
  let id;
  let shareId;

  beforeEach(async () => {
    ({ _id: id, shareId } = (await newShelf('Trip kit')).body.data);
    await addItem(id, SKU.earbuds);
    await addItem(id, 'D-01-101');
  });

  it('places one order for the shelf at current prices and records where it came from', async () => {
    await Product.updateOne({ productId: SKU.earbuds }, { productPrice: 800 });
    const res = await order({ items: lines(SKU.earbuds, 'D-01-101'), source: { type: 'shelf', shelfId: id } });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, `Order #${res.body.data.orderNo} placed from shelf Trip kit.`);
    assert.equal(res.body.data.subtotal, 800 * 2 + 500 * 2);
    assert.equal(res.body.data.source.type, 'shelf');
    assert.equal(res.body.data.source.shelfId, id);
    assert.equal(res.body.data.source.shelfName, 'Trip kit');
    assert.equal(await stock(SKU.earbuds), 3);
    assert.deepEqual(await skusOn(id), [SKU.earbuds, 'D-01-101']);
  });

  it('defaults to a receipt order', async () => {
    const res = await order({ items: lines(SKU.earbuds) });
    assert.equal(res.body.data.source.type, 'receipt');
    assert.equal(res.body.message, `Order #${res.body.data.orderNo} placed.`);
  });

  it('removes only the ordered items when asked', async () => {
    const res = await order({ items: lines(SKU.earbuds), source: { type: 'shelf', shelfId: id }, removeFromShelf: true });
    assert.equal(res.status, 201);
    assert.deepEqual(await skusOn(id), ['D-01-101']);
  });

  it('lets a guest order through a share link, keeping the owner out of it', async () => {
    const res = await request(app).post('/api/orders').send({
      ...delivery, guest, items: lines('D-01-101'), source: { type: 'shelf', shareId }
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.source.shareId, shareId);
    assert.equal(res.body.data.source.shelfId, undefined);
    assert.equal(res.body.data.user, null);
  });

  it('lets another signed-in user order through a share link', async () => {
    const res = await order({ items: lines('D-01-101'), source: { type: 'shelf', shareId } }, otherToken);
    assert.equal(res.status, 201);
  });

  it('rejects an item that is not on the shelf, before touching stock', async () => {
    await Product.create({ productId: 'X-01-100', productName: 'Extra', productPrice: 10, category: 'Audio', quantity: 5, description: 'Stray.' });
    const res = await order({ items: lines(SKU.earbuds, 'X-01-100'), source: { type: 'shelf', shelfId: id } });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /X-01-100/);
    assert.equal(await stock(SKU.earbuds), 5);
    assert.equal(await Order.countDocuments(), 0);
  });

  it("rejects another user's shelf with 403, and a logged-out shelfId with 401", async () => {
    const source = { type: 'shelf', shelfId: id };
    assert.equal((await order({ items: lines(SKU.earbuds), source }, otherToken)).status, 403);
    const guestRes = await request(app).post('/api/orders').send({ ...delivery, guest, items: lines(SKU.earbuds), source });
    assert.equal(guestRes.status, 401);
    assert.equal(await Order.countDocuments(), 0);
  });

  it('returns 404 for a shelf or link that is gone, and 400 for a bad source', async () => {
    const items = lines(SKU.earbuds);
    assert.equal((await order({ items, source: { type: 'shelf', shelfId: '64b000000000000000000000' } })).status, 404);
    assert.equal((await order({ items, source: { type: 'shelf', shareId: 'nope' } })).status, 404);
    assert.equal((await order({ items, source: { type: 'shelf', shelfId: 'nope' } })).status, 400);
    assert.equal((await order({ items, source: { type: 'shelf' } })).status, 400);
    assert.equal((await order({ items, source: { type: 'shelf', shelfId: id, shareId } })).status, 400);
    assert.equal((await order({ items, source: { type: 'shelf', shareId: { $ne: null } } })).status, 400);
    assert.equal((await order({ items, source: { type: 'wishlist' } })).status, 400);
    assert.equal((await order({ items, removeFromShelf: true })).status, 400);
  });

  it('only lets the owner remove items, even through a share link', async () => {
    const items = lines(SKU.earbuds);
    const source = { type: 'shelf', shareId };
    assert.equal((await order({ items, source, removeFromShelf: true }, otherToken)).status, 403);
    const guestRes = await request(app).post('/api/orders').send({ ...delivery, guest, items, source, removeFromShelf: true });
    assert.equal(guestRes.status, 403);
    assert.equal(await Order.countDocuments(), 0);
    assert.equal((await order({ items, source, removeFromShelf: true })).status, 201);
    assert.deepEqual(await skusOn(id), ['D-01-101']);
  });

  it('keeps the shelf when the order fails on stock', async () => {
    await Product.updateOne({ productId: 'D-01-101' }, { quantity: 1 });
    const res = await order({ items: lines(SKU.earbuds, 'D-01-101'), source: { type: 'shelf', shelfId: id }, removeFromShelf: true });
    assert.equal(res.status, 409);
    assert.equal(await stock(SKU.earbuds), 5);
    assert.deepEqual(await skusOn(id), [SKU.earbuds, 'D-01-101']);
  });
});
