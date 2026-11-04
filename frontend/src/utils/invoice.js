import { formatPrice } from '../formatPrice.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

const row = (label, value) => `<tr><td colspan="3">${escapeHtml(label)}</td><td class="num">${escapeHtml(value)}</td></tr>`;

function invoiceHtml(order) {
  const { address = {} } = order;
  const placed = new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' });
  const lines = order.items.map(item => `<tr>
    <td>${escapeHtml(item.productId)}</td>
    <td>${escapeHtml(item.name)}${item.colour ? ` · ${escapeHtml(item.colour)}` : ''}</td>
    <td class="num">${escapeHtml(item.qty)} × ${escapeHtml(formatPrice(item.price))}</td>
    <td class="num">${escapeHtml(formatPrice(item.price * item.qty))}</td>
  </tr>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Invoice #${escapeHtml(order.orderNo)}</title>
<style>
  body { max-width: 680px; margin: 40px auto; padding: 0 16px; color: #1a1613; font: 14px/1.5 ui-monospace, Menlo, monospace; }
  h1 { margin: 0; font: 700 26px system-ui, sans-serif; } h1 span { color: #ff5a1f; }
  table { width: 100%; margin-top: 24px; border-collapse: collapse; }
  th, td { padding: 8px 6px; border-bottom: 1px dashed #1a1613; text-align: left; } .num { text-align: right; white-space: nowrap; }
  .total td { border-bottom: 2px solid #1a1613; font-weight: 700; } .muted { color: #6b645b; }
</style></head><body>
<h1>Bazaar<span>/</span>Mart</h1>
<p class="muted">Invoice #${escapeHtml(order.orderNo)} · ${escapeHtml(placed)}</p>
<p><strong>Deliver to</strong><br>${escapeHtml(address.name)}<br>${escapeHtml(address.line1)}${address.line2 ? `, ${escapeHtml(address.line2)}` : ''}<br>${escapeHtml(address.city)}, ${escapeHtml(address.state)} ${escapeHtml(address.pincode)}</p>
${order.gst?.invoice ? `<p><strong>GSTIN</strong> ${escapeHtml(order.gst.gstin)}</p>` : ''}
<table><thead><tr><th>SKU</th><th>Item</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead>
<tbody>${lines}
${row('Subtotal', formatPrice(order.subtotal))}
${row('Delivery', order.delivery ? formatPrice(order.delivery) : 'Free')}
${order.coupon ? row(`Coupon ${order.couponCode ?? ''}`, `−${formatPrice(order.coupon)}`) : ''}
<tr class="total"><td colspan="3">Total</td><td class="num">${escapeHtml(formatPrice(order.total))}</td></tr>
</tbody></table>
<p class="muted">Payment: ${escapeHtml(order.payment?.method)} (${escapeHtml(order.payment?.status)}). This is a demo store, and payments are simulated.</p>
</body></html>`;
}

export function downloadInvoice(order) {
  const url = URL.createObjectURL(new Blob([invoiceHtml(order)], { type: 'text/html' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `invoice-${order.orderNo}.html`;
  link.click();
  URL.revokeObjectURL(url);
}
