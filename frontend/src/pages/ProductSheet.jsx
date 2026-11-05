import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { bayLabel } from '../components/shop/bayLabel.js';
import Gallery from '../components/shop/Gallery.jsx';
import OwnerNotes from '../components/shop/OwnerNotes.jsx';
import ProductGrid from '../components/shop/ProductGrid.jsx';
import QuestionsPanel from '../components/shop/QuestionsPanel.jsx';
import ShelfPicker from '../components/shop/ShelfPicker.jsx';
import SpecTable from '../components/shop/SpecTable.jsx';
import SwatchPicker from '../components/shop/SwatchPicker.jsx';
import { useBench } from '../context/BenchContext.jsx';
import { useReceipt } from '../context/ReceiptContext.jsx';
import { useAddToReceipt } from '../hooks/useAddToReceipt.js';
import { useFetch } from '../hooks/useFetch.js';
import Placeholder from './Placeholder.jsx';

const LAST_SKU_KEY = 'bazaarmart_last_sku';

function readLastSku() {
  try {
    return localStorage.getItem(LAST_SKU_KEY);
  } catch {
    return null;
  }
}

function rememberSku(sku) {
  try {
    localStorage.setItem(LAST_SKU_KEY, sku);
  } catch {
    // Taskbar item 03 just won't remember this product.
  }
}

function FitsWith({ products, onSave }) {
  return (
    <section className="dashed-box sheet-panel fits-with">
      <p className="caption">Fits with</p>
      <ProductGrid products={products} onSave={onSave} />
    </section>
  );
}

function SheetBody({ product, related }) {
  const sku = product.productId;
  const { qtyOf } = useReceipt();
  const { isOnBench, toggleBench } = useBench();
  const addToReceipt = useAddToReceipt();
  const [colour, setColour] = useState(product.colours?.[0]);
  const [saving, setSaving] = useState(null);
  const [notesSlot, setNotesSlot] = useState(null);
  const [questionsSlot, setQuestionsSlot] = useState(null);
  const isOut = product.quantity === 0;
  const isAllInReceipt = !isOut && qtyOf(sku) >= product.quantity;

  return (
    <div className="sheet">
      <div className="sheet-top">
        <Gallery product={product} />
        <section className="sheet-card">
          <p className="caption">{product.category} · {bayLabel(product.bay)}</p>
          <h2>{product.productName}</h2>
          <SpecTable product={product} />
          {product.colours?.length > 0 && <SwatchPicker colours={product.colours} chosen={colour} onChoose={setColour} />}
          <div className="sheet-actions">
            <button type="button" className="primary" disabled={isOut || isAllInReceipt} onClick={() => addToReceipt(product, colour)}>
              {isOut ? 'Out of stock' : isAllInReceipt ? 'All in your receipt' : 'Add to receipt'}
            </button>
            <button type="button" className="outline" aria-pressed={isOnBench(sku)} onClick={() => toggleBench(sku)}>
              {isOnBench(sku) ? 'On the bench' : 'Put on bench'}
            </button>
            <button type="button" className="outline" aria-label="Save to a shelf" onClick={() => setSaving(product)}>☆</button>
          </div>
        </section>
      </div>

      <div className="sheet-panels">
        <FitsWith products={related} onSave={setSaving} />
        <OwnerNotes sku={sku} formSlot={notesSlot} />
        <QuestionsPanel sku={sku} formSlot={questionsSlot} />
      </div>
      <div className="sheet-extras" data-no-ref>
        <p className="muted">{product.description}</p>
        <div ref={setNotesSlot} />
        <div ref={setQuestionsSlot} />
      </div>
      {saving && <ShelfPicker product={saving} onClose={() => setSaving(null)} />}
    </div>
  );
}

export default function ProductSheet() {
  const { sku } = useParams();
  const { data, error } = useFetch(`/products/sheet/${encodeURIComponent(sku)}`);
  const isLoaded = data?.product.productId === sku;

  useEffect(() => {
    if (isLoaded) rememberSku(sku);
  }, [isLoaded, sku]);

  if (error?.status === 404) {
    return <Placeholder caption="Product sheet" title={`Nothing filed under ${sku}.`} linkTo="/map" linkLabel="Back to the store map">Check the code, or walk the store to find it.</Placeholder>;
  }
  if (error) return <p className="empty">{error.message}</p>;
  if (!isLoaded) return <p className="empty">Pulling the sheet…</p>;
  return <SheetBody key={sku} product={data.product} related={data.related} />;
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
