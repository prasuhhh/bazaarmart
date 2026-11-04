import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5000;

await connectDB();
createApp().listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
