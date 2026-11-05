import Product from '../models/Product.js';
import Shelf from '../models/Shelf.js';
import { ApiError, created, noContent, ok } from '../utils/response.js';

function percentChange(savedPrice, currentPrice) {
  return savedPrice > 0 ? Math.round(((currentPrice - savedPrice) / savedPrice) * 100) : 0;
}

// Adds live price details. A deleted product stays listed, marked as unavailable.
async function withLivePrices(shelves) {
  const skus = shelves.flatMap(shelf => shelf.items.map(item => item.product));
  const products = await Product.find({ productId: { $in: skus } });
  const bySku = new Map(products.map(product => [product.productId, product]));

  return shelves.map(shelf => ({
    _id: shelf._id,
    name: shelf.name,
    shareId: shelf.shareId,
    items: shelf.items.map(({ product: productId, savedPrice, savedAt }) => {
      const product = bySku.get(productId);
      const base = { productId, savedPrice, savedAt, available: Boolean(product) };
      if (!product) return base;
      return {
        ...base,
        productName: product.productName,
        image: product.images[0],
        colours: product.colours,
        stock: product.quantity,
        currentPrice: product.productPrice,
        percentChange: percentChange(savedPrice, product.productPrice)
      };
    })
  }));
}

async function ownShelf(req) {
  const shelf = await Shelf.findById(req.params.id);
  if (!shelf) throw new ApiError(404, 'Shelf not found.');
  if (!shelf.user.equals(req.user.userId)) throw new ApiError(403, 'You can only manage your own shelves.');
  return shelf;
}

const liveShelf = async shelf => (await withLivePrices([shelf]))[0];

// A deleted product can't be bought, so it isn't a line. Out-of-stock lines stay,
// because the counter shows them greyed out.
async function sendCheckout(res, shelf) {
  const { name, items } = await liveShelf(shelf);
  const lines = items.filter(item => item.available).map(item => ({
    productId: item.productId,
    name: item.productName,
    image: item.image,
    price: item.currentPrice,
    stock: item.stock,
    inStock: item.stock > 0
  }));
  ok(res, { data: { shelfName: name, lines }, count: lines.length });
}

export async function listShelves(req, res) {
  const shelves = await Shelf.find({ user: req.user.userId }).sort({ createdAt: 1 });
  ok(res, { data: await withLivePrices(shelves), count: shelves.length });
}

export async function createShelf(req, res) {
  const shelf = await Shelf.create({ user: req.user.userId, name: req.body.name });
  created(res, { message: 'Shelf created.', data: await liveShelf(shelf) });
}

export async function getShelf(req, res) {
  ok(res, { data: await liveShelf(await ownShelf(req)) });
}

export async function getShelfCheckout(req, res) {
  await sendCheckout(res, await ownShelf(req));
}

export async function renameShelf(req, res) {
  const shelf = await ownShelf(req);
  if (req.body.name === undefined) throw new ApiError(400, 'Provide a new name.');
  shelf.name = req.body.name;
  await shelf.save();
  ok(res, { message: 'Shelf renamed.', data: await liveShelf(shelf) });
}

export async function deleteShelf(req, res) {
  const shelf = await ownShelf(req);
  await shelf.deleteOne();
  noContent(res);
}

export async function addShelfItem(req, res) {
  const shelf = await ownShelf(req);
  const { productId } = req.body;
  if (typeof productId !== 'string' || !productId.trim()) throw new ApiError(400, 'Provide a productId.');

  const product = await Product.findOne({ productId: productId.trim() });
  if (!product) throw new ApiError(404, 'Product not found.');
  if (shelf.items.some(item => item.product === product.productId)) {
    throw new ApiError(409, 'That product is already on this shelf.');
  }

  shelf.items.push({ product: product.productId, savedPrice: product.productPrice });
  await shelf.save();
  created(res, { message: 'Saved to shelf.', data: await liveShelf(shelf) });
}

export async function removeShelfItem(req, res) {
  const shelf = await ownShelf(req);
  const index = shelf.items.findIndex(item => item.product === req.params.productId);
  if (index === -1) throw new ApiError(404, 'That product is not on this shelf.');
  shelf.items.splice(index, 1);
  await shelf.save();
  noContent(res);
}

async function sharedShelf(req) {
  const shelf = await Shelf.findOne({ shareId: req.params.shareId });
  if (!shelf) throw new ApiError(404, 'Shelf not found.');
  return shelf;
}

// Public: the owner's details are left out, as anyone with the link can read this.
export async function getSharedShelf(req, res) {
  const { name, items } = await liveShelf(await sharedShelf(req));
  ok(res, { data: { name, items }, count: items.length });
}

export async function getSharedShelfCheckout(req, res) {
  await sendCheckout(res, await sharedShelf(req));
}
