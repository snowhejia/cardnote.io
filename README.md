<div align="center">

<img src="docs/screenshots/banner.png" width="900" alt="CardNote · 卡片笔记" />

**`connect your life`** — 面向对象的卡片笔记软件，全部作为「卡片」统一管理。

![status](https://img.shields.io/badge/status-demo-orange) ![frontend](https://img.shields.io/badge/frontend-Vite%20%2B%20React%2018-blue) ![backend](https://img.shields.io/badge/backend-Node%20%2B%20Postgres-green) ![license](https://img.shields.io/badge/license-AGPL--3.0-lightgrey)

</div>

> **可直接运行的 Demo，不是正式版。** 已能日常使用；正式版会在其上重构（本地优先、AI 连接）。
> A runnable **demo**, not the final product. The real version is a ground-up rebuild (local-first, AI links).

---

## ✨ 特性 · Features

### 🧩 卡片 · 合集 · 连接 · Cards / Sets / Links
<img src="docs/screenshots/ScreenShot_2026-07-13_000741_103.png" width="880" alt="Cards / Sets / Links" />

- **Cards** 一切皆卡片 · **Sets** 一张卡可同属多个合集，不强塞进树 · **Links** 双向链接 + 图谱
- **Cards** everything is a card · **Sets** one card, many collections · **Links** backlinks + graph

### 🏷 自定义属性 · Custom properties
<img src="docs/screenshots/ScreenShot_2026-07-13_000751_484.png" width="880" alt="Custom properties" />

- 给卡片加字段：标签 / 评分 / 日期 / 颜色 / 关系 / 作者…（12 种类型），定义一次整个合集继承
- Add typed fields to cards: tags / rating / date / color / relation… (12 types), inherited per collection

## 🗂 使用案例 · Use cases

<div align="center">
<img src="docs/screenshots/gallery.png" width="900" alt="概览 · 笔记 · 文件 · 剪藏" />
</div>

- 🏠 **概览 Overview** — 随手翻旧卡、待办、相册流、随机播放、最近打开
- ✍️ **笔记 Notes** — 多层嵌套合集、置顶、卡片内嵌图片，一条笔记一件小事
- 🗃 **文件 Files** — 图片 / 视频 / 音频 / 文档素材库，缩略图 + 尺寸 + 时长
- ✂️ **剪藏 Clips** — 小红书 / B 站 / 网页 / 公众号 一键结构化剪藏（封面、标题、标签）

**还有 · Also:** 主题 · 任务 · 项目 · 开支 · 账户 · 日历 · 提醒 · 连接图谱 · 导入（Flomo / 印象笔记 / Apple Notes / 语雀）· 归档 & 回收站 · 暗色模式 · 中英双语。

---

## 🛠 技术栈 · Stack

- **前端 Frontend**：Vite + React 18 + TypeScript（SPA）
- **后端 Backend**：Node + Express + PostgreSQL，媒体走对象存储（腾讯云 COS / CDN）
- **扩展 Extension**：Chrome MV3（网页剪藏 web clipping）

## ▶️ 本地运行 · Run locally

需要 Node 18+ 和 Docker。Requires Node 18+ and Docker.

```bash
# 1) 本地数据库 · local database (Postgres 16, :5433)
cd backend
docker compose up -d
docker exec -i cardnote-pg-local psql -U cardnote -d cardnote < scripts/schema.sql

# 2) 后端环境 · backend env
cp .env.example .env
#   DATABASE_URL=postgresql://cardnote:cardnote_local_test@127.0.0.1:5433/cardnote
#   PG_SSL=false
#   PORT=3002
#   JWT_SECRET=<32+ 字节随机串 / random string>
#   ADMIN_PASSWORD=<首启建管理员 / creates admin on first boot>

# 3) 后端 · backend (:3002)
cd backend && npm install && npm start

# 4) 前端 · frontend (:5173)
cd ../frontend && npm install && npm run dev
```

打开 http://localhost:5173 注册即可（媒体上传需另配 COS，不配也能跑）。
Open http://localhost:5173 and sign up (media upload needs COS; runs fine without it).

## 🧭 正式版方向 · Where it's going

**一个面向对象的笔记软件。** 有点像编程里的对象：每张卡片是一个对象，有很多属性，属于一个「类」，类可以继承；对象之间能互相联结——比如「某个人」和「他的学校」都是对象，彼此关联。纯靠人工建这些联结太累，所以要用**自动化机制 + AI 辅助**帮你连起来。

> An **object-oriented note app** — a bit like objects in code: each card is an object with many properties, belongs to a "class", and classes can inherit; objects link to each other (a *person* and *their school* are both objects, connected). Doing all that linking by hand is exhausting, so **automation + AI** help build the connections for you.

**真正想解决的问题**：当你积累了大量笔记，怎么**快速回忆起早已忘掉的那一条**，把知识的积累最大化利用起来。不只是知识——生活的回忆也算，帮你避免重复犯同样的错。因为人总是好了伤疤忘了疼。

> **The real problem it solves:** once you've piled up thousands of notes, how do you quickly recall the one you'd forgotten, and make the most of everything you've accumulated? Not just knowledge — life memories too, so you don't repeat the same mistakes. Because people forget the pain once the wound heals.

## 🤝 加入我们 · Join us

对**笔记软件 / 知识管理 / 数据主权**感兴趣，想写代码、聊设计或一起做，都欢迎。
Into **note apps / PKM / data ownership**? Code, design, or just build with us — welcome.

- 💬 [Issue](../../issues) / [Discussion](../../discussions)
- 🛠 Fork & PR
- 📱 微信 WeChat：**untitledstar**（备注 CardNote）

## 📄 License

**AGPL-3.0** — 可自由查看 / 学习 / 修改 / 自建，衍生（含在线服务）需保持开源。
Free to view / learn / modify / self-host; derivatives (incl. network services) stay open source.
