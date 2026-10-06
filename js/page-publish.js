/**
 * page-publish.js —— 发布页逻辑
 *
 * 关键点：
 *   1. 表单校验由 store.validate() 统一负责（和单元测试用的是同一份规则）
 *   2. 图片先在本地压缩再存进 localStorage，否则一张手机照片就能把存储撑爆
 *   3. 发布成功后跳转到 success.html?id=xxx
 */
(function () {
  'use strict';

  var UI = window.LFUI;
  var Utils = window.LFUtils;
  var Store = window.LFStore;
  var store = UI.store;

  var form;
  var images = [];        // 已上传的图片（dataURL 数组），最多 3 张
  var MAX_IMAGES = 3;
  var state = { type: 'found', category: '' };

  /* ---------------- 错误提示 ---------------- */

  function showErrors(errors) {
    clearErrors();
    Object.keys(errors).forEach(function (field) {
      var box = document.querySelector('[data-err="' + field + '"]');
      if (box) box.textContent = errors[field];
      var input = fieldToInput(field);
      if (input) input.classList.add('has-error');
    });
    // 滚动到第一个出错的字段
    var first = document.querySelector('.err-msg:not(:empty)');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearErrors() {
    document.querySelectorAll('.err-msg').forEach(function (el) { el.textContent = ''; });
    document.querySelectorAll('.has-error').forEach(function (el) { el.classList.remove('has-error'); });
  }

  function fieldToInput(field) {
    var map = {
      title: 'f-title', place: 'f-place', time: 'f-time',
      desc: 'f-desc', contact: 'f-contact'
    };
    return map[field] ? document.getElementById(map[field]) : null;
  }

  /* ---------------- 收集表单数据 ---------------- */

  function collect() {
    return {
      type: state.type,
      title: document.getElementById('f-title').value,
      category: state.category,
      place: document.getElementById('f-place').value,
      time: Utils.parseDateTimeLocal(document.getElementById('f-time').value),
      desc: document.getElementById('f-desc').value,
      contact: document.getElementById('f-contact').value,
      images: images.slice()
    };
  }

  /* ---------------- 提交 ---------------- */

  function onSubmit(e) {
    e.preventDefault();
    var res = store.add(collect());

    if (!res.ok) {
      if (res.errors) {
        showErrors(res.errors);
        UI.toast('请检查表单中标红的项', 'error');
      } else {
        // 存储空间不足等异常
        UI.toast(res.message || '保存失败，请稍后重试', 'error');
      }
      return;
    }

    UI.toast('发布成功', 'success');
    setTimeout(function () {
      location.href = 'success.html' + Utils.buildQuery({ id: res.item.id });
    }, 350);
  }

  /* ---------------- 图片上传 ---------------- */

  function renderUploader() {
    var box = document.getElementById('uploader');
    // 保留"添加照片"按钮，重新渲染已上传图片
    var html = '';
    images.forEach(function (src, i) {
      html += '<div class="upload-item"><img src="' + src + '" alt="照片' + (i + 1) + '">' +
        '<button type="button" class="del" data-index="' + i + '" title="删除">✕</button></div>';
    });
    if (images.length < MAX_IMAGES) {
      html += '<label class="upload-box" id="upload-btn">' +
        '<span class="plus">＋</span><span>添加照片</span>' +
        '<input type="file" id="file-input" accept="image/*" multiple hidden></label>';
    }
    box.innerHTML = html;
    bindFileInput();
  }

  function bindFileInput() {
    var input = document.getElementById('file-input');
    if (!input) return;
    input.addEventListener('change', function () {
      handleFiles(this.files);
      this.value = '';      // 允许重复选择同一个文件
    });
  }

  function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;

    var remain = MAX_IMAGES - images.length;
    if (remain <= 0) {
      UI.toast('最多上传 ' + MAX_IMAGES + ' 张照片', 'error');
      return;
    }
    if (files.length > remain) {
      UI.toast('最多上传 ' + MAX_IMAGES + ' 张，已自动取前 ' + remain + ' 张');
      files = files.slice(0, remain);
    }

    files.forEach(function (file) {
      Utils.compressImage(file, 900, 0.72).then(function (dataUrl) {
        // 压缩后仍然过大的图片（超过 800KB）直接拒绝，避免写满存储
        if (dataUrl.length > 800 * 1024) {
          UI.toast('「' + file.name + '」压缩后仍过大，已跳过', 'error');
          return;
        }
        images.push(dataUrl);
        renderUploader();
      }).catch(function (err) {
        UI.toast((err && err.message) || '图片处理失败', 'error');
      });
    });
  }

  /* ---------------- 初始化 ---------------- */

  function renderCategoryChips() {
    var box = document.getElementById('cat-chips');
    box.innerHTML = Store.CATEGORIES.map(function (c, i) {
      return '<button type="button" class="chip' + (i === 0 ? '' : '') + '" data-cat="' + c.id + '">' +
        c.emoji + ' ' + c.name + '</button>';
    }).join('');
  }

  function bindEvents() {
    // 类型切换
    document.getElementById('type-picker').addEventListener('click', function (e) {
      var opt = e.target.closest('.type-option');
      if (!opt) return;
      state.type = opt.getAttribute('data-type');
      this.querySelectorAll('.type-option').forEach(function (o) { o.classList.remove('on'); });
      opt.classList.add('on');
    });

    // 分类选择
    document.getElementById('cat-chips').addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');
      if (!btn) return;
      state.category = btn.getAttribute('data-cat');
      this.querySelectorAll('.chip').forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      document.querySelector('[data-err="category"]').textContent = '';
    });

    // 图片删除
    document.getElementById('uploader').addEventListener('click', function (e) {
      var del = e.target.closest('.del');
      if (!del) return;
      images.splice(Number(del.getAttribute('data-index')), 1);
      renderUploader();
    });

    // 描述字数统计
    var desc = document.getElementById('f-desc');
    desc.addEventListener('input', function () {
      var el = document.getElementById('desc-count');
      el.textContent = this.value.length + '/200';
      el.classList.toggle('warn', this.value.length > 180);
    });

    // 输入时即时清除该字段的错误提示
    ['f-title', 'f-place', 'f-time', 'f-desc', 'f-contact'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        this.classList.remove('has-error');
        var field = id.replace('f-', '');
        var box = document.querySelector('[data-err="' + field + '"]');
        if (box) box.textContent = '';
      });
    });

    form.addEventListener('submit', onSubmit);
    document.getElementById('reset-btn').addEventListener('click', function (e) {
      e.preventDefault();
      if (!window.confirm('确定要清空已填写的内容吗？')) return;
      form.reset();
      images = [];
      state = { type: 'found', category: '' };
      renderUploader();
      clearErrors();
      document.getElementById('desc-count').textContent = '0/200';
      document.querySelectorAll('#type-picker .type-option').forEach(function (o, i) {
        o.classList.toggle('on', i === 0);
      });
      document.querySelectorAll('#cat-chips .chip').forEach(function (b) { b.classList.remove('on'); });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    UI.initPage('publish');
    form = document.getElementById('publish-form');

    renderCategoryChips();
    renderUploader();
    bindEvents();

    // 地点下拉建议 + 默认填当前时间
    var datalist = document.getElementById('place-list');
    Store.PLACES.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p;
      datalist.appendChild(opt);
    });
    var now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('f-time').value = now.toISOString().slice(0, 16);

    // 从首页"发布"按钮带过来的类型：publish.html?type=lost
    var t = Utils.parseQuery(location.search).type;
    if (t === 'lost' || t === 'found') {
      state.type = t;
      document.querySelectorAll('#type-picker .type-option').forEach(function (o) {
        o.classList.toggle('on', o.getAttribute('data-type') === t);
      });
    }
  });
})();
