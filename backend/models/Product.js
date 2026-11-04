import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  productId: { type: String, required: true, unique: true, trim: true },
  productName: { type: String, required: true, trim: true },
  productPrice: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, trim: true },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    validate: { validator: Number.isInteger, message: 'Quantity must be a whole number.' }
  },
  description: { type: String, required: true, trim: true }
}, { timestamps: true });

export default mongoose.model('Product', productSchema);
