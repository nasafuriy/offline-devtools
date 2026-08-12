/* CSV ↔ JSON with an RFC 4180 parser. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  DevBox.register({
    id: 'csv',
    icon: '⊞',
    category: 'data',
    keywords: 'csv json convert table spreadsheet tsv delimiter parse',
    name: { en: 'CSV ↔ JSON', uz: 'CSV ↔ JSON', ru: 'CSV ↔ JSON' },
    desc: {
      en: 'Convert between CSV and JSON with quoted fields, custom delimiters and a live table preview.',
      uz: 'CSV va JSON oʻrtasida oʻgirish — qoʻshtirnoqli maydonlar, turli ajratgichlar va jonli jadval koʻrinishi bilan.',
      ru: 'Конвертация CSV в JSON и обратно: кавычки, произвольные разделители и предпросмотр таблицы.'
    },

    mount: function (root, ctx) {
      var SAMPLE = 'name,role,city\nAda Lovelace,engineer,London\n"Doe, John",designer,Tashkent\nMei Chen,"data ""scientist""",Shanghai';

      var direction = ui.select({
        options: [['c2j', 'CSV → JSON'], ['j2c', 'JSON → CSV']],
        value: ctx.store.get('dir', 'c2j')
      });
      var delimiter = ui.select({
        options: [['auto', 'Auto-detect'], [',', 'Comma ,'], [';', 'Semicolon ;'], ['\t', 'Tab'], ['|', 'Pipe |']],
        value: ctx.store.get('delim', 'auto')
      });
      var hasHeader = ui.checkbox('First row is a header', ctx.store.get('header', true), run);

      var input = ui.textarea({ tall: true, value: ctx.store.get('input', SAMPLE) });
      var out = ui.output({ title: 'Result', download: function () { return direction.value === 'c2j' ? 'data.json' : 'data.csv'; } });
      var preview = h('div.tbl-scroll');
      var previewCard = ui.card('Preview', preview);
      previewCard.body.classList.add('flush');
      var info = h('div');

      function run() {
        ctx.store.set('dir', direction.value);
        ctx.store.set('delim', delimiter.value);
        ctx.store.set('header', hasHeader.checked);
        ctx.store.set('input', input.value.slice(0, 200000));

        var text = input.value.trim();
        ui.clear(info);
        if (!text) { out.set(''); ui.clear(preview); return; }

        try {
          if (direction.value === 'c2j') csvToJson(text);
          else jsonToCsv(text);
        } catch (err) {
          out.set(err.message, 'err');
          ui.clear(preview);
        }
      }

      function csvToJson(text) {
        var delim = delimiter.value === 'auto' ? detectDelimiter(text) : delimiter.value;
        var rows = parseCsv(text, delim);
        if (!rows.length) { out.set('[]'); ui.clear(preview); return; }

        var header, records;
        if (hasHeader.checked) {
          header = dedupe(rows[0]);
          records = rows.slice(1).map(function (row) {
            var obj = {};
            header.forEach(function (key, i) { obj[key] = coerce(row[i] === undefined ? '' : row[i]); });
            return obj;
          });
        } else {
          header = rows[0].map(function (_, i) { return 'col' + (i + 1); });
          records = rows.map(function (row) { return row.map(coerce); });
        }

        out.set(JSON.stringify(records, null, 2));
        info.appendChild(h('div.stat-row',
          ui.stat(ui.num(records.length), 'rows'),
          ui.stat(header.length, 'columns'),
          ui.stat(JSON.stringify(delim).replace(/"/g, '') || ',', 'delimiter')
        ));
        drawPreview(header, rows.slice(hasHeader.checked ? 1 : 0));
      }

      function jsonToCsv(text) {
        var data = JSON.parse(text);
        if (!Array.isArray(data)) data = [data];
        if (!data.length) { out.set(''); ui.clear(preview); return; }

        var delim = delimiter.value === 'auto' ? ',' : delimiter.value;
        var header = [];
        data.forEach(function (row) {
          if (row && typeof row === 'object' && !Array.isArray(row)) {
            Object.keys(row).forEach(function (key) { if (header.indexOf(key) < 0) header.push(key); });
          }
        });

        var lines = [];
        var body = data.map(function (row) {
          if (Array.isArray(row)) return row.map(cell);
          if (row && typeof row === 'object') return header.map(function (key) { return cell(row[key]); });
          return [cell(row)];
        });

        if (header.length && hasHeader.checked) lines.push(header.map(cell).join(delim));
        body.forEach(function (row) { lines.push(row.join(delim)); });

        out.set(lines.join('\n'));
        info.appendChild(h('div.stat-row',
          ui.stat(ui.num(body.length), 'rows'),
          ui.stat(header.length || (body[0] || []).length, 'columns')
        ));
        drawPreview(header.length ? header : (body[0] || []).map(function (_, i) { return 'col' + (i + 1); }),
          body.map(function (row) { return row.map(unquote); }));

        function cell(value) {
          if (value === null || value === undefined) return '';
          var s = typeof value === 'object' ? JSON.stringify(value) : String(value);
          return (s.indexOf(delim) >= 0 || /["\n\r]/.test(s)) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }
      }

      function drawPreview(header, rows) {
        ui.clear(preview);
        var table = h('table.tbl');
        table.appendChild(h('thead', h('tr', header.map(function (key) { return h('th', { text: key }); }))));
        var tbody = h('tbody');
        rows.slice(0, 200).forEach(function (row) {
          tbody.appendChild(h('tr', header.map(function (_, i) {
            return h('td.mono', { text: row[i] === undefined ? '' : String(row[i]) });
          })));
        });
        table.appendChild(tbody);
        preview.appendChild(table);
        if (rows.length > 200) preview.appendChild(h('div.note', { style: { padding: '8px 10px' }, text: 'Showing the first 200 of ' + ui.num(rows.length) + ' rows.' }));
      }

      root.appendChild(h('div.row', direction, delimiter, hasHeader));
      root.appendChild(ui.card('Input', input));
      root.appendChild(info);
      root.appendChild(out);
      root.appendChild(previewCard);

      input.addEventListener('input', ui.debounce(run, 300));
      direction.addEventListener('change', run);
      delimiter.addEventListener('change', run);
      run();
    }
  });

  /* ---------------------------------------------------------- parsing */

  /** RFC 4180 parser: honours quoted fields, doubled quotes and embedded newlines. */
  function parseCsv(text, delim) {
    var rows = [], row = [], field = '', quoted = false, started = false, i = 0;

    while (i < text.length) {
      var c = text[i];

      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          quoted = false; i++; continue;
        }
        field += c; i++;
        continue;
      }

      if (c === '"' && !started) { quoted = true; started = true; i++; continue; }
      if (c === delim) { row.push(field); field = ''; started = false; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; started = false; i++; continue; }
      field += c; started = true; i++;
    }

    if (field !== '' || row.length || started) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.length > 1 || (r[0] || '').trim() !== ''; });
  }

  function detectDelimiter(text) {
    var firstLine = text.split(/\r?\n/)[0] || '';
    var best = ',', bestCount = 0;
    [',', ';', '\t', '|'].forEach(function (d) {
      var count = 0, quoted = false;
      for (var i = 0; i < firstLine.length; i++) {
        if (firstLine[i] === '"') quoted = !quoted;
        else if (firstLine[i] === d && !quoted) count++;
      }
      if (count > bestCount) { bestCount = count; best = d; }
    });
    return best;
  }

  /** Numbers and booleans become real JSON values; everything else stays a string. */
  function coerce(value) {
    var s = String(value).trim();
    if (s === '') return '';
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null') return null;
    // Only convert when the round trip is lossless, so IDs like 007 survive.
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s) && String(Number(s)) === s) return Number(s);
    return String(value);
  }

  function dedupe(keys) {
    var seen = {};
    return keys.map(function (key, i) {
      var name = String(key).trim() || 'col' + (i + 1);
      if (seen[name] === undefined) { seen[name] = 1; return name; }
      return name + '_' + (++seen[name]);
    });
  }

  function unquote(s) {
    return /^".*"$/.test(s) ? s.slice(1, -1).replace(/""/g, '"') : s;
  }
})();
