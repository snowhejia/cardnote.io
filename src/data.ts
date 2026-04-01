import type { Collection } from "./types";

function t(h: number, m: number) {
  return h * 60 + m;
}

/**
 * 内置示例：每张卡讲清一个功能；置顶为卷首语。
 * 侧栏另有「学习笔记 / 摘抄本 / 今日小记 / 兴趣爱好」示意用法。
 */
export const collections: Collection[] = [
  {
    id: "c1",
    name: "入门 · 未来罐导览",
    hint: "每条笔记一件事；下面按功能拆开说明。左侧可切换到学习、摘抄、日记等合集，按你的节奏搭架子。灰色说明可双击改成自己的卷首语。",
    dotColor: "#5e9fe8",
    children: [
      {
        id: "c1-am",
        name: "示意 · 子合集（上半天）",
        dotColor: "#fbbf24",
        cards: [
          {
            id: "intro-sub-am",
            minutesOfDay: t(9, 0),
            text: "【子合集】左侧树形里点开本文件夹——子合集与顶级合集一样按时间线排卡片，只是多了一层归类，适合按场景、项目或心情拆分。",
            media: [
              {
                kind: "image",
                url: "https://picsum.photos/seed/mikujar-sub-am-1/400/280",
              },
              {
                kind: "image",
                url: "https://picsum.photos/seed/mikujar-sub-am-2/400/280",
              },
            ],
          },
        ],
      },
      {
        id: "c1-pm",
        name: "示意 · 子合集（入夜后）",
        dotColor: "#a78bfa",
        cards: [
          {
            id: "intro-sub-pm",
            minutesOfDay: t(22, 30),
            text: "【子合集】白天与夜晚、工作与私事各放一坑，切换文件夹就能换一副脑子看同一天的记录。",
            media: [
              {
                kind: "image",
                url: "https://picsum.photos/seed/mikujar-sub-pm-1/400/280",
              },
              {
                kind: "image",
                url: "https://picsum.photos/seed/mikujar-sub-pm-2/400/280",
              },
              {
                kind: "image",
                url: "https://picsum.photos/seed/mikujar-sub-pm-3/400/280",
              },
            ],
          },
        ],
      },
    ],
    cards: [
      {
        id: "intro-verse",
        minutesOfDay: t(5, 20),
        pinned: true,
        text: "日子是散落的星子，拾进同一口罐里，便成了自己的银河。",
        media: [
          {
            kind: "image",
            url: "/微信图片_2026-03-30_201541_502.jpg",
          },
        ],
      },
      {
        id: "intro-timeline",
        minutesOfDay: t(6, 0),
        text: "【时间线】每条笔记落在「今天某一时刻」，像横格纸往下写，不必起标题。适合碎片：一句念头、半行待办、一阵路过的风。",
      },
      {
        id: "intro-pin",
        minutesOfDay: t(6, 2),
        text: "【置顶】要紧的一条可钉在列表最上方（置顶区），与普通时间线隔开。卡片右上角「⋯」里可选「置顶 / 取消置顶」。",
      },
      {
        id: "intro-tags",
        minutesOfDay: t(6, 4),
        text: "【标签】正文下方的标签单独录入；侧栏「标签」里点选即可筛选。本条带了两个示例标签。",
        tags: ["导览", "功能"],
      },
      {
        id: "intro-media",
        minutesOfDay: t(6, 6),
        text: "【附件与轮播】多图会与视频、文件一起在右侧轮播；点缩略图可看大图或播放，底部圆点可切换。「⋯」里可继续添加附件或清空。",
        media: [
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-g1/480/320",
          },
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-g2/480/320",
          },
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-g3/480/320",
          },
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-g4/480/320",
          },
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-g5/480/320",
          },
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-g6/480/320",
          },
          {
            kind: "file",
            url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            name: "示例-dummy.pdf",
          },
          {
            kind: "video",
            url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
          },
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-g7/480/320",
          },
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-g8/480/320",
          },
        ],
      },
      {
        id: "intro-related-a",
        minutesOfDay: t(6, 8),
        text: "【相关笔记】在「⋯」里打开「相关笔记」，可把其它卡片关联过来，侧栏里双向跳转、添加或解除。本条与下一条已互相关联。",
        relatedRefs: [{ colId: "c1", cardId: "intro-related-b" }],
      },
      {
        id: "intro-related-b",
        minutesOfDay: t(6, 10),
        text: "【相关笔记】从侧栏点「查看」会跳到对应笔记；同一条可在多个关联里出现，适合把会议记录与后续跟进串在一起。",
        relatedRefs: [{ colId: "c1", cardId: "intro-related-a" }],
      },
      {
        id: "intro-links",
        minutesOfDay: t(6, 12),
        text: "【正文链接】写下的 http(s) 或 www. 地址会变成可点链接，新标签页打开。未编辑时点正文区域进入书写，点链接则直接跳转。\n示例：https://developer.mozilla.org/zh-CN/",
      },
      {
        id: "intro-header-tools",
        minutesOfDay: t(6, 14),
        text: "【顶栏图标】右侧放大镜展开搜索；加号即「新建小笔记」，记在当前合集并带上今日日期。正在搜索时也可以继续点加号新建。",
      },
      {
        id: "intro-search",
        minutesOfDay: t(6, 16),
        text: "【搜索】可搜笔记正文、标签、附件显示名、合集名称等；结果里点「打开」会跳到对应合集。",
      },
      {
        id: "intro-calendar",
        minutesOfDay: t(6, 18),
        text: "【日历】侧栏月历点某一天，只看那天写过的东西；未带日期的历史卡片不会出现在日历视图里，新建会自动打上今天。",
      },
      {
        id: "intro-hint",
        minutesOfDay: t(6, 20),
        text: "【合集说明】标题下面灰色小字就是本合集的说明（hint），双击可改成你自己的介绍——每个罐子都可以有一句开场白。",
      },
    ],
  },
  {
    id: "c2",
    name: "学习笔记",
    hint: "课程、术语、错题、复盘——按课表或主题再分子文件夹也行。",
    dotColor: "#60a5fa",
    cards: [
      {
        id: "study-1",
        minutesOfDay: t(10, 5),
        text: "【用法】上课或读书时先抓「此刻的结论」记下钟点，回去再整理大纲；不必同一天写完。",
        tags: ["方法"],
      },
      {
        id: "study-2",
        minutesOfDay: t(15, 40),
        text: "欧拉公式把 e、i、π 系在一行：e^(iπ)+1=0——每次看到都觉得代数与几何在同一张纸上握手。",
        tags: ["数学", "摘抄"],
        media: [
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-study-a/440/300",
          },
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-study-b/440/300",
          },
        ],
      },
    ],
  },
  {
    id: "c3",
    name: "摘抄本",
    hint: "书影、台词、歌词——原文不必长，记下页码或章节更好找。",
    dotColor: "#f472b6",
    cards: [
      {
        id: "quote-1",
        minutesOfDay: t(20, 15),
        text: "「我们活过的刹那，前后皆是永夜。」——费尔南多·佩索阿（可换成你书架上那句）",
        media: [
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-quote-1/420/300",
          },
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-quote-2/420/300",
          },
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-quote-3/420/300",
          },
        ],
      },
    ],
  },
  {
    id: "c4",
    name: "今日小记",
    hint: "一日一页的呼吸感：喝了什么、见了谁、天气怎样，都算数。",
    dotColor: "#34d399",
    cards: [
      {
        id: "daily-1",
        minutesOfDay: t(12, 30),
        text: "午饭锁定一家小面馆，酸汤开胃，窗外雨丝斜着打玻璃——今天适合慢半拍。",
        tags: ["生活"],
        media: [
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-daily-1/440/300",
          },
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-daily-2/440/300",
          },
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-daily-3/440/300",
          },
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-daily-4/440/300",
          },
        ],
      },
    ],
  },
  {
    id: "c5",
    name: "兴趣爱好",
    hint: "琴谱链接、配方克数、剧追到第几集——爱好值得单独一口罐。",
    dotColor: "#fb923c",
    cards: [
      {
        id: "hobby-1",
        minutesOfDay: t(18, 0),
        text: "【吉他】新和弦 Fmaj7 总算按响了，指尖还疼，但扫下去那一下像在笑。",
        tags: ["音乐"],
        media: [
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-music-1/440/300",
          },
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-music-2/440/300",
          },
        ],
      },
      {
        id: "hobby-2",
        minutesOfDay: t(21, 10),
        text: "本周画展「光影与城市」记得带广角；博物馆夜场周五开到九点。",
        tags: ["展览", "待办"],
        media: [
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-art-1/440/300",
          },
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-art-2/440/300",
          },
          {
            kind: "image",
            url: "https://picsum.photos/seed/mikujar-art-3/440/300",
          },
        ],
      },
    ],
  },
];
