# Open Growth

Vite + React 前端，Fastify 后端，`packages/shared` 放共享类型。

## 目录

```text
open-growth/
├─ apps/
│  ├─ web/    # 前端
│  └─ api/    # 后端
├─ packages/
│  └─ shared/ # 共享类型
└─ README.md
```

## 启动

```bash
npm install
npm run dev
```

- 前端: `http://localhost:5173`
- 后端: `http://localhost:3001`

## 构建

```bash
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

## 说明

- 前端在 `apps/web`
- 后端在 `apps/api`
- 共享类型在 `packages/shared`
- lint/format 用 `Biome`
- 单元/集成测试用 `Vitest`
- E2E 用 `Playwright`
