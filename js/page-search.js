/**
 * page-search.js —— 搜索页逻辑
 *
 * 功能：
 *   1. 关键词搜索（匹配物品名称 / 描述 / 地点 / 分类名），命中的文字高亮显示
 *   2. 类型、分类、地点、排序的组合筛选
 *   3. 热门搜索词快捷点击
 *   4. 搜索历史（保存在 localStorage，最多 6 条，可清空）
 *   5. 无结果时给出友好提示
 */
(function () {
  'use strict';

  var UI = window.LFUI;
  var Utils = window.LFUtils;
  var Store = window.LFStore;
  var store = UI.store;

  var HISTORY_KEY = 'campus-lostfound-history-v1';
  var HOT_WORDS = ['校园卡', '雨伞', '耳机', '钥匙', '水杯', '充电宝', '眼镜', '耳机'];

  var state = { keyword: '', type: '', category: '', place: '', sort: 'new' };

  var resultEl, summaryEl;

  /* ---------------- 搜索历史 ---------------- */

  function readHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function pushHistory(keyword) {
    var kw = Utils.normalize(keyword);
    if (!kw) return;
    var list = readHistory().filter(function (k) { return k !== kw; });
    list.unshift(kw);
    list = list.slice(0, 6);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch (e) { /* 存储满时忽略 */ }
    renderHistory();
  }

  function clearHistory() {
    try { localStorage.removeItem(HISTORY_KEY); } catch (e) { /* ignore */ }
    renderHistory();
  }

  function renderHistory() {
    var list = readHistory();
    var row = document.getElementById('history-row');
    var box = document.getElementById('history-chips');
    if (!list.length) {
      row.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    row.style.display = '';
    box.innerHTML = list.map(function (k) {
      return '<button class="chip" data-kw="' + Utils.escapeHtml(k) + '">' + Utils.escapeHtml(k) + '</button>';
    }).join('');
  }

  /* ---------------- 搜索与渲染 ---------------- */

  function doSearch() {
    var res = store.search(state.keyword, {
      type: state.type,
      category: state.category,
      place: state.place,
      sort: state.sort
    });

    UI.renderCards(resultEl, res.items, state.keyword, {
      icon: state.keyword ? '🔍' : '📭',
      title: state.keyword ? '没有找到「' + state.keyword + '」相关的信息' : '还没有信息',
      text: state.keyword
        ? '试试更换关键词，或者放宽筛选条件；也可以点右上角"发布信息"发布一条'
        : '当前没有任何信息，快去发布第一条吧',
      actionHtml: state.keyword
        ? '<button class="btn btn-primary btn-sm" onclick="document.getElementById(\'reset-btn\').click()">重置全部条件</button>'
        : '<a class="btn btn-primary btn-sm" href="publish.html">去发布信息</a>'
    });

    var kw = state.keyword;
    summaryEl.innerHTML = kw
      ? '关键词「<b>' + Utils.escapeHtml(kw) + '</b>」共找到 <b>' + res.count + '</b> 条信息'
      : '共 <b>' + res.count + '</b> 条信息（未输入关键词，显示全部）';

    // 搜索结束后把关键词写进历史
    if (kw) pushHistory(kw);
  }

  /* ---------------- 初始化 ---------------- */

  function renderHotWords() {
    var box = document.getElementById('hot-chips');
    // 去重后渲染
    var seen = {};
    var words = HOT_WORDS.filter(function (w) {
      if (seen[w]) return false;
      seen[w] = 1;
      return true;
    });
    box.innerHTML = words.map(function (w) {
      return '<button class="chip" data-kw="' + w + '">' + w + '</button>';
    }).join('');
  }

  function renderCategoryChips() {
    var box = document.getElementById('cat-chips');
    var html = '<button class="chip on" data-cat="">全部分类</button>';
    Store.CATEGORIES.forEach(function (c) {
      html += '<button class="chip" data-cat="' + c.id + '">' + c.emoji + ' ' + c.name + '</button>';
    });
    box.innerHTML = html;
  }

  function renderPlaceOptions() {
    var sel = document.getElementById('place-select');
    Store.PLACES.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      sel.appendChild(opt);
    });
  }

  function bindEvents() {
    document.getElementById('search-form').addEventListener('submit', function (e) {
      e.preventDefault();
      state.keyword = document.getElementById('keyword').value.trim();
      doSearch();
    });

    // 输入框实时搜索（防抖 350ms，避免每敲一个字都重排列表）
    var onInput = Utils.debounce(function () {
      state.keyword = document.getElementById('keyword').value.trim();
      doSearch();
    }, 350);
    document.getElementById('keyword').addEventListener('input', onInput);

    // 热门词 / 历史词：点击后填入搜索框并搜索
    document.getElementById('hot-chips').addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');
      if (!btn) return;
      applyKeyword(btn.getAttribute('data-kw'));
    });
    document.getElementById('history-chips').addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');
      if (!btn) return;
      applyKeyword(btn.getAttribute('data-kw'));
    });
    document.getElementById('clear-history').addEventListener('click', clearHistory);

    // 类型 / 分类筛选
    document.getElementById('type-chips').addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');
      if (!btn) return;
      state.type = btn.getAttribute('data-type');
      this.querySelectorAll('.chip').forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      doSearch();
    });
    document.getElementById('cat-chips').addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');
      if (!btn) return;
      state.category = btn.getAttribute('data-cat');
      this.querySelectorAll('.chip').forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      doSearch();
    });

    // 地点 / 排序
    document.getElementById('place-select').addEventListener('change', function () {
      state.place = this.value; doSearch();
    });
    document.getElementById('sort-select').addEventListener('change', function () {
      state.sort = this.value; doSearch();
    });

    // 重置
    document.getElementById('reset-btn').addEventListener('click', function () {
      state = { keyword: '', type: '', category: '', place: '', sort: 'new' };
      document.getElementById('keyword').value = '';
      document.getElementById('place-select').value = '';
      document.getElementById('sort-select').value = 'new';
      document.querySelectorAll('#type-chips .chip').forEach(function (b, i) {
        b.classList.toggle('on', i === 0);
      });
      document.querySelectorAll('#cat-chips .chip').forEach(function (b, i) {
        b.classList.toggle('on', i === 0);
      });
      doSearch();
    });
  }

  function applyKeyword(kw) {
    document.getElementById('keyword').value = kw;
    state.keyword = kw;
    doSearch();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('DOMContentLoaded', function () {
    UI.initPage('search');

    resultEl = document.getElementById('result-list');
    summaryEl = document.getElementById('result-summary');

    renderHotWords();
    renderCategoryChips();
    renderPlaceOptions();
    renderHistory();
    bindEvents();

    // 从首页带过来的关键词：search.html?q=校园卡
    var q = Utils.parseQuery(location.search).q || '';
    if (q) {
      document.getElementById('keyword').value = q;
      state.keyword = q;
    }
    doSearch();
  });
})();
