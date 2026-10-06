/**
 * utils.test.js —— 工具函数的单元测试
 *
 * 测试思路：
 *   工具函数是"纯函数"，最容易做白盒测试。对每个函数，
 *   我们既测"正常情况"（等价类中的有效值），也测"边界情况"和"异常输入"：
 *     - 边界：空字符串、刚好等于长度上限、刚好超过上限
 *     - 异常：null / undefined / 非法日期 / 带 HTML 标签的字符串
 *   这样设计的目的是：将来测试人员拿"空格、超长文本、<script> 标签"来刁难时，
 *   程序不会崩溃，也不会产生安全漏洞。
 */
(function () {
  'use strict';

  var U = window.LFUtils;
  var describe = MiniTest.describe;
  var it = MiniTest.it;
  var expect = MiniTest.expect;

  var HOUR = 60 * 60 * 1000;
  var DAY = 24 * HOUR;

  /* ============ genId ============ */
  describe('genId —— 生成唯一 ID', function () {
    it('生成的 ID 带指定前缀', function () {
      expect(U.genId('item').indexOf('item_')).toBe(0);
    });

    it('连续生成 1000 个 ID 互不重复（唯一性测试）', function () {
      var set = {};
      var dup = 0;
      for (var i = 0; i < 1000; i++) {
        var id = U.genId();
        if (set[id]) dup++;
        set[id] = 1;
      }
      expect(dup).toBe(0);
    });

    it('不传前缀时使用默认前缀 lf', function () {
      expect(U.genId().indexOf('lf_')).toBe(0);
    });
  });

  /* ============ pad2 ============ */
  describe('pad2 —— 数字补零', function () {
    it('个位数前面补 0', function () {
      expect(U.pad2(8)).toBe('08');
      expect(U.pad2(0)).toBe('00');
    });
    it('两位数保持原样', function () {
      expect(U.pad2(12)).toBe('12');
    });
  });

  /* ============ formatTime ============ */
  describe('formatTime —— 时间格式化', function () {
    var now = new Date(2026, 9, 6, 20, 0, 0).getTime();   // 2026-10-06 20:00

    it('当天的时间显示为「今天 HH:mm」', function () {
      var t = new Date(2026, 9, 6, 10, 30).getTime();
      expect(U.formatTime(t, now)).toBe('今天 10:30');
    });

    it('前一天显示为「昨天 HH:mm」', function () {
      var t = new Date(2026, 9, 5, 18, 20).getTime();
      expect(U.formatTime(t, now)).toBe('昨天 18:20');
    });

    it('更早的同年日期显示为「MM-DD HH:mm」', function () {
      var t = new Date(2026, 9, 1, 16, 5).getTime();
      expect(U.formatTime(t, now)).toBe('10-01 16:05');
    });

    it('跨年日期带上年份', function () {
      var t = new Date(2025, 11, 31, 9, 0).getTime();
      expect(U.formatTime(t, now)).toBe('2025-12-31 09:00');
    });

    it('午夜 00:00 与 23:59 也能正确补零', function () {
      expect(U.formatTime(new Date(2026, 9, 6, 0, 0).getTime(), now)).toBe('今天 00:00');
      expect(U.formatTime(new Date(2026, 9, 6, 23, 59).getTime(), now)).toBe('今天 23:59');
    });

    it('边界：跨天判断按自然日而不是 24 小时（凌晨 0:30 相对当天 23:30 应为今天）', function () {
      var base = new Date(2026, 9, 6, 23, 30).getTime();
      var t = new Date(2026, 9, 6, 0, 30).getTime();
      expect(U.formatTime(t, base)).toBe('今天 00:30');
    });

    it('异常输入返回空字符串而不是崩溃', function () {
      expect(U.formatTime(null)).toBe('');
      expect(U.formatTime(undefined)).toBe('');
      expect(U.formatTime('不是日期')).toBe('');
    });
  });

  /* ============ timeAgo ============ */
  describe('timeAgo —— 相对时间', function () {
    var now = new Date(2026, 9, 6, 12, 0, 0).getTime();

    it('30 秒内显示「刚刚」', function () {
      expect(U.timeAgo(now - 30 * 1000, now)).toBe('刚刚');
    });
    it('几分钟前', function () {
      expect(U.timeAgo(now - 5 * 60 * 1000, now)).toBe('5分钟前');
    });
    it('几小时前', function () {
      expect(U.timeAgo(now - 3 * HOUR, now)).toBe('3小时前');
    });
    it('几天前', function () {
      expect(U.timeAgo(now - 2 * DAY, now)).toBe('2天前');
    });
    it('超过 7 天显示具体时间', function () {
      var t = new Date(2026, 8, 20, 15, 0).getTime();
      expect(U.timeAgo(t, now)).toBe('09-20 15:00');
    });
    it('边界：未来时间当作「刚刚」处理，不显示负数', function () {
      expect(U.timeAgo(now + 10000, now)).toBe('刚刚');
    });
  });

  /* ============ escapeHtml ============ */
  describe('escapeHtml —— HTML 转义（防 XSS）', function () {
    it('转义尖括号，script 标签不会被执行', function () {
      expect(U.escapeHtml('<script>alert(1)</script>'))
        .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('转义引号', function () {
      expect(U.escapeHtml('a"b\'c')).toBe('a&quot;b&#39;c');
    });

    it('转义 & 符号', function () {
      expect(U.escapeHtml('A&B')).toBe('A&amp;B');
    });

    it('正常文本原样返回', function () {
      expect(U.escapeHtml('校园卡')).toBe('校园卡');
    });

    it('边界：null 与 undefined 返回空字符串', function () {
      expect(U.escapeHtml(null)).toBe('');
      expect(U.escapeHtml(undefined)).toBe('');
    });

    it('边界：数字类型也能处理', function () {
      expect(U.escapeHtml(123)).toBe('123');
    });
  });

  /* ============ truncate ============ */
  describe('truncate —— 文本截断', function () {
    it('超长文本被截断并加省略号', function () {
      expect(U.truncate('0123456789', 5)).toBe('01234…');
    });
    it('刚好等于上限时不截断', function () {
      expect(U.truncate('12345', 5)).toBe('12345');
    });
    it('边界：空字符串返回空', function () {
      expect(U.truncate('', 5)).toBe('');
      expect(U.truncate(null, 5)).toBe('');
    });
  });

  /* ============ normalize ============ */
  describe('normalize —— 文本规范化', function () {
    it('去掉首尾空格', function () {
      expect(U.normalize('  校园卡  ')).toBe('校园卡');
    });
    it('把连续空白（含换行制表符）压缩成一个空格', function () {
      expect(U.normalize('校园  卡\n\t丢失')).toBe('校园 卡 丢失');
    });
    it('边界：null 返回空字符串', function () {
      expect(U.normalize(null)).toBe('');
    });
  });

  /* ============ highlight ============ */
  describe('highlight —— 关键词高亮', function () {
    it('命中的关键词被 mark 标签包起来', function () {
      expect(U.highlight('校园卡', '校园')).toBe('<mark class="hl">校园</mark>卡');
    });
    it('没有关键词时原样返回', function () {
      expect(U.highlight('校园卡', '')).toBe('校园卡');
    });
    it('出现多次时全部高亮', function () {
      expect(U.highlight('卡卡', '卡')).toBe('<mark class="hl">卡</mark><mark class="hl">卡</mark>');
    });
    it('安全：关键词本身带 HTML 也被转义，不会注入', function () {
      var out = U.highlight('abc', '<b>');
      expect(out.indexOf('<b>')).toBe(-1);
    });
    it('安全：原文中的 HTML 被转义后再高亮', function () {
      var out = U.highlight('<script>x</script>', 'x');
      expect(out.indexOf('<script>')).toBe(-1);
      expect(out).toContain('<mark class="hl">x</mark>');
    });
  });

  /* ============ isValidContact ============ */
  describe('isValidContact —— 联系方式校验', function () {
    it('合法：11 位手机号', function () {
      expect(U.isValidContact('13800138000')).toBe(true);
    });
    it('合法：微信号 / QQ 号 / 邮箱（微信号允许写成 "wx: xxx"）', function () {
      expect(U.isValidContact('wx: my_id2024')).toBe(true);
      expect(U.isValidContact('qq: 445566778')).toBe(true);
      expect(U.isValidContact('my_id2024')).toBe(true);
      expect(U.isValidContact('abc@qq.com')).toBe(true);
    });
    it('非法：长度不足 5', function () {
      expect(U.isValidContact('1234')).toBe(false);
    });
    it('非法：超过 30 个字符', function () {
      expect(U.isValidContact(new Array(32).join('a'))).toBe(false);
    });
    it('非法：包含中文或特殊符号', function () {
      expect(U.isValidContact('我的手机号')).toBe(false);
      expect(U.isValidContact('138#0013')).toBe(false);
    });
    it('边界：空值与 null', function () {
      expect(U.isValidContact('')).toBe(false);
      expect(U.isValidContact(null)).toBe(false);
    });
  });

  /* ============ isValidTitle ============ */
  describe('isValidTitle —— 物品名称校验', function () {
    it('合法：2~30 字', function () {
      expect(U.isValidTitle('校园卡')).toBe(true);
      expect(U.isValidTitle('ab')).toBe(true);
    });
    it('非法：只有 1 个字', function () {
      expect(U.isValidTitle('伞')).toBe(false);
    });
    it('边界：刚好 30 字合法，31 字非法', function () {
      expect(U.isValidTitle(new Array(31).join('卡'))).toBe(true);
      expect(U.isValidTitle(new Array(32).join('卡'))).toBe(false);
    });
    it('非法：空白字符串（只有空格）', function () {
      expect(U.isValidTitle('   ')).toBe(false);
    });
  });

  /* ============ parseQuery ============ */
  describe('parseQuery —— 解析 URL 参数', function () {
    it('解析单个参数', function () {
      expect(U.parseQuery('?id=abc123').id).toBe('abc123');
    });
    it('解析多个参数', function () {
      var q = U.parseQuery('?id=abc&q=%E6%A0%A1%E5%9B%AD%E5%8D%A1');
      expect(q.id).toBe('abc');
      expect(q.q).toBe('校园卡');
    });
    it('中文被正确解码（这是首页跳搜索页时传关键词用的）', function () {
      expect(U.parseQuery('?q=' + encodeURIComponent('雨伞')).q).toBe('雨伞');
    });
    it('边界：没有参数返回空对象', function () {
      expect(U.parseQuery('')).toEqual({});
      expect(U.parseQuery('?')).toEqual({});
    });
    it('边界：只有键没有值', function () {
      expect(U.parseQuery('?flag').flag).toBe('');
    });
  });

  /* ============ buildQuery ============ */
  describe('buildQuery —— 拼接 URL 参数', function () {
    it('中文会被编码', function () {
      expect(U.buildQuery({ q: '校园卡' })).toBe('?q=%E6%A0%A1%E5%9B%AD%E5%8D%A1');
    });
    it('跳过空值和 null', function () {
      expect(U.buildQuery({ a: 1, b: '', c: null })).toBe('?a=1');
    });
    it('边界：全部为空时返回空字符串', function () {
      expect(U.buildQuery({})).toBe('');
      expect(U.buildQuery(null)).toBe('');
    });
    it('与 parseQuery 互为逆运算（往返测试）', function () {
      var kw = '校园卡 & 雨伞';
      expect(U.parseQuery(U.buildQuery({ q: kw })).q).toBe(kw);
    });
  });

  /* ============ parseDateTimeLocal ============ */
  describe('parseDateTimeLocal —— 表单时间解析', function () {
    it('合法时间字符串转成时间戳', function () {
      var t = U.parseDateTimeLocal('2026-10-06T10:30');
      expect(typeof t).toBe('number');
      expect(t).toBeGreaterThan(0);
    });
    it('边界：空值返回 NaN', function () {
      expect(isNaN(U.parseDateTimeLocal(''))).toBe(true);
      expect(isNaN(U.parseDateTimeLocal(null))).toBe(true);
    });
    it('边界：非法字符串返回 NaN', function () {
      expect(isNaN(U.parseDateTimeLocal('不是时间'))).toBe(true);
    });
  });

  /* ============ debounce ============ */
  describe('debounce —— 防抖', function () {
    it('返回值仍然是函数（可以继续调用）', function () {
      var fn = U.debounce(function () {}, 10);
      expect(typeof fn).toBe('function');
    });

    it('连续调用时同步阶段不会立即执行（保证搜索框不会每敲一个字就查一次）', function () {
      var count = 0;
      var fn = U.debounce(function () { count++; }, 20);
      fn(); fn(); fn();
      expect(count).toBe(0);
    });
  });
})();
