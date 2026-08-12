/* Markdown editor with a live, sandboxed preview. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  var SAMPLE = [
    '# Shashka',
    '',
    'A **single HTML file** that carries your whole developer toolbox.',
    '',
    '## Why it exists',
    '',
    'Most online tools ask you to paste a token, a payload or a private key into',
    'someone else’s server. This one never sends anything anywhere.',
    '',
    '- Works offline, forever',
    '- No build step, no dependencies',
    '- [MIT licensed](https://opensource.org/licenses/MIT)',
    '',
    '> Save the file. It will still work in ten years.',
    '',
    '```js',
    'const answer = 6 * 7;',
    'console.log(`the answer is ${answer}`);',
    '```',
    '',
    '| Tool | Offline |',
    '|:-----|:-------:|',
    '| JSON | yes |',
    '| JWT  | yes |',
    '',
    '- [x] write the renderer',
    '- [ ] take a break'
  ].join('\n');

  DevBox.register({
    id: 'markdown',
    icon: 'M↓',
    category: 'text',
    keywords: 'markdown preview render html readme editor commonmark gfm',
    name: { en: 'Markdown Preview', uz: 'Markdown koʻrinishi', ru: 'Просмотр Markdown' },
    desc: {
      en: 'Write Markdown and watch it render, then take the HTML with you. Pasted content is escaped, never executed.',
      uz: 'Markdown yozing va natijasini darhol koʻring, HTML’ni nusxalab oling. Kiritilgan kod hech qachon ishga tushmaydi.',
      ru: 'Пишите Markdown и сразу видите результат, затем забирайте HTML. Вставленный код экранируется, а не выполняется.'
    },

    mount: function (root, ctx) {
      var source = ui.textarea({ tall: true, value: ctx.store.get('source', SAMPLE) });
      var preview = h('div.md-body');
      var stats = h('div.stat-row');

      function run() {
        ctx.store.set('source', source.value.slice(0, 200000));
        var html = DevBox.markdown.render(source.value);
        preview.innerHTML = html;
        // Belt and braces: the renderer already escapes input, and this strips
        // any handler that a future rule change might let through.
        preview.querySelectorAll('*').forEach(function (node) {
          Array.prototype.slice.call(node.attributes).forEach(function (attr) {
            if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
          });
        });
        preview.querySelectorAll('a[href]').forEach(function (a) { a.target = '_blank'; });

        var words = source.value.trim() ? source.value.trim().split(/\s+/).length : 0;
        ui.clear(stats);
        [
          ui.stat(ui.num(source.value.length), 'characters'),
          ui.stat(ui.num(words), 'words'),
          ui.stat(ui.num(source.value.split('\n').length), 'lines'),
          ui.stat(words < 200 ? '<1 min' : Math.round(words / 200) + ' min', 'read time'),
          ui.stat(ui.num((source.value.match(/^#{1,6}\s/gm) || []).length), 'headings')
        ].forEach(function (s) { stats.appendChild(s); });
      }

      function wrapSelection(before, after) {
        var el = source;
        var start = el.selectionStart, end = el.selectionEnd;
        var selected = el.value.slice(start, end) || 'text';
        el.value = el.value.slice(0, start) + before + selected + (after === undefined ? before : after) + el.value.slice(end);
        el.focus();
        el.selectionStart = start + before.length;
        el.selectionEnd = start + before.length + selected.length;
        run();
      }

      function prefixLines(marker) {
        var el = source;
        var start = el.value.lastIndexOf('\n', el.selectionStart - 1) + 1;
        var end = el.value.indexOf('\n', el.selectionEnd);
        if (end < 0) end = el.value.length;
        var block = el.value.slice(start, end).split('\n').map(function (line) { return marker + line; }).join('\n');
        el.value = el.value.slice(0, start) + block + el.value.slice(end);
        el.focus();
        run();
      }

      var toolbar = h('div.row.tight',
        ui.btn('B', function () { wrapSelection('**'); }, 'sm'),
        ui.btn('i', function () { wrapSelection('_'); }, 'sm'),
        ui.btn('code', function () { wrapSelection('`'); }, 'sm'),
        ui.btn('link', function () { wrapSelection('[', '](https://)'); }, 'sm'),
        ui.btn('H2', function () { prefixLines('## '); }, 'sm'),
        ui.btn('list', function () { prefixLines('- '); }, 'sm'),
        ui.btn('quote', function () { prefixLines('> '); }, 'sm'),
        ui.btn('code block', function () { wrapSelection('```\n', '\n```'); }, 'sm')
      );

      var editorCard = ui.card('Markdown', toolbar, h('div.mt12', source));
      editorCard.actions.appendChild(h('button.btn.sm.ghost', {
        type: 'button', onclick: function () { ui.copy(source.value); }
      }, 'Copy source'));

      var previewCard = ui.card('Preview', preview);
      previewCard.actions.appendChild(h('button.btn.sm.ghost', {
        type: 'button', onclick: function () { ui.copy(DevBox.markdown.render(source.value)); }
      }, 'Copy HTML'));
      previewCard.actions.appendChild(h('button.btn.sm.ghost', {
        type: 'button',
        onclick: function () {
          var doc = '<!DOCTYPE html>\n<meta charset="utf-8">\n<title>Document</title>\n' +
            '<style>body{max-width:46rem;margin:3rem auto;padding:0 1.2rem;font:16px/1.65 system-ui,sans-serif}' +
            'pre{background:#f4f6fa;padding:1rem;overflow:auto;border-radius:8px}' +
            'code{background:#f4f6fa;padding:.1em .3em;border-radius:4px}' +
            'table{border-collapse:collapse}th,td{border:1px solid #ddd;padding:.4rem .7rem}</style>\n' +
            DevBox.markdown.render(source.value);
          ui.download('document.html', doc, 'text/html;charset=utf-8');
        }
      }, 'Download HTML'));

      root.appendChild(stats);
      root.appendChild(h('div.grid2', editorCard, previewCard));

      source.addEventListener('input', ui.debounce(run, 150));
      run();
    }
  });
})();
