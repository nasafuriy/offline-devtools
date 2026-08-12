/* Identifier and prose case conversion. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  // Small words that stay lowercase inside a title, unless they lead it.
  var MINOR = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'per', 'so', 'the', 'to', 'up', 'via', 'vs', 'yet'];

  var CASES = [
    ['camelCase', function (w) { return w.map(function (x, i) { return i ? cap(x) : x; }).join(''); }],
    ['PascalCase', function (w) { return w.map(cap).join(''); }],
    ['snake_case', function (w) { return w.join('_'); }],
    ['SCREAMING_SNAKE', function (w) { return w.join('_').toUpperCase(); }],
    ['kebab-case', function (w) { return w.join('-'); }],
    ['COBOL-CASE', function (w) { return w.join('-').toUpperCase(); }],
    ['Train-Case', function (w) { return w.map(cap).join('-'); }],
    ['dot.case', function (w) { return w.join('.'); }],
    ['path/case', function (w) { return w.join('/'); }],
    ['Sentence case', function (w) { return cap(w.join(' ')); }],
    ['Title Case', function (w) {
      return w.map(function (word, i) {
        return (i > 0 && i < w.length - 1 && MINOR.indexOf(word) >= 0) ? word : cap(word);
      }).join(' ');
    }],
    ['lower case', function (w) { return w.join(' '); }],
    ['UPPER CASE', function (w) { return w.join(' ').toUpperCase(); }]
  ];

  DevBox.register({
    id: 'case',
    icon: 'Aa',
    category: 'text',
    keywords: 'case camel pascal snake kebab title upper lower convert naming identifier slug',
    name: { en: 'Case Converter', uz: 'Registr oʻzgartirgich', ru: 'Конвертер регистра' },
    desc: {
      en: 'Rewrite names into camelCase, snake_case, kebab-case, Title Case and nine other conventions at once.',
      uz: 'Nomlarni camelCase, snake_case, kebab-case, Title Case va yana toʻqqizta uslubga bir vaqtda oʻgiradi.',
      ru: 'Преобразование имён в camelCase, snake_case, kebab-case, Title Case и ещё девять вариантов сразу.'
    },

    mount: function (root, ctx) {
      var input = ui.textarea({ short: true, value: ctx.store.get('input', 'getUserProfileByID'), placeholder: 'user profile name' });
      var perLine = ui.checkbox('Convert each line separately', ctx.store.get('perLine', false), run);
      var results = h('div');

      function run() {
        ctx.store.set('input', input.value.slice(0, 20000));
        ctx.store.set('perLine', perLine.checked);
        ui.clear(results);

        var text = input.value;
        if (!text.trim()) return;

        var list = h('dl.kv');
        CASES.forEach(function (entry) {
          var value = perLine.checked
            ? text.split('\n').map(function (line) { return line.trim() ? entry[1](split(line)) : ''; }).join('\n')
            : entry[1](split(text));

          list.appendChild(h('dt', { text: entry[0] }));
          var dd = h('dd', { text: value });
          dd.style.cursor = 'pointer';
          dd.title = 'Click to copy';
          dd.addEventListener('click', function () { ui.copy(value); });
          list.appendChild(dd);
        });
        results.appendChild(list);
      }

      root.appendChild(ui.card('Input', input, h('div.row.mt12', perLine)));
      root.appendChild(ui.card('Every case at once', results));
      root.appendChild(h('div.note', { text: 'Click any result to copy it. Acronyms are split on the case boundary, so “parseHTTPResponse” becomes “parse http response”.' }));

      input.addEventListener('input', ui.debounce(run, 200));
      run();
    }
  });

  /**
   * Splits an identifier into lowercase words. Handles camelCase boundaries,
   * runs of capitals (HTTPServer → http server), digits and any separator.
   */
  function split(text) {
    return String(text)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/([a-zA-Z])(\d)/g, '$1 $2')
      .replace(/(\d)([a-zA-Z])/g, '$1 $2')
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map(function (word) { return word.toLowerCase(); });
  }

  function cap(word) { return word.charAt(0).toUpperCase() + word.slice(1); }
})();
