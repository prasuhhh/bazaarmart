import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';

if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  console.error('Set MONGO_URI and JWT_SECRET in backend/.env');
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

try {
  await connectDB();
  createApp().listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
} catch (error) {
  console.error('MongoDB connection failed:', error.message);
  process.exit(1);
}
