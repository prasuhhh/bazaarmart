import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import express from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { optionalAuth } from '../middleware/auth.js';
import { normalizePhone } from '../middleware/validate.js';
import Otp from '../models/Otp.js';
import User from '../models/User.js';

process.env.JWT_SECRET = 'test-secret';
process.env.OTP_MOCK = 'true';

const app = createApp({ authRateLimit: 100000, otpRateLimit: 100000 });
const phone = '+919876543210';
const shopper = { username: 'Asha', emailId: 'asha@example.com', age: 21, password: 'secret1' };
const address = { label: 'Home', name: 'Asha', phone: '9876543210', line1: '221B Lake Road', city: 'Chennai', state: 'TN', pincode: '600001' };

let mongo;
let token;
const realLog = console.log;

const auth = (req, value = token) => req.set({ Authorization: `Bearer ${value}` });
const requestCode = (body = { phone }, target = app) => request(target).post('/api/auth/otp/request').send(body);
const verifyCode = code => request(app).post('/api/auth/otp/verify').send({ phone, code });
const wrongCodeFor = code => (code === '000000' ? '000001' : '000000');

before(async () => {
  console.log = () => {};
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'bazaarmart_auth_test' });
  await Promise.all([User.init(), Otp.init()]);
});

after(async () => {
  console.log = realLog;
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Otp.deleteMany({})]);
  await request(app).post('/api/users').send(shopper);
  const res = await request(app).post('/api/login').send({ emailId: shopper.emailId, password: shopper.password });
  token = res.body.data.token;
});

describe('normalizePhone', () => {
  it('accepts Indian mobile numbers in common forms', () => {
    assert.equal(normalizePhone('9876543210'), phone);
    assert.equal(normalizePhone('+91 98765-43210'), phone);
  });

  it('rejects anything else', () => {
    for (const value of ['5876543210', '98765', '+449876543210', '98765432101', '', null, 9876543210, {}]) {
      assert.equal(normalizePhone(value), null);
    }
  });
});

describe('optionalAuth', () => {
  const probe = express();
  probe.get('/', optionalAuth, (req, res) => res.json({ user: req.user?.emailId ?? null }));
  probe.use(errorHandler);

  it('attaches the user for a valid token', async () => {
    const res = await auth(request(probe).get('/'));
    assert.equal(res.body.user, shopper.emailId);
  });

  it('continues as a guest with no token or a bad one', async () => {
    assert.equal((await request(probe).get('/')).body.user, null);
    const bad = await auth(request(probe).get('/'), 'not-a-token');
    assert.equal(bad.status, 200);
    assert.equal(bad.body.user, null);
  });

  it('continues as a guest when the account is gone', async () => {
    await User.deleteMany({});
    const res = await auth(request(probe).get('/'));
    assert.equal(res.status, 200);
    assert.equal(res.body.user, null);
  });
});

describe('GET /api/users/me', () => {
  it('returns the signed-in user without the password', async () => {
    const res = await auth(request(app).get('/api/users/me'));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.emailId, shopper.emailId);
    assert.equal(res.body.data.password, undefined);
  });

  it('requires a token', async () => {
    assert.equal((await request(app).get('/api/users/me')).status, 401);
  });
});

describe('phone OTP', () => {
  it('requests a code, stores only a hash, and returns devCode outside production', async () => {
    const res = await requestCode();
    assert.equal(res.status, 200);
    assert.match(res.body.data.devCode, /^\d{6}$/);
    const otp = await Otp.findOne({ phone });
    assert.notEqual(otp.codeHash, res.body.data.devCode);
    assert.match(otp.codeHash, /^\$2/);
  });

  it('never returns devCode in production, but still logs it in mock mode', async () => {
    const logged = [];
    console.log = line => logged.push(line);
    process.env.NODE_ENV = 'production';
    try {
      const res = await requestCode();
      assert.equal(res.status, 200);
      assert.equal(res.body.data, undefined);
      assert.match(logged.join(), /\d{6}/);
    } finally {
      delete process.env.NODE_ENV;
      console.log = () => {};
    }
  });

  it('returns 503 when neither mock mode nor an SMS key is set', async () => {
    delete process.env.OTP_MOCK;
    try {
      assert.equal((await requestCode()).status, 503);
    } finally {
      process.env.OTP_MOCK = 'true';
    }
  });

  describe('with a real SMS provider', () => {
    const realFetch = globalThis.fetch;
    const realError = console.error;
    const providerReplies = (status, body) => {
      const calls = [];
      // supertest talks to the app through node:http, so only the provider call lands here.
      globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify(body), { status });
      };
      return calls;
    };
    const queued = { data: { success: true, message: 'SMS added to queue for processing', smsBatchId: 'b1', recipientCount: 1 } };

    beforeEach(() => {
      delete process.env.OTP_MOCK;
      process.env.TEXTBEE_API_KEY = 'test-key';
      console.error = () => {};
    });

    after(() => {
      process.env.OTP_MOCK = 'true';
      delete process.env.TEXTBEE_API_KEY;
      globalThis.fetch = realFetch;
      console.error = realError;
    });

    it('texts a code that signs in, and never exposes or logs it', async () => {
      const logged = [];
      console.log = line => logged.push(line);
      const calls = providerReplies(200, queued);

      const res = await requestCode();
      assert.equal(res.status, 200);
      assert.equal(res.body.data, undefined);

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, 'https://api.textbee.dev/api/v1/gateway/send-sms');
      assert.equal(calls[0].options.headers['x-api-key'], 'test-key');
      const sent = JSON.parse(calls[0].options.body);
      assert.deepEqual(sent.recipients, [phone]);
      const code = sent.message.match(/\d{6}/)[0];
      assert.doesNotMatch(logged.join(), /\d{6}/);

      assert.equal((await verifyCode(code)).status, 200);
    });

    for (const [name, status, body] of [
      ['rejects the send', 400, { success: false, error: 'No enabled device found.' }],
      ['cannot reach the phone', 200, { data: { success: true, successCount: 0, failureCount: 1 } }]
    ]) {
      it(`returns 503 and keeps the earlier code when the provider ${name}`, async () => {
        const calls = providerReplies(200, queued);
        await requestCode();
        const earlier = JSON.parse(calls[0].options.body).message.match(/\d{6}/)[0];

        providerReplies(status, body);
        assert.equal((await requestCode()).status, 503);

        assert.equal((await verifyCode(earlier)).status, 200);
      });
    }

    it('returns 503 when the provider cannot be reached', async () => {
      globalThis.fetch = async () => { throw new Error('network down'); };
      assert.equal((await requestCode()).status, 503);
      assert.equal(await Otp.findOne({ phone }), null);
    });
  });

  it('rejects an invalid phone with 400', async () => {
    assert.equal((await requestCode({ phone: '12345' })).status, 400);
    assert.equal((await requestCode({})).status, 400);
  });

  it('creates a new user on first verify and returns token and user', async () => {
    const { body } = await requestCode();
    const res = await verifyCode(body.data.devCode);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.phone, phone);
    assert.equal(res.body.data.user.role, 'user');
    const me = await auth(request(app).get('/api/users/me'), res.body.data.token);
    assert.equal(me.status, 200);
    assert.equal(me.body.data.phone, phone);
  });

  it('signs an existing phone user into the same account', async () => {
    for (let i = 0; i < 2; i += 1) {
      const { body } = await requestCode();
      await verifyCode(body.data.devCode);
    }
    assert.equal(await User.countDocuments({ phone }), 1);
  });

  it('accepts a code only once', async () => {
    const { body } = await requestCode();
    assert.equal((await verifyCode(body.data.devCode)).status, 200);
    assert.equal((await verifyCode(body.data.devCode)).status, 400);
  });

  it('rejects a wrong code with 401 and shows the attempts left', async () => {
    const { body } = await requestCode();
    const res = await verifyCode(wrongCodeFor(body.data.devCode));
    assert.equal(res.status, 401);
    assert.match(res.body.message, /4 attempts left/);
  });

  it('returns 400 for an expired code, even if it is correct', async () => {
    const { body } = await requestCode();
    await Otp.updateOne({ phone }, { expiresAt: new Date(Date.now() - 1000) });
    const res = await verifyCode(body.data.devCode);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /expired/);
    assert.equal(await User.countDocuments({ phone }), 0);
  });

  it('returns 400 when no code was requested or the format is wrong', async () => {
    assert.equal((await verifyCode('123456')).status, 400);
    assert.equal((await verifyCode('12')).status, 400);
    assert.equal((await verifyCode(123456)).status, 400);
  });

  it('kills the code after 5 wrong attempts, so the right code stops working', async () => {
    const { body } = await requestCode();
    const wrong = wrongCodeFor(body.data.devCode);
    for (let attempt = 0; attempt < 4; attempt += 1) assert.equal((await verifyCode(wrong)).status, 401);
    assert.equal((await verifyCode(wrong)).status, 429);
    assert.equal((await verifyCode(body.data.devCode)).status, 400);
  });

  it('cannot be beaten by many parallel guesses', async () => {
    const { body } = await requestCode();
    const wrong = wrongCodeFor(body.data.devCode);
    const results = await Promise.all(Array.from({ length: 12 }, () => verifyCode(wrong)));
    assert.equal(results.filter(res => res.status === 401).length, 4);
    assert.equal(results.some(res => res.status === 200), false);
  });

  it('limits one phone to 5 requests in 10 minutes', async () => {
    const limited = createApp({ otpRateLimit: 5 });
    for (let i = 0; i < 5; i += 1) assert.equal((await requestCode({ phone }, limited)).status, 200);
    const blocked = await requestCode({ phone }, limited);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.success, false);
  });

  it('limits one IP trying different phones', async () => {
    const limited = createApp({ otpRateLimit: 3 });
    for (let i = 0; i < 3; i += 1) assert.equal((await requestCode({ phone: `+91987654321${i}` }, limited)).status, 200);
    assert.equal((await requestCode({ phone: '+919876543219' }, limited)).status, 429);
  });
});

describe('Google sign-in', () => {
  it('returns 501', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    assert.equal(res.status, 501);
    assert.equal(res.body.message, 'Google sign-in is not configured');
  });
});

describe('addresses', () => {
  const add = body => auth(request(app).post('/api/users/me/addresses')).send(body);
  const put = (id, body) => auth(request(app).put(`/api/users/me/addresses/${id}`)).send(body);
  const list = async () => (await auth(request(app).get('/api/users/me/addresses'))).body.data;
  const defaults = async () => (await list()).filter(item => item.isDefault).map(item => item.label);

  it('makes the first address the default', async () => {
    const res = await add(address);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.isDefault, true);
    assert.equal(res.body.data.phone, '+919876543210');
  });

  it('keeps one default when a new address asks for it', async () => {
    await add(address);
    await add({ ...address, label: 'Office', isDefault: true });
    assert.deepEqual(await defaults(), ['Office']);
  });

  it('does not change the default when a new address does not ask for it', async () => {
    await add(address);
    await add({ ...address, label: 'Office' });
    assert.deepEqual(await defaults(), ['Home']);
  });

  it('PUT can switch the default', async () => {
    await add(address);
    const office = await add({ ...address, label: 'Office' });
    await put(office.body.data._id, { isDefault: true });
    assert.deepEqual(await defaults(), ['Office']);
  });

  it('PUT updates only the fields sent', async () => {
    const home = await add(address);
    const res = await put(home.body.data._id, { city: 'Madurai' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.city, 'Madurai');
    assert.equal(res.body.data.line1, address.line1);
  });

  it('unsetting the default passes it to another address', async () => {
    const home = await add(address);
    await add({ ...address, label: 'Office' });
    await put(home.body.data._id, { isDefault: false });
    assert.deepEqual(await defaults(), ['Office']);
  });

  it('deleting the default passes it to another address', async () => {
    const home = await add(address);
    await add({ ...address, label: 'Office' });
    const res = await auth(request(app).delete(`/api/users/me/addresses/${home.body.data._id}`));
    assert.equal(res.status, 204);
    assert.deepEqual(await defaults(), ['Office']);
  });

  it('rejects missing fields, a bad pincode and a bad phone', async () => {
    assert.equal((await add({ label: 'Home' })).status, 400);
    assert.equal((await add({ ...address, pincode: '12' })).status, 400);
    assert.equal((await add({ ...address, phone: '123' })).status, 400);
    assert.deepEqual(await list(), []);
  });

  it('returns 404 for an unknown or malformed id', async () => {
    assert.equal((await put(new mongoose.Types.ObjectId(), { city: 'X' })).status, 404);
    assert.equal((await put('not-an-id', { city: 'X' })).status, 404);
  });

  it('never touches another user\'s address', async () => {
    const home = await add(address);
    await request(app).post('/api/users').send({ ...shopper, emailId: 'other@example.com' });
    const other = await request(app).post('/api/login').send({ emailId: 'other@example.com', password: shopper.password });
    const res = await auth(request(app).delete(`/api/users/me/addresses/${home.body.data._id}`), other.body.data.token);
    assert.equal(res.status, 404);
    assert.equal((await list()).length, 1);
  });

  it('requires a token', async () => {
    assert.equal((await request(app).get('/api/users/me/addresses')).status, 401);
  });
});

describe('devices', () => {
  const add = body => auth(request(app).post('/api/users/me/devices')).send(body);

  it('adds, lists, updates and deletes', async () => {
    const created = await add({ name: 'Pixel 9', category: 'Phone', warrantyUntil: '2027-01-01' });
    assert.equal(created.status, 201);
    const { _id: id } = created.body.data;
    assert.equal((await auth(request(app).get('/api/users/me/devices'))).body.count, 1);
    const updated = await auth(request(app).put(`/api/users/me/devices/${id}`)).send({ name: 'Pixel 10' });
    assert.equal(updated.body.data.name, 'Pixel 10');
    assert.equal((await auth(request(app).delete(`/api/users/me/devices/${id}`))).status, 204);
    assert.equal((await auth(request(app).get('/api/users/me/devices'))).body.count, 0);
  });

  it('rejects a device with no name or a bad date', async () => {
    assert.equal((await add({ category: 'Phone' })).status, 400);
    assert.equal((await add({ name: 'Pixel', purchasedAt: 'soon' })).status, 400);
  });

  it('returns 404 for an unknown device', async () => {
    const res = await auth(request(app).delete(`/api/users/me/devices/${new mongoose.Types.ObjectId()}`));
    assert.equal(res.status, 404);
  });
});

describe('prefs', () => {
  const patch = body => auth(request(app).patch('/api/users/me/prefs')).send(body);

  it('returns the defaults', async () => {
    const res = await auth(request(app).get('/api/users/me/prefs'));
    assert.deepEqual(res.body.data.notificationPrefs, { orderUpdates: true, priceDrops: true, newDrops: true });
  });

  it('changes only the preferences sent', async () => {
    await patch({ stylePrefs: { brands: ['Sony'] } });
    const res = await patch({ notificationPrefs: { priceDrops: false } });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.stylePrefs.brands, ['Sony']);
    assert.equal(res.body.data.notificationPrefs.priceDrops, false);
    assert.equal(res.body.data.notificationPrefs.orderUpdates, true);
  });

  it('rejects empty or wrongly typed preferences', async () => {
    assert.equal((await patch({})).status, 400);
    assert.equal((await patch({ stylePrefs: { brands: 'Sony' } })).status, 400);
    assert.equal((await patch({ notificationPrefs: { priceDrops: 'no' } })).status, 400);
  });
});

describe('payment methods', () => {
  const path = '/api/users/me/payment-methods';
  const add = body => auth(request(app).post(path)).send(body);

  it('keeps display tokens and lists them', async () => {
    assert.equal((await add({ type: 'upi', label: 'asha@okbank' })).status, 201);
    const card = await add({ type: 'card', label: 'Visa', last4: '4021' });
    assert.equal(card.status, 201);
    assert.equal(card.body.data.last4, '4021');
    const list = await auth(request(app).get(path));
    assert.equal(list.body.count, 2);
  });

  it('refuses anything that could be a full card number', async () => {
    const attempts = [
      { type: 'card', label: '4111111111111111', last4: '1111' },
      { type: 'card', label: 'Visa', last4: '4111111111111111' },
      { type: 'upi', label: '4111111111111111' },
      { type: 'card', label: 'Visa' },
      { type: 'wallet', label: 'Mine' },
      {}
    ];
    for (const attempt of attempts) assert.equal((await add(attempt)).status, 400, JSON.stringify(attempt));
    const user = await User.findOne({ emailId: shopper.emailId });
    assert.equal(user.paymentMethods.length, 0);
  });

  it('ignores extra card fields', async () => {
    await add({ type: 'card', label: 'Visa', last4: '4021', number: '4111111111111111', cvv: '123' });
    const user = await User.findOne({ emailId: shopper.emailId }).lean();
    assert.doesNotMatch(JSON.stringify(user.paymentMethods), /4111|cvv/);
  });

  it('removes a method, and needs a login', async () => {
    const { body } = await add({ type: 'upi', label: 'asha@okbank' });
    assert.equal((await auth(request(app).delete(`${path}/${body.data._id}`))).status, 204);
    assert.equal((await auth(request(app).delete(`${path}/${body.data._id}`))).status, 404);
    assert.equal((await request(app).get(path)).status, 401);
  });
});

describe('phone accounts', () => {
  let phoneToken;

  beforeEach(async () => {
    const { body } = await requestCode();
    const verified = await verifyCode(body.data.devCode);
    phoneToken = verified.body.data.token;
  });

  const patchMe = body => auth(request(app).patch('/api/users/me'), phoneToken).send(body);

  it('can add a name, age and email', async () => {
    const res = await patchMe({ username: 'Asha Rao', age: 24, emailId: 'New.Phone@Example.com' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.username, 'Asha Rao');
    assert.equal(res.body.data.emailId, 'new.phone@example.com');
  });

  it('can set a password and then sign in by email', async () => {
    await patchMe({ emailId: 'phone@example.com', password: 'secret123' });
    const login = await request(app).post('/api/login').send({ emailId: 'phone@example.com', password: 'secret123' });
    assert.equal(login.status, 200);
  });

  it('keeps an email read-only once it is set', async () => {
    await patchMe({ emailId: 'first@example.com' });
    const res = await patchMe({ emailId: 'second@example.com' });
    assert.equal(res.status, 400);
  });

  it('rejects a taken email, a bad email, bad fields and an empty body', async () => {
    assert.equal((await patchMe({ emailId: shopper.emailId })).status, 409);
    assert.equal((await patchMe({ emailId: 'nope' })).status, 400);
    assert.equal((await patchMe({ age: 500 })).status, 400);
    assert.equal((await patchMe({})).status, 400);
  });

  it('cannot change its role', async () => {
    await patchMe({ username: 'Asha', role: 'admin' });
    const user = await User.findOne({ phone });
    assert.equal(user.role, 'user');
  });

  it('can delete itself', async () => {
    assert.equal((await auth(request(app).delete('/api/users/me'), phoneToken)).status, 204);
    assert.equal(await User.countDocuments({ phone }), 0);
    assert.equal((await auth(request(app).get('/api/users/me'), phoneToken)).status, 401);
  });

  it('needs a login', async () => {
    assert.equal((await request(app).patch('/api/users/me').send({ age: 20 })).status, 401);
    assert.equal((await request(app).delete('/api/users/me')).status, 401);
  });
});

describe('deleting an account', () => {
  it('removes its shelves, so old share links stop working', async () => {
    const made = await auth(request(app).post('/api/shelves')).send({ name: 'Trip kit' });
    const { shareId } = made.body.data;
    assert.equal((await request(app).get(`/api/shelves/shared/${shareId}`)).status, 200);

    const res = await auth(request(app).delete(`/api/users?emailId=${shopper.emailId}`));
    assert.equal(res.status, 204);
    assert.equal((await request(app).get(`/api/shelves/shared/${shareId}`)).status, 404);
  });
});
