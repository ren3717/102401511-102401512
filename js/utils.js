/**
 * utils.js —— 通用工具函数
 *
 * 设计说明：
 * 本文件只放"纯函数"（给定相同输入必得相同输出，不依赖页面 DOM），
 * 因此它们可以被 tests/utils.test.js 直接调用测试。
 * 依赖 DOM 的函数（复制、图片压缩）单独放在文件末尾并做了容错处理。
 *
 * 同时兼容浏览器（window.LFUtils）与 Node（module.exports），
 * 这样单元测试既能在浏览器里跑，也能用 Node 跑。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();          // Node 环境
  } else {
    root.LFUtils = factory();            // 浏览器环境
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MINUTE = 60 * 1000;
  var HOUR = 60 * MINUTE;
  var DAY = 24 * HOUR;

  /**
   * 生成唯一 ID，例如 item_m1k2j3a_4f7ax9
   *
   * 唯一性由三部分共同保证：
   *   1. 时间戳（36 进制）
   *   2. 自增序号 —— 保证"同一毫秒内连续生成多个 ID"也不会重复
   *   3. 6 位随机串 —— 保证"不同时间/不同页面"打开的 ID 也不会撞车
   * 为什么不用 Date.now() + 4 位随机数？
   * 单元测试一次生成 1000 个 ID 时发现会碰撞（生日悖论：36^4 只有 168 万种组合），
   * 加上自增序号和更长的随机串后，该用例稳定通过。
   */
  var idSeq = 0;
  function genId(prefix) {
    idSeq = (idSeq + 1) % 46656;                 // 36^3，循环使用不影响唯一性
    var t = Date.now().toString(36);
    var s = idSeq.toString(36);
    var r = Math.random().toString(36).slice(2, 8);
    return (prefix || 'lf') + '_' + t + s + '_' + r;
  }

  /** 补零：8 -> "08" */
  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  /** 把时间戳格式化成 今天 10:30 / 昨天 18:20 / 10-06 16:00 / 2025-12-31 09:00 */
  function formatTime(ts, now) {
    if (!ts && ts !== 0) return '';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    var base = new Date(now === undefined ? Date.now() : now);
    var hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    var sameYear = d.getFullYear() === base.getFullYear();

    if (!sameYear) {
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + hm;
    }
    // 按“自然日”比较，避免用毫秒差计算导致跨天判断错误
    var dayDiff = dayIndex(base) - dayIndex(d);
    if (dayDiff === 0) return '今天 ' + hm;
    if (dayDiff === 1) return '昨天 ' + hm;
    return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + hm;
  }

  /** 把日期归到"第几天"（以本地时区零点为界） */
  function dayIndex(d) {
    return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / DAY);
  }

  /** 相对时间：刚刚 / 5分钟前 / 3小时前 / 2天前 / 具体日期 */
  function timeAgo(ts, now) {
    var base = now === undefined ? Date.now() : now;
    var diff = base - ts;
    if (diff < 0) return '刚刚';
    if (diff < MINUTE) return '刚刚';
    if (diff < HOUR) return Math.floor(diff / MINUTE) + '分钟前';
    if (diff < DAY) return Math.floor(diff / HOUR) + '小时前';
    if (diff < 7 * DAY) return Math.floor(diff / DAY) + '天前';
    return formatTime(ts, now);
  }

  /**
   * HTML 转义。作用：防止用户输入的 <script> 等被当成标签执行（XSS）。
   * 所有"用户填写的内容"渲染进页面前都必须先过这个函数。
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** 截断过长文字，超出部分用省略号代替 */
  function truncate(str, max) {
    if (!str) return '';
    var s = String(str);
    var limit = max || 40;
    return s.length > limit ? s.slice(0, limit) + '…' : s;
  }

  /** 去掉首尾空格，并把连续空白压缩成一个空格 */
  function normalize(str) {
    if (!str) return '';
    return String(str).replace(/\s+/g, ' ').trim();
  }

  /** 关键词高亮：返回一段 HTML，命中的部分包在 <mark> 里（已做转义） */
  function highlight(text, keyword) {
    var safe = escapeHtml(text);
    var kw = normalize(keyword);
    if (!kw) return safe;
    var safeKw = escapeHtml(kw);
    // 用 replace 的字符串模式做全局替换时需转义正则元字符，这里用 split/join 更安全
    return safe.split(safeKw).join('<mark class="hl">' + safeKw + '</mark>');
  }

  /**
   * 校验联系方式。
   * 规则放宽：手机号 / 微信号（写作 wx: xxx）/ QQ / 邮箱都允许，
   * 只要求 5~30 个字符，且只能包含常见字符（字母数字和 _ - @ . + * : 空格）。
   * 特意不允许中文和 < > & " ' 等符号，既符合真实使用，也避免把危险字符存进页面。
   */
  function isValidContact(str) {
    var s = normalize(str);
    if (s.length < 5 || s.length > 30) return false;
    return /^[0-9a-zA-Z_\-@.+*: ]+$/.test(s);
  }

  /** 校验物品名称：2~30 个字符 */
  function isValidTitle(str) {
    var s = normalize(str);
    return s.length >= 2 && s.length <= 30;
  }

  /** 解析 URL 查询串：'?id=abc&q=卡' -> {id:'abc', q:'卡'} */
  function parseQuery(search) {
    var qs = (search || '').replace(/^\?/, '');
    var out = {};
    if (!qs) return out;
    qs.split('&').forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf('=');
      var k = i < 0 ? pair : pair.slice(0, i);
      var v = i < 0 ? '' : pair.slice(i + 1);
      try {
        out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
      } catch (e) {
        out[k] = v;   // 解码失败时用原始值兜底
      }
    });
    return out;
  }

  /** 拼接查询串：{id:'a', q:'卡'} -> '?id=a&q=%E5%8D%A1' */
  function buildQuery(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  /** 防抖：连续触发时只执行最后一次（搜索框输入用） */
  function debounce(fn, delay) {
    var timer = null;
    return function () {
      var self = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, delay || 300);
    };
  }

  /** 生成"用于展示的日期字符串"：2026-10-06 */
  function formatDate(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /** 把 <input type="datetime-local"> 的值转成时间戳；非法值返回 NaN */
  function parseDateTimeLocal(value) {
    if (!value) return NaN;
    var t = new Date(value).getTime();
    return isNaN(t) ? NaN : t;
  }

  /* ------------------------------------------------------------------
   * 以下函数依赖浏览器 API（DOM / Clipboard / Canvas），不参与单元测试
   * ------------------------------------------------------------------ */

  /** 复制文本到剪贴板：优先用 Clipboard API，失败时回退到 execCommand */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () {
        return true;
      }).catch(function () {
        return fallbackCopy(text);
      });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  /**
   * 图片压缩：把用户选的图片用 canvas 缩小到最长边 maxSize，
   * 再以 JPEG 格式导出 dataURL。这样一张几 MB 的照片会变成几十 KB，
   * 才能存进容量有限的 localStorage。
   */
  function compressImage(file, maxSize, quality) {
    var limit = maxSize || 900;
    var q = quality || 0.72;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('不是有效的图片文件'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('读取文件失败')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('图片解析失败')); };
        img.onload = function () {
          var w = img.width;
          var h = img.height;
          var scale = Math.min(1, limit / Math.max(w, h));
          var cw = Math.round(w * scale);
          var ch = Math.round(h * scale);
          var canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, cw, ch);
          try {
            resolve(canvas.toDataURL('image/jpeg', q));
          } catch (e) {
            reject(new Error('图片压缩失败'));
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  return {
    // 常量
    MINUTE: MINUTE, HOUR: HOUR, DAY: DAY,
    // 纯函数（可测试）
    genId: genId,
    pad2: pad2,
    formatTime: formatTime,
    timeAgo: timeAgo,
    formatDate: formatDate,
    escapeHtml: escapeHtml,
    truncate: truncate,
    normalize: normalize,
    highlight: highlight,
    isValidContact: isValidContact,
    isValidTitle: isValidTitle,
    parseQuery: parseQuery,
    buildQuery: buildQuery,
    debounce: debounce,
    parseDateTimeLocal: parseDateTimeLocal,
    // 依赖浏览器的函数
    copyText: copyText,
    compressImage: compressImage
  };
});
