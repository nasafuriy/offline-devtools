/* Timestamp conversion across epochs, formats and time zones. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  var ZONES = ['UTC', 'Asia/Tashkent', 'Europe/London', 'Europe/Moscow', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney'];

  DevBox.register({
    id: 'time',
    icon: '⏱',
    category: 'time',
    keywords: 'timestamp unix epoch date time convert iso 8601 timezone utc relative duration',
    name: { en: 'Timestamp Converter', uz: 'Vaqt belgisi konvertori', ru: 'Конвертер времени' },
    desc: {
      en: 'Move between Unix epochs, ISO 8601, human dates and time zones, and read a duration in plain words.',
      uz: 'Unix epoch, ISO 8601, oddiy sana va vaqt mintaqalari oʻrtasida oʻgirish, davomiylikni soʻz bilan koʻrsatish.',
      ru: 'Перевод между Unix-временем, ISO 8601, обычными датами и часовыми поясами, плюс человекочитаемая длительность.'
    },

    mount: function (root, ctx) {
      /* ------------------------------------------------ now */

      var nowCard = ui.card('Right now');
      var nowStats = h('div.stat-row');
      nowCard.body.appendChild(nowStats);
      nowCard.actions.appendChild(h('button.btn.sm.ghost', {
        type: 'button', onclick: function () { ui.copy(String(Math.floor(Date.now() / 1000))); }
      }, 'Copy epoch'));

      var ticking = null;
      function tick() {
        var now = new Date();
        ui.clear(nowStats);
        [
          ui.stat(Math.floor(now.getTime() / 1000), 'unix seconds'),
          ui.stat(now.getTime(), 'milliseconds'),
          ui.stat(now.toISOString().slice(11, 19) + 'Z', 'utc time'),
          ui.stat(pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()), 'local time')
        ].forEach(function (s) { nowStats.appendChild(s); });
      }

      /* ------------------------------------------------ convert */

      var input = ui.input({ placeholder: '1735689600, 1735689600000, 2025-01-01T00:00:00Z, or "next friday"-style dates', value: ctx.store.get('input', '') });
      var results = h('div');
      var zoneTable = h('div.tbl-scroll');
      var zoneCard = ui.card('Around the world', zoneTable);
      zoneCard.body.classList.add('flush');

      function convert() {
        ctx.store.set('input', input.value.slice(0, 200));
        ui.clear(results);
        ui.clear(zoneTable);

        var text = input.value.trim();
        if (!text) { zoneCard.style.display = 'none'; return; }

        var parsed = parseMoment(text);
        if (!parsed) {
          results.appendChild(ui.banner('err', 'Could not read that as a date or timestamp.'));
          zoneCard.style.display = 'none';
          return;
        }

        var date = parsed.date;
        zoneCard.style.display = '';

        results.appendChild(h('div.note', { text: 'Interpreted as ' + parsed.how + '.', style: { marginBottom: '10px' } }));

        var rows = [
          ['Unix seconds', Math.floor(date.getTime() / 1000)],
          ['Unix milliseconds', date.getTime()],
          ['ISO 8601 (UTC)', date.toISOString()],
          ['ISO 8601 (local)', localIso(date)],
          ['RFC 2822', date.toUTCString()],
          ['Local, long form', date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })],
          ['Relative', relative(date.getTime() - Date.now())],
          ['Day of year', dayOfYear(date) + ' of ' + (isLeap(date.getUTCFullYear()) ? 366 : 365)],
          ['ISO week', isoWeek(date)]
        ];

        var list = h('dl.kv');
        rows.forEach(function (row) {
          list.appendChild(h('dt', { text: row[0] }));
          var dd = h('dd', { text: String(row[1]) });
          dd.style.cursor = 'pointer';
          dd.title = 'Click to copy';
          dd.addEventListener('click', function () { ui.copy(dd.textContent); });
          list.appendChild(dd);
        });
        results.appendChild(list);

        var local = Intl.DateTimeFormat().resolvedOptions().timeZone;
        var zones = [local].concat(ZONES.filter(function (z) { return z !== local; }));
        zoneTable.appendChild(h('table.tbl',
          h('thead', h('tr', h('th', 'Zone'), h('th', 'Local date & time'), h('th', 'Offset'))),
          h('tbody', zones.map(function (zone) {
            return h('tr',
              h('td', { text: zone + (zone === local ? '  (you)' : '') }),
              h('td.mono', { text: inZone(date, zone) }),
              h('td.mono', { text: offsetOf(date, zone) })
            );
          }))
        ));
      }

      /* ------------------------------------------------ duration */

      var durInput = ui.input({ placeholder: '5400, 1h30m, or 90 min', value: '' });
      var durOut = h('div');

      function duration() {
        ui.clear(durOut);
        var seconds = parseDuration(durInput.value);
        if (seconds === null) {
          if (durInput.value.trim()) durOut.appendChild(ui.banner('err', 'Try a plain number of seconds, or something like 1h30m.'));
          return;
        }
        var list = h('dl.kv');
        [
          ['Human', humanDuration(seconds)],
          ['Seconds', ui.num(seconds)],
          ['Minutes', (seconds / 60).toLocaleString('en-US', { maximumFractionDigits: 4 })],
          ['Hours', (seconds / 3600).toLocaleString('en-US', { maximumFractionDigits: 4 })],
          ['Days', (seconds / 86400).toLocaleString('en-US', { maximumFractionDigits: 4 })],
          ['ISO 8601 duration', isoDuration(seconds)],
          ['HH:MM:SS', clock(seconds)]
        ].forEach(function (row) {
          list.appendChild(h('dt', { text: row[0] }));
          list.appendChild(h('dd', { text: String(row[1]) }));
        });
        durOut.appendChild(list);
      }

      /* ------------------------------------------------ layout */

      root.appendChild(nowCard);
      root.appendChild(ui.card('Convert a moment',
        input,
        h('div.row.mt12',
          ui.btn('Now', function () { input.value = String(Math.floor(Date.now() / 1000)); convert(); }, 'primary'),
          ui.btn('Now (ms)', function () { input.value = String(Date.now()); convert(); }),
          ui.btn('Start of today', function () {
            var d = new Date(); d.setHours(0, 0, 0, 0);
            input.value = String(Math.floor(d.getTime() / 1000)); convert();
          }),
          ui.btn('Clear', function () { input.value = ''; convert(); }, 'ghost')
        ),
        h('div.mt12', results)
      ));
      root.appendChild(zoneCard);
      root.appendChild(ui.card('Duration', durInput, h('div.mt12', durOut)));

      input.control.addEventListener('input', ui.debounce(convert, 250));
      durInput.control.addEventListener('input', ui.debounce(duration, 250));

      tick();
      ticking = setInterval(function () {
        if (!document.body.contains(nowStats)) { clearInterval(ticking); return; }
        tick();
      }, 1000);

      convert();
    }
  });

  /* ---------------------------------------------------------- parsing */

  function parseMoment(text) {
    var digits = text.replace(/[\s_,]/g, '');

    if (/^-?\d+$/.test(digits)) {
      var n = Number(digits);
      var abs = Math.abs(n);
      if (abs >= 1e18) return { date: new Date(n / 1e6), how: 'Unix nanoseconds' };
      if (abs >= 1e15) return { date: new Date(n / 1e3), how: 'Unix microseconds' };
      if (abs >= 1e11) return { date: new Date(n), how: 'Unix milliseconds' };
      return { date: new Date(n * 1000), how: 'Unix seconds' };
    }

    var date = new Date(text);
    if (!isNaN(date.getTime())) return { date: date, how: 'a date string' };

    // Accept "YYYY-MM-DD HH:MM" without the T separator.
    var relaxed = new Date(text.replace(' ', 'T'));
    if (!isNaN(relaxed.getTime())) return { date: relaxed, how: 'a date string' };

    return null;
  }

  function parseDuration(text) {
    var s = String(text).trim().toLowerCase();
    if (!s) return null;
    if (/^\d+(\.\d+)?$/.test(s)) return Number(s);

    var total = 0, matched = false;
    var re = /(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?|w|weeks?)/g;
    var m;
    while ((m = re.exec(s)) !== null) {
      matched = true;
      var value = Number(m[1]);
      var unit = m[2];
      if (/^ms|^milli/.test(unit)) total += value / 1000;
      else if (/^s/.test(unit)) total += value;
      else if (/^m(in|$)/.test(unit) || unit === 'm') total += value * 60;
      else if (/^h/.test(unit)) total += value * 3600;
      else if (/^d/.test(unit)) total += value * 86400;
      else if (/^w/.test(unit)) total += value * 604800;
    }
    return matched ? total : null;
  }

  /* ---------------------------------------------------------- formatting */

  function pad(n) { return String(n).padStart(2, '0'); }

  function localIso(date) {
    var offset = -date.getTimezoneOffset();
    var sign = offset >= 0 ? '+' : '-';
    var abs = Math.abs(offset);
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      'T' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds()) +
      sign + pad(Math.floor(abs / 60)) + ':' + pad(abs % 60);
  }

  function inZone(date, zone) {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: zone, year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(date);
    } catch (err) { return 'unsupported zone'; }
  }

  function offsetOf(date, zone) {
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(date);
      var found = parts.find(function (p) { return p.type === 'timeZoneName'; });
      return found ? found.value.replace('GMT', 'UTC') : '';
    } catch (err) { return ''; }
  }

  function humanDuration(seconds) {
    if (seconds === 0) return '0 seconds';
    var units = [['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
    var left = Math.abs(seconds), parts = [];
    units.forEach(function (unit) {
      var n = Math.floor(left / unit[1]);
      if (n > 0) { parts.push(n + ' ' + unit[0] + (n === 1 ? '' : 's')); left -= n * unit[1]; }
    });
    if (left > 0.001 && parts.length < 2) parts.push(left.toFixed(3).replace(/0+$/, '') + ' seconds');
    return (seconds < 0 ? 'minus ' : '') + parts.slice(0, 3).join(', ');
  }

  function isoDuration(seconds) {
    var d = Math.floor(seconds / 86400);
    var hrs = Math.floor((seconds % 86400) / 3600);
    var min = Math.floor((seconds % 3600) / 60);
    var sec = +(seconds % 60).toFixed(3);
    return 'P' + (d ? d + 'D' : '') + 'T' + (hrs ? hrs + 'H' : '') + (min ? min + 'M' : '') + (sec || (!d && !hrs && !min) ? sec + 'S' : '');
  }

  function clock(seconds) {
    var sign = seconds < 0 ? '-' : '';
    seconds = Math.abs(Math.floor(seconds));
    return sign + pad(Math.floor(seconds / 3600)) + ':' + pad(Math.floor((seconds % 3600) / 60)) + ':' + pad(seconds % 60);
  }

  function relative(deltaMs) {
    var seconds = Math.round(deltaMs / 1000);
    if (Math.abs(seconds) < 5) return 'just now';
    var text = humanDuration(Math.abs(seconds));
    return seconds > 0 ? 'in ' + text : text + ' ago';
  }

  function isLeap(year) { return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0; }

  function dayOfYear(date) {
    var start = Date.UTC(date.getUTCFullYear(), 0, 1);
    return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000) + 1;
  }

  function isoWeek(date) {
    var d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    var day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return d.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
  }
})();
