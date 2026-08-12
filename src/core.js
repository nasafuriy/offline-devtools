/* ============================================================
   Shashka — application shell: tool registry, router, command
   palette, theme and language switching.
   ============================================================ */
(function () {
  'use strict';

  var DevBox = window.DevBox = window.DevBox || {};
  var ui = DevBox.ui;
  var h = ui.h, clear = ui.clear;
  var store = ui.storage('shashka');

  var tools = [];
  var byId = {};
  var current = null;

  /* ---------------------------------------------------------- i18n */

  var LANGS = ['en', 'uz', 'ru'];

  var STR = {
    searchTools: { en: 'Search tools', uz: 'Vositalarni qidirish', ru: 'Поиск инструментов' },
    offlineBadge: { en: '100% offline', uz: '100% oflayn', ru: '100% офлайн' },
    toolsWord: { en: 'tools', uz: 'vosita', ru: 'инструментов' },
    noNetwork: { en: 'No request ever leaves this page.', uz: 'Hech qanday soʻrov bu sahifadan chiqmaydi.', ru: 'Ни один запрос не покидает страницу.' },
    heroTitle: { en: 'Your whole dev toolbox, offline.', uz: 'Butun dasturchi asboblaringiz, oflayn.', ru: 'Весь набор инструментов разработчика — офлайн.' },
    heroText: {
      en: 'Format JSON, decode a JWT, hash a file, build a QR code, test a regex. Everything runs inside this page — no server, no account, no telemetry. Save the file and it still works on a plane in ten years.',
      uz: 'JSON formatlash, JWT ochish, fayl xeshi, QR kod, regex sinovi. Hammasi shu sahifa ichida ishlaydi — server yoʻq, akkaunt yoʻq, kuzatuv yoʻq. Faylni saqlang — u oʻn yildan keyin ham, internetsiz ham ishlaydi.',
      ru: 'Форматируйте JSON, декодируйте JWT, считайте хеши, стройте QR-коды, проверяйте регулярки. Всё работает внутри страницы — без сервера, аккаунта и телеметрии. Сохраните файл — он будет работать и через десять лет без интернета.'
    },
    badgeNoInstall: { en: 'No install', uz: 'Oʻrnatishsiz', ru: 'Без установки' },
    badgeNoTracking: { en: 'No tracking', uz: 'Kuzatuvsiz', ru: 'Без слежки' },
    badgeSingleFile: { en: 'Single HTML file', uz: 'Bitta HTML fayl', ru: 'Один HTML-файл' },
    badgeMit: { en: 'MIT licensed', uz: 'MIT litsenziyasi', ru: 'Лицензия MIT' },
    allTools: { en: 'All tools', uz: 'Barcha vositalar', ru: 'Все инструменты' },
    noResults: { en: 'No tool matches that.', uz: 'Mos vosita topilmadi.', ru: 'Ничего не найдено.' }
  };

  var CATS = {
    data:     { en: 'Data & encoding', uz: 'Maʼlumot va kodlash', ru: 'Данные и кодирование' },
    security: { en: 'Crypto & identity', uz: 'Kriptografiya va identifikator', ru: 'Криптография и идентификаторы' },
    time:     { en: 'Time', uz: 'Vaqt', ru: 'Время' },
    text:     { en: 'Text', uz: 'Matn', ru: 'Текст' },
    visual:   { en: 'Visual', uz: 'Vizual', ru: 'Визуальное' },
    ref:      { en: 'Reference', uz: 'Maʼlumotnoma', ru: 'Справочник' }
  };

  var CAT_ORDER = ['data', 'security', 'time', 'text', 'visual', 'ref'];

  var lang = store.get('lang', (navigator.language || 'en').slice(0, 2));
  if (LANGS.indexOf(lang) < 0) lang = 'en';

  /** Resolve a localized value: accepts a string or a {en,uz,ru} map. */
  function t(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return value[lang] || value.en || Object.values(value)[0] || '';
  }

  DevBox.t = t;
  DevBox.lang = function () { return lang; };

  /* ---------------------------------------------------------- registry */

  DevBox.register = function (tool) {
    if (!tool || !tool.id) throw new Error('Tool needs an id');
    if (byId[tool.id]) throw new Error('Duplicate tool id: ' + tool.id);
    tool.category = tool.category || 'data';
    byId[tool.id] = tool;
    tools.push(tool);
    return tool;
  };

  DevBox.tools = function () { return tools.slice(); };

  function searchIndex(tool) {
    return (tool.id + ' ' + t(tool.name) + ' ' + t(tool.desc) + ' ' + (tool.keywords || '') + ' ' +
      LANGS.map(function (l) { return (tool.name && tool.name[l]) || ''; }).join(' ')).toLowerCase();
  }

  function search(query) {
    var q = query.trim().toLowerCase();
    if (!q) return tools.slice();
    var terms = q.split(/\s+/);
    return tools.filter(function (tool) {
      var hay = searchIndex(tool);
      return terms.every(function (term) { return hay.indexOf(term) >= 0; });
    }).sort(function (a, b) {
      // Exact-ish name matches first.
      var an = t(a.name).toLowerCase(), bn = t(b.name).toLowerCase();
      return (an.indexOf(q) < 0) - (bn.indexOf(q) < 0) || an.localeCompare(bn);
    });
  }

  /* ---------------------------------------------------------- sidebar */

  function renderNav() {
    var nav = clear(document.getElementById('toolNav'));

    CAT_ORDER.forEach(function (cat) {
      var group = tools.filter(function (tool) { return tool.category === cat; });
      if (!group.length) return;
      nav.appendChild(h('div.nav-group-label', { text: t(CATS[cat]) }));
      group.forEach(function (tool) {
        var item = h('button.nav-item', {
          type: 'button',
          data: { id: tool.id },
          onclick: function () { go(tool.id); }
        }, h('span.nav-ico', { text: tool.icon || '·' }), h('span.nav-label', { text: t(tool.name) }));
        if (current === tool.id) item.classList.add('on');
        nav.appendChild(item);
      });
    });

    document.getElementById('toolCount').textContent = tools.length;
  }

  function markActive() {
    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.classList.toggle('on', item.dataset.id === current);
    });
  }

  /* ---------------------------------------------------------- home */

  function renderHome(host) {
    var page = h('div.tool');

    page.appendChild(h('div.home-hero',
      h('h1', { text: t(STR.heroTitle) }),
      h('p', { text: t(STR.heroText) }),
      h('div.home-badges',
        ui.chip('⚡ ' + t(STR.badgeNoInstall)),
        ui.chip('🔒 ' + t(STR.badgeNoTracking)),
        ui.chip('📄 ' + t(STR.badgeSingleFile)),
        ui.chip('© ' + t(STR.badgeMit))
      )
    ));

    CAT_ORDER.forEach(function (cat) {
      var group = tools.filter(function (tool) { return tool.category === cat; });
      if (!group.length) return;
      page.appendChild(h('div.home-sec', { text: t(CATS[cat]) }));
      var grid = h('div.grid-auto');
      group.forEach(function (tool) {
        grid.appendChild(h('button.home-card', {
          type: 'button',
          onclick: function () { go(tool.id); }
        }, h('b', { text: (tool.icon ? tool.icon + '  ' : '') + t(tool.name) }), h('span', { text: t(tool.desc) })));
      });
      page.appendChild(grid);
    });

    host.appendChild(page);
  }

  /* ---------------------------------------------------------- router */

  function go(id) {
    location.hash = id ? '#/' + id : '#/';
  }
  DevBox.go = go;

  function route() {
    var id = (location.hash || '').replace(/^#\/?/, '').trim();
    var host = clear(document.getElementById('toolHost'));
    document.getElementById('main').scrollTop = 0;
    document.getElementById('app').classList.remove('nav-open');

    if (!id || !byId[id]) {
      current = null;
      document.title = 'Shashka — Offline Developer Toolbox';
      renderHome(host);
      markActive();
      return;
    }

    var tool = byId[id];
    current = id;
    store.set('last', id);
    document.title = t(tool.name) + ' — Shashka';

    var page = h('div.tool');
    page.appendChild(h('div.tool-head',
      h('h1.tool-title', h('span.nav-ico', { text: tool.icon || '·' }), t(tool.name)),
      h('p.tool-sub', { text: t(tool.desc) })
    ));
    var body = h('div.stack');
    page.appendChild(body);
    host.appendChild(page);

    try {
      tool.mount(body, { store: ui.storage('shashka:' + id), t: t, lang: lang });
    } catch (err) {
      body.appendChild(ui.banner('err', 'This tool failed to start: ' + err.message));
      if (window.console) console.error(err);
    }

    markActive();
  }

  /* ---------------------------------------------------------- palette */

  var palette = {
    open: false,
    items: [],
    sel: 0,

    show: function () {
      var wrap = document.getElementById('palette');
      wrap.hidden = false;
      palette.open = true;
      var box = document.getElementById('paletteInput');
      box.value = '';
      box.placeholder = t(STR.searchTools) + '…';
      palette.filter('');
      box.focus();
    },

    hide: function () {
      document.getElementById('palette').hidden = true;
      palette.open = false;
    },

    filter: function (query) {
      palette.items = search(query).slice(0, 40);
      palette.sel = 0;
      palette.paint();
    },

    paint: function () {
      var list = clear(document.getElementById('paletteList'));
      if (!palette.items.length) {
        list.appendChild(h('div.palette-empty', { text: t(STR.noResults) }));
        return;
      }
      palette.items.forEach(function (tool, i) {
        var item = h('button.palette-item' + (i === palette.sel ? '.sel' : ''), {
          type: 'button',
          onmousemove: function () { if (palette.sel !== i) { palette.sel = i; palette.paint(); } },
          onclick: function () { palette.hide(); go(tool.id); }
        },
          h('span.nav-ico', { text: tool.icon || '·' }),
          h('span.txt', h('b', { text: t(tool.name) }), h('i', { text: t(tool.desc) }))
        );
        list.appendChild(item);
      });
      var sel = list.children[palette.sel];
      if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
    },

    move: function (delta) {
      if (!palette.items.length) return;
      palette.sel = (palette.sel + delta + palette.items.length) % palette.items.length;
      palette.paint();
    },

    commit: function () {
      var tool = palette.items[palette.sel];
      if (!tool) return;
      palette.hide();
      go(tool.id);
    }
  };

  /* ---------------------------------------------------------- theme / lang */

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    store.set('theme', theme);
  }

  function applyLang(next) {
    lang = next;
    store.set('lang', next);
    document.documentElement.lang = next;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (STR[key]) el.textContent = t(STR[key]);
    });
    document.querySelectorAll('#langSeg button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.lang === next);
    });
    renderNav();
    route();
  }

  /* ---------------------------------------------------------- boot */

  DevBox.start = function () {
    applyTheme(store.get('theme', matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

    document.getElementById('themeBtn').addEventListener('click', function () {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    document.getElementById('langSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-lang]');
      if (b) applyLang(b.dataset.lang);
    });

    document.getElementById('searchTrigger').addEventListener('click', palette.show);
    document.getElementById('menuBtn').addEventListener('click', function () {
      document.getElementById('app').classList.toggle('nav-open');
    });
    document.getElementById('scrim').addEventListener('click', function () {
      document.getElementById('app').classList.remove('nav-open');
    });

    var box = document.getElementById('paletteInput');
    box.addEventListener('input', function () { palette.filter(box.value); });
    document.getElementById('palette').addEventListener('mousedown', function (e) {
      if (e.target.id === 'palette') palette.hide();
    });

    document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        palette.open ? palette.hide() : palette.show();
        return;
      }
      if (e.key === '/' && !typing && !palette.open) { e.preventDefault(); palette.show(); return; }

      if (!palette.open) return;
      if (e.key === 'Escape') { e.preventDefault(); palette.hide(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); palette.move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); palette.move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); palette.commit(); }
    });

    window.addEventListener('hashchange', route);

    // Point the GitHub button at the repo this copy was published from, when known.
    var repo = document.documentElement.getAttribute('data-repo');
    if (repo) document.getElementById('repoBtn').href = repo;

    tools.sort(function (a, b) {
      var d = CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category);
      return d || 0;
    });

    applyLang(lang);   // renders nav + routes
  };
})();
