// Step 2, sources c and d. Finds each product's page on its maker's own site through the
// sitemaps listed in robots.txt, then takes that page's own main image (og:image).
// Writes data/brand-pages.json for fetchImages.js. Rules: robots.txt is obeyed, one request a
// second per host, everything is cached, and a site that refuses is skipped, never worked around.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { matchesProduct, searchName } from './fetchImages.js';

const DATA = new URL('../../data/', import.meta.url);
const CACHE = new URL('cache/pages/', DATA);
const PRODUCTS = new URL('products-300.verified.json', DATA);
const OUTPUT = new URL('brand-pages.json', DATA);
const MANUAL_URLS = new URL('brand-urls.json', DATA); // { sku: page URL }, found by hand

const USER_AGENT = 'BazaarMartLabDataset/1.0 (student project)';
const GAP_MS = 1000;
const TIMEOUT_MS = 30000;
const SITEMAPS_PER_SITE = 25;
const REFUSALS_BEFORE_SKIPPING = 3;
const FILTER_SITEMAPS = /product|pdp|item|catalog|shop|store/i;
const INDIA_URL = /\/in\/|\/en-in\/|\/en_in\/|\/in-en\/|\.in\//i;
const LOGO_IMAGE = /logo|favicon|placeholder|default[-_]?(og|share|image)|og-default|global-og|sprite|\.svg/i;

// Official press rooms, read the same way. Their images are source c in the brief.
const PRESS_SITES = {
  Samsung: ['https://news.samsung.com'], Logitech: ['https://news.logitech.com'], 'Logitech G': ['https://news.logitech.com'], JBL: ['https://news.harman.com'],
  Adidas: ['https://news.adidas.com'], Puma: ['https://about.puma.com'], Nike: ['https://about.nike.com']
};

// Each maker's own site. Indian site first where one exists.
const SITES = {
  Apple: ['https://www.apple.com'], Samsung: ['https://www.samsung.com'], Logitech: ['https://www.logitech.com'], 'Logitech G': ['https://www.logitechg.com'],
  Sony: ['https://www.sony.co.in'], Philips: ['https://www.philips.co.in'], 'Philips Hue': ['https://www.philips-hue.com'], Razer: ['https://www.razer.com'],
  JBL: ['https://in.jbl.com'], Nike: ['https://www.nike.com'], Anker: ['https://www.anker.com', 'https://www.ankerindia.com'], Corsair: ['https://www.corsair.com'],
  Google: ['https://store.google.com'], Spigen: ['https://spigen.in', 'https://www.spigen.com'], Belkin: ['https://www.belkin.com'], "Levi's": ['https://levi.in'],
  OnePlus: ['https://www.oneplus.in'], boAt: ['https://www.boat-lifestyle.com'], Xiaomi: ['https://www.mi.com'], BenQ: ['https://www.benq.com'], Elgato: ['https://www.elgato.com'],
  SteelSeries: ['https://steelseries.com'], Uniqlo: ['https://www.uniqlo.com'], Adidas: ['https://www.adidas.co.in'], 'Ray-Ban': ['https://www.ray-ban.com'], Fitbit: ['https://store.google.com'],
  Nothing: ['https://in.nothing.tech', 'https://nothing.tech'], Bose: ['https://www.bose.com'], 'RØDE': ['https://rode.com'], Dyson: ['https://www.dyson.in'], 'Oral-B': ['https://www.oralb.co.in', 'https://oralb.com'],
  Omron: ['https://www.omronhealthcare.co.in'], 'Peak Design': ['https://www.peakdesign.com'], Bellroy: ['https://bellroy.com'], 'Tommy Hilfiger': ['https://www.tommy.com'], Keychron: ['https://www.keychron.com', 'https://www.keychron.in'],
  Dell: ['https://www.dell.com'], Nintendo: ['https://www.nintendo.com'], HyperX: ['https://hyperx.com'], LEGO: ['https://www.lego.com'], UGREEN: ['https://www.ugreen.com'], 'H&M': ['https://www2.hm.com'],
  Garmin: ['https://www.garmin.com'], Amazfit: ['https://www.amazfit.com', 'https://in.amazfit.com'], Sennheiser: ['https://www.sennheiser-hearing.com'], 'Audio-Technica': ['https://www.audio-technica.com'], Marshall: ['https://www.marshall.com'],
  Sonos: ['https://www.sonos.com'], FiiO: ['https://www.fiio.com'], AudioQuest: ['https://www.audioquest.com'], Shure: ['https://www.shure.com'], Blue: ['https://www.logitechg.com'], DJI: ['https://www.dji.com'], Zoom: ['https://zoomcorp.com'], BOYA: ['https://www.boya-mic.com'],
  CeraVe: ['https://www.cerave.in', 'https://www.cerave.com'], Cetaphil: ['https://www.cetaphil.in'], 'The Ordinary': ['https://theordinary.com'], Minimalist: ['https://beminimalist.co'], Neutrogena: ['https://www.neutrogena.in'], 'La Roche-Posay': ['https://www.laroche-posay.in'], NIVEA: ['https://www.nivea.in'],
  Olaplex: ['https://olaplex.com'], Moroccanoil: ['https://www.moroccanoil.com'], "L'Oréal Paris": ['https://www.lorealparis.co.in'], Mamaearth: ['https://mamaearth.in'], Braun: ['https://www.braun.in'], Gillette: ['https://www.gillette.co.in'], Panasonic: ['https://www.panasonic.com'],
  'Calvin Klein': ['https://www.calvinklein.in'], Dior: ['https://www.dior.com'], Chanel: ['https://www.chanel.com'], 'Jo Malone London': ['https://www.jomalone.in'], Versace: ['https://www.versace.com'], 'SKINN by Titan': ['https://www.skinn.in'], Waterpik: ['https://www.waterpik.com'], Therabody: ['https://www.therabody.com'],
  'Fjällräven': ['https://www.fjallraven.com'], Herschel: ['https://herschel.com'], 'The North Face': ['https://www.thenorthface.com'], Quechua: ['https://www.decathlon.in'], Forclaz: ['https://www.decathlon.in'], Osprey: ['https://www.osprey.com'], tomtoc: ['https://www.tomtoc.com'], Incase: ['https://www.incase.com'],
  Ridge: ['https://ridge.com'], Secrid: ['https://secrid.com'], Cabeau: ['https://cabeau.com'], Victorinox: ['https://www.victorinox.com'], Wildcraft: ['https://wildcraft.com'], Milton: ['https://www.milton.in'], 'Hydro Flask': ['https://www.hydroflask.com'], Stanley: ['https://www.stanley1913.com'], Owala: ['https://owalalife.com'],
  Nalgene: ['https://nalgene.com'], LifeStraw: ['https://lifestraw.com'], Contigo: ['https://www.gocontigo.com'], Ergotron: ['https://www.ergotron.com'], 'Rain Design': ['https://www.raindesigninc.com'], Insta360: ['https://www.insta360.com', 'https://insta360india.com'], Microsoft: ['https://www.microsoft.com'], '8BitDo': ['https://www.8bitdo.com'], Redragon: ['https://www.redragonzone.com'],
  'Green Soul': ['https://greensoul.online'], 'Cooler Master': ['https://www.coolermaster.com'], Wipro: ['https://www.wiproconsumerlighting.com'], Nanoleaf: ['https://nanoleaf.me'], 'TP-Link': ['https://www.tp-link.com'], 'Yankee Candle': ['https://www.yankeecandle.com'], 'Bath & Body Works': ['https://www.bathandbodyworks.in'], 'Instant Pot': ['https://instantbrands.com'],
  Nespresso: ['https://www.nespresso.com'], Prestige: ['https://shop.ttkprestige.com'], AeroPress: ['https://aeropress.com'], Bodum: ['https://www.bodum.com'], Wakefit: ['https://www.wakefit.co'], 'The Sleep Company': ['https://thesleepcompany.in'], ESR: ['https://www.esrgear.com'], Ambrane: ['https://ambraneindia.com'], Puma: ['https://in.puma.com'], Jockey: ['https://www.jockey.in'],
  'Allen Solly': ['https://allensolly.abfrl.in'], 'Polo Ralph Lauren': ['https://www.ralphlauren.global'], Dockers: ['https://www.dockers.in'], Converse: ['https://www.converse.in'], Vans: ['https://www.vans.co.in'], 'New Balance': ['https://www.newbalance.co.in'], Asics: ['https://www.asics.com'], Crocs: ['https://www.crocs.in'], Oakley: ['https://www.oakley.com'], 'New Era': ['https://www.neweracap.in'],
  Noise: ['https://www.gonoise.com'], Huawei: ['https://consumer.huawei.com'], Ultrahuman: ['https://www.ultrahuman.com'], Oura: ['https://ouraring.com'], Jio: ['https://www.jio.com'], IKEA: ['https://www.ikea.com'], Amazon: [], Solimo: [], Abanen: [], ZORBES: [], HomeMate: ['https://homemate.co.in'], 'Amazon Basics': [], Davidoff: ['https://www.zino-davidoff.com']
};

const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms); });
const decode = text => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
const cacheFile = url => new URL(createHash('sha1').update(url).digest('hex'), CACHE);

class Site {
  constructor(origin) {
    this.origin = origin;
    this.lastCall = 0;
    this.refusals = 0;
    this.disallowed = [];
    this.note = '';
  }

  get skipped() {
    return this.refusals >= REFUSALS_BEFORE_SKIPPING;
  }

  async get(url) {
    const file = cacheFile(url);
    if (existsSync(file)) return readFileSync(file, 'utf8');
    if (this.skipped) return null;
    const wait = this.lastCall + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastCall = Date.now();
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => null);
    if (!response?.ok) {
      if (!response || [401, 403, 429, 503].includes(response.status)) this.refusals += 1;
      this.note = response ? `HTTP ${response.status}` : 'no response';
      return null;
    }
    this.refusals = 0;
    const raw = Buffer.from(await response.arrayBuffer());
    const text = (url.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8');
    writeFileSync(file, text);
    return text;
  }

  allowed(url) {
    const { pathname, search } = new URL(url);
    const path = pathname + search;
    return !this.disallowed.some(rule => rule.test(path));
  }

  // Reads the "User-agent: *" group. A plain robots rule is a path prefix, * is a wildcard.
  async readRobots() {
    const text = await this.get(`${this.origin}/robots.txt`);
    if (text === null) return [];
    const sitemaps = [];
    let inStarGroup = false;
    for (const raw of text.split('\n')) {
      const [field, ...rest] = raw.split('#')[0].split(':');
      const value = rest.join(':').trim();
      const key = field.trim().toLowerCase();
      if (key === 'sitemap') sitemaps.push(value);
      if (key === 'user-agent') inStarGroup = value === '*';
      if (key === 'disallow' && inStarGroup && value) {
        const pattern = value.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        this.disallowed.push(new RegExp(`^${pattern}`));
      }
    }
    return sitemaps;
  }

  async productUrls() {
    const listed = (await this.readRobots()).filter(url => URL.canParse(url));
    // Global sites list a sitemap per country, so India's has to go first or the cap is spent.
    const india = listed.filter(url => /\/in\/|en[-_]in/i.test(url));
    const queue = india.length ? india : listed;
    if (!queue.length) queue.push(`${this.origin}/sitemap.xml`);
    const urls = new Set();
    let read = 0;
    while (queue.length && read < SITEMAPS_PER_SITE && !this.skipped) {
      const sitemap = queue.shift();
      read += 1;
      const text = await this.get(sitemap);
      if (!text) continue;
      const locs = [...text.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/loc>/g)].map(match => decode(match[1]));
      if (/<sitemapindex/i.test(text)) {
        const products = locs.filter(loc => FILTER_SITEMAPS.test(loc));
        const india = (products.length ? products : locs).filter(loc => INDIA_URL.test(loc));
        queue.push(...(india.length ? india : products.length ? products : locs).filter(url => URL.canParse(url)));
      } else for (const loc of locs) if (URL.canParse(loc)) urls.add(loc);
    }
    return [...urls];
  }

  async imageOf(url) {
    if (!this.allowed(url)) return null;
    const html = await this.get(url);
    if (!html) return null;
    const meta = name => decode(
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1]
      ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, 'i'))?.[1] ?? '');
    const title = meta('og:title') || decode(html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? '');
    const image = [meta('og:image'), meta('twitter:image'), productDataImage(html), galleryImage(html, title)].find(found => found && !LOGO_IMAGE.test(found));
    return image ? { image: new URL(image, url).href, title } : null;
  }
}

// Sites like Samsung's put a logo in og:image and the real photo in their schema.org product data.
function productDataImage(html) {
  for (const [, block] of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try { data = JSON.parse(block); } catch { continue; }
    for (const item of [data, ...(data['@graph'] ?? [])].flat()) {
      if (![item?.['@type']].flat().includes('Product')) continue;
      const image = [item.image].flat()[0];
      const url = typeof image === 'string' ? image : image?.url;
      if (url) return decode(url);
    }
  }
  return '';
}

// Last resort: the first page image whose address or alt text names the product.
function galleryImage(html, title) {
  const wanted = title.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 3 && /\d/.test(word) || word.length > 6).slice(0, 4);
  for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
    const source = /(?:data-src|data-original|src)=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/i.exec(tag)?.[1];
    if (!source || LOGO_IMAGE.test(source) || /icon|badge|payment|flag|banner|promo|gnb|menu|tile/i.test(source)) continue;
    const text = `${source} ${/alt=["']([^"']*)/i.exec(tag)?.[1] ?? ''}`.toLowerCase();
    if (wanted.some(word => text.includes(word))) return decode(source);
  }
  return '';
}

const brandRecord = (product, url, page, source) => ({
  source, title: page.title, sourcePage: url, originalUrl: page.image, width: null, height: null,
  licence: `© ${product.brand} - press/product image, used for a non-commercial student lab demo`,
  author: product.brand, attribution: `Image © ${product.brand}, from ${new URL(url).host}`
});

// Sitemaps can hold URLs that won't decode. Those stay as they are and simply don't match a product.
function slugOf(url) {
  let path = url;
  try {
    path = decodeURIComponent(new URL(url).pathname);
  } catch {
    // Keep the raw URL.
  }
  return path.replace(/[/_.-]+/g, ' ');
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const products = JSON.parse(readFileSync(PRODUCTS, 'utf8'));
  const found = existsSync(OUTPUT) ? JSON.parse(readFileSync(OUTPUT, 'utf8')) : {};
  const manual = existsSync(MANUAL_URLS) ? JSON.parse(readFileSync(MANUAL_URLS, 'utf8')) : {};
  const byOrigin = new Map();
  for (const product of products) {
    if (found[product.productId] || (process.env.ONLY && !process.env.ONLY.split(',').includes(product.brand))) continue;
    for (const origin of SITES[product.brand] ?? []) {
      if (!byOrigin.has(origin)) byOrigin.set(origin, []);
      byOrigin.get(origin).push(product);
    }
  }

  // Pages found by hand: same robots check, same image extraction, one site at a time per host.
  const byHost = new Map();
  for (const product of products) {
    const url = manual[product.productId];
    if (!url || found[product.productId]) continue;
    const { origin } = new URL(url);
    if (!byHost.has(origin)) byHost.set(origin, []);
    byHost.get(origin).push([product, url]);
  }
  await Promise.all([...byHost].map(async ([origin, pairs]) => {
    const site = new Site(origin);
    await site.readRobots();
    for (const [product, url] of pairs) {
      const allowed = site.allowed(url);
      const page = allowed ? await site.imageOf(url).catch(() => null) : null;
      console.log(`  ${product.productId} ${allowed ? (page ? 'hand url ok' : `hand url no image ${site.note}`) : 'ROBOTS'} ${url.slice(0, 70)}`);
      if (page) found[product.productId] = brandRecord(product, url, page, /newsroom|\/\/news\.|\/\/blog\./.test(url) ? 'brand-press' : 'brand-site');
    }
    writeFileSync(OUTPUT, `${JSON.stringify(found, null, 1)}\n`);
  }));

  for (const product of products) {
    if (found[product.productId]) continue;
    for (const origin of PRESS_SITES[product.brand] ?? []) {
      if (!byOrigin.has(origin)) byOrigin.set(origin, []);
      byOrigin.get(origin).push(product);
    }
  }
  const pressOrigins = new Set(Object.values(PRESS_SITES).flat());

  const outcomes = await Promise.all([...byOrigin].map(async ([origin, wanted]) => {
    const site = new Site(origin);
    const urls = await site.productUrls().catch(error => { site.note = error.message; return []; });
    let matched = 0;
    for (const product of wanted) {
      if (found[product.productId]) continue;
      const known = [manual[product.productId], product.priceNote?.url].filter(url => url?.startsWith(`${origin}/`));
      const pages = [...known, ...urls.filter(url => matchesProduct(`${product.brand} ${slugOf(url)}`, product))
        .sort((a, b) => Number(INDIA_URL.test(b)) - Number(INDIA_URL.test(a)) || a.length - b.length).slice(0, 3)];
      if (process.env.TRACE && !pages.length) console.log(`  ${product.productId} no matching url`);
      for (const url of pages) {
        const page = await site.imageOf(url).catch(() => null);
        if (process.env.TRACE) console.log(`  ${product.productId} ${site.allowed(url) ? 'allowed' : 'ROBOTS'} ${page ? `img "${page.title.slice(0, 40)}"` : `no image ${site.note}`} ${url.slice(0, 80)}`);
        if (!page || (!known.includes(url) && !matchesProduct(`${product.brand} ${page.title} ${slugOf(url)}`, product))) continue;
        found[product.productId] = brandRecord(product, url, page, pressOrigins.has(origin) ? 'brand-press' : 'brand-site');
        matched += 1;
        writeFileSync(OUTPUT, `${JSON.stringify(found, null, 1)}\n`);
        break;
      }
    }
    console.log(`${origin}: ${urls.length} urls, ${matched}/${wanted.length} matched${site.skipped ? ', SKIPPED' : ''}${site.note ? ` (${site.note})` : ''}`);
    return { origin, urls: urls.length, matched, skipped: site.skipped };
  }));

  writeFileSync(OUTPUT, `${JSON.stringify(found, null, 1)}\n`);
  console.log(`Brand pages for ${Object.keys(found).length} products. Sites refusing: ${outcomes.filter(o => o.skipped).length} of ${outcomes.length}.`);
}

if (process.argv[2] === '--page') {
  mkdirSync(CACHE, { recursive: true });
  const site = new Site(new URL(process.argv[3]).origin);
  await site.readRobots();
  console.log(site.allowed(process.argv[3]) ? await site.imageOf(process.argv[3]) : 'blocked by robots.txt');
} else if (process.argv[2] === '--urls') {
  mkdirSync(CACHE, { recursive: true });
  const urls = await new Site(process.argv[3]).productUrls();
  console.log(urls.length);
  for (const url of urls.filter(found => new RegExp(process.argv[4], 'i').test(found)).slice(0, 12)) console.log(url);
} else await main();
