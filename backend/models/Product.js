import mongoose from 'mongoose';

export const ZONE_CODES = ['A', 'W', 'D', 'L', 'S', 'G', 'C', 'P', 'B'];

// The store fields are optional so the lab's six-field POST /api/products keeps working.
const productSchema = new mongoose.Schema({
  productId: { type: String, required: true, unique: true, trim: true }, // the SKU, like A-01-117
  productName: { type: String, required: true, trim: true },
  productPrice: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, trim: true }, // the zone name, like Audio
  quantity: {
    type: Number,
    required: true,
    min: 0,
    validate: { validator: Number.isInteger, message: 'Quantity must be a whole number.' }
  },
  description: { type: String, required: true, trim: true },
  zoneCode: { type: String, enum: ZONE_CODES, uppercase: true, trim: true },
  bay: { type: Number, min: 1 },
  bayName: { type: String, trim: true },
  brand: { type: String, trim: true },
  colours: [String],
  use: [String],
  connectivity: { type: String, enum: ['wired', 'wireless', 'n/a'], default: 'n/a' },
  specs: { type: Map, of: String },
  images: [String],
  seller: { type: String, trim: true },
  warrantyMonths: { type: Number, min: 0 },
  arrivesInDays: { type: Number, min: 0 },
  // Stored as isNewDrop because Mongoose reserves isNew: a field with that name
  // stops createdAt being set. The API still calls it isNew.
  isNewDrop: { type: Boolean, default: false }
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, json) {
      json.isNew = json.isNewDrop;
      delete json.isNewDrop;
      return json;
    }
  }
});

productSchema.index({ productName: 'text', brand: 'text', category: 'text' });
productSchema.index({ zoneCode: 1, bay: 1 });

export default mongoose.model('Product', productSchema);
