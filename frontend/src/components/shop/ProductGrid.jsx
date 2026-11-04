import ProductCard from './ProductCard.jsx';

// Every product list in the shop. Pass products for the standard card, or children
// for a page that needs its own card actions.
export default function ProductGrid({ products, onSave, as: Tag = 'div', children }) {
  return (
    <Tag className="product-grid">
      {children ?? products.map(product => <ProductCard key={product.productId} product={product} onSave={onSave} />)}
    </Tag>
  );
}
