import { formatPrice } from '../../formatPrice.js';

export default function PriceChip({ value }) {
  return <span className="price-chip">{formatPrice(value)}</span>;
}
