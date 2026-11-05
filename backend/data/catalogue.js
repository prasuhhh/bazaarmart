// The catalogue itself lives in products-300.json. Zones, kits and demo data stay here.
import { readFileSync } from 'node:fs';
import { toDocument } from '../scripts/dataset/importCatalogue.js';

export const products = JSON.parse(readFileSync(new URL('./products-300.json', import.meta.url), 'utf8')).map(toDocument);

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
  { title: 'Build a desk setup', productIds: ['D-01-101', 'D-02-201', 'D-03-307', 'D-04-402', 'D-05-501'] },
  { title: 'Pair a look with a watch', productIds: ['S-02-202', 'S-03-302', 'S-04-404', 'W-01-101', 'W-03-301'] },
  { title: 'Gift under ₹2000', productIds: ['B-01-102', 'C-04-404', 'C-05-501', 'D-04-407', 'L-03-303', 'W-04-407'] }
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

// Where each demo order line from the earlier catalogues moved to.
export const movedDemoSkus = {
  'W-01-111': 'W-01-101',
  'W-02-004': 'W-03-301',
  'W-03-311': 'W-03-301',
  'A-01-117': 'A-01-103',
  'S-03-020': 'S-02-202',
  'S-02-211': 'S-02-202',
  'D-04-411': 'D-04-402'
};

// SKUs are looked up when seeding, so names and prices always match the catalogue.
export const demoOrders = [
  {
    items: [['W-01-101', 1], ['W-03-301', 1], ['A-01-103', 1]],
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
    items: [['S-02-202', 2], ['D-04-402', 1]],
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
