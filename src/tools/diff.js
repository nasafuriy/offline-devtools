/* Side-by-side and unified text diff. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  DevBox.register({
    id: 'diff',
    icon: '±',
    category: 'text',
    keywords: 'diff compare text changes patch unified merge difference',
    name: { en: 'Text Diff', uz: 'Matn farqi', ru: 'Сравнение текстов' },
    desc: {
      en: 'Compare two blocks of text line by line and export the result as a unified patch.',
      uz: 'Ikki matnni satrma-satr solishtiring va natijani unified patch koʻrinishida saqlang.',
      ru: 'Построчное сравнение двух текстов с экспортом результата в виде unified diff.'
    },

    mount: function (root, ctx) {
      var left = ui.textarea({ tall: true, value: ctx.store.get('left', ''), placeholder: 'Original' });
      var right = ui.textarea({ tall: true, value: ctx.store.get('right', ''), placeholder: 'Changed' });

      var ignoreWhitespace = ui.checkbox('Ignore leading/trailing whitespace', false, run);
      var ignoreCase = ui.checkbox('Ignore case', false, run);
      var ignoreEmpty = ui.checkbox('Ignore blank lines', false, run);
      var view = ui.select({ options: [['inline', 'Inline'], ['split', 'Side by side'], ['unified', 'Unified patch']], value: ctx.store.get('view', 'inline') });

      var summary = h('div');
      var result = h('div.card-body.flush');
      var resultCard = ui.card('Differences', result);
      resultCard.actions.appendChild(h('button.btn.sm.ghost', {
        type: 'button',
        onclick: function () { ui.copy(unified(compute().ops)); }
      }, 'Copy patch'));

      function normalise(value) {
        var out = value.replace(/\r\n?/g, '\n').split('\n');
        if (ignoreEmpty.checked) out = out.filter(function (line) { return line.trim() !== ''; });
        return out;
      }

      function key(line) {
        var k = line;
        if (ignoreWhitespace.checked) k = k.trim();
        if (ignoreCase.checked) k = k.toLowerCase();
        return k;
      }

      function compute() {
        var a = normalise(left.value);
        var b = normalise(right.value);
        // Diff on the normalised keys, then map back to the original text.
        var res = DevBox.diff.lines(a.map(key), b.map(key));
        var ai = 0, bi = 0;
        res.ops.forEach(function (op) {
          if (op.type === 'del') op.text = a[ai++];
          else if (op.type === 'add') op.text = b[bi++];
          else { op.text = a[ai++]; bi++; }
        });
        return res;
      }

      function run() {
        ctx.store.set('left', left.value.slice(0, 200000));
        ctx.store.set('right', right.value.slice(0, 200000));
        ctx.store.set('view', view.value);

        ui.clear(summary);
        ui.clear(result);

        if (!left.value && !right.value) {
          result.appendChild(h('div.note', { style: { padding: '14px' }, text: 'Paste text into both panes to compare them.' }));
          return;
        }

        var res = compute();
        var added = res.ops.filter(function (o) { return o.type === 'add'; }).length;
        var removed = res.ops.filter(function (o) { return o.type === 'del'; }).length;
        var same = res.ops.length - added - removed;

        summary.appendChild(h('div.stat-row',
          ui.stat('+' + ui.num(added), 'added'),
          ui.stat('−' + ui.num(removed), 'removed'),
          ui.stat(ui.num(same), 'unchanged'),
          ui.stat(res.ops.length ? Math.round(same / res.ops.length * 100) + '%' : '—', 'similarity')
        ));

        if (res.truncated) {
          summary.appendChild(h('div.mt8', ui.banner('warn',
            'These inputs differ too much to diff precisely, so the whole block is shown as removed then added.')));
        }

        if (!added && !removed) {
          result.appendChild(h('div', { style: { padding: '14px' } }, ui.banner('ok', 'The two texts are identical.')));
          return;
        }

        if (view.value === 'unified') {
          result.appendChild(h('pre.out', { style: { margin: '0', border: '0', borderRadius: '0' }, text: unified(res.ops) }));
        } else if (view.value === 'split') {
          result.appendChild(splitView(res.ops));
        } else {
          result.appendChild(inlineView(res.ops));
        }
      }

      function inlineView(ops) {
        var host = h('div', { style: { padding: '6px 0' } });
        ops.forEach(function (op) {
          host.appendChild(h('div.diff-line.diff-' + op.type,
            h('span.diff-num', { text: op.type === 'add' ? '' : String(op.a) }),
            h('span.diff-num', { text: op.type === 'del' ? '' : String(op.b) }),
            h('span.diff-txt', { text: op.text })
          ));
        });
        return host;
      }

      function splitView(ops) {
        var leftHost = h('div', { style: { padding: '6px 0', borderRight: '1px solid var(--border)', overflowX: 'auto' } });
        var rightHost = h('div', { style: { padding: '6px 0', overflowX: 'auto' } });

        // Pair each deletion with the following addition so rows line up.
        for (var i = 0; i < ops.length; i++) {
          var op = ops[i];
          if (op.type === 'eq') {
            leftHost.appendChild(row('eq', op.a, op.text));
            rightHost.appendChild(row('eq', op.b, op.text));
          } else if (op.type === 'del') {
            var partner = ops[i + 1] && ops[i + 1].type === 'add' ? ops[i + 1] : null;
            leftHost.appendChild(row('del', op.a, op.text));
            rightHost.appendChild(partner ? row('add', partner.b, partner.text) : row('gap', '', ''));
            if (partner) i++;
          } else {
            leftHost.appendChild(row('gap', '', ''));
            rightHost.appendChild(row('add', op.b, op.text));
          }
        }

        return h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr' } }, leftHost, rightHost);
      }

      function row(kind, number, content) {
        return h('div.diff-line.diff-' + kind,
          h('span.diff-num', { text: number === '' ? '' : String(number) }),
          h('span.diff-txt', { text: content })
        );
      }

      root.appendChild(h('div.grid2',
        ui.card('Original', left),
        ui.card('Changed', right)
      ));
      root.appendChild(h('div.row', view, ignoreWhitespace, ignoreCase, ignoreEmpty,
        h('div.spacer'),
        ui.btn('Swap sides', function () {
          var tmp = left.value; left.value = right.value; right.value = tmp; run();
        }, 'ghost')
      ));
      root.appendChild(summary);
      root.appendChild(resultCard);

      left.addEventListener('input', ui.debounce(run, 400));
      right.addEventListener('input', ui.debounce(run, 400));
      view.addEventListener('change', run);
      run();
    }
  });

  /** Standard unified diff with three lines of context per hunk. */
  function unified(ops) {
    var CONTEXT = 3;
    var keep = new Array(ops.length).fill(false);

    ops.forEach(function (op, i) {
      if (op.type === 'eq') return;
      for (var j = Math.max(0, i - CONTEXT); j <= Math.min(ops.length - 1, i + CONTEXT); j++) keep[j] = true;
    });

    var out = ['--- original', '+++ changed'];
    var i = 0;
    while (i < ops.length) {
      if (!keep[i]) { i++; continue; }

      var start = i;
      while (i < ops.length && keep[i]) i++;
      var hunk = ops.slice(start, i);

      var aStart = 0, bStart = 0, aCount = 0, bCount = 0;
      hunk.forEach(function (op) {
        if (op.type !== 'add') { aStart = aStart || op.a; aCount++; }
        if (op.type !== 'del') { bStart = bStart || op.b; bCount++; }
      });

      out.push('@@ -' + (aStart || 0) + ',' + aCount + ' +' + (bStart || 0) + ',' + bCount + ' @@');
      hunk.forEach(function (op) {
        out.push((op.type === 'add' ? '+' : op.type === 'del' ? '-' : ' ') + op.text);
      });
    }

    return out.length > 2 ? out.join('\n') : 'No differences.';
  }
})();
