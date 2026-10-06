/**
 * page-index.js —— 首页逻辑
 *
 * 首页要做的事：
 *   1. 显示数据概览（共多少条、寻物多少、招领多少、进行中多少）
 *   2. 类型切换（全部 / 寻物 / 招领）
 *   3. 组合筛选（分类 + 地点 + 状态）和排序
 *   4. 渲染卡片列表
 * 筛选条件统一保存在 state 对象里，任何一处改动都调用 refresh() 重新查询并渲染。
 */
(function () {
  'use strict';

  var UI = window.LFUI;
  var Store = window.LFStore;
  var store = UI.store;

  // 当前筛选条件
  var state = { type: '', category: '', place: '', status: '', sort: 'new' };

  var listEl, summaryEl, statsEl;

  /** 从 store 查询数据并刷新界面 */
  function refresh() {
    var items = store.query({
      type: state.type,
      category: state.category,
      place: state.place,
      status: state.status,
      sort: state.sort
    });

    UI.renderCards(listEl, items, '', {
      icon: '🔍',
      title: '没有符合条件的信息',
      text: '换个分类或地点试试，也可以点下面的按钮重置筛选条件',
      actionHtml: '<button class="btn btn-primary btn-sm" onclick="document.getElementById(\'reset-filter\').click()">重置筛选</button>'
    });

    summaryEl.innerHTML = '共找到 <b>' + items.length + '</b> 条信息' +
      (state.type ? '（' + (state.type === 'lost' ? '寻物' : '招领') + '）' : '');

    renderStats();
    renderTypeCounts();
  }

  /** 顶部数据概览 */
  function renderStats() {
    var all = store.stats();
    var lost = store.stats({ type: 'lost' });
    var found = store.stats({ type: 'found' });
    statsEl.innerHTML =
      statCard(all.total, '信息总数', '') +
      statCard(lost.total, '寻物信息', 'blue') +
      statCard(found.total, '招领信息', '') +
      statCard(all.open, '进行中', '');
  }

  function statCard(num, label, cls) {
    return '<div class="stat ' + cls + '">' +
      '<div class="num">' + num + '</div>' +
      '<div class="label">' + label + '</div>' +
    '</div>';
  }

  /** 在"全部/寻物/招领"三个标签上显示各自数量 */
  function renderTypeCounts() {
    var all = store.stats();
    var lost = store.stats({ type: 'lost' });
    var found = store.stats({ type: 'found' });
    setText('count-all', all.total ? '（' + all.total + '）' : '');
    setText('count-lost', lost.total ? '（' + lost.total + '）' : '');
    setText('count-found', found.total ? '（' + found.total + '）' : '');
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /** 生成分类筛选按钮 */
  function renderCategoryChips() {
    var box = document.getElementById('cat-chips');
    var html = '<button class="chip on" data-cat="">全部分类</button>';
    Store.CATEGORIES.forEach(function (c) {
      html += '<button class="chip" data-cat="' + c.id + '">' + c.emoji + ' ' + c.name + '</button>';
    });
    box.innerHTML = html;
  }

  /** 生成地点下拉框 */
  function renderPlaceOptions() {
    var sel = document.getElementById('place-select');
    Store.PLACES.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      sel.appendChild(opt);
    });
  }

  /* ---------------- 事件绑定 ---------------- */

  function bindEvents() {
    // 顶部搜索框：回车或点按钮都跳到搜索页
    document.getElementById('hero-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var kw = document.getElementById('hero-input').value.trim();
      location.href = 'search.html' + window.LFUtils.buildQuery({ q: kw });
    });

    // 类型切换
    document.getElementById('type-tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-type]');
      if (!btn) return;
      state.type = btn.getAttribute('data-type');
      this.querySelectorAll('button').forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      refresh();
    });

    // 分类筛选
    document.getElementById('cat-chips').addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');
      if (!btn) return;
      state.category = btn.getAttribute('data-cat');
      this.querySelectorAll('.chip').forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      refresh();
    });

    // 地点 / 状态 / 排序
    document.getElementById('place-select').addEventListener('change', function () {
      state.place = this.value; refresh();
    });
    document.getElementById('status-select').addEventListener('change', function () {
      state.status = this.value; refresh();
    });
    document.getElementById('sort-select').addEventListener('change', function () {
      state.sort = this.value; refresh();
    });

    // 重置筛选
    document.getElementById('reset-filter').addEventListener('click', function () {
      state = { type: '', category: '', place: '', status: '', sort: 'new' };
      document.querySelectorAll('#type-tabs button').forEach(function (b, i) {
        b.classList.toggle('on', i === 0);
      });
      document.querySelector('#cat-chips .chip').classList.add('on');
      document.querySelectorAll('#cat-chips .chip').forEach(function (b, i) {
        if (i > 0) b.classList.remove('on');
      });
      document.getElementById('place-select').value = '';
      document.getElementById('status-select').value = '';
      document.getElementById('sort-select').value = 'new';
      refresh();
    });
  }

  /* ---------------- 启动 ---------------- */

  document.addEventListener('DOMContentLoaded', function () {
    UI.initPage('home');

    listEl = document.getElementById('card-list');
    summaryEl = document.getElementById('list-summary');
    statsEl = document.getElementById('stats');

    renderCategoryChips();
    renderPlaceOptions();
    bindEvents();
    refresh();
  });
})();
