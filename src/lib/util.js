/* ============================================================
   Shashka — DOM + formatting helpers shared by every tool.
   Defines the global `DevBox` namespace. Loaded first.
   ============================================================ */
(function () {
  'use strict';

  var DevBox = window.DevBox = window.DevBox || {};

  /* ---------------------------------------------------------- hyperscript */

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SVG_TAGS = { svg: 1, path: 1, circle: 1, rect: 1, g: 1, line: 1, text: 1, polygon: 1, polyline: 1, defs: 1, linearGradient: 1, stop: 1 };

  /**
   * h('div.card', {onclick: fn}, child, child…)
   * Tag supports `tag.class.class` and `tag#id` shorthand.
   * Props: `class`, `html` (trusted innerHTML), `style` (object or string),
   * `on*` handlers, `data` object, anything else becomes an attribute.
   */
  function h(spec, props) {
    var parts = String(spec).split(/(?=[.#])/);
    var tag = parts[0] || 'div';
    var node = SVG_TAGS[tag] ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);

    for (var i = 1; i < parts.length; i++) {
      if (parts[i][0] === '#') node.id = parts[i].slice(1);
      else node.classList.add(parts[i].slice(1));
    }

    var start = 2;
    if (props && props.constructor === Object) {
      for (var k in props) {
        var v = props[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class' || k === 'className') { String(v).split(/\s+/).filter(Boolean).forEach(function (c) { node.classList.add(c); }); }
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') { for (var s in v) node.style[s] = v[s]; }
        else if (k === 'data') { for (var d in v) node.dataset[d] = v[d]; }
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k in node && !SVG_TAGS[tag] && k !== 'list' && k !== 'type' && k !== 'size') { try { node[k] = v; } catch (e) { node.setAttribute(k, v); } }
        else node.setAttribute(k, v === true ? '' : v);
      }
    } else { start = 1; }

    for (var a = start; a < arguments.length; a++) append(node, arguments[a]);
    return node;
  }

  function append(node, child) {
    if (child === null || child === undefined || child === false || child === true) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(node, c); }); return; }
    node.appendChild(child.nodeType ? child : document.createTextNode(String(child)));
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

  /* ---------------------------------------------------------- form controls */

  function labeled(labelText, control) {
    if (!labelText) return control;
    return h('div', h('label.lbl', { text: labelText }), control);
  }

  function textarea(opts) {
    opts = opts || {};
    var ta = h('textarea', {
      placeholder: opts.placeholder || '',
      spellcheck: false,
      rows: opts.rows || undefined,
      value: opts.value || ''
    });
    ta.classList.add('mono');
    if (opts.plain) ta.classList.remove('mono');
    if (opts.tall) ta.classList.add('tall');
    if (opts.short) ta.classList.add('short');
    if (opts.oninput) ta.addEventListener('input', opts.oninput);
    return opts.label ? withRef(labeled(opts.label, ta), ta) : bare(ta);
  }

  function input(opts) {
    opts = opts || {};
    var el = h('input', {
      type: opts.type || 'text',
      placeholder: opts.placeholder || '',
      spellcheck: false
    });
    // Range and number inputs clamp against min/max, so set the bounds first.
    if (opts.min !== undefined) el.min = opts.min;
    if (opts.max !== undefined) el.max = opts.max;
    if (opts.step !== undefined) el.step = opts.step;
    el.value = opts.value === undefined ? '' : opts.value;

    if (opts.mono !== false && (opts.type || 'text') === 'text') el.classList.add('mono');
    if (opts.oninput) el.addEventListener('input', opts.oninput);
    if (opts.onchange) el.addEventListener('change', opts.onchange);
    return opts.label ? withRef(labeled(opts.label, el), el) : bare(el);
  }

  function select(opts) {
    opts = opts || {};
    var el = h('select');
    (opts.options || []).forEach(function (o) {
      var value = Array.isArray(o) ? o[0] : o;
      var text = Array.isArray(o) ? o[1] : o;
      el.appendChild(h('option', { value: value, text: text }));
    });
    if (opts.value !== undefined) el.value = opts.value;
    if (opts.onchange) el.addEventListener('change', opts.onchange);
    return opts.label ? withRef(labeled(opts.label, el), el) : bare(el);
  }

  /** Unlabelled controls still answer to `.control`, so call sites stay uniform. */
  function bare(el) { el.control = el; return el; }

  function checkbox(label, checked, onchange) {
    var box = h('input', { type: 'checkbox' });
    box.checked = !!checked;
    if (onchange) box.addEventListener('change', onchange);
    var wrap = h('label.check', box, h('span', { text: label }));
    wrap.input = box;
    Object.defineProperty(wrap, 'checked', { get: function () { return box.checked; }, set: function (v) { box.checked = v; } });
    return wrap;
  }

  /** Wraps a labelled control so the wrapper proxies `.value` to the control. */
  function withRef(wrapper, control) {
    wrapper.control = control;
    Object.defineProperty(wrapper, 'value', {
      get: function () { return control.value; },
      set: function (v) { control.value = v; }
    });
    wrapper.focus = function () { control.focus(); };
    return wrapper;
  }

  function btn(label, onclick, variant) {
    return h('button.btn' + (variant ? '.' + variant.split(' ').join('.') : ''), { onclick: onclick, type: 'button' }, label);
  }

  function chip(label, onclick, on) {
    var c = h('button.chip', { onclick: onclick, type: 'button' }, label);
    if (on) c.classList.add('on');
    if (!onclick) c.classList.add('static');
    return c;
  }

  /* ---------------------------------------------------------- containers */

  function card(title) {
    var body = h('div.card-body');
    var head = null;
    var actions = h('div.row.tight');
    if (title) {
      head = h('div.card-head', h('span', { text: title }), h('div.spacer'), actions);
    }
    var root = h('div.card', head, body);
    for (var i = 1; i < arguments.length; i++) append(body, arguments[i]);
    root.body = body;
    root.actions = actions;
    return root;
  }

  /** Read-only output block with a built-in copy button. */
  function output(opts) {
    opts = opts || {};
    var pre = h('div.out.empty', { text: opts.placeholder || '—' });
    var wrap = card(opts.title || 'Output', pre);
    var copyBtn = h('button.btn.sm.ghost', { type: 'button', onclick: function () { copy(pre.__raw || ''); } }, 'Copy');
    wrap.actions.appendChild(copyBtn);
    if (opts.download) {
      wrap.actions.appendChild(h('button.btn.sm.ghost', {
        type: 'button',
        onclick: function () { download(typeof opts.download === 'function' ? opts.download() : opts.download, pre.__raw || ''); }
      }, 'Download'));
    }
    wrap.set = function (text, kind) {
      pre.__raw = text == null ? '' : String(text);
      pre.textContent = pre.__raw || (opts.placeholder || '—');
      pre.classList.toggle('empty', !pre.__raw);
      pre.style.color = kind === 'err' ? 'var(--err)' : '';
      return wrap;
    };
    wrap.setNode = function (node) {
      pre.__raw = node && node.__raw || '';
      clear(pre).appendChild(node);
      pre.classList.remove('empty');
      return wrap;
    };
    wrap.pre = pre;
    return wrap;
  }

  function stat(value, label) {
    return h('div.stat', h('b', { text: String(value) }), h('span', { text: label }));
  }

  function banner(kind, text) { return h('div.banner.' + kind, h('span', { text: text })); }

  /* ---------------------------------------------------------- clipboard / files */

  function copy(text) {
    text = String(text == null ? '' : text);
    if (!text) { toast('Nothing to copy'); return Promise.resolve(false); }
    var done = function () { toast('Copied', 'ok'); return true; };
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(done, function () { return legacyCopy(text) ? done() : fail(); });
    }
    return Promise.resolve(legacyCopy(text) ? done() : fail());
    function fail() { toast('Copy failed — select and press Ctrl+C', 'err'); return false; }
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function download(filename, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: filename || 'shashka.txt' });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast('Saved ' + (filename || 'file'), 'ok');
  }

  /** Click-or-drop file picker. `onfile(File)` fires for each accepted file. */
  function dropzone(text, onfile, opts) {
    opts = opts || {};
    var picker = h('input', { type: 'file', accept: opts.accept || '', style: { display: 'none' } });
    if (opts.multiple) picker.multiple = true;
    var zone = h('div.dropzone', h('span', { text: text }), picker);

    picker.addEventListener('change', function () {
      Array.prototype.forEach.call(picker.files, onfile);
      picker.value = '';
    });
    zone.addEventListener('click', function (e) { if (e.target !== picker) picker.click(); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('over'); });
    });
    zone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) Array.prototype.forEach.call(e.dataTransfer.files, onfile);
    });
    return zone;
  }

  /* ---------------------------------------------------------- toast */

  function toast(msg, kind) {
    var host = document.getElementById('toaster');
    if (!host) return;
    var t = h('div.toast' + (kind ? '.' + kind : ''), { text: msg });
    host.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .2s, transform .2s';
      t.style.opacity = '0';
      t.style.transform = 'translateX(10px)';
      setTimeout(function () { t.remove(); }, 220);
    }, 1800);
  }

  /* ---------------------------------------------------------- formatting */

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function bytes(n) {
    if (!isFinite(n)) return '—';
    var units = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return (i === 0 ? n : n.toFixed(n < 10 ? 2 : 1)) + ' ' + units[i];
  }

  function num(n) { return Number(n).toLocaleString('en-US'); }

  function pad(n, len) { return String(n).padStart(len || 2, '0'); }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 120);
    };
  }

  /* ---------------------------------------------------------- encoding */

  var enc = new TextEncoder();
  var dec = new TextDecoder();

  function utf8Bytes(str) { return enc.encode(str); }
  function bytesToUtf8(buf) { return dec.decode(buf instanceof Uint8Array ? buf : new Uint8Array(buf)); }

  function toHex(buf) {
    var b = buf instanceof Uint8Array ? buf : new Uint8Array(buf), out = '';
    for (var i = 0; i < b.length; i++) out += b[i].toString(16).padStart(2, '0');
    return out;
  }

  function fromHex(hex) {
    hex = String(hex).replace(/[^0-9a-fA-F]/g, '');
    if (hex.length % 2) hex = '0' + hex;
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  function b64Encode(bytesArr) {
    var b = bytesArr instanceof Uint8Array ? bytesArr : new Uint8Array(bytesArr), s = '';
    for (var i = 0; i < b.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function b64Decode(str) {
    var bin = atob(String(str).replace(/\s+/g, ''));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function b64UrlToB64(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
    while (s.length % 4) s += '=';
    return s;
  }

  function b64ToB64Url(s) { return String(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

  /* ---------------------------------------------------------- storage */

  function storage(prefix) {
    return {
      get: function (key, fallback) {
        try {
          var raw = localStorage.getItem(prefix + ':' + key);
          return raw === null ? fallback : JSON.parse(raw);
        } catch (e) { return fallback; }
      },
      set: function (key, value) {
        try { localStorage.setItem(prefix + ':' + key, JSON.stringify(value)); } catch (e) { /* private mode */ }
      },
      del: function (key) { try { localStorage.removeItem(prefix + ':' + key); } catch (e) {} }
    };
  }

  DevBox.ui = {
    h: h, append: append, clear: clear, labeled: labeled,
    textarea: textarea, input: input, select: select, checkbox: checkbox,
    btn: btn, chip: chip, card: card, output: output, stat: stat, banner: banner,
    copy: copy, download: download, dropzone: dropzone, toast: toast,
    escapeHtml: escapeHtml, bytes: bytes, num: num, pad: pad, debounce: debounce,
    utf8Bytes: utf8Bytes, bytesToUtf8: bytesToUtf8, toHex: toHex, fromHex: fromHex,
    b64Encode: b64Encode, b64Decode: b64Decode, b64UrlToB64: b64UrlToB64, b64ToB64Url: b64ToB64Url,
    storage: storage
  };
})();
