/* Line-oriented text surgery plus document statistics. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  // Combining diacritical marks, built from escapes so the source stays ASCII.
  var COMBINING = new RegExp('[\\u0300-\\u036f]', 'g');

  DevBox.register({
    id: 'textkit',
    icon: '¶',
    category: 'text',
    keywords: 'text lines sort unique dedupe reverse shuffle trim count words characters find replace wrap',
    name: { en: 'Text Toolkit', uz: 'Matn asboblari', ru: 'Работа с текстом' },
    desc: {
      en: 'Sort, deduplicate, trim, number and reshape lines, run find-and-replace, and count what you have.',
      uz: 'Satrlarni saralash, takrorlarni olib tashlash, tozalash, raqamlash, qidirib-almashtirish va sanash.',
      ru: 'Сортировка, удаление дублей, обрезка, нумерация строк, поиск с заменой и подсчёт статистики.'
    },

    mount: function (root, ctx) {
      var text = ui.textarea({ tall: true, value: ctx.store.get('text', ''), placeholder: 'Paste your text here' });
      var stats = h('div.stat-row');
      var history = [];

      function lines() { return text.value.split('\n'); }

      function apply(fn) {
        history.push(text.value);
        if (history.length > 50) history.shift();
        text.value = fn(text.value);
        update();
      }

      function applyLines(fn) {
        apply(function (value) { return fn(value.split('\n')).join('\n'); });
      }

      function update() {
        ctx.store.set('text', text.value.slice(0, 200000));
        var value = text.value;
        var words = value.trim() ? value.trim().split(/\s+/).length : 0;
        var allLines = value === '' ? [] : value.split('\n');
        var nonEmpty = allLines.filter(function (l) { return l.trim() !== ''; });
        var readingMinutes = words / 200;

        ui.clear(stats);
        [
          ui.stat(ui.num(value.length), 'characters'),
          ui.stat(ui.num(value.replace(/\s/g, '').length), 'no spaces'),
          ui.stat(ui.num(words), 'words'),
          ui.stat(ui.num(allLines.length), 'lines'),
          ui.stat(ui.num(nonEmpty.length), 'non-empty'),
          ui.stat(ui.num(new Set(nonEmpty.map(function (l) { return l.trim(); })).size), 'unique'),
          ui.stat(ui.bytes(new Blob([value]).size), 'utf-8 size'),
          ui.stat(readingMinutes < 1 ? '<1 min' : Math.round(readingMinutes) + ' min', 'reading time')
        ].forEach(function (s) { stats.appendChild(s); });
      }

      /* ------------------------------------------------ operations */

      var lineOps = h('div.row.tight',
        ui.btn('Sort A→Z', function () { applyLines(function (l) { return l.slice().sort(collate); }); }),
        ui.btn('Sort Z→A', function () { applyLines(function (l) { return l.slice().sort(collate).reverse(); }); }),
        ui.btn('Sort by length', function () { applyLines(function (l) { return l.slice().sort(function (a, b) { return a.length - b.length || collate(a, b); }); }); }),
        ui.btn('Remove duplicates', function () {
          applyLines(function (l) {
            var seen = new Set();
            return l.filter(function (line) {
              if (seen.has(line)) return false;
              seen.add(line);
              return true;
            });
          });
        }),
        ui.btn('Keep only duplicates', function () {
          applyLines(function (l) {
            var counts = {};
            l.forEach(function (line) { counts[line] = (counts[line] || 0) + 1; });
            var emitted = new Set();
            return l.filter(function (line) {
              if (counts[line] > 1 && !emitted.has(line)) { emitted.add(line); return true; }
              return false;
            });
          });
        }),
        ui.btn('Reverse order', function () { applyLines(function (l) { return l.slice().reverse(); }); }),
        ui.btn('Shuffle', function () { applyLines(shuffle); }),
        ui.btn('Remove empty', function () { applyLines(function (l) { return l.filter(function (line) { return line.trim() !== ''; }); }); }),
        ui.btn('Trim each line', function () { applyLines(function (l) { return l.map(function (line) { return line.trim(); }); }); }),
        ui.btn('Number lines', function () {
          applyLines(function (l) {
            var width = String(l.length).length;
            return l.map(function (line, i) { return String(i + 1).padStart(width, ' ') + '. ' + line; });
          });
        }),
        ui.btn('Collapse blank runs', function () {
          apply(function (v) { return v.replace(/\n{3,}/g, '\n\n'); });
        })
      );

      var textOps = h('div.row.tight',
        ui.btn('UPPERCASE', function () { apply(function (v) { return v.toUpperCase(); }); }),
        ui.btn('lowercase', function () { apply(function (v) { return v.toLowerCase(); }); }),
        ui.btn('Collapse spaces', function () { apply(function (v) { return v.replace(/[^\S\n]+/g, ' '); }); }),
        ui.btn('Strip HTML tags', function () { apply(function (v) { return v.replace(/<[^>]*>/g, ''); }); }),
        ui.btn('Remove accents', function () { apply(function (v) { return v.normalize('NFD').replace(COMBINING, ''); }); }),
        ui.btn('Reverse text', function () { apply(function (v) { return Array.from(v).reverse().join(''); }); }),
        ui.btn('Slugify', function () {
          apply(function (v) {
            return v.split('\n').map(function (line) {
              return line.normalize('NFD').replace(COMBINING, '')
                .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            }).join('\n');
          });
        })
      );

      /* ------------------------------------------------ affix + wrap */

      var prefix = ui.input({ placeholder: 'prefix', label: 'PREFIX' });
      var suffix = ui.input({ placeholder: 'suffix', label: 'SUFFIX' });
      var skipEmpty = ui.checkbox('Skip empty lines', true);

      var wrapWidth = ui.input({ type: 'number', value: 80, min: 10, max: 300, label: 'WRAP WIDTH' });

      /* ------------------------------------------------ find & replace */

      var find = ui.input({ placeholder: 'find', label: 'FIND' });
      var replace = ui.input({ placeholder: 'replace with', label: 'REPLACE' });
      var useRegex = ui.checkbox('Regular expression', false);
      var caseSensitive = ui.checkbox('Case sensitive', true);
      var replaceStatus = h('div');

      function doReplace() {
        ui.clear(replaceStatus);
        if (!find.value) return;
        var flags = 'g' + (caseSensitive.checked ? '' : 'i');
        var re;
        try {
          re = useRegex.checked ? new RegExp(find.value, flags)
                                : new RegExp(find.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
        } catch (err) {
          replaceStatus.appendChild(ui.banner('err', err.message));
          return;
        }
        var count = (text.value.match(re) || []).length;
        apply(function (v) { return v.replace(re, replace.value); });
        replaceStatus.appendChild(ui.banner(count ? 'ok' : 'warn',
          count ? 'Replaced ' + count + ' occurrence' + (count === 1 ? '' : 's') + '.' : 'Nothing matched.'));
      }

      /* ------------------------------------------------ layout */

      var editor = ui.card('Text', text);
      editor.actions.appendChild(h('button.btn.sm.ghost', {
        type: 'button',
        onclick: function () {
          if (!history.length) return ui.toast('Nothing to undo');
          text.value = history.pop();
          update();
        }
      }, 'Undo'));
      editor.actions.appendChild(h('button.btn.sm.ghost', { type: 'button', onclick: function () { ui.copy(text.value); } }, 'Copy'));
      editor.actions.appendChild(h('button.btn.sm.ghost', {
        type: 'button', onclick: function () { history.push(text.value); text.value = ''; update(); }
      }, 'Clear'));

      root.appendChild(editor);
      root.appendChild(stats);
      root.appendChild(ui.card('Line operations', lineOps));
      root.appendChild(ui.card('Whole-text operations', textOps));

      root.appendChild(ui.card('Add a prefix or suffix',
        h('div.grid3', prefix, suffix, h('div', h('label.lbl', { text: 'OPTIONS' }), h('div.row', skipEmpty))),
        h('div.row.mt12', ui.btn('Apply', function () {
          applyLines(function (l) {
            return l.map(function (line) {
              if (skipEmpty.checked && line.trim() === '') return line;
              return prefix.value + line + suffix.value;
            });
          });
        }, 'primary'))
      ));

      root.appendChild(ui.card('Wrap lines',
        h('div.row', wrapWidth, ui.btn('Wrap', function () {
          var width = Math.max(10, Number(wrapWidth.value) || 80);
          apply(function (v) {
            return v.split('\n').map(function (paragraph) { return wrap(paragraph, width); }).join('\n');
          });
        }, 'primary'), ui.btn('Unwrap paragraphs', function () {
          apply(function (v) { return v.replace(/([^\n])\n(?!\n)/g, '$1 '); });
        }))
      ));

      root.appendChild(ui.card('Find & replace',
        h('div.grid2', find, replace),
        h('div.row.mt12', useRegex, caseSensitive, ui.btn('Replace all', doReplace, 'primary')),
        h('div.mt12', replaceStatus)
      ));

      text.addEventListener('input', ui.debounce(update, 200));
      update();
    }
  });

  function collate(a, b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }); }

  function shuffle(list) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  function wrap(paragraph, width) {
    if (paragraph.length <= width) return paragraph;
    var words = paragraph.split(/\s+/);
    var lines = [];
    var current = '';
    words.forEach(function (word) {
      if (!current) current = word;
      else if ((current + ' ' + word).length <= width) current += ' ' + word;
      else { lines.push(current); current = word; }
    });
    if (current) lines.push(current);
    return lines.join('\n');
  }
})();
