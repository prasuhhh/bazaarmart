import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Placeholder from './Placeholder.jsx';

const LAST_SKU_KEY = 'bazaarmart_last_sku';

function readLastSku() {
  try {
    return localStorage.getItem(LAST_SKU_KEY);
  } catch {
    return null;
  }
}

export default function ProductSheet() {
  const { sku } = useParams();

  useEffect(() => {
    try {
      localStorage.setItem(LAST_SKU_KEY, sku);
    } catch {
      // Taskbar item 03 just won't remember this product.
    }
  }, [sku]);

  return (
    <Placeholder caption="Product sheet" title={sku} linkTo="/map" linkLabel="Back to the store map">
      The full product sheet arrives in a later step.
    </Placeholder>
  );
}

// Taskbar item 03: reopens the last viewed product, or explains why there isn't one.
export function LastProductSheet() {
  const sku = readLastSku();
  if (sku) return <Navigate to={`/p/${encodeURIComponent(sku)}`} replace />;
  return (
    <Placeholder caption="Product sheet" title="No product open yet." linkTo="/map" linkLabel="Go to the store map">
      Open any product and it will be waiting here.
    </Placeholder>
  );
}
