import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../app.js';
import { imagesFor, products } from '../data/catalogue.js';
import { commonsLicense, isUsable, matchScore } from '../scripts/fetchProductPhotos.js';
import { FALLBACK_ICON, OUTPUT_DIR, iconFor, renderImages } from '../scripts/generateProductImages.js';

const app = createApp();

describe('product images', () => {
  it('gives each product one photo, or its three SVGs when it has none', () => {
    for (const { productId, images } of products) {
      assert.deepEqual(images, imagesFor(productId));
      assert.ok(images[0].startsWith(`/products/${productId}`));
      if (images.length === 1) assert.equal(images[0], `/products/${productId}-1.jpg`);
      else assert.equal(images.at(-1), `/products/${productId}-scale.svg`);
    }
  });

  it('has a credited file on disk for every photo', async () => {
    const files = new Set(await readdir(OUTPUT_DIR));
    const credits = await readFile(new URL('CREDITS.md', OUTPUT_DIR), 'utf8').catch(() => '');
    for (const { productId, images } of products.filter(product => product.images.length === 1)) {
      assert.ok(files.has(`${productId}-1.jpg`), productId);
      assert.ok(credits.includes(`| ${productId} |`), productId);
    }
  });

  it('draws a specific icon for every catalogue product', () => {
    assert.deepEqual(products.filter(product => iconFor(product) === FALLBACK_ICON).map(p => p.productId), []);
  });

  it('matches mixed bays by product name', () => {
    const icon = name => iconFor(products.find(product => product.productName === name));
    assert.equal(icon('Prism ANC Earbuds'), 'earbuds');
    assert.equal(icon('Drift Smart Ring'), 'ring');
    assert.equal(icon('Zephyr Key Tracker'), 'tracker');
    assert.equal(icon('Cinder Ring Light'), 'bulb');
    assert.equal(icon('Vector Round Sunglasses'), 'sunglasses');
    assert.equal(icon('Echo Blue-light Glasses'), 'glasses');
  });

  it('falls back to the generic icon for an unknown bay or product', () => {
    assert.equal(iconFor({ bayName: 'Mystery', productName: 'Thing' }), FALLBACK_ICON);
    assert.equal(iconFor({ bayName: 'Earbuds', productName: 'Thing' }), FALLBACK_ICON);
  });

  it('has up-to-date files on disk and nothing left over', async () => {
    const expected = Object.assign({}, ...products.map(renderImages));
    assert.deepEqual((await readdir(OUTPUT_DIR)).filter(name => name.endsWith('.svg')).sort(), Object.keys(expected).sort());
    for (const [name, svg] of Object.entries(expected)) {
      assert.equal(await readFile(new URL(name, OUTPUT_DIR), 'utf8'), svg, `${name} is stale: run npm run images`);
    }
  });

  it('shows each colour and the SKU, and labels the scale view', () => {
    const product = products.find(({ productId }) => productId === 'A-01-117');
    const images = renderImages(product);
    for (const colour of product.colours) assert.ok(images['A-01-117-colours.svg'].includes(`>${colour}<`), colour);
    for (const svg of Object.values(images)) assert.ok(svg.includes('>A-01-117<'));
    assert.ok(images['A-01-117-scale.svg'].includes('ON DESK'));
    const watch = products.find(({ zoneCode }) => zoneCode === 'W');
    assert.ok(renderImages(watch)[`${watch.productId}-scale.svg`].includes('ON WRIST'));
  });

  it('escapes product names', () => {
    const [svg] = Object.values(renderImages({ productId: 'X-01-001', productName: 'A & B 14"', zoneCode: 'A', bayName: 'Earbuds' }));
    assert.ok(svg.includes('<title>A &amp; B 14&quot;</title>'));
  });
});

describe('choosing product photos', () => {
  const photo = fields => ({ title: 'Black earbuds', tags: ['audio'], url: 'https://example.com/a.jpg', license: 'by', ...fields });

  it('keeps only reuse-friendly licences', () => {
    for (const license of ['cc0', 'pdm', 'by', 'by-sa']) assert.ok(isUsable(photo({ license }), 'earbuds'), license);
    for (const license of ['by-nc', 'by-nd', 'cc-by-nc-sa', undefined]) assert.equal(isUsable(photo({ license }), 'earbuds'), false);
  });

  it('skips people, logos and artwork, in the title or the tags', () => {
    assert.equal(isUsable(photo({ title: 'Woman wearing earbuds' }), 'earbuds'), false);
    assert.equal(isUsable(photo({ tags: ['portrait'] }), 'earbuds'), false);
    assert.equal(isUsable(photo({ title: 'Earbuds logo' }), 'earbuds'), false);
    assert.ok(isUsable(photo({ title: 'Manual for earbuds' }), 'earbuds'), 'man inside a longer word');
  });

  it('does not block a word the query itself asks for', () => {
    assert.ok(isUsable(photo({ title: 'Face wash bottle' }), 'face wash'));
  });

  it('skips a file type it cannot use', () => {
    assert.equal(isUsable(photo({ url: 'https://example.com/a.svg' }), 'earbuds'), false);
  });

  it('prefers a photo naming the product over one sharing a side word', () => {
    const named = matchScore(photo({ title: 'Earbuds on a desk' }), 'wireless earbuds');
    const side = matchScore(photo({ title: 'Wireless router' }), 'wireless earbuds');
    assert.ok(named > side);
    assert.equal(matchScore(photo({ title: 'Sunset', tags: [] }), 'wireless earbuds'), 0);
  });

  it('reads a Commons licence name', () => {
    const name = value => ({ LicenseShortName: { value } });
    assert.equal(commonsLicense(name('CC BY-SA 4.0')), 'by-sa');
    assert.equal(commonsLicense(name('CC BY 2.0')), 'by');
    assert.equal(commonsLicense(name('CC0')), 'cc0');
    assert.equal(commonsLicense(name('Public domain')), 'pdm');
    assert.equal(commonsLicense(name('GFDL')), null);
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
