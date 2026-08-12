/* Hashes and HMACs for text and files. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  var ALGOS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

  DevBox.register({
    id: 'hash',
    icon: '#',
    category: 'security',
    keywords: 'hash md5 sha1 sha256 sha512 checksum hmac digest fingerprint verify file',
    name: { en: 'Hash & HMAC', uz: 'Xesh va HMAC', ru: 'Хеши и HMAC' },
    desc: {
      en: 'MD5, SHA-1 and SHA-2 digests for text or a whole file, plus keyed HMACs and a constant-time comparison.',
      uz: 'Matn yoki butun fayl uchun MD5, SHA-1 va SHA-2 xeshlari, kalitli HMAC va xeshni solishtirish.',
      ru: 'Дайджесты MD5, SHA-1 и SHA-2 для текста или файла, HMAC с ключом и сверка контрольной суммы.'
    },

    mount: function (root, ctx) {
      if (!window.crypto || !crypto.subtle) {
        root.appendChild(ui.banner('warn',
          'This browser exposes no Web Crypto API here, so only MD5 is available. Serving the page over http://localhost or https:// restores the SHA family.'));
      }

      /* ------------------------------------------------ text */

      var input = ui.textarea({ placeholder: 'Text to hash', value: ctx.store.get('input', '') });
      var upper = ui.checkbox('Uppercase', ctx.store.get('upper', false), function () {
        ctx.store.set('upper', upper.checked);
        hashText();
      });
      var results = h('div');

      function hashText() {
        ctx.store.set('input', input.value.slice(0, 50000));
        var bytes = ui.utf8Bytes(input.value);
        render(results, bytes, input.value === '' ? 'Hashes of the empty string:' : null);
      }

      function render(host, bytes, note) {
        ui.clear(host);
        if (note) host.appendChild(h('div.note', { text: note, style: { marginBottom: '8px' } }));
        var list = h('dl.kv');
        host.appendChild(list);

        ALGOS.forEach(function (algo) {
          var dt = h('dt', { text: algo });
          var dd = h('dd', { text: '…' });
          dd.style.cursor = 'pointer';
          dd.title = 'Click to copy';
          dd.addEventListener('click', function () { ui.copy(dd.textContent); });
          list.appendChild(dt);
          list.appendChild(dd);

          digest(algo, bytes).then(function (hex) {
            dd.textContent = upper.checked ? hex.toUpperCase() : hex;
          }, function (err) {
            dd.textContent = 'unavailable (' + err.message + ')';
            dd.style.color = 'var(--text-faint)';
          });
        });
      }

      /* ------------------------------------------------ file */

      var fileResults = h('div');
      var fileZone = ui.dropzone('Drop a file to checksum it — the bytes never leave your machine', function (file) {
        var reader = new FileReader();
        ui.clear(fileResults).appendChild(h('div.note', { text: 'Reading ' + file.name + ' (' + ui.bytes(file.size) + ')…' }));
        reader.onload = function () {
          var bytes = new Uint8Array(reader.result);
          ui.clear(fileResults);
          fileResults.appendChild(h('div.row.mt8',
            ui.chip(file.name), ui.chip(ui.bytes(file.size)), ui.chip(file.type || 'unknown type')));
          var host = h('div.mt12');
          fileResults.appendChild(host);
          render(host, bytes);
        };
        reader.onerror = function () { ui.clear(fileResults).appendChild(ui.banner('err', 'Could not read that file.')); };
        reader.readAsArrayBuffer(file);
      });

      /* ------------------------------------------------ hmac */

      var hmacMsg = ui.textarea({ short: true, placeholder: 'Message' });
      var hmacKey = ui.input({ placeholder: 'Secret key' });
      var hmacAlgo = ui.select({ options: [['SHA-256', 'HMAC-SHA-256'], ['SHA-1', 'HMAC-SHA-1'], ['SHA-384', 'HMAC-SHA-384'], ['SHA-512', 'HMAC-SHA-512']], value: 'SHA-256' });
      var hmacOut = ui.output({ title: 'HMAC' });

      function computeHmac() {
        if (!crypto.subtle) return hmacOut.set('Web Crypto is unavailable in this context.', 'err');
        if (!hmacKey.value) return hmacOut.set('');
        crypto.subtle.importKey('raw', ui.utf8Bytes(hmacKey.value), { name: 'HMAC', hash: hmacAlgo.value }, false, ['sign'])
          .then(function (key) { return crypto.subtle.sign('HMAC', key, ui.utf8Bytes(hmacMsg.value)); })
          .then(function (sig) {
            var hex = ui.toHex(sig);
            hmacOut.set(hex + '\n\nbase64: ' + ui.b64Encode(new Uint8Array(sig)));
          })
          .catch(function (err) { hmacOut.set(err.message, 'err'); });
      }

      /* ------------------------------------------------ compare */

      var expected = ui.input({ placeholder: 'Paste the expected checksum' });
      var actual = ui.input({ placeholder: 'Paste the computed checksum' });
      var compareOut = h('div');

      function compare() {
        ui.clear(compareOut);
        var a = expected.value.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
        var b = actual.value.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
        if (!a || !b) return;
        // Constant-time-ish: always walk both strings fully.
        var same = a.length === b.length;
        var diff = 0;
        for (var i = 0; i < Math.max(a.length, b.length); i++) {
          if (a.charCodeAt(i) !== b.charCodeAt(i)) diff++;
        }
        same = same && diff === 0;
        compareOut.appendChild(same
          ? ui.banner('ok', 'The two checksums match.')
          : ui.banner('err', 'They do not match — ' + diff + ' character' + (diff === 1 ? '' : 's') + ' differ.'));
      }

      /* ------------------------------------------------ layout */

      root.appendChild(ui.card('Text', input, h('div.row.mt12', upper), h('div.mt12', results)));
      root.appendChild(ui.card('File checksum', fileZone, fileResults));
      root.appendChild(ui.card('HMAC', h('div.grid2', hmacKey, hmacAlgo), h('div.mt12', hmacMsg),
        h('div.row.mt12', ui.btn('Compute HMAC', computeHmac, 'primary')), h('div.mt12', hmacOut)));
      root.appendChild(ui.card('Compare two checksums', h('div.grid2', expected, actual), h('div.mt12', compareOut)));

      input.addEventListener('input', ui.debounce(hashText, 250));
      [expected, actual].forEach(function (f) { f.control.addEventListener('input', ui.debounce(compare, 200)); });
      hmacMsg.addEventListener('input', ui.debounce(computeHmac, 300));
      hmacKey.control.addEventListener('input', ui.debounce(computeHmac, 300));
      hmacAlgo.addEventListener('change', computeHmac);

      hashText();
    }
  });

  function digest(algo, bytes) {
    if (algo === 'MD5') {
      try { return Promise.resolve(ui.toHex(DevBox.md5(bytes))); }
      catch (err) { return Promise.reject(err); }
    }
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('Web Crypto unavailable'));
    return crypto.subtle.digest(algo, bytes).then(function (buf) { return ui.toHex(buf); });
  }
})();
