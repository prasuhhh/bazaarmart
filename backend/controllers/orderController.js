import crypto from 'node:crypto';
import { isValidEmail, normalizePhone } from '../middleware/validate.js';
import Order, { ORDER_SOURCES } from '../models/Order.js';
import Product from '../models/Product.js';
import Shelf from '../models/Shelf.js';
import { ADDRESS_FIELDS, pick, REQUIRED_DELIVERY_FIELDS, requireAddressFields } from '../utils/address.js';
import { priceOrder, requireCoupon } from '../utils/pricing.js';
import { ApiError, created, ok } from '../utils/response.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DEFAULT_ARRIVAL_DAYS = 3;
const NOTE_MAX_LENGTH = 200;
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;
const PAYMENT_METHODS = ['upi', 'card', 'netbanking', 'cod'];

export const STATUS_GROUPS = {
  live: ['placed', 'packed', 'shipped', 'out_for_delivery'],
  delivered: ['delivered'],
  returns: ['returned'],
  cancelled: ['cancelled']
};
export const CANCELLABLE = ['placed', 'packed'];
const SLOT_CHANGEABLE = ['placed', 'packed', 'shipped'];
const NOTE_CHANGEABLE = [...SLOT_CHANGEABLE, 'out_for_delivery'];

// The delivery estimate gets more precise as the parcel gets closer.
const ETA_WINDOW_MINUTES = { placed: 1440, packed: 720, shipped: 240, out_for_delivery: 60 };

const COURIERS = [
  { name: 'Ravi Kumar', phone: '+919000000123' },
  { name: 'Meena Iyer', phone: '+919000000456' },
  { name: 'Arjun Das', phone: '+919000000789' }
];

// Adds up repeated lines. The same product in two colours stays as two lines.
function parseItems(items) {
  if (!Array.isArray(items) || !items.length) throw new ApiError(400, 'Add at least one item to your order.');

  const lines = new Map();
  for (const item of items) {
    const productId = typeof item?.productId === 'string' ? item.productId.trim() : '';
    if (!productId || !Number.isInteger(item.qty) || item.qty < 1) {
      throw new ApiError(400, 'Each item needs a productId and a whole-number qty of at least 1.');
    }
    const colour = typeof item.colour === 'string' ? item.colour.trim() : '';
    const key = `${productId}|${colour}`;
    const line = lines.get(key);
    if (line) line.qty += item.qty;
    else lines.set(key, { productId, colour, qty: item.qty });
  }
  return [...lines.values()];
}

function parseGuest(guest) {
  const name = typeof guest?.name === 'string' ? guest.name.trim() : '';
  const phone = normalizePhone(guest?.phone);
  if (!name || !phone) throw new ApiError(400, 'Guest checkout needs a name and a valid phone number.');
  if (guest.email !== undefined && !isValidEmail(guest.email)) throw new ApiError(400, 'Enter a valid email address.');
  return { name, phone, ...(guest.email && { email: guest.email.trim() }) };
}

function parseAddress(address) {
  if (typeof address !== 'object' || address === null) throw new ApiError(400, 'A delivery address is required.');
  const fields = pick(address, ADDRESS_FIELDS);
  requireAddressFields(fields, REQUIRED_DELIVERY_FIELDS);
  return fields;
}

function parseSlot(slot) {
  const label = typeof slot?.label === 'string' ? slot.label.trim() : '';
  if (!label) throw new ApiError(400, 'Choose a delivery slot.');
  if (slot.date === undefined) return { label };
  const date = new Date(slot.date);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, 'The slot date is not valid.');
  return { label, date };
}

function parsePayment(payment) {
  const method = payment?.method;
  if (!PAYMENT_METHODS.includes(method)) {
    throw new ApiError(400, `Choose a payment method: ${PAYMENT_METHODS.join(', ')}.`);
  }
  // Payment is simulated: only the method is kept, so card details are never stored.
  return { method, status: method === 'cod' ? 'pending' : 'paid' };
}

function parseNote(note, label) {
  if (note === undefined) return undefined;
  if (typeof note !== 'string' || note.length > NOTE_MAX_LENGTH) {
    throw new ApiError(400, `${label} must be ${NOTE_MAX_LENGTH} characters or fewer.`);
  }
  return note.trim();
}

function parseGst(gst) {
  if (gst?.invoice !== true) return { invoice: false };
  const gstin = typeof gst.gstin === 'string' ? gst.gstin.trim().toUpperCase() : '';
  if (!GSTIN_PATTERN.test(gstin)) throw new ApiError(400, 'Enter a valid 15-character GSTIN.');
  return { invoice: true, gstin };
}

function parseSource(source) {
  if (source === undefined) return { type: 'receipt' };
  if (!ORDER_SOURCES.includes(source?.type)) throw new ApiError(400, `source type must be one of: ${ORDER_SOURCES.join(', ')}.`);
  if (source.type !== 'shelf') return { type: source.type };

  const shelfId = typeof source.shelfId === 'string' ? source.shelfId : '';
  const shareId = typeof source.shareId === 'string' ? source.shareId : '';
  if (Boolean(shelfId) === Boolean(shareId)) throw new ApiError(400, 'A shelf order needs either a shelfId or a shareId.');
  return shelfId ? { type: 'shelf', shelfId } : { type: 'shelf', shareId };
}

// Checks a shelf order before any stock moves. Returns the shelf, or null for other orders.
// A share link is enough to buy from a shelf, but only its owner can change it.
async function loadSourceShelf(source, requested, user, removeFromShelf) {
  if (source.type !== 'shelf') {
    if (removeFromShelf) throw new ApiError(400, 'removeFromShelf only applies to a shelf order.');
    return null;
  }
  if (source.shelfId && !user) throw new ApiError(401, 'Authentication required.');

  const shelf = await (source.shelfId ? Shelf.findById(source.shelfId) : Shelf.findOne({ shareId: source.shareId }));
  if (!shelf) throw new ApiError(404, 'Shelf not found.');
  const isOwner = Boolean(user) && shelf.user.equals(user.userId);
  if (source.shelfId && !isOwner) throw new ApiError(403, 'You can only order from your own shelves.');
  if (removeFromShelf && !isOwner) throw new ApiError(403, 'Only the owner can change this shelf.');

  const onShelf = new Set(shelf.items.map(item => item.product));
  const stray = requested.find(line => !onShelf.has(line.productId));
  if (stray) throw new ApiError(400, `${stray.productId} is not on this shelf.`);
  return shelf;
}

// The order is already placed by now, so a failure here must not undo it.
async function removeFromShelfAfterOrder(shelf, items) {
  const skus = items.map(item => item.productId);
  await Shelf.updateOne({ _id: shelf._id }, { $pull: { items: { product: { $in: skus } } } })
    .catch(error => console.error(`Could not update shelf ${shelf._id}:`, error.message));
}

function lineProblem(product, { productId, colour, qty }) {
  if (!product) return new ApiError(404, `Product ${productId} no longer exists.`);
  if (colour && !product.colours.includes(colour)) {
    return new ApiError(400, `${product.productName} doesn't come in ${colour}.`);
  }
  return new ApiError(409, `Only ${product.quantity} of ${product.productName} left, but you asked for ${qty}.`);
}

export async function restoreStock(items) {
  await Promise.all(items.map(({ productId, qty }) =>
    Product.updateOne({ productId }, { $inc: { quantity: qty } })));
}

// What placing this order would cost right now. Nothing is reserved or saved.
export async function quoteOrder(req, res) {
  const requested = parseItems(req.body.items);
  const couponCode = requireCoupon(req.body.coupon);
  const products = await Product.find({ productId: { $in: requested.map(line => line.productId) } });
  const bySku = new Map(products.map(product => [product.productId, product]));

  const wanted = new Map();
  for (const { productId, qty } of requested) wanted.set(productId, (wanted.get(productId) ?? 0) + qty);

  const lines = requested.map(line => {
    const product = bySku.get(line.productId);
    const isAvailable = product && wanted.get(line.productId) <= product.quantity;
    if (!isAvailable || (line.colour && !product.colours.includes(line.colour))) {
      throw lineProblem(product, { ...line, qty: wanted.get(line.productId) });
    }
    return { ...line, name: product.productName, price: product.productPrice };
  });
  ok(res, { data: { lines, ...priceOrder(lines, couponCode), couponCode } });
}

export async function placeOrder(req, res) {
  const { items, address, slot, payment, gift, gst, guest, coupon, source } = req.body;

  // Everything is checked first, so a bad request never touches stock.
  const requested = parseItems(items);
  const details = {
    address: parseAddress(address),
    slot: parseSlot(slot),
    payment: parsePayment(payment),
    gift: { wrap: gift?.wrap === true, note: parseNote(gift?.note, 'Gift note') },
    gst: parseGst(gst)
  };
  const owner = req.user ? { user: req.user.userId } : { guest: parseGuest(guest) };
  const couponCode = requireCoupon(coupon);
  const parsedSource = parseSource(source);
  const removeFromShelf = req.body.removeFromShelf === true;
  const shelf = await loadSourceShelf(parsedSource, requested, req.user, removeFromShelf);
  const orderSource = shelf ? { ...parsedSource, shelfName: shelf.name } : parsedSource;

  const reserved = [];
  let arrivalDays = 0;
  let order;

  try {
    // Each decrement only matches when enough stock remains, so two buyers can't
    // take the last unit. Prices come from the database, never from the client.
    for (const line of requested) {
      const { productId, colour, qty } = line;
      const product = await Product.findOneAndUpdate(
        { productId, quantity: { $gte: qty }, ...(colour && { colours: colour }) },
        { $inc: { quantity: -qty } },
        { new: true }
      );
      if (!product) throw lineProblem(await Product.findOne({ productId }), line);
      reserved.push({
        productId, name: product.productName, qty, price: product.productPrice,
        image: product.images[0], ...(colour && { colour })
      });
      arrivalDays = Math.max(arrivalDays, product.arrivesInDays ?? DEFAULT_ARRIVAL_DAYS);
    }

    order = await Order.create({
      ...owner,
      ...details,
      ...priceOrder(reserved, couponCode),
      couponCode,
      source: orderSource,
      items: reserved,
      courier: COURIERS[crypto.randomInt(COURIERS.length)],
      etaAt: details.slot.date ?? new Date(Date.now() + arrivalDays * DAY_MS)
    });
  } catch (error) {
    await restoreStock(reserved);
    throw error;
  }

  if (shelf && removeFromShelf) await removeFromShelfAfterOrder(shelf, reserved);
  const from = shelf ? ` from shelf ${shelf.name}` : '';
  created(res, { message: `Order #${order.orderNo} placed${from}.`, data: order });
}

export async function listMyOrders(req, res) {
  const filter = { user: req.user.userId };
  const { status } = req.query;
  if (status !== undefined) {
    if (!STATUS_GROUPS[status]) throw new ApiError(400, `status must be one of: ${Object.keys(STATUS_GROUPS).join(', ')}.`);
    filter.status = { $in: STATUS_GROUPS[status] };
  }
  const orders = await Order.find(filter).sort({ createdAt: -1 });
  ok(res, { data: orders, count: orders.length });
}

async function loadOrder(req, projection) {
  const query = Order.findOne({ orderNo: req.params.orderNo });
  const order = await (projection ? query.select(projection) : query);
  if (!order) throw new ApiError(404, 'Order not found.');
  return order;
}

// Returns 'owner' or 'admin', or throws. A guest proves ownership with the order's phone.
function accessFor(order, req) {
  if (order.user) {
    if (!req.user) throw new ApiError(401, 'Authentication required.');
    if (order.user.equals(req.user.userId)) return 'owner';
  } else {
    if (req.query.phone === undefined && !req.user) throw new ApiError(400, 'phone query parameter is required.');
    if (normalizePhone(req.query.phone) === order.guest.phone) return 'owner';
  }
  if (req.user?.role === 'admin') return 'admin';
  throw new ApiError(403, 'You can only view your own orders.');
}

function requireOwner(order, req) {
  if (accessFor(order, req) !== 'owner') throw new ApiError(403, 'Only the customer can change this order.');
}

export async function getOrder(req, res) {
  const order = await loadOrder(req);
  accessFor(order, req);
  ok(res, { data: order });
}

function etaWindow(order) {
  const minutes = ETA_WINDOW_MINUTES[order.status];
  if (!minutes || !order.etaAt) return null;
  const half = (minutes * MINUTE_MS) / 2;
  return { from: new Date(order.etaAt.getTime() - half), to: new Date(order.etaAt.getTime() + half) };
}

export async function trackOrder(req, res) {
  const order = await loadOrder(req, '+deliveryOtp');
  const access = accessFor(order, req);
  const data = {
    orderNo: order.orderNo,
    status: order.status,
    events: order.events,
    etaAt: order.etaAt,
    etaWindow: etaWindow(order),
    courier: order.courier,
    slot: order.slot,
    leaveAtDoor: order.leaveAtDoor,
    deliveryNote: order.deliveryNote,
    items: order.items
  };
  if (access === 'owner' && order.status === 'out_for_delivery') data.deliveryOtp = order.deliveryOtp;
  ok(res, { data });
}

// The status is part of the match, so a change that arrives at the same moment
// can't lead to a double refund or stock being restored twice.
export async function cancelOrder(order) {
  const cancelled = await Order.findOneAndUpdate(
    { _id: order._id, status: { $in: CANCELLABLE } },
    {
      status: 'cancelled',
      $push: { events: { status: 'cancelled', at: new Date() } },
      ...(order.payment?.status === 'paid' && { 'payment.status': 'refunded' })
    },
    { new: true }
  );
  if (!cancelled) throw new ApiError(409, 'This order can no longer be cancelled.');
  await restoreStock(cancelled.items);
  return cancelled;
}

export async function updateOrder(req, res) {
  const order = await loadOrder(req);
  requireOwner(order, req);
  const { slot, leaveAtDoor, deliveryNote, cancel } = req.body;

  if (cancel === true) {
    ok(res, { message: 'Order cancelled.', data: await cancelOrder(order) });
    return;
  }

  const updates = {};
  if (slot !== undefined) {
    if (!SLOT_CHANGEABLE.includes(order.status)) throw new ApiError(409, 'The delivery slot can no longer be changed.');
    updates.slot = parseSlot(slot);
    if (updates.slot.date) updates.etaAt = updates.slot.date;
  }
  if (leaveAtDoor !== undefined || deliveryNote !== undefined) {
    if (!NOTE_CHANGEABLE.includes(order.status)) throw new ApiError(409, 'Delivery instructions can no longer be changed.');
    if (leaveAtDoor !== undefined) {
      if (typeof leaveAtDoor !== 'boolean') throw new ApiError(400, 'leaveAtDoor must be true or false.');
      updates.leaveAtDoor = leaveAtDoor;
    }
    if (deliveryNote !== undefined) updates.deliveryNote = parseNote(deliveryNote, 'Delivery note');
  }
  if (!Object.keys(updates).length) {
    throw new ApiError(400, 'Provide slot, leaveAtDoor, deliveryNote or cancel.');
  }

  order.set(updates);
  await order.save();
  ok(res, { message: 'Order updated.', data: order });
}
