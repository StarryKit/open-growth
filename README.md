# 🚀 Open Growth

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat&logo=tailwindcss" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat" alt="License">
</p>

**社交媒体运营与推广工具集** — 数据驱动的内容增长引擎。

Open Growth 是一套面向社交媒体创作者和营销人员的开源工具集，帮助你自动化内容生产、数据分析、跨平台分发和增长策略执行。

---

## 🎯 功能规划

| 模块 | 描述 | 状态 |
|------|------|------|
| **Dashboard** | 统一管理面板，概览所有社交账号数据 | 🚧 规划中 |
| **Content Engine** | AI 辅助内容生成，多平台格式适配 | 🚧 规划中 |
| **Analytics** | 跨平台数据聚合与洞察 | 🚧 规划中 |
| **Scheduler** | 智能发布时间优化与排期 | 🚧 规划中 |
| **Growth Hacks** | 增长策略库与 A/B 测试工具 | 🚧 规划中 |

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────┐
│              Open Growth                 │
├─────────────────┬───────────────────────┤
│   Frontend      │      Backend          │
│   (Next.js)     │   (OpenCLI + Agent)   │
├─────────────────┼───────────────────────┤
│  • Dashboard    │  • Data Fetchers      │
│  • Analytics    │  • Content Pipeline   │
│  • Scheduler    │  • Platform APIs      │
└─────────────────┴───────────────────────┘
```

- **前端**: Next.js 16 + TypeScript + Tailwind CSS 4
- **后端**: [OpenCLI](https://github.com/jackwener/opencli) + Hermes Agent
- **部署**: Nginx 反代 + Let's Encrypt SSL

---

## 🚀 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm run start
```

访问 [http://localhost:3000](http://localhost:3000) 查看开发中的界面。

---

## 📦 项目结构

```
open-growth/
├── src/
│   ├── app/          # Next.js App Router 页面
│   ├── components/   # 可复用 UI 组件
│   └── lib/          # 工具函数 & API 客户端
├── public/           # 静态资源
├── scripts/          # OpenCLI 脚本 & 自动化
└── config/           # 配置文件
```

---

## 🤝 贡献

本项目由 [Haichao](https://github.com/Mine77) 发起，欢迎提交 Issue 和 PR。

---

## 📄 许可证

MIT © 2026 [Mine77](https://github.com/Mine77)
