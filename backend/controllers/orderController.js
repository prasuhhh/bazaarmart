import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { created, fail, ok } from '../utils/response.js';

// Adds up repeated lines so the same product can't get past the stock check twice.
function parseItems(items) {
  if (!Array.isArray(items) || !items.length) throw fail(400, 'Add at least one item to your order.');

  const totals = new Map();
  for (const item of items) {
    const productId = typeof item?.productId === 'string' ? item.productId.trim() : '';
    if (!productId || !Number.isInteger(item.qty) || item.qty < 1) {
      throw fail(400, 'Each item needs a productId and a whole-number qty of at least 1.');
    }
    totals.set(productId, (totals.get(productId) || 0) + item.qty);
  }
  return [...totals].map(([productId, qty]) => ({ productId, qty }));
}

async function explainStockFailure({ productId, qty }) {
  const product = await Product.findOne({ productId });
  if (!product) return fail(404, `Product ${productId} no longer exists.`);
  return fail(409, `Only ${product.quantity} of ${product.productName} left, but you asked for ${qty}.`);
}

async function restoreStock(reserved) {
  await Promise.all(reserved.map(({ product, qty }) =>
    Product.updateOne({ _id: product }, { $inc: { quantity: qty } })));
}

export async function placeOrder(req, res) {
  const requested = parseItems(req.body.items);
  const reserved = [];

  try {
    // Each decrement only matches when enough stock remains, so two buyers can't
    // take the last unit. Prices come from the database, never from the client.
    for (const { productId, qty } of requested) {
      const product = await Product.findOneAndUpdate(
        { productId, quantity: { $gte: qty } },
        { $inc: { quantity: -qty } },
        { new: true }
      );
      if (!product) throw await explainStockFailure({ productId, qty });
      reserved.push({
        product: product._id,
        productId,
        productName: product.productName,
        qty,
        price: product.productPrice
      });
    }

    const total = reserved.reduce((sum, item) => sum + item.price * item.qty, 0);
    const order = await Order.create({ user: req.user.userId, items: reserved, total });
    created(res, { message: 'Order placed.', data: order });
  } catch (error) {
    await restoreStock(reserved);
    throw error;
  }
}

export async function listMyOrders(req, res) {
  const orders = await Order.find({ user: req.user.userId }).select('-__v -user').sort({ createdAt: -1 });
  ok(res, { data: orders, count: orders.length });
}
