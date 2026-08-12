/* ============================================================
   Minimal CommonMark-ish renderer.
   Everything is HTML-escaped before any markup is produced, and
   URLs are filtered, so pasted content can never inject script.
   ============================================================ */
(function () {
  'use strict';

  // Private Use Area character used to park inline code while the other
  // inline rules run. Built at runtime so no literal escape lands in source.
  var SENTINEL = String.fromCharCode(0xE000);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function safeUrl(url) {
    var u = String(url).trim();
    if (/^\s*javascript:/i.test(u) || /^\s*data:(?!image\/(png|jpe?g|gif|webp|svg\+xml))/i.test(u) || /^\s*vbscript:/i.test(u)) {
      return '#';
    }
    return esc(u);
  }

  /* ---------------------------------------------------------- inline */

  function inline(src) {
    var text = esc(src);

    // Pick a marker the text cannot already contain, then park every code
    // span behind it so later rules never rewrite code contents.
    var mark = SENTINEL;
    while (text.indexOf(mark) >= 0) mark += SENTINEL;

    var codes = [];
    text = text.replace(/(`+)([\s\S]*?)\1/g, function (_, ticks, body) {
      codes.push('<code>' + body.replace(/^ | $/g, '') + '</code>');
      return mark + (codes.length - 1) + mark;
    });

    text = text
      .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
        function (_, alt, url, title) { return '<img src="' + safeUrl(url) + '" alt="' + alt + '"' + (title ? ' title="' + title + '"' : '') + '>'; })
      .replace(/\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
        function (_, label, url, title) { return '<a href="' + safeUrl(url) + '" rel="noopener noreferrer"' + (title ? ' title="' + title + '"' : '') + '>' + label + '</a>'; })
      .replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, function (_, url) { return '<a href="' + safeUrl(url) + '" rel="noopener noreferrer">' + url + '</a>'; })
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, function (_, pre, url) { return pre + '<a href="' + safeUrl(url) + '" rel="noopener noreferrer">' + url + '</a>'; })
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\W)__([^_]+)__(?=\W|$)/g, '$1<strong>$2</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/(^|\W)_([^_\n]+)_(?=\W|$)/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/ {2,}\n/g, '<br>\n');

    return text.replace(new RegExp(mark + '(\\d+)' + mark, 'g'), function (_, i) { return codes[+i]; });
  }

  /* ---------------------------------------------------------- blocks */

  function render(src) {
    var lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      // Fenced code
      var fence = /^(\s*)(`{3,}|~{3,})\s*([\w+-]*)\s*$/.exec(line);
      if (fence) {
        var marker = fence[2][0];
        var body = [];
        i++;
        while (i < lines.length && !new RegExp('^\\s*' + marker + '{3,}\\s*$').test(lines[i])) body.push(lines[i++]);
        i++;
        out.push('<pre><code' + (fence[3] ? ' class="lang-' + esc(fence[3]) + '"' : '') + '>' + esc(body.join('\n')) + '</code></pre>');
        continue;
      }

      if (/^\s*$/.test(line)) { i++; continue; }

      if (/^ {0,3}(?:---+|\*\*\*+|___+)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

      var heading = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
      if (heading) {
        var level = heading[1].length;
        out.push('<h' + level + '>' + inline(heading[2]) + '</h' + level + '>');
        i++;
        continue;
      }

      // Setext heading
      if (i + 1 < lines.length && /^ {0,3}=+\s*$/.test(lines[i + 1]) && !/^\s*$/.test(line)) {
        out.push('<h1>' + inline(line.trim()) + '</h1>'); i += 2; continue;
      }

      // Table
      if (line.indexOf('|') >= 0 && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) && /-/.test(lines[i + 1])) {
        var header = splitRow(line);
        var aligns = splitRow(lines[i + 1]).map(function (cell) {
          var t = cell.trim();
          var left = t[0] === ':', right = t.slice(-1) === ':';
          return right && left ? 'center' : (right ? 'right' : (left ? 'left' : ''));
        });
        i += 2;
        var rows = [];
        while (i < lines.length && lines[i].indexOf('|') >= 0 && !/^\s*$/.test(lines[i])) rows.push(splitRow(lines[i++]));

        var html = '<table><thead><tr>' + header.map(function (cell, c) {
          return '<th' + (aligns[c] ? ' style="text-align:' + aligns[c] + '"' : '') + '>' + inline(cell.trim()) + '</th>';
        }).join('') + '</tr></thead><tbody>';
        rows.forEach(function (row) {
          html += '<tr>' + header.map(function (_, c) {
            return '<td' + (aligns[c] ? ' style="text-align:' + aligns[c] + '"' : '') + '>' + inline((row[c] || '').trim()) + '</td>';
          }).join('') + '</tr>';
        });
        out.push(html + '</tbody></table>');
        continue;
      }

      // Blockquote
      if (/^ {0,3}>/.test(line)) {
        var quoted = [];
        while (i < lines.length && (/^ {0,3}>/.test(lines[i]) || (!/^\s*$/.test(lines[i]) && quoted.length))) {
          quoted.push(lines[i].replace(/^ {0,3}>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + render(quoted.join('\n')) + '</blockquote>');
        continue;
      }

      // Lists
      if (/^\s*([-*+]|\d{1,9}[.)])\s+/.test(line)) {
        var block = [];
        while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^ {0,3}(?:---+|\*\*\*+)\s*$/.test(lines[i])) block.push(lines[i++]);
        // Absorb loose list items separated by a single blank line.
        while (i + 1 < lines.length && /^\s*$/.test(lines[i]) && /^\s*([-*+]|\d{1,9}[.)])\s+/.test(lines[i + 1])) {
          i++;
          while (i < lines.length && !/^\s*$/.test(lines[i])) block.push(lines[i++]);
        }
        out.push(renderList(block));
        continue;
      }

      // Paragraph
      var para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) &&
             !/^ {0,3}(#{1,6})\s/.test(lines[i]) &&
             !/^ {0,3}>/.test(lines[i]) &&
             !/^\s*(`{3,}|~{3,})/.test(lines[i]) &&
             !/^ {0,3}(?:---+|\*\*\*+|___+)\s*$/.test(lines[i]) &&
             !/^\s*([-*+]|\d{1,9}[.)])\s+/.test(lines[i])) {
        para.push(lines[i++]);
      }
      if (para.length) out.push('<p>' + inline(para.join('\n')) + '</p>');
      else i++;
    }

    return out.join('\n');
  }

  function splitRow(line) {
    return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
  }

  /** Builds nested <ul>/<ol> from a run of list lines using indent depth. */
  function renderList(lines) {
    var items = [];
    lines.forEach(function (line) {
      var m = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/.exec(line);
      if (m) {
        items.push({
          indent: m[1].replace(/\t/g, '    ').length,
          ordered: /\d/.test(m[2]),
          text: [m[3]]
        });
      } else if (items.length) {
        items[items.length - 1].text.push(line.trim());
      }
    });
    if (!items.length) return '';
    return build(items, 0).html;
  }

  function build(items, index) {
    var baseIndent = items[index].indent;
    var ordered = items[index].ordered;
    var html = ordered ? '<ol>' : '<ul>';

    while (index < items.length && items[index].indent >= baseIndent) {
      if (items[index].indent > baseIndent) {
        var nested = build(items, index);
        html = html.replace(/<\/li>$/, nested.html + '</li>');
        index = nested.index;
        continue;
      }
      var item = items[index];
      var text = item.text.join('\n');
      var task = /^\[([ xX])\]\s+([\s\S]*)$/.exec(text);
      if (task) {
        html += '<li><input type="checkbox" disabled' + (task[1] === ' ' ? '' : ' checked') + '> ' + inline(task[2]) + '</li>';
      } else {
        html += '<li>' + inline(text) + '</li>';
      }
      index++;
    }

    return { html: html + (ordered ? '</ol>' : '</ul>'), index: index };
  }

  window.DevBox = window.DevBox || {};
  window.DevBox.markdown = { render: render, escape: esc };
})();
