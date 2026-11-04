import { formatPrice } from '../formatPrice.js';

const LOW_STOCK_THRESHOLD = 5;

function stockLabel(quantity) {
  if (quantity === 0) return <span className="stock out">Out of stock</span>;
  if (quantity <= LOW_STOCK_THRESHOLD) return <span className="stock low">Only {quantity} left</span>;
  return <span className="stock">{quantity} available</span>;
}

export default function ProductCard({ product, qtyInCart, onAdd }) {
  const soldOut = product.quantity === 0;
  const allInCart = !soldOut && qtyInCart >= product.quantity;

  return (
    <article className="product-card">
      <div className="product-top">
        <span className="product-id">{product.productId}</span>
        <span className="category">{product.category}</span>
      </div>
      <h4>{product.productName}</h4>
      <p className="description">{product.description}</p>
      <div className="product-bottom">
        <strong>{formatPrice(product.productPrice)}</strong>
        {stockLabel(product.quantity)}
      </div>
      <button className="primary add-button" disabled={soldOut || allInCart} onClick={() => onAdd(product)}>
        {soldOut ? 'Sold out' : allInCart ? 'All stock in cart' : qtyInCart ? `Add another (${qtyInCart} in cart)` : 'Add to cart'}
      </button>
    </article>
  );
}
