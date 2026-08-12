/* Identifier generation: UUID v4/v7, ULID, NanoID and raw randomness. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  var NANOID_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
  var CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

  DevBox.register({
    id: 'uuid',
    icon: 'ID',
    category: 'security',
    keywords: 'uuid guid v4 v7 ulid nanoid random id generate identifier unique',
    name: { en: 'ID Generator', uz: 'ID generator', ru: 'Генератор ID' },
    desc: {
      en: 'Generate UUID v4 and v7, ULIDs, NanoIDs and random hex — all from the browser’s cryptographic RNG.',
      uz: 'UUID v4 va v7, ULID, NanoID va tasodifiy hex hosil qiling — brauzerning kriptografik tasodif manbasidan.',
      ru: 'Генерация UUID v4 и v7, ULID, NanoID и случайного hex на основе криптографического ГСЧ браузера.'
    },

    mount: function (root, ctx) {
      var kind = ui.select({
        options: [
          ['uuid4', 'UUID v4 — random'],
          ['uuid7', 'UUID v7 — time-ordered'],
          ['ulid', 'ULID — sortable, 26 chars'],
          ['nanoid', 'NanoID — 21 chars, URL-safe'],
          ['hex', 'Random hex'],
          ['bytes', 'Random base64']
        ],
        value: ctx.store.get('kind', 'uuid4'),
        label: 'FORMAT'
      });

      var count = ui.input({ type: 'number', value: ctx.store.get('count', 5), min: 1, max: 1000, label: 'HOW MANY' });
      var size = ui.input({ type: 'number', value: ctx.store.get('size', 16), min: 1, max: 256, label: 'BYTES (hex / base64 only)' });
      var uppercase = ui.checkbox('Uppercase', false, generate);
      var braces = ui.checkbox('Wrap in { } braces', false, generate);
      var hyphens = ui.checkbox('Keep hyphens', true, generate);

      var out = ui.output({ title: 'Generated', download: 'ids.txt' });
      var explain = h('div');

      var DESCRIPTIONS = {
        uuid4: 'Version 4 UUIDs are 122 bits of randomness. Collision risk is negligible, but they sort arbitrarily, which fragments database indexes.',
        uuid7: 'Version 7 UUIDs put a 48-bit Unix millisecond timestamp first, so they sort by creation time — much friendlier to B-tree indexes than v4.',
        ulid: 'ULIDs pack a 48-bit timestamp and 80 random bits into 26 Crockford base32 characters: lexicographically sortable and case-insensitive.',
        nanoid: 'NanoIDs are 21 URL-safe characters (~126 bits). Shorter than a UUID with comparable collision resistance.',
        hex: 'Raw random bytes rendered as hexadecimal — useful for API keys, salts and session tokens.',
        bytes: 'Raw random bytes rendered as base64 — compact for secrets stored in environment variables.'
      };

      function generate() {
        ctx.store.set('kind', kind.value);
        ctx.store.set('count', count.value);
        ctx.store.set('size', size.value);

        var n = clamp(Number(count.value) || 1, 1, 1000);
        var byteLen = clamp(Number(size.value) || 16, 1, 256);
        var lines = [];

        for (var i = 0; i < n; i++) {
          var value;
          switch (kind.value) {
            case 'uuid4': value = uuidV4(); break;
            case 'uuid7': value = uuidV7(); break;
            case 'ulid': value = ulid(); break;
            case 'nanoid': value = nanoid(21); break;
            case 'hex': value = ui.toHex(randomBytes(byteLen)); break;
            default: value = ui.b64Encode(randomBytes(byteLen));
          }
          if (/^uuid/.test(kind.value)) {
            if (!hyphens.checked) value = value.replace(/-/g, '');
            if (braces.checked) value = '{' + value + '}';
          }
          if (uppercase.checked && kind.value !== 'nanoid' && kind.value !== 'bytes') value = value.toUpperCase();
          lines.push(value);
        }

        out.set(lines.join('\n'));
        ui.clear(explain).appendChild(h('div.note', { text: DESCRIPTIONS[kind.value] }));
      }

      /* ------------------------------------------------ inspector */

      var inspectInput = ui.input({ placeholder: 'Paste a UUID or ULID to inspect it' });
      var inspectOut = h('div');

      function inspect() {
        ui.clear(inspectOut);
        var text = inspectInput.value.trim().replace(/[{}]/g, '');
        if (!text) return;

        var uuidMatch = /^([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})$/i.exec(text);
        if (uuidMatch) {
          var hex = uuidMatch.slice(1).join('').toLowerCase();
          var version = parseInt(hex[12], 16);
          var variantNibble = parseInt(hex[16], 16);
          var variant = variantNibble >= 8 && variantNibble <= 11 ? 'RFC 4122' :
                        variantNibble >= 12 && variantNibble <= 13 ? 'Microsoft' :
                        variantNibble >= 14 ? 'reserved' : 'NCS (legacy)';

          var rows = [['Version', version], ['Variant', variant], ['Hex', hex]];
          if (version === 7) {
            var ms = parseInt(hex.slice(0, 12), 16);
            rows.push(['Timestamp', new Date(ms).toISOString()]);
          } else if (version === 1) {
            var timeLow = BigInt('0x' + hex.slice(0, 8));
            var timeMid = BigInt('0x' + hex.slice(8, 12));
            var timeHigh = BigInt('0x' + hex.slice(13, 16));
            var ticks = (timeHigh << 48n) | (timeMid << 32n) | timeLow;
            rows.push(['Timestamp', new Date(Number(ticks / 10000n - 12219292800000n)).toISOString()]);
          }
          return showRows(rows);
        }

        if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(text)) {
          var ms2 = 0;
          text.toUpperCase().slice(0, 10).split('').forEach(function (c) { ms2 = ms2 * 32 + CROCKFORD.indexOf(c); });
          return showRows([['Format', 'ULID'], ['Timestamp', new Date(ms2).toISOString()], ['Randomness', text.slice(10)]]);
        }

        inspectOut.appendChild(ui.banner('warn', 'That is neither a UUID nor a ULID.'));

        function showRows(rows) {
          var list = h('dl.kv');
          rows.forEach(function (row) {
            list.appendChild(h('dt', { text: row[0] }));
            list.appendChild(h('dd', { text: String(row[1]) }));
          });
          inspectOut.appendChild(list);
        }
      }

      root.appendChild(ui.card('Generate',
        h('div.grid3', kind, count, size),
        h('div.row.mt12', ui.btn('Generate', generate, 'primary'), uppercase, braces, hyphens),
        h('div.mt12', explain)
      ));
      root.appendChild(out);
      root.appendChild(ui.card('Inspect an existing ID', inspectInput, h('div.mt12', inspectOut)));

      kind.addEventListener('change', generate);
      count.control.addEventListener('input', ui.debounce(generate, 250));
      size.control.addEventListener('input', ui.debounce(generate, 250));
      inspectInput.control.addEventListener('input', ui.debounce(inspect, 200));
      generate();
    }
  });

  /* ---------------------------------------------------------- generators */

  function randomBytes(n) {
    var bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  function uuidV4() {
    if (crypto.randomUUID) return crypto.randomUUID();
    var b = randomBytes(16);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    return format(b);
  }

  function uuidV7() {
    var b = randomBytes(16);
    var ms = Date.now();
    // 48-bit big-endian millisecond timestamp, then version and variant bits.
    b[0] = (ms / 1099511627776) & 0xff;
    b[1] = (ms / 4294967296) & 0xff;
    b[2] = (ms / 16777216) & 0xff;
    b[3] = (ms / 65536) & 0xff;
    b[4] = (ms / 256) & 0xff;
    b[5] = ms & 0xff;
    b[6] = (b[6] & 0x0f) | 0x70;
    b[8] = (b[8] & 0x3f) | 0x80;
    return format(b);
  }

  function format(b) {
    var hex = DevBox.ui.toHex(b);
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }

  function ulid() {
    var ms = Date.now();
    var time = '';
    for (var i = 9; i >= 0; i--) {
      time = CROCKFORD[ms % 32] + time;
      ms = Math.floor(ms / 32);
    }
    var bytes = randomBytes(16);
    var random = '';
    for (var j = 0; j < 16; j++) random += CROCKFORD[bytes[j] % 32];
    return time + random;
  }

  function nanoid(length) {
    var bytes = randomBytes(length);
    var out = '';
    for (var i = 0; i < length; i++) out += NANOID_ALPHABET[bytes[i] & 63];
    return out;
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
})();
