/**
 * store.js —— 数据层（业务核心）
 *
 * 设计说明：
 * 1. 数据保存在浏览器 localStorage 中，key 为 KEY，值是 JSON 数组。
 * 2. 本文件不直接操作页面 DOM，只负责"增删改查 + 校验"，
 *    因此可以用一个假的 storage 对象注入进来做单元测试（见 tests/store.test.js）。
 * 3. 所有对外方法都返回统一格式 {ok:true, ...} 或 {ok:false, error/errors}，
 *    调用方（页面）只需判断 ok，不用写 try/catch。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./utils.js'));
  } else {
    root.LFStore = factory(root.LFUtils);
  }
})(typeof self !== 'undefined' ? self : this, function (Utils) {
  'use strict';

  var KEY = 'campus-lostfound-v1';

  /** 信息类型：寻物 / 招领 */
  var TYPE = { LOST: 'lost', FOUND: 'found' };

  /** 信息状态：进行中 / 已结束（寻物=已找到，招领=已归还） */
  var STATUS = { OPEN: 'open', CLOSED: 'closed' };

  /** 物品分类（原型里的"分类"下拉） */
  var CATEGORIES = [
    { id: 'card', name: '卡证', emoji: '💳' },
    { id: 'daily', name: '生活用品', emoji: '🧴' },
    { id: 'digital', name: '数码电子', emoji: '🎧' },
    { id: 'book', name: '书籍资料', emoji: '📚' },
    { id: 'cloth', name: '衣物配饰', emoji: '🧣' },
    { id: 'other', name: '其他', emoji: '📦' }
  ];

  /** 校园常见地点 */
  var PLACES = ['教学楼', '图书馆', '食堂', '宿舍区', '操场', '校门口', '其他'];

  /** 各字段的校验规则，报错文案统一放在这里，方便页面直接显示 */
  var LIMITS = { titleMin: 2, titleMax: 30, descMax: 200, contactMin: 5, contactMax: 30 };

  function getCategory(id) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].id === id) return CATEGORIES[i];
    }
    return null;
  }

  /** 分类名 -> 分类对象（搜索时用户可能输入"卡证"） */
  function findCategoryByName(name) {
    var n = Utils.normalize(name);
    if (!n) return null;
    for (var i = 0; i < CATEGORIES.length; i++) {
      var c = CATEGORIES[i];
      if (c.name === n || c.name.indexOf(n) > -1 || n.indexOf(c.name) > -1) return c;
    }
    return null;
  }

  /**
   * 校验一条待发布的信息。
   * @returns {{ok:boolean, errors?:Object, value?:Object}} errors 是 {字段名: 提示语}
   */
  function validate(input) {
    var errors = {};
    var data = input || {};

    var title = Utils.normalize(data.title);
    if (!title) {
      errors.title = '请填写物品名称';
    } else if (!Utils.isValidTitle(title)) {
      errors.title = '物品名称需为 ' + LIMITS.titleMin + '~' + LIMITS.titleMax + ' 个字符';
    }

    if (data.type !== TYPE.LOST && data.type !== TYPE.FOUND) {
      errors.type = '请选择信息类型（寻物 / 招领）';
    }

    if (!getCategory(data.category)) {
      errors.category = '请选择物品分类';
    }

    var place = Utils.normalize(data.place);
    if (!place) {
      errors.place = '请填写地点';
    } else if (place.length > 20) {
      errors.place = '地点不超过 20 个字符';
    }

    var time = data.time;
    if (time === undefined || time === null || time === '' || isNaN(Number(time))) {
      errors.time = '请选择时间';
    } else if (Number(time) > Date.now() + Utils.MINUTE) {
      errors.time = '时间不能晚于当前时间';
    }

    var desc = Utils.normalize(data.desc);
    if (desc.length > LIMITS.descMax) {
      errors.desc = '描述不超过 ' + LIMITS.descMax + ' 个字符';
    }

    var contact = Utils.normalize(data.contact);
    if (!contact) {
      errors.contact = '请填写联系方式';
    } else if (!Utils.isValidContact(contact)) {
      errors.contact = '联系方式需为 ' + LIMITS.contactMin + '~' + LIMITS.contactMax + ' 个字符（手机号 / 微信 / QQ / 邮箱）';
    }

    if (Object.keys(errors).length) return { ok: false, errors: errors };

    return {
      ok: true,
      value: {
        title: title,
        type: data.type,
        category: data.category,
        place: place,
        time: Number(time),
        desc: desc,
        contact: contact,
        images: (data.images || []).slice(0, 3)
      }
    };
  }

  /**
   * 创建一个数据仓库实例。
   * @param {Object} storage 任何实现了 getItem/setItem 的对象（测试时可传入内存假对象）
   */
  function createStore(storage) {
    var hasStorage = !!(storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function');
    var memoryFallback = null;   // 浏览器禁用 localStorage 时的兜底

    function readRaw() {
      if (!hasStorage) return memoryFallback;
      try {
        return storage.getItem(KEY);
      } catch (e) {
        return memoryFallback;
      }
    }

    function writeRaw(text) {
      memoryFallback = text;
      if (!hasStorage) return { ok: true, memoryOnly: true };
      try {
        storage.setItem(KEY, text);
        return { ok: true };
      } catch (e) {
        // 通常是存储空间已满（图片太多）
        var quota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
        return { ok: false, error: quota ? 'QUOTA' : 'STORAGE', message: quota ? '浏览器存储空间已满，请删除部分带图片的信息后重试' : '本地存储不可用' };
      }
    }

    /** 读出全部信息；数据损坏时返回空数组而不是崩溃 */
    function list() {
      var raw = readRaw();
      if (!raw) return [];
      try {
        var arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch (e) {
        return [];
      }
    }

    function persist(items) {
      return writeRaw(JSON.stringify(items));
    }

    function getById(id) {
      var items = list();
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) return items[i];
      }
      return null;
    }

    /**
     * 新增一条信息。
     * @returns {{ok:true, item:Object}} 或 {{ok:false, errors:Object}} 或 {{ok:false, error:'QUOTA', ...}}
     */
    function add(input) {
      var v = validate(input);
      if (!v.ok) return v;

      var items = list();

      // 同一毫秒内连续发布多条时，Date.now() 会得到相同的值，
      // 导致"按发布时间排序"的结果不确定。这里手动保证时间戳严格递增。
      var now = Date.now();
      var maxTs = 0;
      for (var i = 0; i < items.length; i++) {
        if (items[i].createdAt > maxTs) maxTs = items[i].createdAt;
      }
      if (now <= maxTs) now = maxTs + 1;

      var item = {
        id: Utils.genId('item'),
        type: v.value.type,
        title: v.value.title,
        category: v.value.category,
        place: v.value.place,
        time: v.value.time,
        desc: v.value.desc,
        contact: v.value.contact,
        images: v.value.images,
        status: STATUS.OPEN,
        isMine: true,          // 本机发布的 = 我发布的，可在"我的发布"里管理
        createdAt: now,
        updatedAt: now,
        closedAt: null
      };

      items.unshift(item);      // 新发布的排最前面
      var w = persist(items);
      if (!w.ok) return w;
      return { ok: true, item: item };
    }

    /**
     * 查询列表。所有条件都可选，组合起来就是"筛选"。
     * @param {Object} opt {type, category, place, status, keyword, mine, sort}
     *        sort: 'new'(默认，最新在前) | 'old' | 'time'(物品时间倒序)
     */
    function query(opt) {
      var o = opt || {};
      var items = list();

      if (o.type) items = items.filter(function (it) { return it.type === o.type; });
      if (o.category) items = items.filter(function (it) { return it.category === o.category; });
      if (o.place) items = items.filter(function (it) { return it.place === o.place; });
      if (o.status) items = items.filter(function (it) { return it.status === o.status; });
      if (o.mine === true) items = items.filter(function (it) { return it.isMine === true; });

      if (o.keyword) items = searchIn(items, o.keyword);

      var sort = o.sort || 'new';
      items.sort(function (a, b) {
        if (sort === 'old') return a.createdAt - b.createdAt;
        if (sort === 'time') return (b.time || 0) - (a.time || 0);
        return b.createdAt - a.createdAt;
      });
      return items;
    }

    /**
     * 关键词匹配：物品名称 / 描述 / 地点 / 分类名 任一命中即算匹配。
     * 不区分大小写。
     */
    function searchIn(items, keyword) {
      var kw = Utils.normalize(keyword).toLowerCase();
      if (!kw) return items.slice();
      var cat = findCategoryByName(kw);       // 输入"卡证"也能搜到该分类下的物品

      return items.filter(function (it) {
        var catName = (getCategory(it.category) || {}).name || '';
        var haystack = [it.title, it.desc, it.place, catName].join(' ').toLowerCase();
        if (haystack.indexOf(kw) > -1) return true;
        if (cat && it.category === cat.id) return true;
        return false;
      });
    }

    /** 搜索（对外接口）：返回 {ok:true, items, count, keyword} */
    function search(keyword, opt) {
      var o = opt || {};
      var items = query({
        type: o.type, category: o.category, place: o.place, status: o.status, keyword: keyword, sort: o.sort
      });
      return { ok: true, items: items, count: items.length, keyword: Utils.normalize(keyword) };
    }

    /**
     * 更新状态：发布者把"进行中"改成"已找到 / 已归还"。
     * @param {String} id 信息 id
     * @param {String} status STATUS.CLOSED 或 STATUS.OPEN（允许改回）
     */
    function updateStatus(id, status) {
      if (status !== STATUS.OPEN && status !== STATUS.CLOSED) {
        return { ok: false, error: 'BAD_STATUS', message: '状态值不合法' };
      }
      var items = list();
      var found = null;
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) { found = items[i]; break; }
      }
      if (!found) return { ok: false, error: 'NOT_FOUND', message: '信息不存在或已被删除' };

      found.status = status;
      found.updatedAt = Date.now();
      found.closedAt = status === STATUS.CLOSED ? Date.now() : null;

      var w = persist(items);
      if (!w.ok) return w;
      return { ok: true, item: found };
    }

    /** 删除一条信息 */
    function remove(id) {
      var items = list();
      var before = items.length;
      items = items.filter(function (it) { return it.id !== id; });
      if (items.length === before) {
        return { ok: false, error: 'NOT_FOUND', message: '信息不存在' };
      }
      var w = persist(items);
      if (!w.ok) return w;
      return { ok: true };
    }

    /** 批量写入（首次进入时灌入演示数据、或"恢复演示数据"按钮用） */
    function replaceAll(items) {
      if (!Array.isArray(items)) return { ok: false, error: 'BAD_DATA' };
      return persist(items);
    }

    /** 判断本地是否已有数据（用于决定要不要灌演示数据） */
    function isEmpty() {
      return list().length === 0;
    }

    /** 统计：给我发布页/首页的概览数字用 */
    function stats(opt) {
      var items = query(opt);
      var s = { total: items.length, open: 0, closed: 0, lost: 0, found: 0 };
      items.forEach(function (it) {
        if (it.status === STATUS.CLOSED) s.closed++; else s.open++;
        if (it.type === TYPE.LOST) s.lost++; else s.found++;
      });
      return s;
    }

    return {
      // 查询
      list: list,
      query: query,
      search: search,
      getById: getById,
      stats: stats,
      isEmpty: isEmpty,
      // 写入
      add: add,
      updateStatus: updateStatus,
      remove: remove,
      replaceAll: replaceAll,
      // 元信息
      KEY: KEY
    };
  }

  return {
    create: createStore,
    validate: validate,
    getCategory: getCategory,
    findCategoryByName: findCategoryByName,
    TYPE: TYPE,
    STATUS: STATUS,
    CATEGORIES: CATEGORIES,
    PLACES: PLACES,
    LIMITS: LIMITS,
    KEY: KEY
  };
});
