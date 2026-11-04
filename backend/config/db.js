import dns from 'node:dns';
import mongoose from 'mongoose';

const DB_NAME = 'simple_store';

export async function connectDB(uri = process.env.MONGO_URI) {
  // Workaround for networks where the mongodb+srv lookup fails, e.g. DNS_SERVERS=8.8.8.8,8.8.4.4
  const servers = (process.env.DNS_SERVERS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (servers.length) dns.setServers(servers);

  await mongoose.connect(uri, { dbName: DB_NAME, serverSelectionTimeoutMS: 5000 });
}
