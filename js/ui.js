/**
 * ui.js —— 公共界面组件
 *
 * 各个页面（首页、搜索、发布、详情、我的发布）都要用到的东西集中放在这里，
 * 避免每个 HTML 里重复写一遍导航栏、页脚、卡片结构：
 *   - 顶部导航栏 / 页脚（由 JS 注入）
 *   - 信息卡片的 HTML 生成
 *   - 轻提示 toast、确认弹窗 confirmDialog
 *   - 页面启动时初始化数据（首次进入灌入演示数据）
 */
(function (root) {
  'use strict';

  var Utils = root.LFUtils;
  var StoreApi = root.LFStore;

  /** 全局唯一的 store 实例，绑定浏览器 localStorage */
  var store = StoreApi.create(window.localStorage);

  var SITE = {
    name: '校园失物招领',
    authors: '何锦宏（102401511）、任奥辉（102401512）'
  };

  var NAV_ITEMS = [
    { key: 'home',    text: '首页',    href: 'index.html' },
    { key: 'search',  text: '搜索',    href: 'search.html' },
    { key: 'mine',    text: '我的发布', href: 'mine.html' }
  ];

  /* ---------------- 导航栏与页脚 ---------------- */

  function renderNavbar(active) {
    var holder = document.getElementById('app-header');
    if (!holder) return;
    var links = NAV_ITEMS.map(function (it) {
      return '<a href="' + it.href + '"' + (it.key === active ? ' class="active"' : '') + '>' + it.text + '</a>';
    }).join('');

    holder.innerHTML =
      '<nav class="navbar">' +
        '<div class="wrap">' +
          '<a class="brand" href="index.html">' +
            '<span class="logo">🔍</span><span class="name">' + SITE.name + '</span>' +
          '</a>' +
          '<div class="nav-links">' + links + '</div>' +
          '<div class="nav-right">' +
            '<a class="btn btn-primary" href="publish.html">＋ <span class="txt">发布信息</span></a>' +
          '</div>' +
        '</div>' +
      '</nav>';
  }

  function renderFooter() {
    var holder = document.getElementById('app-footer');
    if (!holder) return;
    holder.innerHTML =
      '<footer class="footer">' +
        '<div class="wrap">' +
          '<div>' + SITE.name + ' · 2026 秋软件工程第二次结对作业</div>' +
          '<div>结对成员：<b>' + SITE.authors + '</b></div>' +
          '<div style="margin-top:6px;font-size:12px;">数据保存在本机浏览器中（localStorage），不上传服务器</div>' +
        '</div>' +
      '</footer>';
  }

  /* ---------------- 信息卡片 ---------------- */

  /** 类型文字：lost -> 寻物，found -> 招领 */
  function typeText(item) { return item.type === 'lost' ? '寻物' : '招领'; }
  function typeClass(item) { return item.type === 'lost' ? 'tag-lost' : 'tag-found'; }

  /**
   * 状态文字：寻物显示"已找到"，招领显示"已归还"，进行中统一显示"进行中"。
   * 这是作业要求里"由发布者标记为已找到/已归还"的落地方式。
   */
  function statusText(item) {
    if (item.status !== 'closed') return '进行中';
    return item.type === 'lost' ? '已找到' : '已归还';
  }

  function categoryName(id) {
    var c = StoreApi.getCategory(id);
    return c ? c.name : '其他';
  }

  function categoryEmoji(item) {
    var c = StoreApi.getCategory(item.category);
    return c ? c.emoji : '📦';
  }

  /** 缩略图：有图片用图片，没有就用分类 emoji 占位 */
  function thumbHtml(item, cls) {
    if (item.images && item.images.length) {
      return '<div class="' + cls + '"><img src="' + item.images[0] + '" alt="物品图片"></div>';
    }
    return '<div class="' + cls + '">' + categoryEmoji(item) + '</div>';
  }

  /**
   * 生成一张信息卡片的 HTML。
   * @param {Object} item    信息对象
   * @param {String} keyword 搜索关键词（用于高亮），可省略
   * @param {Object} opt     {showStatus:true 显示状态徽章}
   */
  function cardHtml(item, keyword, opt) {
    var o = opt || {};
    var statusBadge = (o.showStatus === false) ? '' :
      '<span class="badge ' + (item.status === 'closed' ? 'badge-closed' : 'badge-open') + '">' +
        (item.status === 'closed' ? '✓ ' : '● ') + statusText(item) + '</span>';

    return '' +
      '<article class="card" data-id="' + item.id + '">' +
        '<div class="card-top">' +
          thumbHtml(item, 'card-thumb') +
          '<div class="card-main">' +
            '<h3 class="card-title">' + Utils.highlight(item.title, keyword) + '</h3>' +
            '<div class="card-tags">' +
              '<span class="tag ' + typeClass(item) + '">' + typeText(item) + '</span>' +
              '<span class="tag tag-cat">' + categoryName(item.category) + '</span>' +
              statusBadge +
            '</div>' +
            '<div class="card-meta">' +
              '<span>📍 ' + Utils.highlight(item.place, keyword) + '</span>' +
              '<span>🕐 ' + Utils.formatTime(item.time) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        (item.desc ? '<p class="card-desc">' + Utils.highlight(item.desc, keyword) + '</p>' : '') +
        '<div class="card-foot">' +
          '<span class="card-time">发布于 ' + Utils.timeAgo(item.createdAt) + '</span>' +
          '<div class="card-actions">' +
            '<a class="btn btn-sm btn-ghost" href="detail.html' + Utils.buildQuery({ id: item.id }) + '">查看详情</a>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  /** 把卡片列表渲染到容器里；列表为空时显示空状态 */
  function renderCards(container, items, keyword, emptyOpt) {
    if (!container) return;
    if (!items.length) {
      var e = emptyOpt || {};
      container.innerHTML = emptyHtml(e.icon, e.title, e.text, e.actionHtml);
      return;
    }
    container.innerHTML = items.map(function (it) { return cardHtml(it, keyword); }).join('');
  }

  function emptyHtml(icon, title, text, actionHtml) {
    return '' +
      '<div class="empty">' +
        '<div class="icon">' + (icon || '📭') + '</div>' +
        '<h3>' + (title || '暂无信息') + '</h3>' +
        '<p>' + (text || '') + '</p>' +
        (actionHtml || '') +
      '</div>';
  }

  /* ---------------- 轻提示 ---------------- */

  function ensureToastBox() {
    var box = document.getElementById('toast-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toast-box';
      document.body.appendChild(box);
    }
    return box;
  }

  /** 屏幕底部弹出一条提示，1.8 秒后自动消失 */
  function toast(message, type) {
    var box = ensureToastBox();
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = message;
    box.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, 1800);
  }

  /* ---------------- 确认弹窗 ---------------- */

  /** 自己实现的确认框，比 window.confirm 更符合页面风格 */
  function confirmDialog(title, message, onOk, okText) {
    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML =
      '<div class="modal">' +
        '<h3>' + Utils.escapeHtml(title) + '</h3>' +
        '<p>' + Utils.escapeHtml(message) + '</p>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-ghost" data-act="cancel">取消</button>' +
          '<button class="btn btn-primary" data-act="ok">' + Utils.escapeHtml(okText || '确定') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(mask);

    function close() { if (mask.parentNode) mask.parentNode.removeChild(mask); }

    mask.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'ok') { close(); if (onOk) onOk(); }
      else if (act === 'cancel' || e.target === mask) { close(); }
    });
  }

  /* ---------------- 页面启动 ---------------- */

  /**
   * 每个页面在 DOM 就绪后调用一次。
   * 作用：注入导航栏和页脚；如果本地还没有任何数据，就灌入演示数据。
   */
  function initPage(activeNav) {
    renderNavbar(activeNav);
    renderFooter();

    // 首次打开（本地为空）时灌入演示数据，让页面有内容可浏览
    if (store.isEmpty() && root.LF_SEED && root.LF_SEED.length) {
      store.replaceAll(root.LF_SEED.slice());
    }
  }

  root.LFUI = {
    store: store,
    SITE: SITE,
    initPage: initPage,
    renderNavbar: renderNavbar,
    renderFooter: renderFooter,
    cardHtml: cardHtml,
    renderCards: renderCards,
    emptyHtml: emptyHtml,
    toast: toast,
    confirmDialog: confirmDialog,
    typeText: typeText,
    typeClass: typeClass,
    statusText: statusText,
    categoryName: categoryName,
    categoryEmoji: categoryEmoji,
    thumbHtml: thumbHtml
  };
})(typeof self !== 'undefined' ? self : this);
