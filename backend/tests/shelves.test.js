import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import Product from '../models/Product.js';
import Shelf from '../models/Shelf.js';
import User from '../models/User.js';

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
  await Promise.all([User.init(), Product.init(), Shelf.init()]);
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Shelf.deleteMany({})]);
  await Product.create({
    productId: 'A-01-117', productName: 'Halo Earbuds', productPrice: 1000, category: 'Audio',
    quantity: 5, description: 'Small.', images: ['a.jpg']
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
    assert.equal((await addItem(id, 'A-01-117', otherToken)).status, 403);
    assert.equal((await auth(request(app).delete(`/api/shelves/${id}/items/A-01-117`), otherToken)).status, 403);
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
    const res = await addItem(id, 'A-01-117');
    assert.equal(res.status, 201);
    const [item] = res.body.data.items;
    assert.equal(item.savedPrice, 1000);
    assert.equal(item.currentPrice, 1000);
    assert.equal(item.percentChange, 0);
    assert.equal(item.productName, 'Halo Earbuds');
  });

  it('reports a price drop and a price rise since saving', async () => {
    await addItem(id, 'A-01-117');
    await Product.updateOne({ productId: 'A-01-117' }, { productPrice: 880 });
    let [item] = (await auth(request(app).get('/api/shelves'))).body.data[0].items;
    assert.equal(item.currentPrice, 880);
    assert.equal(item.savedPrice, 1000);
    assert.equal(item.percentChange, -12);

    await Product.updateOne({ productId: 'A-01-117' }, { productPrice: 1250 });
    [item] = (await auth(request(app).get(`/api/shelves/${id}`))).body.data.items;
    assert.equal(item.percentChange, 25);
  });

  it('rejects a duplicate, an unknown product and a missing productId', async () => {
    await addItem(id, 'A-01-117');
    assert.equal((await addItem(id, 'A-01-117')).status, 409);
    assert.equal((await addItem(id, 'NOPE')).status, 404);
    assert.equal((await addItem(id, undefined)).status, 400);
  });

  it('removes an item, and returns 404 if it is not there', async () => {
    await addItem(id, 'A-01-117');
    assert.equal((await auth(request(app).delete(`/api/shelves/${id}/items/A-01-117`))).status, 204);
    assert.equal((await auth(request(app).delete(`/api/shelves/${id}/items/A-01-117`))).status, 404);
  });

  it('keeps a deleted product on the shelf, marked unavailable', async () => {
    await addItem(id, 'A-01-117');
    await Product.deleteOne({ productId: 'A-01-117' });
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
