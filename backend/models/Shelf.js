import crypto from 'node:crypto';
import mongoose from 'mongoose';

const SHARE_ID_BYTES = 9;

const shelfItemSchema = new mongoose.Schema({
  product: { type: String, required: true }, // the product's SKU
  savedPrice: { type: Number, required: true, min: 0 },
  savedAt: { type: Date, default: Date.now }
}, { _id: false });

const shelfSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  shareId: {
    type: String,
    unique: true,
    default: () => crypto.randomBytes(SHARE_ID_BYTES).toString('base64url')
  },
  items: [shelfItemSchema]
}, { timestamps: true });

export default mongoose.model('Shelf', shelfSchema);
