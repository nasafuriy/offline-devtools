/* Local image resizing and format conversion via canvas. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  DevBox.register({
    id: 'image',
    icon: '🖼',
    category: 'visual',
    keywords: 'image resize convert compress webp png jpeg data uri thumbnail optimise',
    name: { en: 'Image Converter', uz: 'Rasm konvertori', ru: 'Конвертер изображений' },
    desc: {
      en: 'Resize, compress and convert images between PNG, JPEG and WebP without uploading them anywhere.',
      uz: 'Rasmlarni hech qayerga yuklamasdan oʻlchamini oʻzgartiring, siqing va PNG, JPEG, WebP oʻrtasida oʻgiring.',
      ru: 'Изменение размера, сжатие и конвертация изображений между PNG, JPEG и WebP — без загрузки на сервер.'
    },

    mount: function (root, ctx) {
      var source = null;          // HTMLImageElement
      var sourceName = 'image';
      var sourceSize = 0;

      var format = ui.select({ options: [['image/png', 'PNG'], ['image/jpeg', 'JPEG'], ['image/webp', 'WebP']], value: 'image/webp', label: 'FORMAT' });
      var quality = ui.input({ type: 'range', value: 85, min: 1, max: 100, label: 'QUALITY' });
      var qualityLabel = h('b', { text: '85' });
      var widthBox = ui.input({ type: 'number', placeholder: 'auto', label: 'WIDTH (px)' });
      var heightBox = ui.input({ type: 'number', placeholder: 'auto', label: 'HEIGHT (px)' });
      var keepRatio = ui.checkbox('Lock aspect ratio', true);

      var before = h('div');
      var after = h('div');
      var stats = h('div.stat-row');
      var lastBlob = null;

      var zone = ui.dropzone('Drop an image, or click to choose — nothing is uploaded', function (file) {
        if (!/^image\//.test(file.type)) return ui.toast('That is not an image file', 'err');
        sourceName = file.name.replace(/\.[^.]+$/, '') || 'image';
        sourceSize = file.size;

        var reader = new FileReader();
        reader.onload = function () {
          var img = new Image();
          img.onload = function () {
            source = img;
            widthBox.value = img.naturalWidth;
            heightBox.value = img.naturalHeight;
            ui.clear(before).appendChild(preview(reader.result, img.naturalWidth + ' × ' + img.naturalHeight + ' · ' + ui.bytes(file.size)));
            convert();
          };
          img.onerror = function () { ui.toast('That image could not be decoded', 'err'); };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      }, { accept: 'image/*' });

      function preview(src, caption) {
        return h('div',
          h('img', { src: src, style: { maxWidth: '100%', maxHeight: '320px', borderRadius: '8px', border: '1px solid var(--border)', display: 'block' } }),
          h('div.note.mt8', { text: caption })
        );
      }

      function convert() {
        if (!source) return;
        qualityLabel.textContent = String(quality.value);

        var width = Math.max(1, Math.round(Number(widthBox.value) || source.naturalWidth));
        var height = Math.max(1, Math.round(Number(heightBox.value) || source.naturalHeight));

        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx2d = canvas.getContext('2d');
        ctx2d.imageSmoothingEnabled = true;
        ctx2d.imageSmoothingQuality = 'high';

        // JPEG has no alpha channel; without this, transparency turns black.
        if (format.value === 'image/jpeg') {
          ctx2d.fillStyle = '#ffffff';
          ctx2d.fillRect(0, 0, width, height);
        }
        ctx2d.drawImage(source, 0, 0, width, height);

        var q = Number(quality.value) / 100;
        canvas.toBlob(function (blob) {
          if (!blob) { ui.clear(after).appendChild(ui.banner('err', 'This browser cannot encode that format.')); return; }
          lastBlob = blob;
          var url = URL.createObjectURL(blob);
          ui.clear(after).appendChild(preview(url, width + ' × ' + height + ' · ' + ui.bytes(blob.size)));

          var delta = sourceSize ? (1 - blob.size / sourceSize) * 100 : 0;
          ui.clear(stats);
          [
            ui.stat(ui.bytes(sourceSize), 'original'),
            ui.stat(ui.bytes(blob.size), 'converted'),
            ui.stat((delta >= 0 ? '−' : '+') + Math.abs(delta).toFixed(0) + '%', 'size change'),
            ui.stat(width + '×' + height, 'dimensions'),
            ui.stat(format.value.split('/')[1].toUpperCase(), 'format')
          ].forEach(function (s) { stats.appendChild(s); });
        }, format.value, q);
      }

      function extension() { return { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[format.value]; }

      widthBox.control.addEventListener('input', ui.debounce(function () {
        if (keepRatio.checked && source && widthBox.value) {
          heightBox.value = Math.round(Number(widthBox.value) * source.naturalHeight / source.naturalWidth);
        }
        convert();
      }, 300));

      heightBox.control.addEventListener('input', ui.debounce(function () {
        if (keepRatio.checked && source && heightBox.value) {
          widthBox.value = Math.round(Number(heightBox.value) * source.naturalWidth / source.naturalHeight);
        }
        convert();
      }, 300));

      format.addEventListener('change', convert);
      quality.control.addEventListener('input', ui.debounce(convert, 200));

      var presets = h('div.row.tight.mt12');
      [['Half size', 0.5], ['Quarter', 0.25], ['1920 wide', 1920], ['1280 wide', 1280], ['512 wide', 512], ['Original', 1]].forEach(function (preset) {
        presets.appendChild(ui.chip(preset[0], function () {
          if (!source) return ui.toast('Load an image first');
          var width = preset[1] <= 1 ? Math.round(source.naturalWidth * preset[1]) : preset[1];
          widthBox.value = Math.min(width, preset[1] <= 1 ? width : source.naturalWidth);
          heightBox.value = Math.round(Number(widthBox.value) * source.naturalHeight / source.naturalWidth);
          convert();
        }));
      });

      var outputCard = ui.card('Result', after);
      outputCard.actions.appendChild(h('button.btn.sm.ghost', {
        type: 'button',
        onclick: function () {
          if (!lastBlob) return ui.toast('Load an image first', 'err');
          ui.download(sourceName + '.' + extension(), lastBlob);
        }
      }, 'Download'));
      outputCard.actions.appendChild(h('button.btn.sm.ghost', {
        type: 'button',
        onclick: function () {
          if (!lastBlob) return ui.toast('Load an image first', 'err');
          var reader = new FileReader();
          reader.onload = function () { ui.copy(reader.result); };
          reader.readAsDataURL(lastBlob);
        }
      }, 'Copy data URI'));

      root.appendChild(ui.card('Source', zone, h('div.mt12', before)));
      root.appendChild(ui.card('Output settings',
        h('div.grid3', format, widthBox, heightBox),
        h('div.row.mt12', keepRatio, h('span.note', 'Quality '), qualityLabel),
        quality,
        presets
      ));
      root.appendChild(stats);
      root.appendChild(outputCard);
      root.appendChild(h('div.note', { text: 'Quality applies to JPEG and WebP; PNG is always lossless. WebP usually lands 25–35% smaller than JPEG at the same visual quality.' }));
    }
  });
})();
