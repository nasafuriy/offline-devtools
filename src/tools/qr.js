/* QR code generation, rendered entirely in-page. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  DevBox.register({
    id: 'qr',
    icon: '▣',
    category: 'visual',
    keywords: 'qr code generate barcode wifi vcard url scan svg png offline',
    name: { en: 'QR Generator', uz: 'QR generator', ru: 'Генератор QR' },
    desc: {
      en: 'Build a QR code for a link, Wi-Fi network or contact card and export it as SVG or PNG — no service involved.',
      uz: 'Havola, Wi-Fi tarmogʻi yoki kontakt uchun QR kod yasang va SVG yoki PNG qilib saqlang — hech qanday xizmatsiz.',
      ru: 'Создание QR-кода для ссылки, Wi-Fi или контакта с экспортом в SVG или PNG — без сторонних сервисов.'
    },

    mount: function (root, ctx) {
      var text = ui.textarea({ short: true, value: ctx.store.get('text', 'https://github.com'), placeholder: 'Any text, link or payload' });

      var ecc = ui.select({
        options: [['L', 'L — recovers 7%'], ['M', 'M — recovers 15%'], ['Q', 'Q — recovers 25%'], ['H', 'H — recovers 30%']],
        value: ctx.store.get('ecc', 'M'), label: 'ERROR CORRECTION'
      });
      var scale = ui.input({ type: 'range', value: ctx.store.get('scale', 8), min: 2, max: 20, label: 'MODULE SIZE' });
      var quiet = ui.input({ type: 'number', value: 4, min: 0, max: 16, label: 'QUIET ZONE' });
      var dark = ui.input({ type: 'color', value: ctx.store.get('dark', '#000000'), label: 'DARK' });
      var light = ui.input({ type: 'color', value: ctx.store.get('light', '#ffffff'), label: 'LIGHT' });

      var canvasHost = h('div', { style: { display: 'flex', justifyContent: 'center', padding: '16px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)' } });
      var info = h('div.stat-row.mt12');
      var status = h('div');
      var current = null;

      /* ------------------------------------------------ payload builders */

      var builders = h('div.row.tight.mt12');
      [
        ['Link', function () { return prompt('URL', 'https://example.com'); }],
        ['Wi-Fi', function () {
          var ssid = prompt('Network name (SSID)');
          if (ssid === null) return null;
          var pass = prompt('Password (leave blank for an open network)') || '';
          var type = pass ? 'WPA' : 'nopass';
          return 'WIFI:T:' + type + ';S:' + wifiEscape(ssid) + ';' + (pass ? 'P:' + wifiEscape(pass) + ';' : '') + ';';
        }],
        ['Email', function () {
          var to = prompt('Email address');
          if (to === null) return null;
          var subject = prompt('Subject') || '';
          return 'mailto:' + to + (subject ? '?subject=' + encodeURIComponent(subject) : '');
        }],
        ['Phone', function () { var n = prompt('Phone number', '+998'); return n === null ? null : 'tel:' + n.replace(/\s/g, ''); }],
        ['SMS', function () {
          var n = prompt('Phone number', '+998');
          if (n === null) return null;
          var body = prompt('Message') || '';
          return 'SMSTO:' + n.replace(/\s/g, '') + ':' + body;
        }],
        ['Location', function () {
          var lat = prompt('Latitude', '41.2995');
          if (lat === null) return null;
          var lon = prompt('Longitude', '69.2401');
          return 'geo:' + lat + ',' + lon;
        }],
        ['Contact card', function () {
          var name = prompt('Full name');
          if (name === null) return null;
          var phone = prompt('Phone') || '';
          var email = prompt('Email') || '';
          var org = prompt('Organisation') || '';
          return ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + name,
            org ? 'ORG:' + org : '', phone ? 'TEL:' + phone : '', email ? 'EMAIL:' + email : '',
            'END:VCARD'].filter(Boolean).join('\n');
        }]
      ].forEach(function (entry) {
        builders.appendChild(ui.chip(entry[0], function () {
          var value = entry[1]();
          if (value !== null && value !== undefined) { text.value = value; render(); }
        }));
      });

      /* ------------------------------------------------ render */

      function render() {
        ctx.store.set('text', text.value.slice(0, 4000));
        ctx.store.set('ecc', ecc.value);
        ctx.store.set('scale', scale.value);
        ctx.store.set('dark', dark.value);
        ctx.store.set('light', light.value);

        ui.clear(status);
        ui.clear(canvasHost);
        ui.clear(info);

        if (!text.value) {
          status.appendChild(h('div.note', { text: 'Type something to generate a code.' }));
          current = null;
          return;
        }

        var qr;
        try {
          qr = DevBox.qr.encode(text.value, { ecc: ecc.value, boost: true });
        } catch (err) {
          status.appendChild(ui.banner('err', err.message));
          current = null;
          return;
        }

        current = qr;
        var opts = {
          scale: Number(scale.value),
          quiet: Number(quiet.value),
          dark: dark.value,
          light: light.value
        };

        var canvas = h('canvas', { style: { maxWidth: '100%', height: 'auto', imageRendering: 'pixelated', borderRadius: '6px' } });
        DevBox.qr.toCanvas(qr, canvas, opts);
        canvasHost.appendChild(canvas);

        [
          ui.stat(qr.version, 'version'),
          ui.stat(qr.size + '×' + qr.size, 'modules'),
          ui.stat(qr.ecc, 'correction'),
          ui.stat(qr.mode, 'mode'),
          ui.stat(qr.mask, 'mask'),
          ui.stat(new Blob([text.value]).size + ' B', 'payload')
        ].forEach(function (s) { info.appendChild(s); });

        if (qr.ecc !== ecc.value) {
          status.appendChild(h('div.note', { text: 'There was spare room in this symbol, so the error correction was raised from ' + ecc.value + ' to ' + qr.ecc + ' for free.' }));
        }
      }

      function svgString() {
        if (!current) return '';
        return DevBox.qr.toSvg(current, {
          scale: Number(scale.value), quiet: Number(quiet.value),
          dark: dark.value, light: light.value
        });
      }

      var card = ui.card('QR code', canvasHost, info, status);
      card.actions.appendChild(h('button.btn.sm.ghost', {
        type: 'button',
        onclick: function () {
          if (!current) return ui.toast('Nothing to save', 'err');
          ui.download('qr.svg', svgString(), 'image/svg+xml');
        }
      }, 'SVG'));
      card.actions.appendChild(h('button.btn.sm.ghost', {
        type: 'button',
        onclick: function () {
          var canvas = canvasHost.querySelector('canvas');
          if (!canvas) return ui.toast('Nothing to save', 'err');
          canvas.toBlob(function (blob) { ui.download('qr.png', blob); }, 'image/png');
        }
      }, 'PNG'));
      card.actions.appendChild(h('button.btn.sm.ghost', {
        type: 'button', onclick: function () { ui.copy(svgString()); }
      }, 'Copy SVG'));

      root.appendChild(ui.card('Payload', text, builders));
      root.appendChild(h('div.grid3', ecc, quiet, scale));
      root.appendChild(h('div.grid2', dark, light));
      root.appendChild(card);
      root.appendChild(h('div.note', { text: 'Higher error correction survives more damage but needs a denser grid. Keep the quiet zone at 4 modules or scanners may miss the edges.' }));

      text.addEventListener('input', ui.debounce(render, 250));
      [ecc, quiet, dark, light].forEach(function (control) {
        control.control.addEventListener('input', ui.debounce(render, 150));
        control.control.addEventListener('change', render);
      });
      scale.control.addEventListener('input', ui.debounce(render, 100));

      render();
    }
  });

  function wifiEscape(value) {
    return String(value).replace(/([\\;,":])/g, '\\$1');
  }
})();
