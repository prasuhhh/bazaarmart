import Kit from '../models/Kit.js';
import Product from '../models/Product.js';
import Zone from '../models/Zone.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { ApiError, ok } from '../utils/response.js';
import { findProducts } from './productController.js';

const MAX_SEARCH_RESULTS = 8;

export async function listZones(_req, res) {
  const [zones, stats] = await Promise.all([
    Zone.find().sort({ order: 1 }),
    Product.aggregate([
      { $match: { zoneCode: { $ne: null } } },
      {
        $group: {
          _id: { zoneCode: '$zoneCode', bay: '$bay', bayName: '$bayName' },
          count: { $sum: 1 },
          stock: { $sum: '$quantity' }
        }
      },
      { $sort: { '_id.bay': 1 } }
    ])
  ]);

  const data = zones.map(({ code, name, layout }) => {
    const rows = stats.filter(row => row._id.zoneCode === code);
    return {
      code,
      name,
      productCount: rows.reduce((sum, row) => sum + row.count, 0),
      totalStock: rows.reduce((sum, row) => sum + row.stock, 0),
      bays: rows.map(row => ({ bay: row._id.bay, bayName: row._id.bayName, count: row.count })),
      layout
    };
  });
  ok(res, { data, count: data.length });
}

export async function search(req, res) {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) throw new ApiError(400, 'q query parameter is required.');

  const results = await Product.find({ productId: new RegExp(`^${escapeRegex(q)}$`, 'i') }).select('-__v');

  // Text search matches whole words, so partial typing like "ear" needs the name
  // match below to fill in what's left.
  const textMatches = await Product.find({ $text: { $search: q } })
    .select('-__v')
    .sort({ score: { $meta: 'textScore' } })
    .limit(MAX_SEARCH_RESULTS);
  const nameMatches = await Product.find({ productName: new RegExp(escapeRegex(q), 'i') })
    .select('-__v')
    .sort({ productId: 1 })
    .limit(MAX_SEARCH_RESULTS);

  const seen = new Set(results.map(product => product.productId));
  for (const product of [...textMatches, ...nameMatches]) {
    if (seen.has(product.productId)) continue;
    seen.add(product.productId);
    results.push(product);
  }

  const data = results.slice(0, MAX_SEARCH_RESULTS);
  ok(res, { data, count: data.length });
}

export async function listKits(_req, res) {
  const kits = await Kit.find().select('-__v').sort({ createdAt: 1 });
  ok(res, { data: kits, count: kits.length });
}

export async function getKit(req, res) {
  const kit = await Kit.findById(req.params.id).select('-__v');
  if (!kit) throw new ApiError(404, 'Kit not found.');

  const { products } = kit.productIds.length
    ? await findProducts({ productId: { $in: kit.productIds } }, {})
    : await findProducts({}, Object.fromEntries(kit.query));
  ok(res, { data: { kit, products }, count: products.length });
}
