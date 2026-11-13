import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const ROOT = process.cwd();
const IPHONE_DIR = path.join(ROOT, 'store-listing', 'screenshots', 'iphone-6.9');
const IPAD_DIR = path.join(ROOT, 'store-listing', 'screenshots', 'ipad-13');

fs.mkdirSync(IPHONE_DIR, { recursive: true });
fs.mkdirSync(IPAD_DIR, { recursive: true });

const CHROME_PATH = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find((p) => fs.existsSync(p));

if (!CHROME_PATH) {
  console.error('[ERROR] No Chrome/Edge binary found to capture screenshots.');
  process.exit(1);
}

const SHOTS = [
  { name: '01-menu-100-bolum.png', param: 'menu' },
  { name: '02-kolay-kademe-kesim.png', param: 'kolay' },
  { name: '03-orta-kademe-duvar-labirent.png', param: 'orta' },
  { name: '04-zor-kademe-ikiz-boss.png', param: 'zor' },
  { name: '05-usta-kademe-final.png', param: 'usta' }
];

const TARGETS = [
  {
    label: 'iPhone 6.9"',
    dir: IPHONE_DIR,
    width: 1320,
    height: 2868,
    viewportW: 440,
    viewportH: 956,
    dpr: 3
  },
  {
    label: 'iPad 13"',
    dir: IPAD_DIR,
    width: 2064,
    height: 2752,
    viewportW: 1032,
    viewportH: 1376,
    dpr: 2
  }
];

async function main() {
  console.log('====================================================');
  console.log('   VOID CARVER — APP STORE SCREENSHOT GENERATOR     ');
  console.log('====================================================');
  console.log(`Using browser: ${CHROME_PATH}\n`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const baseUrl = 'http://localhost:5188/';

  try {
    for (const target of TARGETS) {
      console.log(`\n--- Capturing for ${target.label} (${target.width}x${target.height}) ---`);
      const page = await browser.newPage();
      await page.setViewport({
        width: target.viewportW,
        height: target.viewportH,
        deviceScaleFactor: target.dpr
      });

      for (const shot of SHOTS) {
        const url = `${baseUrl}?shot=${shot.param}`;
        process.stdout.write(`  Capturing ${shot.name} (${shot.param})... `);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise((r) => setTimeout(r, 1200));

        const rawBuf = await page.screenshot({ type: 'png' });
        const finalPath = path.join(target.dir, shot.name);

        // Convert to exact Apple App Store Connect specifications:
        // Exact pixel size + 24-bit Truecolor RGB (0% alpha)
        await sharp(rawBuf)
          .resize(target.width, target.height, { fit: 'cover' })
          .removeAlpha()
          .toFile(finalPath);

        console.log(`OK -> ${path.relative(ROOT, finalPath)}`);
      }
      await page.close();
    }
    console.log('\n[PASS] All 10 App Store Connect screenshots successfully captured & saved!');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('\n[FATAL ERROR]', err);
  process.exit(1);
});
