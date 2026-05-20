<h1 align="center">
  <strong>OpenGrowth</strong>
</h1>

<p align="center">
  <strong>An open workspace for social media operations and growth workflows.</strong>
</p>

<p align="center">
  Organize campaign assets, manage workspace projects, and prepare the foundation for publishing, tracking, and trend research in one place.
</p>

<p align="center">
  <a href="./README.zh-CN.md">中文文档</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-149ECA?style=flat&logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/Vite-6-7C3AED?style=flat&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Fastify-5-000000?style=flat&logo=fastify&logoColor=white" alt="Fastify">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat" alt="License">
</p>

---

## Overview

Open Growth is an open-source workspace for content operations. The current product focuses on project-based asset management: creating workspace projects, switching between them, and storing the images, videos, and text references needed for growth campaigns.

The broader workflow surface is already mapped out in the app, with dedicated entry points for publishing, tracking, and trends so the repository can grow into a full operations console over time.

## Current Capabilities

| Module | Description | Status |
|------|------|------|
| **Content Repository** | Upload, preview, and delete image, video, and text assets | Available |
| **Workspace Projects** | Create projects, switch active projects, and isolate content directories | Available |
| **Publish** | Reserved route for publishing workflows | Placeholder |
| **Tracking** | Reserved route for analytics and tracking workflows | Placeholder |
| **Trends** | Reserved route for trend research workflows | Placeholder |

## Architecture

```text
open-growth/
├─ apps/
│  ├─ web/          React 19 + Vite workspace UI
│  └─ api/          Fastify API and static asset server
├─ packages/
│  └─ shared/       Shared types used by web and api
└─ README.md
```

- Frontend: React 19, React Router 7, Vite 6
- Backend: Fastify 5 with multipart uploads, static serving, and CORS
- Shared layer: `packages/shared`
- Tooling: TypeScript, Biome, Vitest

## Development Preview

```bash
npm install
cp .env.dev.example .env.dev
pnpm dev
```

In the main checkout, `pnpm dev` initializes the stable hostname slot, ports, instance directory, and Cloudflare Tunnel automatically. In secondary git worktrees, run `pnpm worktree:init` once before `pnpm dev`. Non-main slots use hyphenated hostnames such as `a-dev.opengrowth.com`.

For local-only debugging without a public tunnel:

```bash
npm run dev:local
```

Useful commands:

```bash
npm run build
npm run start
npm run dev:local
npm run db:start
npm run db:stop
npm run db:reset
npm run db:status
npm run lint
npm run typecheck
npm run test
```

## Workspace Storage

- Workspace project metadata is stored under `~/.open-growth/`
- The active project's assets are stored in that project's `content/` directory
- When no project is active, the app falls back to the default content directory

## Contributing

Started by [Haichao](https://github.com/Mine77). Issues and pull requests are welcome.

## License

MIT © 2026 [Mine77](https://github.com/Mine77)
