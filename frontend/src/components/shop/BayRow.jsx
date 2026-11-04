import { Link } from 'react-router-dom';
import { bayLabel } from './bayLabel.js';
import ProductGrid from './ProductGrid.jsx';

const SHELF_SIZE = 6;

export default function BayRow({ bay, bayName, products, isExpanded, moreTo, onSave }) {
  const shown = isExpanded ? products : products.slice(0, SHELF_SIZE);
  return (
    <section className="bay">
      <div className="bay-head">
        <h3>{bayLabel(bay)} · {bayName}</h3>
        <Link className="caption" to={moreTo}>{isExpanded ? '← All bays' : `${products.length} items →`}</Link>
      </div>
      <ProductGrid products={shown} onSave={onSave} />
    </section>
  );
}
