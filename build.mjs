/**
 * Bundles the multi-file source into one self-contained HTML document.
 *
 *   node build.mjs
 *
 * The output at dist/shashka.html has no external references at all: open it
 * from a USB stick on a machine with no network and every tool still works.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(here, 'dist');
const OUT_FILE = join(OUT_DIR, 'shashka.html');

/** Inside a <script> or <style> block, this sequence would close it early. */
const guard = (code) => code.replace(/<\/(script|style)/gi, '<\\/$1');

async function read(relative) {
  const path = resolve(here, relative);
  if (!path.startsWith(here)) throw new Error(`Refusing to read outside the project: ${relative}`);
  return readFile(path, 'utf8');
}

const html = await read('index.html');

const cssFiles = [];
const jsFiles = [];

// Collect every local asset the dev page references, in document order.
let inlined = html
  .replace(/[ \t]*<link\b[^>]*\bhref="([^"]+\.css)"[^>]*>\s*\n?/gi, (whole, href) => {
    if (/^https?:/i.test(href)) return whole;
    cssFiles.push(href);
    return cssFiles.length === 1 ? '<!--STYLES-->\n' : '';
  })
  .replace(/[ \t]*<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>\s*\n?/gi, (whole, src) => {
    if (/^https?:/i.test(src)) return whole;
    jsFiles.push(src);
    return jsFiles.length === 1 ? '<!--SCRIPTS-->\n' : '';
  });

if (!cssFiles.length) throw new Error('No local stylesheet found in index.html');
if (!jsFiles.length) throw new Error('No local scripts found in index.html');

const css = (await Promise.all(cssFiles.map(read))).join('\n');

const js = (await Promise.all(
  jsFiles.map(async (file) => `/* ===== ${file} ===== */\n${await read(file)}`)
)).join('\n');

// Check the shell now, while it is still just markup: once the JavaScript is
// inlined, string literals like src="' + url + '" would trip this up.
const leftovers = inlined.match(/\b(?:src|href)="(?!#|data:|mailto:|https?:)[^"]+"/gi);
if (leftovers) throw new Error(`Unresolved local reference in index.html: ${leftovers.join(', ')}`);

const version = JSON.parse(await read('package.json')).version;
const banner = [
  '<!--',
  '  Shashka — offline developer toolbox',
  `  version ${version} · built ${new Date().toISOString().slice(0, 10)}`,
  '',
  '  This file is entirely self-contained. It makes no network requests,',
  '  loads no fonts or scripts from anywhere, and stores nothing outside',
  '  your own browser. Save it and it keeps working offline.',
  '',
  '  Source: https://github.com/nasafuriy/offline-devtools  ·  MIT licensed',
  '-->'
].join('\n');

// Function replacers, not string ones: the sources contain `$&` (inside regex
// escapes), which String.replace would otherwise expand into the match.
inlined = inlined
  .replace('<!--STYLES-->', () => `<style>\n${guard(css)}\n</style>`)
  .replace('<!--SCRIPTS-->', () => `<script>\n${guard(js)}\n</script>`)
  .replace('<!DOCTYPE html>', () => `<!DOCTYPE html>\n${banner}`);

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, inlined, 'utf8');

const kb = (Buffer.byteLength(inlined, 'utf8') / 1024).toFixed(1);
console.log(`Built dist/shashka.html — ${kb} KB, ${cssFiles.length} stylesheet, ${jsFiles.length} scripts inlined.`);
