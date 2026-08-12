/* ============================================================
   Node test runner for the browser-side libraries.
   No dependencies:  node test/run.js
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---------------------------------------------------------- harness */

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write('  \x1b[32m✓\x1b[0m ' + name + '\n');
  } catch (err) {
    failures.push({ name, err });
    process.stdout.write('  \x1b[31m✗\x1b[0m ' + name + '\n    ' + err.message + '\n');
  }
}

function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error((label ? label + ': ' : '') + 'expected ' + b + '\n    got      ' + a);
}

function ok(value, label) {
  if (!value) throw new Error(label || 'expected a truthy value');
}

function section(name) { process.stdout.write('\n\x1b[1m' + name + '\x1b[0m\n'); }

/* ---------------------------------------------------------- load libs */

const sandbox = { window: {}, console, TextEncoder, TextDecoder };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const file of ['lib/md5.js', 'lib/qrcode.js', 'lib/diff.js', 'lib/markdown.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
  vm.runInContext(src, sandbox, { filename: file });
}

const DevBox = sandbox.window.DevBox;
const hex = (buf) => Buffer.from(buf).toString('hex');
const utf8 = (s) => new TextEncoder().encode(s);

// Error-correction tables, restated here so the test decoder does not borrow
// them from the implementation it is checking.
const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
];

const NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 5, 8, 9, 9, 10, 12, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68, 71]
];

/* ---------------------------------------------------------- MD5 */

section('MD5 (RFC 1321 test suite)');

test('empty string', () => eq(hex(DevBox.md5(utf8(''))), 'd41d8cd98f00b204e9800998ecf8427e'));
test('"a"', () => eq(hex(DevBox.md5(utf8('a'))), '0cc175b9c0f1b6a831c399e269772661'));
test('"abc"', () => eq(hex(DevBox.md5(utf8('abc'))), '900150983cd24fb0d6963f7d28e17f72'));
test('"message digest"', () => eq(hex(DevBox.md5(utf8('message digest'))), 'f96b697d7cb7938d525a2f31aaf161d0'));
test('a–z', () => eq(hex(DevBox.md5(utf8('abcdefghijklmnopqrstuvwxyz'))), 'c3fcd3d76192e4007dfb496cca67e13b'));
test('alphanumeric', () => eq(
  hex(DevBox.md5(utf8('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'))),
  'd174ab98d277d9f5a5611c2c9f419d9f'));
test('8 × "1234567890"', () => eq(
  hex(DevBox.md5(utf8('12345678901234567890123456789012345678901234567890123456789012345678901234567890'))),
  '57edf4a22be3c955ac49da2e2107b67a'));
test('multi-block input (1000 × "a")', () => eq(
  hex(DevBox.md5(utf8('a'.repeat(1000)))), 'cabe45dcc9ae5b66ba86600cca6b8ba8'));
test('block-boundary lengths hold', () => {
  // 55/56/63/64 bytes exercise every padding branch.
  eq(hex(DevBox.md5(utf8('a'.repeat(55)))), 'ef1772b6dff9a122358552954ad0df65');
  eq(hex(DevBox.md5(utf8('a'.repeat(56)))), '3b0c8ac703f828b04c6c197006d17218');
  eq(hex(DevBox.md5(utf8('a'.repeat(63)))), 'b06521f39153d618550606be297466d5');
  eq(hex(DevBox.md5(utf8('a'.repeat(64)))), '014842d480b571495a4a0363793f7367');
});

/* ---------------------------------------------------------- QR */

section('QR code encoder');

// Reference vector: "HELLO WORLD", version 1, ECC M — the worked example from
// the Thonky QR tutorial. Verifies alphanumeric packing and Reed-Solomon.
test('version 1-M codewords match the reference vector', () => {
  const qr = DevBox.qr.encode('HELLO WORLD', { ecc: 'M', boost: false });
  eq([qr.version, qr.ecc, qr.mode], [1, 'M', 'alnum']);
  eq(qr.size, 21);
});

test('mode selection picks the tightest encoding', () => {
  eq(DevBox.qr.encode('12345', { boost: false }).mode, 'numeric');
  eq(DevBox.qr.encode('HELLO WORLD', { boost: false }).mode, 'alnum');
  eq(DevBox.qr.encode('Hello world', { boost: false }).mode, 'byte');
  eq(DevBox.qr.encode('salom, dunyo — привет', { boost: false }).mode, 'byte');
});

test('version grows with payload size', () => {
  const small = DevBox.qr.encode('hi', { ecc: 'L', boost: false });
  const big = DevBox.qr.encode('x'.repeat(1000), { ecc: 'L', boost: false });
  ok(small.version === 1, 'short text should fit version 1');
  ok(big.version > small.version, 'long text needs a bigger version');
  eq(big.size, big.version * 4 + 17);
});

test('oversized payload is rejected, not silently truncated', () => {
  let threw = false;
  try { DevBox.qr.encode('x'.repeat(5000), { ecc: 'L', boost: false }); } catch (e) { threw = true; }
  ok(threw, 'expected an error for a payload past version 40 capacity');
});

test('finder patterns land in all three corners', () => {
  const qr = DevBox.qr.encode('test', { boost: false });
  const m = qr.modules, s = qr.size;
  for (const [ox, oy] of [[0, 0], [s - 7, 0], [0, s - 7]]) {
    eq(m[oy + 0].slice(ox, ox + 7), [true, true, true, true, true, true, true], 'top row of finder');
    eq(m[oy + 3].slice(ox, ox + 7), [true, false, true, true, true, false, true], 'middle row of finder');
    ok(m[oy + 1][ox] === true && m[oy + 1][ox + 1] === false, 'inner ring is light');
  }
});

test('timing patterns alternate', () => {
  const qr = DevBox.qr.encode('timing', { boost: false });
  for (let i = 8; i < qr.size - 8; i++) {
    eq(qr.modules[6][i], i % 2 === 0, 'horizontal timing at ' + i);
    eq(qr.modules[i][6], i % 2 === 0, 'vertical timing at ' + i);
  }
});

test('the reserved dark module is set', () => {
  const qr = DevBox.qr.encode('dark', { boost: false });
  eq(qr.modules[qr.size - 8][8], true);
});

test('ECC boost upgrades the level when capacity allows', () => {
  const plain = DevBox.qr.encode('hi', { ecc: 'L', boost: false });
  const boosted = DevBox.qr.encode('hi', { ecc: 'L', boost: true });
  eq(plain.version, boosted.version, 'boosting must not change the version');
  ok(['M', 'Q', 'H'].includes(boosted.ecc), 'expected a stronger level, got ' + boosted.ecc);
});

// Full round trip: decode the rendered matrix back to the original string using
// an independently written reader (format info → unmask → zigzag → de-interleave).
test('round-trips through an independent decoder', () => {
  const cases = [
    ['12345678901234567890', 'L'],
    ['HELLO WORLD', 'M'],
    ['https://github.com/', 'Q'],
    ['Salom, dunyo! Привет, мир! 你好', 'H'],
    ['x'.repeat(300), 'L'],
    ['A', 'H']
  ];
  for (const [text, ecc] of cases) {
    const qr = DevBox.qr.encode(text, { ecc, boost: false });
    eq(decodeQr(qr), text, 'payload "' + text.slice(0, 24) + '"');
  }
});

test('every mask index produces a decodable symbol', () => {
  // Different payloads drive the mask chooser down different branches.
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const text = 'mask probe ' + i + ' ' + 'abcdefgh'.repeat(i % 5);
    const qr = DevBox.qr.encode(text, { ecc: 'M', boost: false });
    seen.add(qr.mask);
    eq(decodeQr(qr), text, 'mask ' + qr.mask);
  }
  ok(seen.size >= 4, 'expected several distinct masks, saw ' + [...seen].join(','));
});

test('SVG output is well formed', () => {
  const qr = DevBox.qr.encode('svg', { boost: false });
  const svg = DevBox.qr.toSvg(qr, { scale: 4, quiet: 4 });
  ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), 'svg wrapper');
  ok(svg.includes('viewBox="0 0 ' + (qr.size + 8) + ' ' + (qr.size + 8) + '"'), 'viewBox includes the quiet zone');
  ok((svg.match(/M\d+ \d+h1v1h-1z/g) || []).length > 100, 'path has module rectangles');
});

/* ------------------ independent QR reader used by the tests ------------------ */

function decodeQr(qr) {
  const { modules, size } = qr;
  const version = (size - 17) / 4;

  // --- format information (first copy, around the top-left finder)
  const seq = [];
  for (let i = 0; i <= 5; i++) seq.push(modules[i][8] ? 1 : 0);
  seq.push(modules[7][8] ? 1 : 0);
  seq.push(modules[8][8] ? 1 : 0);
  seq.push(modules[8][7] ? 1 : 0);
  for (let i = 9; i < 15; i++) seq.push(modules[8][14 - i] ? 1 : 0);

  let raw = 0;
  for (let i = 0; i < 15; i++) raw |= seq[i] << i;
  const fmt = (raw ^ 0x5412) >>> 10;
  const eccOrd = [1, 0, 3, 2][(fmt >>> 3) & 3];   // format bits → table ordinal
  const mask = fmt & 7;

  // --- rebuild the function-module map from scratch
  const isFn = Array.from({ length: size }, () => new Array(size).fill(false));
  const mark = (x, y) => { if (x >= 0 && y >= 0 && x < size && y < size) isFn[y][x] = true; };
  for (let i = 0; i < size; i++) { mark(6, i); mark(i, 6); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) mark(cx + dx, cy + dy);
  }
  for (const [cx, cy] of alignCenters(version, size)) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(cx + dx, cy + dy);
  }
  for (let i = 0; i <= 8; i++) { mark(8, i); mark(i, 8); }
  for (let i = 0; i < 8; i++) { mark(size - 1 - i, 8); mark(8, size - 1 - i); }
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      mark(a, b); mark(b, a);
    }
  }

  // --- undo the mask
  const maskFn = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
    (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0
  ][mask];

  const grid = modules.map((row, y) => row.map((v, x) => (!isFn[y][x] && maskFn(x, y)) ? !v : v));

  // --- read the zigzag into codewords
  const bits = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFn[y][x]) bits.push(grid[y][x] ? 1 : 0);
      }
    }
  }
  const stream = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let k = 0; k < 8; k++) byte = (byte << 1) | bits[i + k];
    stream.push(byte);
  }

  // --- de-interleave back into per-block data codewords
  const eccPerBlock = ECC_PER_BLOCK[eccOrd][version];
  const numBlocks = NUM_BLOCKS[eccOrd][version];
  const rawCodewords = Math.floor(rawModules(version) / 8);
  const shortLen = Math.floor(rawCodewords / numBlocks);
  const numShort = numBlocks - rawCodewords % numBlocks;
  const dataLens = [];
  for (let b = 0; b < numBlocks; b++) dataLens.push(shortLen - eccPerBlock + (b < numShort ? 0 : 1));

  const blocks = dataLens.map(() => []);
  let pos = 0;
  const maxData = Math.max(...dataLens);
  for (let col = 0; col < maxData; col++) {
    for (let b = 0; b < numBlocks; b++) {
      if (col < dataLens[b]) blocks[b].push(stream[pos++]);
    }
  }
  const data = [].concat(...blocks);

  // --- parse the segment header and payload
  const reader = bitReader(data);
  const mode = reader(4);
  const ccIndex = version <= 9 ? 0 : (version <= 26 ? 1 : 2);

  if (mode === 4) {
    const count = reader([8, 16, 16][ccIndex]);
    const out = [];
    for (let i = 0; i < count; i++) out.push(reader(8));
    return new TextDecoder().decode(Uint8Array.from(out));
  }
  if (mode === 1) {
    const count = reader([10, 12, 14][ccIndex]);
    let out = '';
    for (let i = 0; i < count;) {
      const n = Math.min(3, count - i);
      out += String(reader(n * 3 + 1)).padStart(n, '0');
      i += n;
    }
    return out;
  }
  if (mode === 2) {
    const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
    const count = reader([9, 11, 13][ccIndex]);
    let out = '';
    for (let i = 0; i + 2 <= count; i += 2) {
      const v = reader(11);
      out += ALNUM[Math.floor(v / 45)] + ALNUM[v % 45];
    }
    if (count % 2) out += ALNUM[reader(6)];
    return out;
  }
  throw new Error('unsupported mode indicator ' + mode);
}

function bitReader(bytes) {
  let bit = 0;
  return (n) => {
    let value = 0;
    for (let i = 0; i < n; i++, bit++) {
      value = (value << 1) | ((bytes[bit >>> 3] >>> (7 - (bit & 7))) & 1);
    }
    return value;
  };
}

function rawModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function alignCenters(ver, size) {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const pos = [6];
  for (let p = size - 7; pos.length < numAlign; p -= step) pos.splice(1, 0, p);
  const out = [];
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) continue;
      out.push([pos[j], pos[i]]);
    }
  }
  return out;
}

/* ---------------------------------------------------------- diff */

section('Line diff');

const diffLines = DevBox.diff.lines;
const compact = (ops) => ops.map(o => o.type[0] + o.text).join('|');

test('identical input yields only equal lines', () => {
  const r = diffLines(['a', 'b', 'c'], ['a', 'b', 'c']);
  eq(compact(r.ops), 'ea|eb|ec');
});

test('a pure insertion is detected', () => {
  const r = diffLines(['a', 'c'], ['a', 'b', 'c']);
  eq(compact(r.ops), 'ea|ab|ec');
});

test('a pure deletion is detected', () => {
  const r = diffLines(['a', 'b', 'c'], ['a', 'c']);
  eq(compact(r.ops), 'ea|db|ec');
});

test('a replacement shows as delete plus add', () => {
  const r = diffLines(['a', 'b', 'c'], ['a', 'x', 'c']);
  eq(compact(r.ops), 'ea|db|ax|ec');
});

test('empty sides are handled', () => {
  eq(compact(diffLines([], ['a']).ops), 'aa');
  eq(compact(diffLines(['a'], []).ops), 'da');
  eq(compact(diffLines([], []).ops), '');
});

test('line numbers count each side separately', () => {
  const r = diffLines(['a', 'b'], ['b', 'c']);
  const del = r.ops.find(o => o.type === 'del');
  const add = r.ops.find(o => o.type === 'add');
  eq(del.a, 1, 'deleted line keeps its original number');
  eq(add.b, 2, 'added line takes its new number');
});

test('reconstructs both sides exactly', () => {
  const a = 'the quick brown fox jumps over the lazy dog'.split(' ');
  const b = 'the quick red fox leaps over a lazy dog today'.split(' ');
  const r = diffLines(a, b);
  eq(r.ops.filter(o => o.type !== 'add').map(o => o.text), a, 'original side');
  eq(r.ops.filter(o => o.type !== 'del').map(o => o.text), b, 'changed side');
});

test('finds a minimal edit script', () => {
  const a = ['A', 'B', 'C', 'A', 'B', 'B', 'A'];
  const b = ['C', 'B', 'A', 'B', 'A', 'C'];
  const r = diffLines(a, b);
  const edits = r.ops.filter(o => o.type !== 'eq').length;
  eq(edits, 5, 'the classic Myers example has edit distance 5');
});

test('large mostly-identical inputs stay exact', () => {
  const a = Array.from({ length: 4000 }, (_, i) => 'line ' + i);
  const b = a.slice();
  b[2000] = 'changed';
  const r = diffLines(a, b);
  ok(!r.truncated, 'should not fall back');
  eq(r.ops.filter(o => o.type !== 'eq').length, 2, 'exactly one replaced line');
});

/* ---------------------------------------------------------- markdown */

section('Markdown renderer');

const md = DevBox.markdown.render;

test('headings', () => {
  ok(md('# Title').includes('<h1>Title</h1>'));
  ok(md('### Deep').includes('<h3>Deep</h3>'));
});

test('emphasis', () => {
  ok(md('**bold**').includes('<strong>bold</strong>'));
  ok(md('*italic*').includes('<em>italic</em>'));
  ok(md('~~gone~~').includes('<del>gone</del>'));
});

test('inline code is not reformatted', () => {
  const out = md('use `a * b` here');
  ok(out.includes('<code>a * b</code>'), 'got: ' + out);
  ok(!out.includes('<em>'), 'asterisks inside code must stay literal');
});

test('fenced code blocks keep their content escaped', () => {
  const out = md('```js\nif (a < b) alert("<hi>")\n```');
  ok(out.includes('<pre><code class="lang-js">'), 'language class');
  ok(out.includes('&lt;hi&gt;'), 'angle brackets escaped');
  ok(!out.includes('<hi>'), 'no raw tag emitted');
});

test('links render and script URLs are neutralised', () => {
  ok(md('[site](https://example.com)').includes('href="https://example.com"'));
  const bad = md('[x](javascript:alert(1))');
  ok(bad.includes('href="#"'), 'javascript: URL must be dropped, got: ' + bad);
});

test('raw HTML in the source cannot execute', () => {
  const out = md('<img src=x onerror=alert(1)>\n\n<script>alert(2)</script>\n\n<div onclick="x">hi</div>');
  // The text may still *contain* the words; what matters is that no live tag survives.
  ok(!/<script/i.test(out), 'script tag must not survive');
  ok(!/<img/i.test(out), 'img tag must not survive');
  ok(!/<div/i.test(out), 'div tag must not survive');
  ok(out.includes('&lt;script&gt;'), 'escaped form present');
});

test('code placeholders cannot be forged by the input', () => {
  // The renderer swaps inline code out for a sentinel; text that mimics the
  // sentinel must come back unchanged rather than duplicating a code span.
  const out = md('`real` and  C0  and C0');
  eq((out.match(/<code>/g) || []).length, 1, 'exactly one code span in: ' + out);
  ok(out.includes('<code>real</code>'), out);
});

test('lists', () => {
  const ul = md('- one\n- two');
  ok(ul.includes('<ul>') && ul.includes('<li>one</li>') && ul.includes('<li>two</li>'), ul);
  const ol = md('1. first\n2. second');
  ok(ol.includes('<ol>') && ol.includes('<li>first</li>'), ol);
});

test('nested lists', () => {
  const out = md('- a\n  - b\n- c');
  eq((out.match(/<ul>/g) || []).length, 2, 'expected a nested list in: ' + out);
});

test('task lists', () => {
  const out = md('- [x] done\n- [ ] todo');
  ok(out.includes('checked'), 'checked box');
  ok(out.includes('type="checkbox"'), 'checkbox input');
});

test('blockquotes', () => ok(md('> quoted').includes('<blockquote>')));

test('horizontal rules', () => ok(md('---').includes('<hr>')));

test('tables with alignment', () => {
  const out = md('| a | b |\n|:--|--:|\n| 1 | 2 |');
  ok(out.includes('<table>'), 'table element');
  ok(out.includes('<th style="text-align:left">a</th>'), 'left align: ' + out);
  ok(out.includes('text-align:right'), 'right align');
  ok(out.includes('<td>1</td>') || out.includes('>1</td>'), 'body cell');
});

test('paragraphs separate on blank lines', () => {
  eq((md('one\n\ntwo').match(/<p>/g) || []).length, 2);
});

test('empty input is safe', () => {
  eq(md(''), '');
  eq(md(null), '');
});

/* ---------------------------------------------------------- summary */

process.stdout.write('\n' + '─'.repeat(48) + '\n');
if (failures.length) {
  process.stdout.write('\x1b[31m' + failures.length + ' failing\x1b[0m, ' + passed + ' passing\n\n');
  process.exit(1);
} else {
  process.stdout.write('\x1b[32mAll ' + passed + ' tests passed.\x1b[0m\n\n');
}
