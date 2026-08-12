/* Live regular-expression tester with capture groups and replacement preview. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  var CHEATS = [
    ['.', 'any character except a newline'],
    ['\\d  \\w  \\s', 'digit, word character, whitespace'],
    ['\\D  \\W  \\S', 'the negation of each'],
    ['[abc]  [^abc]', 'one of / none of these characters'],
    ['[a-z0-9]', 'character ranges'],
    ['^  $', 'start and end of the string (or line, with m)'],
    ['\\b  \\B', 'word boundary / not a word boundary'],
    ['*  +  ?', '0 or more, 1 or more, optional'],
    ['{2}  {2,}  {2,5}', 'exact, at-least, and bounded repetition'],
    ['*?  +?', 'lazy quantifiers — match as little as possible'],
    ['(abc)', 'capture group'],
    ['(?:abc)', 'group without capturing'],
    ['(?<name>abc)', 'named capture group'],
    ['a|b', 'alternation'],
    ['(?=abc)  (?!abc)', 'lookahead: followed by / not followed by'],
    ['(?<=abc)  (?<!abc)', 'lookbehind: preceded by / not preceded by'],
    ['$1  $<name>', 'back-references in the replacement string']
  ];

  var SAMPLES = [
    ['\\b[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}\\b', 'Email address'],
    ['^(?:\\+?998)?[\\s-]?\\d{2}[\\s-]?\\d{3}[\\s-]?\\d{2}[\\s-]?\\d{2}$', 'Uzbek phone number'],
    ['^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$', 'IPv4 address'],
    ['https?://[^\\s"\'<>]+', 'URL'],
    ['^#?([a-f\\d]{3}|[a-f\\d]{6})$', 'Hex colour'],
    ['^\\d{4}-\\d{2}-\\d{2}$', 'ISO date'],
    ['(?<year>\\d{4})-(?<month>\\d{2})', 'Named groups']
  ];

  DevBox.register({
    id: 'regex',
    icon: '.*',
    category: 'text',
    keywords: 'regex regexp regular expression test match replace pattern groups capture',
    name: { en: 'Regex Tester', uz: 'Regex sinovchi', ru: 'Тестер регулярок' },
    desc: {
      en: 'Test a pattern against sample text as you type, inspect every capture group, and preview a replacement.',
      uz: 'Naqshni matn ustida jonli sinang, har bir guruhni koʻring va almashtirish natijasini oldindan koʻring.',
      ru: 'Проверяйте шаблон на тексте в реальном времени, разбирайте группы и смотрите результат замены.'
    },

    mount: function (root, ctx) {
      var pattern = ui.input({ placeholder: '\\b\\w+@\\w+\\.\\w+\\b', value: ctx.store.get('pattern', '\\b[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}\\b') });

      var flagBoxes = {};
      var flagRow = h('div.row.tight');
      [['g', 'global'], ['i', 'ignore case'], ['m', 'multiline ^$'], ['s', 'dot matches newline'], ['u', 'unicode'], ['y', 'sticky']].forEach(function (pair) {
        var saved = ctx.store.get('flag_' + pair[0], pair[0] === 'g' || pair[0] === 'm');
        var box = ui.checkbox(pair[0] + ' — ' + pair[1], saved, function () {
          ctx.store.set('flag_' + pair[0], box.checked);
          run();
        });
        flagBoxes[pair[0]] = box;
        flagRow.appendChild(box);
      });

      var subject = ui.textarea({
        tall: true,
        value: ctx.store.get('subject', 'Contact ada@example.com or team@shashka.dev.\nInvalid: nope@nope\nAlso reach salom@misol.uz today.')
      });

      var replacement = ui.input({ placeholder: '<$&>  or  $1', value: ctx.store.get('replacement', '') });

      var status = h('div');
      var highlighted = h('div.out.hl');
      var groupsHost = h('div');
      var replaceOut = ui.output({ title: 'After replacement' });

      var samples = h('div.row.tight.mt12');
      SAMPLES.forEach(function (sample) {
        samples.appendChild(ui.chip(sample[1], function () { pattern.value = sample[0]; run(); }));
      });

      function flags() {
        return Object.keys(flagBoxes).filter(function (f) { return flagBoxes[f].checked; }).join('');
      }

      function run() {
        ctx.store.set('pattern', pattern.value.slice(0, 2000));
        ctx.store.set('subject', subject.value.slice(0, 50000));
        ctx.store.set('replacement', replacement.value.slice(0, 500));

        ui.clear(status);
        ui.clear(groupsHost);
        ui.clear(highlighted);

        if (!pattern.value) {
          highlighted.textContent = subject.value;
          replaceOut.set('');
          return;
        }

        var re;
        try {
          re = new RegExp(pattern.value, flags());
        } catch (err) {
          status.appendChild(ui.banner('err', err.message));
          highlighted.textContent = subject.value;
          replaceOut.set('');
          return;
        }

        var matches = collect(re, subject.value);
        status.appendChild(matches.length
          ? ui.banner('ok', matches.length + ' match' + (matches.length === 1 ? '' : 'es') + ' found.')
          : ui.banner('warn', 'No matches.'));

        highlighted.appendChild(highlight(subject.value, matches));

        if (matches.length) groupsHost.appendChild(groupTable(matches));

        try {
          replaceOut.set(subject.value.replace(re, replacement.value));
        } catch (err) {
          replaceOut.set(err.message, 'err');
        }
      }

      function groupTable(matches) {
        var groupCount = matches.reduce(function (max, m) { return Math.max(max, m.groups.length); }, 0);
        var names = matches[0].names || [];

        var head = [h('th', '#'), h('th', 'Match'), h('th', 'Index')];
        for (var g = 1; g <= groupCount; g++) head.push(h('th', names[g - 1] ? '$' + g + ' ' + names[g - 1] : '$' + g));

        var body = matches.slice(0, 300).map(function (m, i) {
          var cells = [
            h('td', { text: String(i + 1) }),
            h('td.mono', { text: m.text === '' ? '(empty)' : m.text }),
            h('td.mono', { text: String(m.index) })
          ];
          for (var g2 = 0; g2 < groupCount; g2++) {
            cells.push(h('td.mono', { text: m.groups[g2] === undefined ? '—' : m.groups[g2] }));
          }
          return h('tr', cells);
        });

        var card = ui.card('Matches', h('div.tbl-scroll', h('table.tbl', h('thead', h('tr', head)), h('tbody', body))));
        card.body.classList.add('flush');
        card.actions.appendChild(h('button.btn.sm.ghost', {
          type: 'button',
          onclick: function () { ui.copy(matches.map(function (m) { return m.text; }).join('\n')); }
        }, 'Copy all matches'));
        return card;
      }

      root.appendChild(ui.card('Pattern', pattern, h('div.mt12', flagRow), samples));
      root.appendChild(ui.card('Test against', subject));
      root.appendChild(status);
      root.appendChild(ui.card('Highlighted', highlighted));
      root.appendChild(groupsHost);
      root.appendChild(ui.card('Replace with', replacement,
        h('div.note.mt8', { text: 'Use $& for the whole match, $1 for the first group, $<name> for a named group, and $$ for a literal dollar sign.' })));
      root.appendChild(replaceOut);

      var cheatTable = h('table.tbl', h('tbody', CHEATS.map(function (row) {
        return h('tr', h('td.mono', { text: row[0] }), h('td', { text: row[1] }));
      })));
      var cheatCard = ui.card('Cheat sheet', h('div.tbl-scroll', cheatTable));
      cheatCard.body.classList.add('flush');
      root.appendChild(cheatCard);

      pattern.control.addEventListener('input', ui.debounce(run, 250));
      subject.addEventListener('input', ui.debounce(run, 250));
      replacement.control.addEventListener('input', ui.debounce(run, 250));
      run();
    }
  });

  /** Collects matches with a guard against zero-length-match infinite loops. */
  function collect(re, text) {
    var out = [];
    if (!re.global && !re.sticky) {
      var single = re.exec(text);
      if (single) out.push(toMatch(single));
      return out;
    }

    re.lastIndex = 0;
    var m, guard = 0;
    while ((m = re.exec(text)) !== null) {
      out.push(toMatch(m));
      if (m[0] === '') re.lastIndex++;
      if (++guard > 20000) break;
    }
    return out;
  }

  function toMatch(m) {
    return {
      text: m[0],
      index: m.index,
      groups: m.slice(1),
      names: m.groups ? Object.keys(m.groups) : []
    };
  }

  function highlight(text, matches) {
    var frag = document.createDocumentFragment();
    var last = 0;
    matches.forEach(function (m) {
      if (m.index < last) return;   // overlapping results cannot be drawn twice
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var mark = h('mark', { text: m.text === '' ? String.fromCharCode(0x200B) : m.text });
      if (m.text === '') mark.classList.add('empty-match');
      frag.appendChild(mark);
      last = m.index + m.text.length;
    });
    frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }
})();
