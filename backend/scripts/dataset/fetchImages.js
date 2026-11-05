// Step 2 of the catalogue rebuild. Finds a licensed photo of each exact product:
//   a. Wikimedia Commons   b. Openverse   c. brand press image   d. brand product page
// Sources a and b are searched here. Sources c and d come from data/brand-pages.json, a list
// of { sku: { url, source } } gathered by hand, because each brand's site is different.
// Results go to data/images.json. Every response is cached in data/cache, so a rerun repeats
// no request. A product with no acceptable candidate is marked "missing", never a lookalike.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { photoKey } from './photoKey.js';

const DATA = new URL('../../data/', import.meta.url);
const CACHE = new URL('cache/http/', DATA);
const PRODUCTS = new URL('products-300.verified.json', DATA);
const OUTPUT = new URL('images.json', DATA);
const BRAND_PAGES = new URL('brand-pages.json', DATA);
const OPEN_BEAUTY = new URL('open-beauty.json', DATA);

const USER_AGENT = 'BazaarMartLabDataset/1.0 (student project)';
const GAP_MS = { 'commons.wikimedia.org': 1000, 'api.openverse.org': 3200 }; // Openverse: 20 a minute
const DEFAULT_GAP_MS = 1000;
const RETRIES = 3;
const TIMEOUT_MS = 30000;
const SHORTEST_SIDE = 600;
const CANDIDATES_KEPT = 5;
const LICENCES = /^(cc0|public domain|pdm|cc[ -]by(-sa)?([ -]\d|$))/i;
const NOISE = new Set(['the', 'and', 'with', 'for', 'of', 'in', 'usb', 'c', 'a', 'pack', 'set', 'kit', 'new', 'wireless',
  'bluetooth', 'wi', 'fi', 'men', 'mens', 'man', 'gen', 'generation', 'inch', 'cm', 'mm', 'ml', 'oz', 'g', 'l', 'm', 'w']);

const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms); });
const lastCall = new Map();

async function respectGap(host) {
  const wait = (lastCall.get(host) ?? 0) + (GAP_MS[host] ?? DEFAULT_GAP_MS) - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall.set(host, Date.now());
}

function cachePath(url) {
  return new URL(`${createHash('sha1').update(url).digest('hex')}.json`, CACHE);
}

// Only a 200 is cached, so a failed call is tried again on the next run.
async function getJson(url) {
  const file = cachePath(url);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const { host } = new URL(url);
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    await respectGap(host);
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
      .catch(() => null);
    if (response?.ok) {
      const body = await response.json();
      writeFileSync(file, JSON.stringify(body));
      return body;
    }
    if (response && ![429, 500, 502, 503].includes(response.status)) break;
    await sleep(Number(response?.headers.get('retry-after') ?? 0) * 1000 || attempt * 5000);
  }
  return null;
}

const wordsIn = text => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter(Boolean);
const stripTags = html => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// "Sony WH-1000XM5 (Black)" searches as "Sony WH-1000XM5".
export const searchName = name => name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

// A photo must name the brand and every token with a digit, which is what tells models apart,
// plus most of the other words. Step 4 still checks each photo by eye.
export function matchesProduct(text, product) {
  const list = wordsIn(text);
  const words = new Set(list);
  // "Flip6" and "WH1000XM5" count, but the 6 inside "DSCF2653" does not.
  const pairs = new Set(list.slice(1).map((word, index) => `${list[index]}${word}`));
  const has = word => words.has(word) || pairs.has(word) || [...words].some(found => !/\d/.test(word) && found.includes(word));
  const brand = wordsIn(product.brand);
  if (!brand.every(has)) return false;
  const brandWords = new Set(brand);
  const wanted = wordsIn(searchName(product.productName)).filter(word => !NOISE.has(word) && !brandWords.has(word));
  if (!wanted.length) return false;
  if (!wanted.filter(word => /\d/.test(word)).every(has)) return false;
  return wanted.filter(has).length / wanted.length >= 0.7;
}

function shortLicence(metadata) {
  return stripTags(metadata?.LicenseShortName?.value).replace(/^Public domain$/i, 'Public domain');
}

async function searchCommons(product) {
  const query = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '20',
    gsrsearch: `${searchName(product.productName)} filetype:bitmap`,
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1200'
  });
  const body = await getJson(`https://commons.wikimedia.org/w/api.php?${query}`);
  return Object.values(body?.query?.pages ?? {}).flatMap(page => {
    const info = page.imageinfo?.[0];
    if (!info) return [];
    const meta = info.extmetadata ?? {};
    const licence = shortLicence(meta);
    const author = stripTags(meta.Artist?.value) || null;
    if (!LICENCES.test(licence) || !/^image\/(jpeg|png|webp)$/.test(info.mime)) return [];
    if (Math.min(info.width, info.height) < SHORTEST_SIDE) return [];
    const title = page.title.replace(/^File:/, '');
    return [{
      source: 'wikimedia', title, width: info.width, height: info.height,
      sourcePage: info.descriptionurl, originalUrl: info.url, licence, author,
      attribution: `"${title}"${author ? ` by ${author}` : ''}, ${licence}, via Wikimedia Commons`
    }];
  });
}

async function searchOpenverse(product) {
  const query = new URLSearchParams({ q: searchName(product.productName), license: 'cc0,pdm,by,by-sa', page_size: '20' });
  const body = await getJson(`https://api.openverse.org/v1/images/?${query}`);
  return (body?.results ?? []).flatMap(photo => {
    if (Math.min(photo.width ?? 0, photo.height ?? 0) < SHORTEST_SIDE) return [];
    const licence = `CC ${String(photo.license).toUpperCase()}${photo.license_version ? ` ${photo.license_version}` : ''}`;
    return [{
      source: 'openverse', title: photo.title ?? '', tags: (photo.tags ?? []).map(tag => tag.name).join(' '),
      width: photo.width, height: photo.height, sourcePage: photo.foreign_landing_url, originalUrl: photo.url,
      licence, author: photo.creator ?? null,
      attribution: `"${photo.title ?? 'Photo'}"${photo.creator ? ` by ${photo.creator}` : ''}, ${licence}, via Openverse`
    }];
  });
}

const largestFirst = (a, b) => Math.min(b.width, b.height) - Math.min(a.width, a.height);

export function chooseFrom(found, product) {
  return found.filter(photo => matchesProduct(`${photo.title} ${photo.tags ?? ''}`, product)).sort(largestFirst);
}

const emptyImage = status => ({ status, source: null, sourcePage: null, originalUrl: null, licence: null, author: null, attribution: null, matchChecked: false });

function asImage(photo) {
  const { source, sourcePage, originalUrl, licence, author, attribution } = photo;
  return { status: 'ok', source, sourcePage, originalUrl, licence, author, attribution, matchChecked: false };
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const products = JSON.parse(readFileSync(PRODUCTS, 'utf8'));
  const images = existsSync(OUTPUT) ? JSON.parse(readFileSync(OUTPUT, 'utf8')) : {};
  const brandPages = existsSync(BRAND_PAGES) ? JSON.parse(readFileSync(BRAND_PAGES, 'utf8')) : {};
  const openBeauty = existsSync(OPEN_BEAUTY) ? JSON.parse(readFileSync(OPEN_BEAUTY, 'utf8')) : {};

  for (const [index, product] of products.entries()) {
    const sku = product.productId;
    if (images[sku]?.matchChecked) continue; // a photo checked by eye is never replaced here
    const rejected = new Set((images[sku]?.rejected ?? []).map(photoKey));
    const usable = photos => photos.filter(photo => !rejected.has(photoKey(photo.originalUrl)));

    let candidates = usable(chooseFrom(await searchCommons(product), product));
    if (!candidates.length) candidates = usable(chooseFrom(await searchOpenverse(product), product));
    // Kept behind any open-licence photo, so Step 4 can fall back to it.
    for (const extra of [openBeauty[sku], brandPages[sku]]) {
      if (extra && !rejected.has(photoKey(extra.originalUrl))) candidates = [...candidates, extra];
    }

    const top = candidates.slice(0, CANDIDATES_KEPT);
    images[sku] = { ...(top[0] ? asImage(top[0]) : emptyImage('missing')), candidates: top, ...(rejected.size && { rejected: images[sku].rejected }) };
    if ((index + 1) % 10 === 0) {
      writeFileSync(OUTPUT, `${JSON.stringify(images, null, 1)}\n`);
      console.log(`${index + 1}/${products.length} ${sku}`);
    }
  }
  writeFileSync(OUTPUT, `${JSON.stringify(images, null, 1)}\n`);

  const found = Object.values(images).filter(image => image.status === 'ok');
  const bySource = {};
  for (const { source } of found) bySource[source] = (bySource[source] ?? 0) + 1;
  console.log(`Candidates for ${found.length} of ${products.length}:`, bySource);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) await main();
