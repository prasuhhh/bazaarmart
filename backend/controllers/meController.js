import User from '../models/User.js';
import { ADDRESS_FIELDS, pick, REQUIRED_DELIVERY_FIELDS, requireAddressFields } from '../utils/address.js';
import { ApiError, created, noContent, ok } from '../utils/response.js';

const REQUIRED_ADDRESS_FIELDS = ['label', ...REQUIRED_DELIVERY_FIELDS];
const DEVICE_FIELDS = ['name', 'category', 'purchasedAt', 'warrantyUntil'];
const STYLE_FIELDS = ['sizes', 'colours', 'brands'];
const NOTIFICATION_FIELDS = ['orderUpdates', 'priceDrops', 'newDrops'];
const UPI_HANDLE = /^[\w.-]{2,}@[a-z][a-z0-9.-]*$/i;
const CARD_LABEL = /^[a-z][a-z .&-]{1,29}$/i;

async function currentUser(req) {
  const user = await User.findById(req.user.userId);
  if (!user) throw new ApiError(404, 'User not found.');
  return user;
}

function findItem(list, id, label) {
  const item = list.id(id);
  if (!item) throw new ApiError(404, `${label} not found.`);
  return item;
}

// Keeps exactly one default: the chosen address wins, and if none is left marked,
// another address takes over.
function settleDefault(addresses, chosen) {
  if (chosen?.isDefault) {
    for (const address of addresses) if (address !== chosen) address.isDefault = false;
  }
  if (addresses.length && !addresses.some(address => address.isDefault)) {
    (addresses.find(address => address !== chosen) ?? addresses[0]).isDefault = true;
  }
}

export async function listAddresses(req, res) {
  const { addresses } = await currentUser(req);
  ok(res, { data: addresses, count: addresses.length });
}

export async function addAddress(req, res) {
  const user = await currentUser(req);
  const fields = pick(req.body, ADDRESS_FIELDS);
  requireAddressFields(fields, REQUIRED_ADDRESS_FIELDS);

  user.addresses.push({ ...fields, isDefault: req.body.isDefault === true });
  const address = user.addresses.at(-1);
  settleDefault(user.addresses, address);
  await user.save();
  created(res, { message: 'Address added.', data: address });
}

export async function updateAddress(req, res) {
  const user = await currentUser(req);
  const address = findItem(user.addresses, req.params.id, 'Address');
  address.set(pick(req.body, ADDRESS_FIELDS));
  requireAddressFields(address, REQUIRED_ADDRESS_FIELDS);
  if (typeof req.body.isDefault === 'boolean') address.isDefault = req.body.isDefault;

  settleDefault(user.addresses, address);
  await user.save();
  ok(res, { message: 'Address updated.', data: address });
}

export async function deleteAddress(req, res) {
  const user = await currentUser(req);
  findItem(user.addresses, req.params.id, 'Address').deleteOne();
  settleDefault(user.addresses);
  await user.save();
  noContent(res);
}

export async function listDevices(req, res) {
  const { devices } = await currentUser(req);
  ok(res, { data: devices, count: devices.length });
}

export async function addDevice(req, res) {
  const user = await currentUser(req);
  user.devices.push(pick(req.body, DEVICE_FIELDS));
  await user.save();
  created(res, { message: 'Device added.', data: user.devices.at(-1) });
}

export async function updateDevice(req, res) {
  const user = await currentUser(req);
  const device = findItem(user.devices, req.params.id, 'Device');
  device.set(pick(req.body, DEVICE_FIELDS));
  await user.save();
  ok(res, { message: 'Device updated.', data: device });
}

export async function deleteDevice(req, res) {
  const user = await currentUser(req);
  findItem(user.devices, req.params.id, 'Device').deleteOne();
  await user.save();
  noContent(res);
}

// Only a display token is kept. The fields are checked strictly so that a full
// card number can't end up stored in the label.
function parsePaymentMethod({ type, label, last4 }) {
  const text = typeof label === 'string' ? label.trim() : '';
  if (type === 'upi') {
    if (!UPI_HANDLE.test(text)) throw new ApiError(400, 'Enter a UPI handle like name@bank.');
    return { type, label: text };
  }
  if (type === 'card') {
    if (!CARD_LABEL.test(text)) throw new ApiError(400, 'Name the card with letters only, like Visa.');
    if (typeof last4 !== 'string' || !/^\d{4}$/.test(last4)) throw new ApiError(400, 'Enter only the last 4 digits of the card.');
    return { type, label: text, last4 };
  }
  throw new ApiError(400, 'type must be upi or card.');
}

export async function listPaymentMethods(req, res) {
  const { paymentMethods } = await currentUser(req);
  ok(res, { data: paymentMethods, count: paymentMethods.length });
}

export async function addPaymentMethod(req, res) {
  const method = parsePaymentMethod(req.body);
  const user = await currentUser(req);
  user.paymentMethods.push(method);
  await user.save();
  created(res, { message: 'Payment method added.', data: user.paymentMethods.at(-1) });
}

export async function deletePaymentMethod(req, res) {
  const user = await currentUser(req);
  findItem(user.paymentMethods, req.params.id, 'Payment method').deleteOne();
  await user.save();
  noContent(res);
}

const prefsOf = user => ({ stylePrefs: user.stylePrefs, notificationPrefs: user.notificationPrefs });

export async function getPrefs(req, res) {
  ok(res, { data: prefsOf(await currentUser(req)) });
}

export async function updatePrefs(req, res) {
  const stylePrefs = pick(req.body.stylePrefs ?? {}, STYLE_FIELDS);
  const notificationPrefs = pick(req.body.notificationPrefs ?? {}, NOTIFICATION_FIELDS);
  if (!Object.keys(stylePrefs).length && !Object.keys(notificationPrefs).length) {
    throw new ApiError(400, 'Provide at least one preference.');
  }
  const isTextList = value => Array.isArray(value) && value.every(item => typeof item === 'string');
  if (!Object.values(stylePrefs).every(isTextList)) throw new ApiError(400, 'Style preferences must be lists of text.');
  if (!Object.values(notificationPrefs).every(value => typeof value === 'boolean')) {
    throw new ApiError(400, 'Notification preferences must be true or false.');
  }

  const user = await currentUser(req);
  // Set one path at a time, so preferences that weren't sent keep their values.
  for (const [key, value] of Object.entries(stylePrefs)) user.set(`stylePrefs.${key}`, value);
  for (const [key, value] of Object.entries(notificationPrefs)) user.set(`notificationPrefs.${key}`, value);
  await user.save();
  ok(res, { message: 'Preferences updated.', data: prefsOf(user) });
}
