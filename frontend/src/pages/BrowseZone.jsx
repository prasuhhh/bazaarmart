import { useState } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import BayRow from '../components/shop/BayRow.jsx';
import BenchTable from '../components/shop/BenchTable.jsx';
import FilterDials from '../components/shop/FilterDials.jsx';
import ProductRow from '../components/shop/ProductRow.jsx';
import ShelfPicker from '../components/shop/ShelfPicker.jsx';
import { useBench } from '../context/BenchContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useZoneFilters } from '../hooks/useZoneFilters.js';
import Placeholder from './Placeholder.jsx';

function groupByBay(products, zone) {
  const bays = new Map();
  for (const product of products) {
    if (!bays.has(product.bay)) {
      const named = zone?.bays.find(entry => entry.bay === product.bay);
      bays.set(product.bay, { bay: product.bay, bayName: named?.bayName ?? product.bayName, products: [] });
    }
    bays.get(product.bay).products.push(product);
  }
  return [...bays.values()].sort((a, b) => a.bay - b.bay);
}

export default function BrowseZone() {
  const { zoneCode } = useParams();
  const { zones } = useOutletContext();
  const [params] = useSearchParams();
  const { skus } = useBench();
  const filters = useZoneFilters();
  const [saving, setSaving] = useState(null);
  const code = zoneCode.toUpperCase();
  const zone = zones.find(entry => entry.code === code);
  const isBench = filters.view === 'bench';

  const zoneQuery = `/products?zone=${encodeURIComponent(code)}`;
  const whole = useFetch(zoneQuery);
  const listing = useFetch(isBench ? null : `${zoneQuery}${filters.apiQuery && `&${filters.apiQuery}`}`);
  const products = listing.data ?? [];

  function bayLink(bay) {
    const next = new URLSearchParams(params);
    if (bay) next.set('bay', bay);
    else next.delete('bay');
    return `?${next}`;
  }

  if (zones.length && !zone) {
    return <Placeholder caption="Store map" title={`There's no Zone ${code}.`} linkTo="/map" linkLabel="Back to the store map">Pick a zone from the floor plan.</Placeholder>;
  }

  const isWaiting = listing.loading && !listing.data;
  return (
    <section className="catalog">
      <FilterDials zoneProducts={whole.data ?? []} filters={filters} benchCount={skus.length} />

      {isBench ? <BenchTable />
        : listing.error ? <p className="empty">{listing.error.message}</p>
          : isWaiting ? <p className="empty">Loading the zone…</p>
            : !products.length ? (
              <div className="empty">
                <p>Nothing on these shelves matches.</p>
                {filters.hasFilters && <button type="button" className="link-button" onClick={filters.clearFilters}>Clear dials</button>}
                {filters.bay && <Link className="link-button" to={bayLink(null)}>Back to all bays</Link>}
              </div>
            ) : filters.view === 'list' ? (
              <div className="product-list">
                {products.map(product => <ProductRow key={product.productId} product={product} onSave={setSaving} />)}
              </div>
            ) : (
              <div className="bay-grid">
                {groupByBay(products, zone).map(bay => (
                  <BayRow
                    key={bay.bay}
                    {...bay}
                    isExpanded={Boolean(filters.bay)}
                    moreTo={bayLink(filters.bay ? null : bay.bay)}
                    onSave={setSaving}
                  />
                ))}
              </div>
            )}

      {saving && <ShelfPicker product={saving} onClose={() => setSaving(null)} />}
    </section>
  );
}
