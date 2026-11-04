import { ApiError } from './response.js';

const DELIVERY_FEE = 49;
const FREE_DELIVERY_FROM = 999;

const COUPONS = {
  WELCOME10: { percent: 10, maxDiscount: 500 },
  BAZAAR200: { flat: 200, minSubtotal: 1500 },
  FREESHIP: { freeDelivery: true }
};

export function requireCoupon(code) {
  if (code === undefined || code === '') return null;
  const key = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (!COUPONS[key]) throw new ApiError(400, 'That coupon code is not valid.');
  return key;
}

// Prices come from the database, so nothing here is taken from the client.
export function priceOrder(lines, couponCode) {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const coupon = couponCode ? COUPONS[couponCode] : {};
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    throw new ApiError(400, `${couponCode} needs an order of at least ₹${coupon.minSubtotal}.`);
  }

  const delivery = subtotal >= FREE_DELIVERY_FROM || coupon.freeDelivery ? 0 : DELIVERY_FEE;
  const percentOff = coupon.percent
    ? Math.min(Math.round(subtotal * coupon.percent / 100), coupon.maxDiscount)
    : 0;
  const discount = Math.min(percentOff + (coupon.flat ?? 0), subtotal);
  return { subtotal, delivery, coupon: discount, total: subtotal + delivery - discount };
}
