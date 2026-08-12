/* Offline reference tables for the things nobody memorises. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  var STATUS = [
    ['100', 'Continue', 'The client should carry on with the request body.'],
    ['101', 'Switching Protocols', 'Server agrees to upgrade — this is how WebSockets start.'],
    ['200', 'OK', 'The standard success response.'],
    ['201', 'Created', 'A new resource exists; put its address in the Location header.'],
    ['202', 'Accepted', 'Queued for processing but not finished yet.'],
    ['204', 'No Content', 'Success with an intentionally empty body.'],
    ['206', 'Partial Content', 'A range request succeeded — used for resumable downloads and video seeking.'],
    ['301', 'Moved Permanently', 'Permanent redirect; clients and search engines should update the link.'],
    ['302', 'Found', 'Temporary redirect that many clients wrongly turn into a GET.'],
    ['303', 'See Other', 'Redirect that explicitly says "now GET this instead".'],
    ['304', 'Not Modified', 'The cached copy is still fresh; no body is sent.'],
    ['307', 'Temporary Redirect', 'Like 302 but the method is guaranteed to be preserved.'],
    ['308', 'Permanent Redirect', 'Like 301 but the method is guaranteed to be preserved.'],
    ['400', 'Bad Request', 'The request itself is malformed and cannot be parsed.'],
    ['401', 'Unauthorized', 'Actually means unauthenticated — no or bad credentials.'],
    ['403', 'Forbidden', 'Authenticated, understood, and still not allowed.'],
    ['404', 'Not Found', 'No resource at that address.'],
    ['405', 'Method Not Allowed', 'The path exists but not for this verb; reply with an Allow header.'],
    ['406', 'Not Acceptable', 'Nothing can satisfy the client’s Accept header.'],
    ['409', 'Conflict', 'The request collides with the current state — a duplicate or a stale write.'],
    ['410', 'Gone', 'It existed and was deliberately removed.'],
    ['413', 'Payload Too Large', 'The body exceeds what the server will take.'],
    ['415', 'Unsupported Media Type', 'Wrong Content-Type for this endpoint.'],
    ['418', "I'm a teapot", 'An April Fools joke from RFC 2324 that never quite died.'],
    ['422', 'Unprocessable Content', 'Syntax is fine, semantics are not — the usual validation-failure code.'],
    ['429', 'Too Many Requests', 'Rate limited; pair it with a Retry-After header.'],
    ['451', 'Unavailable For Legal Reasons', 'Blocked by a legal demand. The number nods to Fahrenheit 451.'],
    ['500', 'Internal Server Error', 'Something broke and the server has no better answer.'],
    ['501', 'Not Implemented', 'The server does not support the functionality required.'],
    ['502', 'Bad Gateway', 'An upstream server returned something invalid.'],
    ['503', 'Service Unavailable', 'Overloaded or down for maintenance; usually temporary.'],
    ['504', 'Gateway Timeout', 'An upstream server did not answer in time.'],
    ['507', 'Insufficient Storage', 'The server cannot store what is needed to finish.']
  ];

  var METHODS = [
    ['GET', 'Safe · Idempotent · Cacheable', 'Retrieve a resource. Must never change state.'],
    ['HEAD', 'Safe · Idempotent · Cacheable', 'Like GET but headers only — handy for size and freshness checks.'],
    ['POST', 'Not safe · Not idempotent', 'Submit data or create something. Repeating it repeats the effect.'],
    ['PUT', 'Not safe · Idempotent', 'Replace a resource wholesale at a known address.'],
    ['PATCH', 'Not safe · Not idempotent', 'Apply a partial modification.'],
    ['DELETE', 'Not safe · Idempotent', 'Remove a resource. Deleting twice leaves the same state.'],
    ['OPTIONS', 'Safe · Idempotent', 'Ask what is allowed — this is the CORS preflight.'],
    ['TRACE', 'Safe · Idempotent', 'Echo the request back. Usually disabled for security.'],
    ['CONNECT', 'Not safe · Not idempotent', 'Open a tunnel, as HTTPS proxies do.']
  ];

  var PORTS = [
    ['20, 21', 'FTP', 'File transfer — data and control'],
    ['22', 'SSH / SFTP', 'Encrypted shell and file transfer'],
    ['23', 'Telnet', 'Unencrypted remote shell — avoid'],
    ['25', 'SMTP', 'Mail transfer between servers'],
    ['53', 'DNS', 'Name resolution, UDP and TCP'],
    ['67, 68', 'DHCP', 'Address assignment'],
    ['80', 'HTTP', 'Unencrypted web traffic'],
    ['110', 'POP3', 'Mail retrieval, legacy'],
    ['143', 'IMAP', 'Mail retrieval'],
    ['443', 'HTTPS', 'TLS-encrypted web traffic'],
    ['465, 587', 'SMTPS / submission', 'Mail submission from clients'],
    ['993', 'IMAPS', 'IMAP over TLS'],
    ['1433', 'SQL Server', 'Microsoft SQL Server'],
    ['1521', 'Oracle', 'Oracle database listener'],
    ['3000', 'Dev server', 'Node, Next.js, Rails convention'],
    ['3306', 'MySQL / MariaDB', 'Relational database'],
    ['3389', 'RDP', 'Windows remote desktop'],
    ['5173', 'Vite', 'Vite dev server default'],
    ['5432', 'PostgreSQL', 'Relational database'],
    ['5672', 'AMQP', 'RabbitMQ messaging'],
    ['6379', 'Redis', 'In-memory data store'],
    ['8000, 8080', 'HTTP alternate', 'Dev servers and proxies'],
    ['8443', 'HTTPS alternate', 'TLS on a non-privileged port'],
    ['9000', 'PHP-FPM / MinIO', 'Depends on the stack'],
    ['9200', 'Elasticsearch', 'Search cluster REST API'],
    ['27017', 'MongoDB', 'Document database']
  ];

  var MIME = [
    ['.json', 'application/json', 'JSON data'],
    ['.js  .mjs', 'text/javascript', 'JavaScript — the registered type is text/javascript'],
    ['.html', 'text/html', 'HTML document'],
    ['.css', 'text/css', 'Stylesheet'],
    ['.csv', 'text/csv', 'Comma-separated values'],
    ['.txt', 'text/plain', 'Plain text'],
    ['.xml', 'application/xml', 'XML document'],
    ['.pdf', 'application/pdf', 'PDF document'],
    ['.zip', 'application/zip', 'ZIP archive'],
    ['.gz', 'application/gzip', 'Gzip archive'],
    ['.png', 'image/png', 'Lossless raster image'],
    ['.jpg  .jpeg', 'image/jpeg', 'Lossy photographic image'],
    ['.webp', 'image/webp', 'Modern raster format, smaller than JPEG'],
    ['.avif', 'image/avif', 'Newer format, smaller again'],
    ['.gif', 'image/gif', 'Animated raster image'],
    ['.svg', 'image/svg+xml', 'Vector image — can carry script, so sanitise it'],
    ['.ico', 'image/x-icon', 'Favicon'],
    ['.woff2', 'font/woff2', 'Compressed web font'],
    ['.mp3', 'audio/mpeg', 'Audio'],
    ['.mp4', 'video/mp4', 'Video'],
    ['.webm', 'video/webm', 'Video'],
    ['.wasm', 'application/wasm', 'WebAssembly module'],
    ['(form)', 'application/x-www-form-urlencoded', 'Classic HTML form encoding'],
    ['(upload)', 'multipart/form-data', 'File uploads'],
    ['(stream)', 'text/event-stream', 'Server-sent events'],
    ['(binary)', 'application/octet-stream', 'Unknown binary — triggers a download']
  ];

  var HEADERS = [
    ['Cache-Control', 'How and how long a response may be cached, e.g. max-age=3600, immutable'],
    ['Content-Type', 'The media type of the body, plus its charset'],
    ['Content-Security-Policy', 'Restricts what the page may load or execute — the strongest XSS defence'],
    ['Strict-Transport-Security', 'Forces HTTPS for a period, e.g. max-age=31536000'],
    ['X-Content-Type-Options: nosniff', 'Stops the browser guessing a different content type'],
    ['Access-Control-Allow-Origin', 'Which origins may read the response (CORS)'],
    ['Authorization', 'Credentials, usually "Bearer <token>"'],
    ['ETag / If-None-Match', 'Version tag enabling cheap 304 revalidation'],
    ['Retry-After', 'How long to wait after a 429 or 503'],
    ['Referrer-Policy', 'How much of the referring URL to reveal'],
    ['Vary', 'Which request headers change the response — critical for correct caching']
  ];

  DevBox.register({
    id: 'cheatsheet',
    icon: '📖',
    category: 'ref',
    keywords: 'http status codes methods ports mime types headers reference cheatsheet lookup 404 500',
    name: { en: 'HTTP & MIME Reference', uz: 'HTTP va MIME maʼlumotnomasi', ru: 'Справочник HTTP и MIME' },
    desc: {
      en: 'Searchable tables of HTTP status codes, methods, security headers, common ports and MIME types.',
      uz: 'HTTP holat kodlari, metodlar, xavfsizlik sarlavhalari, portlar va MIME turlari boʻyicha qidiriladigan jadvallar.',
      ru: 'Таблицы с поиском: коды состояния HTTP, методы, заголовки безопасности, порты и MIME-типы.'
    },

    mount: function (root, ctx) {
      var query = ui.input({ placeholder: 'Filter everything — try 404, idempotent, postgres, webp…' });
      var host = h('div.stack');

      var SECTIONS = [
        { title: 'HTTP status codes', head: ['Code', 'Name', 'Meaning'], rows: STATUS },
        { title: 'HTTP methods', head: ['Method', 'Properties', 'Purpose'], rows: METHODS },
        { title: 'Response headers worth knowing', head: ['Header', 'What it does'], rows: HEADERS },
        { title: 'Common ports', head: ['Port', 'Service', 'Notes'], rows: PORTS },
        { title: 'MIME types', head: ['Extension', 'Type', 'Notes'], rows: MIME }
      ];

      function draw() {
        var terms = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
        ui.clear(host);
        var total = 0;

        SECTIONS.forEach(function (section) {
          var rows = section.rows.filter(function (row) {
            if (!terms.length) return true;
            var hay = row.join(' ').toLowerCase();
            return terms.every(function (term) { return hay.indexOf(term) >= 0; });
          });
          if (!rows.length) return;
          total += rows.length;

          var table = h('table.tbl',
            h('thead', h('tr', section.head.map(function (label) { return h('th', label); }))),
            h('tbody', rows.map(function (row) {
              return h('tr', row.map(function (cell, i) {
                return h('td' + (i === 0 ? '.mono' : ''), { text: cell });
              }));
            }))
          );

          var card = ui.card(section.title + '  ·  ' + rows.length, h('div.tbl-scroll', table));
          card.body.classList.add('flush');
          host.appendChild(card);
        });

        if (!total) host.appendChild(ui.banner('warn', 'Nothing matches “' + query.value + '”.'));
      }

      root.appendChild(ui.card('Search', query));
      root.appendChild(host);

      query.control.addEventListener('input', ui.debounce(draw, 150));
      draw();
    }
  });
})();
