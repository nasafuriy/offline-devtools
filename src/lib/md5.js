/* ============================================================
   MD5 (RFC 1321).
   WebCrypto deliberately omits MD5, but legacy checksums still
   need it, so this is a small self-contained implementation.
   MD5 is broken for security — use SHA-256 for anything that matters.
   ============================================================ */
(function () {
  'use strict';

  var S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];

  var K = new Uint32Array(64);
  for (var i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);

  function rotl(x, c) { return (x << c) | (x >>> (32 - c)); }

  /** @param {Uint8Array} input @returns {Uint8Array} 16-byte digest */
  function md5(input) {
    var len = input.length;
    var padded = ((len + 8) >> 6 << 6) + 64;      // multiple of 64, room for 0x80 + length
    var msg = new Uint8Array(padded);
    msg.set(input);
    msg[len] = 0x80;

    var bitLen = len * 8;
    var view = new DataView(msg.buffer);
    view.setUint32(padded - 8, bitLen >>> 0, true);
    view.setUint32(padded - 4, Math.floor(bitLen / 4294967296), true);

    var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    var M = new Uint32Array(16);

    for (var off = 0; off < padded; off += 64) {
      for (var j = 0; j < 16; j++) M[j] = view.getUint32(off + j * 4, true);

      var A = a0, B = b0, C = c0, D = d0;
      for (var k = 0; k < 64; k++) {
        var F, g;
        if (k < 16)      { F = (B & C) | (~B & D);        g = k; }
        else if (k < 32) { F = (D & B) | (~D & C);        g = (5 * k + 1) & 15; }
        else if (k < 48) { F = B ^ C ^ D;                 g = (3 * k + 5) & 15; }
        else             { F = C ^ (B | ~D);              g = (7 * k) & 15; }

        F = (F + A + K[k] + M[g]) | 0;
        A = D; D = C; C = B;
        B = (B + rotl(F, S[k])) | 0;
      }

      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }

    var out = new Uint8Array(16);
    var ov = new DataView(out.buffer);
    ov.setUint32(0, a0 >>> 0, true);
    ov.setUint32(4, b0 >>> 0, true);
    ov.setUint32(8, c0 >>> 0, true);
    ov.setUint32(12, d0 >>> 0, true);
    return out;
  }

  window.DevBox = window.DevBox || {};
  window.DevBox.md5 = md5;
})();
