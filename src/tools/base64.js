/* Base64 for text and files, including data URIs. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  DevBox.register({
    id: 'base64',
    icon: '64',
    category: 'data',
    keywords: 'base64 encode decode data uri file binary atob btoa url safe',
    name: { en: 'Base64', uz: 'Base64', ru: 'Base64' },
    desc: {
      en: 'Encode and decode Base64 — UTF-8 text, URL-safe variants, and files turned into data URIs.',
      uz: 'Base64 kodlash va dekodlash — UTF-8 matn, URL uchun xavfsiz koʻrinish va fayllardan data URI.',
      ru: 'Кодирование и декодирование Base64: текст UTF-8, URL-safe вариант и файлы в виде data URI.'
    },

    mount: function (root, ctx) {
      /* ------------------------------------------------ text */

      var urlSafe = ui.checkbox('URL-safe alphabet (-_ instead of +/)', ctx.store.get('urlSafe', false), sync);
      var plain = ui.textarea({ placeholder: 'Plain text', value: ctx.store.get('plain', '') });
      var encoded = ui.textarea({ placeholder: 'Base64' });
      var note = h('div');

      function encode() {
        ui.clear(note);
        try {
          var b64 = ui.b64Encode(ui.utf8Bytes(plain.value));
          encoded.value = urlSafe.checked ? ui.b64ToB64Url(b64) : b64;
          ctx.store.set('plain', plain.value.slice(0, 50000));
        } catch (err) {
          note.appendChild(ui.banner('err', err.message));
        }
      }

      function decode() {
        ui.clear(note);
        var text = encoded.value.trim();
        if (!text) { plain.value = ''; return; }
        try {
          var bytes = ui.b64Decode(ui.b64UrlToB64(text));
          plain.value = ui.bytesToUtf8(bytes);
          note.appendChild(ui.banner('ok', 'Decoded ' + ui.bytes(bytes.length) + ' of data.'));
        } catch (err) {
          note.appendChild(ui.banner('err', 'Not valid Base64: ' + err.message));
        }
      }

      function sync() {
        ctx.store.set('urlSafe', urlSafe.checked);
        if (plain.value) encode();
      }

      var textCard = ui.card('Text');
      textCard.body.appendChild(h('div.grid2',
        h('div', h('label.lbl', { text: 'PLAIN TEXT' }), plain),
        h('div', h('label.lbl', { text: 'BASE64' }), encoded)
      ));
      textCard.body.appendChild(h('div.row.mt12',
        ui.btn('Encode ↓', encode, 'primary'),
        ui.btn('Decode ↑', decode),
        urlSafe,
        h('div.spacer'),
        ui.btn('Copy Base64', function () { ui.copy(encoded.value); }, 'ghost'),
        ui.btn('Copy text', function () { ui.copy(plain.value); }, 'ghost'),
        ui.btn('Swap', function () {
          var tmp = plain.value; plain.value = encoded.value; encoded.value = tmp;
        }, 'ghost')
      ));
      textCard.body.appendChild(note);

      /* ------------------------------------------------ files */

      var fileOut = ui.output({ title: 'File as Base64', download: 'encoded.txt' });
      var fileInfo = h('div');
      var lastFile = null;

      function readFile(file) {
        lastFile = file;
        var reader = new FileReader();
        reader.onload = function () {
          var bytes = new Uint8Array(reader.result);
          var b64 = ui.b64Encode(bytes);
          var mime = file.type || 'application/octet-stream';
          fileOut.set(asDataUri.checked ? 'data:' + mime + ';base64,' + b64 : b64);
          ui.clear(fileInfo).appendChild(h('div.stat-row',
            ui.stat(ui.bytes(file.size), 'file size'),
            ui.stat(ui.bytes(b64.length), 'base64 size'),
            ui.stat(mime.split('/')[1] || mime, 'type')
          ));
        };
        reader.onerror = function () { fileOut.set('Could not read that file.', 'err'); };
        reader.readAsArrayBuffer(file);
      }

      var zone = ui.dropzone('Drop a file here, or click to choose — it is read locally and never uploaded', readFile);

      var asDataUri = ui.checkbox('Wrap as a data: URI', ctx.store.get('dataUri', true), function () {
        ctx.store.set('dataUri', asDataUri.checked);
        if (lastFile) readFile(lastFile);
      });

      var fileCard = ui.card('File → Base64', zone, h('div.row.mt12', asDataUri), fileInfo);

      /* ------------------------------------------------ data URI back to a file */

      var uriInput = ui.textarea({ short: true, placeholder: 'data:image/png;base64,iVBORw0…' });
      var uriPreview = h('div');

      var decodeCard = ui.card('Data URI → file',
        uriInput,
        h('div.row.mt12',
          ui.btn('Save as file', function () {
            try {
              var parsed = parseDataUri(uriInput.value.trim());
              ui.download(suggestName(parsed.mime), new Blob([parsed.bytes], { type: parsed.mime }));
            } catch (err) { ui.toast(err.message, 'err'); }
          }, 'primary'),
          ui.btn('Preview image', function () {
            ui.clear(uriPreview);
            try {
              var parsed = parseDataUri(uriInput.value.trim());
              if (parsed.mime.indexOf('image/') !== 0) throw new Error('That data URI is not an image.');
              uriPreview.appendChild(h('img', {
                src: uriInput.value.trim(),
                style: { maxWidth: '100%', marginTop: '12px', borderRadius: '8px', border: '1px solid var(--border)' }
              }));
            } catch (err) { uriPreview.appendChild(ui.banner('err', err.message)); }
          })
        ),
        uriPreview
      );

      root.appendChild(textCard);
      root.appendChild(fileCard);
      root.appendChild(fileOut);
      root.appendChild(decodeCard);

      plain.addEventListener('input', ui.debounce(encode, 250));
      encoded.addEventListener('input', ui.debounce(function () {
        if (document.activeElement === encoded) decode();
      }, 300));

      if (plain.value) encode();
    }
  });

  function parseDataUri(text) {
    var m = /^data:([^;,]*)(;charset=[^;,]*)?(;base64)?,([\s\S]*)$/i.exec(text);
    if (!m) throw new Error('That does not look like a data: URI.');
    var mime = m[1] || 'application/octet-stream';
    var body = m[4];
    var bytes = m[3]
      ? DevBox.ui.b64Decode(DevBox.ui.b64UrlToB64(body))
      : DevBox.ui.utf8Bytes(decodeURIComponent(body));
    return { mime: mime, bytes: bytes };
  }

  function suggestName(mime) {
    var ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
      'image/svg+xml': 'svg', 'application/pdf': 'pdf', 'text/plain': 'txt', 'application/json': 'json' }[mime];
    return 'decoded.' + (ext || (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, ''));
  }
})();
