import Order, { ORDER_STATUSES } from '../models/Order.js';
import { ApiError, ok } from '../utils/response.js';
import { CANCELLABLE, cancelOrder, restoreStock, STATUS_GROUPS } from './orderController.js';

const OUT_FOR_DELIVERY_HOURS = 2;
const HOUR_MS = 60 * 60 * 1000;
const ORDERS_LISTED = 100;

const NEXT_STATUS = {
  placed: 'packed',
  packed: 'shipped',
  shipped: 'out_for_delivery',
  out_for_delivery: 'delivered',
  delivered: 'returned'
};

function changesFor(order, status) {
  const now = new Date();
  const changes = { status, $push: { events: { status, at: now } } };
  if (status === 'out_for_delivery') changes.etaAt = new Date(now.getTime() + OUT_FOR_DELIVERY_HOURS * HOUR_MS);
  if (status === 'delivered') {
    changes.etaAt = now;
    if (order.payment?.method === 'cod') changes['payment.status'] = 'paid';
  }
  if (status === 'returned' && order.payment?.status === 'paid') changes['payment.status'] = 'refunded';
  return changes;
}

// Sends only what the status control needs, so customer contact details stay out of it.
export async function listOrders(req, res) {
  const filter = {};
  const { status } = req.query;
  if (status !== undefined) {
    if (!STATUS_GROUPS[status]) throw new ApiError(400, `status must be one of: ${Object.keys(STATUS_GROUPS).join(', ')}.`);
    filter.status = { $in: STATUS_GROUPS[status] };
  }
  const orders = await Order.find(filter)
    .populate('user', 'username')
    .sort({ createdAt: -1 })
    .limit(ORDERS_LISTED);
  const data = orders.map(order => ({
    orderNo: order.orderNo,
    customer: order.user?.username ?? order.guest?.name ?? 'Member',
    isGuest: !order.user,
    total: order.total,
    status: order.status,
    nextStatus: NEXT_STATUS[order.status] ?? null,
    canCancel: CANCELLABLE.includes(order.status),
    createdAt: order.createdAt
  }));
  ok(res, { data, count: data.length });
}

export async function updateOrderStatus(req, res) {
  const { status } = req.body;
  if (!ORDER_STATUSES.includes(status)) throw new ApiError(400, `status must be one of: ${ORDER_STATUSES.join(', ')}.`);

  const order = await Order.findOne({ orderNo: req.params.orderNo });
  if (!order) throw new ApiError(404, 'Order not found.');

  if (status === 'cancelled') {
    ok(res, { message: 'Order cancelled.', data: await cancelOrder(order) });
    return;
  }
  if (NEXT_STATUS[order.status] !== status) {
    throw new ApiError(409, `An order that is ${order.status} can't move to ${status}.`);
  }

  // Matching on the old status stops two admins applying the same step twice.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    changesFor(order, status),
    { new: true }
  );
  if (!updated) throw new ApiError(409, 'This order was just updated. Please refresh and try again.');
  if (status === 'returned') await restoreStock(updated.items);
  ok(res, { message: `Order marked as ${status}.`, data: updated });
}
