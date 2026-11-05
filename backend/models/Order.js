import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { addressFields } from './addressFields.js';
import { nextSequence } from './Counter.js';

const FIRST_ORDER_NUMBER = 2041;

export const ORDER_STATUSES = [
  'placed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'returned', 'cancelled'
];

export const ORDER_SOURCES = ['receipt', 'shelf', 'buy_again'];

// Name, price and image are copied onto each item so past orders stay correct
// after a product is edited or deleted.
const orderItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  qty: { type: Number, required: true, min: 1 },
  image: String,
  colour: String
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNo: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  guest: {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true }
  },
  items: {
    type: [orderItemSchema],
    validate: { validator: items => items.length > 0, message: 'An order needs at least one item.' }
  },
  address: new mongoose.Schema(addressFields, { _id: false }),
  slot: { label: String, date: Date },
  payment: {
    method: { type: String, enum: ['upi', 'card', 'netbanking', 'cod'] },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' }
  },
  gift: {
    wrap: { type: Boolean, default: false },
    note: { type: String, trim: true, maxlength: 200 }
  },
  gst: {
    invoice: { type: Boolean, default: false },
    gstin: { type: String, trim: true, uppercase: true }
  },
  // Where the order came from. Informational only: prices still come from the database.
  source: {
    type: { type: String, enum: ORDER_SOURCES, default: 'receipt' },
    shelfId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shelf' },
    shareId: String,
    shelfName: String
  },
  subtotal: { type: Number, required: true, min: 0 },
  delivery: { type: Number, default: 0, min: 0 },
  coupon: { type: Number, default: 0, min: 0 }, // the discount amount
  couponCode: String,
  total: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ORDER_STATUSES, default: 'placed' },
  events: [{
    _id: false,
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, default: Date.now }
  }],
  courier: { name: String, phone: String },
  etaAt: Date,
  leaveAtDoor: { type: Boolean, default: false },
  deliveryNote: { type: String, trim: true, maxlength: 200 },
  // Hidden by default. Only the tracking route may reveal it, and only to the owner.
  deliveryOtp: {
    type: String,
    select: false,
    default: () => String(crypto.randomInt(1000, 10000))
  }
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, json) {
      delete json.deliveryOtp;
      delete json.__v;
      return json;
    }
  }
});

orderSchema.pre('validate', async function prepareNewOrder() {
  if (!this.user && !this.guest?.phone) this.invalidate('user', 'An order needs a user or a guest phone number.');
  if (!this.isNew) return;

  if (!this.orderNo) {
    const sequence = await nextSequence('order');
    this.orderNo = `BM-${FIRST_ORDER_NUMBER - 1 + sequence}`;
  }
  if (!this.events.length) this.events.push({ status: this.status });
});

export default mongoose.model('Order', orderSchema);
