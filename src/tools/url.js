/* URL encoding, decoding and structural parsing. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  DevBox.register({
    id: 'url',
    icon: '🔗',
    category: 'data',
    keywords: 'url uri encode decode percent query string params parse link',
    name: { en: 'URL Tools', uz: 'URL vositalari', ru: 'URL-инструменты' },
    desc: {
      en: 'Percent-encode and decode, split a URL into its parts, and move between query strings and JSON.',
      uz: 'Foizli kodlash va dekodlash, URL’ni qismlarga ajratish, query string va JSON oʻrtasida oʻgirish.',
      ru: 'Процентное кодирование, разбор URL на части и преобразование query-строки в JSON и обратно.'
    },

    mount: function (root, ctx) {
      /* ------------------------------------------------ encode / decode */

      var raw = ui.textarea({ short: true, placeholder: 'https://example.com/path?q=salom dunyo&x=1', value: ctx.store.get('raw', '') });
      var encOut = ui.output({ title: 'Encoded / decoded' });

      var encodeCard = ui.card('Encode & decode', raw, h('div.row.mt12',
        ui.btn('Encode component', function () { safely(function () { encOut.set(encodeURIComponent(raw.value)); }); }, 'primary'),
        ui.btn('Encode full URL', function () { safely(function () { encOut.set(encodeURI(raw.value)); }); }),
        ui.btn('Decode', function () { safely(function () { encOut.set(decodeURIComponent(raw.value.replace(/\+/g, ' '))); }); }),
        ui.btn('Decode (keep +)', function () { safely(function () { encOut.set(decodeURIComponent(raw.value)); }); })
      ));

      function safely(fn) {
        try { fn(); } catch (err) { encOut.set(err.message + ' — the input contains an invalid percent sequence.', 'err'); }
      }

      /* ------------------------------------------------ parse */

      var urlInput = ui.input({ placeholder: 'https://user:pass@example.com:8443/a/b?q=1&tag=x&tag=y#top', value: ctx.store.get('url', '') });
      var parts = h('div');
      var paramsHost = h('div');

      function parse() {
        ctx.store.set('url', urlInput.value.slice(0, 4000));
        ui.clear(parts);
        ui.clear(paramsHost);
        var text = urlInput.value.trim();
        if (!text) return;

        var url;
        try {
          url = new URL(text);
        } catch (err) {
          try { url = new URL('https://' + text); }
          catch (err2) { parts.appendChild(ui.banner('err', 'Not a parsable URL.')); return; }
        }

        var rows = [
          ['Protocol', url.protocol.replace(/:$/, '')],
          ['Username', url.username],
          ['Password', url.password ? '•'.repeat(url.password.length) : ''],
          ['Host', url.hostname],
          ['Port', url.port || defaultPort(url.protocol)],
          ['Path', url.pathname],
          ['Query', url.search.replace(/^\?/, '')],
          ['Fragment', url.hash.replace(/^#/, '')],
          ['Origin', url.origin]
        ].filter(function (row) { return row[1]; });

        var list = h('dl.kv');
        rows.forEach(function (row) {
          list.appendChild(h('dt', { text: row[0] }));
          list.appendChild(h('dd', { text: row[1] }));
        });
        parts.appendChild(list);

        var entries = [];
        url.searchParams.forEach(function (value, key) { entries.push([key, value]); });
        if (!entries.length) return;

        var table = h('table.tbl',
          h('thead', h('tr', h('th', 'Parameter'), h('th', 'Raw'), h('th', 'Decoded'))),
          h('tbody', entries.map(function (pair) {
            var rawValue = (url.search.match(new RegExp('[?&]' + escapeRe(pair[0]) + '=([^&]*)')) || [])[1] || '';
            return h('tr',
              h('td.mono', { text: pair[0] }),
              h('td.mono', { text: rawValue }),
              h('td.mono', { text: pair[1] })
            );
          }))
        );
        var card = ui.card('Query parameters', h('div.tbl-scroll', table));
        card.body.classList.add('flush');
        card.actions.appendChild(h('button.btn.sm.ghost', {
          type: 'button',
          onclick: function () {
            var obj = {};
            entries.forEach(function (pair) {
              if (pair[0] in obj) obj[pair[0]] = [].concat(obj[pair[0]], pair[1]);
              else obj[pair[0]] = pair[1];
            });
            ui.copy(JSON.stringify(obj, null, 2));
          }
        }, 'Copy as JSON'));
        paramsHost.appendChild(card);
      }

      /* ------------------------------------------------ query ↔ json */

      var qs = ui.textarea({ short: true, placeholder: 'a=1&b=two&list=x&list=y' });
      var qsJson = ui.textarea({ short: true, placeholder: '{\n  "a": "1"\n}' });

      var qsCard = ui.card('Query string ↔ JSON',
        h('div.grid2',
          h('div', h('label.lbl', { text: 'QUERY STRING' }), qs),
          h('div', h('label.lbl', { text: 'JSON' }), qsJson)
        ),
        h('div.row.mt12',
          ui.btn('→ JSON', function () {
            var params = new URLSearchParams(qs.value.replace(/^[?]/, ''));
            var obj = {};
            params.forEach(function (value, key) {
              if (key in obj) obj[key] = [].concat(obj[key], value);
              else obj[key] = value;
            });
            qsJson.value = JSON.stringify(obj, null, 2);
          }, 'primary'),
          ui.btn('← Query string', function () {
            try {
              var obj = JSON.parse(qsJson.value || '{}');
              var params = new URLSearchParams();
              Object.keys(obj).forEach(function (key) {
                var value = obj[key];
                if (Array.isArray(value)) value.forEach(function (v) { params.append(key, v); });
                else params.append(key, value === null || value === undefined ? '' : String(value));
              });
              qs.value = params.toString();
            } catch (err) { ui.toast('Invalid JSON: ' + err.message, 'err'); }
          })
        )
      );

      root.appendChild(encodeCard);
      root.appendChild(encOut);
      root.appendChild(ui.card('Parse a URL', urlInput, h('div.mt12', parts)));
      root.appendChild(paramsHost);
      root.appendChild(qsCard);

      raw.addEventListener('input', function () { ctx.store.set('raw', raw.value.slice(0, 8000)); });
      urlInput.control.addEventListener('input', ui.debounce(parse, 250));
      parse();
    }
  });

  function defaultPort(protocol) {
    return { 'http:': '80 (default)', 'https:': '443 (default)', 'ftp:': '21 (default)', 'ws:': '80 (default)', 'wss:': '443 (default)' }[protocol] || '';
  }

  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
})();
