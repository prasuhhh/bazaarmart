// Seed catalogue. Brands are invented. Images are drawn by scripts/generateProductImages.js.
const COLOURS = {
  neutral: ['Black', 'Sand', 'Olive'],
  dark: ['Black', 'Graphite'],
  warm: ['Sand', 'Terracotta'],
  bright: ['Black', 'Coral', 'Teal']
};

// [name, price, stock, brand, colours, use, specs, extras]
const bays = [
  {
    zone: 'A', category: 'Audio', bay: 1, bayName: 'Earbuds', start: 115, warrantyMonths: 12, arrivesInDays: 2,
    connectivity: 'wireless', blurb: 'true wireless earbuds with a pocketable charging case.',
    items: [
      ['Pocket Buds', 1299, 86, 'Tessera', COLOURS.neutral, ['commute'], { Battery: '24 h with case', Weight: '42 g' }],
      ['Pulse Sport Buds', 1899, 74, 'Tessera', COLOURS.bright, ['gym', 'commute'], { Battery: '30 h with case', Weight: '46 g' }],
      ['Halo ANC Earbuds', 3499, 58, 'Kora', COLOURS.neutral, ['commute', 'studio'], { Battery: '36 h with case', Weight: '48 g' }, { isNewDrop: true }],
      ['Reference Wired Earphones', 999, 44, 'Kora', COLOURS.dark, ['studio'], { Battery: 'None needed', Weight: '18 g' }, { connectivity: 'wired' }]
    ]
  },
  {
    zone: 'A', category: 'Audio', bay: 2, bayName: 'Headphones', start: 201, warrantyMonths: 24, arrivesInDays: 3,
    connectivity: 'wireless', blurb: 'over-ear headphones tuned for long listening sessions.',
    items: [
      ['Arc Wireless Headphones', 4999, 52, 'Kora', COLOURS.neutral, ['commute'], { Battery: '40 h', Weight: '250 g' }],
      ['Arc Pro ANC Headphones', 8999, 34, 'Kora', COLOURS.dark, ['commute', 'studio'], { Battery: '55 h', Weight: '268 g' }],
      ['Studio Monitor Headphones', 6499, 26, 'Vantara', COLOURS.dark, ['studio'], { Battery: 'None needed', Weight: '285 g' }, { connectivity: 'wired' }]
    ]
  },
  {
    zone: 'A', category: 'Audio', bay: 3, bayName: 'Speakers', start: 301, warrantyMonths: 12, arrivesInDays: 3,
    connectivity: 'wireless', blurb: 'room-filling speaker with a clean, balanced sound.',
    items: [
      ['Pebble Mini Speaker', 1599, 62, 'Tessera', COLOURS.bright, ['commute'], { Battery: '12 h', Weight: '310 g' }],
      ['Roam Waterproof Speaker', 3299, 40, 'Vantara', COLOURS.neutral, ['gym'], { Battery: '20 h', Weight: '640 g' }],
      ['Tower Soundbar 2.1', 11999, 18, 'Vantara', COLOURS.dark, ['studio'], { Power: '120 W', Weight: '3.8 kg' }, { connectivity: 'wired' }]
    ]
  },
  {
    zone: 'W', category: 'Wearables', bay: 1, bayName: 'Smartwatches', start: 101, warrantyMonths: 12, arrivesInDays: 2,
    connectivity: 'wireless', blurb: 'smartwatch with health tracking and a bright always-on display.',
    items: [
      ['Pace Smartwatch', 2499, 92, 'Orbit', COLOURS.neutral, ['gym'], { Battery: '7 days', Weight: '36 g' }],
      ['Pace Pro AMOLED Watch', 4999, 66, 'Orbit', COLOURS.dark, ['gym', 'commute'], { Battery: '10 days', Weight: '41 g' }, { isNewDrop: true }],
      ['Meridian Steel Watch', 9499, 28, 'Halden', COLOURS.dark, ['commute'], { Battery: '5 days', Weight: '58 g' }]
    ]
  },
  {
    zone: 'W', category: 'Wearables', bay: 2, bayName: 'Straps and bands', start: 1, warrantyMonths: 6, arrivesInDays: 2,
    blurb: 'quick-release strap that fits standard 20 mm and 22 mm lugs.',
    items: [
      ['Silicone Sport Strap', 399, 120, 'Orbit', COLOURS.bright, ['gym'], { Material: 'Silicone', Width: '22 mm' }],
      ['Nylon Loop Strap', 549, 98, 'Orbit', COLOURS.neutral, ['commute'], { Material: 'Woven nylon', Width: '22 mm' }],
      ['Milanese Mesh Strap', 899, 54, 'Halden', COLOURS.dark, ['commute'], { Material: 'Stainless steel', Width: '20 mm' }],
      ['Leather Watch Strap', 1199, 46, 'Halden', COLOURS.warm, ['commute'], { Material: 'Full-grain leather', Width: '20 mm' }]
    ]
  },
  {
    zone: 'W', category: 'Wearables', bay: 3, bayName: 'Fitness bands', start: 301, warrantyMonths: 12, arrivesInDays: 2,
    connectivity: 'wireless', blurb: 'slim fitness band that tracks steps, sleep and heart rate.',
    items: [
      ['Stride Fitness Band', 1499, 70, 'Orbit', COLOURS.bright, ['gym'], { Battery: '14 days', Weight: '24 g' }],
      ['Stride Plus Band', 2199, 48, 'Orbit', COLOURS.neutral, ['gym'], { Battery: '12 days', Weight: '27 g' }]
    ]
  },
  {
    zone: 'D', category: 'Desk setup', bay: 1, bayName: 'Keyboards and mice', start: 101, warrantyMonths: 24, arrivesInDays: 2,
    blurb: 'built for long days at the desk.',
    items: [
      ['Wireless Mouse', 599, 180, 'Fieldnote', COLOURS.neutral, ['commute'], { Battery: '12 months', Weight: '78 g' }, { connectivity: 'wireless' }],
      ['Mechanical Keyboard', 2499, 96, 'Fieldnote', COLOURS.dark, ['studio'], { Switches: 'Tactile brown', Weight: '820 g' }, { connectivity: 'wired' }],
      ['Low Profile Keyboard', 3299, 72, 'Fieldnote', COLOURS.neutral, ['commute'], { Battery: '3 months', Weight: '560 g' }, { connectivity: 'wireless', isNewDrop: true }],
      ['Vertical Ergonomic Mouse', 1499, 64, 'Stack', COLOURS.dark, ['studio'], { Battery: '6 months', Weight: '115 g' }, { connectivity: 'wireless' }]
    ]
  },
  {
    zone: 'D', category: 'Desk setup', bay: 2, bayName: 'Lamps and lighting', start: 201, warrantyMonths: 12, arrivesInDays: 3,
    blurb: 'flicker-free light that is easy on the eyes.',
    items: [
      ['Halo Desk Lamp', 1899, 110, 'Lumen & Co', COLOURS.neutral, ['studio'], { Power: '12 W', Weight: '900 g' }],
      ['Monitor Light Bar', 2799, 84, 'Lumen & Co', COLOURS.dark, ['studio'], { Power: '6 W', Weight: '340 g' }],
      ['Warm Clip Lamp', 899, 132, 'Lumen & Co', COLOURS.warm, ['commute'], { Power: '5 W', Weight: '260 g' }]
    ]
  },
  {
    zone: 'D', category: 'Desk setup', bay: 3, bayName: 'Stands and organisers', start: 301, warrantyMonths: 12, arrivesInDays: 3,
    blurb: 'keeps the desk tidy and the screen at eye level.',
    items: [
      ['Aluminium Laptop Stand', 1699, 124, 'Stack', COLOURS.dark, ['studio'], { Material: 'Aluminium', Weight: '1.1 kg' }],
      ['Felt Desk Mat', 999, 150, 'Stack', COLOURS.neutral, ['studio'], { Material: 'Wool felt', Size: '90 x 40 cm' }],
      ['Oak Monitor Riser', 2299, 58, 'Stack', COLOURS.warm, ['studio'], { Material: 'Oak veneer', Weight: '2.2 kg' }]
    ]
  },
  {
    zone: 'L', category: 'Living', bay: 1, bayName: 'Smart home', start: 101, warrantyMonths: 12, arrivesInDays: 3,
    connectivity: 'wireless', blurb: 'works with the voice assistants you already use.',
    items: [
      ['Smart Plug Twin Pack', 1299, 170, 'Hearth', COLOURS.neutral, [], { Load: '10 A', Weight: '180 g' }],
      ['Colour Smart Bulb', 699, 240, 'Hearth', COLOURS.warm, [], { Power: '9 W', Weight: '70 g' }],
      ['Indoor Security Camera', 2899, 96, 'Hearth', COLOURS.dark, [], { Resolution: '2K', Weight: '140 g' }, { isNewDrop: true }]
    ]
  },
  {
    zone: 'L', category: 'Living', bay: 2, bayName: 'Decor', start: 201, warrantyMonths: 6, arrivesInDays: 4,
    blurb: 'a calm, handmade touch for the living room.',
    items: [
      ['Terracotta Planter Set', 1199, 140, 'Khadi Home', COLOURS.warm, [], { Material: 'Terracotta', Weight: '1.6 kg' }],
      ['Handloom Cushion Cover', 649, 180, 'Khadi Home', COLOURS.neutral, [], { Fabric: 'Cotton', Size: '45 x 45 cm' }],
      ['Woven Floor Rug', 4499, 40, 'Khadi Home', COLOURS.neutral, [], { Fabric: 'Jute', Size: '150 x 90 cm' }]
    ]
  },
  {
    zone: 'L', category: 'Living', bay: 3, bayName: 'Kitchen', start: 301, warrantyMonths: 12, arrivesInDays: 3,
    blurb: 'small kitchen upgrades for everyday use.',
    items: [
      ['Pour Over Coffee Set', 1799, 88, 'Hearth', COLOURS.neutral, [], { Material: 'Borosilicate glass', Weight: '640 g' }],
      ['Ceramic Mug Pair', 799, 150, 'Khadi Home', COLOURS.warm, [], { Material: 'Stoneware', Capacity: '350 ml' }],
      ['Digital Kitchen Scale', 1099, 62, 'Hearth', COLOURS.dark, [], { Battery: '12 months', Weight: '420 g' }]
    ]
  },
  {
    zone: 'S', category: 'Style', bay: 1, bayName: 'T-shirts', start: 101, warrantyMonths: 0, arrivesInDays: 3,
    blurb: 'soft everyday cotton with a clean cut.',
    items: [
      ['Heavyweight Cotton Tee', 799, 130, 'Northloom', COLOURS.neutral, ['commute'], { Fabric: '240 gsm cotton', Fit: 'Relaxed' }],
      ['Pocket Crew Tee', 649, 110, 'Northloom', COLOURS.warm, ['commute'], { Fabric: '180 gsm cotton', Fit: 'Regular' }],
      ['Dry-Fit Training Tee', 999, 84, 'Northloom', COLOURS.bright, ['gym'], { Fabric: 'Recycled polyester', Fit: 'Athletic' }]
    ]
  },
  {
    zone: 'S', category: 'Style', bay: 2, bayName: 'Eyewear', start: 201, warrantyMonths: 6, arrivesInDays: 3,
    blurb: 'lightweight frames with UV-protected lenses.',
    items: [
      ['Round Acetate Sunglasses', 1599, 58, 'Sol & Co', COLOURS.warm, ['commute'], { Lens: 'UV400', Weight: '26 g' }],
      ['Wayfarer Blue-Light Glasses', 1299, 66, 'Sol & Co', COLOURS.dark, ['commute'], { Lens: 'Blue-light filter', Weight: '24 g' }]
    ]
  },
  {
    zone: 'S', category: 'Style', bay: 3, bayName: 'Shirts', start: 18, warrantyMonths: 0, arrivesInDays: 3,
    blurb: 'breathable shirting made for warm days.',
    items: [
      ['Oxford Button Down', 1899, 72, 'Northloom', COLOURS.neutral, ['commute'], { Fabric: 'Cotton oxford', Fit: 'Regular' }],
      ['Chambray Overshirt', 2299, 48, 'Northloom', COLOURS.neutral, ['commute'], { Fabric: 'Cotton chambray', Fit: 'Relaxed' }],
      ['Linen Shirt', 2199, 92, 'Northloom', COLOURS.neutral, ['commute'], { Fabric: '100% linen', Fit: 'Relaxed' }, { isNewDrop: true }],
      ['Resort Collar Shirt', 1799, 64, 'Northloom', COLOURS.warm, ['commute'], { Fabric: 'Linen blend', Fit: 'Boxy' }]
    ]
  },
  {
    zone: 'G', category: 'Gaming', bay: 1, bayName: 'Controllers', start: 101, warrantyMonths: 12, arrivesInDays: 2,
    connectivity: 'wireless', blurb: 'low-latency control for console and PC.',
    items: [
      ['Vector Wireless Controller', 2999, 44, 'Pixelforge', COLOURS.bright, [], { Battery: '30 h', Weight: '230 g' }],
      ['Vector Elite Controller', 5999, 16, 'Pixelforge', COLOURS.dark, [], { Battery: '40 h', Weight: '250 g' }],
      ['Mobile Game Grip', 1299, 38, 'Pixelforge', COLOURS.dark, [], { Battery: '10 h', Weight: '180 g' }]
    ]
  },
  {
    zone: 'G', category: 'Gaming', bay: 2, bayName: 'Headsets', start: 201, warrantyMonths: 12, arrivesInDays: 2,
    connectivity: 'wired', blurb: 'clear team chat with a detachable mic.',
    items: [
      ['Raid Gaming Headset', 2499, 34, 'Pixelforge', COLOURS.dark, [], { Battery: 'None needed', Weight: '310 g' }],
      ['Raid Wireless Headset', 5499, 18, 'Pixelforge', COLOURS.dark, [], { Battery: '35 h', Weight: '330 g' }, { connectivity: 'wireless' }]
    ]
  },
  {
    zone: 'G', category: 'Gaming', bay: 3, bayName: 'Accessories', start: 301, warrantyMonths: 6, arrivesInDays: 3,
    blurb: 'the small upgrades that keep a setup running.',
    items: [
      ['Extended RGB Mouse Pad', 1199, 40, 'Pixelforge', COLOURS.dark, [], { Size: '90 x 40 cm', Weight: '480 g' }],
      ['Dual Controller Charging Dock', 1499, 26, 'Pixelforge', COLOURS.dark, [], { Power: '10 W', Weight: '210 g' }],
      ['Mechanical Keycap Set', 1899, 14, 'Pixelforge', COLOURS.bright, [], { Material: 'PBT', Keys: '132' }]
    ]
  },
  {
    zone: 'C', category: 'Carry', bay: 1, bayName: 'Backpacks', start: 101, warrantyMonths: 12, arrivesInDays: 3,
    blurb: 'a weather-resistant carry for daily commutes.',
    items: [
      ['Commuter Backpack 22L', 2999, 46, 'Roamwell', COLOURS.neutral, ['commute'], { Capacity: '22 L', Weight: '780 g' }],
      ['Weekender Duffel 35L', 3999, 28, 'Roamwell', COLOURS.neutral, ['gym'], { Capacity: '35 L', Weight: '950 g' }],
      ['Roll-Top Backpack 25L', 3499, 22, 'Roamwell', COLOURS.dark, ['commute'], { Capacity: '25 L', Weight: '820 g' }, { isNewDrop: true }]
    ]
  },
  {
    zone: 'C', category: 'Carry', bay: 2, bayName: 'Sleeves and bottles', start: 201, warrantyMonths: 6, arrivesInDays: 3,
    blurb: 'everyday protection for the things you carry.',
    items: [
      ['Felt Laptop Sleeve 14"', 1199, 38, 'Roamwell', COLOURS.neutral, ['commute'], { Material: 'Wool felt', Fits: 'Up to 14 in' }],
      ['Water Bottle 750 ml', 399, 44, 'Roamwell', COLOURS.bright, ['gym', 'commute'], { Material: 'Stainless steel', Capacity: '750 ml' }],
      ['A5 Dot Grid Notebook', 120, 26, 'Fieldnote', COLOURS.warm, ['commute'], { Paper: '100 gsm', Pages: '192' }]
    ]
  },
  {
    zone: 'C', category: 'Carry', bay: 3, bayName: 'Travel pouches', start: 301, warrantyMonths: 6, arrivesInDays: 3,
    blurb: 'keeps cables and small kit in one place.',
    items: [
      ['Tech Organiser Pouch', 899, 18, 'Roamwell', COLOURS.dark, ['commute'], { Material: 'Recycled nylon', Weight: '120 g' }],
      ['Packing Cube Set', 1299, 14, 'Roamwell', COLOURS.neutral, ['commute'], { Pieces: '3', Weight: '210 g' }]
    ]
  },
  {
    zone: 'P', category: 'Phone+', bay: 1, bayName: 'Chargers and hubs', start: 101, warrantyMonths: 12, arrivesInDays: 2,
    connectivity: 'wired', blurb: 'fast, cool-running power for phones and laptops.',
    items: [
      ['65W GaN Charger', 1999, 54, 'Voltline', COLOURS.dark, ['commute'], { Power: '65 W', Weight: '120 g' }],
      ['USB-C Hub 7-in-1', 1799, 36, 'Voltline', COLOURS.dark, ['studio'], { Ports: '7', Weight: '85 g' }],
      ['Braided USB-C Cable 2 m', 499, 62, 'Voltline', COLOURS.neutral, ['commute'], { Power: '100 W', Length: '2 m' }]
    ]
  },
  {
    zone: 'P', category: 'Phone+', bay: 2, bayName: 'Cases', start: 201, warrantyMonths: 6, arrivesInDays: 2,
    blurb: 'slim drop protection with raised edges.',
    items: [
      ['Silicone Phone Case', 599, 34, 'Voltline', COLOURS.bright, ['commute'], { Material: 'Silicone', Protection: '2 m drop' }],
      ['Clear MagSafe Case', 899, 24, 'Voltline', COLOURS.neutral, ['commute'], { Material: 'TPU', Protection: '3 m drop' }, { isNewDrop: true }],
      ['Leather Folio Case', 1499, 12, 'Voltline', COLOURS.warm, ['commute'], { Material: 'Vegan leather', Protection: '1.5 m drop' }]
    ]
  },
  {
    zone: 'P', category: 'Phone+', bay: 3, bayName: 'Power banks', start: 301, warrantyMonths: 12, arrivesInDays: 2,
    connectivity: 'wireless', blurb: 'dependable top-ups for long days out.',
    items: [
      ['10000 mAh Slim Power Bank', 1299, 26, 'Voltline', COLOURS.neutral, ['commute'], { Battery: '10000 mAh', Weight: '190 g' }],
      ['20000 mAh Fast Power Bank', 2299, 18, 'Voltline', COLOURS.dark, ['commute'], { Battery: '20000 mAh', Weight: '360 g' }],
      ['Magnetic Wireless Power Bank', 2799, 0, 'Voltline', COLOURS.neutral, ['commute'], { Battery: '5000 mAh', Weight: '130 g' }]
    ]
  },
  {
    zone: 'B', category: 'Body care', bay: 1, bayName: 'Grooming', start: 101, warrantyMonths: 12, arrivesInDays: 3,
    connectivity: 'wireless', blurb: 'a precise, skin-friendly daily routine.',
    items: [
      ['Precision Beard Trimmer', 1799, 14, 'Bare Theory', COLOURS.dark, [], { Battery: '90 min', Weight: '140 g' }],
      ['Sonic Electric Toothbrush', 2199, 12, 'Bare Theory', COLOURS.neutral, [], { Battery: '30 days', Weight: '110 g' }],
      ['Travel Shaver', 1299, 6, 'Bare Theory', COLOURS.dark, ['commute'], { Battery: '60 min', Weight: '95 g' }]
    ]
  },
  {
    zone: 'B', category: 'Body care', bay: 2, bayName: 'Skincare', start: 201, warrantyMonths: 0, arrivesInDays: 3,
    blurb: 'simple formulas with no added fragrance.',
    items: [
      ['Daily Sunscreen SPF 50', 599, 16, 'Bare Theory', COLOURS.warm, ['commute'], { Size: '50 ml', SkinType: 'All' }],
      ['Hydrating Face Wash', 449, 12, 'Bare Theory', COLOURS.warm, [], { Size: '100 ml', SkinType: 'Dry' }],
      ['Niacinamide Serum', 799, 3, 'Bare Theory', COLOURS.warm, [], { Size: '30 ml', SkinType: 'All' }, { isNewDrop: true }]
    ]
  }
];

const pad = (value, width) => String(value).padStart(width, '0');

function toProducts({ zone, category, bay, bayName, start, warrantyMonths, arrivesInDays, connectivity, blurb, items }) {
  return items.map(([productName, productPrice, quantity, brand, colours, use, specs, extras = {}], index) => {
    const productId = `${zone}-${pad(bay, 2)}-${pad(start + index, 3)}`;
    return {
      productId,
      productName,
      productPrice,
      quantity,
      category,
      zoneCode: zone,
      bay,
      bayName,
      brand,
      colours,
      use,
      connectivity: connectivity ?? 'n/a',
      specs,
      images: ['', '-colours', '-scale'].map(view => `/products/${productId}${view}.svg`),
      seller: 'BazaarMart Retail',
      warrantyMonths,
      arrivesInDays,
      description: `${brand} ${productName}: ${blurb}`,
      ...extras
    };
  });
}

export const products = bays.flatMap(toProducts);

// layout holds the column and row spans of each tile on the wireframe's floor plan.
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
  { title: 'Build a desk setup', query: { zone: 'D' } },
  { title: 'Pair a look with a watch', query: { zone: 'S,W' } },
  { title: 'Gift under ₹2000', query: { maxPrice: '2000' } }
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

// SKUs are looked up when seeding, so names and prices always match the catalogue.
export const demoOrders = [
  {
    items: [['W-01-101', 1], ['W-02-004', 1], ['A-01-117', 1]],
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
    items: [['S-03-020', 2], ['D-02-201', 1]],
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
