# Contributing to Shashka

Thanks for wanting to help. This project has one unusual constraint that shapes
everything else, so please read the first section before opening a pull request.

## The one rule

**Nothing may leave the page.**

No `fetch`, no `XMLHttpRequest`, no WebSockets, no CDN scripts, no web fonts, no
analytics, no remote images. A user must be able to open `dist/shashka.html` on a
machine with no network and have every feature work exactly the same.

This is not a stylistic preference. It is the entire reason anyone would choose this
over the hundred online tools that already exist, so a pull request that breaks it
cannot be merged no matter how useful the feature is.

Two consequences follow:

- **No npm dependencies.** `package.json` has no `dependencies` block and should not
  grow one. If you need an algorithm, implement it in `src/lib/` with tests.
- **No build step for development.** `index.html` loads plain `<script>` tags. The build
  only concatenates; it never transpiles. Write JavaScript that browsers run as-is.

## Adding a tool

1. Create `src/tools/yourtool.js`:

```js
/* One line saying what this tool does. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  DevBox.register({
    id: 'yourtool',              // unique, lowercase, used in the URL hash
    icon: '⚑',                   // one or two characters
    category: 'text',            // data | security | time | text | visual | ref
    keywords: 'words that should find this in the palette',
    name: { en: '…', uz: '…', ru: '…' },
    desc: { en: '…', uz: '…', ru: '…' },

    mount: function (root, ctx) {
      // ctx.store  — per-tool localStorage (get/set/del)
      // ctx.t      — translation helper
      // ctx.lang   — current language code
      var out = ui.output({ title: 'Result' });
      var input = ui.textarea({ oninput: function () { out.set(input.value); } });

      root.appendChild(ui.card('Input', input));
      root.appendChild(out);
    }
  });
})();
```

2. Add one `<script src="src/tools/yourtool.js"></script>` line to `index.html`,
   in the tools block, in the position you want it to appear.

3. Run the checks:

```bash
npm test                     # library unit tests
node test/smoke.mjs          # mounts every tool in headless Chrome
npm run build                # regenerate dist/shashka.html
node test/smoke.mjs --dist   # verify the bundle too
```

4. Commit the rebuilt `dist/shashka.html` along with your source change. CI checks
   that the committed bundle matches the sources.

### What the smoke test enforces

Every registered tool must have `name` and `desc` in all three languages, a unique
`id`, and must mount without throwing or logging an error. Tools that render fewer
than four DOM nodes are treated as broken.

## Style

The codebase deliberately reads like the era it runs in: `var`, IIFEs, no
transpilation. Match the surrounding file rather than the newest syntax you know.

- Build DOM with the `h()` helper rather than `innerHTML`. Where `innerHTML` is
  unavoidable (the Markdown preview), escape first and sanitise after.
- Use the shared `DevBox.ui` primitives — `card`, `output`, `textarea`, `input`,
  `select`, `checkbox`, `btn`, `chip`, `stat`, `banner`, `dropzone` — so tools look
  like one product.
- Debounce anything that runs on every keystroke: `ui.debounce(fn, 250)`.
- Persist inputs through `ctx.store`, capped to a sane length.

## Writing the English copy

Tool descriptions are read by people deciding whether a tool does what they need.
Say what it does and what is unusual about it. Avoid marketing adjectives, and never
promise something the tool does not do.

## Adding a library

Anything in `src/lib/` needs tests in `test/run.js`. Where a published test vector
exists — RFC test suites, worked examples from a specification — use it rather than
asserting against your own output. The QR encoder is checked with an independently
written decoder for exactly this reason.

## Reporting bugs

Please include the browser and version, the tool id, and the input that triggers it.
Since nothing is sent anywhere, there are no server logs to check — a reproducible
input is the only evidence available.

## Licence

By contributing you agree that your work is released under the [MIT Licence](LICENSE).
