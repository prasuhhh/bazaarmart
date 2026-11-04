export const STATUS_STEPS = { placed: 1, packed: 2, shipped: 3, out_for_delivery: 4, delivered: 5, returned: 5 };

export const STATUS_LABELS = {
  placed: 'Ordered',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  returned: 'Returned',
  cancelled: 'Cancelled'
};

export const JOURNEY = ['placed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

const earliestEta = order => (order.etaAt ? new Date(order.etaAt).getTime() : Infinity);

// Most advanced status first. Orders at the same stage go by whichever arrives first.
export const byClosestToDelivery = (a, b) =>
  (STATUS_STEPS[b.status] ?? 0) - (STATUS_STEPS[a.status] ?? 0) || earliestEta(a) - earliestEta(b);
