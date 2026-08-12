/* Password and passphrase generation with an honest entropy readout. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  var SETS = {
    lower: 'abcdefghijklmnopqrstuvwxyz',
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    digits: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.?/'
  };

  var AMBIGUOUS = 'Il1O0o';

  // A short, deliberately plain word list for passphrases. Every word is
  // 3–7 letters so the result stays typable.
  var WORDS = ('able acid aged also area army away baby back ball band bank base bath bear beat been beer bell belt bend best bike bird bite blue boat body bold bone book boot born both bowl bulk burn bush busy cake calm camp cane card care cart case cash cast cell chat chef chip city claw clay clip club coal coat code coin cold cook cool cope copy cord core corn cost crew crop crow cube cure curl dark dash data dawn deal dear debt deck deep deer desk dial dice diet disk dive dock does dome door dose dove down draw drop drum dual dusk dust duty each earn ease east easy edge exit face fact fade fair fall fame farm fast fate fear feed feel fern file fill film find fine fire firm fish fist five flag flat flew flow foam fold folk food fork form fort four free frog fuel full fund gain game gate gave gear gift girl give glad goal goat gold golf gone good gown grab gray grew grid grin grip grow gulf hair half hall hand hang hard harm hawk head heal heap hear heat held hell helm help herb herd hero hide high hill hint hire hold hole holy home hone hood hook hope horn host hour huge hunt hurt icon idea inch iron item jade jail jazz join joke jump jury just keen keep kept kick kind king kite knee knew know lace lake lamb lamp land lane last late lawn lead leaf lean leap left lend lens less life lift like lime line link lion list live load loan lock loft logo long look loop lord lose loud love luck lump lung made mail main make male mall many maps mark mask mass mast mate math maze meal mean meat meet melt menu mesh mice mild mile milk mill mind mine mint miss mist mode mood moon more moss most moth move much mule name near neat neck need nest news next nice node none noon norm nose note noun oath odds omit once only onto open oral oven over pace pack page paid pain pair palm park part pass past path peak pear peel pens pest pick pier pile pine pink pipe plan play plot plug plum poem poet pole pond pony pool poor pope pork port pose post pour pull pump pure push quit race rack raft rage rail rain rake ramp rank rare rate read real reed reef rely rent rest rice rich ride ring ripe rise risk road robe rock rode role roll roof room root rope rose rule rush rust sage sail salt same sand save scan seal seat seed seek seem self sell send sept ship shoe shop shot show shut side sign silk sing sink site size skin skip slab sled slid slim slip slow snap snow soap sofa soft soil sold sole solo some song sons soon sort soul soup sour span spin spot spun star stay stem step stir stop such suit sung sunk sure swim take tale talk tall tank tape task team tear tech tell tend tent term test text than that them then they thin this thus tide tidy tile till time tiny toll tone took tool torn tour town trap tray tree trim trip true tube tune turn twin type unit upon urge used user vain vase vast verb very vest view vine visa void vote wage wait wake walk wall want ward warm warn wash wave weak wear weed week well went were west what when whip wide wife wild will wind wine wing wipe wire wise wish with wolf wood wool word wore work worm worn wrap yard yarn year yoga your zeal zero zone zoom').split(' ');

  DevBox.register({
    id: 'password',
    icon: '🔑',
    category: 'security',
    keywords: 'password generate random secret passphrase diceware entropy strength secure key',
    name: { en: 'Password Generator', uz: 'Parol generatori', ru: 'Генератор паролей' },
    desc: {
      en: 'Generate passwords and passphrases from the cryptographic RNG, with the entropy spelled out in bits.',
      uz: 'Kriptografik tasodif manbaidan parol va parol-iboralar hosil qiling — entropiyasi bitlarda koʻrsatiladi.',
      ru: 'Генерация паролей и парольных фраз на криптографическом ГСЧ с расчётом энтропии в битах.'
    },

    mount: function (root, ctx) {
      /* ------------------------------------------------ password */

      var length = ui.input({ type: 'range', value: ctx.store.get('length', 20), min: 6, max: 64 });
      var lengthLabel = h('b', { text: String(ctx.store.get('length', 20)) });

      var opts = {
        lower: ui.checkbox('a–z', true, refresh),
        upper: ui.checkbox('A–Z', true, refresh),
        digits: ui.checkbox('0–9', true, refresh),
        symbols: ui.checkbox('!@#$…', true, refresh),
        noAmbiguous: ui.checkbox('Avoid look-alikes (Il1O0o)', false, refresh)
      };

      var count = ui.input({ type: 'number', value: 5, min: 1, max: 100, label: 'HOW MANY' });
      var out = ui.output({ title: 'Passwords' });
      var meter = h('div');

      function alphabet() {
        var chars = '';
        ['lower', 'upper', 'digits', 'symbols'].forEach(function (key) {
          if (opts[key].checked) chars += SETS[key];
        });
        if (opts.noAmbiguous.checked) {
          chars = chars.split('').filter(function (c) { return AMBIGUOUS.indexOf(c) < 0; }).join('');
        }
        return chars;
      }

      function refresh() {
        var len = Number(length.value);
        lengthLabel.textContent = String(len);
        ctx.store.set('length', len);

        var chars = alphabet();
        ui.clear(meter);
        if (!chars) {
          out.set('Select at least one character set.', 'err');
          return;
        }

        var n = Math.min(100, Math.max(1, Number(count.value) || 1));
        var lines = [];
        for (var i = 0; i < n; i++) lines.push(pick(chars, len));
        out.set(lines.join('\n'));

        var bits = len * Math.log2(chars.length);
        meter.appendChild(strengthView(bits, chars.length + ' possible characters × ' + len + ' positions'));
      }

      /* ------------------------------------------------ passphrase */

      var words = ui.input({ type: 'number', value: 5, min: 3, max: 12, label: 'WORDS' });
      var sep = ui.select({ options: [['-', 'hyphen  -'], ['.', 'dot  .'], ['_', 'underscore  _'], [' ', 'space'], ['', 'nothing']], value: '-', label: 'SEPARATOR' });
      var capitalise = ui.checkbox('Capitalise each word', true, phrase);
      var addNumber = ui.checkbox('Append a digit', false, phrase);
      var phraseOut = ui.output({ title: 'Passphrases' });
      var phraseMeter = h('div');

      function phrase() {
        var n = Math.min(12, Math.max(3, Number(words.value) || 5));
        var lines = [];
        for (var i = 0; i < 5; i++) {
          var picked = [];
          for (var j = 0; j < n; j++) {
            var word = WORDS[randomBelow(WORDS.length)];
            picked.push(capitalise.checked ? word.charAt(0).toUpperCase() + word.slice(1) : word);
          }
          var line = picked.join(sep.value);
          if (addNumber.checked) line += randomBelow(10);
          lines.push(line);
        }
        phraseOut.set(lines.join('\n'));

        var bits = n * Math.log2(WORDS.length) + (addNumber.checked ? Math.log2(10) : 0);
        ui.clear(phraseMeter).appendChild(strengthView(bits, WORDS.length + '-word list × ' + n + ' words'));
      }

      /* ------------------------------------------------ layout */

      root.appendChild(ui.card('Random password',
        h('div.row', h('label.lbl', { text: 'LENGTH' }), lengthLabel),
        length,
        h('div.row.mt12', opts.lower, opts.upper, opts.digits, opts.symbols, opts.noAmbiguous),
        h('div.row.mt12', count, ui.btn('Regenerate', refresh, 'primary')),
        h('div.mt12', meter)
      ));
      root.appendChild(out);

      root.appendChild(ui.card('Passphrase',
        h('div.grid3', words, sep, h('div', h('label.lbl', { text: 'OPTIONS' }), h('div.row', capitalise, addNumber))),
        h('div.row.mt12', ui.btn('Regenerate', phrase, 'primary')),
        h('div.mt12', phraseMeter)
      ));
      root.appendChild(phraseOut);

      root.appendChild(ui.banner('info',
        'Entropy assumes an attacker knows exactly how the password was generated and only has to guess the random part — the honest assumption. Anything above 75 bits is comfortable for a password manager entry.'));

      length.control.addEventListener('input', refresh);
      count.control.addEventListener('input', ui.debounce(refresh, 200));
      words.control.addEventListener('input', ui.debounce(phrase, 200));
      sep.addEventListener('change', phrase);

      refresh();
      phrase();
    }
  });

  /* ---------------------------------------------------------- helpers */

  function strengthView(bits, detail) {
    var label, colour;
    if (bits < 40) { label = 'Weak'; colour = 'var(--err)'; }
    else if (bits < 60) { label = 'Fair'; colour = 'var(--warn)'; }
    else if (bits < 80) { label = 'Strong'; colour = 'var(--ok)'; }
    else { label = 'Very strong'; colour = 'var(--ok)'; }

    var bar = h('div', { style: { height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden', marginTop: '8px' } },
      h('div', { style: { height: '100%', width: Math.min(100, bits / 128 * 100) + '%', background: colour, transition: 'width .2s' } }));

    return h('div',
      h('div.row', h('b', { text: label, style: { color: colour } }), h('span.note', { text: Math.round(bits) + ' bits of entropy · ' + detail })),
      bar,
      h('div.note.mt8', { text: 'At a trillion guesses per second, an exhaustive search would average ' + crackTime(bits) + '.' })
    );
  }

  function crackTime(bits) {
    var seconds = Math.pow(2, bits - 1) / 1e12;
    var units = [['billion years', 3.15e16], ['million years', 3.15e13], ['thousand years', 3.15e10],
                 ['years', 3.15e7], ['days', 86400], ['hours', 3600], ['minutes', 60], ['seconds', 1]];
    for (var i = 0; i < units.length; i++) {
      if (seconds >= units[i][1]) {
        var n = seconds / units[i][1];
        return (n >= 1000 ? n.toExponential(1) : n.toFixed(n < 10 ? 1 : 0)) + ' ' + units[i][0];
      }
    }
    return 'well under a second';
  }

  /** Uniform pick with rejection sampling — no modulo bias. */
  function randomBelow(limit) {
    var range = 4294967296;
    var buf = new Uint32Array(1);
    var cutoff = range - (range % limit);
    do { crypto.getRandomValues(buf); } while (buf[0] >= cutoff);
    return buf[0] % limit;
  }

  function pick(chars, length) {
    var out = '';
    for (var i = 0; i < length; i++) out += chars[randomBelow(chars.length)];
    return out;
  }
})();
