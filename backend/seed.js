import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
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

const sampleProducts = [
  { productId: 'P001', productName: 'Wireless Mouse', productPrice: 599, category: 'Electronics', quantity: 25, description: 'Ergonomic wireless mouse with adjustable DPI.' },
  { productId: 'P002', productName: 'Mechanical Keyboard', productPrice: 2499, category: 'Electronics', quantity: 12, description: 'Compact mechanical keyboard with tactile switches.' },
  { productId: 'P003', productName: 'Notebook', productPrice: 120, category: 'Stationery', quantity: 60, description: 'A5 ruled notebook for everyday notes.' },
  { productId: 'P004', productName: 'Water Bottle', productPrice: 399, category: 'Lifestyle', quantity: 30, description: 'Reusable stainless-steel water bottle.' },
  { productId: 'P005', productName: 'USB-C Hub', productPrice: 1799, category: 'Accessories', quantity: 8, description: 'Multiport USB-C hub for laptops.' }
];

// MongoDB can't change an existing index in place, so a database created before a
// schema change (such as emailId becoming sparse) must have its indexes rebuilt.
async function syncIndexes() {
  await Promise.all(ALL_MODELS.map(model => model.syncIndexes()));
  console.log('Indexes are up to date.');
}

const zones = [
  ['A', 'Audio'], ['W', 'Wearables'], ['D', 'Desk setup'], ['L', 'Living'], ['S', 'Style'],
  ['G', 'Gaming'], ['C', 'Carry'], ['P', 'Phone+'], ['B', 'Body care']
];

const kits = [
  { title: 'Build a desk setup', query: { zone: 'D' } },
  { title: 'Pair a look with a watch', query: { zone: 'S,W' } },
  { title: 'Gift under ₹2000', query: { maxPrice: '2000' } }
];

async function seedZonesAndKits() {
  await Promise.all(zones.map(([code, name], index) =>
    Zone.updateOne({ code }, { $set: { name, order: index + 1 } }, { upsert: true })));
  await Promise.all(kits.map(({ title, query }) =>
    Kit.updateOne({ title }, { $set: { query } }, { upsert: true })));
  console.log('Zones and kits are ready.');
}

async function seedProducts() {
  const count = await Product.countDocuments();
  if (count > 0) {
    console.log(`Products collection already has ${count} item(s); product seed skipped.`);
    return;
  }
  await Product.insertMany(sampleProducts);
  console.log('Inserted sample products.');
}

// Sets the password as well as the role: otherwise anyone who registered this
// email first would become admin with a password of their own choosing.
async function seedAdmin() {
  const { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;
  if (!isValidEmail(SEED_ADMIN_EMAIL) || !isValidPassword(SEED_ADMIN_PASSWORD)) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (at least 6 characters) in backend/.env');
  }
  const emailId = SEED_ADMIN_EMAIL.toLowerCase().trim();
  const admin = await User.findOne({ emailId }) ?? new User({ emailId, username: 'Store Admin', age: 30 });
  admin.role = 'admin';
  admin.password = SEED_ADMIN_PASSWORD;
  await admin.save();
  console.log(`Admin account ready: ${emailId}`);
}

try {
  await connectDB();
  await syncIndexes();
  await seedZonesAndKits();
  await seedProducts();
  await seedAdmin();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
