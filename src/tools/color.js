/* Colour conversion, WCAG contrast checking and palette building. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  DevBox.register({
    id: 'color',
    icon: '◐',
    category: 'visual',
    keywords: 'color colour hex rgb hsl hsv cmyk contrast wcag accessibility palette shades picker',
    name: { en: 'Colour Tools', uz: 'Rang vositalari', ru: 'Работа с цветом' },
    desc: {
      en: 'Convert between HEX, RGB, HSL, HSV and CMYK, check WCAG contrast, and build tints and shades.',
      uz: 'HEX, RGB, HSL, HSV va CMYK oʻrtasida oʻgirish, WCAG kontrastini tekshirish, ochroq va toʻqroq tuslar yasash.',
      ru: 'Конвертация HEX, RGB, HSL, HSV и CMYK, проверка контраста по WCAG и построение оттенков.'
    },

    mount: function (root, ctx) {
      /* ------------------------------------------------ converter */

      var text = ui.input({ value: ctx.store.get('color', '#4f8cff'), placeholder: '#4f8cff, rgb(79 140 255), hsl(219 100% 65%), rebeccapurple' });
      var swatchPicker = ui.input({ type: 'color', value: '#4f8cff' });
      var swatch = h('div.swatch');
      var values = h('dl.kv');
      var error = h('div');

      function convert(source) {
        ui.clear(error);
        var rgb = parseColor(text.value);
        if (!rgb) {
          error.appendChild(ui.banner('err', 'Could not read that colour.'));
          return;
        }
        ctx.store.set('color', text.value);

        var hex = toHex(rgb);
        if (source !== 'picker') swatchPicker.value = hex;
        swatch.style.background = 'rgb(' + rgb.r + ' ' + rgb.g + ' ' + rgb.b + (rgb.a < 1 ? ' / ' + rgb.a : '') + ')';

        var hsl = rgbToHsl(rgb), hsv = rgbToHsv(rgb), cmyk = rgbToCmyk(rgb);
        var lum = luminance(rgb);

        ui.clear(values);
        [
          ['HEX', hex + (rgb.a < 1 ? Math.round(rgb.a * 255).toString(16).padStart(2, '0') : '')],
          ['RGB', 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')'],
          ['RGB (modern)', 'rgb(' + rgb.r + ' ' + rgb.g + ' ' + rgb.b + (rgb.a < 1 ? ' / ' + rgb.a : '') + ')'],
          ['HSL', 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)'],
          ['HSV', 'hsv(' + hsv.h + ', ' + hsv.s + '%, ' + hsv.v + '%)'],
          ['CMYK', 'cmyk(' + cmyk.c + '%, ' + cmyk.m + '%, ' + cmyk.y + '%, ' + cmyk.k + '%)'],
          ['Relative luminance', lum.toFixed(4)],
          ['Best text on it', lum > 0.179 ? 'black' : 'white']
        ].forEach(function (row) {
          values.appendChild(h('dt', { text: row[0] }));
          var dd = h('dd', { text: row[1] });
          dd.style.cursor = 'pointer';
          dd.title = 'Click to copy';
          dd.addEventListener('click', function () { ui.copy(row[1]); });
          values.appendChild(dd);
        });

        buildPalette(rgb);
        checkContrast();
      }

      /* ------------------------------------------------ palette */

      var palette = h('div');

      function buildPalette(rgb) {
        ui.clear(palette);
        var hsl = rgbToHsl(rgb);

        palette.appendChild(strip('Tints & shades', [95, 85, 75, 65, 55, 45, 35, 25, 15].map(function (l) {
          return hslToRgb({ h: hsl.h, s: hsl.s, l: l });
        })));

        palette.appendChild(strip('Hue wheel', [0, 30, 60, 120, 180, 210, 240, 300, 330].map(function (shift) {
          return hslToRgb({ h: (hsl.h + shift) % 360, s: hsl.s, l: hsl.l });
        })));

        palette.appendChild(strip('Harmonies — complement, triad, split', [
          hslToRgb({ h: (hsl.h + 180) % 360, s: hsl.s, l: hsl.l }),
          hslToRgb({ h: (hsl.h + 120) % 360, s: hsl.s, l: hsl.l }),
          hslToRgb({ h: (hsl.h + 240) % 360, s: hsl.s, l: hsl.l }),
          hslToRgb({ h: (hsl.h + 150) % 360, s: hsl.s, l: hsl.l }),
          hslToRgb({ h: (hsl.h + 210) % 360, s: hsl.s, l: hsl.l })
        ]));
      }

      function strip(title, colors) {
        var row = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(' + colors.length + ', 1fr)', gap: '4px', marginTop: '8px' } });
        colors.forEach(function (rgb) {
          var hex = toHex(rgb);
          var cell = h('button', {
            type: 'button',
            title: hex + ' — click to copy',
            onclick: function () { ui.copy(hex); },
            style: {
              background: hex, border: '1px solid var(--border)', borderRadius: '6px',
              height: '52px', cursor: 'pointer', color: luminance(rgb) > 0.35 ? '#000' : '#fff',
              fontSize: '10px', fontFamily: 'var(--mono)', padding: '0'
            }
          }, hex.slice(1));
          row.appendChild(cell);
        });
        return h('div.mt12', h('label.lbl', { text: title.toUpperCase() }), row);
      }

      /* ------------------------------------------------ contrast */

      var fg = ui.input({ value: '#111827', label: 'FOREGROUND' });
      var bg = ui.input({ value: '#ffffff', label: 'BACKGROUND' });
      var contrastOut = h('div');

      function checkContrast() {
        ui.clear(contrastOut);
        var a = parseColor(fg.value), b = parseColor(bg.value);
        if (!a || !b) { contrastOut.appendChild(ui.banner('err', 'Enter two readable colours.')); return; }

        var ratio = contrast(a, b);
        var sample = h('div', {
          style: {
            background: toHex(b), color: toHex(a), padding: '18px', borderRadius: '8px',
            border: '1px solid var(--border)', fontSize: '15px'
          }
        }, h('div', { style: { fontSize: '20px', fontWeight: '700' }, text: 'Large heading text' }),
           h('div', { style: { marginTop: '6px' }, text: 'Body copy at a normal size, the kind people actually have to read.' }));

        contrastOut.appendChild(sample);
        contrastOut.appendChild(h('div.stat-row.mt12',
          ui.stat(ratio.toFixed(2) + ':1', 'contrast ratio'),
          verdict('AA normal', ratio >= 4.5),
          verdict('AA large', ratio >= 3),
          verdict('AAA normal', ratio >= 7),
          verdict('AAA large', ratio >= 4.5)
        ));
      }

      function verdict(label, pass) {
        var box = ui.stat(pass ? 'Pass' : 'Fail', label);
        box.querySelector('b').style.color = pass ? 'var(--ok)' : 'var(--err)';
        return box;
      }

      /* ------------------------------------------------ layout */

      root.appendChild(ui.card('Colour',
        h('div.row', text, swatchPicker),
        h('div.mt12', swatch),
        error,
        h('div.mt12', values)
      ));
      root.appendChild(ui.card('Palette', palette));
      root.appendChild(ui.card('Contrast checker',
        h('div.grid2', fg, bg),
        h('div.row.mt12',
          ui.btn('Swap', function () { var t = fg.value; fg.value = bg.value; bg.value = t; checkContrast(); }, 'ghost'),
          ui.btn('Use current colour as foreground', function () { fg.value = text.value; checkContrast(); }, 'ghost')
        ),
        h('div.mt12', contrastOut)
      ));

      text.control.addEventListener('input', ui.debounce(function () { convert('text'); }, 200));
      swatchPicker.control.addEventListener('input', function () {
        text.value = swatchPicker.value;
        convert('picker');
      });
      fg.control.addEventListener('input', ui.debounce(checkContrast, 200));
      bg.control.addEventListener('input', ui.debounce(checkContrast, 200));

      convert();
    }
  });

  /* ---------------------------------------------------------- colour maths */

  /** Accepts hex, rgb(), hsl() and CSS colour names (resolved by the browser). */
  function parseColor(input) {
    var s = String(input).trim();
    if (!s) return null;

    var hex = /^#?([0-9a-f]{3,8})$/i.exec(s);
    if (hex) {
      var v = hex[1];
      if (v.length === 3 || v.length === 4) v = v.split('').map(function (c) { return c + c; }).join('');
      if (v.length !== 6 && v.length !== 8) return null;
      return {
        r: parseInt(v.slice(0, 2), 16),
        g: parseInt(v.slice(2, 4), 16),
        b: parseInt(v.slice(4, 6), 16),
        a: v.length === 8 ? Math.round(parseInt(v.slice(6, 8), 16) / 255 * 100) / 100 : 1
      };
    }

    var rgb = /^rgba?\(([^)]+)\)$/i.exec(s);
    if (rgb) {
      var nums = rgb[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
      if (nums.length < 3 || nums.slice(0, 3).some(isNaN)) return null;
      return { r: clamp255(nums[0]), g: clamp255(nums[1]), b: clamp255(nums[2]), a: nums.length > 3 && !isNaN(nums[3]) ? nums[3] : 1 };
    }

    var hsl = /^hsla?\(([^)]+)\)$/i.exec(s);
    if (hsl) {
      var parts = hsl[1].split(/[\s,\/]+/).filter(Boolean);
      var hue = parseFloat(parts[0]);
      var sat = parseFloat(parts[1]);
      var light = parseFloat(parts[2]);
      if ([hue, sat, light].some(isNaN)) return null;
      var out = hslToRgb({ h: ((hue % 360) + 360) % 360, s: sat, l: light });
      out.a = parts.length > 3 ? parseFloat(parts[3]) || 1 : 1;
      return out;
    }

    // Named colours: let the browser resolve them, then read the value back.
    if (/^[a-z]+$/i.test(s)) {
      var probe = document.createElement('span');
      probe.style.color = '';
      probe.style.color = s.toLowerCase();
      if (!probe.style.color) return null;
      document.body.appendChild(probe);
      var computed = getComputedStyle(probe).color;
      document.body.removeChild(probe);
      return parseColor(computed);
    }

    return null;
  }

  function clamp255(n) { return Math.max(0, Math.min(255, Math.round(n))); }

  function toHex(rgb) {
    return '#' + [rgb.r, rgb.g, rgb.b].map(function (c) { return clamp255(c).toString(16).padStart(2, '0'); }).join('');
  }

  function rgbToHsl(rgb) {
    var r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2, hue = 0, sat = 0;

    if (max !== min) {
      var d = max - min;
      sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) hue = (b - r) / d + 2;
      else hue = (r - g) / d + 4;
      hue *= 60;
    }
    return { h: Math.round(hue), s: Math.round(sat * 100), l: Math.round(l * 100) };
  }

  function hslToRgb(hsl) {
    var h = hsl.h / 360, s = hsl.s / 100, l = hsl.l / 100;
    if (s === 0) {
      var grey = Math.round(l * 255);
      return { r: grey, g: grey, b: grey, a: 1 };
    }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    return {
      r: Math.round(hueToChannel(p, q, h + 1 / 3) * 255),
      g: Math.round(hueToChannel(p, q, h) * 255),
      b: Math.round(hueToChannel(p, q, h - 1 / 3) * 255),
      a: 1
    };
  }

  function hueToChannel(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  function rgbToHsv(rgb) {
    var r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var hue = 0;
    if (d !== 0) {
      if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) hue = (b - r) / d + 2;
      else hue = (r - g) / d + 4;
      hue *= 60;
    }
    return { h: Math.round(hue), s: Math.round((max === 0 ? 0 : d / max) * 100), v: Math.round(max * 100) };
  }

  function rgbToCmyk(rgb) {
    var r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    var k = 1 - Math.max(r, g, b);
    if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
    return {
      c: Math.round((1 - r - k) / (1 - k) * 100),
      m: Math.round((1 - g - k) / (1 - k) * 100),
      y: Math.round((1 - b - k) / (1 - k) * 100),
      k: Math.round(k * 100)
    };
  }

  function luminance(rgb) {
    var channels = [rgb.r, rgb.g, rgb.b].map(function (c) {
      var v = c / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
})();
