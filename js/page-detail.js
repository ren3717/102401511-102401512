/**
 * page-detail.js —— 信息详情页
 *
 * 页面职责：
 *   1. 按 URL 上的 ?id=xxx 读取一条信息，展示完整内容（图片、物品信息、发布者联系方式）
 *   2. 一键复制联系方式（附加特点）
 *   3. 如果这条信息是我发布的（isMine = true）：
 *        显示"标记为已找到 / 已归还"按钮 —— 这是作业要求的"更新状态"入口
 *        同时显示删除按钮
 *   4. 如果信息已结束，显示醒目提示，并说明"其他人看到的状态"
 *   5. 底部推荐同类物品
 */
(function () {
  'use strict';

  var UI = window.LFUI;
  var Utils = window.LFUtils;
  var Store = window.LFStore;
  var store = UI.store;

  var item = null;
  var root, gallery = [];

  /* ---------------- 渲染 ---------------- */

  function render() {
    if (!item) {
      root.innerHTML = UI.emptyHtml('🔍', '信息不存在或已被删除',
        '这条信息可能已经被发布者删除了，去首页看看其他信息吧',
        '<a class="btn btn-primary" href="index.html">返回首页</a>');
      return;
    }

    document.title = item.title + ' · 校园失物招领';

    root.innerHTML =
      '<div class="detail">' +
        // 左栏：图片
        '<div class="detail-media">' +
          '<div class="detail-pic" id="main-pic">' + picHtml(0) + '</div>' +
          (gallery.length > 1 ? '<div class="detail-thumbs" id="thumbs">' +
            gallery.map(function (src, i) {
              return '<img src="' + src + '" data-i="' + i + '" class="' + (i === 0 ? 'on' : '') + '" alt="图片' + (i + 1) + '">';
            }).join('') + '</div>' : '') +
        '</div>' +

        // 右栏：信息
        '<div class="detail-body">' +
          '<h1 class="detail-title">' + Utils.escapeHtml(item.title) + '</h1>' +
          '<div class="detail-tags">' +
            '<span class="tag ' + UI.typeClass(item) + '">' + UI.typeText(item) + '</span>' +
            '<span class="tag tag-cat">' + UI.categoryName(item.category) + '</span>' +
            '<span class="badge ' + (item.status === 'closed' ? 'badge-closed' : 'badge-open') + '">' +
              (item.status === 'closed' ? '✓ ' : '● ') + UI.statusText(item) + '</span>' +
          '</div>' +

          '<div class="info-list">' +
            infoRow('物品名称', Utils.escapeHtml(item.title)) +
            infoRow('类型', UI.typeText(item) + '（' + (item.type === 'lost' ? '丢失物品' : '捡到物品') + '）') +
            infoRow('分类', UI.categoryName(item.category)) +
            infoRow('地点', Utils.escapeHtml(item.place)) +
            infoRow('时间', Utils.formatTime(item.time) + '（' + Utils.formatDate(item.time) + '）') +
            (item.desc ? infoRow('描述', Utils.escapeHtml(item.desc), true) : '') +
            infoRow('发布时间', Utils.formatTime(item.createdAt) + '（' + Utils.timeAgo(item.createdAt) + '）') +
          '</div>' +

          // 发布者与联系方式
          '<div class="publisher">' +
            '<div class="ava">' + (item.isMine ? '🙋' : '👤') + '</div>' +
            '<div class="p-info">' +
              '<div class="p-name">' + (item.isMine ? '我发布的信息' : '发布者') + '</div>' +
              '<div class="p-contact" id="contact-text">' + Utils.escapeHtml(item.contact) + '</div>' +
            '</div>' +
            '<button class="btn btn-primary btn-sm" id="copy-btn" type="button">📋 复制联系方式</button>' +
          '</div>' +

          (item.status === 'closed' ? closedNotice() : '') +

          // 操作按钮
          '<div class="detail-actions">' +
            (item.isMine
              ? '<button class="btn ' + (item.status === 'closed' ? 'btn-ghost' : 'btn-primary') + '" id="toggle-status" type="button">' +
                  (item.status === 'closed'
                    ? '↩ 重新标记为进行中'
                    : '✓ 标记为' + (item.type === 'lost' ? '已找到' : '已归还')) +
                '</button>' +
                '<button class="btn btn-danger" id="delete-btn" type="button">删除这条信息</button>'
              : '') +
            '<a class="btn btn-ghost" href="search.html' + Utils.buildQuery({ q: item.title }) + '">搜索同类物品</a>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // 同类推荐
      '<section class="related">' +
        '<div class="section-title">同类物品推荐</div>' +
        '<div class="grid" id="related-list"></div>' +
      '</section>';

    bindEvents();
    renderRelated();
  }

  function picHtml(i) {
    if (gallery.length) return '<img src="' + gallery[i] + '" alt="物品照片">';
    return '<span>' + UI.categoryEmoji(item) + '</span>';
  }

  function infoRow(k, v, pre) {
    return '<div class="info-row"><span class="k">' + k + '</span>' +
      '<span class="v' + (pre ? ' pre' : '') + '">' + v + '</span></div>';
  }

  /** 已结束信息的提示条：说明"谁来改、在哪看" */
  function closedNotice() {
    var who = item.type === 'lost' ? '已找到' : '已归还';
    return '<div class="closed-notice">' +
      '<span>ℹ️</span>' +
      '<span>这条信息已被发布者标记为「' + who + '」，其他同学在首页、搜索页看到的状态同样是「' + who + '」，' +
      '请不要再重复联系，避免打扰。</span>' +
    '</div>';
  }

  /** 同类推荐：同分类、未结束、排除自己，最多 3 条 */
  function renderRelated() {
    var box = document.getElementById('related-list');
    if (!box) return;
    var list = store.query({ category: item.category, status: Store.STATUS.OPEN })
      .filter(function (it) { return it.id !== item.id; })
      .slice(0, 3);

    if (!list.length) {
      box.innerHTML = UI.emptyHtml('📦', '暂无同类物品', '换个分类看看，或者自己发布一条');
      return;
    }
    box.innerHTML = list.map(function (it) {
      return UI.cardHtml(it, '', { showStatus: false });
    }).join('');
  }

  /* ---------------- 交互 ---------------- */

  function bindEvents() {
    // 缩略图切换
    var thumbs = document.getElementById('thumbs');
    if (thumbs) {
      thumbs.addEventListener('click', function (e) {
        var img = e.target.closest('img[data-i]');
        if (!img) return;
        var i = Number(img.getAttribute('data-i'));
        document.getElementById('main-pic').innerHTML = picHtml(i);
        this.querySelectorAll('img').forEach(function (el) { el.classList.remove('on'); });
        img.classList.add('on');
      });
    }

    // 一键复制联系方式
    var copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        Utils.copyText(item.contact).then(function (ok) {
          if (ok) {
            UI.toast('已复制联系方式：' + item.contact, 'success');
            copyBtn.textContent = '✓ 已复制';
            setTimeout(function () { copyBtn.textContent = '📋 复制联系方式'; }, 1600);
          } else {
            UI.toast('复制失败，请手动选中复制', 'error');
          }
        });
      });
    }

    // 修改状态（仅自己发布的信息可见）
    var toggle = document.getElementById('toggle-status');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var closing = item.status !== 'closed';
        var nextStatus = closing ? Store.STATUS.CLOSED : Store.STATUS.OPEN;
        var label = item.type === 'lost' ? '已找到' : '已归还';

        var confirmText = closing
          ? '标记后，这条信息的状态会变成「' + label + '」，首页和搜索页都会同步显示，确定吗？'
          : '把这条信息重新标记为「进行中」？其他同学会重新看到它仍在寻找/等待认领。';

        UI.confirmDialog(closing ? '标记为' + label : '重新开放信息', confirmText, function () {
          var res = store.updateStatus(item.id, nextStatus);
          if (!res.ok) {
            UI.toast(res.message || '操作失败', 'error');
            return;
          }
          item = res.item;
          UI.toast(closing ? '已标记为' + label : '已重新标记为进行中', 'success');
          render();
        }, closing ? '确认标记' : '确认');
      });
    }

    // 删除
    var del = document.getElementById('delete-btn');
    if (del) {
      del.addEventListener('click', function () {
        UI.confirmDialog('删除信息', '删除后无法恢复，确定要删除这条信息吗？', function () {
          var res = store.remove(item.id);
          if (!res.ok) {
            UI.toast(res.message || '删除失败', 'error');
            return;
          }
          UI.toast('已删除', 'success');
          setTimeout(function () { location.href = 'mine.html'; }, 500);
        }, '确认删除');
      });
    }
  }

  /* ---------------- 启动 ---------------- */

  document.addEventListener('DOMContentLoaded', function () {
    UI.initPage('');

    root = document.getElementById('detail-root');
    var id = Utils.parseQuery(location.search).id;
    item = id ? store.getById(id) : null;
    gallery = (item && item.images) ? item.images : [];

    render();
  });
})();
