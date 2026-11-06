import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import Kit from '../models/Kit.js';
import Product from '../models/Product.js';
import Question from '../models/Question.js';
import Review from '../models/Review.js';
import User from '../models/User.js';
import Zone from '../models/Zone.js';
import { SKU } from './fixtures/skus.js';

process.env.JWT_SECRET = 'test-secret';

const app = createApp({ authRateLimit: 100000 });
const base = { description: 'A product.', quantity: 5 };
const products = [
  { ...base, productId: SKU.earbuds, productName: 'Pulse Earbuds', productPrice: 1999, category: 'Audio', zoneCode: 'A', bay: 1, bayName: 'Earbuds', brand: 'Noise', colours: ['Black', 'Sand'], use: ['gym', 'commute'], connectivity: 'wireless', isNewDrop: true },
  { ...base, productId: 'A-01-118', productName: 'Studio Earbuds', productPrice: 3499, category: 'Audio', zoneCode: 'A', bay: 1, bayName: 'Earbuds', brand: 'Sony', colours: ['Black'], use: ['studio'], connectivity: 'wired', quantity: 2 },
  { ...base, productId: 'A-02-001', productName: 'Arc Headphones', productPrice: 7999, category: 'Audio', zoneCode: 'A', bay: 2, bayName: 'Headphones', brand: 'Sony', colours: ['Olive'], use: ['commute'], connectivity: 'wireless' },
  { ...base, productId: 'A-03-001', productName: 'Mini Speaker', productPrice: 2599, category: 'Audio', zoneCode: 'A', bay: 3, bayName: 'Speakers', brand: 'JBL', connectivity: 'wireless' },
  { ...base, productId: 'A-03-002', productName: 'Tower Speaker', productPrice: 9999, category: 'Audio', zoneCode: 'A', bay: 3, bayName: 'Speakers', brand: 'JBL', connectivity: 'wired' },
  { ...base, productId: SKU.shirt, productName: 'Linen Shirt', productPrice: 1499, category: 'Style', zoneCode: 'S', bay: 3, bayName: 'Shirts', brand: 'Fabindia', colours: ['Sand'], isNewDrop: true },
  { ...base, productId: 'P001', productName: 'Notebook', productPrice: 120, category: 'Stationery' }
];
const newProduct = { productId: 'D-01-001', productName: 'Desk Lamp', productPrice: 899, category: 'Desk setup', quantity: 5, description: 'Warm light.' };

let mongo;
let userToken;
let adminToken;

const auth = (req, token = userToken) => req.set({ Authorization: `Bearer ${token}` });
const ids = res => res.body.data.map(product => product.productId);
const list = query => request(app).get('/api/products').query(query);

async function signIn(emailId) {
  const res = await request(app).post('/api/login').send({ emailId, password: 'secret123' });
  return res.body.data.token;
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'bazaarmart_catalogue_test' });
  await Promise.all([User.init(), Product.init(), Review.init(), Zone.init()]);
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([User, Product, Review, Question, Zone, Kit].map(model => model.deleteMany({})));
  await Product.insertMany(products);
  await User.create([
    { username: 'Asha', emailId: 'asha@example.com', age: 21, password: 'secret123' },
    { username: 'Ravi', emailId: 'ravi@example.com', age: 22, password: 'secret123', role: 'admin' }
  ]);
  userToken = await signIn('asha@example.com');
  adminToken = await signIn('ravi@example.com');
});

describe('GET /api/products', () => {
  it('is public, sorted by productId, with count', async () => {
    const res = await list({});
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 7);
    assert.deepEqual(ids(res), [...ids(res)].sort());
  });

  it('filters by zone and bay', async () => {
    assert.equal((await list({ zone: 'a' })).body.count, 5);
    assert.deepEqual(ids(await list({ zone: 'A', bay: 2 })), ['A-02-001']);
  });

  it('filters by price range', async () => {
    assert.deepEqual(ids(await list({ minPrice: 3000, maxPrice: 8000 })), ['A-01-118', 'A-02-001']);
  });

  it('filters by a comma list of brands, case-insensitively', async () => {
    assert.equal((await list({ brand: 'sony,JBL' })).body.count, 4);
  });

  it('filters by colour, use and connectivity', async () => {
    assert.deepEqual(ids(await list({ colour: 'sand' })), [SKU.earbuds, SKU.shirt]);
    assert.deepEqual(ids(await list({ use: 'studio' })), ['A-01-118']);
    assert.deepEqual(ids(await list({ zone: 'A', connectivity: 'wired' })), ['A-01-118', 'A-03-002']);
  });

  it('filters by isNew', async () => {
    assert.deepEqual(ids(await list({ isNew: 'true' })), [SKU.earbuds, SKU.shirt]);
    assert.equal((await list({ isNew: 'false' })).body.count, 5);
  });

  it('combines filters', async () => {
    assert.deepEqual(ids(await list({ zone: 'A', brand: 'Sony', maxPrice: 5000, connectivity: 'wired' })), ['A-01-118']);
  });

  it('searches with q, and treats regex characters as text', async () => {
    assert.equal((await list({ q: 'earbuds' })).body.count, 2);
    assert.equal((await list({ q: 'jbl' })).body.count, 2);
    assert.equal((await list({ q: '.*' })).body.count, 0);
  });

  it('sorts by price and newest', async () => {
    assert.equal(ids(await list({ sort: 'price_asc' }))[0], 'P001');
    assert.equal(ids(await list({ sort: 'price_desc' }))[0], 'A-03-002');
    await Product.create(newProduct);
    assert.equal(ids(await list({ sort: 'new' }))[0], 'D-01-001');
  });

  it('applies limit', async () => {
    const res = await list({ limit: 2 });
    assert.equal(res.body.count, 2);
    assert.equal(res.body.pagination.total, 7);
  });

  it('rejects bad filter values with 400', async () => {
    for (const query of [{ minPrice: 'cheap' }, { maxPrice: '-1' }, { bay: 'x' }, { connectivity: 'bluetooth' }, { isNew: 'maybe' }]) {
      assert.equal((await list(query)).status, 400, JSON.stringify(query));
    }
  });
});

describe('REQUIRE_AUTH_FOR_CATALOGUE', () => {
  before(() => { process.env.REQUIRE_AUTH_FOR_CATALOGUE = 'true'; });
  after(() => { delete process.env.REQUIRE_AUTH_FOR_CATALOGUE; });

  it('returns 401 without a token on every product read', async () => {
    const kit = await Kit.create({ title: 'Kit', productIds: ['P001'] });
    for (const path of ['/api/products', '/api/products/audio', '/api/products/sheet/P001', '/api/search?q=mouse', `/api/kits/${kit._id}`]) {
      assert.equal((await request(app).get(path)).status, 401, path);
    }
  });

  it('allows the same reads with a token', async () => {
    assert.equal((await auth(request(app).get('/api/products'))).status, 200);
    assert.equal((await auth(request(app).get('/api/products/sheet/P001'))).status, 200);
  });

  it('rejects an invalid token', async () => {
    assert.equal((await auth(request(app).get('/api/products'), 'bad')).status, 401);
  });
});

describe('GET /api/products/sheet/:productId', () => {
  it('returns the product and up to 3 others from the same zone', async () => {
    const res = await request(app).get(`/api/products/sheet/${SKU.earbuds}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.product.productName, 'Pulse Earbuds');
    assert.equal(res.body.data.related.length, 3);
    assert.ok(res.body.data.related.every(item => item.zoneCode === 'A' && item.productId !== SKU.earbuds));
  });

  it('falls back to the category for a product with no zone', async () => {
    await Product.create({ ...base, productId: 'P002', productName: 'Pen', productPrice: 20, category: 'Stationery' });
    const res = await request(app).get('/api/products/sheet/P001');
    assert.deepEqual(res.body.data.related.map(item => item.productId), ['P002']);
  });

  it('returns 404 for an unknown product', async () => {
    assert.equal((await request(app).get('/api/products/sheet/NOPE')).status, 404);
  });
});

describe('GET /api/products/:category', () => {
  it('matches case-insensitively, with count', async () => {
    const res = await request(app).get('/api/products/aUdIo');
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 5);
  });

  it('returns 404 when empty', async () => {
    assert.equal((await request(app).get('/api/products/Garden')).status, 404);
  });

  it('treats regex characters as text', async () => {
    assert.equal((await request(app).get('/api/products/.*')).status, 404);
    assert.equal((await request(app).get('/api/products/Aud.o')).status, 404);
  });
});

describe('GET /api/search', () => {
  const search = q => request(app).get('/api/search').query({ q });

  it('puts an exact SKU first, in any case', async () => {
    assert.equal(ids(await search(SKU.earbuds.toLowerCase()))[0], SKU.earbuds);
  });

  it('finds by name, brand and zone name', async () => {
    assert.deepEqual(ids(await search('linen shirt')), [SKU.shirt]);
    assert.ok(ids(await search('fabindia')).includes(SKU.shirt));
    assert.equal((await search('audio')).body.count, 5);
  });

  it('finds partial words', async () => {
    assert.deepEqual(ids(await search('earb')).sort(), [SKU.earbuds, 'A-01-118']);
  });

  it('never repeats a product or returns more than 8', async () => {
    await Product.insertMany(Array.from({ length: 12 }, (_, i) => ({ ...base, productId: `T-${i}`, productName: `Earbuds ${i}`, productPrice: 10, category: 'Audio' })));
    const res = await search('earbuds');
    assert.equal(res.body.count, 8);
    assert.equal(new Set(ids(res)).size, 8);
  });

  it('treats regex characters as text and does not leak a score', async () => {
    assert.equal((await search('.*')).body.count, 0);
    assert.equal((await search('earbuds')).body.data[0].score, undefined);
  });

  it('returns 400 without q', async () => {
    assert.equal((await request(app).get('/api/search')).status, 400);
    assert.equal((await search('   ')).status, 400);
  });
});

describe('GET /api/zones', () => {
  it('returns each zone in order, with counts, stock and bays', async () => {
    await Zone.create([{ code: 'S', name: 'Style', order: 2 }, { code: 'A', name: 'Audio', order: 1 }, { code: 'B', name: 'Body care', order: 3 }]);
    const res = await request(app).get('/api/zones');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.map(zone => zone.code), ['A', 'S', 'B']);

    const [audio, , bodyCare] = res.body.data;
    assert.equal(audio.productCount, 5);
    assert.equal(audio.totalStock, 22);
    assert.deepEqual(audio.bays, [
      { bay: 1, bayName: 'Earbuds', count: 2 },
      { bay: 2, bayName: 'Headphones', count: 1 },
      { bay: 3, bayName: 'Speakers', count: 2 }
    ]);
    assert.deepEqual(audio.layout, { col: 1, row: 1 });
    assert.equal(bodyCare.productCount, 0);
    assert.deepEqual(bodyCare.bays, []);
  });
});

describe('managing products', () => {
  const post = (body, token = adminToken) => auth(request(app).post('/api/products'), token).send(body);
  const put = (productId, body, token = adminToken) => auth(request(app).put('/api/products').query({ productId }), token).send(body);
  const del = (productId, token = adminToken) => auth(request(app).delete('/api/products').query({ productId }), token);

  it('creates with the six lab fields: 201', async () => {
    assert.equal((await post(newProduct)).status, 201);
  });

  it('creates with the store fields too', async () => {
    const res = await post({ ...newProduct, zoneCode: 'D', bay: 1, bayName: 'Lamps', brand: 'Philips', colours: ['White'], specs: { Power: '9 W' }, isNew: true });
    assert.equal(res.status, 201);
    assert.deepEqual(res.body.data.specs, { Power: '9 W' });
    assert.equal(res.body.data.isNew, true);
    assert.equal(res.body.data.isNewDrop, undefined);
    assert.ok(res.body.data.createdAt);
  });

  it('returns 409 for a duplicate and 400 for bad data', async () => {
    assert.equal((await post({ ...newProduct, productId: 'P001' })).status, 409);
    assert.equal((await post({ ...newProduct, zoneCode: 'Z' })).status, 400);
  });

  it('updates the store fields and runs validators', async () => {
    const res = await put(SKU.earbuds, { brand: 'boAt', specs: { Battery: '30 h' }, isNew: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.brand, 'boAt');
    assert.equal(res.body.data.specs.Battery, '30 h');
    assert.equal(res.body.data.isNew, false);
    assert.equal((await put(SKU.earbuds, { connectivity: 'bluetooth' })).status, 400);
    assert.equal((await put(SKU.earbuds, { zoneCode: 'Z' })).status, 400);
  });

  it('cannot change a productId', async () => {
    await put(SKU.earbuds, { productId: 'CHANGED', brand: 'X' });
    assert.ok(await Product.exists({ productId: SKU.earbuds }));
    assert.equal(await Product.exists({ productId: 'CHANGED' }), null);
  });

  it('returns 404 for unknown and 400 for a missing query', async () => {
    assert.equal((await put('NOPE', { brand: 'X' })).status, 404);
    assert.equal((await del('NOPE')).status, 404);
    assert.equal((await auth(request(app).put('/api/products'), adminToken).send({ brand: 'X' })).status, 400);
    assert.equal((await auth(request(app).delete('/api/products'), adminToken)).status, 400);
  });

  it('requires an admin', async () => {
    assert.equal((await post(newProduct, userToken)).status, 403);
    assert.equal((await put('P001', { brand: 'X' }, userToken)).status, 403);
    assert.equal((await del('P001', userToken)).status, 403);
    assert.equal((await request(app).post('/api/products').send(newProduct)).status, 401);
  });

  it('deleting a product removes its reviews and questions', async () => {
    await auth(request(app).post('/api/products/P001/reviews')).send({ rating: 5, text: 'Good.' });
    await auth(request(app).post('/api/products/P001/questions')).send({ text: 'Ruled?' });
    assert.equal((await del('P001')).status, 204);
    assert.equal(await Review.countDocuments(), 0);
    assert.equal(await Question.countDocuments(), 0);
  });
});

describe('reviews', () => {
  const add = (body, token = userToken, sku = SKU.earbuds) =>
    auth(request(app).post(`/api/products/${sku}/reviews`), token).send(body);

  it('is public to read and shows only the username of the writer', async () => {
    await add({ rating: 4, text: 'Solid.' });
    const res = await request(app).get(`/api/products/${SKU.earbuds}/reviews`);
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 1);
    assert.equal(res.body.data[0].user.username, 'Asha');
    assert.equal(JSON.stringify(res.body).includes('asha@example.com'), false);
  });

  it('needs a login to write', async () => {
    const res = await request(app).post(`/api/products/${SKU.earbuds}/reviews`).send({ rating: 4, text: 'Solid.' });
    assert.equal(res.status, 401);
  });

  it('allows one review per user per product', async () => {
    assert.equal((await add({ rating: 4, text: 'Solid.' })).status, 201);
    const again = await add({ rating: 1, text: 'Changed my mind.' });
    assert.equal(again.status, 409);
    assert.match(again.body.message, /already reviewed/);
    assert.equal((await add({ rating: 5, text: 'Great.' }, adminToken)).status, 201);
    assert.equal((await add({ rating: 3, text: 'Fine.' }, userToken, 'A-01-118')).status, 201);
  });

  it('validates the rating and text', async () => {
    assert.equal((await add({ rating: 6, text: 'Too high.' })).status, 400);
    assert.equal((await add({ rating: 'great', text: 'Not a number.' })).status, 400);
    assert.equal((await add({ rating: 4 })).status, 400);
  });

  it('returns 404 for an unknown product', async () => {
    assert.equal((await request(app).get('/api/products/NOPE/reviews')).status, 404);
    assert.equal((await add({ rating: 4, text: 'Solid.' }, userToken, 'NOPE')).status, 404);
  });

  it('survives a deleted reviewer', async () => {
    await add({ rating: 4, text: 'Solid.' });
    await User.deleteOne({ emailId: 'asha@example.com' });
    const res = await request(app).get(`/api/products/${SKU.earbuds}/reviews`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data[0].user, null);
  });
});

describe('questions', () => {
  const ask = (body, token = userToken) => auth(request(app).post(`/api/products/${SKU.earbuds}/questions`), token).send(body);

  it('is public to read and needs a login to ask', async () => {
    assert.equal((await ask({ text: 'Is it waterproof?' })).status, 201);
    const res = await request(app).get(`/api/products/${SKU.earbuds}/questions`);
    assert.equal(res.body.count, 1);
    assert.equal(res.body.data[0].text, 'Is it waterproof?');
    assert.equal((await request(app).post(`/api/products/${SKU.earbuds}/questions`).send({ text: 'Hi?' })).status, 401);
  });

  it('ignores an answer sent by the person asking', async () => {
    const res = await ask({ text: 'Is it waterproof?', answer: 'Yes, definitely.' });
    assert.equal(res.body.data.answer, undefined);
  });

  it('rejects an empty question', async () => {
    assert.equal((await ask({})).status, 400);
  });

  it('returns 404 for an unknown product', async () => {
    assert.equal((await request(app).get('/api/products/NOPE/questions')).status, 404);
  });

  it('lets an admin see open questions and answer them, which shows them publicly', async () => {
    await ask({ text: 'Is it waterproof?' });
    const open = await auth(request(app).get('/api/admin/questions'), adminToken);
    assert.equal(open.status, 200);
    assert.equal(open.body.count, 1);
    assert.equal(open.body.data[0].product.productId, SKU.earbuds);
    assert.equal(open.body.data[0].user, undefined);

    const { _id: id } = open.body.data[0];
    const answered = await auth(request(app).patch(`/api/admin/questions/${id}`), adminToken).send({ answer: '  Yes, IPX4.  ' });
    assert.equal(answered.status, 200);
    assert.equal(answered.body.data.answer, 'Yes, IPX4.');

    const shown = await request(app).get(`/api/products/${SKU.earbuds}/questions`);
    assert.equal(shown.body.data[0].answer, 'Yes, IPX4.');
    assert.equal((await auth(request(app).get('/api/admin/questions'), adminToken)).body.count, 0);
  });

  it('keeps answering to admins, and checks the answer and the question', async () => {
    const { _id: id } = (await ask({ text: 'Is it waterproof?' })).body.data;
    const answer = (questionId, body, token) => auth(request(app).patch(`/api/admin/questions/${questionId}`), token).send(body);

    assert.equal((await request(app).get('/api/admin/questions')).status, 401);
    assert.equal((await auth(request(app).get('/api/admin/questions'))).status, 403);
    assert.equal((await answer(id, { answer: 'Sure.' }, userToken)).status, 403);
    assert.equal((await answer(id, { answer: '   ' }, adminToken)).status, 400);
    assert.equal((await answer(id, { answer: 'x'.repeat(1001) }, adminToken)).status, 400);
    assert.equal((await answer('64b000000000000000000000', { answer: 'Sure.' }, adminToken)).status, 404);
    assert.equal((await answer('nope', { answer: 'Sure.' }, adminToken)).status, 400);
  });
});

describe('kits', () => {
  it('lists kits', async () => {
    await Kit.create({ title: 'Gift under 2000', query: { maxPrice: '2000' } });
    const res = await request(app).get('/api/kits');
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 1);
    assert.deepEqual(res.body.data[0].query, { maxPrice: '2000' });
  });

  it('resolves a query kit to its products', async () => {
    const kit = await Kit.create({ title: 'Pair a look', query: { zone: 'S,A', maxPrice: '2000' } });
    const res = await request(app).get(`/api/kits/${kit._id}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.products.map(p => p.productId).sort(), [SKU.earbuds, SKU.shirt]);
    assert.equal(res.body.count, 2);
  });

  it('resolves a hand-picked kit to its products', async () => {
    const kit = await Kit.create({ title: 'Desk', productIds: ['P001', SKU.earbuds] });
    const res = await request(app).get(`/api/kits/${kit._id}`);
    assert.equal(res.body.count, 2);
  });

  it('returns 404 for an unknown kit and 400 for a malformed id', async () => {
    assert.equal((await request(app).get(`/api/kits/${new mongoose.Types.ObjectId()}`)).status, 404);
    assert.equal((await request(app).get('/api/kits/not-an-id')).status, 400);
  });
});
