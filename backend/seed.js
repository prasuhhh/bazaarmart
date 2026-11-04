import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { demoOrders, demoUser, kits, products, zones } from './data/catalogue.js';
import { isValidEmail, isValidPassword } from './middleware/validate.js';
import Counter from './models/Counter.js';
import Kit from './models/Kit.js';
import Order from './models/Order.js';
import Otp from './models/Otp.js';
import Product from './models/Product.js';
import Question from './models/Question.js';
import Review from './models/Review.js';
import Shelf from './models/Shelf.js';
import User from './models/User.js';
import Zone from './models/Zone.js';

const ALL_MODELS = [Counter, Kit, Order, Otp, Product, Question, Review, Shelf, User, Zone];

// MongoDB can't change an existing index in place, so a database created before a
// schema change (such as emailId becoming sparse) must have its indexes rebuilt.
async function syncIndexes() {
  await Promise.all(ALL_MODELS.map(model => model.syncIndexes()));
  console.log('Indexes are up to date.');
}

// Zones and kits are fixed reference data that no screen can edit, so these
// writes only keep them in line with data/catalogue.js.
async function seedZonesAndKits() {
  await Promise.all(zones.map(({ code, ...fields }) =>
    Zone.updateOne({ code }, { $set: fields }, { upsert: true })));
  // One at a time, because the store map shows kits in the order they were created.
  for (const { title, query } of kits) {
    await Kit.updateOne({ title }, { $set: { query } }, { upsert: true });
  }
  console.log(`Zones ready: ${zones.length}. Kits ready: ${kits.length}.`);
}

// Only adds SKUs that are missing, so admin edits and live stock levels are kept.
async function seedProducts() {
  const existing = new Set(await Product.distinct('productId'));
  const missing = products.filter(product => !existing.has(product.productId));
  if (missing.length) await Product.insertMany(missing);
  console.log(`Products added: ${missing.length}. Already there: ${products.length - missing.length}.`);
}

const OLD_IMAGE_HOST = /picsum\.photos/;

// Images are generated files, so they always follow data/catalogue.js. Nothing else on
// a product changes, and timestamps stay put so the "new drops" order doesn't shift.
async function refreshImages() {
  await Product.bulkWrite(products.map(({ productId, images }) => ({
    updateOne: { filter: { productId }, update: { $set: { images } }, timestamps: false }
  })));

  // Orders keep a copy of the image from when they were placed.
  await Order.bulkWrite(products.map(({ productId, images }) => ({
    updateMany: {
      filter: { items: { $elemMatch: { productId, image: OLD_IMAGE_HOST } } },
      update: { $set: { 'items.$[line].image': images[0] } },
      arrayFilters: [{ 'line.productId': productId, 'line.image': OLD_IMAGE_HOST }],
      timestamps: false
    }
  })));
  console.log(`Images ready: ${products.length} products.`);
}

function seedCredentials(prefix) {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!isValidEmail(email) || !isValidPassword(password)) return null;
  return { emailId: email.toLowerCase().trim(), password };
}

async function seedAdmin() {
  const credentials = seedCredentials('SEED_ADMIN');
  if (!credentials) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (at least 6 characters) in backend/.env');
  }
  const { emailId, password } = credentials;

  const existing = await User.findOne({ emailId });
  if (existing?.role === 'admin') {
    console.log(`Admin already exists: ${emailId}`);
    return;
  }

  // A normal account holding this email gets its password replaced as well as being
  // promoted. Otherwise anyone who registered the address first would become admin
  // with a password of their own choosing.
  const admin = existing ?? new User({ emailId, username: 'Store Admin', age: 30 });
  admin.role = 'admin';
  admin.password = password;
  await admin.save();
  console.log(`Admin ready: ${emailId}`);
}

async function buildOrder(user, { items, ...fields }) {
  const lines = await Promise.all(items.map(async ([productId, qty]) => {
    const product = await Product.findOne({ productId });
    if (!product) throw new Error(`Demo order needs missing product ${productId}.`);
    return { productId, name: product.productName, price: product.productPrice, qty, image: product.images[0] };
  }));
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  return { ...fields, user: user._id, items: lines, subtotal, total: subtotal };
}

async function seedDemoUser() {
  const credentials = seedCredentials('SEED_DEMO');
  if (!credentials) {
    console.log('Demo user skipped: set SEED_DEMO_EMAIL and SEED_DEMO_PASSWORD to add one.');
    return;
  }

  let user = await User.findOne({ emailId: credentials.emailId });
  if (!user) user = await User.create({ ...demoUser, ...credentials });

  if (await Order.exists({ user: user._id })) {
    console.log(`Demo user already has orders: ${credentials.emailId}`);
    return;
  }
  // One at a time, so order numbers follow the list.
  for (const order of demoOrders) await Order.create(await buildOrder(user, order));
  console.log(`Demo user ready with ${demoOrders.length} orders: ${credentials.emailId}`);
}

try {
  await connectDB();
  await syncIndexes();
  await seedZonesAndKits();
  await seedProducts();
  await refreshImages();
  await seedAdmin();
  await seedDemoUser();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
