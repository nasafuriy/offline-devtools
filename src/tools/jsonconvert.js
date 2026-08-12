/* JSON → TypeScript / Go / Python / JSON Schema type generation. */
(function () {
  'use strict';
  var ui = DevBox.ui, h = ui.h;

  DevBox.register({
    id: 'jsonconvert',
    icon: '⇄',
    category: 'data',
    keywords: 'json typescript interface go struct python dataclass schema types generate',
    name: { en: 'JSON to Types', uz: 'JSON’dan tiplar', ru: 'JSON в типы' },
    desc: {
      en: 'Turn a sample JSON payload into TypeScript interfaces, Go structs, Python dataclasses or a JSON Schema.',
      uz: 'Namunaviy JSON’dan TypeScript interfeys, Go struct, Python dataclass yoki JSON Schema hosil qiling.',
      ru: 'Превратите пример JSON в интерфейсы TypeScript, структуры Go, dataclass Python или JSON Schema.'
    },

    mount: function (root, ctx) {
      var SAMPLE = '{\n  "id": 42,\n  "name": "Ada",\n  "active": true,\n  "score": 9.5,\n  "tags": ["math", "code"],\n  "address": { "city": "London", "zip": null }\n}';

      var input = ui.textarea({ tall: true, value: ctx.store.get('input', SAMPLE) });
      var rootName = ui.input({ value: ctx.store.get('rootName', 'Root'), placeholder: 'Root type name' });
      var target = ui.select({
        options: [['ts', 'TypeScript'], ['go', 'Go'], ['py', 'Python'], ['schema', 'JSON Schema']],
        value: ctx.store.get('target', 'ts')
      });
      var out = ui.output({ title: 'Generated types', download: function () { return 'types' + EXT[target.value]; } });

      var EXT = { ts: '.ts', go: '.go', py: '.py', schema: '.schema.json' };

      function run() {
        ctx.store.set('input', input.value.slice(0, 100000));
        ctx.store.set('target', target.value);
        ctx.store.set('rootName', rootName.value);

        var text = input.value.trim();
        if (!text) return out.set('');

        var data;
        try { data = JSON.parse(text); }
        catch (err) { return out.set('Invalid JSON: ' + err.message, 'err'); }

        var name = pascal(rootName.value || 'Root');
        try {
          var type = infer(data);
          if (target.value === 'ts') out.set(emitTs(type, name));
          else if (target.value === 'go') out.set(emitGo(type, name));
          else if (target.value === 'py') out.set(emitPy(type, name));
          else out.set(JSON.stringify(emitSchema(type), null, 2));
        } catch (err) {
          out.set('Could not generate types: ' + err.message, 'err');
        }
      }

      root.appendChild(ui.card('Sample JSON', input));
      root.appendChild(h('div.row', target, rootName, ui.btn('Generate', run, 'primary')));
      root.appendChild(out);

      input.addEventListener('input', ui.debounce(run, 350));
      target.addEventListener('change', run);
      rootName.control.addEventListener('input', ui.debounce(run, 350));
      run();
    }
  });

  /* ---------------------------------------------------------- inference */

  // A type is {kind, fields?, required?, items?, nullable?}
  function infer(value) {
    if (value === null) return { kind: 'null', nullable: true };
    if (Array.isArray(value)) {
      if (!value.length) return { kind: 'array', items: { kind: 'any' } };
      return { kind: 'array', items: value.map(infer).reduce(merge) };
    }
    if (typeof value === 'object') {
      var fields = {};
      Object.keys(value).forEach(function (key) { fields[key] = infer(value[key]); });
      return { kind: 'object', fields: fields, required: Object.keys(value) };
    }
    if (typeof value === 'number') return { kind: Number.isInteger(value) ? 'integer' : 'number' };
    if (typeof value === 'boolean') return { kind: 'boolean' };
    return { kind: 'string' };
  }

  /** Unifies the element types seen across an array. */
  function merge(a, b) {
    if (a.kind === 'null') return Object.assign({}, b, { nullable: true });
    if (b.kind === 'null') return Object.assign({}, a, { nullable: true });
    if (a.kind === 'integer' && b.kind === 'number') return { kind: 'number', nullable: a.nullable || b.nullable };
    if (a.kind === 'number' && b.kind === 'integer') return { kind: 'number', nullable: a.nullable || b.nullable };
    if (a.kind !== b.kind) return { kind: 'any', nullable: a.nullable || b.nullable };

    if (a.kind === 'array') return { kind: 'array', items: merge(a.items, b.items), nullable: a.nullable || b.nullable };

    if (a.kind === 'object') {
      var fields = {};
      var keys = Object.keys(a.fields).concat(Object.keys(b.fields).filter(function (k) { return !(k in a.fields); }));
      keys.forEach(function (key) {
        if (key in a.fields && key in b.fields) fields[key] = merge(a.fields[key], b.fields[key]);
        else fields[key] = a.fields[key] || b.fields[key];
      });
      var required = (a.required || []).filter(function (k) { return (b.required || []).indexOf(k) >= 0; });
      return { kind: 'object', fields: fields, required: required, nullable: a.nullable || b.nullable };
    }
    return { kind: a.kind, nullable: a.nullable || b.nullable };
  }

  /* ---------------------------------------------------------- naming */

  function pascal(name) {
    return String(name).replace(/[^A-Za-z0-9]+(.)?/g, function (_, c) { return c ? c.toUpperCase() : ''; })
      .replace(/^[a-z]/, function (c) { return c.toUpperCase(); }) || 'Root';
  }

  function singular(name) {
    if (/ies$/i.test(name)) return name.slice(0, -3) + 'y';
    if (/(s|ch|sh|x|z)es$/i.test(name)) return name.slice(0, -2);
    if (/[^s]s$/i.test(name)) return name.slice(0, -1);
    return name;
  }

  var INITIALISMS = ['ID', 'URL', 'URI', 'API', 'HTTP', 'HTTPS', 'JSON', 'XML', 'HTML', 'SQL', 'UUID', 'IP', 'DB', 'TTL', 'CPU', 'OS'];

  function goName(key) {
    return String(key).split(/[^A-Za-z0-9]+/).filter(Boolean).map(function (part) {
      var upper = part.toUpperCase();
      if (INITIALISMS.indexOf(upper) >= 0) return upper;
      return part.charAt(0).toUpperCase() + part.slice(1);
    }).join('') || 'Field';
  }

  function isSafeIdent(key) { return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key); }

  /**
   * Walks the type tree and assigns a unique name to every nested object,
   * returning them in definition order (children before parents).
   */
  function collect(type, name, seen, order) {
    if (type.kind === 'object') {
      var unique = name, n = 2;
      while (seen.has(unique) && seen.get(unique) !== type) unique = name + n++;
      if (!seen.has(unique)) {
        seen.set(unique, type);
        type.__name = unique;
        Object.keys(type.fields).forEach(function (key) {
          collect(type.fields[key], pascal(singular(key)), seen, order);
        });
        order.push({ name: unique, type: type });
      }
    } else if (type.kind === 'array') {
      collect(type.items, name, seen, order);
    }
    return order;
  }

  /* ---------------------------------------------------------- emitters */

  function emitTs(type, rootName) {
    var defs = collect(type, rootName, new Map(), []);
    if (!defs.length) return 'export type ' + rootName + ' = ' + tsType(type) + ';';

    return defs.map(function (def) {
      var lines = Object.keys(def.type.fields).map(function (key) {
        var field = def.type.fields[key];
        var optional = (def.type.required || []).indexOf(key) < 0;
        var label = isSafeIdent(key) ? key : JSON.stringify(key);
        return '  ' + label + (optional ? '?' : '') + ': ' + tsType(field) + ';';
      });
      return 'export interface ' + def.name + ' {\n' + lines.join('\n') + '\n}';
    }).join('\n\n');
  }

  function tsType(type) {
    var base;
    switch (type.kind) {
      case 'object': base = type.__name || 'Record<string, unknown>'; break;
      case 'array': base = tsType(type.items); base = /[|&]/.test(base) ? '(' + base + ')[]' : base + '[]'; break;
      case 'integer': case 'number': base = 'number'; break;
      case 'boolean': base = 'boolean'; break;
      case 'string': base = 'string'; break;
      case 'null': return 'null';
      default: base = 'unknown';
    }
    return type.nullable ? base + ' | null' : base;
  }

  function emitGo(type, rootName) {
    var defs = collect(type, rootName, new Map(), []);
    if (!defs.length) return 'type ' + rootName + ' ' + goType(type);

    return defs.slice().reverse().map(function (def) {
      var rows = Object.keys(def.type.fields).map(function (key) {
        return [goName(key), goType(def.type.fields[key]), '`json:"' + key +
          ((def.type.required || []).indexOf(key) < 0 ? ',omitempty' : '') + '"`'];
      });
      var w0 = Math.max.apply(null, rows.map(function (r) { return r[0].length; }).concat([1]));
      var w1 = Math.max.apply(null, rows.map(function (r) { return r[1].length; }).concat([1]));
      var body = rows.map(function (r) {
        return '\t' + r[0].padEnd(w0) + ' ' + r[1].padEnd(w1) + ' ' + r[2];
      }).join('\n');
      return 'type ' + def.name + ' struct {\n' + body + '\n}';
    }).join('\n\n');
  }

  function goType(type) {
    var base;
    switch (type.kind) {
      case 'object': base = type.__name || 'map[string]interface{}'; break;
      case 'array': return '[]' + goType(type.items);
      case 'integer': base = 'int64'; break;
      case 'number': base = 'float64'; break;
      case 'boolean': base = 'bool'; break;
      case 'string': base = 'string'; break;
      case 'null': return 'interface{}';
      default: return 'interface{}';
    }
    return type.nullable ? '*' + base : base;
  }

  function emitPy(type, rootName) {
    var defs = collect(type, rootName, new Map(), []);
    var head = 'from __future__ import annotations\n\nfrom dataclasses import dataclass\nfrom typing import Any, Optional\n\n';
    if (!defs.length) return head + rootName + ' = ' + pyType(type);

    // `collect` already returns children before parents, which is the order
    // Python needs for the annotations to resolve.
    return head + defs.map(function (def) {
      var body = Object.keys(def.type.fields).map(function (key) {
        var field = def.type.fields[key];
        var optional = (def.type.required || []).indexOf(key) < 0;
        var t = pyType(field);
        return '    ' + pySafe(key) + ': ' + (optional ? 'Optional[' + t + '] = None' : t);
      }).join('\n');
      return '@dataclass\nclass ' + def.name + ':\n' + (body || '    pass');
    }).join('\n\n\n');
  }

  function pyType(type) {
    var base;
    switch (type.kind) {
      case 'object': base = type.__name || 'dict[str, Any]'; break;
      case 'array': base = 'list[' + pyType(type.items) + ']'; break;
      case 'integer': base = 'int'; break;
      case 'number': base = 'float'; break;
      case 'boolean': base = 'bool'; break;
      case 'string': base = 'str'; break;
      case 'null': return 'None';
      default: base = 'Any';
    }
    return type.nullable ? 'Optional[' + base + ']' : base;
  }

  var PY_KEYWORDS = ['class', 'def', 'from', 'import', 'return', 'lambda', 'global', 'pass', 'None', 'True', 'False', 'in', 'is', 'not', 'or', 'and', 'if', 'else', 'for', 'while', 'try', 'except'];

  function pySafe(key) {
    var name = String(key).replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1');
    return PY_KEYWORDS.indexOf(name) >= 0 ? name + '_' : (name || 'field');
  }

  function emitSchema(type) {
    var schema = schemaFor(type);
    schema.$schema = 'http://json-schema.org/draft-07/schema#';
    return schema;
  }

  function schemaFor(type) {
    var node = {};
    switch (type.kind) {
      case 'object':
        node.type = 'object';
        node.properties = {};
        Object.keys(type.fields).forEach(function (key) { node.properties[key] = schemaFor(type.fields[key]); });
        if ((type.required || []).length) node.required = type.required.slice();
        break;
      case 'array':
        node.type = 'array';
        node.items = schemaFor(type.items);
        break;
      case 'any': break;
      case 'null': node.type = 'null'; break;
      default: node.type = type.kind;
    }
    if (type.nullable && node.type && node.type !== 'null') node.type = [node.type, 'null'];
    return node;
  }
})();
