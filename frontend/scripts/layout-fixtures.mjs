// A mock API shaped like the wireframe (six products a bay, three shelves of three, four
// orders), so every screen can be measured against it without a backend or database.
const iso = day => `2026-11-0${day}T10:12:00.000Z`;
const ZONES = [['A', 'Audio', 500, ['Earbuds', 'Headphones', 'Speakers']], ['W', 'Wearables', 490, ['Watches', 'Straps']], ['D', 'Desk setup', 900, ['Lamps']],
  ['L', 'Living', 880, ['Decor']], ['S', 'Style', 480, ['Shirts']], ['G', 'Gaming', 200, ['Pads']], ['C', 'Carry', 190, ['Bags']], ['P', 'Phone+', 180, ['Cases']], ['B', 'Body care', 50, ['Grooming']]]
  .map(([code, name, totalStock, bays]) => ({ code, name, totalStock, bays: bays.map((bayName, index) => ({ bay: index + 1, bayName })) }));

const product = (zone, bay, index) => ({
  productId: `${zone}-${String(bay).padStart(2, '0')}-${String(index).padStart(3, '0')}`,
  productName: 'Product name', productPrice: 1299, quantity: 40, category: ZONES.find(entry => entry.code === zone).name, zoneCode: zone, bay,
  bayName: ZONES.find(entry => entry.code === zone).bays[bay - 1]?.bayName, brand: 'Cedar', colours: ['Black', 'Sand', 'Olive'], use: ['gym', 'commute', 'studio'],
  connectivity: index % 2 ? 'wired' : 'wireless', specs: { battery: '24 h', weight: '48 g' }, seller: 'BazaarMart', warrantyMonths: 12, arrivesInDays: 1,
  description: 'A short description.', images: [1, 2, 3, 4, 5].map(view => `/products/${zone}-${bay}-${index}-${view}.svg`)
});
const bays = zone => [1, 2, 3].flatMap(bay => [0, 1, 2, 3, 4, 5].map(index => product(zone, bay, index)));
const newDrops = Array.from({ length: 20 }, (_, index) => product('A', 1, 100 + index));

const orderItems = [['A-01-117', 'Earbuds'], ['W-02-004', 'Watch strap'], ['S-03-020', 'Linen shirt']]
  .map(([productId, name]) => ({ productId, name, colour: 'Black', qty: 1, price: 999, image: `/products/${productId}.svg` }));
const EVENTS = ['placed', 'packed', 'shipped', 'out_for_delivery'];
const order = (orderNo, status, extra) => ({ _id: orderNo, orderNo, status, total: 2997, coupon: 100, items: orderItems, createdAt: iso(1), etaAt: iso(4), payment: { status: 'paid' }, events: [{ status: 'placed', at: iso(1) }], ...extra });
const ORDERS = [order('BM-2041', 'out_for_delivery'), order('BM-2038', 'packed'), order('BM-1990', 'delivered', { events: [{ status: 'delivered', at: iso(2) }] }), order('BM-1902', 'returned', { payment: { status: 'refunded' } })];
const PARCEL = { ...ORDERS[0], events: EVENTS.map((status, index) => ({ status, at: iso(index + 1) })), courier: { name: 'Courier', phone: '+919800000000' }, deliveryOtp: '4 8 1 9', slot: { label: 'Today 6–9 pm' }, leaveAtDoor: false };

const shelf = name => ({ _id: name, name, shareId: name, items: [1, 2, 3].map(index => ({ productId: `${name}-${index}`, productName: 'Product name', currentPrice: 999, percentChange: -12, image: `/products/${name}-${index}.svg`, available: true, stock: 5, colours: ['Black'] })) });
const ADDRESS = (label, isDefault) => ({ _id: label, label, isDefault, name: 'Customer', phone: '+919800000000', line1: '221B Baker', city: 'Pune', pincode: '411001' });
const PROFILE = {
  _id: 'me', username: 'Customer name', emailId: 'email@bazaar.test', phone: '+919800000000', createdAt: iso(1), role: 'customer',
  addresses: [ADDRESS('Home', true), ADDRESS('Office', false)],
  paymentMethods: [{ _id: 'u', type: 'upi', label: 'name@bank' }, { _id: 'c', type: 'card', label: 'Card', last4: '4021' }],
  devices: [{ _id: 'd', name: 'Earbuds', category: 'Earbuds' }, { _id: 'e', name: 'Watch', category: 'Watch' }],
  stylePrefs: { sizes: ['M'], colours: ['Black'], brands: ['Cedar'] }, notificationPrefs: { orderUpdates: true, priceDrops: true, newDrops: true }
};
const notes = [1, 2, 3].map(index => ({ _id: `r${index}`, rating: 5, text: 'Owner note.', user: { username: 'Member' } }));
const questions = [1, 2].map(index => ({ _id: `q${index}`, text: 'Question?', answer: 'Answer.' }));
const QUOTE = { lines: orderItems, subtotal: 2997, delivery: 0, coupon: 0, total: 2997 };

export const USER = { _id: 'me', username: 'Customer name', emailId: PROFILE.emailId, role: 'customer' };
export const RECEIPT = orderItems.map(item => ({ productId: item.productId, productName: item.name, productPrice: 999, quantity: 9, stock: 9, price: 999, colour: 'Black', qty: 1, image: item.image }));

export function respond(method, path) {
  const url = new URL(path, 'http://mock');
  const route = url.pathname;
  if (route === '/zones') return ZONES;
  if (route === '/kits') return ['Build a desk setup', 'Pair a look with a watch', 'Gift under ₹2000'].map((title, index) => ({ _id: `k${index}`, title }));
  if (route === '/products') {
    if (url.searchParams.get('isNew')) return newDrops;
    const list = bays(url.searchParams.get('zone') ?? 'A');
    return url.searchParams.get('limit') ? list.slice(0, Number(url.searchParams.get('limit'))) : list;
  }
  if (route.startsWith('/products/sheet/')) return { product: product('A', 1, 117), related: [product('A', 1, 1), product('A', 1, 2), product('A', 1, 3)] };
  if (route.endsWith('/reviews')) return notes;
  if (route.endsWith('/questions')) return questions;
  if (route === '/shelves') return ['New desk', 'Trip kit', 'Birthday ideas'].map(shelf);
  if (route === '/orders') return url.searchParams.get('status') ? ORDERS.slice(0, 2) : ORDERS;
  if (route === '/orders/quote') return QUOTE;
  if (route.endsWith('/track')) return PARCEL;
  if (route === '/users/me/receipt') return { lines: RECEIPT, syncedAt: null };
  if (route === '/users/me/addresses') return PROFILE.addresses;
  if (route === '/users/me') return PROFILE;
  return null;
}
