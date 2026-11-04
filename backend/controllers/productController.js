import Product from '../models/Product.js';
import Question from '../models/Question.js';
import Review from '../models/Review.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { ApiError, created, noContent, ok } from '../utils/response.js';

const EDITABLE_FIELDS = [
  'productName', 'productPrice', 'category', 'quantity', 'description', 'zoneCode', 'bay', 'bayName', 'brand',
  'colours', 'use', 'connectivity', 'specs', 'images', 'seller', 'warrantyMonths', 'arrivesInDays'
];
const CONNECTIVITY_VALUES = ['wired', 'wireless', 'n/a'];
const DEFAULT_PAGE_SIZE = 9;
const MAX_PAGE_SIZE = 50;
const RELATED_LIMIT = 3;
const SORTS = {
  price_asc: { productPrice: 1, productId: 1 },
  price_desc: { productPrice: -1, productId: 1 },
  new: { createdAt: -1, productId: 1 },
  name: { productName: 1, productId: 1 }
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const exactly = value => new RegExp(`^${escapeRegex(value)}$`, 'i');
const listOf = value => String(value).split(',').map(item => item.trim()).filter(Boolean);
const anyOf = value => ({ $in: listOf(value).map(exactly) });

function pickEditable(body) {
  const fields = Object.fromEntries(EDITABLE_FIELDS.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
  if (body.isNew !== undefined) fields.isNewDrop = body.isNew;
  return fields;
}

function numberParam(value, name) {
  const number = Number(value);
  if (value === '' || !Number.isFinite(number) || number < 0) throw new ApiError(400, `${name} must be a positive number.`);
  return number;
}

function booleanParam(value, name) {
  if (value !== 'true' && value !== 'false') throw new ApiError(400, `${name} must be true or false.`);
  return value === 'true';
}

function buildFilter(query) {
  const filter = {};
  if (query.zone !== undefined) filter.zoneCode = anyOf(query.zone);
  if (query.bay !== undefined) filter.bay = numberParam(query.bay, 'bay');
  if (query.brand !== undefined) filter.brand = anyOf(query.brand);
  if (query.colour !== undefined) filter.colours = anyOf(query.colour);
  if (query.use !== undefined) filter.use = anyOf(query.use);
  if (query.isNew !== undefined) filter.isNewDrop = booleanParam(query.isNew, 'isNew');

  if (query.connectivity !== undefined) {
    if (!CONNECTIVITY_VALUES.includes(query.connectivity)) {
      throw new ApiError(400, `connectivity must be one of: ${CONNECTIVITY_VALUES.join(', ')}.`);
    }
    filter.connectivity = query.connectivity;
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.productPrice = {};
    if (query.minPrice !== undefined) filter.productPrice.$gte = numberParam(query.minPrice, 'minPrice');
    if (query.maxPrice !== undefined) filter.productPrice.$lte = numberParam(query.maxPrice, 'maxPrice');
  }

  const search = typeof query.q === 'string' ? query.q.trim() : '';
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ productName: pattern }, { brand: pattern }, { category: pattern }];
  }
  return filter;
}

// Without ?page or ?limit this returns every match, which is the lab-specified list.
export async function findProducts(baseFilter, query) {
  const where = { ...baseFilter, ...buildFilter(query) };
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

export async function getProductSheet(req, res) {
  const product = await Product.findOne({ productId: req.params.productId }).select('-__v');
  if (!product) throw new ApiError(404, 'Product not found.');

  const sameArea = product.zoneCode ? { zoneCode: product.zoneCode } : { category: product.category };
  const related = await Product.find({ ...sameArea, _id: { $ne: product._id } })
    .select('-__v')
    .sort({ productId: 1 })
    .limit(RELATED_LIMIT);
  ok(res, { data: { product, related } });
}

export async function listByCategory(req, res) {
  const { category } = req.params;
  const { products, pagination } = await findProducts({ category: exactly(category) }, req.query);
  if (!products.length) throw new ApiError(404, `No products found in category "${category}".`);
  ok(res, { data: products, count: products.length, pagination });
}

export async function createProduct(req, res) {
  const { productId } = req.body;
  const product = await Product.create({ productId, ...pickEditable(req.body) });
  created(res, { message: 'Product created.', data: product });
}

function requireProductId(req) {
  const productId = String(req.query.productId || '').trim();
  if (!productId) throw new ApiError(400, 'productId query parameter is required.');
  return productId;
}

export async function updateProduct(req, res) {
  const productId = requireProductId(req);
  const updates = pickEditable(req.body);
  if (!Object.keys(updates).length) throw new ApiError(400, 'Provide at least one editable field.');

  const product = await Product.findOneAndUpdate({ productId }, updates, { new: true, runValidators: true });
  if (!product) throw new ApiError(404, 'Product not found.');
  ok(res, { message: 'Product updated.', data: product });
}

export async function deleteProduct(req, res) {
  const product = await Product.findOneAndDelete({ productId: requireProductId(req) });
  if (!product) throw new ApiError(404, 'Product not found.');
  await Promise.all([Review.deleteMany({ product: product._id }), Question.deleteMany({ product: product._id })]);
  noContent(res);
}
