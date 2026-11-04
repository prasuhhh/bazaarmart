import mongoose from 'mongoose';

// Name and price are copied onto each item so past orders stay correct
// after a product is edited or deleted.
const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: { type: [orderItemSchema], required: true },
  total: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['placed', 'shipped', 'delivered', 'cancelled'], default: 'placed' }
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);
