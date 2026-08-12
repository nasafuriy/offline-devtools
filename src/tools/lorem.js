/* Placeholder prose and realistic-looking fake records for seeding and mockups. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  var LOREM = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
    'enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in ' +
    'reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt ' +
    'culpa qui officia deserunt mollit anim id est laborum at vero eos accusamus iusto odio dignissimos ducimus blanditiis').split(' ');

  var FIRST = ('Ada Alan Grace Linus Barbara Ken Dennis Margaret Katherine Tim Radia Hedy Donald Edsger Anita Shafi Leslie Vint ' +
    'Aziza Dilnoza Jasur Kamola Nodira Otabek Sardor Zilola Bekzod Malika Rustam Feruza ' +
    'Yuki Hiroshi Mei Wei Ling Chen Priya Arjun Sofia Mateo Lucia Diego Emma Noah Olivia Liam Freya Sven Ingrid Nils').split(' ');

  var LAST = ('Lovelace Turing Hopper Torvalds Liskov Thompson Ritchie Hamilton Johnson Berners-Lee Perlman Lamarr Knuth Dijkstra ' +
    'Borg Goldwasser Lamport Cerf Karimova Yusupov Rahimov Nazarova Tashkentov Sattorov ' +
    'Tanaka Sato Chen Wang Li Zhang Patel Sharma Garcia Rossi Muller Schmidt Andersen Larsson Novak Kowalski').split(' ');

  var CITIES = ['Tashkent', 'Samarkand', 'Bukhara', 'London', 'Berlin', 'Paris', 'Tokyo', 'Seoul', 'Toronto', 'Austin', 'Lagos', 'Nairobi', 'São Paulo', 'Lisbon', 'Warsaw', 'Istanbul', 'Dubai', 'Singapore', 'Sydney', 'Amsterdam'];
  var COUNTRIES = ['Uzbekistan', 'United Kingdom', 'Germany', 'France', 'Japan', 'South Korea', 'Canada', 'United States', 'Nigeria', 'Kenya', 'Brazil', 'Portugal', 'Poland', 'Türkiye', 'UAE', 'Singapore', 'Australia', 'Netherlands'];
  var COMPANY_A = ['Blue', 'North', 'Bright', 'Iron', 'Swift', 'Quiet', 'Open', 'Solid', 'Clear', 'Deep', 'Prime', 'Silk'];
  var COMPANY_B = ['Harbor', 'Ridge', 'Forge', 'Loop', 'Field', 'Stack', 'Bridge', 'Grove', 'Peak', 'Anchor', 'Road', 'Yard'];
  var COMPANY_C = ['Labs', 'Systems', 'Works', 'Group', 'Technologies', 'Studio', 'Digital', 'Software', 'Analytics'];
  var DOMAINS = ['example.com', 'example.org', 'test.dev', 'sample.io', 'misol.uz', 'demo.net'];
  var ROLES = ['engineer', 'designer', 'analyst', 'manager', 'researcher', 'writer', 'architect', 'consultant', 'technician'];
  var STREETS = ['Amir Temur', 'Navoi', 'Baker', 'Maple', 'Oak', 'Station', 'Market', 'Church', 'River', 'Park'];

  DevBox.register({
    id: 'lorem',
    icon: '🎲',
    category: 'text',
    keywords: 'lorem ipsum placeholder fake data mock seed random names emails test fixtures',
    name: { en: 'Fake Data', uz: 'Soxta maʼlumot', ru: 'Тестовые данные' },
    desc: {
      en: 'Generate lorem ipsum and believable fake records — names, emails, addresses, dates — as text, JSON, CSV or SQL.',
      uz: 'Lorem ipsum va ishonarli soxta yozuvlar — ism, email, manzil, sana — matn, JSON, CSV yoki SQL koʻrinishida.',
      ru: 'Генерация lorem ipsum и правдоподобных тестовых записей — имена, почта, адреса, даты — в text, JSON, CSV или SQL.'
    },

    mount: function (root, ctx) {
      /* ------------------------------------------------ lorem */

      var unit = ui.select({ options: [['paragraphs', 'Paragraphs'], ['sentences', 'Sentences'], ['words', 'Words'], ['list', 'List items']], value: 'paragraphs', label: 'UNIT' });
      var amount = ui.input({ type: 'number', value: 3, min: 1, max: 200, label: 'HOW MANY' });
      var startClassic = ui.checkbox('Start with “Lorem ipsum dolor sit amet”', true);
      var loremOut = ui.output({ title: 'Placeholder text', download: 'lorem.txt' });

      function makeLorem() {
        var n = Math.min(200, Math.max(1, Number(amount.value) || 1));
        var out = [];

        if (unit.value === 'words') {
          out.push(words(n, startClassic.checked));
        } else if (unit.value === 'sentences') {
          for (var s = 0; s < n; s++) out.push(sentence(s === 0 && startClassic.checked));
          out = [out.join(' ')];
        } else if (unit.value === 'list') {
          for (var l = 0; l < n; l++) out.push('- ' + words(rand(3, 8), false));
        } else {
          for (var p = 0; p < n; p++) {
            var count = rand(3, 6);
            var text = [];
            for (var i = 0; i < count; i++) text.push(sentence(p === 0 && i === 0 && startClassic.checked));
            out.push(text.join(' '));
          }
        }

        loremOut.set(out.join(unit.value === 'paragraphs' ? '\n\n' : '\n'));
      }

      /* ------------------------------------------------ records */

      var rows = ui.input({ type: 'number', value: 10, min: 1, max: 1000, label: 'ROWS' });
      var format = ui.select({ options: [['json', 'JSON'], ['csv', 'CSV'], ['sql', 'SQL INSERT'], ['lines', 'Plain lines']], value: 'json', label: 'FORMAT' });
      var tableName = ui.input({ value: 'users', label: 'TABLE NAME (SQL)' });

      var FIELDS = ['id', 'uuid', 'first_name', 'last_name', 'email', 'phone', 'role', 'company', 'city', 'country', 'street', 'created_at', 'active', 'score'];
      var picked = {};
      var fieldRow = h('div.row.tight');
      FIELDS.forEach(function (field) {
        var on = ['id', 'first_name', 'last_name', 'email', 'city', 'created_at'].indexOf(field) >= 0;
        var box = ui.checkbox(field, on, makeRecords);
        picked[field] = box;
        fieldRow.appendChild(box);
      });

      var recordsOut = ui.output({ title: 'Records', download: function () { return 'data.' + (format.value === 'sql' ? 'sql' : format.value === 'lines' ? 'txt' : format.value); } });

      function makeRecords() {
        var n = Math.min(1000, Math.max(1, Number(rows.value) || 1));
        var chosen = FIELDS.filter(function (field) { return picked[field].checked; });
        if (!chosen.length) return recordsOut.set('Pick at least one field.', 'err');

        var data = [];
        for (var i = 0; i < n; i++) data.push(record(i + 1, chosen));

        if (format.value === 'json') {
          recordsOut.set(JSON.stringify(data, null, 2));
        } else if (format.value === 'csv') {
          var head = chosen.join(',');
          var body = data.map(function (row) {
            return chosen.map(function (key) {
              var value = String(row[key]);
              return /[",\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
            }).join(',');
          });
          recordsOut.set([head].concat(body).join('\n'));
        } else if (format.value === 'sql') {
          var table = (tableName.value || 'users').replace(/[^A-Za-z0-9_]/g, '');
          recordsOut.set(data.map(function (row) {
            var values = chosen.map(function (key) {
              var value = row[key];
              if (typeof value === 'number') return String(value);
              if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
              return "'" + String(value).replace(/'/g, "''") + "'";
            });
            return 'INSERT INTO ' + table + ' (' + chosen.join(', ') + ') VALUES (' + values.join(', ') + ');';
          }).join('\n'));
        } else {
          recordsOut.set(data.map(function (row) {
            return chosen.map(function (key) { return row[key]; }).join('  ·  ');
          }).join('\n'));
        }
      }

      /* ------------------------------------------------ layout */

      root.appendChild(ui.card('Lorem ipsum',
        h('div.grid3', unit, amount, h('div', h('label.lbl', { text: 'OPTIONS' }), startClassic)),
        h('div.row.mt12', ui.btn('Generate', makeLorem, 'primary'))
      ));
      root.appendChild(loremOut);

      root.appendChild(ui.card('Fake records',
        h('div.grid3', rows, format, tableName),
        h('div.mt12', h('label.lbl', { text: 'FIELDS' }), fieldRow),
        h('div.row.mt12', ui.btn('Generate', makeRecords, 'primary'))
      ));
      root.appendChild(recordsOut);

      root.appendChild(h('div.note', { text: 'Everything here is randomly assembled and refers to no real person. Domains use the reserved example.com family so test mail cannot reach a real inbox.' }));

      unit.addEventListener('change', makeLorem);
      amount.control.addEventListener('input', ui.debounce(makeLorem, 250));
      rows.control.addEventListener('input', ui.debounce(makeRecords, 250));
      format.addEventListener('change', makeRecords);
      tableName.control.addEventListener('input', ui.debounce(makeRecords, 250));

      makeLorem();
      makeRecords();
    }
  });

  /* ---------------------------------------------------------- generators */

  function rand(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function words(n, classic) {
    var out = [];
    if (classic) out = ['lorem', 'ipsum', 'dolor', 'sit', 'amet'].slice(0, Math.min(5, n));
    while (out.length < n) out.push(pick(LOREM));
    return out.join(' ');
  }

  function sentence(classic) {
    var text = words(rand(8, 18), classic);
    return text.charAt(0).toUpperCase() + text.slice(1) + '.';
  }

  function record(id, chosen) {
    var first = pick(FIRST);
    var last = pick(LAST);
    var company = pick(COMPANY_A) + pick(COMPANY_B) + ' ' + pick(COMPANY_C);
    var created = new Date(Date.now() - rand(0, 1000) * 86400000);

    var all = {
      id: id,
      uuid: crypto.randomUUID ? crypto.randomUUID() : fallbackUuid(),
      first_name: first,
      last_name: last,
      email: (first + '.' + last).toLowerCase().replace(/[^a-z.]/g, '') + '@' + pick(DOMAINS),
      phone: '+998 ' + rand(90, 99) + ' ' + rand(100, 999) + '-' + rand(10, 99) + '-' + rand(10, 99),
      role: pick(ROLES),
      company: company,
      city: pick(CITIES),
      country: pick(COUNTRIES),
      street: rand(1, 240) + ' ' + pick(STREETS) + ' Street',
      created_at: created.toISOString(),
      active: Math.random() > 0.25,
      score: Number((Math.random() * 100).toFixed(1))
    };

    var out = {};
    chosen.forEach(function (key) { out[key] = all[key]; });
    return out;
  }

  function fallbackUuid() {
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var hex = DevBox.ui.toHex(b);
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }
})();
