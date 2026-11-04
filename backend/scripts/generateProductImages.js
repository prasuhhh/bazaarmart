// Draws the three gallery images for every catalogue product into public/products:
//   <sku>.svg          the main icon, tinted with the zone's accent
//   <sku>-colours.svg  the same icon once per colour the product comes in
//   <sku>-scale.svg    the product at size: on a desk, on a wrist or next to a person
// Run with `npm run images` after changing data/catalogue.js, then commit the output.
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { products } from '../data/catalogue.js';

export const OUTPUT_DIR = new URL('../public/products/', import.meta.url);

const SIZE = 600;
const CREAM = '#E7E3DC';
const INK = '#1F1D1A';
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

const ZONE_TINTS = {
  A: '#F4A583', W: '#8FC1B5', D: '#E8C468', L: '#A9C48A', S: '#E58F8F',
  G: '#9A9CDD', C: '#C6A27C', P: '#8FB4DC', B: '#D8B4E2'
};
const FALLBACK_TINT = '#CFC9BE';

const COLOUR_TINTS = {
  Black: '#4A4845', Graphite: '#7C7B78', Sand: '#D9C7A3', Olive: '#8C9160',
  Terracotta: '#C7704C', Coral: '#F0806C', Teal: '#3F9C97'
};

// Each icon sits in a 100 x 100 box. T is replaced with the tint.
const keycap = (x, y) => `<rect fill="T" x="${x}" y="${y}" width="34" height="34" rx="5"/><rect x="${x + 7}" y="${y + 5}" width="20" height="20" rx="3"/>`;
const HEADPHONES = '<path d="M17 60v-9a33 33 0 0 1 66 0v9"/><rect fill="T" x="9" y="56" width="17" height="32" rx="7"/><rect fill="T" x="74" y="56" width="17" height="32" rx="7"/>';

const ICONS = {
  box: '<rect fill="T" x="14" y="26" width="72" height="62" rx="3"/><path d="M14 42h72M40 26v16M60 26v16"/><path d="M50 12v-1M42 58c0-12 16-12 16-2 0 7-8 6-8 13M50 77v1"/>',
  earbuds: '<g id="bud"><rect fill="T" x="14" y="38" width="13" height="46" rx="6"/><circle fill="T" cx="29" cy="32" r="16"/><circle cx="31" cy="32" r="6"/></g><use href="#bud" transform="matrix(-1 0 0 1 100 0)"/>',
  earphones: '<circle fill="T" cx="26" cy="20" r="11"/><circle fill="T" cx="74" cy="20" r="11"/><path d="M28 31c2 18 20 24 22 36M72 31c-2 18-20 24-22 36M50 67v14"/><rect fill="T" x="45" y="81" width="10" height="14" rx="2"/>',
  headphones: HEADPHONES,
  speaker: '<rect fill="T" x="24" y="8" width="52" height="84" rx="9"/><circle cx="50" cy="60" r="18"/><circle cx="50" cy="60" r="6"/><circle cx="50" cy="26" r="7"/>',
  soundbar: '<rect fill="T" x="5" y="38" width="90" height="24" rx="7"/><circle cx="20" cy="50" r="5"/><circle cx="40" cy="50" r="5"/><circle cx="60" cy="50" r="5"/><circle cx="80" cy="50" r="5"/><path d="M20 62v7M80 62v7"/>',
  smartwatch: '<rect fill="T" x="35" y="4" width="30" height="92" rx="6"/><rect fill="#FFFDF8" x="27" y="26" width="46" height="48" rx="11"/><path d="M73 44v12M50 37v13l9 6"/>',
  strap: '<rect fill="T" x="37" y="5" width="26" height="90" rx="11"/><rect x="30" y="15" width="40" height="15" rx="3"/><path d="M50 15v15"/><circle cx="50" cy="48" r="2"/><circle cx="50" cy="60" r="2"/><circle cx="50" cy="72" r="2"/><circle cx="50" cy="84" r="2"/>',
  band: '<rect fill="T" x="40" y="4" width="20" height="92" rx="9"/><rect fill="#FFFDF8" x="37" y="26" width="26" height="48" rx="11"/><path d="M43 50h4l3-7 3 13 3-6h2"/>',
  mouse: '<rect fill="T" x="27" y="8" width="46" height="84" rx="23"/><path d="M27 42h46M50 8v34"/><rect fill="#FFFDF8" x="46" y="18" width="8" height="14" rx="4"/>',
  keyboard: '<rect fill="T" x="4" y="26" width="92" height="48" rx="6"/><path stroke-dasharray="6 6" d="M13 38h76M13 49h76"/><path d="M30 62h40"/>',
  lamp: '<path d="M28 91h44M50 91 34 58l26-30"/><path fill="T" d="m56 10 36 22-16 17-36-22z"/><path stroke-dasharray="3 6" d="m58 54-6 12M72 60l-4 14"/>',
  lightbar: '<rect x="11" y="34" width="78" height="44" rx="3"/><rect fill="T" x="16" y="20" width="68" height="11" rx="5"/><path d="M50 78v13M34 91h32"/><path stroke-dasharray="3 6" d="M30 39v14M50 39v14M70 39v14"/>',
  cliplamp: '<path d="M46 76C46 54 26 44 40 28"/><path fill="T" d="M24 28 56 9l19 29z"/><path d="M26 76h40v16h-8V84H34v8h-8z"/><path stroke-dasharray="3 6" d="m56 44 6 12"/>',
  stand: '<path fill="T" d="m8 34 72-20 4 9-72 20z"/><path d="m64 22-14 58H38M76 21l10 59h8M4 90h92"/>',
  mat: '<path fill="T" d="M20 26h60l15 48H5z"/><path stroke-dasharray="5 5" d="M26 33h48l10 34H16z"/>',
  mousepad: '<path fill="T" d="M20 26h60l15 48H5z"/><ellipse fill="#FFFDF8" cx="62" cy="50" rx="10" ry="15"/><path d="M62 35v12"/>',
  riser: '<rect x="28" y="6" width="44" height="26" rx="2"/><path d="M50 32v8"/><rect fill="T" x="7" y="40" width="86" height="13" rx="2"/><rect fill="T" x="15" y="53" width="11" height="30"/><rect fill="T" x="74" y="53" width="11" height="30"/>',
  plug: '<rect fill="T" x="24" y="24" width="52" height="60" rx="11"/><path d="M41 24V8M59 24V8"/><circle cx="40" cy="50" r="4"/><circle cx="60" cy="50" r="4"/><circle cx="50" cy="70" r="2"/>',
  bulb: '<path fill="T" d="M50 7a31 31 0 0 1 18 56c-4 3-6 7-6 12H38c0-5-2-9-6-12A31 31 0 0 1 50 7z"/><path d="M40 83h20M44 92h12M41 44l9 9 9-9M50 53v22"/>',
  camera: '<circle fill="T" cx="50" cy="40" r="30"/><circle fill="#FFFDF8" cx="50" cy="40" r="13"/><circle cx="50" cy="40" r="4"/><path d="M50 70v14M30 90h40M38 84h24"/>',
  planter: '<path fill="T" d="M29 56h42l-6 37H35z"/><rect fill="T" x="24" y="47" width="52" height="10"/><path d="M50 47V34"/><path d="M50 34C36 34 28 24 26 10c14 0 24 10 24 24zM50 34c14 0 22-10 24-24-14 0-24 10-24 24z"/>',
  cushion: '<path fill="T" d="M12 12q38 12 76 0-11 38 0 76-38-12-76 0 11-38 0-76z"/><circle cx="50" cy="50" r="4"/><path stroke-dasharray="4 5" d="M26 26q24 7 48 0-7 24 0 48-24-7-48 0 7-24 0-48z"/>',
  rug: '<rect fill="T" x="17" y="10" width="66" height="80"/><rect x="27" y="21" width="46" height="58"/><path d="m50 32 14 18-14 18-14-18z"/><path stroke-dasharray="1 7" d="M21 5h60M21 95h60"/>',
  coffee: '<path fill="T" d="M26 12h46L58 42H40z"/><path d="M22 12h54M74 18h7a7 7 0 0 1 0 14H66M36 46h26"/><path fill="T" d="M40 46h18l12 40a5 5 0 0 1-5 6H33a5 5 0 0 1-5-6z"/><path d="M33 72h32"/>',
  mug: '<rect fill="T" x="18" y="28" width="52" height="62" rx="7"/><path d="M70 42h8a11 11 0 0 1 0 30h-8M34 18c-4-4 4-7 0-11M54 18c-4-4 4-7 0-11"/>',
  scale: '<path d="M14 42h72l-6 16H20z"/><path d="M50 58v6"/><rect fill="T" x="10" y="64" width="80" height="26" rx="5"/><rect fill="#FFFDF8" x="33" y="70" width="34" height="13" rx="2"/>',
  tshirt: '<path fill="T" d="M34 12 9 28l10 19 12-6v49h38V41l12 6 10-19-25-16c-4 11-28 11-32 0z"/><path d="M34 12c4 8 28 8 32 0"/>',
  shirt: '<path fill="T" d="M35 11 15 22 7 78h14l9-34v48h40V44l9 34h14l-8-56-20-11-15 11z"/><path d="m35 11 15 11 15-11M50 22v70"/><circle cx="56" cy="36" r="1.5"/><circle cx="56" cy="52" r="1.5"/><circle cx="56" cy="68" r="1.5"/>',
  sunglasses: '<circle fill="T" cx="29" cy="52" r="19"/><circle fill="T" cx="71" cy="52" r="19"/><path d="M48 47q2-4 4 0M11 45 3 34M89 45l8-11"/>',
  glasses: '<rect x="7" y="36" width="39" height="30" rx="8"/><rect x="54" y="36" width="39" height="30" rx="8"/><path fill="T" d="M7 36h39v8H7zM54 36h39v8H54z"/><path d="M46 44q4-4 8 0M7 42 2 34M93 42l5-8"/>',
  controller: '<path fill="T" d="M28 26h44c13 0 21 16 23 38 1 13-11 17-17 9l-9-12H31l-9 12c-6 8-18 4-17-9 2-22 10-38 23-38z"/><path d="M30 37v14M23 44h14"/><circle cx="64" cy="49" r="3"/><circle cx="74" cy="40" r="3"/>',
  grip: '<rect fill="#FFFDF8" x="23" y="30" width="54" height="30" rx="3"/><path fill="T" d="M23 32c-12 0-18 16-18 30 0 11 11 13 15 5l3-7zM77 32c12 0 18 16 18 30 0 11-11 13-15 5l-3-7z"/><path d="M33 40v10M72 42v1"/>',
  headset: `${HEADPHONES}<path d="M17 80c1 10 12 13 24 12"/><circle fill="T" cx="45" cy="91" r="5"/>`,
  dock: '<rect fill="T" x="8" y="60" width="84" height="26" rx="6"/><rect fill="#FFFDF8" x="16" y="24" width="30" height="36" rx="9"/><rect fill="#FFFDF8" x="54" y="24" width="30" height="36" rx="9"/><circle cx="31" cy="73" r="3"/><circle cx="69" cy="73" r="3"/>',
  keycaps: keycap(12, 12) + keycap(54, 12) + keycap(12, 54) + keycap(54, 54),
  backpack: '<path fill="T" d="M25 36a25 25 0 0 1 50 0v49a6 6 0 0 1-6 6H31a6 6 0 0 1-6-6z"/><path d="M40 12a10 8 0 0 1 20 0M25 46h50"/><rect x="34" y="56" width="32" height="24" rx="3"/>',
  duffel: '<rect fill="T" x="6" y="38" width="88" height="46" rx="15"/><path d="M31 38c0-26 38-26 38 0M20 50h60"/><path d="M26 84V38M74 84V38"/>',
  sleeve: '<rect fill="T" x="8" y="20" width="84" height="60" rx="7"/><path stroke-dasharray="4 4" d="M8 34h84"/><path d="M76 34v11"/>',
  bottle: '<rect fill="T" x="29" y="30" width="42" height="62" rx="11"/><rect x="38" y="16" width="24" height="14"/><path d="M42 16V8h16v8M29 50h42"/>',
  notebook: '<rect fill="T" x="20" y="7" width="60" height="86" rx="4"/><path d="M32 7v86M70 7v86"/><path stroke-dasharray="0 7" d="M40 26h24M40 40h24M40 54h24M40 68h24"/>',
  pouch: '<rect fill="T" x="10" y="28" width="80" height="52" rx="11"/><path d="M10 44h80M72 44v13"/><path d="M10 54H4v12"/>',
  cube: '<path fill="T" d="m50 8 40 21v43L50 93 10 72V29z"/><path d="m10 29 40 21 40-21M50 50v43"/><path stroke-dasharray="4 4" d="m30 18 40 21"/>',
  charger: '<rect fill="T" x="26" y="28" width="48" height="58" rx="9"/><path d="M40 28V11M60 28V11M54 37l-9 14h11l-9 14"/><rect x="39" y="72" width="22" height="6" rx="3"/>',
  hub: '<rect fill="T" x="16" y="34" width="72" height="32" rx="9"/><path d="M16 50H3"/><rect x="28" y="45" width="10" height="10" rx="1"/><rect x="44" y="45" width="10" height="10" rx="1"/><rect x="60" y="45" width="16" height="10" rx="1"/>',
  cable: '<path d="M24 20h34a16 16 0 0 1 0 32H42a16 16 0 0 0 0 32h34"/><rect fill="T" x="7" y="13" width="17" height="14" rx="3"/><rect fill="T" x="76" y="77" width="17" height="14" rx="3"/>',
  phonecase: '<rect fill="T" x="25" y="5" width="50" height="90" rx="11"/><rect fill="#FFFDF8" x="33" y="13" width="18" height="24" rx="6"/><circle cx="42" cy="20" r="3"/><circle cx="42" cy="30" r="3"/>',
  folio: '<rect fill="T" x="7" y="10" width="43" height="80" rx="5"/><rect fill="T" x="50" y="10" width="43" height="80" rx="5"/><rect fill="#FFFDF8" x="57" y="18" width="29" height="64" rx="5"/><path d="M15 32h27M15 45h27M15 58h27"/>',
  powerbank: '<rect fill="T" x="23" y="10" width="54" height="80" rx="9"/><path d="M55 24 43 44h14L45 64"/><path stroke-dasharray="0 8" d="M38 78h26"/>',
  trimmer: '<rect fill="T" x="33" y="30" width="34" height="63" rx="13"/><rect x="29" y="14" width="42" height="16" rx="2"/><path d="M35 14V6M45 14V6M55 14V6M65 14V6"/><circle cx="50" cy="52" r="6"/>',
  toothbrush: '<rect fill="T" x="43" y="36" width="14" height="58" rx="7"/><path d="M47 36V30h6v6"/><rect fill="T" x="40" y="6" width="20" height="26" rx="8"/><path stroke-dasharray="2 4" d="M46 12v14M54 12v14"/><path d="M50 54v1M30 14q-5 8 0 16M70 14q5 8 0 16"/>',
  shaver: '<rect fill="T" x="30" y="40" width="40" height="53" rx="14"/><rect fill="T" x="22" y="8" width="56" height="32" rx="11"/><circle fill="#FFFDF8" cx="38" cy="24" r="8"/><circle fill="#FFFDF8" cx="62" cy="24" r="8"/><circle cx="50" cy="60" r="5"/>',
  tube: '<path fill="T" d="M25 9h50L63 74H37z"/><rect x="38" y="74" width="24" height="17" rx="3"/><circle cx="50" cy="37" r="8"/><path d="M50 22v3M50 49v3M35 37h3M62 37h3"/>',
  pump: '<rect fill="T" x="29" y="38" width="42" height="55" rx="9"/><path d="M50 38V26M38 26h24v-9H44l-15 5"/><rect fill="#FFFDF8" x="38" y="54" width="24" height="24" rx="2"/>',
  serum: '<rect fill="T" x="33" y="46" width="34" height="47" rx="7"/><rect x="40" y="34" width="20" height="12"/><rect fill="#FFFDF8" x="44" y="8" width="12" height="26" rx="6"/><path d="M33 60h34M33 78h34"/>'
};

// A bay of one kind of product names its icon. A mixed bay lists a rule per product.
const BAY_ICONS = {
  Earbuds: [[/earphones/i, 'earphones'], [/buds/i, 'earbuds']],
  Headphones: 'headphones',
  Speakers: [[/soundbar/i, 'soundbar'], [/speaker/i, 'speaker']],
  Smartwatches: 'smartwatch',
  'Straps and bands': 'strap',
  'Fitness bands': 'band',
  'Keyboards and mice': [[/mouse/i, 'mouse'], [/keyboard/i, 'keyboard']],
  'Lamps and lighting': [[/desk lamp/i, 'lamp'], [/light bar/i, 'lightbar'], [/clip/i, 'cliplamp']],
  'Stands and organisers': [[/stand/i, 'stand'], [/mat/i, 'mat'], [/riser/i, 'riser']],
  'Smart home': [[/plug/i, 'plug'], [/bulb/i, 'bulb'], [/camera/i, 'camera']],
  Decor: [[/planter/i, 'planter'], [/cushion/i, 'cushion'], [/rug/i, 'rug']],
  Kitchen: [[/coffee/i, 'coffee'], [/mug/i, 'mug'], [/scale/i, 'scale']],
  'T-shirts': 'tshirt',
  Eyewear: [[/sunglasses/i, 'sunglasses'], [/glasses/i, 'glasses']],
  Shirts: 'shirt',
  Controllers: [[/grip/i, 'grip'], [/controller/i, 'controller']],
  Headsets: 'headset',
  Accessories: [[/mouse pad/i, 'mousepad'], [/dock/i, 'dock'], [/keycap/i, 'keycaps']],
  Backpacks: [[/duffel/i, 'duffel'], [/backpack/i, 'backpack']],
  'Sleeves and bottles': [[/sleeve/i, 'sleeve'], [/bottle/i, 'bottle'], [/notebook/i, 'notebook']],
  'Travel pouches': [[/pouch/i, 'pouch'], [/cube/i, 'cube']],
  'Chargers and hubs': [[/charger/i, 'charger'], [/hub/i, 'hub'], [/cable/i, 'cable']],
  Cases: [[/folio/i, 'folio'], [/case/i, 'phonecase']],
  'Power banks': 'powerbank',
  Grooming: [[/trimmer/i, 'trimmer'], [/toothbrush/i, 'toothbrush'], [/shaver/i, 'shaver']],
  Skincare: [[/sunscreen/i, 'tube'], [/wash/i, 'pump'], [/serum/i, 'serum']]
};

export const FALLBACK_ICON = 'box';

export function iconFor({ bayName, productName }) {
  const rule = BAY_ICONS[bayName];
  if (typeof rule === 'string') return rule;
  return rule?.find(([pattern]) => pattern.test(productName))?.[1] ?? FALLBACK_ICON;
}

// How big each product is drawn in its scale image. Everything else is medium.
const SMALL = new Set(['earbuds', 'earphones', 'mouse', 'plug', 'bulb', 'mug', 'sunglasses', 'glasses',
  'keycaps', 'charger', 'cable', 'phonecase', 'folio', 'powerbank', 'trimmer', 'toothbrush', 'shaver',
  'tube', 'pump', 'serum', 'bottle', 'notebook', 'pouch', 'grip', 'scale']);
const LARGE = new Set(['soundbar', 'keyboard', 'stand', 'mat', 'mousepad', 'riser', 'rug', 'cushion',
  'tshirt', 'shirt', 'backpack', 'duffel']);
const sizeOf = icon => (SMALL.has(icon) ? 1.1 : LARGE.has(icon) ? 2.4 : 1.7);

const escapeXml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function drawIcon(icon, tint, x, y, scale, idSuffix = '') {
  const art = ICONS[icon].replaceAll('fill="T"', `fill="${tint}"`)
    .replaceAll('id="bud"', `id="bud${idSuffix}"`).replaceAll('href="#bud"', `href="#bud${idSuffix}"`);
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${art}</g>`;
}

const label = (text, x, y, size, anchor = 'middle') =>
  `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${size}" text-anchor="${anchor}" fill="${INK}">${escapeXml(text)}</text>`;

function frame({ product, icon, accent, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" data-icon="${icon}">
<title>${escapeXml(product.productName)}</title>
<rect width="${SIZE}" height="${SIZE}" fill="${CREAM}"/>
<rect x="3" y="3" width="${SIZE - 6}" height="18" fill="${accent}"/>
${body}
<path d="M40 500h520" stroke="${INK}" stroke-width="2" stroke-dasharray="8 8" fill="none"/>
${label(product.productId, SIZE / 2, 556, 36)}
<rect x="3" y="3" width="${SIZE - 6}" height="${SIZE - 6}" fill="none" stroke="${INK}" stroke-width="2" vector-effect="non-scaling-stroke"/>
</svg>
`;
}

function mainImage(product, icon, accent) {
  return frame({ product, icon, accent, body: drawIcon(icon, accent, 120, 80, 3.6) });
}

function coloursImage(product, icon, accent) {
  const colours = product.colours?.length ? product.colours : ['Default'];
  const cell = (SIZE - 60) / colours.length;
  const iconSize = Math.min(cell - 30, 300);
  const body = colours.map((colour, index) => {
    const x = 30 + index * cell + (cell - iconSize) / 2;
    const middle = x + iconSize / 2;
    return drawIcon(icon, COLOUR_TINTS[colour] ?? accent, x, 250 - iconSize / 2, iconSize / 100, index)
      + label(colour, middle, 450, 26);
  }).join('\n');
  return frame({ product, icon, accent, body });
}

function deskScene(icon, accent, scale) {
  const itemSize = 100 * scale;
  return `<path d="M70 300h460l50 170H20z" fill="${accent}" fill-opacity="0.35" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
<g fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><rect x="56" y="196" width="150" height="104" rx="6" fill="${CREAM}"/><path d="M36 322h190l-18-22H54z" fill="${CREAM}"/></g>
${drawIcon(icon, accent, 390 - itemSize / 2, 440 - itemSize, scale)}
${label('ON DESK', 40, 74, 28, 'start')}`;
}

function wristScene(icon, accent) {
  return `<path d="M3 212h297M3 388h297M300 212c110-8 220 8 297 30M300 388c110 8 220-8 297-30" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
${drawIcon(icon, accent, 205, 205, 1.9)}
${label('ON WRIST', 40, 74, 28, 'start')}`;
}

function sizeScene(icon, accent, scale) {
  const itemSize = 100 * scale;
  return `<g fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="130" cy="130" r="38"/><path d="M78 300v-80a50 50 0 0 1 104 0v80M104 240v230M156 240v230M104 470h52"/><path d="M40 470h520"/></g>
${drawIcon(icon, accent, 385 - itemSize / 2, 462 - itemSize, scale)}
${label('TO SCALE', 560, 74, 28, 'end')}`;
}

const DESK_ZONES = new Set(['A', 'D', 'G', 'P']);

function scaleImage(product, icon, accent) {
  const scale = sizeOf(icon);
  const body = product.zoneCode === 'W' ? wristScene(icon, accent)
    : DESK_ZONES.has(product.zoneCode) ? deskScene(icon, accent, scale)
      : sizeScene(icon, accent, scale);
  return frame({ product, icon, accent, body });
}

export function renderImages(product) {
  const icon = iconFor(product);
  const accent = ZONE_TINTS[product.zoneCode] ?? FALLBACK_TINT;
  return {
    [`${product.productId}.svg`]: mainImage(product, icon, accent),
    [`${product.productId}-colours.svg`]: coloursImage(product, icon, accent),
    [`${product.productId}-scale.svg`]: scaleImage(product, icon, accent)
  };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const name of await readdir(OUTPUT_DIR)) {
    if (name.endsWith('.svg')) await rm(new URL(name, OUTPUT_DIR));
  }

  const files = Object.entries(Object.assign({}, ...products.map(renderImages)));
  await Promise.all(files.map(([name, svg]) => writeFile(new URL(name, OUTPUT_DIR), svg)));

  const fallbacks = products.filter(product => iconFor(product) === FALLBACK_ICON);
  console.log(`Wrote ${files.length} images for ${products.length} products.`);
  if (fallbacks.length) console.log(`Using the fallback icon: ${fallbacks.map(p => p.productId).join(', ')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
