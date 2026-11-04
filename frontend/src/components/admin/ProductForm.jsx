import { useRef } from 'react';

const toList = text => text.split(',').map(entry => entry.trim()).filter(Boolean);
const specsToText = specs => Object.entries(specs ?? {}).map(([label, value]) => `${label}: ${value}`).join('\n');

function textToSpecs(text) {
  const lines = text.split('\n').map(line => line.split(':'));
  return Object.fromEntries(lines
    .filter(parts => parts.length > 1)
    .map(([label, ...rest]) => [label.trim(), rest.join(':').trim()]));
}

function toBody(values) {
  const { bay, bayName, brand, colours, specs, images, zoneCode, ...rest } = values;
  return {
    ...rest,
    productPrice: Number(values.productPrice),
    quantity: Number(values.quantity),
    colours: toList(colours),
    images: toList(images),
    specs: textToSpecs(specs),
    ...(zoneCode && { zoneCode }),
    ...(bay && { bay: Number(bay) }),
    ...(bayName && { bayName }),
    ...(brand && { brand })
  };
}

export default function ProductForm({ product, zones, busy, onSubmit, onCancel }) {
  const categoryRef = useRef(null);

  function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    onSubmit(toBody(Object.fromEntries(new FormData(form).entries())), form);
  }

  // In the store, a product's category is its zone's name.
  function chooseZone(event) {
    const zone = zones.find(entry => entry.code === event.target.value);
    if (zone) categoryRef.current.value = zone.name;
  }

  return (
    <form key={product?.productId ?? 'new'} className="form-grid admin-form" aria-label="Product" onSubmit={handleSubmit}>
      {!product && <label>SKU<input name="productId" placeholder="A-01-999" required /></label>}
      <label>Name<input name="productName" defaultValue={product?.productName} required /></label>
      <label>Zone
        <select name="zoneCode" defaultValue={product?.zoneCode ?? ''} onChange={chooseZone}>
          <option value="">None</option>
          {zones.map(zone => <option key={zone.code} value={zone.code}>{zone.code} · {zone.name}</option>)}
        </select>
      </label>
      <label>Category<input ref={categoryRef} name="category" defaultValue={product?.category} required /></label>
      <label>Bay<input name="bay" type="number" min="1" step="1" defaultValue={product?.bay} /></label>
      <label>Bay name<input name="bayName" defaultValue={product?.bayName} /></label>
      <label>Brand<input name="brand" defaultValue={product?.brand} /></label>
      <label>Price (₹)<input name="productPrice" type="number" min="0" step="any" defaultValue={product?.productPrice} required /></label>
      <label>Stock<input name="quantity" type="number" min="0" step="1" defaultValue={product?.quantity} required /></label>
      <label>Colours<input name="colours" defaultValue={product?.colours?.join(', ')} placeholder="Black, Sand" /></label>
      <label className="full">Images<input name="images" defaultValue={product?.images?.join(', ')} placeholder="Image URLs, separated by commas" /></label>
      <label className="full">Specs<textarea name="specs" rows="3" defaultValue={specsToText(product?.specs)} placeholder={'Battery: 24 h\nWeight: 42 g'} /></label>
      <label className="full">Description<textarea name="description" rows="3" defaultValue={product?.description} required /></label>
      <div className="form-actions full">
        <button className="primary" disabled={busy}>{busy ? 'Please wait…' : product ? 'Save changes' : 'Add product'}</button>
        {product && <button type="button" className="outline" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
