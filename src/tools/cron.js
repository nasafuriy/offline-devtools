/* Cron expression parsing, description and next-run scheduling. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOWS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  var MACROS = {
    '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *',
    '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *'
  };

  var PRESETS = [
    ['*/5 * * * *', 'Every 5 minutes'],
    ['0 * * * *', 'Every hour'],
    ['0 9 * * 1-5', 'Weekdays at 09:00'],
    ['30 3 * * *', 'Daily at 03:30'],
    ['0 0 1 * *', 'First of the month'],
    ['0 12 * * 6,0', 'Weekends at noon'],
    ['15 2 1 1 *', 'Once a year']
  ];

  DevBox.register({
    id: 'cron',
    icon: '🗓',
    category: 'time',
    keywords: 'cron crontab schedule expression next run parse describe job',
    name: { en: 'Cron Parser', uz: 'Cron tahlilchi', ru: 'Разбор cron' },
    desc: {
      en: 'Explain a crontab expression in plain language and list exactly when it will fire next.',
      uz: 'Crontab ifodasini oddiy tilda tushuntiradi va keyingi ishga tushish vaqtlarini roʻyxatlaydi.',
      ru: 'Объясняет crontab-выражение обычными словами и показывает ближайшие срабатывания.'
    },

    mount: function (root, ctx) {
      var input = ui.input({ placeholder: '*/15 9-17 * * 1-5', value: ctx.store.get('expr', '0 9 * * 1-5') });
      var status = h('div');
      var description = h('div');
      var fieldTable = h('div.tbl-scroll');
      var runs = h('div');

      var presets = h('div.row.tight.mt12');
      PRESETS.forEach(function (preset) {
        presets.appendChild(ui.chip(preset[1], function () { input.value = preset[0]; run(); }));
      });

      function run() {
        var text = input.value.trim();
        ctx.store.set('expr', text.slice(0, 200));
        ui.clear(status); ui.clear(description); ui.clear(fieldTable); ui.clear(runs);
        if (!text) return;

        var spec;
        try { spec = parse(text); }
        catch (err) {
          status.appendChild(ui.banner('err', err.message));
          return;
        }

        status.appendChild(ui.banner('ok', 'Valid ' + spec.fieldCount + '-field expression' + (spec.macro ? ' (expanded from ' + spec.macro + ')' : '')));
        description.appendChild(h('div', { style: { fontSize: '16px', fontWeight: '600', letterSpacing: '-.2px' }, text: describe(spec) }));

        fieldTable.appendChild(h('table.tbl',
          h('thead', h('tr', h('th', 'Field'), h('th', 'Pattern'), h('th', 'Matches'))),
          h('tbody', spec.fields.map(function (field) {
            return h('tr',
              h('td', { text: field.label }),
              h('td.mono', { text: field.raw }),
              h('td.mono', { text: summarise(field) })
            );
          }))
        ));

        var next = nextRuns(spec, new Date(), 10);
        if (!next.length) {
          runs.appendChild(ui.banner('warn', 'This expression never matches a real date — check the day-of-month and month combination.'));
          return;
        }
        var previous = Date.now();
        runs.appendChild(h('table.tbl',
          h('thead', h('tr', h('th', '#'), h('th', 'Local time'), h('th', 'In'), h('th', 'Gap'))),
          h('tbody', next.map(function (date, i) {
            var row = h('tr',
              h('td', { text: String(i + 1) }),
              h('td.mono', { text: format(date) }),
              h('td', { text: gap(date.getTime() - Date.now()) }),
              h('td', { text: i === 0 ? '—' : gap(date.getTime() - previous) })
            );
            previous = date.getTime();
            return row;
          }))
        ));
      }

      root.appendChild(ui.card('Expression', input, presets));
      root.appendChild(status);
      root.appendChild(ui.card('What it means', description, h('div.mt12', fieldTable)));
      var runsCard = ui.card('Next 10 runs', runs);
      runsCard.body.classList.add('flush');
      root.appendChild(runsCard);
      root.appendChild(h('div.note', { text: 'Times are shown in your local zone (' + Intl.DateTimeFormat().resolvedOptions().timeZone + '). Most cron daemons use the server’s zone, so double-check before relying on these.' }));

      input.control.addEventListener('input', ui.debounce(run, 250));
      run();
    }
  });

  /* ---------------------------------------------------------- parsing */

  var FIELDS = [
    { key: 'minute', label: 'Minute', min: 0, max: 59 },
    { key: 'hour', label: 'Hour', min: 0, max: 23 },
    { key: 'dom', label: 'Day of month', min: 1, max: 31 },
    { key: 'month', label: 'Month', min: 1, max: 12, names: MONTHS },
    { key: 'dow', label: 'Day of week', min: 0, max: 6, names: DOWS }
  ];

  function parse(text) {
    var macro = null;
    var expr = text.trim();

    if (expr[0] === '@') {
      var key = expr.toLowerCase();
      if (key === '@reboot') throw new Error('@reboot runs at daemon start-up and has no schedule to predict.');
      if (!MACROS[key]) throw new Error('Unknown macro "' + expr + '". Known macros: ' + Object.keys(MACROS).join(', ') + '.');
      macro = key;
      expr = MACROS[key];
    }

    var parts = expr.split(/\s+/);
    var seconds = null;

    if (parts.length === 6) {
      // Quartz/systemd style with a leading seconds field: parsed and reported,
      // but next-run search still steps by the minute.
      seconds = parts.shift();
    } else if (parts.length !== 5) {
      throw new Error('Expected 5 fields (minute hour day-of-month month day-of-week), got ' + parts.length + '.');
    }

    var fields = FIELDS.map(function (def, i) {
      return Object.assign({}, def, { raw: parts[i], values: parseField(parts[i], def) });
    });

    return {
      fields: fields,
      macro: macro,
      seconds: seconds,
      fieldCount: seconds === null ? 5 : 6,
      minute: fields[0].values,
      hour: fields[1].values,
      dom: fields[2].values,
      month: fields[3].values,
      dow: fields[4].values,
      domRestricted: parts[2] !== '*' && parts[2] !== '?',
      dowRestricted: parts[4] !== '*' && parts[4] !== '?'
    };
  }

  function parseField(raw, def) {
    if (raw === undefined) throw new Error('Missing ' + def.label.toLowerCase() + ' field.');
    var out = new Set();

    raw.split(',').forEach(function (chunk) {
      var step = 1;
      var slash = chunk.split('/');
      if (slash.length === 2) {
        step = Number(slash[1]);
        if (!(step >= 1)) throw new Error('Invalid step "/' + slash[1] + '" in the ' + def.label.toLowerCase() + ' field.');
      } else if (slash.length > 2) {
        throw new Error('Too many "/" in the ' + def.label.toLowerCase() + ' field.');
      }

      var range = slash[0];
      var lo, hi;

      if (range === '*' || range === '?') {
        lo = def.min; hi = def.max;
      } else {
        var ends = range.split('-');
        if (ends.length > 2) throw new Error('Invalid range "' + range + '" in the ' + def.label.toLowerCase() + ' field.');
        lo = named(ends[0], def);
        hi = ends.length === 2 ? named(ends[1], def) : lo;
        if (ends.length === 1 && slash.length === 2) hi = def.max;   // "5/10" means "from 5, stepping"
      }

      if (lo === null || hi === null) throw new Error('Unrecognised value "' + range + '" in the ' + def.label.toLowerCase() + ' field.');
      if (lo < def.min || hi > def.max) {
        throw new Error(def.label + ' must be between ' + def.min + ' and ' + def.max + ', got "' + range + '".');
      }

      if (lo <= hi) {
        for (var v = lo; v <= hi; v += step) out.add(v);
      } else {
        // Wrapping range such as fri-mon.
        for (var w = lo; w <= def.max; w += step) out.add(w);
        for (var x = def.min; x <= hi; x += step) out.add(x);
      }
    });

    if (def.key === 'dow' && out.has(7)) { out.delete(7); out.add(0); }
    if (!out.size) throw new Error('The ' + def.label.toLowerCase() + ' field matches nothing.');
    return out;
  }

  function named(token, def) {
    var s = String(token).trim().toLowerCase();
    if (/^\d+$/.test(s)) {
      var n = Number(s);
      if (def.key === 'dow' && n === 7) return 0;
      return n;
    }
    if (def.names) {
      var i = def.names.indexOf(s.slice(0, 3));
      if (i >= 0) return def.key === 'month' ? i + 1 : i;
    }
    return null;
  }

  /* ---------------------------------------------------------- describing */

  function describe(spec) {
    var timePart = describeTime(spec);
    var dayPart = describeDays(spec);
    var monthPart = spec.month.size === 12 ? '' :
      ', in ' + list(Array.from(spec.month).sort(function (a, b) { return a - b; }).map(function (m) { return MONTH_NAMES[m - 1]; }));
    return timePart + dayPart + monthPart + '.';
  }

  function describeTime(spec) {
    var minutes = sorted(spec.minute);
    var hours = sorted(spec.hour);
    var everyMinute = spec.minute.size === 60;
    var everyHour = spec.hour.size === 24;

    if (everyMinute && everyHour) return 'Every minute';
    if (everyMinute) return 'Every minute during ' + list(hours.map(hourLabel));

    var minStep = stepOf(minutes, 0, 59);
    if (minStep && everyHour) return 'Every ' + minStep + ' minutes';
    if (minStep) return 'Every ' + minStep + ' minutes during ' + list(hours.map(hourLabel));

    if (everyHour) return 'At minute ' + list(minutes) + ' of every hour';

    var hourStep = stepOf(hours, 0, 23);
    if (hourStep && minutes.length === 1) return 'Every ' + hourStep + ' hours, at minute ' + minutes[0];

    if (minutes.length === 1 && hours.length === 1) return 'At ' + pad(hours[0]) + ':' + pad(minutes[0]);
    if (minutes.length === 1) return 'At ' + list(hours.map(function (hr) { return pad(hr) + ':' + pad(minutes[0]); }));
    return 'At minute ' + list(minutes) + ' past ' + list(hours.map(hourLabel));
  }

  function describeDays(spec) {
    if (!spec.domRestricted && !spec.dowRestricted) return ', every day';

    var parts = [];
    if (spec.domRestricted) {
      var days = sorted(spec.dom);
      var step = stepOf(days, 1, 31);
      parts.push(step ? 'every ' + step + ' days' : 'on day ' + list(days) + ' of the month');
    }
    if (spec.dowRestricted) {
      parts.push('on ' + list(sorted(spec.dow).map(function (d) { return DOW_NAMES[d]; })));
    }
    // Classic cron quirk: when both are restricted, either one firing is enough.
    return ', ' + parts.join(spec.domRestricted && spec.dowRestricted ? ' or ' : ' and ');
  }

  function summarise(field) {
    var values = sorted(field.values);
    if (values.length === (field.max - field.min + 1)) return 'every value';
    if (values.length > 12) return values.length + ' values';
    return values.join(', ');
  }

  /** Returns n when the set is exactly an evenly spaced series across the range. */
  function stepOf(values, min, max) {
    if (values.length < 3 || values[0] !== min) return null;
    var step = values[1] - values[0];
    if (step < 2) return null;
    for (var i = 1; i < values.length; i++) {
      if (values[i] - values[i - 1] !== step) return null;
    }
    return values[values.length - 1] + step > max ? step : null;
  }

  function sorted(set) { return Array.from(set).sort(function (a, b) { return a - b; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function hourLabel(hr) { return pad(hr) + ':00'; }

  function list(items) {
    if (items.length === 1) return String(items[0]);
    if (items.length === 2) return items[0] + ' and ' + items[1];
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  /* ---------------------------------------------------------- scheduling */

  function nextRuns(spec, from, howMany) {
    var out = [];
    var cursor = new Date(from.getTime());
    cursor.setSeconds(0, 0);
    cursor.setMinutes(cursor.getMinutes() + 1);

    // Each iteration jumps to the next candidate boundary rather than ticking,
    // so even a once-a-year schedule resolves in a few hundred steps.
    for (var guard = 0; guard < 500000 && out.length < howMany; guard++) {
      if (cursor.getFullYear() - from.getFullYear() > 8) break;

      if (!spec.month.has(cursor.getMonth() + 1)) {
        cursor.setMonth(cursor.getMonth() + 1, 1);
        cursor.setHours(0, 0, 0, 0);
        continue;
      }
      if (!dayMatches(cursor, spec)) {
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(0, 0, 0, 0);
        continue;
      }
      if (!spec.hour.has(cursor.getHours())) {
        cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
        continue;
      }
      if (!spec.minute.has(cursor.getMinutes())) {
        cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
        continue;
      }

      out.push(new Date(cursor.getTime()));
      cursor.setMinutes(cursor.getMinutes() + 1);
    }
    return out;
  }

  function dayMatches(date, spec) {
    var domOk = spec.dom.has(date.getDate());
    var dowOk = spec.dow.has(date.getDay());
    if (spec.domRestricted && spec.dowRestricted) return domOk || dowOk;
    if (spec.domRestricted) return domOk;
    if (spec.dowRestricted) return dowOk;
    return true;
  }

  function format(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + '  ' + DOW_NAMES[date.getDay()].slice(0, 3);
  }

  function gap(ms) {
    var seconds = Math.round(Math.abs(ms) / 1000);
    var units = [['d', 86400], ['h', 3600], ['m', 60]];
    var parts = [];
    units.forEach(function (unit) {
      var n = Math.floor(seconds / unit[1]);
      if (n > 0) { parts.push(n + unit[0]); seconds -= n * unit[1]; }
    });
    if (!parts.length) return 'under a minute';
    return parts.slice(0, 2).join(' ');
  }
})();
