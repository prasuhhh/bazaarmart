import Product from '../models/Product.js';
import { escapeRegex } from '../middleware/validate.js';
import { created, fail, noContent, ok } from '../utils/response.js';

const EDITABLE_FIELDS = ['productName', 'productPrice', 'category', 'quantity', 'description'];
const DEFAULT_PAGE_SIZE = 9;
const MAX_PAGE_SIZE = 50;
const SORTS = {
  price_asc: { productPrice: 1, productId: 1 },
  price_desc: { productPrice: -1, productId: 1 },
  name: { productName: 1, productId: 1 },
  newest: { createdAt: -1, productId: 1 }
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function pickEditable(body) {
  return Object.fromEntries(EDITABLE_FIELDS.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
}

// Without ?page or ?limit this returns every match, which is the lab-specified list.
async function findProducts(filter, query) {
  const search = typeof query.q === 'string' ? query.q.trim() : '';
  const where = search ? { ...filter, productName: new RegExp(escapeRegex(search), 'i') } : filter;
  const listing = Product.find(where).select('-__v').sort(SORTS[query.sort] || { productId: 1 });

  if (query.page === undefined && query.limit === undefined) return { products: await listing };

  const limit = clamp(parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const total = await Product.countDocuments(where);
  const pages = Math.max(Math.ceil(total / limit), 1);
  const page = clamp(parseInt(query.page, 10) || 1, 1, pages);
  const products = await listing.skip((page - 1) * limit).limit(limit);
  return { products, pagination: { page, pages, total, limit } };
}

export async function listProducts(req, res) {
  const { products, pagination } = await findProducts({}, req.query);
  ok(res, { data: products, count: products.length, pagination });
}

export async function listByCategory(req, res) {
  const { category } = req.params;
  const filter = { category: new RegExp(`^${escapeRegex(category)}$`, 'i') };
  const { products, pagination } = await findProducts(filter, req.query);
  if (!products.length) throw fail(404, `No products found in category "${category}".`);
  ok(res, { data: products, count: products.length, pagination });
}

export async function createProduct(req, res) {
  const { productId } = req.body;
  const product = await Product.create({ productId, ...pickEditable(req.body) });
  created(res, { message: 'Product created.', data: product });
}

function requireProductId(req) {
  const productId = String(req.query.productId || '').trim();
  if (!productId) throw fail(400, 'productId query parameter is required.');
  return productId;
}

export async function updateProduct(req, res) {
  const productId = requireProductId(req);
  const updates = pickEditable(req.body);
  if (!Object.keys(updates).length) throw fail(400, 'Provide at least one editable field.');

  const product = await Product.findOneAndUpdate({ productId }, updates, { new: true, runValidators: true });
  if (!product) throw fail(404, 'Product not found.');
  ok(res, { message: 'Product updated.', data: product });
}

export async function deleteProduct(req, res) {
  const product = await Product.findOneAndDelete({ productId: requireProductId(req) });
  if (!product) throw fail(404, 'Product not found.');
  noContent(res);
}
