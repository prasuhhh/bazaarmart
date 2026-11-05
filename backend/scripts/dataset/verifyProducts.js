// Step 1 of the catalogue rebuild. Merges the verification ledger (data/verify/<zone>.json) into
// docs/dataset-300/products-300.json, checks each record, and writes
//   data/products-300.verified.json and data/reports/verify-report.md
// Facts are collected by hand from web sources; this script never invents or fetches a value.
// A product with no complete ledger record stays as it was, marked pending, and exit code is 1.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const SOURCE = new URL('../../../docs/dataset-300/products-300.json', import.meta.url);
const LEDGER = new URL('../../data/verify/', import.meta.url);
const OUTPUT = new URL('../../data/products-300.verified.json', import.meta.url);
const REPORTS = new URL('../../data/reports/', import.meta.url);

const CHECKED_AT = '2026-11-05';
const BIG_PRICE_CHANGE = 0.15;
const REVIEW_PRICE_CHANGE = 0.25;
const CONNECTIVITY = new Set(['wired', 'wireless', 'n/a']);
const PRICE_TYPES = new Set(['selling', 'mrp', 'launch-mrp', 'estimate']);

const readLedger = () => Object.assign({}, ...readdirSync(LEDGER)
  .filter(name => name.endsWith('.json'))
  .map(name => JSON.parse(readFileSync(new URL(name, LEDGER), 'utf8'))));

export function problemsIn(record) {
  const problems = [];
  if (!Number.isInteger(record.price) || record.price <= 0) problems.push('no whole-rupee price');
  if (!record.from) problems.push('no source');
  if (!PRICE_TYPES.has(record.priceType)) problems.push('no price type');
  if (record.swap?.status === 'needs-decision' || record.swap?.status === 'needs-replacement') problems.push('swap undecided');
  const specs = Object.keys(record.specs ?? {}).length;
  if (specs < 2 || specs > 4) problems.push(`${specs} spec rows`);
  if (!Array.isArray(record.colours) || record.colours.length < 1 || record.colours.length > 4) problems.push('colours');
  if (!CONNECTIVITY.has(record.connectivity)) problems.push('connectivity');
  const length = record.description?.length ?? 0;
  if (length < 60 || length > 250) problems.push(`description is ${length} characters`);
  return problems;
}

function merge(product, record) {
  const { price, priceType, snippetOnly, from, url, specs, colours, connectivity, description, flag, swap, productName, brand } = record;
  return {
    ...product,
    productName: productName ?? product.productName,
    brand: brand ?? product.brand,
    productPrice: price,
    specs,
    colours,
    connectivity,
    description,
    priceNote: { checkedAt: CHECKED_AT, from, type: priceType, ...(url && { url }) },
    verify: { status: flag ? 'flagged' : 'ok', ...(flag && { flag }), ...(swap && { swap }), ...(snippetOnly && { snippetOnly }) }
  };
}

const table = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`,
  ...rows.map(row => `| ${row.join(' | ')} |`)].join('\n');

function report(products, ledger, incomplete) {
  const done = products.filter(product => product.verify.status !== 'pending');
  const swaps = Object.entries(ledger).filter(([, record]) => record.swap);
  const changes = done.map(({ productId, productPrice }) => {
    const before = source.find(product => product.productId === productId).productPrice;
    return { productId, before, after: productPrice, change: (productPrice - before) / before };
  }).filter(({ change }) => Math.abs(change) > BIG_PRICE_CHANGE);
  const renames = done.filter(product => {
    const before = source.find(({ productId }) => productId === product.productId);
    return before.productName !== product.productName && !product.verify.swap;
  });
  const review = done.flatMap(product => {
    const before = source.find(({ productId }) => productId === product.productId).productPrice;
    const change = (product.productPrice - before) / before;
    const reasons = [
      product.priceNote.type === 'estimate' && 'estimate',
      (product.verify.snippetOnly || /snippet/i.test(product.verify.flag ?? '')) && 'snippet-only price',
      Math.abs(change) > REVIEW_PRICE_CHANGE && `${change > 0 ? '+' : ''}${Math.round(change * 100)}% against the file`
    ].filter(Boolean);
    return reasons.length ? [[product.productId, product.productName, before, product.productPrice, product.priceNote.from, reasons.join(', ')]] : [];
  });
  const types = {};
  for (const { priceNote } of done) types[priceNote.type] = (types[priceNote.type] ?? 0) + 1;

  return `# Verification report

Checked ${CHECKED_AT}. ${done.length} of ${products.length} products verified, ${incomplete.length} with incomplete records, ${products.length - done.length - incomplete.length} not yet researched.

Facts come from web search summaries of press, retailer and maker pages. \`priceNote.from\` names the site each price came from. Prices are the selling price at a major Indian retailer or official store where one was found, and otherwise an MRP or estimate, as \`priceNote.type\` records. They were not read live from brand sites.

Price basis: ${Object.entries(types).map(([type, count]) => `${type} ${count}`).join(', ')}.

## For your review

${review.length} products: estimates, snippet-only prices, and prices more than 25% away from the file.

${table(['SKU', 'Product', 'File', 'Verified', 'From', 'Why'], review)}

## Swaps and swap decisions

${table(['SKU', 'Status', 'From', 'To', 'Reason'], swaps.map(([sku, { swap }]) =>
    [sku, swap.status, swap.from ?? source.find(p => p.productId === sku).productName, swap.to ?? '(undecided)', swap.reason]))}

## Renamed

${table(['SKU', 'File name', 'New name'], renames.map(p =>
    [p.productId, source.find(({ productId }) => productId === p.productId).productName, p.productName]))}

## Price changes over 15%

${table(['SKU', 'File', 'Verified', 'Change', 'From'], changes.map(({ productId, before, after, change }) =>
    [productId, before, after, `${change > 0 ? '+' : ''}${Math.round(change * 100)}%`, products.find(p => p.productId === productId).priceNote.from]))}

## Uncertain or flagged

${table(['SKU', 'Note'], done.filter(p => p.verify.flag).map(p => [p.productId, p.verify.flag]))}

## Incomplete records

${table(['SKU', 'Missing'], incomplete.map(({ productId, problems }) => [productId, problems.join(', ')]))}
`;
}

const source = JSON.parse(readFileSync(SOURCE, 'utf8'));

function main() {
  const ledger = readLedger();
  const incomplete = [];
  const products = source.map(product => {
    const record = ledger[product.productId];
    if (!record) return { ...product, verify: { status: 'pending' } };
    const problems = problemsIn(record);
    if (!problems.length) return merge(product, record);
    incomplete.push({ productId: product.productId, problems });
    return { ...product, verify: { status: 'pending' } };
  });

  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(products, null, 1)}\n`);
  writeFileSync(new URL('verify-report.md', REPORTS), report(products, ledger, incomplete));

  const pending = products.filter(product => product.verify.status === 'pending').length;
  console.log(`Verified ${products.length - pending} of ${products.length}. Pending ${pending}, of which incomplete ${incomplete.length}.`);
  for (const { productId, problems } of incomplete) console.log(`  ${productId}: ${problems.join(', ')}`);
  if (pending) process.exitCode = 1;
}

main();
