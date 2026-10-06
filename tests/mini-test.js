/**
 * mini-test.js —— 一个极简的单元测试框架（约 120 行）
 *
 * 为什么自己写而不用 Jest / Mocha？
 *   Jest 需要 Node.js 环境，Mocha 需要 npm 安装依赖。作业要求"助教把文件下载到本地，
 *   用 Chrome 打开 html 就能看到预期结果"，如果引入 npm 依赖，助教就必须先装环境。
 *   所以我们自己写一个能在浏览器里直接运行的测试框架，零依赖、双击即用。
 *
 * 用法（和主流框架保持一致，便于以后迁移到 Jest）：
 *   describe('分组名', function () {
 *     it('用例说明', function () {
 *       expect(add(1, 2)).toBe(3);
 *     });
 *   });
 */
(function (root) {
  'use strict';

  var suites = [];       // 收集到的测试分组
  var current = null;    // 当前正在收集的分组

  function describe(name, fn) {
    current = { name: name, cases: [] };
    suites.push(current);
    fn();
    current = null;
  }

  function it(name, fn) {
    if (!current) {
      // 没有写在 describe 里的用例，临时建一个分组
      current = { name: '(未分组)', cases: [] };
      suites.push(current);
    }
    current.cases.push({ name: name, fn: fn });
  }

  /* ---------------- 断言 ---------------- */

  function stringify(v) {
    if (typeof v === 'string') return '"' + v + '"';
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (Array.isArray(v)) return '[' + v.map(stringify).join(', ') + ']';
    if (typeof v === 'object') {
      try { return JSON.stringify(v); } catch (e) { return String(v); }
    }
    return String(v);
  }

  function fail(message, actual, expected) {
    var err = new Error(message + '（实际得到 ' + stringify(actual) +
      (expected !== undefined ? '，期望 ' + stringify(expected) : '') + '）');
    err.isAssertion = true;
    err.actual = actual;
    err.expected = expected;
    throw err;
  }

  function expect(actual) {
    return {
      toBe: function (expected) {
        if (actual !== expected) fail('值不相等', actual, expected);
      },
      toEqual: function (expected) {
        var a = JSON.stringify(actual);
        var b = JSON.stringify(expected);
        if (a !== b) fail('对象不相等', actual, expected);
      },
      toBeTruthy: function () {
        if (!actual) fail('期望为真值', actual);
      },
      toBeFalsy: function () {
        if (actual) fail('期望为假值', actual);
      },
      toBeNull: function () {
        if (actual !== null) fail('期望为 null', actual);
      },
      toBeUndefined: function () {
        if (actual !== undefined) fail('期望为 undefined', actual);
      },
      toContain: function (item) {
        var ok = false;
        if (typeof actual === 'string') ok = actual.indexOf(item) > -1;
        else if (Array.isArray(actual)) ok = actual.indexOf(item) > -1;
        if (!ok) fail('不包含指定内容', actual, item);
      },
      toHaveLength: function (n) {
        if (!actual || actual.length !== n) fail('长度不符合预期', actual && actual.length, n);
      },
      toBeGreaterThan: function (n) {
        if (!(actual > n)) fail('不大于期望值', actual, n);
      },
      toBeLessThan: function (n) {
        if (!(actual < n)) fail('不小于期望值', actual, n);
      },
      toBeInstanceOf: function (ctor) {
        if (!(actual instanceof ctor)) fail('类型不符合预期', typeof actual, ctor.name);
      },
      toThrow: function (keyword) {
        var thrown = false;
        try { actual(); } catch (e) {
          thrown = true;
          if (keyword && String(e.message).indexOf(keyword) === -1) {
            fail('抛出的错误信息不含 "' + keyword + '"', e.message);
          }
        }
        if (!thrown) fail('期望函数抛出异常，但它正常返回了', '无异常');
      }
    };
  }

  /* ---------------- 执行与报告 ---------------- */

  /** 跑完所有用例，返回统计结果 */
  function run() {
    var results = { total: 0, passed: 0, failed: 0, error: 0, suites: [] };

    suites.forEach(function (suite) {
      var sr = { name: suite.name, cases: [] };
      suite.cases.forEach(function (c) {
        var start = Date.now();
        var r = { name: c.name, ms: 0, ok: true, message: '', assertion: false };
        try {
          c.fn();
        } catch (e) {
          r.ok = false;
          r.message = e && e.message ? e.message : String(e);
          r.assertion = !!(e && e.isAssertion);
        }
        r.ms = Date.now() - start;
        results.total++;
        if (r.ok) results.passed++;
        else if (r.assertion) results.failed++;
        else results.error++;
        sr.cases.push(r);
      });
      results.suites.push(sr);
    });

    return results;
  }

  /** 把结果渲染到页面上（test.html 调用） */
  function render(results, container) {
    var html = '';
    html += '<div class="summary ' + (results.failed + results.error === 0 ? 'summary-ok' : 'summary-bad') + '">';
    html += '<span class="big">' + results.passed + ' / ' + results.total + '</span> 个用例通过';
    if (results.failed) html += '<span class="bad"> · 断言失败 ' + results.failed + '</span>';
    if (results.error) html += '<span class="bad"> · 运行异常 ' + results.error + '</span>';
    html += '</div>';

    results.suites.forEach(function (suite) {
      html += '<div class="suite"><h3>' + suite.name + '</h3>';
      suite.cases.forEach(function (c) {
        html += '<div class="case ' + (c.ok ? 'ok' : 'bad') + '">' +
          '<span class="mark">' + (c.ok ? '✓' : '✗') + '</span>' +
          '<span class="cname">' + c.name + '</span>' +
          '<span class="cms">' + c.ms + 'ms</span>' +
          (c.ok ? '' : '<div class="cmsg">' + c.message + '</div>') +
          '</div>';
      });
      html += '</div>';
    });

    container.innerHTML = html;
  }

  root.MiniTest = {
    describe: describe,
    it: it,
    expect: expect,
    run: run,
    render: render,
    reset: function () { suites = []; }
  };
})(typeof self !== 'undefined' ? self : this);
