/**
 * page-mine.js —— "我的发布"页逻辑
 *
 * 这是"更新状态"流程的主入口：
 *   我的发布 → 找到自己发布的信息 → 点"标记为已找到 / 已归还" → 状态更新
 *   更新之后，首页、搜索页、详情页都会显示为已结束状态（因为读的是同一份数据）
 */
(function () {
  'use strict';

  var UI = window.LFUI;
  var Utils = window.LFUtils;
  var Store = window.LFStore;
  var store = UI.store;

  var state = { status: '' };
  var listEl, statsEl;

  /* ---------------- 渲染 ---------------- */

  function refresh() {
    renderStats();
    renderList();
  }

  function renderStats() {
    var s = store.stats({ mine: true });
    statsEl.innerHTML =
      '<div class="stat"><div class="num">' + s.total + '</div><div class="label">我发布的</div></div>' +
      '<div class="stat"><div class="num">' + s.open + '</div><div class="label">进行中</div></div>' +
      '<div class="stat"><div class="num">' + s.closed + '</div><div class="label">已结束</div></div>' +
      '<div class="stat blue"><div class="num">' + s.lost + '</div><div class="label">其中寻物</div></div>';
  }

  function renderList() {
    var items = store.query({ mine: true, status: state.status });

    if (!items.length) {
      listEl.innerHTML = UI.emptyHtml('📝',
        state.status === 'open' ? '没有进行中的信息' :
          state.status === 'closed' ? '还没有已结束的信息' : '你还没有发布过信息',
        state.status
          ? '切换上面的标签看看其他状态的信息'
          : '发布寻物或招领信息后，可以在这里管理它们的状态',
        '<a class="btn btn-primary" href="publish.html">＋ 发布第一条信息</a>');
      return;
    }

    listEl.innerHTML = items.map(function (it) {
      var isClosed = it.status === 'closed';
      var closeLabel = it.type === 'lost' ? '已找到' : '已归还';
      return '' +
        '<div class="list-item" data-id="' + it.id + '">' +
          UI.thumbHtml(it, 'card-thumb') +
          '<div class="li-main">' +
            '<div class="li-title">' + Utils.escapeHtml(it.title) + '</div>' +
            '<div class="card-tags" style="margin:4px 0 5px;">' +
              '<span class="tag ' + UI.typeClass(it) + '">' + UI.typeText(it) + '</span>' +
              '<span class="tag tag-cat">' + UI.categoryName(it.category) + '</span>' +
              '<span class="badge ' + (isClosed ? 'badge-closed' : 'badge-open') + '">' +
                (isClosed ? '✓ ' : '● ') + UI.statusText(it) + '</span>' +
            '</div>' +
            '<div class="li-meta">' +
              '<span>📍 ' + Utils.escapeHtml(it.place) + '</span>' +
              '<span>🕐 ' + Utils.formatTime(it.time) + '</span>' +
              '<span>发布 ' + Utils.timeAgo(it.createdAt) + '</span>' +
              (isClosed && it.closedAt ? '<span>结束于 ' + Utils.timeAgo(it.closedAt) + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="li-actions">' +
            '<a class="btn btn-sm btn-ghost" href="detail.html' + Utils.buildQuery({ id: it.id }) + '">查看详情</a>' +
            '<button class="btn btn-sm ' + (isClosed ? 'btn-ghost' : 'btn-primary') + '" data-act="toggle" data-id="' + it.id + '">' +
              (isClosed ? '↩ 改回进行中' : '✓ 标记为' + closeLabel) +
            '</button>' +
            '<button class="btn btn-sm btn-danger" data-act="delete" data-id="' + it.id + '">删除</button>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  /* ---------------- 事件 ---------------- */

  function bindEvents() {
    // 状态标签切换
    document.getElementById('status-tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-status]');
      if (!btn) return;
      state.status = btn.getAttribute('data-status');
      this.querySelectorAll('button').forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      renderList();
    });

    // 列表内的操作按钮（事件委托：只在容器上绑一次）
    listEl.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var act = btn.getAttribute('data-act');
      var item = store.getById(id);
      if (!item) { UI.toast('信息不存在', 'error'); return; }

      if (act === 'toggle') {
        var closing = item.status !== 'closed';
        var label = item.type === 'lost' ? '已找到' : '已归还';
        UI.confirmDialog(
          closing ? '标记为' + label : '改回进行中',
          closing
            ? '标记后，其他同学在首页、搜索页看到的状态都会变成「' + label + '」，确定吗？'
            : '重新标记为进行中后，这条信息会重新出现在首页的进行中列表里。',
          function () {
            var res = store.updateStatus(id, closing ? Store.STATUS.CLOSED : Store.STATUS.OPEN);
            if (!res.ok) { UI.toast(res.message || '操作失败', 'error'); return; }
            UI.toast(closing ? '已标记为' + label : '已改回进行中', 'success');
            refresh();
          },
          closing ? '确认标记' : '确认'
        );
        return;
      }

      if (act === 'delete') {
        UI.confirmDialog('删除信息', '删除后无法恢复，确定要删除「' + item.title + '」吗？', function () {
          var res = store.remove(id);
          if (!res.ok) { UI.toast(res.message || '删除失败', 'error'); return; }
          UI.toast('已删除', 'success');
          refresh();
        }, '确认删除');
      }
    });

    // 恢复演示数据（方便演示和测试）
    document.getElementById('restore-seed').addEventListener('click', function () {
      UI.confirmDialog('恢复演示数据',
        '这会把本机数据恢复成初始的演示数据，你自己发布的信息会被清空。确定继续吗？',
        function () {
          var res = store.replaceAll(window.LF_SEED.slice());
          if (!res.ok) { UI.toast('恢复失败', 'error'); return; }
          UI.toast('已恢复演示数据', 'success');
          refresh();
        }, '确认恢复');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    UI.initPage('mine');
    listEl = document.getElementById('mine-list');
    statsEl = document.getElementById('mine-stats');
    bindEvents();
    refresh();
  });
})();
