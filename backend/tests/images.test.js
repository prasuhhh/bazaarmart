import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../app.js';
import { products } from '../data/catalogue.js';
import { FALLBACK_ICON, OUTPUT_DIR, iconFor, renderImages } from '../scripts/generateProductImages.js';

const app = createApp();

describe('product images', () => {
  it('gives every product a main, colour and scale image, all relative', () => {
    for (const { productId, images } of products) {
      assert.deepEqual(images, [
        `/products/${productId}.svg`,
        `/products/${productId}-colours.svg`,
        `/products/${productId}-scale.svg`
      ]);
    }
  });

  it('draws a specific icon for every catalogue product', () => {
    assert.deepEqual(products.filter(product => iconFor(product) === FALLBACK_ICON).map(p => p.productId), []);
  });

  it('matches mixed bays by product name', () => {
    const icon = name => iconFor(products.find(product => product.productName === name));
    assert.equal(icon('Reference Wired Earphones'), 'earphones');
    assert.equal(icon('Pocket Buds'), 'earbuds');
    assert.equal(icon('Wireless Mouse'), 'mouse');
    assert.equal(icon('Mechanical Keyboard'), 'keyboard');
    assert.equal(icon('Water Bottle 750 ml'), 'bottle');
    assert.equal(icon('Round Acetate Sunglasses'), 'sunglasses');
  });

  it('falls back to the generic icon for an unknown bay or product', () => {
    assert.equal(iconFor({ bayName: 'Mystery', productName: 'Thing' }), FALLBACK_ICON);
    assert.equal(iconFor({ bayName: 'Earbuds', productName: 'Thing' }), FALLBACK_ICON);
  });

  it('has up-to-date files on disk and nothing left over', async () => {
    const expected = Object.assign({}, ...products.map(renderImages));
    assert.deepEqual((await readdir(OUTPUT_DIR)).sort(), Object.keys(expected).sort());
    for (const [name, svg] of Object.entries(expected)) {
      assert.equal(await readFile(new URL(name, OUTPUT_DIR), 'utf8'), svg, `${name} is stale: run npm run images`);
    }
  });

  it('shows each colour and the SKU, and labels the scale view', () => {
    const product = products.find(({ productId }) => productId === 'A-01-116');
    const images = renderImages(product);
    for (const colour of product.colours) assert.ok(images['A-01-116-colours.svg'].includes(`>${colour}<`), colour);
    for (const svg of Object.values(images)) assert.ok(svg.includes('>A-01-116<'));
    assert.ok(images['A-01-116-scale.svg'].includes('ON DESK'));
    const watch = products.find(({ zoneCode }) => zoneCode === 'W');
    assert.ok(renderImages(watch)[`${watch.productId}-scale.svg`].includes('ON WRIST'));
  });

  it('escapes product names', () => {
    const [svg] = Object.values(renderImages({ productId: 'X-01-001', productName: 'A & B 14"', zoneCode: 'A', bayName: 'Earbuds' }));
    assert.ok(svg.includes('<title>A &amp; B 14&quot;</title>'));
  });
});

describe('GET /products/:file', () => {
  it('serves an SVG that another origin may use in an <img>', async () => {
    const res = await request(app).get('/products/A-01-117.svg');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /^image\/svg\+xml/);
    assert.equal(res.headers['cross-origin-resource-policy'], 'cross-origin');
  });

  it('answers 404 for a missing image, and keeps files outside the folder private', async () => {
    assert.equal((await request(app).get('/products/nope.svg')).status, 404);
    assert.equal((await request(app).get('/products/..%2F..%2F.env')).status, 404);
  });
});
