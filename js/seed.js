/**
 * seed.js —— 演示数据
 *
 * 为什么需要它？
 * 本程序没有服务器，所有数据存在各自的浏览器里。如果只显示"我自己发布的"信息，
 * 首页在第一次打开时就是空的，无法演示"浏览他人信息 → 查看详情 → 联系发布者"这条流程。
 * 所以首次打开时灌入一批演示数据，它们 isMine=false，模拟"其他同学发布的信息"；
 * 用户自己发布的 4 条（isMine=true）可以在"我的发布"里标记完成、删除。
 *
 * 时间用"距离现在多少小时"来算，这样无论什么时候打开，
 * 都会显示"今天 10:30""昨天 18:20"这种自然的相对时间。
 */
(function (root) {
  'use strict';

  var H = 60 * 60 * 1000;
  var now = Date.now();
  function ago(hours) { return now - hours * H; }

  var items = [
    {
      id: 'seed_card_found',
      type: 'found',
      title: '校园卡（学号尾号 32）',
      category: 'card',
      place: '图书馆',
      time: ago(3),
      desc: '在图书馆二楼自习区靠窗的位置捡到，卡面有些磨损，卡套是蓝色的。已交到二楼服务台，也可以直接联系我认领。',
      contact: '13800135678',
      images: [],
      status: 'open',
      isMine: false,
      createdAt: ago(3),
      updatedAt: ago(3),
      closedAt: null
    },
    {
      id: 'seed_umbrella_lost',
      type: 'lost',
      title: '深蓝色长柄雨伞',
      category: 'daily',
      place: '食堂',
      time: ago(20),
      desc: '昨天晚饭时间落在东区食堂一楼靠门口的座位旁，伞柄上刻了名字缩写 ROH，伞面是纯深蓝色没有花纹。',
      contact: 'wx: umb_roh2024',
      images: [],
      status: 'open',
      isMine: false,
      createdAt: ago(19),
      updatedAt: ago(19),
      closedAt: null
    },
    {
      id: 'seed_earphone_found',
      type: 'found',
      title: '黑色无线蓝牙耳机（右耳）',
      category: 'digital',
      place: '操场',
      time: ago(30),
      desc: '在操场跑道旁边的看台下面捡到一只黑色蓝牙耳机，充电盒没有了。请描述一下耳机上的划痕位置来认领。',
      contact: 'qq: 445566778',
      images: [],
      status: 'closed',
      isMine: false,
      createdAt: ago(29),
      updatedAt: ago(26),
      closedAt: ago(26)
    },
    {
      id: 'seed_bottle_lost',
      type: 'lost',
      title: '白色保温杯（杯身有卡通贴纸）',
      category: 'daily',
      place: '教学楼',
      time: ago(50),
      desc: '前天上午在三教 305 上课时忘在教室了，白色 500ml 保温杯，杯身贴了一张小猫贴纸，杯盖是原装黑色。',
      contact: '13800138899',
      images: [],
      status: 'open',
      isMine: false,
      createdAt: ago(48),
      updatedAt: ago(48),
      closedAt: null
    },
    {
      id: 'seed_book_found',
      type: 'found',
      title: '《数据结构与算法分析》教材',
      category: 'book',
      place: '教学楼',
      time: ago(70),
      desc: '在三教 201 教室的最后一排座位抽屉里发现，扉页写有姓名，为避免冒领请说出姓名后再联系。',
      contact: 'wx: ds_book_2024',
      images: [],
      status: 'open',
      isMine: false,
      createdAt: ago(69),
      updatedAt: ago(69),
      closedAt: null
    },
    {
      id: 'seed_key_lost',
      type: 'lost',
      title: '一串钥匙（带黄色小熊挂件）',
      category: 'daily',
      place: '宿舍区',
      time: ago(96),
      desc: '上周五在宿舍区 7 号楼到食堂的路上丢的，一共三把钥匙，挂件是一个黄色的塑料小熊，很重要。',
      contact: '13900139000',
      images: [],
      status: 'closed',
      isMine: false,
      createdAt: ago(95),
      updatedAt: ago(90),
      closedAt: ago(90)
    },
    {
      id: 'seed_charger_found',
      type: 'found',
      title: '白色充电宝（20000mAh）',
      category: 'digital',
      place: '图书馆',
      time: ago(120),
      desc: '在图书馆一楼自助借还机旁边捡到一个白色充电宝，边角有一个小凹痕，看起来用了挺久。',
      contact: 'qq: 112233445',
      images: [],
      status: 'open',
      isMine: false,
      createdAt: ago(119),
      updatedAt: ago(119),
      closedAt: null
    },
    {
      id: 'seed_glasses_lost',
      type: 'lost',
      title: '银色金属框近视眼镜',
      category: 'cloth',
      place: '食堂',
      time: ago(140),
      desc: '度数挺高的，没有眼镜基本看不清东西，应该是在食堂二楼吃饭时放在桌上忘记拿了，配的蓝色眼镜盒。',
      contact: 'wx: glasses_help2',
      images: [],
      status: 'open',
      isMine: false,
      createdAt: ago(139),
      updatedAt: ago(139),
      closedAt: null
    },
    {
      id: 'seed_umbrella_found',
      type: 'found',
      title: '格子纹折叠雨伞',
      category: 'daily',
      place: '教学楼',
      time: ago(160),
      desc: '三教一楼的伞架上有好几把没人认领的伞，我先把这把格子纹的放在门卫室了，伞柄是木质的。',
      contact: '13800137777',
      images: [],
      status: 'open',
      isMine: false,
      createdAt: ago(159),
      updatedAt: ago(159),
      closedAt: null
    },
    {
      id: 'seed_wallet_lost',
      type: 'lost',
      title: '棕色短款钱包',
      category: 'other',
      place: '校门口',
      time: ago(200),
      desc: '在从校门口到宿舍区的路上遗失，里面只有少量现金和一张公交卡，主要是证件补办很麻烦，捡到请联系我。',
      contact: 'wx: wallet_owner',
      images: [],
      status: 'open',
      isMine: false,
      createdAt: ago(199),
      updatedAt: ago(199),
      closedAt: null
    }
  ];

  // 浏览器环境挂到 window，Node 环境下导出（供测试使用）
  if (typeof module === 'object' && module.exports) {
    module.exports = items;
  } else {
    root.LF_SEED = items;
  }
})(typeof self !== 'undefined' ? self : this);
