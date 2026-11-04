import dns from 'node:dns';
import mongoose from 'mongoose';

const DB_NAME = 'bazaarmart';
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];

export async function connectDB() {
  const missing = REQUIRED_ENV.filter(key => !process.env[key]);
  if (missing.length) {
    console.error(`Missing ${missing.join(' and ')}. Set them in backend/.env`);
    process.exit(1);
  }

  // Workaround for networks where the mongodb+srv lookup fails, e.g. DNS_SERVERS=8.8.8.8,8.8.4.4
  const servers = (process.env.DNS_SERVERS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (servers.length) dns.setServers(servers);

  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME, serverSelectionTimeoutMS: 5000 });
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
}
