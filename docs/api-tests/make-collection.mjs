// Writes the Thunder Client collection and environment beside this file.
// Run after changing the API: node docs/api-tests/make-collection.mjs
import { writeFileSync } from 'node:fs';

const NOT_AN_ID = '000000000000000000000000';
const OUT = new URL('.', import.meta.url).pathname;
const stamp = '2026-11-05T00:00:00.000Z';

const user = { username: 'Test Shopper', emailId: '{{userEmail}}', age: 21, password: '{{userPassword}}' };
const other = { username: 'Other Shopper', emailId: '{{otherEmail}}', age: 22, password: '{{userPassword}}' };
const product = { productId: 'P900', productName: 'Test Lamp', productPrice: 899, category: 'Home', quantity: 5, description: 'Temporary API test product.', colours: ['Black'] };
const address = { label: 'Home', name: 'Test Shopper', phone: '9876543210', line1: '221B Lake Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' };
const delivery = { address, slot: { label: 'Tomorrow' }, payment: { method: 'upi' } };
const one = (qty = 1) => [{ productId: 'P900', qty }];
const me = '/users?emailId={{userEmail}}';
const status = { status: 'packed' };

// [folder, [[name, method, path, expected status, { token, body, save }]]]
const folders = [
  ['System', [
    ['Health check', 'GET', '/health', 200],
    ['Unknown route', 'GET', '/no-such-route', 404]
  ]],
  ['Register and log in', [
    ['Register', 'POST', '/users', 201, { body: user }],
    ['Register a second user', 'POST', '/users', 201, { body: other }],
    ['Duplicate email', 'POST', '/users', 409, { body: user }],
    ['Invalid body', 'POST', '/users', 400, { body: { username: 'A', emailId: 'bad', age: 200, password: '1' } }],
    ['Login: unknown email', 'POST', '/login', 404, { body: { emailId: 'nobody@example.com', password: 'secret123' } }],
    ['Login: wrong password', 'POST', '/login', 401, { body: { emailId: '{{userEmail}}', password: 'wrong-password' } }],
    ['Login: invalid body', 'POST', '/login', 400, { body: { emailId: 'bad' } }],
    ['Login as user', 'POST', '/login', 200, { body: { emailId: '{{userEmail}}', password: '{{userPassword}}' }, save: { token: 'json.data.token' } }],
    ['Login as second user', 'POST', '/login', 200, { body: { emailId: '{{otherEmail}}', password: '{{userPassword}}' }, save: { otherToken: 'json.data.token' } }],
    ['Login as admin', 'POST', '/login', 200, { body: { emailId: '{{adminEmail}}', password: '{{adminPassword}}' }, save: { adminToken: 'json.data.token' } }]
  ]],
  ['Phone OTP and Google', [
    ['Bad phone number', 'POST', '/auth/otp/request', 400, { body: { phone: '12345' } }],
    ['Request a code', 'POST', '/auth/otp/request', 200, { body: { phone: '{{otpPhone}}' }, save: { otpCode: 'json.data.devCode' } }],
    ['Malformed code', 'POST', '/auth/otp/verify', 400, { body: { phone: '{{otpPhone}}', code: '12' } }],
    ['Wrong code', 'POST', '/auth/otp/verify', 401, { body: { phone: '{{otpPhone}}', code: '000000' } }],
    ['Verify the code', 'POST', '/auth/otp/verify', 200, { body: { phone: '{{otpPhone}}', code: '{{otpCode}}' }, save: { phoneToken: 'json.data.token' } }],
    ['Google is not configured', 'POST', '/auth/google', 501, { body: {} }]
  ]],
  ['Account', [
    ['Profile: no token', 'GET', '/users/me', 401],
    ['Profile: bad token', 'GET', '/users/me', 401, { rawAuth: 'Bearer not-a-token' }],
    ['Get my profile', 'GET', '/users/me', 200, { token: 'token' }],
    ['PUT full update', 'PUT', me, 200, { token: 'token', body: { username: 'Test Shopper Two', age: 22, password: '{{userPassword}}' } }],
    ['PUT another user', 'PUT', '/users?emailId={{otherEmail}}', 403, { token: 'token', body: { username: 'Nope', age: 22, password: 'secret123' } }],
    ['PUT without emailId', 'PUT', '/users', 400, { token: 'token', body: { username: 'Nope', age: 22, password: 'secret123' } }],
    ['PUT without a password', 'PUT', me, 400, { token: 'token', body: { username: 'Nope', age: 22 } }],
    ['PUT no token', 'PUT', me, 401, { body: { username: 'Nope', age: 22, password: 'secret123' } }],
    ['PATCH one field', 'PATCH', me, 200, { token: 'token', body: { age: 23 } }],
    ['PATCH another user', 'PATCH', '/users?emailId={{otherEmail}}', 403, { token: 'token', body: { age: 23 } }],
    ['PATCH no fields', 'PATCH', me, 400, { token: 'token', body: {} }],
    ['PATCH no token', 'PATCH', me, 401, { body: { age: 23 } }],
    ['Session edit', 'PATCH', '/users/me', 200, { token: 'token', body: { age: 24 } }],
    ['Session edit: email is read-only', 'PATCH', '/users/me', 400, { token: 'token', body: { emailId: 'new@example.com' } }],
    ['Session edit: no token', 'PATCH', '/users/me', 401, { body: { age: 24 } }],
    ['Phone account: email taken', 'PATCH', '/users/me', 409, { token: 'phoneToken', body: { emailId: '{{userEmail}}' } }],
    ['Phone account: add an email', 'PATCH', '/users/me', 200, { token: 'phoneToken', body: { username: 'Phone User', emailId: '{{phoneEmail}}' } }]
  ]],
  ['Addresses', [
    ['No token', 'GET', '/users/me/addresses', 401],
    ['Add', 'POST', '/users/me/addresses', 201, { token: 'token', body: address, save: { addressId: 'json.data._id' } }],
    ['Add with fields missing', 'POST', '/users/me/addresses', 400, { token: 'token', body: { label: 'Home' } }],
    ['List', 'GET', '/users/me/addresses', 200, { token: 'token' }],
    ['Update', 'PUT', '/users/me/addresses/{{addressId}}', 200, { token: 'token', body: { city: 'Madurai' } }],
    ['Update unknown', 'PUT', `/users/me/addresses/${NOT_AN_ID}`, 404, { token: 'token', body: { city: 'Madurai' } }],
    ['Delete', 'DELETE', '/users/me/addresses/{{addressId}}', 204, { token: 'token' }],
    ['Delete again', 'DELETE', '/users/me/addresses/{{addressId}}', 404, { token: 'token' }]
  ]],
  ['Devices', [
    ['No token', 'GET', '/users/me/devices', 401],
    ['Add', 'POST', '/users/me/devices', 201, { token: 'token', body: { name: 'Pixel 9', category: 'Phone', warrantyUntil: '2030-01-01' }, save: { deviceId: 'json.data._id' } }],
    ['Add without a name', 'POST', '/users/me/devices', 400, { token: 'token', body: { category: 'Phone' } }],
    ['List', 'GET', '/users/me/devices', 200, { token: 'token' }],
    ['Update', 'PUT', '/users/me/devices/{{deviceId}}', 200, { token: 'token', body: { name: 'Pixel 10' } }],
    ['Update unknown', 'PUT', `/users/me/devices/${NOT_AN_ID}`, 404, { token: 'token', body: { name: 'Pixel 10' } }],
    ['Delete', 'DELETE', '/users/me/devices/{{deviceId}}', 204, { token: 'token' }],
    ['Delete again', 'DELETE', '/users/me/devices/{{deviceId}}', 404, { token: 'token' }]
  ]],
  ['Payment labels', [
    ['No token', 'GET', '/users/me/payment-methods', 401],
    ['Add a UPI handle', 'POST', '/users/me/payment-methods', 201, { token: 'token', body: { type: 'upi', label: 'name@bank' }, save: { paymentId: 'json.data._id' } }],
    ['Add a card label', 'POST', '/users/me/payment-methods', 201, { token: 'token', body: { type: 'card', label: 'Visa', last4: '4021' } }],
    ['A full card number is refused', 'POST', '/users/me/payment-methods', 400, { token: 'token', body: { type: 'card', label: '4111111111111111', last4: '1111' } }],
    ['List', 'GET', '/users/me/payment-methods', 200, { token: 'token' }],
    ['Delete', 'DELETE', '/users/me/payment-methods/{{paymentId}}', 204, { token: 'token' }],
    ['Delete again', 'DELETE', '/users/me/payment-methods/{{paymentId}}', 404, { token: 'token' }]
  ]],
  ['Preferences', [
    ['No token', 'GET', '/users/me/prefs', 401],
    ['Read', 'GET', '/users/me/prefs', 200, { token: 'token' }],
    ['Update', 'PATCH', '/users/me/prefs', 200, { token: 'token', body: { notificationPrefs: { priceDrops: false }, stylePrefs: { sizes: ['M'] } } }],
    ['Nothing to update', 'PATCH', '/users/me/prefs', 400, { token: 'token', body: {} }]
  ]],
  ['Catalogue', [
    ['List', 'GET', '/products', 200],
    ['Filter by zone and price', 'GET', '/products?zone=A&maxPrice=2000&sort=price_asc', 200],
    ['Paginate', 'GET', '/products?page=1&limit=2', 200],
    ['Bad filter', 'GET', '/products?minPrice=cheap', 400],
    ['Category filter', 'GET', '/products/audio', 200],
    ['Unknown category', 'GET', '/products/no-such-category', 404],
    ['Product sheet', 'GET', '/products/sheet/A-01-117', 200],
    ['Unknown product sheet', 'GET', '/products/sheet/NOPE', 404],
    ['Zones', 'GET', '/zones', 200],
    ['Search', 'GET', '/search?q=earbuds', 200],
    ['Search without q', 'GET', '/search', 400],
    ['Kits', 'GET', '/kits', 200, { save: { kitId: 'json.data.0._id' } }],
    ['One kit', 'GET', '/kits/{{kitId}}', 200],
    ['Unknown kit', 'GET', `/kits/${NOT_AN_ID}`, 404],
    ['Malformed kit id', 'GET', '/kits/not-an-id', 400]
  ]],
  ['Managing products', [
    ['Create: no token', 'POST', '/products', 401, { body: product }],
    ['Create: not an admin', 'POST', '/products', 403, { token: 'token', body: product }],
    ['Create', 'POST', '/products', 201, { token: 'adminToken', body: product }],
    ['Create: duplicate productId', 'POST', '/products', 409, { token: 'adminToken', body: product }],
    ['Create: invalid body', 'POST', '/products', 400, { token: 'adminToken', body: { ...product, productId: 'P901', productPrice: -1 } }],
    ['Update', 'PUT', '/products?productId=P900', 200, { token: 'adminToken', body: { productPrice: 999 } }],
    ['Update: no token', 'PUT', '/products?productId=P900', 401, { body: { productPrice: 1 } }],
    ['Update: not an admin', 'PUT', '/products?productId=P900', 403, { token: 'token', body: { productPrice: 1 } }],
    ['Update: unknown product', 'PUT', '/products?productId=P999', 404, { token: 'adminToken', body: { productPrice: 1 } }],
    ['Update: no productId', 'PUT', '/products', 400, { token: 'adminToken', body: { productPrice: 1 } }]
  ]],
  ['Reviews and questions', [
    ['Review: no token', 'POST', '/products/P900/reviews', 401, { body: { rating: 5, text: 'Great.' } }],
    ['Review: invalid rating', 'POST', '/products/P900/reviews', 400, { token: 'token', body: { rating: 9, text: 'Great.' } }],
    ['Review', 'POST', '/products/P900/reviews', 201, { token: 'token', body: { rating: 5, text: 'Great.' } }],
    ['Review twice', 'POST', '/products/P900/reviews', 409, { token: 'token', body: { rating: 1, text: 'Again.' } }],
    ['Review: unknown product', 'POST', '/products/NOPE/reviews', 404, { token: 'token', body: { rating: 5, text: 'Great.' } }],
    ['Read reviews', 'GET', '/products/P900/reviews', 200],
    ['Read reviews: unknown product', 'GET', '/products/NOPE/reviews', 404],
    ['Question: no token', 'POST', '/products/P900/questions', 401, { body: { text: 'Waterproof?' } }],
    ['Question: no text', 'POST', '/products/P900/questions', 400, { token: 'token', body: {} }],
    ['Question', 'POST', '/products/P900/questions', 201, { token: 'token', body: { text: 'Waterproof?' } }],
    ['Question: unknown product', 'POST', '/products/NOPE/questions', 404, { token: 'token', body: { text: 'Waterproof?' } }],
    ['Read questions', 'GET', '/products/P900/questions', 200],
    ['Read questions: unknown product', 'GET', '/products/NOPE/questions', 404]
  ]],
  ['Shelves', [
    ['No token', 'GET', '/shelves', 401],
    ['Create', 'POST', '/shelves', 201, { token: 'token', body: { name: 'New desk' }, save: { shelfId: 'json.data._id', shareId: 'json.data.shareId' } }],
    ['Create without a name', 'POST', '/shelves', 400, { token: 'token', body: {} }],
    ['List', 'GET', '/shelves', 200, { token: 'token' }],
    ['Read one', 'GET', '/shelves/{{shelfId}}', 200, { token: 'token' }],
    ["Read someone else's", 'GET', '/shelves/{{shelfId}}', 403, { token: 'otherToken' }],
    ['Read unknown', 'GET', `/shelves/${NOT_AN_ID}`, 404, { token: 'token' }],
    ['Rename', 'PATCH', '/shelves/{{shelfId}}', 200, { token: 'token', body: { name: 'Trip kit' } }],
    ['Rename without a name', 'PATCH', '/shelves/{{shelfId}}', 400, { token: 'token', body: {} }],
    ['Save an item', 'POST', '/shelves/{{shelfId}}/items', 201, { token: 'token', body: { productId: 'P900' } }],
    ['Save it twice', 'POST', '/shelves/{{shelfId}}/items', 409, { token: 'token', body: { productId: 'P900' } }],
    ['Save without a productId', 'POST', '/shelves/{{shelfId}}/items', 400, { token: 'token', body: {} }],
    ['Save an unknown product', 'POST', '/shelves/{{shelfId}}/items', 404, { token: 'token', body: { productId: 'NOPE' } }],
    ['Shared link, public', 'GET', '/shelves/shared/{{shareId}}', 200],
    ['Unknown shared link', 'GET', '/shelves/shared/nope', 404],
    ['Checkout lines', 'GET', '/shelves/{{shelfId}}/checkout', 200, { token: 'token' }],
    ['Checkout lines, no token', 'GET', '/shelves/{{shelfId}}/checkout', 401],
    ["Checkout lines, someone else's", 'GET', '/shelves/{{shelfId}}/checkout', 403, { token: 'otherToken' }],
    ['Checkout lines, unknown shelf', 'GET', `/shelves/${NOT_AN_ID}/checkout`, 404, { token: 'token' }],
    ['Shared checkout lines, public', 'GET', '/shelves/shared/{{shareId}}/checkout', 200],
    ['Shared checkout lines, unknown link', 'GET', '/shelves/shared/nope/checkout', 404],
    ['Order from the shelf', 'POST', '/orders', 201, { token: 'token', body: { items: one(), ...delivery, source: { type: 'shelf', shelfId: '{{shelfId}}' } } }],
    ['Order from the shelf: item not on it', 'POST', '/orders', 400, { token: 'token', body: { items: [{ productId: 'A-01-117', qty: 1 }], ...delivery, source: { type: 'shelf', shelfId: '{{shelfId}}' } } }],
    ["Order from someone else's shelf", 'POST', '/orders', 403, { token: 'otherToken', body: { items: one(), ...delivery, source: { type: 'shelf', shelfId: '{{shelfId}}' } } }],
    ['Order by shelf id as a guest', 'POST', '/orders', 401, { body: { items: one(), ...delivery, guest: { name: 'Guest', phone: '{{guestPhone}}' }, source: { type: 'shelf', shelfId: '{{shelfId}}' } } }],
    ['Order from an unknown shelf', 'POST', '/orders', 404, { token: 'token', body: { items: one(), ...delivery, source: { type: 'shelf', shelfId: NOT_AN_ID } } }],
    ['Remove from a shelf you do not own', 'POST', '/orders', 403, { token: 'otherToken', body: { items: one(), ...delivery, source: { type: 'shelf', shareId: '{{shareId}}' }, removeFromShelf: true } }],
    ['Remove an item', 'DELETE', '/shelves/{{shelfId}}/items/P900', 204, { token: 'token' }],
    ['Remove it again', 'DELETE', '/shelves/{{shelfId}}/items/P900', 404, { token: 'token' }],
    ['Delete', 'DELETE', '/shelves/{{shelfId}}', 204, { token: 'token' }],
    ['Delete again', 'DELETE', '/shelves/{{shelfId}}', 404, { token: 'token' }]
  ]],
  ['Orders', [
    ['Quote', 'POST', '/orders/quote', 200, { body: { items: one(), coupon: 'WELCOME10' } }],
    ['Quote: bad coupon', 'POST', '/orders/quote', 400, { body: { items: one(), coupon: 'NOPE' } }],
    ['Quote: unknown product', 'POST', '/orders/quote', 404, { body: { items: [{ productId: 'NOPE', qty: 1 }] } }],
    ['Quote: more than the stock', 'POST', '/orders/quote', 409, { body: { items: one(99) } }],
    ['Guest without details', 'POST', '/orders', 400, { body: { items: one(), ...delivery } }],
    ['Guest checkout', 'POST', '/orders', 201, { body: { items: one(), ...delivery, guest: { name: 'Guest', phone: '{{guestPhone}}' } }, save: { guestOrderNo: 'json.data.orderNo' } }],
    ['Place an order', 'POST', '/orders', 201, { token: 'token', body: { items: [{ productId: 'P900', qty: 1, colour: 'Black' }], ...delivery, coupon: 'WELCOME10' }, save: { orderNo: 'json.data.orderNo' } }],
    ['Unknown product', 'POST', '/orders', 404, { token: 'token', body: { items: [{ productId: 'NOPE', qty: 1 }], ...delivery } }],
    ['More than the stock', 'POST', '/orders', 409, { token: 'token', body: { items: one(99), ...delivery } }],
    ['A colour it does not come in', 'POST', '/orders', 400, { token: 'token', body: { items: [{ productId: 'P900', qty: 1, colour: 'Teal' }], ...delivery } }],
    ['Empty order', 'POST', '/orders', 400, { token: 'token', body: { items: [], ...delivery } }],
    ['No address', 'POST', '/orders', 400, { token: 'token', body: { items: one(), slot: delivery.slot, payment: delivery.payment } }],
    ['My orders', 'GET', '/orders', 200, { token: 'token' }],
    ['Live orders', 'GET', '/orders?status=live', 200, { token: 'token' }],
    ['Bad status filter', 'GET', '/orders?status=lost', 400, { token: 'token' }],
    ['My orders: no token', 'GET', '/orders', 401],
    ['Read my order', 'GET', '/orders/{{orderNo}}', 200, { token: 'token' }],
    ["Read someone else's", 'GET', '/orders/{{orderNo}}', 403, { token: 'otherToken' }],
    ['Read: no token', 'GET', '/orders/{{orderNo}}', 401],
    ['Read unknown', 'GET', '/orders/BM-1', 404, { token: 'token' }],
    ['Read a guest order by phone', 'GET', '/orders/{{guestOrderNo}}?phone={{guestPhone}}', 200],
    ['Read a guest order: no phone', 'GET', '/orders/{{guestOrderNo}}', 400],
    ['Track my order', 'GET', '/orders/{{orderNo}}/track', 200, { token: 'token' }],
    ["Track someone else's", 'GET', '/orders/{{orderNo}}/track', 403, { token: 'otherToken' }],
    ['Track: no token', 'GET', '/orders/{{orderNo}}/track', 401],
    ['Track unknown', 'GET', '/orders/BM-1/track', 404, { token: 'token' }],
    ['Track a guest order', 'GET', '/orders/{{guestOrderNo}}/track?phone={{guestPhone}}', 200],
    ['Track a guest order: wrong phone', 'GET', '/orders/{{guestOrderNo}}/track?phone=9000000000', 403],
    ['Track a guest order: no phone', 'GET', '/orders/{{guestOrderNo}}/track', 400],
    ['Change the slot', 'PATCH', '/orders/{{orderNo}}', 200, { token: 'token', body: { slot: { label: 'Today 6–9 pm' } } }],
    ['Leave at door', 'PATCH', '/orders/{{orderNo}}', 200, { token: 'token', body: { leaveAtDoor: true } }],
    ['Nothing to change', 'PATCH', '/orders/{{orderNo}}', 400, { token: 'token', body: {} }],
    ['Change: no token', 'PATCH', '/orders/{{orderNo}}', 401, { body: { leaveAtDoor: true } }],
    ["Change someone else's", 'PATCH', '/orders/{{orderNo}}', 403, { token: 'otherToken', body: { leaveAtDoor: true } }],
    ['Change unknown', 'PATCH', '/orders/BM-1', 404, { token: 'token', body: { leaveAtDoor: true } }]
  ]],
  ['Admin orders', [
    ['List', 'GET', '/admin/orders', 200, { token: 'adminToken' }],
    ['List live orders', 'GET', '/admin/orders?status=live', 200, { token: 'adminToken' }],
    ['Bad status filter', 'GET', '/admin/orders?status=lost', 400, { token: 'adminToken' }],
    ['List: no token', 'GET', '/admin/orders', 401],
    ['List: not an admin', 'GET', '/admin/orders', 403, { token: 'token' }],
    ['Status: not an admin', 'PATCH', '/admin/orders/{{orderNo}}/status', 403, { token: 'token', body: status }],
    ['Status: no token', 'PATCH', '/admin/orders/{{orderNo}}/status', 401, { body: status }],
    ['Status: not a status', 'PATCH', '/admin/orders/{{orderNo}}/status', 400, { token: 'adminToken', body: { status: 'lost' } }],
    ['Status: skip a step', 'PATCH', '/admin/orders/{{orderNo}}/status', 409, { token: 'adminToken', body: { status: 'delivered' } }],
    ['Status: unknown order', 'PATCH', '/admin/orders/BM-1/status', 404, { token: 'adminToken', body: status }],
    ['Mark packed', 'PATCH', '/admin/orders/{{orderNo}}/status', 200, { token: 'adminToken', body: status }],
    ['Cancel', 'PATCH', '/orders/{{orderNo}}', 200, { token: 'token', body: { cancel: true } }],
    ['Cancel again', 'PATCH', '/orders/{{orderNo}}', 409, { token: 'token', body: { cancel: true } }]
  ]],
  ['Clean up', [
    ['Delete product: no token', 'DELETE', '/products?productId=P900', 401],
    ['Delete product: not an admin', 'DELETE', '/products?productId=P900', 403, { token: 'token' }],
    ['Delete product', 'DELETE', '/products?productId=P900', 204, { token: 'adminToken' }],
    ['Delete it again', 'DELETE', '/products?productId=P900', 404, { token: 'adminToken' }],
    ['Delete: no productId', 'DELETE', '/products', 400, { token: 'adminToken' }],
    ['Delete account: no token', 'DELETE', me, 401],
    ['Delete another account', 'DELETE', '/users?emailId={{otherEmail}}', 403, { token: 'token' }],
    ['Delete: no emailId', 'DELETE', '/users', 400, { token: 'token' }],
    ['Delete my account', 'DELETE', me, 204, { token: 'token' }],
    ['Delete the second account', 'DELETE', '/users?emailId={{otherEmail}}', 204, { token: 'otherToken' }],
    ['Session delete: no token', 'DELETE', '/users/me', 401],
    ['Delete the phone account', 'DELETE', '/users/me', 204, { token: 'phoneToken' }]
  ]],
  // Last, because these use up the OTP limit of 5 requests per 10 minutes.
  ['Rate limit', [
    ['Request 3 of 5', 'POST', '/auth/otp/request', 200, { body: { phone: '{{limitPhone}}' } }],
    ['Request 4 of 5', 'POST', '/auth/otp/request', 200, { body: { phone: '{{limitPhone}}' } }],
    ['Request 5 of 5', 'POST', '/auth/otp/request', 200, { body: { phone: '{{limitPhone}}' } }],
    ['One too many', 'POST', '/auth/otp/request', 429, { body: { phone: '{{limitPhone}}' } }]
  ]]
];

const environment = {
  baseUrl: 'http://localhost:5000/api',
  token: '',
  adminToken: '',
  otherToken: '',
  phoneToken: '',
  userEmail: 'api.test@example.com',
  otherEmail: 'api.other@example.com',
  phoneEmail: 'api.phone@example.com',
  userPassword: 'secret123',
  adminEmail: 'admin@bazaarmart.test',
  adminPassword: 'SET_FROM_BACKEND_ENV',
  otpPhone: '+919000000001',
  limitPhone: '+919000000003',
  guestPhone: '9000000002',
  otpCode: '', orderNo: '', guestOrderNo: '', shelfId: '', shareId: '', addressId: '', deviceId: '', paymentId: '', kitId: ''
};

const idFor = (...parts) => parts.join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-');
const collectionId = 'bazaarmart-api';

const thunderRequest = (folderId, sortNum, [name, method, path, expected, options = {}]) => {
  const { token, body, save = {}, rawAuth } = options;
  const headers = [];
  if (token) headers.push({ name: 'Authorization', value: `Bearer {{${token}}}` });
  if (rawAuth) headers.push({ name: 'Authorization', value: rawAuth });
  return {
    _id: idFor(folderId, String(sortNum), name),
    colId: collectionId,
    containerId: folderId,
    name: `${name} → ${expected}`,
    url: `{{baseUrl}}${path}`,
    method,
    sortNum,
    created: stamp,
    modified: stamp,
    headers,
    ...(body && { body: { type: 'json', raw: JSON.stringify(body, null, 2), form: [] } }),
    tests: [
      { type: 'res-code', custom: '', action: 'equal', value: String(expected) },
      ...Object.entries(save).map(([variable, from]) => ({ type: 'set-env-var', custom: from, action: 'setto', value: `{{${variable}}}` }))
    ]
  };
};

const collection = {
  clientName: 'Thunder Client',
  collectionName: 'BazaarMart API',
  collectionId,
  dateExported: stamp,
  version: '1.2',
  folders: folders.map(([name], index) => ({ _id: idFor('folder', name), name, containerId: '', created: stamp, sortNum: (index + 1) * 10 })),
  requests: folders.flatMap(([name, requests]) =>
    requests.map((entry, index) => thunderRequest(idFor('folder', name), (index + 1) * 10, entry)))
};

const environmentFile = {
  clientName: 'Thunder Client',
  envName: 'BazaarMart',
  dateExported: stamp,
  version: '1.1',
  data: Object.entries(environment).map(([name, value]) => ({ name, value }))
};

writeFileSync(`${OUT}thunder-collection_BazaarMart.json`, `${JSON.stringify(collection, null, 2)}\n`);
writeFileSync(`${OUT}thunder-environment_BazaarMart.json`, `${JSON.stringify(environmentFile, null, 2)}\n`);
console.log(`Wrote ${collection.requests.length} requests in ${collection.folders.length} folders.`);
