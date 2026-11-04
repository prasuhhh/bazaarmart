// Finds one openly licensed photo per product. Run with `npm run photos`, then `npm run seed`.
//   Openverse is searched once per query, Wikimedia Commons only when that finds nothing good.
//   data/photo-cache.json (git-ignored) keeps every response, so a rerun repeats no search.
//   data/product-photos.json records what was chosen, and public/products/CREDITS.md credits it.
//   data/photo-choices.json swaps a bad pick: reject a URL, give a SKU a simpler query, or
//   keep a SKU on its SVG. Rerun and only the affected products change.
// It is safe to stop and restart: finished products are skipped.
import { existsSync } from 'node:fs';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const DATA = new URL('../data/', import.meta.url);
const OUTPUT_DIR = new URL('../public/products/', import.meta.url);
const CACHE_FILE = fileURLToPath(new URL('photo-cache.json', DATA));
const CHOSEN_FILE = fileURLToPath(new URL('product-photos.json', DATA));
const CREDITS_FILE = fileURLToPath(new URL('CREDITS.md', OUTPUT_DIR));

const USER_AGENT = 'BazaarMartPhotoFetcher/1.0 (student store demo)';
const SEARCH_GAP_MS = 3200; // Openverse allows 20 anonymous searches a minute
const DOWNLOAD_GAP_MS = 400;
const REQUEST_TIMEOUT_MS = 30000;
const SEARCH_ATTEMPTS = 5;
const DOWNLOAD_ATTEMPTS = 2; // a dead image link just moves on to the next candidate
const DOWNLOAD_TIMEOUT_MS = 15000;
const FIRST_BACKOFF_MS = 5000;
const LONGEST_WAIT_MS = 120000; // a longer Retry-After means the daily limit, so move on
const PHOTO_WIDTH = 800;
const SMALLEST_WIDTH = 400;
const HEAD_WORD_SCORE = 2;
const REUSABLE = new Set(['cc0', 'pdm', 'by', 'by-sa']);
const BLOCKED_WORDS = ['man', 'men', 'woman', 'women', 'girl', 'boy', 'person', 'people', 'portrait', 'face',
  'wedding', 'poster', 'logo', 'icon', 'vector', 'drawing', 'painting', 'illustration'];

const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms); });
const wordsIn = text => String(text ?? '').toLowerCase().replace(/&[a-z]+;/g, ' ').split(/[^a-z0-9]+/).filter(Boolean);
const stripTags = html => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const describe = photo => wordsIn(`${photo.title} ${photo.tags.join(' ')}`);

// Words in the query itself are fine, or "face wash" could never match.
export function isUsable(photo, query) {
  if (!REUSABLE.has(photo.license)) return false;
  if (!/^https:/.test(photo.url ?? '') || /\.(svg|gif|tiff?|pdf)$/i.test(photo.url)) return false;
  const queryWords = new Set(wordsIn(query));
  return !describe(photo).some(word => BLOCKED_WORDS.includes(word) && !queryWords.has(word));
}

// The last word of a query names the thing ("wireless earbuds"), so it counts double.
export function matchScore(photo, query) {
  const words = new Set(describe(photo));
  const queryWords = wordsIn(query);
  return queryWords.reduce((score, word, index) =>
    score + (words.has(word) ? (index === queryWords.length - 1 ? 2 : 1) : 0), 0);
}

export function commonsLicense(metadata) {
  const name = (metadata?.LicenseShortName?.value ?? '').toLowerCase();
  if (name.startsWith('cc0')) return 'cc0';
  if (name.startsWith('public domain') || name.startsWith('pd')) return 'pdm';
  if (name.startsWith('cc by-sa') || name.startsWith('cc-by-sa')) return 'by-sa';
  if (name.startsWith('cc by') || name.startsWith('cc-by')) return 'by';
  return null;
}

// Returns null instead of throwing, so one bad request never stops the run.
async function request(url, { attempts = SEARCH_ATTEMPTS, timeout = REQUEST_TIMEOUT_MS } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(timeout)
      });
      if (response.ok) return response;
      if (response.status !== 429 && response.status < 500) return null;
      const asked = Number(response.headers.get('retry-after')) * 1000;
      const wait = asked || FIRST_BACKOFF_MS * 2 ** attempt;
      if (wait > LONGEST_WAIT_MS) {
        console.log(`  Rate limited for ${Math.round(wait / 60000)} min by ${new URL(url).host}, moving on.`);
        return null;
      }
      await sleep(wait);
    } catch {
      if (attempt + 1 < attempts) await sleep(FIRST_BACKOFF_MS * 2 ** attempt);
    }
  }
  return null;
}

async function requestJson(url) {
  const response = await request(url);
  return response ? response.json().catch(() => null) : null;
}

async function searchOpenverse(query) {
  const params = new URLSearchParams({
    q: query, category: 'photograph', license_type: 'commercial', aspect_ratio: 'square,wide', page_size: '20', mature: 'false'
  });
  const body = await requestJson(`https://api.openverse.org/v1/images/?${params}`);
  return body && body.results.map(result => ({
    title: decodeURIComponent(result.title ?? '').replace(/\+/g, ' '),
    tags: (result.tags ?? []).map(tag => tag.name),
    url: result.url,
    license: result.license,
    licenseUrl: result.license_url,
    creator: result.creator ?? 'Unknown',
    source: result.foreign_landing_url
  }));
}

async function searchCommons(query) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrsearch: `${query} filetype:bitmap`,
    gsrlimit: '20', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: String(PHOTO_WIDTH)
  });
  const body = await requestJson(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!body) return null;
  return Object.values(body.query?.pages ?? {}).flatMap(page => {
    const info = page.imageinfo?.[0];
    if (!info) return [];
    const meta = info.extmetadata;
    return [{
      title: page.title.replace(/^File:/, '').replace(/\.\w+$/, ''),
      tags: stripTags(meta?.Categories?.value).split('|'),
      url: info.thumburl ?? info.url,
      license: commonsLicense(meta),
      licenseUrl: meta?.LicenseUrl?.value ?? '',
      creator: stripTags(meta?.Artist?.value) || 'Unknown',
      source: info.descriptionurl
    }];
  });
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// Write then rename, so stopping halfway can't leave half a file.
async function writeJson(file, value) {
  await writeFile(`${file}.tmp`, `${JSON.stringify(value, null, 1)}\n`);
  await rename(`${file}.tmp`, file);
}

async function cachedSearch(cache, source, query, search) {
  cache[source] ??= {};
  if (cache[source][query]) return cache[source][query];
  await sleep(SEARCH_GAP_MS);
  const results = await search(query);
  if (!results) return [];
  cache[source][query] = results;
  await writeJson(CACHE_FILE, cache);
  return results;
}

// A photo has to name the thing itself. A review showed that anything looser lets in
// horses for "rgb gaming mouse", and an SVG is better than a wrong photo.
const ranked = (results, query, rejected) => results
  .filter(photo => isUsable(photo, query) && !rejected.has(photo.url))
  .map(photo => ({ photo, score: matchScore(photo, query) }))
  .filter(({ score }) => score >= HEAD_WORD_SCORE)
  .sort((a, b) => b.score - a.score)
  .map(entry => entry.photo);

async function candidatesFor(cache, query, rejected) {
  const openverse = ranked(await cachedSearch(cache, 'openverse', query, searchOpenverse), query, rejected);
  if (openverse.length) return openverse;
  const commons = ranked(await cachedSearch(cache, 'commons', query, searchCommons), query, rejected);
  return ranked([...openverse, ...commons], query, rejected);
}

async function savePhoto(url, sku) {
  await sleep(DOWNLOAD_GAP_MS);
  const response = await request(url, { attempts: DOWNLOAD_ATTEMPTS, timeout: DOWNLOAD_TIMEOUT_MS });
  if (!response) return false;
  try {
    const image = sharp(Buffer.from(await response.arrayBuffer()));
    const { width } = await image.metadata();
    if (width < SMALLEST_WIDTH) return false;
    await image.rotate()
      .resize({ width: PHOTO_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(fileURLToPath(new URL(`${sku}-1.jpg`, OUTPUT_DIR)));
    return true;
  } catch {
    return false;
  }
}

async function dropPhoto(chosen, sku) {
  delete chosen[sku];
  await rm(new URL(`${sku}-1.jpg`, OUTPUT_DIR), { force: true });
}

function creditsPage(chosen) {
  const rows = Object.entries(chosen).sort(([a], [b]) => a.localeCompare(b)).map(([sku, photo]) =>
    `| ${sku} | ${photo.title.replace(/\|/g, '/')} | ${photo.creator.replace(/\|/g, '/')} | ${photo.license} | ${photo.source} |`);
  return ['# Photo credits', '', 'Product photos are openly licensed work by the people below. Each was resized to 800 px wide.',
    'Products show them for illustration: the brands in this store are invented.', '',
    '| SKU | Title | Author | Licence | Source |', '| --- | --- | --- | --- | --- |', ...rows, ''].join('\n');
}

async function main() {
  const products = JSON.parse(await readFile(new URL('products.json', DATA), 'utf8'));
  const choices = JSON.parse(await readFile(new URL('photo-choices.json', DATA), 'utf8'));
  const rejected = new Set(choices.reject);
  const cache = await readJson(CACHE_FILE, {});
  const chosen = await readJson(CHOSEN_FILE, {});

  for (const sku of Object.keys(chosen)) {
    const isStale = rejected.has(chosen[sku].url) || choices.keepSvg.includes(sku)
      || (choices.queries[sku] && choices.queries[sku] !== chosen[sku].query);
    if (isStale) await dropPhoto(chosen, sku);
  }
  const used = new Set(Object.values(chosen).map(photo => photo.url));

  for (const [index, { productId: sku, imageQuery }] of products.entries()) {
    const isDone = chosen[sku] && existsSync(new URL(`${sku}-1.jpg`, OUTPUT_DIR));
    if (isDone || choices.keepSvg.includes(sku)) continue;
    const query = choices.queries[sku] ?? imageQuery;
    const candidates = (await candidatesFor(cache, query, rejected)).filter(photo => !used.has(photo.url));

    let picked = null;
    for (const photo of candidates) {
      if (await savePhoto(photo.url, sku)) {
        picked = photo;
        break;
      }
    }
    console.log(`${index + 1}/${products.length} ${sku} "${query}": ${picked ? picked.title.slice(0, 60) : 'no photo, keeping the SVG'}`);
    if (!picked) continue;
    used.add(picked.url);
    const { tags, ...credit } = picked;
    chosen[sku] = { ...credit, query };
    await writeJson(CHOSEN_FILE, chosen);
  }

  await writeJson(CHOSEN_FILE, chosen);
  await writeFile(CREDITS_FILE, creditsPage(chosen));
  const photoCount = Object.keys(chosen).length;
  console.log(`Real photos: ${photoCount}. Kept the SVG: ${products.length - photoCount}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
