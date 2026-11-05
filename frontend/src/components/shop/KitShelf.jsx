import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch.js';
import Thumb from '../ui/Thumb.jsx';
import ProductGrid from './ProductGrid.jsx';

export default function KitShelf({ onSave }) {
  const { data: kits } = useFetch('/kits');
  const [openId, setOpenId] = useState(null);
  const { data: opened, loading, error } = useFetch(openId ? `/kits/${openId}` : null);
  const products = opened?.kit._id === openId ? opened.products : null;

  return (
    <section className="kit-shelf" aria-label="Kits">
      <div className="kit-row">
        {kits?.map(kit => (
          <button
            type="button"
            key={kit._id}
            className={`kit-card${kit._id === openId ? ' active' : ''}`}
            aria-expanded={kit._id === openId}
            onClick={() => setOpenId(current => (current === kit._id ? null : kit._id))}
          >
            <span className="kit-thumb"><Thumb /></span>
            <span>
              <span className="caption">Kit</span>
              <strong>{kit.title}</strong>
            </span>
          </button>
        ))}
      </div>
      {openId && loading && !products && <p className="empty">Gathering the kit…</p>}
      {error && <p className="empty">{error.message}</p>}
      {products && (
        <div className="kit-products">
          <p className="caption">{products.length} items · {opened.kit.title}</p>
          <ProductGrid products={products} onSave={onSave} />
        </div>
      )}
    </section>
  );
}
