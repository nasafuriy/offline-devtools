/* JWT decoding, claim inspection and HMAC signature verification. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  var TIME_CLAIMS = { exp: 'Expires', iat: 'Issued at', nbf: 'Not before', auth_time: 'Authenticated at', updated_at: 'Updated at' };

  var CLAIM_NOTES = {
    iss: 'Issuer', sub: 'Subject', aud: 'Audience', jti: 'JWT ID',
    scope: 'Scopes', azp: 'Authorized party', typ: 'Type', alg: 'Algorithm', kid: 'Key ID'
  };

  DevBox.register({
    id: 'jwt',
    icon: '🎟',
    category: 'security',
    keywords: 'jwt token decode verify jws claims bearer auth oauth signature hs256',
    name: { en: 'JWT Decoder', uz: 'JWT dekoder', ru: 'JWT-декодер' },
    desc: {
      en: 'Decode a JSON Web Token, read its claims in plain language, and verify an HMAC signature locally.',
      uz: 'JWT’ni ochish, daʼvolarini tushunarli tilda koʻrish va HMAC imzosini shu yerda tekshirish.',
      ru: 'Разбор JSON Web Token, понятное представление claim-ов и локальная проверка HMAC-подписи.'
    },

    mount: function (root, ctx) {
      root.appendChild(ui.banner('info',
        'Tokens pasted here are decoded in this page only. Nothing is sent anywhere — which is exactly why you should not paste production tokens into online decoders.'));

      var input = ui.textarea({ short: true, placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U', value: ctx.store.get('token', '') });

      var status = h('div');
      var headerOut = ui.output({ title: 'Header' });
      var payloadOut = ui.output({ title: 'Payload' });
      var claims = h('div');
      var claimsCard = ui.card('Claims', claims);

      var secret = ui.input({ placeholder: 'HMAC secret (or base64: prefix for raw key bytes)' });
      var verifyOut = h('div');

      var parsed = null;

      function decode() {
        ctx.store.set('token', input.value.slice(0, 20000));
        ui.clear(status);
        ui.clear(claims);
        ui.clear(verifyOut);
        parsed = null;

        var token = input.value.trim().replace(/^Bearer\s+/i, '');
        if (!token) { headerOut.set(''); payloadOut.set(''); claimsCard.style.display = 'none'; return; }

        var segments = token.split('.');
        if (segments.length < 2) {
          status.appendChild(ui.banner('err', 'A JWT has at least two dot-separated segments; this has ' + segments.length + '.'));
          headerOut.set(''); payloadOut.set('');
          claimsCard.style.display = 'none';
          return;
        }

        var header, payload;
        try { header = JSON.parse(ui.bytesToUtf8(ui.b64Decode(ui.b64UrlToB64(segments[0])))); }
        catch (err) { status.appendChild(ui.banner('err', 'The header is not valid base64url JSON: ' + err.message)); return; }
        try { payload = JSON.parse(ui.bytesToUtf8(ui.b64Decode(ui.b64UrlToB64(segments[1])))); }
        catch (err) {
          status.appendChild(ui.banner('err', 'The payload is not valid base64url JSON: ' + err.message));
          headerOut.set(JSON.stringify(header, null, 2));
          return;
        }

        parsed = { header: header, payload: payload, segments: segments };
        headerOut.set(JSON.stringify(header, null, 2));
        payloadOut.set(JSON.stringify(payload, null, 2));
        claimsCard.style.display = '';

        if (header.alg === 'none') {
          status.appendChild(ui.banner('warn', 'This token declares alg: "none" — it carries no signature and must never be trusted.'));
        } else if (segments.length < 3 || !segments[2]) {
          status.appendChild(ui.banner('warn', 'The signature segment is missing.'));
        }

        renderClaims(payload, header);
      }

      function renderClaims(payload, header) {
        var now = Date.now() / 1000;
        var list = h('dl.kv');

        list.appendChild(h('dt', { text: 'Algorithm' }));
        list.appendChild(h('dd', { text: (header.alg || '—') + (header.typ ? '  ·  typ ' + header.typ : '') + (header.kid ? '  ·  kid ' + header.kid : '') }));

        Object.keys(payload).forEach(function (key) {
          var value = payload[key];
          var label = TIME_CLAIMS[key] || CLAIM_NOTES[key] || key;
          list.appendChild(h('dt', { text: label + (label === key ? '' : ' (' + key + ')') }));

          if (TIME_CLAIMS[key] && typeof value === 'number') {
            var when = new Date(value * 1000);
            list.appendChild(h('dd', { text: when.toISOString() + '  ·  ' + relative(value - now) }));
          } else if (typeof value === 'object') {
            list.appendChild(h('dd', { text: JSON.stringify(value) }));
          } else {
            list.appendChild(h('dd', { text: String(value) }));
          }
        });

        claims.appendChild(list);

        if (typeof payload.exp === 'number') {
          var left = payload.exp - now;
          claims.appendChild(h('div.mt12', left <= 0
            ? ui.banner('err', 'Expired ' + relative(left) + '.')
            : ui.banner('ok', 'Valid for another ' + duration(left) + '.')));
        }
        if (typeof payload.nbf === 'number' && payload.nbf > now) {
          claims.appendChild(h('div.mt8', ui.banner('warn', 'Not valid yet — starts ' + relative(payload.nbf - now) + '.')));
        }
      }

      function verify() {
        ui.clear(verifyOut);
        if (!parsed) return verifyOut.appendChild(ui.banner('err', 'Decode a token first.'));
        if (parsed.segments.length < 3) return verifyOut.appendChild(ui.banner('err', 'This token has no signature segment.'));
        if (!crypto.subtle) return verifyOut.appendChild(ui.banner('err', 'Web Crypto is unavailable in this context.'));

        var alg = parsed.header.alg || '';
        var hash = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' }[alg];
        if (!hash) {
          return verifyOut.appendChild(ui.banner('warn',
            'Only HS256/HS384/HS512 can be checked with a shared secret. This token uses "' + alg + '", which needs the issuer’s public key.'));
        }

        var keyBytes;
        try {
          keyBytes = /^base64:/i.test(secret.value)
            ? ui.b64Decode(ui.b64UrlToB64(secret.value.replace(/^base64:/i, '')))
            : ui.utf8Bytes(secret.value);
        } catch (err) {
          return verifyOut.appendChild(ui.banner('err', 'The base64 secret could not be decoded.'));
        }

        var signed = ui.utf8Bytes(parsed.segments[0] + '.' + parsed.segments[1]);
        var signature = ui.b64Decode(ui.b64UrlToB64(parsed.segments[2]));

        crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: hash }, false, ['verify'])
          .then(function (key) { return crypto.subtle.verify('HMAC', key, signature, signed); })
          .then(function (valid) {
            verifyOut.appendChild(valid
              ? ui.banner('ok', 'Signature is valid for this secret (' + alg + ').')
              : ui.banner('err', 'Signature does not match this secret.'));
          })
          .catch(function (err) { verifyOut.appendChild(ui.banner('err', err.message)); });
      }

      root.appendChild(ui.card('Token', input, h('div.row.mt12',
        ui.btn('Decode', decode, 'primary'),
        ui.btn('Clear', function () { input.value = ''; decode(); }, 'ghost')
      )));
      root.appendChild(status);
      root.appendChild(h('div.grid2', headerOut, payloadOut));
      root.appendChild(claimsCard);
      root.appendChild(ui.card('Verify signature',
        h('div.row', secret, ui.btn('Verify', verify, 'primary')),
        h('div.mt12', verifyOut)
      ));

      input.addEventListener('input', ui.debounce(decode, 300));
      secret.control.addEventListener('keydown', function (e) { if (e.key === 'Enter') verify(); });
      decode();
    }
  });

  function duration(seconds) {
    seconds = Math.abs(Math.round(seconds));
    var units = [['year', 31536000], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
    for (var i = 0; i < units.length; i++) {
      if (seconds >= units[i][1] || i === units.length - 1) {
        var n = Math.floor(seconds / units[i][1]);
        return n + ' ' + units[i][0] + (n === 1 ? '' : 's');
      }
    }
    return seconds + ' seconds';
  }

  function relative(delta) {
    return delta >= 0 ? 'in ' + duration(delta) : duration(delta) + ' ago';
  }
})();
