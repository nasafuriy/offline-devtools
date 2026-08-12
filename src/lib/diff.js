/* ============================================================
   Line diff — Myers O(ND) greedy algorithm with a backtrace.
   Falls back to a plain replace-block for pathological inputs so
   the UI can never hang on a huge paste.
   ============================================================ */
(function () {
  'use strict';

  var MAX_WORK = 4000;   // give up past this edit distance

  /**
   * @param {string[]} a  original lines
   * @param {string[]} b  changed lines
   * @returns {{ops: Array<{type:'eq'|'add'|'del', text:string, a:number, b:number}>, truncated:boolean}}
   */
  function diffLines(a, b) {
    // Trim the common prefix and suffix — most edits touch a small window.
    var head = 0;
    while (head < a.length && head < b.length && a[head] === b[head]) head++;

    var tail = 0;
    while (tail < a.length - head && tail < b.length - head &&
           a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;

    var midA = a.slice(head, a.length - tail);
    var midB = b.slice(head, b.length - tail);

    var mid, truncated = false;
    if (midA.length + midB.length > MAX_WORK * 2) {
      truncated = true;
      mid = midA.map(function (line) { return { type: 'del', text: line }; })
        .concat(midB.map(function (line) { return { type: 'add', text: line }; }));
    } else {
      mid = myers(midA, midB);
      if (!mid) {
        truncated = true;
        mid = midA.map(function (line) { return { type: 'del', text: line }; })
          .concat(midB.map(function (line) { return { type: 'add', text: line }; }));
      }
    }

    var ops = [];
    for (var i = 0; i < head; i++) ops.push({ type: 'eq', text: a[i] });
    ops = ops.concat(mid);
    for (var j = a.length - tail; j < a.length; j++) ops.push({ type: 'eq', text: a[j] });

    // Number the lines as they appear in each side.
    var an = 0, bn = 0;
    ops.forEach(function (op) {
      if (op.type !== 'add') op.a = ++an;
      if (op.type !== 'del') op.b = ++bn;
    });

    return { ops: ops, truncated: truncated };
  }

  function myers(a, b) {
    var N = a.length, M = b.length, MAX = N + M;
    if (MAX === 0) return [];

    var offset = MAX;
    var v = new Int32Array(2 * MAX + 1);
    var trace = [];

    for (var d = 0; d <= MAX; d++) {
      if (d > MAX_WORK) return null;
      trace.push(v.slice());

      for (var k = -d; k <= d; k += 2) {
        var x;
        if (k === -d || (k !== d && v[k - 1 + offset] < v[k + 1 + offset])) x = v[k + 1 + offset];
        else x = v[k - 1 + offset] + 1;

        var y = x - k;
        while (x < N && y < M && a[x] === b[y]) { x++; y++; }
        v[k + offset] = x;

        if (x >= N && y >= M) return backtrack(trace, a, b, d, offset);
      }
    }
    return null;
  }

  function backtrack(trace, a, b, d, offset) {
    var x = a.length, y = b.length;
    var ops = [];

    for (var dd = d; dd > 0; dd--) {
      var v = trace[dd];
      var k = x - y;
      var prevK = (k === -dd || (k !== dd && v[k - 1 + offset] < v[k + 1 + offset])) ? k + 1 : k - 1;
      var prevX = v[prevK + offset];
      var prevY = prevX - prevK;

      while (x > prevX && y > prevY) { ops.push({ type: 'eq', text: a[x - 1] }); x--; y--; }

      if (x === prevX) { ops.push({ type: 'add', text: b[y - 1] }); y--; }
      else             { ops.push({ type: 'del', text: a[x - 1] }); x--; }
    }

    while (x > 0 && y > 0) { ops.push({ type: 'eq', text: a[x - 1] }); x--; y--; }

    return ops.reverse();
  }

  /** Character-level diff of two short strings, for inline highlighting. */
  function diffChars(a, b) {
    var res = diffLines(a.split(''), b.split(''));
    return res.ops;
  }

  window.DevBox = window.DevBox || {};
  window.DevBox.diff = { lines: diffLines, chars: diffChars };
})();
