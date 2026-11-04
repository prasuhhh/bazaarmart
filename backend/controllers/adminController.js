import Order, { ORDER_STATUSES } from '../models/Order.js';
import { ApiError, ok } from '../utils/response.js';
import { cancelOrder, restoreStock } from './orderController.js';

const OUT_FOR_DELIVERY_HOURS = 2;
const HOUR_MS = 60 * 60 * 1000;

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
