/**
 * store.test.js —— 数据层的单元测试
 *
 * 测试思路（对应作业要求的"白盒测试用例设计方法"）：
 *   1. 等价类划分：把输入分成"合法"与"非法"两类，各取代表值测试
 *      例如 validate()：合法数据、缺字段、字段格式错、字段超长
 *   2. 边界值分析：针对长度/时间等边界取 最小值、最小值-1、最大值、最大值+1
 *      例如物品名称 2~30 字，就测 1 字、2 字、30 字、31 字
 *   3. 特殊值：null、空字符串、损坏的 JSON、存储写满
 *   4. 状态转换：进行中 → 已结束 → 回到进行中
 *
 * 关键设计：测试不直接使用浏览器的 localStorage，而是传入一个"假存储"对象。
 * 这样每次测试都从干净状态开始，用例之间不会互相影响，测试也不会污染真实数据。
 */
(function () {
  'use strict';

  var Store = window.LFStore;
  var describe = MiniTest.describe;
  var it = MiniTest.it;
  var expect = MiniTest.expect;

  /* ---------------- 测试替身（Test Double） ---------------- */

  /** 内存版存储：模拟 localStorage 的接口 */
  function createFakeStorage() {
    var data = {};
    return {
      getItem: function (k) {
        return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
      },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; },
      _write: function (k, v) { data[k] = v; },     // 测试用：直接塞入原始值（如损坏数据）
      _size: function () { return Object.keys(data).length; }
    };
  }

  /** 模拟"存储已满"的存储：setItem 一定抛异常 */
  function createFullStorage() {
    return {
      getItem: function () { return null; },
      setItem: function () {
        var e = new Error('quota exceeded');
        e.name = 'QuotaExceededError';
        throw e;
      }
    };
  }

  /** 一份合法的发布数据，各用例基于它修改，避免重复 */
  function validInput(overrides) {
    var base = {
      type: 'found',
      title: '校园卡',
      category: 'card',
      place: '图书馆',
      time: Date.now() - 60 * 60 * 1000,
      desc: '在图书馆二楼捡到一张校园卡',
      contact: '13800138000',
      images: []
    };
    Object.keys(overrides || {}).forEach(function (k) { base[k] = overrides[k]; });
    return base;
  }

  /* ================= validate 校验 ================= */

  describe('validate —— 发布信息校验（等价类 + 边界值）', function () {
    it('合法数据校验通过，并返回规范化后的值', function () {
      var r = Store.validate(validInput({ title: '  校园卡  ' }));
      expect(r.ok).toBe(true);
      expect(r.value.title).toBe('校园卡');          // 首尾空格被去掉
      expect(r.value.contact).toBe('13800138000');
    });

    it('非法：缺少物品名称', function () {
      var r = Store.validate(validInput({ title: '' }));
      expect(r.ok).toBeFalsy();
      expect(r.errors.title).toBe('请填写物品名称');
    });

    it('非法：物品名称只有 1 个字（下边界）', function () {
      var r = Store.validate(validInput({ title: '伞' }));
      expect(r.errors.title).toContain('2~30');
    });

    it('合法：物品名称刚好 2 个字（上边界内）与刚好 30 个字', function () {
      expect(Store.validate(validInput({ title: '雨伞' })).ok).toBe(true);
      expect(Store.validate(validInput({ title: new Array(31).join('卡') })).ok).toBe(true);
    });

    it('非法：物品名称 31 个字（超上边界）', function () {
      var r = Store.validate(validInput({ title: new Array(32).join('卡') }));
      expect(r.ok).toBeFalsy();
    });

    it('非法：类型不是 lost / found', function () {
      var r = Store.validate(validInput({ type: 'unknown' }));
      expect(r.errors.type).toContain('寻物 / 招领');
    });

    it('非法：分类不存在', function () {
      var r = Store.validate(validInput({ category: 'not-exist' }));
      expect(r.errors.category).toContain('分类');
    });

    it('非法：地点为空或超过 20 字', function () {
      expect(Store.validate(validInput({ place: '   ' })).errors.place).toBe('请填写地点');
      expect(Store.validate(validInput({ place: new Array(22).join('楼') })).errors.place).toContain('20');
    });

    it('非法：时间晚于当前时间（不允许发布"未来"的丢失时间）', function () {
      var r = Store.validate(validInput({ time: Date.now() + 24 * 60 * 60 * 1000 }));
      expect(r.errors.time).toContain('当前时间');
    });

    it('边界：时间刚好是当前时间（允许）', function () {
      var r = Store.validate(validInput({ time: Date.now() }));
      expect(r.ok).toBe(true);
    });

    it('非法：时间缺失或非法字符串', function () {
      expect(Store.validate(validInput({ time: '' })).errors.time).toBeTruthy();
      expect(Store.validate(validInput({ time: 'abc' })).errors.time).toBeTruthy();
      expect(Store.validate(validInput({ time: null })).errors.time).toBeTruthy();
    });

    it('非法：描述超过 200 字', function () {
      var r = Store.validate(validInput({ desc: new Array(202).join('描') }));
      expect(r.errors.desc).toContain('200');
    });

    it('合法：描述刚好 200 字（边界值）', function () {
      expect(Store.validate(validInput({ desc: new Array(201).join('描') })).ok).toBe(true);
    });

    it('描述为空是允许的（选填项）', function () {
      expect(Store.validate(validInput({ desc: '' })).ok).toBe(true);
    });

    it('非法：联系方式过短、过长或含中文', function () {
      expect(Store.validate(validInput({ contact: '123' })).errors.contact).toBeTruthy();
      expect(Store.validate(validInput({ contact: new Array(32).join('1') })).errors.contact).toBeTruthy();
      expect(Store.validate(validInput({ contact: '我的手机号' })).errors.contact).toBeTruthy();
    });

    it('多个字段同时出错时，一次性返回全部错误（页面可以逐项标红）', function () {
      var r = Store.validate({ type: '', title: '', category: '', place: '', time: '', contact: '' });
      expect(r.ok).toBeFalsy();
      expect(Object.keys(r.errors).length).toBe(6);
    });

    it('异常输入：完全不传参数也不崩溃', function () {
      var r = Store.validate();
      expect(r.ok).toBeFalsy();
      expect(Object.keys(r.errors).length).toBeGreaterThan(0);
    });
  });

  /* ================= 增删改查 ================= */

  describe('add —— 新增信息', function () {
    it('新增成功后返回带 id / 状态 / 发布时间的完整对象', function () {
      var store = Store.create(createFakeStorage());
      var r = store.add(validInput());
      expect(r.ok).toBe(true);
      expect(r.item.id).toBeTruthy();
      expect(r.item.status).toBe(Store.STATUS.OPEN);      // 新建的默认"进行中"
      expect(r.item.isMine).toBe(true);                   // 本机发布的算"我的"
      expect(r.item.createdAt).toBeGreaterThan(0);
      expect(r.item.closedAt).toBeNull();
    });

    it('校验不通过时不写入数据（存储保持为空）', function () {
      var s = createFakeStorage();
      var store = Store.create(s);
      var r = store.add(validInput({ title: '' }));
      expect(r.ok).toBeFalsy();
      expect(store.list()).toHaveLength(0);
    });

    it('新发布的信息排在最前面', function () {
      var store = Store.create(createFakeStorage());
      store.add(validInput({ title: '第一条' }));
      store.add(validInput({ title: '第二条' }));
      var list = store.list();
      expect(list[0].title).toBe('第二条');
    });

    it('存储写满时返回 QuotaExceededError，而不是抛出异常', function () {
      var store = Store.create(createFullStorage());
      var r = store.add(validInput());
      expect(r.ok).toBeFalsy();
      expect(r.error).toBe('QUOTA');
      expect(r.message).toContain('存储空间已满');
    });
  });

  describe('getById —— 按 id 查询', function () {
    it('能查到刚新增的信息', function () {
      var store = Store.create(createFakeStorage());
      var added = store.add(validInput()).item;
      expect(store.getById(added.id).title).toBe('校园卡');
    });

    it('id 不存在时返回 null', function () {
      var store = Store.create(createFakeStorage());
      expect(store.getById('not-exist')).toBeNull();
    });
  });

  describe('query —— 条件查询与筛选', function () {
    function seeded() {
      var store = Store.create(createFakeStorage());
      store.add(validInput({ title: '校园卡', type: 'found', category: 'card', place: '图书馆' }));
      store.add(validInput({ title: '雨伞', type: 'lost', category: 'daily', place: '食堂' }));
      store.add(validInput({ title: '耳机', type: 'found', category: 'digital', place: '操场' }));
      return store;
    }

    it('不传条件时返回全部', function () {
      expect(seeded().query()).toHaveLength(3);
    });

    it('按类型筛选（寻物 / 招领）', function () {
      expect(seeded().query({ type: 'lost' })).toHaveLength(1);
      expect(seeded().query({ type: 'found' })).toHaveLength(2);
    });

    it('按分类筛选', function () {
      expect(seeded().query({ category: 'digital' })[0].title).toBe('耳机');
    });

    it('按地点筛选', function () {
      expect(seeded().query({ place: '食堂' })[0].title).toBe('雨伞');
    });

    it('按状态筛选：新建的都是进行中', function () {
      expect(seeded().query({ status: 'open' })).toHaveLength(3);
      expect(seeded().query({ status: 'closed' })).toHaveLength(0);
    });

    it('筛选条件可以组合', function () {
      var r = seeded().query({ type: 'found', place: '操场' });
      expect(r).toHaveLength(1);
      expect(r[0].title).toBe('耳机');
    });

    it('条件无匹配时返回空数组', function () {
      expect(seeded().query({ type: 'lost', place: '操场' })).toHaveLength(0);
    });

    it('按发布时间排序（new 最新在前 / old 最早在前）', function () {
      var store = seeded();
      expect(store.query({ sort: 'new' })[0].title).toBe('耳机');
      expect(store.query({ sort: 'old' })[0].title).toBe('校园卡');
    });
  });

  describe('search —— 关键词搜索', function () {
    function seeded() {
      var store = Store.create(createFakeStorage());
      store.add(validInput({ title: '校园卡', category: 'card', place: '图书馆', desc: '学号尾号 32' }));
      store.add(validInput({ title: '蓝色雨伞', category: 'daily', place: '食堂', desc: '伞柄刻了字' }));
      store.add(validInput({ title: '黑色耳机', category: 'digital', place: '操场', desc: '带充电盒' }));
      return store;
    }

    it('按物品名称搜索', function () {
      var r = seeded().search('校园卡');
      expect(r.count).toBe(1);
      expect(r.items[0].title).toBe('校园卡');
    });

    it('按描述搜索', function () {
      expect(seeded().search('尾号').count).toBe(1);
    });

    it('按地点搜索', function () {
      expect(seeded().search('食堂').count).toBe(1);
    });

    it('按分类名称搜索（用户输入"数码电子"也能搜到耳机）', function () {
      var r = seeded().search('数码电子');
      expect(r.count).toBe(1);
      expect(r.items[0].title).toBe('黑色耳机');
    });

    it('部分匹配：输入"雨"能搜到"蓝色雨伞"', function () {
      expect(seeded().search('雨').count).toBe(1);
    });

    it('关键词首尾带空格也能搜到（自动规范化）', function () {
      expect(seeded().search('  校园卡  ').count).toBe(1);
    });

    it('空关键词返回全部信息', function () {
      expect(seeded().search('').count).toBe(3);
      expect(seeded().search('   ').count).toBe(3);
    });

    it('搜不到时返回空结果，但接口仍然成功（页面据此显示"无结果"提示）', function () {
      var r = seeded().search('不存在的东西');
      expect(r.ok).toBe(true);
      expect(r.count).toBe(0);
      expect(r.items).toHaveLength(0);
    });

    it('搜索可以和类型筛选组合使用', function () {
      var store = Store.create(createFakeStorage());
      store.add(validInput({ title: '校园卡', type: 'lost' }));
      store.add(validInput({ title: '校园卡', type: 'found' }));
      expect(store.search('校园卡').count).toBe(2);
      expect(store.search('校园卡', { type: 'lost' }).count).toBe(1);
    });
  });

  /* ================= 状态更新（作业核心流程） ================= */

  describe('updateStatus —— 修改信息状态（已找到 / 已归还）', function () {
    it('把进行中标记为已结束，并记录结束时间', function () {
      var store = Store.create(createFakeStorage());
      var item = store.add(validInput({ type: 'lost' })).item;
      var r = store.updateStatus(item.id, Store.STATUS.CLOSED);
      expect(r.ok).toBe(true);
      expect(r.item.status).toBe('closed');
      expect(r.item.closedAt).toBeGreaterThan(0);
      expect(store.getById(item.id).status).toBe('closed');   // 已持久化
    });

    it('状态可以从已结束改回进行中（closedAt 被清空）', function () {
      var store = Store.create(createFakeStorage());
      var item = store.add(validInput()).item;
      store.updateStatus(item.id, Store.STATUS.CLOSED);
      var r = store.updateStatus(item.id, Store.STATUS.OPEN);
      expect(r.item.status).toBe('open');
      expect(r.item.closedAt).toBeNull();
    });

    it('标记后，搜索"进行中"就查不到这条了（其他用户看到的状态同步变化）', function () {
      var store = Store.create(createFakeStorage());
      var item = store.add(validInput()).item;
      expect(store.query({ status: 'open' })).toHaveLength(1);
      store.updateStatus(item.id, Store.STATUS.CLOSED);
      expect(store.query({ status: 'open' })).toHaveLength(0);
      expect(store.query({ status: 'closed' })).toHaveLength(1);
    });

    it('非法状态值被拒绝', function () {
      var store = Store.create(createFakeStorage());
      var item = store.add(validInput()).item;
      var r = store.updateStatus(item.id, 'unknown');
      expect(r.ok).toBeFalsy();
      expect(r.error).toBe('BAD_STATUS');
      expect(store.getById(item.id).status).toBe('open');     // 原状态未被改动
    });

    it('id 不存在时返回 NOT_FOUND', function () {
      var store = Store.create(createFakeStorage());
      var r = store.updateStatus('not-exist', Store.STATUS.CLOSED);
      expect(r.ok).toBeFalsy();
      expect(r.error).toBe('NOT_FOUND');
    });
  });

  describe('remove —— 删除信息', function () {
    it('删除后列表少一条，且查不到该 id', function () {
      var store = Store.create(createFakeStorage());
      var item = store.add(validInput()).item;
      expect(store.remove(item.id).ok).toBe(true);
      expect(store.list()).toHaveLength(0);
      expect(store.getById(item.id)).toBeNull();
    });

    it('删除不存在的 id 返回 NOT_FOUND', function () {
      var store = Store.create(createFakeStorage());
      expect(store.remove('not-exist').error).toBe('NOT_FOUND');
    });
  });

  /* ================= 统计与批量操作 ================= */

  describe('stats —— 数据统计', function () {
    it('统计总数、进行中、已结束、寻物、招领', function () {
      var store = Store.create(createFakeStorage());
      var a = store.add(validInput({ type: 'lost' })).item;
      store.add(validInput({ type: 'found' }));
      store.add(validInput({ type: 'found' }));
      store.updateStatus(a.id, Store.STATUS.CLOSED);

      var s = store.stats();
      expect(s.total).toBe(3);
      expect(s.closed).toBe(1);
      expect(s.open).toBe(2);
      expect(s.lost).toBe(1);
      expect(s.found).toBe(2);
    });

    it('空数据时各项统计都是 0', function () {
      var s = Store.create(createFakeStorage()).stats();
      expect(s.total).toBe(0);
      expect(s.open).toBe(0);
    });
  });

  describe('replaceAll / isEmpty —— 批量初始化', function () {
    it('本地为空时 isEmpty 返回 true', function () {
      var store = Store.create(createFakeStorage());
      expect(store.isEmpty()).toBe(true);
      store.add(validInput());
      expect(store.isEmpty()).toBe(false);
    });

    it('replaceAll 可以一次写入多条（用于灌入演示数据）', function () {
      var store = Store.create(createFakeStorage());
      var ok = store.replaceAll([{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }]);
      expect(ok.ok).toBe(true);
      expect(store.list()).toHaveLength(2);
    });

    it('replaceAll 传入非数组时返回错误，不破坏原有数据', function () {
      var store = Store.create(createFakeStorage());
      store.add(validInput());
      expect(store.replaceAll('not-array').ok).toBeFalsy();
      expect(store.list()).toHaveLength(1);
    });
  });

  /* ================= 异常与容错 ================= */

  describe('容错 —— 数据损坏与存储异常', function () {
    it('存储里是损坏的 JSON 时返回空列表，不会让页面崩溃', function () {
      var s = createFakeStorage();
      s._write(Store.KEY, '{这不是合法的 JSON');
      var store = Store.create(s);
      expect(store.list()).toHaveLength(0);
      expect(store.query()).toHaveLength(0);
    });

    it('存储里存的是对象而不是数组时也能容错', function () {
      var s = createFakeStorage();
      s._write(Store.KEY, '{"a":1}');
      expect(Store.create(s).list()).toHaveLength(0);
    });

    it('完全不传 storage（浏览器禁用本地存储）时退化为内存模式，功能仍可用', function () {
      var store = Store.create(null);
      var r = store.add(validInput());
      expect(r.ok).toBe(true);
      expect(store.list()).toHaveLength(1);
    });
  });

  /* ================= 元数据 ================= */

  describe('元数据 —— 分类常量', function () {
    it('提供 6 个分类，且 id 唯一', function () {
      expect(Store.CATEGORIES).toHaveLength(6);
      var ids = {};
      var dup = 0;
      Store.CATEGORIES.forEach(function (c) { if (ids[c.id]) dup++; ids[c.id] = 1; });
      expect(dup).toBe(0);
    });

    it('getCategory 能按 id 取到分类，取不到时返回 null', function () {
      expect(Store.getCategory('card').name).toBe('卡证');
      expect(Store.getCategory('nope')).toBeNull();
    });

    it('findCategoryByName 支持模糊匹配（搜"卡"能找到"卡证"）', function () {
      expect(Store.findCategoryByName('卡').id).toBe('card');
      expect(Store.findCategoryByName('不存在')).toBeNull();
    });
  });
})();
