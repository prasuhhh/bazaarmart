import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { isValidEmail, isValidPassword } from './middleware/validate.js';
import Product from './models/Product.js';
import User from './models/User.js';

const sampleProducts = [
  { productId: 'P001', productName: 'Wireless Mouse', productPrice: 599, category: 'Electronics', quantity: 25, description: 'Ergonomic wireless mouse with adjustable DPI.' },
  { productId: 'P002', productName: 'Mechanical Keyboard', productPrice: 2499, category: 'Electronics', quantity: 12, description: 'Compact mechanical keyboard with tactile switches.' },
  { productId: 'P003', productName: 'Notebook', productPrice: 120, category: 'Stationery', quantity: 60, description: 'A5 ruled notebook for everyday notes.' },
  { productId: 'P004', productName: 'Water Bottle', productPrice: 399, category: 'Lifestyle', quantity: 30, description: 'Reusable stainless-steel water bottle.' },
  { productId: 'P005', productName: 'USB-C Hub', productPrice: 1799, category: 'Accessories', quantity: 8, description: 'Multiport USB-C hub for laptops.' }
];

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
  await User.findOneAndUpdate(
    { emailId },
    {
      $set: { role: 'admin', password: await bcrypt.hash(SEED_ADMIN_PASSWORD, 10) },
      $setOnInsert: { username: 'Store Admin', age: 30 }
    },
    { upsert: true, runValidators: true }
  );
  console.log(`Admin account ready: ${emailId}`);
}

try {
  await connectDB();
  await seedProducts();
  await seedAdmin();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
