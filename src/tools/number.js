/* Number bases, bitwise arithmetic and byte sizes. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  var DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

  DevBox.register({
    id: 'number',
    icon: '10',
    category: 'data',
    keywords: 'number base binary hex octal decimal radix bitwise shift bytes kb mib convert',
    name: { en: 'Number & Bits', uz: 'Sonlar va bitlar', ru: 'Числа и биты' },
    desc: {
      en: 'Convert between number bases with arbitrary precision, run bitwise operations, and translate byte sizes.',
      uz: 'Cheksiz aniqlikda sanoq sistemalarini oʻgirish, bit amallari va bayt oʻlchamlarini hisoblash.',
      ru: 'Перевод между системами счисления с произвольной точностью, побитовые операции и размеры в байтах.'
    },

    mount: function (root, ctx) {
      /* ------------------------------------------------ base converter */

      var fields = {};
      var bases = [[2, 'Binary'], [8, 'Octal'], [10, 'Decimal'], [16, 'Hexadecimal']];
      var grid = h('div.grid2');
      var baseError = h('div');

      bases.forEach(function (pair) {
        var box = ui.input({ placeholder: 'base ' + pair[0], label: pair[1].toUpperCase() + ' (base ' + pair[0] + ')' });
        fields[pair[0]] = box;
        box.control.addEventListener('input', function () { sync(pair[0]); });
        grid.appendChild(box);
      });

      var customBase = ui.input({ type: 'number', value: ctx.store.get('customBase', 36), min: 2, max: 36, label: 'CUSTOM BASE (2–36)' });
      var customValue = ui.input({ label: 'VALUE IN THAT BASE' });
      customValue.control.addEventListener('input', function () { sync('custom'); });
      customBase.control.addEventListener('input', function () {
        ctx.store.set('customBase', customBase.value);
        sync(10);
      });

      var bitView = h('div.out.empty', { text: 'Enter a number to see its bit layout.' });

      function sync(source) {
        ui.clear(baseError);
        var base = source === 'custom' ? Number(customBase.value) : source;
        var text = source === 'custom' ? customValue.value : fields[source].value;

        if (!String(text).trim()) {
          bases.forEach(function (pair) { if (pair[0] !== source) fields[pair[0]].value = ''; });
          if (source !== 'custom') customValue.value = '';
          renderBits(null);
          return;
        }

        if (!(base >= 2 && base <= 36)) {
          baseError.appendChild(ui.banner('err', 'Custom base must be between 2 and 36.'));
          return;
        }

        var value = parseBase(text, base);
        if (value === null) {
          baseError.appendChild(ui.banner('err', '“' + text + '” is not a valid base-' + base + ' number.'));
          return;
        }

        bases.forEach(function (pair) {
          if (pair[0] !== source) fields[pair[0]].value = toBase(value, pair[0]);
        });
        if (source !== 'custom') customValue.value = toBase(value, Number(customBase.value) || 36);
        renderBits(value);
      }

      function renderBits(value) {
        if (value === null || value < 0n) {
          bitView.textContent = value === null ? 'Enter a number to see its bit layout.' : 'Bit layout is shown for non-negative values.';
          bitView.classList.add('empty');
          return;
        }
        bitView.classList.remove('empty');
        var bin = value.toString(2);
        var width = bin.length <= 8 ? 8 : bin.length <= 16 ? 16 : bin.length <= 32 ? 32 : bin.length <= 64 ? 64 : Math.ceil(bin.length / 8) * 8;
        var padded = bin.padStart(width, '0');
        var groups = padded.match(/.{1,8}/g) || [];
        var lines = ['bits  ' + width, ''];
        groups.forEach(function (group, i) {
          var high = width - i * 8 - 1;
          lines.push(String(high).padStart(3) + '..' + String(high - 7).padStart(2) + '   ' + group.replace(/(.{4})(?=.)/g, '$1 '));
        });
        bitView.textContent = lines.join('\n');
      }

      /* ------------------------------------------------ bitwise */

      var opA = ui.input({ value: '0xF0', label: 'A' });
      var opB = ui.input({ value: '0x0F', label: 'B' });
      var width = ui.select({ options: [['8', '8-bit'], ['16', '16-bit'], ['32', '32-bit'], ['64', '64-bit']], value: ctx.store.get('width', '32'), label: 'WIDTH' });
      var bitOut = h('div.tbl-scroll');

      function bitwise() {
        ctx.store.set('width', width.value);
        ui.clear(bitOut);

        var a = parseAuto(opA.value);
        var b = parseAuto(opB.value);
        if (a === null || b === null) {
          bitOut.appendChild(h('div', { style: { padding: '10px' } }, ui.banner('err', 'Enter two integers. Prefix with 0x, 0b or 0o to pick a base.')));
          return;
        }

        var bits = BigInt(width.value);
        var mask = (1n << bits) - 1n;
        var wrap = function (v) { return ((v % (mask + 1n)) + mask + 1n) & mask; };

        var rows = [
          ['A', wrap(a)],
          ['B', wrap(b)],
          ['A & B', wrap(a & b)],
          ['A | B', wrap(a | b)],
          ['A ^ B', wrap(a ^ b)],
          ['~A', wrap(~a)],
          ['A << 1', wrap(a << 1n)],
          ['A >> 1', wrap(a >> 1n)],
          ['A + B', wrap(a + b)],
          ['A - B', wrap(a - b)]
        ];

        bitOut.appendChild(h('table.tbl',
          h('thead', h('tr', h('th', 'Expression'), h('th', 'Decimal'), h('th', 'Hex'), h('th', 'Binary'))),
          h('tbody', rows.map(function (row) {
            return h('tr',
              h('td.mono', { text: row[0] }),
              h('td.mono', { text: row[1].toString(10) }),
              h('td.mono', { text: '0x' + row[1].toString(16).toUpperCase().padStart(Number(width.value) / 4, '0') }),
              h('td.mono', { text: row[1].toString(2).padStart(Number(width.value), '0').replace(/(.{8})(?=.)/g, '$1 ') })
            );
          }))
        ));
      }

      /* ------------------------------------------------ byte sizes */

      var sizeInput = ui.input({ value: '1536', label: 'AMOUNT' });
      var sizeUnit = ui.select({
        options: [['1', 'bytes'], ['1024', 'KiB'], ['1048576', 'MiB'], ['1073741824', 'GiB'],
                  ['1000', 'kB'], ['1000000', 'MB'], ['1000000000', 'GB']],
        value: '1', label: 'UNIT'
      });
      var sizeOut = h('dl.kv');

      function sizes() {
        ui.clear(sizeOut);
        var amount = Number(sizeInput.value);
        if (!isFinite(amount)) { sizeOut.appendChild(h('dt', { text: 'Error' })); sizeOut.appendChild(h('dd', { text: 'Not a number' })); return; }
        var bytes = amount * Number(sizeUnit.value);
        [
          ['Bytes', bytes.toLocaleString('en-US')],
          ['KiB (1024)', (bytes / 1024).toLocaleString('en-US', { maximumFractionDigits: 4 })],
          ['MiB', (bytes / 1048576).toLocaleString('en-US', { maximumFractionDigits: 6 })],
          ['GiB', (bytes / 1073741824).toLocaleString('en-US', { maximumFractionDigits: 6 })],
          ['kB (1000)', (bytes / 1000).toLocaleString('en-US', { maximumFractionDigits: 4 })],
          ['MB', (bytes / 1e6).toLocaleString('en-US', { maximumFractionDigits: 6 })],
          ['GB', (bytes / 1e9).toLocaleString('en-US', { maximumFractionDigits: 6 })],
          ['Bits', (bytes * 8).toLocaleString('en-US')]
        ].forEach(function (row) {
          sizeOut.appendChild(h('dt', { text: row[0] }));
          sizeOut.appendChild(h('dd', { text: row[1] }));
        });
      }

      /* ------------------------------------------------ layout */

      var baseCard = ui.card('Base converter', grid, h('div.grid2.mt12', customBase, customValue), baseError, h('div.mt12', bitView));
      var bitCard = ui.card('Bitwise operations', h('div.grid3', opA, opB, width), h('div.mt12', bitOut));
      bitCard.body.appendChild(h('div.note.mt8', { text: 'Results are shown wrapped to the selected width, the way they would land in a fixed-size integer.' }));
      var sizeCard = ui.card('Byte sizes', h('div.grid2', sizeInput, sizeUnit), h('div.mt12', sizeOut));

      root.appendChild(baseCard);
      root.appendChild(bitCard);
      root.appendChild(sizeCard);

      [opA, opB].forEach(function (f) { f.control.addEventListener('input', ui.debounce(bitwise, 200)); });
      width.addEventListener('change', bitwise);
      sizeInput.control.addEventListener('input', ui.debounce(sizes, 200));
      sizeUnit.addEventListener('change', sizes);

      fields[10].value = '';
      bitwise();
      sizes();
    }
  });

  /* ---------------------------------------------------------- helpers */

  function parseBase(text, base) {
    var s = String(text).trim().toLowerCase().replace(/[\s_,]/g, '');
    var negative = false;
    if (s[0] === '-') { negative = true; s = s.slice(1); }
    else if (s[0] === '+') s = s.slice(1);
    if (base === 16) s = s.replace(/^0x/, '');
    if (base === 2) s = s.replace(/^0b/, '');
    if (base === 8) s = s.replace(/^0o/, '');
    if (!s) return null;

    var value = 0n, big = BigInt(base);
    for (var i = 0; i < s.length; i++) {
      var digit = DIGITS.indexOf(s[i]);
      if (digit < 0 || digit >= base) return null;
      value = value * big + BigInt(digit);
    }
    return negative ? -value : value;
  }

  /** Accepts 0x / 0b / 0o prefixes, otherwise decimal. */
  function parseAuto(text) {
    var s = String(text).trim().toLowerCase().replace(/[\s_,]/g, '');
    var negative = s[0] === '-';
    if (negative) s = s.slice(1);
    var value;
    if (/^0x[0-9a-f]+$/.test(s)) value = parseBase(s, 16);
    else if (/^0b[01]+$/.test(s)) value = parseBase(s, 2);
    else if (/^0o[0-7]+$/.test(s)) value = parseBase(s, 8);
    else if (/^\d+$/.test(s)) value = parseBase(s, 10);
    else return null;
    if (value === null) return null;
    return negative ? -value : value;
  }

  function toBase(value, base) {
    if (value < 0n) return '-' + (-value).toString(base);
    return value.toString(base);
  }
})();
