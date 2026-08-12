/* JSON formatter, validator and inspector. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  DevBox.register({
    id: 'json',
    icon: '{}',
    category: 'data',
    keywords: 'json format pretty print minify validate beautify sort tree',
    name: { en: 'JSON Formatter', uz: 'JSON formatlagich', ru: 'JSON форматтер' },
    desc: {
      en: 'Pretty-print, minify, validate and sort JSON, with the exact line and column of any syntax error.',
      uz: 'JSON’ni chiroyli koʻrinishga keltirish, siqish, tekshirish va saralash — xato boʻlsa aniq satr va ustunini koʻrsatadi.',
      ru: 'Форматирование, минификация, проверка и сортировка JSON с точным указанием строки и столбца ошибки.'
    },

    mount: function (root, ctx) {
      var input = ui.textarea({
        tall: true,
        placeholder: '{\n  "paste": "your JSON here"\n}',
        value: ctx.store.get('input', '')
      });

      var indent = ui.select({
        options: [['2', '2 spaces'], ['4', '4 spaces'], ['\t', 'Tab'], ['0', 'Minified']],
        value: ctx.store.get('indent', '2')
      });

      var status = h('div');
      var out = ui.output({ title: 'Result', download: 'formatted.json' });
      var stats = h('div.stat-row');
      var tree = h('div.card-body.flush');
      var treeCard = ui.card('Tree', tree);
      treeCard.style.display = 'none';

      function parse() {
        var text = input.value.trim();
        ctx.store.set('input', input.value.slice(0, 100000));
        if (!text) {
          ui.clear(status);
          ui.clear(stats);
          out.set('');
          treeCard.style.display = 'none';
          return null;
        }
        try {
          var value = JSON.parse(text);
          ui.clear(status).appendChild(ui.banner('ok', 'Valid JSON'));
          return value;
        } catch (err) {
          var at = locate(text, err);
          ui.clear(status).appendChild(ui.banner('err',
            err.message + (at ? '  —  line ' + at.line + ', column ' + at.col : '')));
          ui.clear(stats);
          treeCard.style.display = 'none';
          return null;
        }
      }

      function run(transform) {
        var value = parse();
        if (value === null && input.value.trim() === '') return;
        if (value === undefined) return;
        try {
          var result = transform(value);
          out.set(result);
          showStats(value);
          renderTree(value);
        } catch (err) {
          out.set(err.message, 'err');
        }
      }

      function stringify(value) {
        var mode = indent.value;
        ctx.store.set('indent', mode);
        if (mode === '0') return JSON.stringify(value);
        return JSON.stringify(value, null, mode === '\t' ? '\t' : Number(mode));
      }

      function showStats(value) {
        var counts = { objects: 0, arrays: 0, keys: 0, values: 0 };
        var depth = walk(value, 1, counts);
        ui.clear(stats);
        [
          ui.stat(ui.num(counts.keys), 'keys'),
          ui.stat(ui.num(counts.objects), 'objects'),
          ui.stat(ui.num(counts.arrays), 'arrays'),
          ui.stat(ui.num(counts.values), 'values'),
          ui.stat(depth, 'max depth'),
          ui.stat(ui.bytes(new Blob([input.value]).size), 'size')
        ].forEach(function (s) { stats.appendChild(s); });
      }

      function walk(node, level, counts) {
        if (Array.isArray(node)) {
          counts.arrays++;
          var deepest = level;
          node.forEach(function (child) { deepest = Math.max(deepest, walk(child, level + 1, counts)); });
          return deepest;
        }
        if (node && typeof node === 'object') {
          counts.objects++;
          var max = level;
          Object.keys(node).forEach(function (key) {
            counts.keys++;
            max = Math.max(max, walk(node[key], level + 1, counts));
          });
          return max;
        }
        counts.values++;
        return level;
      }

      function renderTree(value) {
        treeCard.style.display = '';
        ui.clear(tree).appendChild(node('', value, true));
      }

      function node(key, value, open) {
        var isArr = Array.isArray(value);
        var isObj = value && typeof value === 'object';

        if (!isObj) {
          return h('div', { style: { padding: '2px 0 2px 16px', fontFamily: 'var(--mono)', fontSize: '12.5px' } },
            key ? h('span', { style: { color: 'var(--accent)' }, text: key + ': ' }) : null,
            h('span', { style: { color: leafColor(value) }, text: JSON.stringify(value) })
          );
        }

        var entries = isArr ? value.map(function (v, i) { return [String(i), v]; })
                            : Object.keys(value).map(function (k) { return [k, value[k]]; });

        var summary = h('summary', { style: { cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: '12.5px', padding: '2px 0' } },
          key ? h('span', { style: { color: 'var(--accent)' }, text: key + ': ' }) : null,
          h('span', { style: { color: 'var(--text-faint)' }, text: (isArr ? '[' + entries.length + ']' : '{' + entries.length + '}') })
        );

        var details = h('details', { style: { paddingLeft: '16px', borderLeft: '1px solid var(--border)' } }, summary);
        if (open) details.open = true;
        entries.forEach(function (pair) { details.appendChild(node(pair[0], pair[1], false)); });
        return details;
      }

      function leafColor(value) {
        if (value === null) return 'var(--text-faint)';
        if (typeof value === 'number') return 'var(--warn)';
        if (typeof value === 'boolean') return 'var(--err)';
        return 'var(--ok)';
      }

      root.appendChild(ui.card('Input', input));
      root.appendChild(h('div.row',
        indent,
        ui.btn('Format', function () { run(function (v) { return stringify(v); }); }, 'primary'),
        ui.btn('Minify', function () { run(function (v) { return JSON.stringify(v); }); }),
        ui.btn('Sort keys', function () { run(function (v) { return stringify(sortKeys(v)); }); }),
        ui.btn('Escape as string', function () { run(function (v) { return JSON.stringify(JSON.stringify(v)); }); }),
        ui.btn('Unescape', function () {
          try {
            var once = JSON.parse(input.value);
            input.value = typeof once === 'string' ? once : input.value;
            run(function (v) { return stringify(v); });
          } catch (err) { out.set('Not a JSON-encoded string: ' + err.message, 'err'); }
        }),
        h('div.spacer'),
        ui.btn('Clear', function () {
          input.value = '';
          parse();
        }, 'ghost')
      ));
      root.appendChild(status);
      root.appendChild(stats);
      root.appendChild(out);
      root.appendChild(treeCard);

      input.addEventListener('input', ui.debounce(function () { parse(); }, 300));
      if (input.value.trim()) run(function (v) { return stringify(v); });
    }
  });

  /** Turns V8's "position N" into a human line/column. */
  function locate(text, err) {
    var m = /position (\d+)/.exec(err.message || '');
    if (!m) return null;
    var pos = Math.min(Number(m[1]), text.length);
    var before = text.slice(0, pos);
    return { line: before.split('\n').length, col: pos - before.lastIndexOf('\n') };
  }

  function sortKeys(value) {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce(function (acc, key) {
        acc[key] = sortKeys(value[key]);
        return acc;
      }, {});
    }
    return value;
  }
})();
