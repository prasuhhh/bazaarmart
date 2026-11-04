import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Counter from '../models/Counter.js';
import Kit from '../models/Kit.js';
import Order from '../models/Order.js';
import Otp from '../models/Otp.js';
import Product from '../models/Product.js';
import Question from '../models/Question.js';
import Review from '../models/Review.js';
import Shelf from '../models/Shelf.js';
import User from '../models/User.js';
import Zone from '../models/Zone.js';

const MODELS = [Counter, Kit, Order, Otp, Product, Question, Review, Shelf, User, Zone];
const objectId = () => new mongoose.Types.ObjectId();
const orderFields = () => ({
  user: objectId(),
  items: [{ productId: 'A-01-117', name: 'Earbuds', price: 999, qty: 1 }],
  subtotal: 999,
  total: 999
});
const productFields = { productName: 'Earbuds', productPrice: 999, category: 'Audio', quantity: 3, description: 'Small.' };

let mongo;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'bazaarmart_models_test' });
  await Promise.all(MODELS.map(model => model.init()));
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all(MODELS.map(model => model.deleteMany({})));
});

describe('User', () => {
  it('hashes the password on save with cost 10', async () => {
    const user = await User.create({ emailId: 'a@example.com', password: 'secret1' });
    const stored = await User.findById(user._id).select('+password');
    assert.match(stored.password, /^\$2[aby]\$10\$/);
  });

  it('does not hash the password a second time on an unrelated save', async () => {
    const user = await User.create({ emailId: 'a@example.com', password: 'secret1' });
    const stored = await User.findById(user._id).select('+password');
    stored.age = 30;
    await stored.save();
    assert.equal(await (await User.findById(user._id).select('+password')).comparePassword('secret1'), true);
  });

  it('comparePassword accepts the right password and rejects others', async () => {
    const created = await User.create({ emailId: 'a@example.com', password: 'secret1' });
    const user = await User.findById(created._id).select('+password');
    assert.equal(await user.comparePassword('secret1'), true);
    assert.equal(await user.comparePassword('wrong-one'), false);
  });

  it('comparePassword is false for an account with no password', async () => {
    const user = await User.create({ phone: '+919876543210' });
    assert.equal(await user.comparePassword('anything'), false);
  });

  it('never exposes the password by default or in JSON', async () => {
    const user = await User.create({ emailId: 'a@example.com', password: 'secret1' });
    assert.equal((await User.findById(user._id)).password, undefined);
    const json = JSON.parse(JSON.stringify(await User.findById(user._id).select('+password')));
    assert.equal(json.password, undefined);
    assert.equal(json.__v, undefined);
  });

  it('allows many phone-only and many email-only accounts', async () => {
    await User.create([{ phone: '+919876543210' }, { phone: '+919876543211' }]);
    await User.create([{ emailId: 'a@example.com' }, { emailId: 'b@example.com' }]);
    assert.equal(await User.countDocuments(), 4);
  });

  it('rejects a duplicate email or phone', async () => {
    await User.create({ emailId: 'a@example.com', phone: '+919876543210' });
    await assert.rejects(User.create({ emailId: 'A@example.com' }), { code: 11000 });
    await assert.rejects(User.create({ phone: '+919876543210' }), { code: 11000 });
  });

  it('requires an email or a phone', async () => {
    await assert.rejects(User.create({ username: 'Nobody' }), { name: 'ValidationError' });
  });

  it('validates phone, age and role', async () => {
    await assert.rejects(User.create({ phone: '12345' }), { name: 'ValidationError' });
    await assert.rejects(User.create({ emailId: 'a@example.com', age: 121 }), { name: 'ValidationError' });
    await assert.rejects(User.create({ emailId: 'a@example.com', role: 'owner' }), { name: 'ValidationError' });
  });

  it('defaults role and notification preferences', async () => {
    const user = await User.create({ emailId: 'a@example.com' });
    assert.equal(user.role, 'user');
    assert.deepEqual(user.toObject().notificationPrefs, { orderUpdates: true, priceDrops: true, newDrops: true });
  });

  it('stores only a card label and last 4 digits', async () => {
    const paymentMethods = [{ type: 'card', label: 'HDFC card', last4: '4111111111111111' }];
    await assert.rejects(User.create({ emailId: 'a@example.com', paymentMethods }), { name: 'ValidationError' });
    const user = await User.create({ emailId: 'a@example.com', paymentMethods: [{ type: 'card', label: 'HDFC card', last4: '4021' }] });
    assert.equal(user.paymentMethods[0].last4, '4021');
  });

  it('replaces an old non-sparse email index when indexes are synced', async () => {
    await User.collection.dropIndex('emailId_1');
    await User.collection.createIndex({ emailId: 1 }, { unique: true, background: true });
    await User.syncIndexes();
    await User.create([{ phone: '+919876543210' }, { phone: '+919876543211' }]);
    assert.equal(await User.countDocuments(), 2);
  });
});

describe('Product', () => {
  it('accepts the six lab fields on their own', async () => {
    const product = await Product.create({ productId: 'P001', ...productFields });
    assert.equal(product.connectivity, 'n/a');
  });

  it('stores a full SKU product and returns specs as plain JSON', async () => {
    await Product.create({
      productId: 'A-01-117', ...productFields, zoneCode: 'a', bay: 1, bayName: 'Earbuds', brand: 'Noise',
      colours: ['Black'], use: ['gym'], connectivity: 'wireless', specs: { Battery: '30 h', Weight: '48 g' },
      images: ['a.jpg'], seller: 'BazaarMart', warrantyMonths: 12, arrivesInDays: 2, isNew: true
    });
    const json = JSON.parse(JSON.stringify(await Product.findOne({ productId: 'A-01-117' })));
    assert.equal(json.zoneCode, 'A');
    assert.equal(json.isNew, true);
    assert.deepEqual(json.specs, { Battery: '30 h', Weight: '48 g' });
  });

  it('keeps insert and update behaviour correct despite the isNew field', async () => {
    await Product.insertMany([{ productId: 'N1', ...productFields, isNew: true }, { productId: 'N2', ...productFields }]);
    for (const productId of ['N1', 'N2']) {
      const product = await Product.findOne({ productId });
      product.productPrice = 1500;
      await product.save();
    }
    assert.equal(await Product.countDocuments(), 2);
    assert.equal((await Product.findOne({ productId: 'N1' })).isNew, true);
    assert.equal((await Product.findOne({ productId: 'N2' })).isNew, false);
    assert.equal((await Product.findOne({ productId: 'N2' })).productPrice, 1500);

    const unsaved = new Product({ productId: 'N3', ...productFields, isNew: false });
    await unsaved.save();
    unsaved.quantity = 9;
    await unsaved.save();
    assert.equal(await Product.countDocuments({ productId: 'N3', quantity: 9 }), 1);
  });

  it('rejects an unknown zone, bad connectivity and negative values', async () => {
    await assert.rejects(Product.create({ productId: 'X', ...productFields, zoneCode: 'Z' }), { name: 'ValidationError' });
    await assert.rejects(Product.create({ productId: 'X', ...productFields, connectivity: 'bluetooth' }), { name: 'ValidationError' });
    await assert.rejects(Product.create({ productId: 'X', ...productFields, productPrice: -1 }), { name: 'ValidationError' });
    await assert.rejects(Product.create({ productId: 'X', ...productFields, quantity: -1 }), { name: 'ValidationError' });
  });

  it('text search covers name, brand and category', async () => {
    await Product.create([
      { productId: 'A', ...productFields, productName: 'Pulse Buds', brand: 'Sony', category: 'Audio' },
      { productId: 'B', ...productFields, productName: 'Linen Shirt', brand: 'Fabindia', category: 'Style' }
    ]);
    const search = async term => (await Product.find({ $text: { $search: term } })).map(p => p.productId);
    assert.deepEqual(await search('pulse'), ['A']);
    assert.deepEqual(await search('fabindia'), ['B']);
    assert.deepEqual(await search('style'), ['B']);
  });

  it('has the zone and bay index', async () => {
    assert.ok((await Product.collection.indexes()).some(index => index.key.zoneCode === 1 && index.key.bay === 1));
  });
});

describe('Shelf', () => {
  it('gives each shelf a different unguessable shareId', async () => {
    const [a, b] = await Shelf.create([{ user: objectId(), name: 'New desk' }, { user: objectId(), name: 'Trip kit' }]);
    assert.notEqual(a.shareId, b.shareId);
    assert.match(a.shareId, /^[\w-]{12}$/);
  });

  it('records the saved price and time for each item', async () => {
    const shelf = await Shelf.create({ user: objectId(), name: 'New desk', items: [{ product: 'A-01-117', savedPrice: 999 }] });
    assert.ok(shelf.items[0].savedAt instanceof Date);
  });
});

describe('Order', () => {
  it('numbers orders from BM-2041 upward', async () => {
    const first = await Order.create(orderFields());
    const second = await Order.create(orderFields());
    assert.equal(first.orderNo, 'BM-2041');
    assert.equal(second.orderNo, 'BM-2042');
  });

  it('gives simultaneous orders different numbers', async () => {
    const orders = await Promise.all(Array.from({ length: 20 }, () => Order.create(orderFields())));
    assert.equal(new Set(orders.map(order => order.orderNo)).size, 20);
  });

  it('starts with a placed event and does not add one on later saves', async () => {
    const order = await Order.create(orderFields());
    assert.equal(order.events.length, 1);
    assert.equal(order.events[0].status, 'placed');
    order.status = 'packed';
    await order.save();
    assert.equal(order.events.length, 1);
    assert.equal(order.orderNo, 'BM-2041');
  });

  it('rejects an unknown status', async () => {
    await assert.rejects(Order.create({ ...orderFields(), status: 'lost' }), { name: 'ValidationError' });
  });

  it('accepts a guest with a phone, and rejects an order with no owner', async () => {
    const { user, ...fields } = orderFields();
    assert.ok(user);
    const order = await Order.create({ ...fields, guest: { name: 'Asha', phone: '+919876543210' } });
    assert.equal(order.user, null);
    await assert.rejects(Order.create(fields), { name: 'ValidationError' });
  });

  it('rejects an order with no items', async () => {
    await assert.rejects(Order.create({ ...orderFields(), items: [] }), { name: 'ValidationError' });
  });

  it('keeps the delivery OTP out of queries and JSON unless asked for', async () => {
    const order = await Order.create(orderFields());
    assert.equal(JSON.parse(JSON.stringify(order)).deliveryOtp, undefined);
    assert.equal((await Order.findById(order._id)).deliveryOtp, undefined);
    assert.match((await Order.findById(order._id).select('+deliveryOtp')).deliveryOtp, /^\d{4}$/);
  });

  it('caps the gift note at 200 characters', async () => {
    const gift = { wrap: true, note: 'x'.repeat(201) };
    await assert.rejects(Order.create({ ...orderFields(), gift }), { name: 'ValidationError' });
  });
});

describe('Zone, Review, Question, Kit and Otp', () => {
  it('Zone requires a known unique code', async () => {
    await Zone.create({ code: 'a', name: 'Audio', order: 1 });
    await assert.rejects(Zone.create({ code: 'A', name: 'Other', order: 2 }), { code: 11000 });
    await assert.rejects(Zone.create({ code: 'Z', name: 'Nope', order: 3 }), { name: 'ValidationError' });
  });

  it('Review allows one per user per product and a rating of 1 to 5', async () => {
    const fields = { product: objectId(), user: objectId(), rating: 5, text: 'Great.' };
    await Review.create(fields);
    await assert.rejects(Review.create(fields), { code: 11000 });
    await assert.rejects(Review.create({ ...fields, user: objectId(), rating: 6 }), { name: 'ValidationError' });
    await assert.rejects(Review.create({ ...fields, user: objectId(), rating: 2.5 }), { name: 'ValidationError' });
  });

  it('Question starts unanswered', async () => {
    const question = await Question.create({ product: objectId(), user: objectId(), text: 'Waterproof?' });
    assert.equal(question.answer, undefined);
  });

  it('Kit needs a query or product list', async () => {
    await assert.rejects(Kit.create({ title: 'Empty' }), { name: 'ValidationError' });
    await Kit.create({ title: 'Gift under 2000', query: { maxPrice: '2000' } });
    await Kit.create({ title: 'Desk setup', productIds: ['D-01-001'] });
    assert.equal(await Kit.countDocuments(), 2);
  });

  it('Otp expires after 5 minutes through a TTL index', async () => {
    const otp = await Otp.create({ phone: '+919876543210', codeHash: 'hash' });
    assert.ok(Math.abs(otp.expiresAt - Date.now() - 300000) < 2000);
    assert.equal(otp.attempts, 0);
    const ttl = (await Otp.collection.indexes()).find(index => index.key.expiresAt === 1);
    assert.equal(ttl.expireAfterSeconds, 0);
  });
});
