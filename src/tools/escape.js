/* Escaping and unescaping for the formats that bite most often. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  var NAMED = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  var MODES = {
    html: {
      label: 'HTML entities',
      hint: 'Turns & < > " \' into entities so text is safe inside markup.',
      escape: function (s) { return s.replace(/[&<>"']/g, function (c) { return NAMED[c]; }); },
      unescape: function (s) {
        return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, function (whole, body) {
          if (body[0] === '#') {
            var code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
            return isFinite(code) ? String.fromCodePoint(code) : whole;
          }
          var map = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', copy: '\u00a9', reg: '\u00ae', hellip: '\u2026', mdash: '\u2014', ndash: '\u2013' };
          return map[body.toLowerCase()] || whole;
        });
      }
    },
    js: {
      label: 'JavaScript / JSON string',
      hint: 'Produces the body of a double-quoted string literal.',
      escape: function (s) { return JSON.stringify(s).slice(1, -1); },
      unescape: function (s) {
        // Hand-rolled rather than JSON.parse, so a stray `C:\path` degrades to
        // itself instead of throwing.
        var simple = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' };
        return s.replace(/\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([\s\S]))/g,
          function (whole, brace, u4, x2, ch) {
            if (brace) return String.fromCodePoint(parseInt(brace, 16));
            if (u4) return String.fromCharCode(parseInt(u4, 16));
            if (x2) return String.fromCharCode(parseInt(x2, 16));
            return simple[ch] !== undefined ? simple[ch] : ch;
          });
      }
    },
    sql: {
      label: 'SQL string literal',
      hint: "Doubles single quotes. Escaping is not a substitute for parameterised queries.",
      escape: function (s) { return s.replace(/'/g, "''"); },
      unescape: function (s) { return s.replace(/''/g, "'"); }
    },
    shell: {
      label: 'POSIX shell argument',
      hint: 'Wraps the value in single quotes so the shell treats it as one literal argument.',
      escape: function (s) { return "'" + s.replace(/'/g, "'\\''") + "'"; },
      unescape: function (s) { return s.replace(/^'|'$/g, '').replace(/'\\''/g, "'"); }
    },
    powershell: {
      label: 'PowerShell argument',
      hint: 'Single-quoted PowerShell literal: internal quotes are doubled.',
      escape: function (s) { return "'" + s.replace(/'/g, "''") + "'"; },
      unescape: function (s) { return s.replace(/^'|'$/g, '').replace(/''/g, "'"); }
    },
    regex: {
      label: 'Regular expression',
      hint: 'Escapes every character with a special meaning in a regex.',
      escape: function (s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); },
      unescape: function (s) { return s.replace(/\\([.*+?^${}()|[\]\\\/])/g, '$1'); }
    },
    unicode: {
      label: 'Unicode \\uXXXX',
      hint: 'Escapes every non-ASCII character to a \\uXXXX sequence.',
      escape: function (s) {
        return s.replace(/[^\x20-\x7E]/g, function (c) {
          return '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
        });
      },
      unescape: function (s) {
        return s.replace(/\\u\{([0-9a-f]+)\}/gi, function (_, hex) { return String.fromCodePoint(parseInt(hex, 16)); })
          .replace(/\\u([0-9a-f]{4})/gi, function (_, hex) { return String.fromCharCode(parseInt(hex, 16)); })
          .replace(/\\x([0-9a-f]{2})/gi, function (_, hex) { return String.fromCharCode(parseInt(hex, 16)); });
      }
    },
    csv: {
      label: 'CSV field',
      hint: 'Quotes the field when it contains a comma, quote or newline.',
      escape: function (s) { return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; },
      unescape: function (s) { return /^"[\s\S]*"$/.test(s) ? s.slice(1, -1).replace(/""/g, '"') : s; }
    },
    xml: {
      label: 'XML attribute',
      hint: 'Entity-encodes the five predefined XML characters.',
      escape: function (s) { return s.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]; }); },
      unescape: function (s) { return s.replace(/&(amp|lt|gt|quot|apos);/g, function (_, n) { return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[n]; }); }
    }
  };

  DevBox.register({
    id: 'escape',
    icon: '\\',
    category: 'data',
    keywords: 'escape unescape html entities javascript json sql shell regex unicode xml quote',
    name: { en: 'Escape / Unescape', uz: 'Ekranlash / qaytarish', ru: 'Экранирование' },
    desc: {
      en: 'Escape text for HTML, JSON, SQL, shells, regex, XML, CSV or Unicode — and reverse any of them.',
      uz: 'Matnni HTML, JSON, SQL, shell, regex, XML, CSV yoki Unicode uchun ekranlash va teskarisiga qaytarish.',
      ru: 'Экранирование текста для HTML, JSON, SQL, shell, regex, XML, CSV и Unicode — и обратное преобразование.'
    },

    mount: function (root, ctx) {
      var mode = ui.select({
        options: Object.keys(MODES).map(function (key) { return [key, MODES[key].label]; }),
        value: ctx.store.get('mode', 'html')
      });

      var hint = h('div.note');
      var input = ui.textarea({ placeholder: 'Text to escape', value: ctx.store.get('input', '') });
      var out = ui.output({ title: 'Result' });

      function describe() {
        hint.textContent = MODES[mode.value].hint;
        ctx.store.set('mode', mode.value);
      }

      function apply(direction) {
        describe();
        ctx.store.set('input', input.value.slice(0, 50000));
        if (!input.value) return out.set('');
        try {
          out.set(MODES[mode.value][direction](input.value));
        } catch (err) {
          out.set('Could not ' + direction + ': ' + err.message, 'err');
        }
      }

      root.appendChild(ui.card('Input',
        h('div.row', mode, ui.btn('Escape', function () { apply('escape'); }, 'primary'), ui.btn('Unescape', function () { apply('unescape'); })),
        h('div.mt8', hint),
        h('div.mt12', input)
      ));
      root.appendChild(out);

      mode.addEventListener('change', function () { apply('escape'); });
      input.addEventListener('input', ui.debounce(function () { apply('escape'); }, 250));
      describe();
      if (input.value) apply('escape');
    }
  });
})();
