/**
 * Browser smoke test: mounts every registered tool in a real Chromium and
 * fails if any of them throws, logs an error, or renders nothing.
 *
 *   node test/smoke.mjs
 *
 * Skips itself (exit 0) when no Chrome or Edge is installed, so the suite
 * still runs on machines without one.
 */

import { readFile, writeFile, unlink, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const PAGE = join(root, '.smoke.html');

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) {
  console.log('No Chrome or Edge found — skipping the browser smoke test.');
  process.exit(0);
}

/* ---------------------------------------------------------- build the page */

const HARNESS = `
<pre id="smoke-results" style="display:none"></pre>
<script>
(function () {
  var lines = [];
  var problems = [];

  window.addEventListener('error', function (e) {
    problems.push('UNCAUGHT ' + (e.message || e.error));
  });
  window.addEventListener('unhandledrejection', function (e) {
    problems.push('REJECTED ' + (e.reason && e.reason.message || e.reason));
  });
  var realError = console.error;
  console.error = function () {
    problems.push('CONSOLE ' + Array.prototype.map.call(arguments, String).join(' '));
    realError.apply(console, arguments);
  };

  function report() {
    var pre = document.getElementById('smoke-results');
    pre.textContent = '<<<SMOKE\\n' + lines.concat(problems.map(function (p) { return 'ERROR ' + p; })).join('\\n') + '\\nSMOKE>>>';
  }

  try {
    lines.push('CAPABILITY subtle-crypto=' + !!(window.crypto && crypto.subtle));
    lines.push('CAPABILITY randomUUID=' + !!(window.crypto && crypto.randomUUID));

    var tools = DevBox.tools();
    lines.push('COUNT ' + tools.length);

    // The home page rendered during start(); make sure it produced cards.
    var homeCards = document.querySelectorAll('.home-card').length;
    lines.push((homeCards >= tools.length ? 'PASS' : 'FAIL') + ' home-page (' + homeCards + ' cards)');

    var navItems = document.querySelectorAll('.nav-item').length;
    lines.push((navItems === tools.length ? 'PASS' : 'FAIL') + ' sidebar (' + navItems + ' items)');

    tools.forEach(function (tool) {
      var host = document.createElement('div');
      document.body.appendChild(host);
      try {
        tool.mount(host, {
          store: DevBox.ui.storage('smoke:' + tool.id),
          t: DevBox.t,
          lang: 'en'
        });
        var nodes = host.querySelectorAll('*').length;
        lines.push((nodes > 3 ? 'PASS' : 'FAIL') + ' mount:' + tool.id + ' (' + nodes + ' nodes)');
      } catch (err) {
        lines.push('FAIL mount:' + tool.id + ' -- ' + (err && err.message) + ' @ ' + firstFrame(err));
      }
    });

    // Every tool must carry all three translations and a unique id.
    var ids = {};
    tools.forEach(function (tool) {
      ['en', 'uz', 'ru'].forEach(function (lang) {
        if (!tool.name || !tool.name[lang]) lines.push('FAIL i18n:' + tool.id + ' missing name.' + lang);
        if (!tool.desc || !tool.desc[lang]) lines.push('FAIL i18n:' + tool.id + ' missing desc.' + lang);
      });
      if (ids[tool.id]) lines.push('FAIL duplicate id ' + tool.id);
      ids[tool.id] = true;
    });
    lines.push('PASS metadata');

    // Switching language must re-render without throwing.
    ['uz', 'ru', 'en'].forEach(function (lang) {
      try {
        document.querySelector('#langSeg button[data-lang=' + lang + ']').click();
        lines.push('PASS lang:' + lang);
      } catch (err) {
        lines.push('FAIL lang:' + lang + ' -- ' + err.message);
      }
    });

    // Routing to each tool through the real hash router. Assigning the hash
    // updates location synchronously but defers the event, so fire it here.
    var routed = 0;
    tools.forEach(function (tool) {
      location.hash = '#/' + tool.id;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      var title = document.querySelector('.tool-title');
      if (title && title.textContent.indexOf(DevBox.t(tool.name)) >= 0) routed++;
      else lines.push('FAIL route:' + tool.id + ' rendered "' + (title ? title.textContent : 'nothing') + '"');
    });
    lines.push((routed === tools.length ? 'PASS' : 'FAIL') + ' routing (' + routed + '/' + tools.length + ')');
    location.hash = '#/';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    document.getElementById('searchTrigger').click();
    var paletteOpen = !document.getElementById('palette').hidden;
    var paletteItems = document.querySelectorAll('.palette-item').length;
    lines.push((paletteOpen && paletteItems === tools.length ? 'PASS' : 'FAIL') +
      ' palette (open=' + paletteOpen + ', items=' + paletteItems + ')');
  } catch (err) {
    lines.push('FAIL harness -- ' + (err && err.stack || err));
  }

  function firstFrame(err) {
    var stack = (err && err.stack || '').split('\\n')[1] || '';
    return stack.trim().slice(0, 120);
  }

  // Give async work (hashes, image encoding, timers) a chance to blow up.
  setTimeout(report, 1200);
  report();
})();
</script>
`;

// `--dist` runs the same checks against the bundled single file, proving the
// build did not drop or reorder anything.
const target = process.argv.includes('--dist') ? join(root, 'dist', 'shashka.html') : join(root, 'index.html');
if (!existsSync(target)) {
  console.error(`Nothing to test at ${target}. Run "npm run build" first.`);
  process.exit(1);
}

const html = await readFile(target, 'utf8');
await writeFile(PAGE, html.replace('</body>', () => HARNESS + '</body>'), 'utf8');

/* ---------------------------------------------------------- run it */

const profile = await mkdtemp(join(tmpdir(), 'shashka-smoke-'));

const dom = await new Promise((resolve, reject) => {
  const child = spawn(browser, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--disable-extensions',
    '--allow-file-access-from-files',
    `--user-data-dir=${profile}`,
    '--virtual-time-budget=10000',
    '--dump-dom',
    `file:///${PAGE.replace(/\\/g, '/')}`
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let out = '';
  let err = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { err += d; });
  child.on('error', reject);
  child.on('close', (code) => {
    if (!out) reject(new Error(`Browser produced no output (exit ${code})\n${err}`));
    else resolve(out);
  });

  setTimeout(() => { child.kill(); reject(new Error('Browser timed out')); }, 90000);
});

const keepPage = process.argv.includes('--keep');
if (!keepPage) await unlink(PAGE).catch(() => {});
await rm(profile, { recursive: true, force: true }).catch(() => {});

/* ---------------------------------------------------------- verdict */

// Chromium emits CRLF on Windows; normalise before matching.
const normalised = dom.replace(/\r\n/g, '\n');
const block = /&lt;&lt;&lt;SMOKE\n([\s\S]*?)\nSMOKE&gt;&gt;&gt;|<<<SMOKE\n([\s\S]*?)\nSMOKE>>>/.exec(normalised);
if (!block) {
  const dumpPath = join(root, '.smoke-dump.html');
  await writeFile(dumpPath, normalised, 'utf8');
  console.error('The harness never reported. Rendered DOM written to .smoke-dump.html for inspection.');
  process.exit(1);
}

const lines = (block[1] || block[2])
  .split('\n')
  .map((l) => l.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"));

const failures = lines.filter((l) => l.startsWith('FAIL') || l.startsWith('ERROR'));
const passes = lines.filter((l) => l.startsWith('PASS'));

console.log('\n\x1b[1mBrowser smoke test\x1b[0m (' + browser.split(/[\\/]/).pop() + ')\n');
for (const line of lines) {
  if (line.startsWith('FAIL') || line.startsWith('ERROR')) console.log('  \x1b[31m✗\x1b[0m ' + line);
  else if (line.startsWith('PASS')) console.log('  \x1b[32m✓\x1b[0m ' + line.slice(5));
  else console.log('    \x1b[2m' + line + '\x1b[0m');
}

console.log('\n' + '─'.repeat(48));
if (failures.length) {
  console.log(`\x1b[31m${failures.length} failing\x1b[0m, ${passes.length} passing\n`);
  process.exit(1);
}
console.log(`\x1b[32mAll ${passes.length} checks passed.\x1b[0m\n`);
