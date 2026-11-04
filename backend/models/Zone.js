import mongoose from 'mongoose';
import { ZONE_CODES } from './Product.js';

const zoneSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, enum: ZONE_CODES },
  name: { type: String, required: true, trim: true },
  order: { type: Number, required: true },
  layout: {
    col: { type: Number, default: 1 },
    row: { type: Number, default: 1 }
  }
}, { timestamps: true });

export default mongoose.model('Zone', zoneSchema);
