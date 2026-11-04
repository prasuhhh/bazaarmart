import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import Counter from '../models/Counter.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';

process.env.JWT_SECRET = 'test-secret';

const app = createApp({ authRateLimit: 100000 });
const GUEST_PHONE = '+919876543210';
const details = {
  address: { name: 'Asha', phone: '9876543210', line1: '221B Lake Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
  slot: { label: 'Tomorrow' },
  payment: { method: 'upi' }
};
const guest = { name: 'Guest Shopper', phone: GUEST_PHONE, email: 'guest@example.com' };
const one = (productId = 'P-MID', qty = 1) => [{ productId, qty }];

let mongo;
let token;
let otherToken;
let adminToken;

const auth = (req, value = token) => req.set({ Authorization: `Bearer ${value}` });
const place = (body, value = token) => auth(request(app).post('/api/orders'), value).send({ items: one(), ...details, ...body });
const placeGuest = body => request(app).post('/api/orders').send({ items: one(), ...details, guest, ...body });
const stockOf = async productId => (await Product.findOne({ productId })).quantity;
const patch = (orderNo, body, value = token) => auth(request(app).patch(`/api/orders/${orderNo}`), value).send(body);
const setStatus = (orderNo, status, value = adminToken) =>
  auth(request(app).patch(`/api/admin/orders/${orderNo}/status`), value).send({ status });
const advanceTo = async (orderNo, statuses) => {
  for (const status of statuses) assert.equal((await setStatus(orderNo, status)).status, 200);
};

async function signIn(emailId, role) {
  await User.create({ username: 'Shopper', emailId, age: 21, password: 'secret123', role });
  const res = await request(app).post('/api/login').send({ emailId, password: 'secret123' });
  return res.body.data.token;
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'bazaarmart_orders_test' });
  await Promise.all([User.init(), Product.init(), Order.init()]);
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([User, Product, Order, Counter].map(model => model.deleteMany({})));
  const base = { category: 'Audio', description: 'Small.', images: ['a.jpg'], arrivesInDays: 2 };
  await Product.create([
    { ...base, productId: 'P-CHEAP', productName: 'Cable', productPrice: 300, quantity: 10 },
    { ...base, productId: 'P-MID', productName: 'Earbuds', productPrice: 2000, quantity: 5 },
    { ...base, productId: 'P-LAST', productName: 'Speaker', productPrice: 5000, quantity: 1 }
  ]);
  token = await signIn('asha@example.com');
  otherToken = await signIn('ravi@example.com');
  adminToken = await signIn('admin@example.com', 'admin');
});

describe('checkout', () => {
  it('lets a guest check out without a token', async () => {
    const res = await placeGuest();
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user, null);
    assert.equal(res.body.data.guest.phone, GUEST_PHONE);
    assert.equal(res.body.data.orderNo, 'BM-2041');
    assert.match(res.body.message, /BM-2041/);
    assert.equal(await stockOf('P-MID'), 4);
  });

  it('attaches a logged-in order to the user and ignores any guest block', async () => {
    const res = await place({ guest });
    assert.equal(res.status, 201);
    assert.ok(res.body.data.user);
    assert.equal(res.body.data.guest?.phone, undefined);
  });

  it('treats a bad token as a guest', async () => {
    assert.equal((await place({}, 'not-a-token')).status, 400);
    assert.equal((await place({ guest }, 'not-a-token')).status, 201);
  });

  it('requires guest details when there is no token', async () => {
    const send = body => request(app).post('/api/orders').send({ items: one(), ...details, ...body });
    assert.equal((await send({})).status, 400);
    assert.equal((await send({ guest: { name: 'No Phone' } })).status, 400);
    assert.equal((await send({ guest: { name: 'Bad', phone: '123' } })).status, 400);
    assert.equal((await send({ guest: { ...guest, email: 'nope' } })).status, 400);
    assert.equal(await stockOf('P-MID'), 5);
  });

  it('sets placed status, an event, a courier, an ETA and a hidden delivery OTP', async () => {
    const { body } = await place();
    assert.equal(body.data.status, 'placed');
    assert.equal(body.data.events[0].status, 'placed');
    assert.ok(body.data.courier.name);
    assert.ok(new Date(body.data.etaAt) > new Date());
    assert.equal(body.data.deliveryOtp, undefined);
    assert.match((await Order.findOne().select('+deliveryOtp')).deliveryOtp, /^\d{4}$/);
  });

  it('never trusts client prices or totals', async () => {
    const res = await place({
      items: [{ productId: 'P-MID', qty: 2, price: 1 }], subtotal: 1, total: 1, delivery: 0, status: 'delivered', user: 'x'
    });
    assert.equal(res.body.data.subtotal, 4000);
    assert.equal(res.body.data.total, 4000);
    assert.equal(res.body.data.status, 'placed');
  });

  it('rejects each invalid field with 400 and leaves stock alone', async () => {
    const bad = [
      { items: [] }, { items: one('P-MID', 0) }, { items: one('P-MID', 1.5) },
      { address: undefined }, { address: 'home' }, { address: { ...details.address, pincode: '12' } },
      { address: { ...details.address, phone: '123' } }, { address: { name: 'Only' } },
      { slot: undefined }, { slot: { label: ' ' } }, { slot: { label: 'Soon', date: 'not-a-date' } },
      { payment: undefined }, { payment: { method: 'crypto' } },
      { gift: { note: 'x'.repeat(201) } },
      { gst: { invoice: true } }, { gst: { invoice: true, gstin: 'ABC' } },
      { coupon: 'NOPE' }
    ];
    for (const body of bad) assert.equal((await place(body)).status, 400, JSON.stringify(body));
    assert.equal(await stockOf('P-MID'), 5);
    assert.equal(await Order.countDocuments(), 0);
  });

  it('stores gift, note and GST details', async () => {
    const res = await place({ gift: { wrap: true, note: 'Happy birthday' }, gst: { invoice: true, gstin: '33aaaaa0000a1z5' } });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.gift.wrap, true);
    assert.equal(res.body.data.gift.note, 'Happy birthday');
    assert.equal(res.body.data.gst.gstin, '33AAAAA0000A1Z5');
  });

  it('never stores card details', async () => {
    const payment = { method: 'card', cardNumber: '4111111111111111', cvv: '123' };
    const res = await place({ payment });
    assert.equal(JSON.stringify(res.body).includes('4111'), false);
    const stored = await Order.findOne().lean();
    assert.equal(JSON.stringify(stored).includes('4111'), false);
  });

  it('simulates payment: UPI, card and netbanking are paid, COD is pending', async () => {
    for (const method of ['upi', 'card', 'netbanking']) {
      assert.equal((await place({ payment: { method } })).body.data.payment.status, 'paid', method);
    }
    assert.equal((await place({ payment: { method: 'cod' } })).body.data.payment.status, 'pending');
  });
});

describe('pricing', () => {
  it('charges a flat delivery fee below the threshold, and none above it', async () => {
    const small = await place({ items: one('P-CHEAP') });
    assert.equal(small.body.data.delivery, 49);
    assert.equal(small.body.data.total, 349);
    const large = await place({ items: one('P-MID') });
    assert.equal(large.body.data.delivery, 0);
  });

  it('applies coupon codes in any case', async () => {
    const welcome = await place({ items: one('P-MID'), coupon: 'welcome10' });
    assert.equal(welcome.body.data.coupon, 200);
    assert.equal(welcome.body.data.couponCode, 'WELCOME10');
    assert.equal(welcome.body.data.total, 1800);

    const flat = await place({ items: one('P-MID'), coupon: 'BAZAAR200' });
    assert.equal(flat.body.data.total, 1800);

    const shipping = await place({ items: one('P-CHEAP'), coupon: 'FREESHIP' });
    assert.equal(shipping.body.data.delivery, 0);
    assert.equal(shipping.body.data.total, 300);
  });

  it('caps the percentage discount', async () => {
    await Product.updateOne({ productId: 'P-LAST' }, { quantity: 5, productPrice: 10000 });
    const res = await place({ items: one('P-LAST'), coupon: 'WELCOME10' });
    assert.equal(res.body.data.coupon, 500);
  });

  it('rejects a coupon below its minimum and restores stock', async () => {
    const res = await place({ items: one('P-CHEAP'), coupon: 'BAZAAR200' });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /at least ₹1500/);
    assert.equal(await stockOf('P-CHEAP'), 10);
  });
});

describe('stock', () => {
  it('decrements on order', async () => {
    await place({ items: one('P-MID', 3) });
    assert.equal(await stockOf('P-MID'), 2);
  });

  it('returns 409 when stock is short and changes nothing', async () => {
    const res = await place({ items: one('P-MID', 6) });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /Only 5 of Earbuds left/);
    assert.equal(await stockOf('P-MID'), 5);
    assert.equal(await Order.countDocuments(), 0);
  });

  it('rolls back earlier items when a later one is short', async () => {
    const res = await place({ items: [...one('P-CHEAP', 2), ...one('P-LAST', 2)] });
    assert.equal(res.status, 409);
    assert.equal(await stockOf('P-CHEAP'), 10);
    assert.equal(await stockOf('P-LAST'), 1);
  });

  it('rolls back when a later product does not exist', async () => {
    const res = await place({ items: [...one('P-CHEAP'), ...one('NOPE')] });
    assert.equal(res.status, 404);
    assert.equal(await stockOf('P-CHEAP'), 10);
  });

  it('rolls back if saving the order fails', async () => {
    const realCreate = Order.create;
    Order.create = async () => { throw new Error('database write failed'); };
    const realError = console.error;
    console.error = () => {};
    try {
      assert.equal((await place()).status, 500);
    } finally {
      Order.create = realCreate;
      console.error = realError;
    }
    assert.equal(await stockOf('P-MID'), 5);
  });

  it('sells the last unit to only one of many simultaneous buyers', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => place({ items: one('P-LAST') })));
    assert.equal(results.filter(res => res.status === 201).length, 1);
    assert.equal(results.filter(res => res.status === 409).length, 7);
    assert.equal(await stockOf('P-LAST'), 0);
  });
});

describe('reading orders', () => {
  it('filters own orders by status group', async () => {
    const { body: live } = await place();
    const { body: toCancel } = await place();
    const { body: done } = await place();
    await place({}, otherToken);
    await patch(toCancel.data.orderNo, { cancel: true });
    await advanceTo(done.data.orderNo, ['packed', 'shipped', 'out_for_delivery', 'delivered']);

    const numbers = async status => {
      const res = await auth(request(app).get('/api/orders').query(status ? { status } : {}));
      return res.body.data.map(order => order.orderNo);
    };
    assert.deepEqual(await numbers('live'), [live.data.orderNo]);
    assert.deepEqual(await numbers('delivered'), [done.data.orderNo]);
    assert.deepEqual(await numbers('cancelled'), [toCancel.data.orderNo]);
    assert.deepEqual(await numbers('returns'), []);
    assert.equal((await numbers()).length, 3);

    await setStatus(done.data.orderNo, 'returned');
    assert.deepEqual(await numbers('returns'), [done.data.orderNo]);
  });

  it('rejects an unknown status filter', async () => {
    assert.equal((await auth(request(app).get('/api/orders').query({ status: 'lost' }))).status, 400);
  });

  it('shows an order to its owner and 403s anyone else', async () => {
    const { orderNo } = (await place()).body.data;
    assert.equal((await auth(request(app).get(`/api/orders/${orderNo}`))).status, 200);
    assert.equal((await auth(request(app).get(`/api/orders/${orderNo}`), otherToken)).status, 403);
    assert.equal((await auth(request(app).get(`/api/orders/${orderNo}/track`), otherToken)).status, 403);
    assert.equal((await patch(orderNo, { cancel: true }, otherToken)).status, 403);
    assert.equal((await request(app).get(`/api/orders/${orderNo}`)).status, 401);
  });

  it('lets an admin view any order but not change it as the customer', async () => {
    const { orderNo } = (await place()).body.data;
    assert.equal((await auth(request(app).get(`/api/orders/${orderNo}`), adminToken)).status, 200);
    assert.equal((await patch(orderNo, { cancel: true }, adminToken)).status, 403);
  });

  it('returns 404 for an unknown order', async () => {
    assert.equal((await auth(request(app).get('/api/orders/BM-9999'))).status, 404);
  });

  it('never exposes the delivery OTP on order reads', async () => {
    const { orderNo } = (await place()).body.data;
    await advanceTo(orderNo, ['packed', 'shipped', 'out_for_delivery']);
    const single = await auth(request(app).get(`/api/orders/${orderNo}`));
    const list = await auth(request(app).get('/api/orders'));
    assert.equal(single.body.data.deliveryOtp, undefined);
    assert.equal(list.body.data[0].deliveryOtp, undefined);
  });
});

describe('guest access', () => {
  let orderNo;
  const asGuest = (path, phone) => request(app).get(path).query(phone === undefined ? {} : { phone });

  beforeEach(async () => {
    orderNo = (await placeGuest()).body.data.orderNo;
  });

  it('allows the matching phone in any common form', async () => {
    for (const phone of [GUEST_PHONE, '9876543210', ' 919876543210']) {
      assert.equal((await asGuest(`/api/orders/${orderNo}`, phone)).status, 200, phone);
    }
  });

  it('handles an unencoded + in the URL', async () => {
    assert.equal((await request(app).get(`/api/orders/${orderNo}/track?phone=+919876543210`)).status, 200);
  });

  it('rejects a wrong phone with 403 and no phone with 400', async () => {
    assert.equal((await asGuest(`/api/orders/${orderNo}`, '+919000000000')).status, 403);
    assert.equal((await asGuest(`/api/orders/${orderNo}/track`, '+919000000000')).status, 403);
    assert.equal((await asGuest(`/api/orders/${orderNo}`)).status, 400);
  });

  it('never lets another logged-in user in without the phone', async () => {
    assert.equal((await auth(request(app).get(`/api/orders/${orderNo}`))).status, 403);
  });

  it('lets a guest cancel with the matching phone only', async () => {
    const send = phone => request(app).patch(`/api/orders/${orderNo}`).query({ phone }).send({ cancel: true });
    assert.equal((await send('+919000000000')).status, 403);
    assert.equal((await send(GUEST_PHONE)).status, 200);
    assert.equal(await stockOf('P-MID'), 5);
  });

  it('shows the delivery OTP to a guest owner when out for delivery', async () => {
    await advanceTo(orderNo, ['packed', 'shipped', 'out_for_delivery']);
    const res = await asGuest(`/api/orders/${orderNo}/track`, GUEST_PHONE);
    assert.match(res.body.data.deliveryOtp, /^\d{4}$/);
  });
});

describe('tracking', () => {
  const track = (orderNo, value = token) => auth(request(app).get(`/api/orders/${orderNo}/track`), value);

  it('returns events, ETA and courier', async () => {
    const { orderNo } = (await place()).body.data;
    const { body } = await track(orderNo);
    assert.equal(body.data.status, 'placed');
    assert.equal(body.data.events.length, 1);
    assert.ok(body.data.etaAt);
    assert.ok(body.data.courier.name);
  });

  it('shows the delivery OTP only to the owner and only when out for delivery', async () => {
    const { orderNo } = (await place()).body.data;
    await advanceTo(orderNo, ['packed', 'shipped']);
    assert.equal((await track(orderNo)).body.data.deliveryOtp, undefined);

    await setStatus(orderNo, 'out_for_delivery');
    assert.match((await track(orderNo)).body.data.deliveryOtp, /^\d{4}$/);
    assert.equal((await track(orderNo, adminToken)).body.data.deliveryOtp, undefined);

    await setStatus(orderNo, 'delivered');
    assert.equal((await track(orderNo)).body.data.deliveryOtp, undefined);
  });

  it('shrinks the ETA window as the status advances', async () => {
    const { orderNo } = (await place()).body.data;
    const windowLength = async () => {
      const { etaWindow } = (await track(orderNo)).body.data;
      return new Date(etaWindow.to) - new Date(etaWindow.from);
    };
    const sizes = [await windowLength()];
    for (const status of ['packed', 'shipped', 'out_for_delivery']) {
      await setStatus(orderNo, status);
      sizes.push(await windowLength());
    }
    assert.deepEqual(sizes, [...sizes].sort((a, b) => b - a));
    assert.equal(new Set(sizes).size, 4);

    await setStatus(orderNo, 'delivered');
    assert.equal((await track(orderNo)).body.data.etaWindow, null);
  });
});

describe('changing an order', () => {
  it('changes the slot and moves the ETA to its date', async () => {
    const { orderNo } = (await place()).body.data;
    const res = await patch(orderNo, { slot: { label: 'Pick a day', date: '2030-01-15' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.slot.label, 'Pick a day');
    assert.equal(new Date(res.body.data.etaAt).getUTCFullYear(), 2030);
  });

  it('saves a leave-at-door note', async () => {
    const { orderNo } = (await place()).body.data;
    const res = await patch(orderNo, { leaveAtDoor: true, deliveryNote: 'By the blue gate' });
    assert.equal(res.body.data.leaveAtDoor, true);
    assert.equal(res.body.data.deliveryNote, 'By the blue gate');
  });

  it('rejects an empty or invalid change', async () => {
    const { orderNo } = (await place()).body.data;
    assert.equal((await patch(orderNo, {})).status, 400);
    assert.equal((await patch(orderNo, { slot: {} })).status, 400);
    assert.equal((await patch(orderNo, { leaveAtDoor: 'yes' })).status, 400);
    assert.equal((await patch(orderNo, { deliveryNote: 'x'.repeat(201) })).status, 400);
  });

  it('stops slot changes once out for delivery, and notes once delivered', async () => {
    const { orderNo } = (await place()).body.data;
    await advanceTo(orderNo, ['packed', 'shipped', 'out_for_delivery']);
    assert.equal((await patch(orderNo, { slot: { label: 'Later' } })).status, 409);
    assert.equal((await patch(orderNo, { leaveAtDoor: true })).status, 200);
    await setStatus(orderNo, 'delivered');
    assert.equal((await patch(orderNo, { leaveAtDoor: false })).status, 409);
  });
});

describe('cancelling', () => {
  it('restores stock and refunds a paid order', async () => {
    const { orderNo } = (await place({ items: one('P-MID', 2) })).body.data;
    assert.equal(await stockOf('P-MID'), 3);
    const res = await patch(orderNo, { cancel: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'cancelled');
    assert.equal(res.body.data.payment.status, 'refunded');
    assert.equal(res.body.data.events.at(-1).status, 'cancelled');
    assert.equal(await stockOf('P-MID'), 5);
  });

  it('leaves an unpaid COD order unrefunded', async () => {
    const { orderNo } = (await place({ payment: { method: 'cod' } })).body.data;
    assert.equal((await patch(orderNo, { cancel: true })).body.data.payment.status, 'pending');
  });

  it('is allowed while packed', async () => {
    const { orderNo } = (await place()).body.data;
    await setStatus(orderNo, 'packed');
    assert.equal((await patch(orderNo, { cancel: true })).status, 200);
  });

  it('is refused once shipped, and stock stays down', async () => {
    const { orderNo } = (await place()).body.data;
    await advanceTo(orderNo, ['packed', 'shipped']);
    const res = await patch(orderNo, { cancel: true });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /can no longer be cancelled/);
    assert.equal(await stockOf('P-MID'), 4);
  });

  it('restores stock only once, even with simultaneous cancels', async () => {
    const { orderNo } = (await place()).body.data;
    const results = await Promise.all(Array.from({ length: 5 }, () => patch(orderNo, { cancel: true })));
    assert.equal(results.filter(res => res.status === 200).length, 1);
    assert.equal(await stockOf('P-MID'), 5);
  });

  it('cannot cancel twice', async () => {
    const { orderNo } = (await place()).body.data;
    await patch(orderNo, { cancel: true });
    assert.equal((await patch(orderNo, { cancel: true })).status, 409);
    assert.equal(await stockOf('P-MID'), 5);
  });
});

describe('admin status changes', () => {
  it('advances one step at a time and appends an event each time', async () => {
    const { orderNo } = (await place()).body.data;
    await advanceTo(orderNo, ['packed', 'shipped', 'out_for_delivery', 'delivered']);
    const res = await auth(request(app).get(`/api/orders/${orderNo}`));
    assert.deepEqual(res.body.data.events.map(event => event.status), ['placed', 'packed', 'shipped', 'out_for_delivery', 'delivered']);
  });

  it('refuses to skip or go backwards', async () => {
    const { orderNo } = (await place()).body.data;
    assert.equal((await setStatus(orderNo, 'delivered')).status, 409);
    await setStatus(orderNo, 'packed');
    assert.equal((await setStatus(orderNo, 'placed')).status, 409);
    assert.equal((await setStatus(orderNo, 'packed')).status, 409);
  });

  it('rejects an unknown status and order, and requires an admin', async () => {
    const { orderNo } = (await place()).body.data;
    assert.equal((await setStatus(orderNo, 'lost')).status, 400);
    assert.equal((await setStatus('BM-9999', 'packed')).status, 404);
    assert.equal((await setStatus(orderNo, 'packed', token)).status, 403);
    assert.equal((await request(app).patch(`/api/admin/orders/${orderNo}/status`).send({ status: 'packed' })).status, 401);
  });

  it('marks a COD order paid on delivery', async () => {
    const { orderNo } = (await place({ payment: { method: 'cod' } })).body.data;
    await advanceTo(orderNo, ['packed', 'shipped', 'out_for_delivery']);
    const res = await setStatus(orderNo, 'delivered');
    assert.equal(res.body.data.payment.status, 'paid');
  });

  it('a return refunds the order and restores stock', async () => {
    const { orderNo } = (await place()).body.data;
    await advanceTo(orderNo, ['packed', 'shipped', 'out_for_delivery', 'delivered']);
    assert.equal(await stockOf('P-MID'), 4);
    const res = await setStatus(orderNo, 'returned');
    assert.equal(res.body.data.payment.status, 'refunded');
    assert.equal(await stockOf('P-MID'), 5);
  });

  it('can cancel before shipping, restoring stock, but not after', async () => {
    const first = (await place()).body.data.orderNo;
    assert.equal((await setStatus(first, 'cancelled')).status, 200);
    assert.equal(await stockOf('P-MID'), 5);

    const second = (await place()).body.data.orderNo;
    await advanceTo(second, ['packed', 'shipped']);
    assert.equal((await setStatus(second, 'cancelled')).status, 409);
  });

  it('applies a step only once when two admins act together', async () => {
    const { orderNo } = (await place()).body.data;
    const results = await Promise.all([setStatus(orderNo, 'packed'), setStatus(orderNo, 'packed')]);
    assert.deepEqual(results.map(res => res.status).sort(), [200, 409]);
    const order = await Order.findOne({ orderNo });
    assert.equal(order.events.filter(event => event.status === 'packed').length, 1);
  });
});

describe('colours and quotes', () => {
  const quote = body => request(app).post('/api/orders/quote').send(body);

  beforeEach(async () => {
    await Product.updateOne({ productId: 'P-MID' }, { colours: ['Black', 'Sand'] });
  });

  it('keeps the chosen colour on the order line', async () => {
    const res = await placeGuest({ items: [{ productId: 'P-MID', qty: 1, colour: 'Sand' }] });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.items[0].colour, 'Sand');
  });

  it('splits two colours of one product into two lines and takes stock for both', async () => {
    const before = await stockOf('P-MID');
    const res = await placeGuest({
      items: [{ productId: 'P-MID', qty: 1, colour: 'Sand' }, { productId: 'P-MID', qty: 2, colour: 'Black' }]
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.items.length, 2);
    assert.equal(await stockOf('P-MID'), before - 3);
  });

  it('rejects a colour the product does not come in, without touching stock', async () => {
    const before = await stockOf('P-MID');
    const res = await placeGuest({ items: [{ productId: 'P-MID', qty: 1, colour: 'Teal' }] });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /doesn't come in Teal/);
    assert.equal(await stockOf('P-MID'), before);
  });

  it('quotes from database prices, ignoring any price the client sends', async () => {
    const { productPrice } = await Product.findOne({ productId: 'P-MID' });
    const res = await quote({ items: [{ productId: 'P-MID', qty: 2, price: 1 }] });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.lines[0].price, productPrice);
    assert.equal(res.body.data.subtotal, productPrice * 2);
    assert.equal(res.body.data.total, res.body.data.subtotal + res.body.data.delivery);
  });

  it('applies a coupon in the quote exactly as the order would', async () => {
    const items = one('P-MID', 2);
    const quoted = (await quote({ items, coupon: 'welcome10' })).body.data;
    const order = (await placeGuest({ items, coupon: 'welcome10' })).body.data;
    assert.equal(quoted.total, order.total);
    assert.equal(quoted.coupon, order.coupon);
    assert.equal(quoted.couponCode, 'WELCOME10');
  });

  it('does not reserve stock or create an order', async () => {
    const before = await stockOf('P-MID');
    const orders = await Order.countDocuments();
    await quote({ items: one() });
    assert.equal(await stockOf('P-MID'), before);
    assert.equal(await Order.countDocuments(), orders);
  });

  it('explains a quote it cannot honour', async () => {
    assert.equal((await quote({ items: [] })).status, 400);
    assert.equal((await quote({ items: one(), coupon: 'NOPE' })).status, 400);
    assert.equal((await quote({ items: one('P-GONE') })).status, 404);
    assert.equal((await quote({ items: one('P-MID', 99999) })).status, 409);
    const colour = await quote({ items: [{ productId: 'P-MID', qty: 1, colour: 'Teal' }] });
    assert.equal(colour.status, 400);
  });

  it('counts both colours of a product against its stock in a quote', async () => {
    const stock = await stockOf('P-MID');
    const res = await quote({
      items: [{ productId: 'P-MID', qty: stock, colour: 'Sand' }, { productId: 'P-MID', qty: 1, colour: 'Black' }]
    });
    assert.equal(res.status, 409);
  });
});

describe('admin order list', () => {
  const list = (query = '', value = adminToken) => auth(request(app).get(`/api/admin/orders${query}`), value);

  it('lists every customer and guest order, newest first, with the next step', async () => {
    const mine = (await place()).body.data;
    const theirs = (await placeGuest()).body.data;
    const res = await list();
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 2);
    const [first, second] = res.body.data;
    assert.equal(first.orderNo, theirs.orderNo);
    assert.equal(first.customer, 'Guest Shopper');
    assert.equal(first.isGuest, true);
    assert.equal(second.orderNo, mine.orderNo);
    assert.equal(second.customer, 'Shopper');
    assert.equal(first.nextStatus, 'packed');
    assert.equal(first.canCancel, true);
  });

  it('keeps contact details and the delivery OTP out of the list', async () => {
    await placeGuest();
    const { text } = await list();
    assert.doesNotMatch(text, new RegExp(guest.email));
    assert.doesNotMatch(text, /\+91|deliveryOtp|221B/);
  });

  it('filters by status group and rejects an unknown one', async () => {
    const { orderNo } = (await place()).body.data;
    await advanceTo(orderNo, ['packed', 'shipped', 'out_for_delivery', 'delivered']);
    assert.equal((await list('?status=live')).body.count, 0);
    assert.equal((await list('?status=delivered')).body.count, 1);
    assert.equal((await list('?status=lost')).status, 400);
  });

  it('is for admins only', async () => {
    assert.equal((await list('', token)).status, 403);
    assert.equal((await request(app).get('/api/admin/orders')).status, 401);
  });
});
