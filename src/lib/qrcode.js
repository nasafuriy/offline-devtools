/* ============================================================
   QR Code encoder — ISO/IEC 18004, versions 1–40.
   Numeric / alphanumeric / byte modes, Reed-Solomon over GF(256),
   all eight data masks scored by the standard penalty rules.
   No dependencies, no network: the whole point of this toolbox.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------------------------------------------------- tables */

  // Index: [eccOrdinal][version]
  var ECC_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  ];

  var NUM_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 5, 8, 9, 9, 10, 12, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68, 71]
  ];

  // Ordinal used to index the tables above, plus the 2-bit value baked
  // into the format information block.
  var ECC = {
    L: { ord: 0, fmt: 1 },
    M: { ord: 1, fmt: 0 },
    Q: { ord: 2, fmt: 3 },
    H: { ord: 3, fmt: 2 }
  };
  var ECC_ORDER = ['L', 'M', 'Q', 'H'];

  var ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

  var MODE = {
    numeric: { indicator: 1, cc: [10, 12, 14] },
    alnum:   { indicator: 2, cc: [9, 11, 13] },
    byte:    { indicator: 4, cc: [8, 16, 16] }
  };

  /* ---------------------------------------------------------- GF(256) */

  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
  }

  function rsDivisor(degree) {
    var result = new Uint8Array(degree);
    result[degree - 1] = 1;
    var root = 1;
    for (var i = 0; i < degree; i++) {
      for (var j = 0; j < degree; j++) {
        result[j] = gfMul(result[j], root);
        if (j + 1 < degree) result[j] ^= result[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return result;
  }

  function rsRemainder(data, divisor) {
    var result = new Uint8Array(divisor.length);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ result[0];
      result.copyWithin(0, 1);
      result[result.length - 1] = 0;
      for (var j = 0; j < result.length; j++) result[j] ^= gfMul(divisor[j], factor);
    }
    return result;
  }

  /* ---------------------------------------------------------- capacity */

  function numRawDataModules(ver) {
    var result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  function numDataCodewords(ver, eccOrd) {
    return Math.floor(numRawDataModules(ver) / 8) - ECC_PER_BLOCK[eccOrd][ver] * NUM_BLOCKS[eccOrd][ver];
  }

  function alignPositions(ver) {
    if (ver === 1) return [];
    var numAlign = Math.floor(ver / 7) + 2;
    var size = ver * 4 + 17;
    var step = (ver === 32) ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
    var result = [6];
    for (var pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  /* ---------------------------------------------------------- segments */

  function toUtf8(str) { return new TextEncoder().encode(str); }

  function makeSegment(text) {
    if (/^[0-9]*$/.test(text)) return numericSeg(text);
    if (/^[0-9A-Z $%*+\-./:]*$/.test(text)) return alnumSeg(text);
    return byteSeg(text);
  }

  function numericSeg(text) {
    var bits = [];
    for (var i = 0; i < text.length;) {
      var n = Math.min(3, text.length - i);
      pushBits(bits, parseInt(text.substr(i, n), 10), n * 3 + 1);
      i += n;
    }
    return { mode: 'numeric', chars: text.length, bits: bits };
  }

  function alnumSeg(text) {
    var bits = [];
    var i = 0;
    for (; i + 2 <= text.length; i += 2) {
      pushBits(bits, ALNUM.indexOf(text[i]) * 45 + ALNUM.indexOf(text[i + 1]), 11);
    }
    if (i < text.length) pushBits(bits, ALNUM.indexOf(text[i]), 6);
    return { mode: 'alnum', chars: text.length, bits: bits };
  }

  function byteSeg(text) {
    var data = toUtf8(text);
    var bits = [];
    for (var i = 0; i < data.length; i++) pushBits(bits, data[i], 8);
    return { mode: 'byte', chars: data.length, bits: bits };
  }

  function pushBits(bits, value, len) {
    for (var i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  }

  function ccBits(mode, ver) {
    return MODE[mode].cc[ver <= 9 ? 0 : (ver <= 26 ? 1 : 2)];
  }

  function segBitLength(seg, ver) {
    return 4 + ccBits(seg.mode, ver) + seg.bits.length;
  }

  /* ---------------------------------------------------------- codewords */

  function buildCodewords(seg, ver, eccOrd) {
    var capacity = numDataCodewords(ver, eccOrd) * 8;
    var bits = [];
    pushBits(bits, MODE[seg.mode].indicator, 4);
    pushBits(bits, seg.chars, ccBits(seg.mode, ver));
    Array.prototype.push.apply(bits, seg.bits);

    // Terminator, then pad to a byte boundary, then the alternating pad bytes.
    var pad = Math.min(4, capacity - bits.length);
    for (var i = 0; i < pad; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    for (var b = 0xEC; bits.length < capacity; b ^= 0xEC ^ 0x11) pushBits(bits, b, 8);

    var data = [];
    for (var j = 0; j < bits.length; j += 8) {
      var byte = 0;
      for (var k = 0; k < 8; k++) byte = (byte << 1) | bits[j + k];
      data.push(byte);
    }
    return data;
  }

  function addEccAndInterleave(data, ver, eccOrd) {
    var numBlocks = NUM_BLOCKS[eccOrd][ver];
    var eccLen = ECC_PER_BLOCK[eccOrd][ver];
    var rawCodewords = Math.floor(numRawDataModules(ver) / 8);
    var numShort = numBlocks - rawCodewords % numBlocks;
    var shortLen = Math.floor(rawCodewords / numBlocks);

    var divisor = rsDivisor(eccLen);
    var blocks = [];
    for (var i = 0, k = 0; i < numBlocks; i++) {
      var take = shortLen - eccLen + (i < numShort ? 0 : 1);
      var dat = data.slice(k, k + take);
      k += take;
      var ecc = rsRemainder(dat, divisor);
      var block = dat.slice();
      if (i < numShort) block.push(0);   // filler so interleaving lines up
      for (var e = 0; e < ecc.length; e++) block.push(ecc[e]);
      blocks.push(block);
    }

    var result = [];
    for (var col = 0; col < blocks[0].length; col++) {
      for (var b = 0; b < blocks.length; b++) {
        if (col !== shortLen - eccLen || b >= numShort) result.push(blocks[b][col]);
      }
    }
    return result;
  }

  /* ---------------------------------------------------------- matrix */

  function Matrix(ver) {
    this.ver = ver;
    this.size = ver * 4 + 17;
    this.modules = [];
    this.isFn = [];
    for (var y = 0; y < this.size; y++) {
      this.modules.push(new Array(this.size).fill(false));
      this.isFn.push(new Array(this.size).fill(false));
    }
  }

  Matrix.prototype.setFn = function (x, y, dark) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    this.modules[y][x] = dark;
    this.isFn[y][x] = true;
  };

  Matrix.prototype.drawFunctionPatterns = function (eccOrd) {
    var size = this.size, i;

    for (i = 0; i < size; i++) {
      this.setFn(6, i, i % 2 === 0);
      this.setFn(i, 6, i % 2 === 0);
    }

    this.drawFinder(3, 3);
    this.drawFinder(size - 4, 3);
    this.drawFinder(3, size - 4);

    var pos = alignPositions(this.ver);
    var n = pos.length;
    for (i = 0; i < n; i++) {
      for (var j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        this.drawAlignment(pos[j], pos[i]);
      }
    }

    this.drawFormatBits(eccOrd, 0);   // placeholder; rewritten once a mask is chosen
    this.drawVersionBits();
  };

  Matrix.prototype.drawFinder = function (cx, cy) {
    for (var dy = -4; dy <= 4; dy++) {
      for (var dx = -4; dx <= 4; dx++) {
        var dist = Math.max(Math.abs(dx), Math.abs(dy));
        this.setFn(cx + dx, cy + dy, dist !== 2 && dist !== 4);
      }
    }
  };

  Matrix.prototype.drawAlignment = function (cx, cy) {
    for (var dy = -2; dy <= 2; dy++) {
      for (var dx = -2; dx <= 2; dx++) {
        this.setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  };

  Matrix.prototype.drawFormatBits = function (eccOrd, mask) {
    var data = (ECC[ECC_ORDER[eccOrd]].fmt << 3) | mask;
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412;
    var size = this.size;
    var bit = function (n) { return ((bits >>> n) & 1) !== 0; };

    for (i = 0; i <= 5; i++) this.setFn(8, i, bit(i));
    this.setFn(8, 7, bit(6));
    this.setFn(8, 8, bit(7));
    this.setFn(7, 8, bit(8));
    for (i = 9; i < 15; i++) this.setFn(14 - i, 8, bit(i));

    for (i = 0; i < 8; i++) this.setFn(size - 1 - i, 8, bit(i));
    for (i = 8; i < 15; i++) this.setFn(8, size - 15 + i, bit(i));
    this.setFn(8, size - 8, true);   // the always-dark module
  };

  Matrix.prototype.drawVersionBits = function () {
    if (this.ver < 7) return;
    var rem = this.ver;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    var bits = (this.ver << 12) | rem;
    for (i = 0; i < 18; i++) {
      var dark = ((bits >>> i) & 1) !== 0;
      var a = this.size - 11 + i % 3;
      var b = Math.floor(i / 3);
      this.setFn(a, b, dark);
      this.setFn(b, a, dark);
    }
  };

  Matrix.prototype.drawCodewords = function (data) {
    var size = this.size;
    var i = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vert : vert;
          if (!this.isFn[y][x] && i < data.length * 8) {
            this.modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
            i++;
          }
        }
      }
    }
  };

  Matrix.prototype.applyMask = function (mask) {
    for (var y = 0; y < this.size; y++) {
      for (var x = 0; x < this.size; x++) {
        if (this.isFn[y][x]) continue;
        var invert;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = (x * y) % 2 + (x * y) % 3 === 0; break;
          case 6: invert = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
          case 7: invert = ((x + y) % 2 + (x * y) % 3) % 2 === 0; break;
          default: throw new Error('bad mask');
        }
        if (invert) this.modules[y][x] = !this.modules[y][x];
      }
    }
  };

  /* ---------------------------------------------------------- penalty */

  var N1 = 3, N2 = 3, N3 = 40, N4 = 10;

  Matrix.prototype.penalty = function () {
    var size = this.size, m = this.modules;
    var result = 0, x, y;

    for (y = 0; y < size; y++) {
      var runColor = false, runLen = 0, history = [0, 0, 0, 0, 0, 0, 0];
      for (x = 0; x < size; x++) {
        if (m[y][x] === runColor) {
          runLen++;
          if (runLen === 5) result += N1;
          else if (runLen > 5) result++;
        } else {
          addHistory(runLen, history, size);
          if (!runColor) result += countFinderLike(history) * N3;
          runColor = m[y][x];
          runLen = 1;
        }
      }
      result += terminateAndCount(runColor, runLen, history, size) * N3;
    }

    for (x = 0; x < size; x++) {
      var cColor = false, cLen = 0, cHistory = [0, 0, 0, 0, 0, 0, 0];
      for (y = 0; y < size; y++) {
        if (m[y][x] === cColor) {
          cLen++;
          if (cLen === 5) result += N1;
          else if (cLen > 5) result++;
        } else {
          addHistory(cLen, cHistory, size);
          if (!cColor) result += countFinderLike(cHistory) * N3;
          cColor = m[y][x];
          cLen = 1;
        }
      }
      result += terminateAndCount(cColor, cLen, cHistory, size) * N3;
    }

    for (y = 0; y < size - 1; y++) {
      for (x = 0; x < size - 1; x++) {
        var c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) result += N2;
      }
    }

    var dark = 0;
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (m[y][x]) dark++;
    var total = size * size;
    var k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * N4;

    return result;
  };

  function addHistory(runLen, history, size) {
    if (history[0] === 0) runLen += size;   // count the light border before the first run
    history.pop();
    history.unshift(runLen);
  }

  function terminateAndCount(color, runLen, history, size) {
    if (color) { addHistory(runLen, history, size); runLen = 0; }
    runLen += size;
    addHistory(runLen, history, size);
    return countFinderLike(history);
  }

  function countFinderLike(h) {
    var n = h[1];
    var core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
    return (core && h[0] >= n * 4 && h[6] >= n ? 1 : 0) + (core && h[6] >= n * 4 && h[0] >= n ? 1 : 0);
  }

  /* ---------------------------------------------------------- api */

  /**
   * @param {string} text
   * @param {{ecc?:'L'|'M'|'Q'|'H', minVersion?:number, boost?:boolean}} [opts]
   * @returns {{modules:boolean[][], size:number, version:number, ecc:string, mode:string, mask:number}}
   */
  function encode(text, opts) {
    opts = opts || {};
    text = String(text == null ? '' : text);
    var wantEcc = ECC[opts.ecc] ? opts.ecc : 'M';
    var eccOrd = ECC[wantEcc].ord;
    var minVersion = Math.max(1, Math.min(40, opts.minVersion || 1));

    var seg = makeSegment(text);

    var ver = 0;
    for (var v = minVersion; v <= 40; v++) {
      if (segBitLength(seg, v) <= numDataCodewords(v, eccOrd) * 8) { ver = v; break; }
    }
    if (!ver) throw new Error('Data is too long for a QR code (max ~2953 bytes at ECC L).');

    // Spend leftover capacity on stronger error correction, which is free.
    if (opts.boost !== false) {
      for (var better = eccOrd + 1; better <= 3; better++) {
        if (segBitLength(seg, ver) <= numDataCodewords(ver, better) * 8) eccOrd = better;
        else break;
      }
    }

    var data = addEccAndInterleave(buildCodewords(seg, ver, eccOrd), ver, eccOrd);

    var matrix = new Matrix(ver);
    matrix.drawFunctionPatterns(eccOrd);
    matrix.drawCodewords(data);

    var bestMask = 0, bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      matrix.applyMask(mask);
      matrix.drawFormatBits(eccOrd, mask);
      var score = matrix.penalty();
      if (score < bestScore) { bestScore = score; bestMask = mask; }
      matrix.applyMask(mask);   // masking is its own inverse
    }
    matrix.applyMask(bestMask);
    matrix.drawFormatBits(eccOrd, bestMask);

    return {
      modules: matrix.modules,
      size: matrix.size,
      version: ver,
      ecc: ECC_ORDER[eccOrd],
      mode: seg.mode,
      mask: bestMask
    };
  }

  /** Renders an encode() result to a standalone SVG string. */
  function toSvg(qr, opts) {
    opts = opts || {};
    var quiet = opts.quiet === undefined ? 4 : opts.quiet;
    var dark = opts.dark || '#000000';
    var light = opts.light || '#ffffff';
    var dim = qr.size + quiet * 2;
    var path = [];

    for (var y = 0; y < qr.size; y++) {
      for (var x = 0; x < qr.size; x++) {
        if (qr.modules[y][x]) path.push('M' + (x + quiet) + ' ' + (y + quiet) + 'h1v1h-1z');
      }
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim +
      '" shape-rendering="crispEdges" width="' + dim * (opts.scale || 8) + '" height="' + dim * (opts.scale || 8) + '">' +
      (light === 'none' ? '' : '<rect width="' + dim + '" height="' + dim + '" fill="' + light + '"/>') +
      '<path fill="' + dark + '" d="' + path.join('') + '"/></svg>';
  }

  /** Draws an encode() result onto a canvas element. */
  function toCanvas(qr, canvas, opts) {
    opts = opts || {};
    var quiet = opts.quiet === undefined ? 4 : opts.quiet;
    var scale = opts.scale || 8;
    var dim = (qr.size + quiet * 2) * scale;
    canvas.width = dim;
    canvas.height = dim;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = opts.light || '#ffffff';
    ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = opts.dark || '#000000';
    for (var y = 0; y < qr.size; y++) {
      for (var x = 0; x < qr.size; x++) {
        if (qr.modules[y][x]) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
      }
    }
    return canvas;
  }

  window.DevBox = window.DevBox || {};
  window.DevBox.qr = { encode: encode, toSvg: toSvg, toCanvas: toCanvas, capacity: numDataCodewords };
})();
