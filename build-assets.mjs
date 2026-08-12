/**
 * Renders the SVG sources in docs/ to the PNGs that GitHub and app installers
 * need (they do not accept SVG for avatars, social previews or PWA icons).
 *
 *   node build-assets.mjs
 *
 * Uses headless Chrome, which is the only rasteriser guaranteed to already be
 * on a developer machine. Skips quietly when no browser is installed — the
 * committed PNGs stay valid until someone changes the SVGs.
 */

import { readFile, writeFile, unlink, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, 'docs');

const TARGETS = [
  { svg: 'icon.svg', out: 'icon-192.png', w: 192, h: 192 },
  { svg: 'icon.svg', out: 'icon-512.png', w: 512, h: 512 },
  { svg: 'social-preview.svg', out: 'social-preview.png', w: 1280, h: 640 }
];

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) {
  console.log('No Chrome or Edge found — keeping the existing PNGs.');
  process.exit(0);
}

for (const target of TARGETS) {
  const svg = await readFile(join(docs, target.svg), 'utf8');

  const page = join(tmpdir(), `asset-${target.out}.html`);
  await writeFile(page, `<!DOCTYPE html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}
svg{display:block;width:${target.w}px;height:${target.h}px}</style>
${svg.replace(/\swidth="\d+"\s+height="\d+"/, ` width="${target.w}" height="${target.h}"`)}`, 'utf8');

  const profile = await mkdtemp(join(tmpdir(), 'asset-'));
  const out = join(docs, target.out);

  await new Promise((resolve, reject) => {
    const child = spawn(browser, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
      '--hide-scrollbars', '--allow-file-access-from-files',
      '--default-background-color=00000000',
      `--user-data-dir=${profile}`,
      `--window-size=${target.w},${target.h}`,
      '--virtual-time-budget=4000',
      `--screenshot=${out}`,
      `file:///${page.replace(/\\/g, '/')}`
    ], { stdio: 'ignore' });
    child.on('close', resolve);
    child.on('error', reject);
  });

  await unlink(page).catch(() => {});
  await rm(profile, { recursive: true, force: true }).catch(() => {});
  console.log(`rendered docs/${target.out}  (${target.w}x${target.h})`);
}
