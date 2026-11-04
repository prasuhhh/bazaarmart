// The catalogue itself lives in products.json. Zones, kits and demo data stay here.
import { existsSync, readFileSync } from 'node:fs';

const readJson = file => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));

const PHOTOS_FILE = new URL('./product-photos.json', import.meta.url);
const photos = existsSync(PHOTOS_FILE) ? JSON.parse(readFileSync(PHOTOS_FILE, 'utf8')) : {};

// A product with a real photo shows just that. Without one it keeps its three
// generated SVGs, the last of which is the scale view behind the On desk toggle.
export const imagesFor = sku => (photos[sku]
  ? [`/products/${sku}-1.jpg`]
  : [`/products/${sku}.svg`, `/products/${sku}-colours.svg`, `/products/${sku}-scale.svg`]);

// imageQuery is only for scripts/fetchProductPhotos.js. Mongoose reserves isNew.
export const products = readJson('./products.json').map(({ isNew, imageQuery, ...product }) => ({
  ...product,
  isNewDrop: isNew,
  images: imagesFor(product.productId)
}));

// SKUs from the first catalogue. Only these are deleted, so products added on the
// Admin page survive a seed.
export const retiredSkus = readJson('./retiredSkus.json');

export const zones = [
  { code: 'A', name: 'Audio', layout: { col: 2, row: 2 } },
  { code: 'W', name: 'Wearables', layout: { col: 2, row: 2 } },
  { code: 'D', name: 'Desk setup', layout: { col: 3, row: 2 } },
  { code: 'L', name: 'Living', layout: { col: 3, row: 2 } },
  { code: 'S', name: 'Style', layout: { col: 2, row: 2 } },
  { code: 'G', name: 'Gaming', layout: { col: 2, row: 1 } },
  { code: 'C', name: 'Carry', layout: { col: 2, row: 1 } },
  { code: 'P', name: 'Phone+', layout: { col: 2, row: 1 } },
  { code: 'B', name: 'Body care', layout: { col: 1, row: 1 } }
].map((zone, index) => ({ ...zone, order: index + 1 }));

export const kits = [
  { title: 'Build a desk setup', productIds: ['D-01-111', 'D-02-211', 'D-03-311', 'D-04-411', 'D-05-511'] },
  { title: 'Pair a look with a watch', productIds: ['S-02-211', 'S-03-311', 'S-04-411', 'W-01-113', 'W-03-312'] },
  { title: 'Gift under ₹2000', productIds: ['B-05-511', 'C-03-311', 'C-05-511', 'D-04-414', 'L-03-311', 'W-04-411'] }
];

const HOUR = 60 * 60 * 1000;
const hoursAgo = hours => new Date(Date.now() - hours * HOUR);
const DEMO_ADDRESS = {
  label: 'Home', name: 'Asha Rao', phone: '+919876543210', line1: '221B Lake View Road',
  city: 'Chennai', state: 'Tamil Nadu', pincode: '600041'
};

export const demoUser = {
  username: 'Asha Rao',
  age: 24,
  addresses: [{ ...DEMO_ADDRESS, isDefault: true }]
};

// Where each demo order line from the first catalogue moved to.
export const movedDemoSkus = {
  'W-01-101': 'W-01-111',
  'W-02-004': 'W-03-311',
  'S-03-020': 'S-02-211',
  'D-02-201': 'D-04-411'
};

// SKUs are looked up when seeding, so names and prices always match the catalogue.
export const demoOrders = [
  {
    items: [['W-01-111', 1], ['W-03-311', 1], ['A-01-117', 1]],
    status: 'out_for_delivery',
    address: DEMO_ADDRESS,
    slot: { label: 'Today 6–9 pm', date: new Date() },
    payment: { method: 'upi', status: 'paid' },
    courier: { name: 'Ravi Kumar', phone: '+919000000123' },
    etaAt: new Date(Date.now() + 3 * HOUR),
    events: [
      { status: 'placed', at: hoursAgo(50) },
      { status: 'packed', at: hoursAgo(42) },
      { status: 'shipped', at: hoursAgo(26) },
      { status: 'out_for_delivery', at: hoursAgo(3) }
    ]
  },
  {
    items: [['S-02-211', 2], ['D-04-411', 1]],
    status: 'packed',
    address: DEMO_ADDRESS,
    slot: { label: 'Tomorrow', date: new Date(Date.now() + 24 * HOUR) },
    payment: { method: 'cod', status: 'pending' },
    etaAt: new Date(Date.now() + 28 * HOUR),
    events: [
      { status: 'placed', at: hoursAgo(9) },
      { status: 'packed', at: hoursAgo(2) }
    ]
  }
];
