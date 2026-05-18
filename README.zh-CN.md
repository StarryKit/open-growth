# Open Growth

<p align="center">
  <strong>一个面向社交媒体运营与增长流程的开源工作区。</strong>
</p>

<p align="center">
  在一个地方整理活动素材、管理工作区项目，并为发布、追踪与趋势研究工作流打好基础。
</p>

<p align="center">
  <a href="./README.md">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-149ECA?style=flat&logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/Vite-6-7C3AED?style=flat&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Fastify-5-000000?style=flat&logo=fastify&logoColor=white" alt="Fastify">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat" alt="License">
</p>

---

## 项目简介

Open Growth 是一个面向内容运营场景的开源工作区。当前版本聚焦于按项目管理素材：你可以创建工作区项目、切换当前项目，并整理增长活动所需的图片、视频和文本参考资料。

应用里也已经预留了发布、追踪和趋势研究等入口，因此这个仓库可以继续演进为一个更完整的运营控制台。

## 当前能力

| 模块 | 描述 | 状态 |
|------|------|------|
| **Content Repository** | 上传、预览、删除图片、视频与文本素材 | 已提供 |
| **Workspace Projects** | 创建项目、切换当前项目、隔离素材目录 | 已提供 |
| **Publish** | 为发布工作流预留的页面入口 | 占位中 |
| **Tracking** | 为数据分析与追踪工作流预留的页面入口 | 占位中 |
| **Trends** | 为趋势研究工作流预留的页面入口 | 占位中 |

## 技术架构

```text
open-growth/
├─ apps/
│  ├─ web/          React 19 + Vite 前端工作台
│  └─ api/          Fastify API 与静态资源服务
├─ packages/
│  └─ shared/       前后端共享类型
└─ README.md
```

- 前端: React 19、React Router 7、Vite 6
- 后端: Fastify 5，支持 multipart 上传、静态资源服务与 CORS
- 共享层: `packages/shared`
- 工程化: TypeScript、Biome、Vitest、Playwright

## 本地开发

```bash
npm install
npm run dev
```

- 前端地址: `http://localhost:5173`
- 后端地址: `http://localhost:3001`

常用命令:

```bash
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

## 工作区存储

- 工作区项目元数据默认存放在 `~/.open-growth/`
- 当前激活项目的素材会保存在该项目目录下的 `content/`
- 当没有激活项目时，应用会回退到默认内容目录

## 参与贡献

本项目由 [Haichao](https://github.com/Mine77) 发起，欢迎提交 Issue 和 Pull Request。

## 许可证

MIT © 2026 [Mine77](https://github.com/Mine77)
