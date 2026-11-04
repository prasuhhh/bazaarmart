import { formatPrice } from '../../formatPrice.js';

export const specLabel = key => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase());

export function arrivalText(days) {
  if (days === undefined || days === null) return '—';
  return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
}

export const warrantyText = months => (months ? `${months} months` : 'None');

export function stockText(quantity) {
  return quantity === 0 ? 'Out of stock' : `${quantity} in stock`;
}

// The zone decides which spec rows a product has, so they sit between the fixed ones.
export function specRows(product) {
  return [
    ['Price', formatPrice(product.productPrice)],
    ...Object.entries(product.specs ?? {}).map(([key, value]) => [specLabel(key), value]),
    ['Stock', stockText(product.quantity)],
    ['Arrives', arrivalText(product.arrivesInDays)],
    ['Seller', product.seller ?? '—'],
    ['Warranty', warrantyText(product.warrantyMonths)]
  ];
}

export default function SpecTable({ product }) {
  return (
    <dl className="spec-table">
      {specRows(product).map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}
