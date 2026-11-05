// Compares the built app with the wireframe export, screen by screen. See the numbered
// checks at the bottom. Run from frontend/: npm run layout:check
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { RECEIPT, respond, USER } from './layout-fixtures.mjs';

const FRONTEND = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DOCS = path.join(FRONTEND, '..', 'docs');
const OUT = path.join(DOCS, 'layout-check');
const WIREFRAME = path.join(DOCS, 'wireframe', 'bazaar-mart-wireframe.html');
const PORT = 5198;
const WEB = `http://localhost:${PORT}`;
const API = 'http://localhost:5074/api';
const TOLERANCE = 2;
const DESIGN = { width: 1280, height: 908 };
const MACBOOKS = [[1440, 900], [1470, 956], [1512, 982], [1728, 1117]];
const TASKBAR_SHARE = 220 / 1280;
const MAIN_SHARE = 1008 / 1280;
const SHARE_TOLERANCE = 0.003;

// unwrap: how many app wrappers sit between <main> and the wireframe's first level.
// deep: wireframe selector → app selector, for sizes below the two levels walked.
const SCREENS = [
  { id: 'home', route: '/map', unwrap: 1, deep: [
    ['.grid-rows-5 > div', '.zone-tile'], ['.wf-solid.p-3 > div', '.peek-panel > div'], ['.mt-2.flex.gap-3 > .wf-box', '.conveyor > :nth-child(-n+9)'], ['.mt-5.grid .wf-img', '.kit-thumb']] },
  { id: 'browse', route: '/zone/A', unwrap: 1, stickyCard: true, deep: [['.grid-cols-6 > div', '.bay .product-card'], ['.grid-cols-6 .wf-img', '.bay .product-card .thumb']] },
  { id: 'product', route: '/p/A-01-117', unwrap: 1, deep: [['.space-y-2 > .wf-img', '.gallery-strip > button'], ['.h-\\[420px\\]', '.gallery-main .thumb'], ['table tr', '.spec-table > div'], ['.mt-3.flex.gap-2 > span', '.swatches > *'], ['.mt-4.flex.gap-2 > span', '.sheet-actions > *'], ['.mt-6 .wf-img', '.fits-with .thumb']] },
  { id: 'wishlist', route: '/saved', unwrap: 1, deep: [['.mt-3.flex', '.shelf-item'], ['.mt-3.flex .wf-img', '.shelf-item .thumb']] },
  { id: 'checkout', route: '/counter', unwrap: 0, before: closeOpenStep, deep: [['.space-y-4 > div:not(.wf-note)', '.counter-steps > *'], ['.rounded-full.bg-primary', '.step-number']] },
  { id: 'orders', route: '/orders', unwrap: 1, deep: [['.wf-solid .wf-img', '.order-thumbs .thumb'], ['.wf-solid > :nth-child(2)', '.order-card > :nth-child(1)'], ['.wf-solid > :nth-child(3)', '.order-card > :nth-child(2)'], ['.wf-solid > :nth-child(4)', '.order-card > :nth-child(3)'], ['.wf-solid > :nth-child(5)', '.order-card > :nth-child(4)'], ['.wf-solid > span', '.order-node']] },
  { id: 'track', route: '/track/BM-2041', unwrap: 0, deep: [['.h-\\[380px\\]', '.route-map'], ['.mt-4.grid > div', '.track-tiles > *'], ['ol > li', '.journey > li']] },
  { id: 'profile', route: '/profile', unwrap: 1, deep: [['.h-28', '.member-avatar'], ['.grid-cols-3 > :nth-child(-n+3) .mt-2.flex', '.profile-grid > :nth-child(-n+3) .panel-row']] },
  { id: 'login', route: '/signin', unwrap: 0, signedOut: true, deep: [['.wf-solid.mx-auto', '.signin-card'], ['.mt-3.flex.gap-2 > div', '.otp-boxes > input'], ['.h-11.px-3', '.phone-input'], ['.mt-4 > span', '.signin-card .primary']] }
];

const SHELL_REFS = { frame: '.wf-solid.min-h-\\[860px\\]', taskbar: 'aside', brand: 'aside > div:first-child', taskbarLabel: 'aside > div:nth-child(2)', nav: 'nav', liveCard: 'aside > div:last-child', topbar: 'header', title: 'header > span', goTo: 'header > div:nth-of-type(1)', right: 'header > div:last-child', dayShift: 'header button', avatar: 'header .h-8.w-8', main: 'main' };
const SHELL_APP = { frame: '.frame', taskbar: '.taskbar', brand: '.brand', taskbarLabel: '.taskbar-caption', nav: '.taskbar nav', liveCard: '.live-card', topbar: '.topbar', title: '.topbar-title', goTo: '.command', right: '.topbar-right', dayShift: '.shift-toggle', avatar: '.avatar-button', main: 'main' };

// Runs in the page. Measures from `root`, walking two levels and any listed deep selectors.
function measure({ root, unwrap, shell, deep, side }) {
  const box = element => { const { x, y, width, height } = element.getBoundingClientRect(); return { x, y, width, height }; };
  const scope = document.querySelector(root);
  const rects = {};
  for (const [name, selector] of Object.entries(shell)) {
    const element = (selector === 'aside' || name === 'frame' || name === 'main' ? scope.closest('.wf-page') ?? document : scope.closest('.wf-page') ?? document).querySelector(selector);
    if (element) rects[`shell.${name}`] = box(element);
  }
  const skip = element => element.matches('.wf-note, [data-no-ref], .modal, .backdrop, script, style');
  const kids = element => [...element.children].flatMap(child => {
    if (skip(child)) return [];
    return getComputedStyle(child).display === 'contents' ? kids(child) : [child];
  });
  let start = scope;
  for (let level = 0; level < unwrap; level += 1) [start] = kids(start);
  kids(start).forEach((child, first) => {
    rects[`main.${first}`] = box(child);
    kids(child).forEach((grandchild, second) => { rects[`main.${first}.${second}`] = box(grandchild); });
  });
  deep.forEach(pair => {
    const selector = pair[side];
    document.querySelector(root).querySelectorAll(selector).forEach((element, index) => {
      if (!element.closest('.wf-note')) rects[`deep ${pair[0]} #${index}`] = box(element);
    });
  });
  return rects;
}

async function closeOpenStep(page) {
  await page.waitForSelector('.step-head');
  const open = page.locator('.step-head[aria-expanded="true"]');
  if (await open.count()) await open.click();
}

const settle = page => page.evaluate(async () => { await document.fonts.ready; await new Promise(done => { requestAnimationFrame(() => requestAnimationFrame(done)); }); });

async function referencePage(browser) {
  const page = await browser.newPage({ viewport: DESIGN, deviceScaleFactor: 2 });
  await page.goto(`file://${WIREFRAME}`);
  await page.addStyleTag({ content: '.wf-exportbar{display:none!important} main{min-width:0}' });
  return page;
}

async function showReference(page, id) {
  await page.evaluate(shown => { document.querySelectorAll('.wf-page').forEach(section => { section.hidden = section.id !== `page-${shown}`; }); window.scrollTo(0, 0); }, id);
  await settle(page);
}

async function appContext(browser, options = {}) {
  const context = await browser.newContext({ viewport: DESIGN, deviceScaleFactor: 2, colorScheme: 'light', ...options });
  await context.route(url => url.href.startsWith(API.replace('/api', '')), route => {
    const request = route.request();
    const apiPath = request.url().slice(API.length);
    if (!request.url().startsWith(API)) return route.abort();
    const data = respond(request.method(), apiPath);
    if (data === null) return route.fulfill({ status: 404, json: { success: false, message: 'Not in the mock' } });
    return route.fulfill({ json: { success: true, data } });
  });
  return context;
}

async function openScreen(context, screen, viewport) {
  const page = await context.newPage();
  if (viewport) await page.setViewportSize(viewport);
  await page.addInitScript(({ signedOut, user, receipt }) => {
    localStorage.setItem('bazaarmart_theme', 'day');
    if (signedOut) { localStorage.removeItem('shopping_token'); localStorage.removeItem('shopping_user'); } else {
      localStorage.setItem('shopping_token', 'mock'); localStorage.setItem('shopping_user', JSON.stringify(user));
    }
    localStorage.setItem('bazaarmart_receipt_guest', JSON.stringify(receipt));
  }, { signedOut: Boolean(screen.signedOut), user: USER, receipt: RECEIPT });
  await page.goto(WEB + screen.route);
  await page.waitForFunction(() => document.querySelector('main')?.children.length && !document.querySelector('main .empty'));
  await page.waitForTimeout(350);
  if (screen.before) await screen.before(page);
  if (screen.id === 'home') { await page.hover('.conveyor'); await page.evaluate(() => { document.querySelector('.conveyor').scrollLeft = 0; }); }
  await settle(page);
  return page;
}

// Draws both shots at the wireframe's size in a canvas, then diffs them.
async function compareShots(browser, refFile, appFile, overlayFile) {
  const page = await browser.newPage();
  const data = file => `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  const [refData, appData, overlay] = await page.evaluate(async ({ ref, app }) => {
    const load = src => new Promise(done => { const image = new Image(); image.onload = () => done(image); image.src = src; });
    const [refImage, appImage] = await Promise.all([load(ref), load(app)]);
    const canvas = document.createElement('canvas');
    canvas.width = refImage.width;
    canvas.height = Math.min(refImage.height, Math.round(appImage.height * refImage.width / appImage.width));
    const scaledHeight = appImage.height * refImage.width / appImage.width;
    const draw = (image, height, alpha) => { const context = canvas.getContext('2d'); context.globalAlpha = alpha; context.imageSmoothingQuality = 'high'; context.drawImage(image, 0, 0, refImage.width, height); };
    draw(refImage, refImage.height, 1); const refOut = canvas.toDataURL();
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    draw(appImage, scaledHeight, 1); const appOut = canvas.toDataURL();
    draw(refImage, refImage.height, 0.5);
    return [refOut, appOut, canvas.toDataURL()];
  }, { ref: data(refFile), app: data(appFile) });
  await page.close();
  const png = text => PNG.sync.read(Buffer.from(text.split(',')[1], 'base64'));
  const [a, b] = [png(refData), png(appData)];
  const diff = new PNG({ width: a.width, height: a.height });
  const mismatched = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.2 });
  writeFileSync(overlayFile, Buffer.from(overlay.split(',')[1], 'base64'));
  writeFileSync(overlayFile.replace('.png', '.diff.png'), PNG.sync.write(diff));
  return (mismatched / (a.width * a.height)) * 100;
}

const results = [];
const check = (name, passed, detail = '') => { results.push({ name, passed, detail }); console.log(`${passed ? 'pass' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`); };

function compareRects(id, ref, app) {
  const rows = [];
  for (const [key, want] of Object.entries(ref)) {
    const got = app[key];
    const off = got ? Math.max(...['x', 'y', 'width', 'height'].map(side => Math.abs(want[side] - got[side]))) : Infinity;
    rows.push({ key, want, got, off });
  }
  const extra = Object.keys(app).filter(key => !(key in ref));
  const bad = rows.filter(row => row.off > TOLERANCE);
  const round = rect => (rect ? [rect.x, rect.y, rect.width, rect.height].map(value => Math.round(value * 10) / 10).join(' ') : 'missing');
  writeFileSync(path.join(OUT, 'rects', `${id}.txt`), [...rows.map(row => `${row.off > TOLERANCE ? 'FAIL' : 'ok  '} ${row.key}\n     ref ${round(row.want)}\n     app ${round(row.got)}`), ...extra.map(key => `extra ${key} ${round(app[key])}`)].join('\n'));
  console.log(`\n${id}: ${rows.length - bad.length}/${rows.length} rects within ${TOLERANCE}px${extra.length ? `, ${extra.length} extra in app` : ''}`);
  bad.slice(0, Number(process.env.SHOW ?? 12)).forEach(row => console.log(`   ${row.key}\n      ref ${round(row.want)}\n      app ${round(row.got)}`));
  extra.slice(0, 6).forEach(key => console.log(`   extra ${key} ${round(app[key])}`));
  return bad.length + extra.length;
}

function startVite() {
  const child = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: FRONTEND, env: { ...process.env, VITE_API_URL: API }, stdio: 'ignore', detached: true });
  return child;
}

const waitForWeb = async () => { for (let attempt = 0; attempt < 100; attempt += 1) { try { await fetch(WEB); return; } catch { await new Promise(done => { setTimeout(done, 200); }); } } throw new Error('Vite did not start'); };

const only = process.env.ONLY?.split(',');
const refOnly = process.argv.includes('--ref');
['ref', 'app', 'overlay', 'rects'].forEach(folder => mkdirSync(path.join(OUT, folder), { recursive: true }));
const vite = refOnly ? null : startVite();
const browser = await chromium.launch();
try {
  const reference = await referencePage(browser);
  const refRects = {};
  for (const screen of SCREENS) {
    await showReference(reference, screen.id);
    refRects[screen.id] = await reference.evaluate(measure, { root: `#page-${screen.id} main`, unwrap: 0, shell: SHELL_REFS, deep: screen.deep, side: 0 });
    await reference.screenshot({ path: path.join(OUT, 'ref', `${screen.id}.png`), fullPage: true });
  }
  writeFileSync(path.join(OUT, 'rects', 'reference.json'), JSON.stringify(refRects, null, 1));
  if (refOnly) process.exit(0);

  await waitForWeb();
  const context = await appContext(browser);
  for (const screen of SCREENS.filter(entry => !only || only.includes(entry.id))) {
    const page = await openScreen(context, screen);
    const appRects = await page.evaluate(measure, { root: 'main', unwrap: screen.unwrap, shell: SHELL_APP, deep: screen.deep, side: 1 });
    const appShot = path.join(OUT, 'app', `${screen.id}.png`);
    await page.screenshot({ path: appShot, fullPage: true });
    // A guest has no live order, and the app keeps the card in view on a page taller than the window.
    const skipped = new Set([...(screen.signedOut || screen.stickyCard ? ['shell.liveCard'] : [])]);
    const failures = compareRects(screen.id, ...[refRects[screen.id], appRects].map(rects => Object.fromEntries(Object.entries(rects).filter(([key]) => !skipped.has(key)))));
    const mismatch = await compareShots(browser, path.join(OUT, 'ref', `${screen.id}.png`), appShot, path.join(OUT, 'overlay', `${screen.id}.png`));
    check(`1280 ${screen.id}: rects match`, failures === 0, `${failures} off, pixel mismatch ${mismatch.toFixed(1)}%`);
    await page.close();
  }

  if (!only) {
    for (const [width, height] of MACBOOKS) {
      const folder = path.join(OUT, String(width));
      mkdirSync(folder, { recursive: true });
      const sized = await appContext(browser, { viewport: { width, height } });
      for (const screen of SCREENS) {
        const page = await openScreen(sized, screen);
        const size = await page.evaluate(() => {
          const share = selector => document.querySelector(selector).getBoundingClientRect().width / document.documentElement.clientWidth;
          return { taskbar: share('.taskbar'), main: share('main'), scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth };
        });
        const shot = path.join(folder, `${screen.id}.png`);
        await page.screenshot({ path: shot, fullPage: true });
        const mismatch = await compareShots(browser, path.join(OUT, 'ref', `${screen.id}.png`), shot, path.join(folder, `${screen.id}.overlay.png`));
        const fits = size.scrollWidth <= size.clientWidth && Math.abs(size.taskbar - TASKBAR_SHARE) <= SHARE_TOLERANCE && Math.abs(size.main - MAIN_SHARE) <= SHARE_TOLERANCE;
        check(`${width} ${screen.id}: shares and no sideways scroll`, fits, `taskbar ${size.taskbar.toFixed(4)} main ${size.main.toFixed(4)} mismatch ${mismatch.toFixed(1)}%`);
        await page.close();
      }
      await sized.close();
    }

    // Browser zoom only changes the width the page sees, so the ratios must not move.
    const zoomed = await appContext(browser, { viewport: { width: 1512, height: 982 } });
    const zoomPage = await openScreen(zoomed, SCREENS[1]);
    const ratios = () => zoomPage.evaluate(() => ['.taskbar', 'main', '.bay', '.product-card'].map(selector => document.querySelector(selector).getBoundingClientRect().width / document.documentElement.clientWidth));
    const base = await ratios();
    for (const width of [1260, 1680]) {
      await zoomPage.setViewportSize({ width, height: 982 });
      await zoomPage.waitForTimeout(150);
      const seen = await ratios();
      check(`zoom ${width}: ratios unchanged`, seen.every((value, index) => Math.abs(value - base[index]) <= SHARE_TOLERANCE), seen.map(value => value.toFixed(4)).join(' '));
    }
    await zoomed.close();

    // Conveyor
    for (const width of [1280, 1512]) {
      const belt = await appContext(browser, { viewport: { width, height: 900 } });
      const page = await belt.newPage();
      await page.goto(`${WEB}/map`);
      await page.waitForSelector('.conveyor-card');
      await page.mouse.move(2, 2);
      await page.waitForTimeout(400);
      const left = () => page.evaluate(() => document.querySelector('.conveyor').scrollLeft);
      const widths = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      check(`conveyor ${width}: page keeps the window width`, widths[0] === widths[1], widths.join(' / '));
      const speed = await page.evaluate(async () => {
        const belt = document.querySelector('.conveyor');
        const [startLeft, startTime] = [belt.scrollLeft, performance.now()];
        await new Promise(done => { setTimeout(done, 2000); });
        return (belt.scrollLeft - startLeft) / ((performance.now() - startTime) / 1000);
      });
      check(`conveyor ${width}: moves about 40 px/s`, speed > 34 && speed < 46, `${speed.toFixed(1)} px/s`);
      await page.hover('.conveyor');
      await page.waitForTimeout(150);
      const held = await left();
      await page.waitForTimeout(1000);
      check(`conveyor ${width}: stops on hover`, Math.abs((await left()) - held) < 1);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(600);
      check(`conveyor ${width}: moves again after hover`, (await left()) > held + 5);
      const wrap = await page.evaluate(async () => {
        const belt = document.querySelector('.conveyor');
        const half = belt.scrollWidth / 2;
        belt.scrollLeft = half - 30;
        let [last, biggest, wrapped] = [belt.scrollLeft, 0, false];
        const started = performance.now();
        while (performance.now() - started < 1800) {
          await new Promise(done => { requestAnimationFrame(done); });
          const step = belt.scrollLeft - last;
          if (step < -half / 2) { wrapped = true; biggest = Math.max(biggest, Math.abs(step + belt.scrollWidth / 2)); } else biggest = Math.max(biggest, Math.abs(step));
          last = belt.scrollLeft;
        }
        return { wrapped, biggest };
      });
      check(`conveyor ${width}: loops with no visible jump`, wrap.wrapped && wrap.biggest < 14, JSON.stringify(wrap));
      await belt.close();
    }
    const still = await appContext(browser, { reducedMotion: 'reduce' });
    const stillPage = await still.newPage();
    await stillPage.goto(`${WEB}/map`);
    await stillPage.waitForSelector('.conveyor-card');
    await stillPage.waitForTimeout(800);
    check('conveyor: reduced motion stays put', await stillPage.evaluate(() => document.querySelector('.conveyor').scrollLeft === 0));
    await still.close();

    // Compact
    for (const [width, height] of [[820, 1180], [390, 844]]) {
      const compact = await appContext(browser, { viewport: { width, height } });
      for (const screen of SCREENS) {
        const page = await openScreen(compact, screen);
        const state = await page.evaluate(() => ({ compact: document.documentElement.classList.contains('is-compact'), menu: getComputedStyle(document.querySelector('.menu-button')).display, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
        check(`compact ${width} ${screen.id}`, state.compact && state.menu !== 'none' && state.sideways <= 0, JSON.stringify(state));
        await page.screenshot({ path: path.join(OUT, 'app', `${screen.id}-${width}.png`), fullPage: true });
        await page.close();
      }
      await compact.close();
    }
  }
} finally {
  await browser.close();
  if (vite) process.kill(-vite.pid);
}

const failed = results.filter(result => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
failed.forEach(result => console.log(`  FAIL ${result.name} ${result.detail}`));
process.exit(failed.length ? 1 : 0);
