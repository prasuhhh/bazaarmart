import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import { errorHandler } from '../middleware/errorHandler.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { asyncHandler } from '../utils/response.js';

process.env.JWT_SECRET = 'test-secret';

const app = createApp({ authRateLimit: 100000 });
const shopper = { username: 'Asha', emailId: 'asha@example.com', age: 21, password: 'secret1' };
const newProduct = {
  productId: 'P100', productName: 'Desk Lamp', productPrice: 899,
  category: 'Home', quantity: 5, description: 'Warm LED desk lamp.'
};

let mongo;
let userToken;
let adminToken;

const bearer = token => ({ Authorization: `Bearer ${token}` });
const auth = (req, token) => req.set(bearer(token));

async function loginAs(emailId, password) {
  const res = await request(app).post('/api/login').send({ emailId, password });
  return res.body.data.token;
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'bazaarmart_test' });
  await Promise.all([User.init(), Product.init()]);
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({})]);
  await request(app).post('/api/users').send(shopper);
  await User.create({
    username: 'Admin', emailId: 'admin@example.com', age: 30, role: 'admin', password: 'adminpass'
  });
  await Product.insertMany([
    { productId: 'P001', productName: 'Wireless Mouse', productPrice: 599, category: 'Electronics', quantity: 3, description: 'Mouse.' },
    { productId: 'P002', productName: 'Keyboard', productPrice: 2499, category: 'Electronics', quantity: 2, description: 'Keyboard.' },
    { productId: 'P003', productName: 'Notebook', productPrice: 120, category: 'Stationery', quantity: 1, description: 'Notebook.' }
  ]);
  userToken = await loginAs(shopper.emailId, shopper.password);
  adminToken = await loginAs('admin@example.com', 'adminpass');
});

describe('registration', () => {
  it('creates a user with 201', async () => {
    const res = await request(app).post('/api/users')
      .send({ username: 'Ravi', emailId: 'RAVI@example.com', age: 22, password: 'secret1' });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(await User.exists({ emailId: 'ravi@example.com' }));
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await request(app).post('/api/users').send(shopper);
    assert.equal(res.status, 409);
    assert.match(res.body.message, /Email ID is already registered/);
  });

  it('returns 400 rather than 500 for a one-letter username', async () => {
    const res = await request(app).post('/api/users').send({ ...shopper, emailId: 'x@example.com', username: 'A' });
    assert.equal(res.status, 400);
  });

  it('returns 400 when emailId is not a string', async () => {
    const res = await request(app).post('/api/users').send({ ...shopper, emailId: ['a@example.com'] });
    assert.equal(res.status, 400);
  });

  it('ignores a role sent by the client', async () => {
    await request(app).post('/api/users')
      .send({ username: 'Eve', emailId: 'eve@example.com', age: 25, password: 'secret1', role: 'admin' });
    const user = await User.findOne({ emailId: 'eve@example.com' });
    assert.equal(user.role, 'user');
  });
});

describe('login', () => {
  it('returns a token and user with no password', async () => {
    const res = await request(app).post('/api/login').send({ emailId: shopper.emailId, password: shopper.password });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.user.password, undefined);
    assert.equal(res.body.data.user.role, 'user');
  });

  it('returns 404 for an unknown email', async () => {
    const res = await request(app).post('/api/login').send({ emailId: 'nobody@example.com', password: 'secret1' });
    assert.equal(res.status, 404);
    assert.match(res.body.message, /User Not Registered/);
  });

  it('returns 401 for a wrong password', async () => {
    const res = await request(app).post('/api/login').send({ emailId: shopper.emailId, password: 'wrong-pass' });
    assert.equal(res.status, 401);
  });

  it('returns 429 once failed attempts pass the limit', async () => {
    const limited = createApp({ authRateLimit: 2 });
    const attempt = () => request(limited).post('/api/login').send({ emailId: shopper.emailId, password: 'wrong-pass' });
    assert.equal((await attempt()).status, 401);
    assert.equal((await attempt()).status, 401);
    const blocked = await attempt();
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.success, false);
  });
});

describe('authentication', () => {
  it('rejects a missing token with 401', async () => {
    assert.equal((await request(app).get('/api/users/me')).status, 401);
  });

  it('rejects a bad token with 401', async () => {
    assert.equal((await auth(request(app).get('/api/users/me'), 'not-a-token')).status, 401);
  });

  it('rejects an expired token with 401', async () => {
    const expired = jwt.sign({ userId: new mongoose.Types.ObjectId() }, process.env.JWT_SECRET, { expiresIn: -10 });
    assert.equal((await auth(request(app).get('/api/users/me'), expired)).status, 401);
  });

  it('rejects the token of a deleted account', async () => {
    await auth(request(app).delete('/api/users').query({ emailId: shopper.emailId }), userToken);
    assert.equal((await auth(request(app).get('/api/users/me'), userToken)).status, 401);
  });
});

describe('profile', () => {
  const profile = (method, emailId = shopper.emailId) =>
    auth(request(app)[method]('/api/users').query({ emailId }), userToken);

  it('PUT updates the full profile', async () => {
    const res = await profile('put').send({ username: 'Asha R', age: 22, password: 'secret2' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.username, 'Asha R');
    assert.equal(res.body.data.password, undefined);
  });

  it('PUT returns 400 rather than 500 for a one-letter username', async () => {
    assert.equal((await profile('put').send({ username: 'A', age: 22, password: 'secret2' })).status, 400);
    assert.equal((await profile('put').send({ username: 'Asha', age: 22 })).status, 400);
  });

  it('PATCH updates only the fields sent', async () => {
    const res = await profile('patch').send({ age: 40 });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.age, 40);
    assert.equal(res.body.data.username, shopper.username);
  });

  it('PATCH can change the password', async () => {
    await profile('patch').send({ password: 'newsecret' });
    const res = await request(app).post('/api/login').send({ emailId: shopper.emailId, password: 'newsecret' });
    assert.equal(res.status, 200);
  });

  it('PATCH with no fields returns 400', async () => {
    assert.equal((await profile('patch').send({})).status, 400);
  });

  it('returns 403 for another user', async () => {
    assert.equal((await profile('put', 'admin@example.com').send({ username: 'Hack', age: 22, password: 'secret2' })).status, 403);
    assert.equal((await profile('patch', 'admin@example.com').send({ age: 22 })).status, 403);
    assert.equal((await profile('delete', 'admin@example.com')).status, 403);
  });

  it('returns 400 without the emailId query parameter', async () => {
    const res = await auth(request(app).put('/api/users'), userToken).send({ username: 'Asha', age: 22 });
    assert.equal(res.status, 400);
  });

  it('DELETE removes the account', async () => {
    assert.equal((await profile('delete')).status, 204);
    assert.equal(await User.exists({ emailId: shopper.emailId }), null);
  });
});

describe('reading products', () => {
  it('lists products sorted by productId with count', async () => {
    const res = await auth(request(app).get('/api/products'), userToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 3);
    assert.deepEqual(res.body.data.map(p => p.productId), ['P001', 'P002', 'P003']);
    assert.equal(res.body.pagination, undefined);
  });

  it('filters by category case-insensitively', async () => {
    const res = await auth(request(app).get('/api/products/electronics'), userToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 2);
  });

  it('returns 404 for an unknown category', async () => {
    assert.equal((await auth(request(app).get('/api/products/Garden'), userToken)).status, 404);
  });

  it('treats regex characters in a category as plain text', async () => {
    assert.equal((await auth(request(app).get('/api/products/.*'), userToken)).status, 404);
  });

  it('searches by name and treats regex characters as plain text', async () => {
    const found = await auth(request(app).get('/api/products').query({ q: 'mouse' }), userToken);
    assert.deepEqual(found.body.data.map(p => p.productId), ['P001']);
    const none = await auth(request(app).get('/api/products').query({ q: '.*' }), userToken);
    assert.equal(none.body.count, 0);
  });

  it('sorts by price', async () => {
    const res = await auth(request(app).get('/api/products').query({ sort: 'price_desc' }), userToken);
    assert.deepEqual(res.body.data.map(p => p.productId), ['P002', 'P001', 'P003']);
  });

  it('paginates and clamps an out-of-range page', async () => {
    const res = await auth(request(app).get('/api/products').query({ page: 99, limit: 2 }), userToken);
    assert.equal(res.body.count, 1);
    assert.deepEqual(res.body.pagination, { page: 2, pages: 2, total: 3, limit: 2 });
  });
});

describe('managing products', () => {
  const post = (token, body) => auth(request(app).post('/api/products'), token).send(body);
  const put = (token, productId, body) => auth(request(app).put('/api/products').query({ productId }), token).send(body);
  const del = (token, productId) => auth(request(app).delete('/api/products').query({ productId }), token);

  it('POST creates with 201', async () => {
    const res = await post(adminToken, newProduct);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.productId, 'P100');
  });

  it('POST returns 409 for a duplicate productId', async () => {
    assert.equal((await post(adminToken, { ...newProduct, productId: 'P001' })).status, 409);
  });

  it('POST returns 400 for an invalid body', async () => {
    assert.equal((await post(adminToken, { productId: 'P101' })).status, 400);
    assert.equal((await post(adminToken, { ...newProduct, productPrice: -1 })).status, 400);
    assert.equal((await post(adminToken, { ...newProduct, productPrice: 'free' })).status, 400);
    assert.equal((await post(adminToken, { ...newProduct, quantity: 1.5 })).status, 400);
  });

  it('PUT updates and enforces validators', async () => {
    const res = await put(adminToken, 'P001', { productPrice: 650 });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.productPrice, 650);
    assert.equal((await put(adminToken, 'P001', { productPrice: -5 })).status, 400);
  });

  it('PUT returns 404 for an unknown product', async () => {
    assert.equal((await put(adminToken, 'P999', { productPrice: 1 })).status, 404);
  });

  it('PUT returns 400 without productId or fields', async () => {
    assert.equal((await auth(request(app).put('/api/products'), adminToken).send({ productPrice: 1 })).status, 400);
    assert.equal((await put(adminToken, 'P001', {})).status, 400);
  });

  it('DELETE returns 204, then 404', async () => {
    assert.equal((await del(adminToken, 'P001')).status, 204);
    assert.equal((await del(adminToken, 'P001')).status, 404);
  });

  it('DELETE returns 400 without productId', async () => {
    assert.equal((await auth(request(app).delete('/api/products'), adminToken)).status, 400);
  });

  it('non-admins get 403 on every write', async () => {
    assert.equal((await post(userToken, newProduct)).status, 403);
    assert.equal((await put(userToken, 'P001', { productPrice: 1 })).status, 403);
    assert.equal((await del(userToken, 'P001')).status, 403);
  });
});

describe('orders', () => {
  const order = (token, items) => auth(request(app).post('/api/orders'), token).send({ items });
  const stockOf = async productId => (await Product.findOne({ productId })).quantity;

  it('places an order at database prices and reduces stock', async () => {
    const res = await auth(request(app).post('/api/orders'), userToken)
      .send({ items: [{ productId: 'P001', qty: 2, price: 1 }, { productId: 'P003', qty: 1 }], total: 1 });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.total, 599 * 2 + 120);
    assert.equal(res.body.data.status, 'placed');
    assert.equal(await stockOf('P001'), 1);
    assert.equal(await stockOf('P003'), 0);
  });

  it('merges repeated lines before checking stock', async () => {
    const res = await order(userToken, [{ productId: 'P001', qty: 2 }, { productId: 'P001', qty: 2 }]);
    assert.equal(res.status, 409);
    assert.equal(await stockOf('P001'), 3);
  });

  it('restores earlier items when a later item is short of stock', async () => {
    const res = await order(userToken, [{ productId: 'P001', qty: 1 }, { productId: 'P003', qty: 5 }]);
    assert.equal(res.status, 409);
    assert.match(res.body.message, /Only 1 of Notebook left/);
    assert.equal(await stockOf('P001'), 3);
    assert.equal(await Order.countDocuments(), 0);
  });

  it('restores earlier items when a later product does not exist', async () => {
    const res = await order(userToken, [{ productId: 'P001', qty: 1 }, { productId: 'P999', qty: 1 }]);
    assert.equal(res.status, 404);
    assert.equal(await stockOf('P001'), 3);
  });

  it('sells the last unit to only one of two simultaneous buyers', async () => {
    const results = await Promise.all([
      order(userToken, [{ productId: 'P003', qty: 1 }]),
      order(adminToken, [{ productId: 'P003', qty: 1 }])
    ]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    assert.equal(await stockOf('P003'), 0);
  });

  it('returns 400 for an empty or invalid order', async () => {
    assert.equal((await order(userToken, [])).status, 400);
    assert.equal((await order(userToken, [{ productId: 'P001', qty: 0 }])).status, 400);
    assert.equal((await order(userToken, [{ productId: 'P001', qty: 1.5 }])).status, 400);
    assert.equal((await order(userToken, [null])).status, 400);
    assert.equal((await auth(request(app).post('/api/orders'), userToken)).status, 400);
  });

  it('shows users only their own orders, newest first', async () => {
    await order(userToken, [{ productId: 'P001', qty: 1 }]);
    await order(userToken, [{ productId: 'P002', qty: 1 }]);
    await order(adminToken, [{ productId: 'P003', qty: 1 }]);
    const res = await auth(request(app).get('/api/orders'), userToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 2);
    assert.equal(res.body.data[0].items[0].productId, 'P002');
  });

  it('keeps order history after the product is deleted', async () => {
    await order(userToken, [{ productId: 'P001', qty: 1 }]);
    await Product.deleteOne({ productId: 'P001' });
    const res = await auth(request(app).get('/api/orders'), userToken);
    assert.equal(res.body.data[0].items[0].name, 'Wireless Mouse');
  });

  it('requires a token', async () => {
    assert.equal((await request(app).get('/api/orders')).status, 401);
  });
});

describe('error handling', () => {
  it('returns JSON for malformed JSON', async () => {
    const res = await request(app).post('/api/login').set('Content-Type', 'application/json').send('{bad');
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it('returns JSON for an unknown route', async () => {
    const res = await request(app).get('/api/nothing-here');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  it('handles a request with no body', async () => {
    assert.equal((await request(app).post('/api/login')).status, 400);
  });

  async function statusAfterDatabaseFailure() {
    const realFind = User.findById;
    const realError = console.error;
    User.findById = () => { throw new Error('secret database detail'); };
    console.error = () => {};
    try {
      return await auth(request(app).get('/api/users/me'), userToken);
    } finally {
      User.findById = realFind;
      console.error = realError;
    }
  }

  async function withNodeEnv(value, run) {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = value;
    try {
      return await run();
    } finally {
      if (original === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = original;
    }
  }

  it('hides internal details on a 500 in production', async () => {
    const res = await withNodeEnv('production', statusAfterDatabaseFailure);
    assert.equal(res.status, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Internal server error.');
    assert.equal(JSON.stringify(res.body).includes('secret'), false);
  });

  it('shows the error message on a 500 in development, but never a stack trace', async () => {
    const res = await withNodeEnv('development', statusAfterDatabaseFailure);
    assert.equal(res.status, 500);
    assert.equal(res.body.message, 'secret database detail');
    assert.equal(res.body.stack, undefined);
  });

  it('turns a JWT error into a 401 through the central handler', async () => {
    const res = await auth(request(app).get('/api/users/me'), 'not-a-token');
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { success: false, message: 'Invalid or expired token.' });
  });

  it('gives a friendly message for a duplicate key', () => {
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    errorHandler({ code: 11000, keyPattern: { productId: 1 } }, {}, res, () => {});
    assert.equal(res.code, 409);
    assert.equal(res.body.message, 'Product ID already exists.');
  });

  it('returns 400 for a malformed URL', async () => {
    const res = await auth(request(app).get('/api/products/%E0%A4%A'), userToken);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });
});

describe('core', () => {
  it('GET /api/health returns { success: true } with no login', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true });
  });

  it('asyncHandler forwards a rejected handler to next', async () => {
    const failure = new Error('boom');
    const received = await new Promise(resolve => {
      asyncHandler(async () => { throw failure; })({}, {}, resolve);
    });
    assert.equal(received, failure);
  });

  it('escapeRegex makes regex characters literal', () => {
    assert.equal(new RegExp(`^${escapeRegex('a.c+')}$`).test('abc+'), false);
    assert.equal(new RegExp(`^${escapeRegex('a.c+')}$`).test('a.c+'), true);
  });
});
