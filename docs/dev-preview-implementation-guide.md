# Worktree Dev Preview Implementation Guide

这份文档总结 Open Growth 当前采用的开发预览环境方案，目标是让另一个
Supabase + Web + API 项目可以按同一思路改造。

## 目标形态

开发环境提供一个完整的远程预览链路：

1. Web dev server，例如 Vite。
2. API dev server，例如 Fastify、Hono 或 Express。
3. 本机 Supabase CLI stack。
4. Cloudflare Tunnel 暴露的公网 HTTPS 域名。

核心原则：

- 每个 git worktree 拥有稳定的 slot、端口、Supabase instance 和 tunnel。
- Supabase container 保持常驻，`pnpm dev` 退出时不停止 Supabase。
- 每次 `pnpm dev` / `pnpm db:start` / `pnpm db:reset` 都执行数据库 reset，
  保证 migration 和 seed 会在干净数据库上重新生效。
- 主 checkout 可以直接 `pnpm dev`，首次运行时自动初始化。
- 额外 git worktree 必须显式执行 `pnpm worktree:init`，避免 slot 被静默抢占。
- 每个命令一个 script 文件，入口简单，通用逻辑放在共享模块中。

## 命令设计

推荐提供这些命令：

```bash
pnpm worktree:init
pnpm db:start
pnpm db:stop
pnpm db:reset
pnpm db:status
pnpm dev
pnpm worktree:clean
```

语义如下：

- `pnpm worktree:init`
  - 给当前 worktree 分配稳定 slot。
  - 分配稳定端口。
  - 写入 `.dev/worktree.json`。
  - 创建 `.dev/instances/<slot>/`。
  - 创建或复用 Cloudflare Tunnel。
  - Upsert DNS CNAME。
  - 生成 Supabase 和 cloudflared 配置。

- `pnpm db:start`
  - 读取 `.dev/worktree.json`。
  - 如果 Supabase 未启动，则启动当前 worktree 的 Supabase instance。
  - 如果 Supabase config 变了，则重启 Supabase。
  - 执行 `supabase db reset`。
  - 写入 `.env.dev.local`。

- `pnpm db:stop`
  - 停止当前 worktree 的 Supabase instance。
  - 使用 `supabase stop --no-backup`，因为 dev 数据是可丢弃的。

- `pnpm db:reset`
  - 如果 Supabase 未启动则先启动。
  - 执行 `supabase db reset`。
  - 刷新 `.env.dev.local`。

- `pnpm db:status`
  - 显示当前 worktree 的 Supabase status。

- `pnpm dev`
  - 主 checkout 缺少 `.dev/worktree.json` 时自动初始化。
  - 额外 git worktree 缺少 `.dev/worktree.json` 时提示运行
    `pnpm worktree:init`。
  - 启动或复用 Supabase。
  - 执行 `supabase db reset`。
  - 写入 `.env.dev.local`。
  - 启动 API、Web、cloudflared。
  - 用醒目颜色输出 Frontend URL 和 API URL。
  - 退出时只停止 API、Web、cloudflared，不停止 Supabase。

- `pnpm worktree:clean`
  - 停止 Supabase。
  - 删除 `.dev/instances/<slot>/`。
  - 删除 `.dev/worktree.json`。
  - 删除 `.env.dev.local`。
  - 释放 slot reservation。

## 文件组织

推荐结构：

```text
scripts/
  dev-workflow.ts       # 共享实现
  dev.ts                # pnpm dev 入口
  worktree-init.ts      # pnpm worktree:init 入口
  worktree-clean.ts     # pnpm worktree:clean 入口
  db-start.ts           # pnpm db:start 入口
  db-stop.ts            # pnpm db:stop 入口
  db-reset.ts           # pnpm db:reset 入口
  db-status.ts          # pnpm db:status 入口
```

`package.json`：

```json
{
  "scripts": {
    "dev": "tsx scripts/dev.ts",
    "worktree:init": "tsx scripts/worktree-init.ts",
    "worktree:clean": "tsx scripts/worktree-clean.ts",
    "db:start": "tsx scripts/db-start.ts",
    "db:stop": "tsx scripts/db-stop.ts",
    "db:reset": "tsx scripts/db-reset.ts",
    "db:status": "tsx scripts/db-status.ts"
  }
}
```

每个入口文件只做一件事，例如：

```ts
import { dbStart, stopChildProcesses } from "./dev-workflow.js";

try {
  dbStart();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  stopChildProcesses();
  process.exit(1);
}
```

## 环境文件

使用两类 dev env：

```text
.env.dev        人维护的稳定开发配置
.env.dev.local 运行时生成配置，不手动编辑
```

`.env.dev.example` 只保留稳定值：

```bash
# Copy this file to `.env.dev` at the repository root and fill in stable
# development-only values. Runtime values are generated into `.env.dev.local`.

PROJECT_DEV_DOMAIN_BASE=dev.example.com

# Optional. Defaults to the main slot plus a-f:
# PROJECT_DEV_SLOT_CANDIDATES=,a,b,c,d,e,f

# Optional. Set this only when you want to force one checkout to a specific slot.
# PROJECT_DEV_SLOT=a

# Optional prefix. The runner creates one Cloudflare tunnel per slot, with the
# machine hostname and slot appended to this prefix.
# PROJECT_DEV_TUNNEL_NAME_PREFIX=project-dev

# Cloudflare API token used to discover/create slot tunnels and upsert DNS.
# Required permissions:
# - Zone Read
# - DNS Write
# - Cloudflare Tunnel Read
# - Cloudflare Tunnel Write
CLOUDFLARE_API_TOKEN=

# Optional. The runner can derive these from the Cloudflare zone when possible.
# CLOUDFLARE_ACCOUNT_ID=
# CLOUDFLARE_ZONE_ID=

# Google OAuth for local Supabase Auth.
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=
```

`.env.dev.local` 由 runner 生成，典型内容：

```bash
PROJECT_DEV_SLOT="a"
PROJECT_DEV_PUBLIC_HOSTNAME="a-dev.example.com"
PROJECT_DEV_PUBLIC_ORIGIN="https://a-dev.example.com"
WEB_PORT="5174"
API_PORT="3002"
PORT="3002"
HOST="0.0.0.0"
SUPABASE_LOCAL_API_PORT="54331"
SUPABASE_URL="http://127.0.0.1:54331"
SUPABASE_SERVICE_ROLE_KEY="..."
VITE_SUPABASE_URL="https://a-dev.example.com"
VITE_SUPABASE_ANON_KEY="..."
PROJECT_DEV_CLOUDFLARE_TUNNEL_ID="..."
PROJECT_DEV_CLOUDFLARE_TUNNEL_NAME="..."
PROJECT_DEV_CLOUDFLARE_TUNNEL_CREDENTIALS_FILE="..."
PROJECT_DEV_SUPABASE_STUDIO_URL="http://127.0.0.1:54333"
PROJECT_DEV_SUPABASE_INBUCKET_URL="http://127.0.0.1:54334"
```

`.gitignore`：

```gitignore
.env*
!.env.dev.example
.dev/
```

## Worktree Identity

每个 worktree 有自己的身份文件：

```text
.dev/worktree.json
```

建议内容：

```json
{
  "version": 1,
  "workspaceRoot": "/repo-or-worktree",
  "slot": "a",
  "hostname": "a-dev.example.com",
  "publicOrigin": "https://a-dev.example.com",
  "projectId": "project-a-1234abcd",
  "instanceDir": "/repo-or-worktree/.dev/instances/a",
  "cloudflaredConfigPath": "/repo-or-worktree/.dev/instances/a/cloudflared.yml",
  "ports": {
    "web": 5174,
    "api": 3002,
    "supabaseApi": 54331,
    "supabaseDb": 54332,
    "supabaseShadow": 54330,
    "supabaseStudio": 54333,
    "supabaseInbucket": 54334,
    "supabaseSmtp": 54335,
    "supabasePop3": 54336
  },
  "tunnel": {
    "id": "...",
    "name": "project-dev-host-a",
    "credentialsFile": "/home/user/.cloudflared/<tunnel-id>.json"
  }
}
```

## Slot 和域名规则

默认 slot：

```text
main
a
b
c
d
e
f
```

如果 domain base 是：

```text
dev.example.com
```

则 hostname 应该是：

```text
dev.example.com
a-dev.example.com
b-dev.example.com
c-dev.example.com
```

不要使用 `a.dev.example.com`。原因是很多项目只有 `*.example.com` 证书，
它覆盖 `a-dev.example.com`，但不覆盖 `a.dev.example.com` 这种二级子域。

slot reservation 应该是机器级、长生命周期的，例如：

```text
~/.cache/<project-name>/dev-slots/
```

每个 slot 写一个 JSON 文件，记录：

- `workspaceRoot`
- `slot`
- `hostname`
- `publicOrigin`
- `projectId`
- `instanceDir`
- `ports`

`worktree:init` 时要清理 `workspaceRoot` 已不存在的 reservation。如果 slot
已满，直接报错，提示开发者清理旧 worktree。

## 主 Checkout 自动初始化

推荐规则：

- 当前路径等于 `git worktree list --porcelain` 里的第一个 worktree 时，视为主
  checkout。
- 主 checkout 执行 `pnpm dev` 时，如果没有 `.dev/worktree.json`，自动跑初始化。
- 额外 worktree 执行 `pnpm dev` 时，如果没有 `.dev/worktree.json`，报错提示
  `pnpm worktree:init`。

这样主目录保留一条命令启动体验，同时额外 worktree 的 slot 分配保持显式。

## Supabase Instance

每个 worktree 用一个独立 Supabase CLI workdir：

```text
.dev/instances/<slot>/
```

初始化或启动时：

1. 复制项目里的 Supabase 目录，例如 `packages/db/supabase/`。
2. Patch `supabase/config.toml`：
   - `project_id`
   - API port
   - DB port
   - shadow DB port
   - Studio port
   - Inbucket ports
   - Auth `site_url`
   - Auth `additional_redirect_urls`
   - Google OAuth callback URL
3. 运行 `supabase start --workdir <instanceDir>`。
4. 运行 `supabase db reset --workdir <instanceDir>`。
5. 通过 `supabase status --output json` 或普通 status 输出读取 anon key 和
   service role key。
6. 写入 `.env.dev.local`。

Supabase 启动策略：

- 已启动且 config 没变：复用。
- 未启动：启动。
- config 变了：`supabase stop --no-backup` 后重新启动。
- 每次 `pnpm dev` 和 `pnpm db:start` 都 reset DB。
- `pnpm dev` 退出不停止 Supabase。

## Cloudflare Tunnel

每个 slot 一个 tunnel，避免多个 worktree 共享 connector 时路由歧义。

tunnel name 建议：

```text
<PROJECT_DEV_TUNNEL_NAME_PREFIX>-<machine-hostname>-<slot>
```

流程：

1. 用 Cloudflare API 查找 zone。
2. 用 account ID 创建或复用 tunnel。
3. 将 tunnel credentials 写到 `~/.cloudflared/<tunnel-id>.json`。
4. 为 slot hostname upsert proxied CNAME：

```text
<slot-hostname> CNAME <tunnel-id>.cfargotunnel.com
```

如果已有非 CNAME 记录，runner 可以删除并替换为 CNAME；文档中要写清楚这个
行为。

## Cloudflared Routing

使用同源路由：

```text
https://slot-host/                 -> Web
https://slot-host/api/*            -> API
https://slot-host/auth/v1/*        -> Supabase Auth
https://slot-host/rest/v1/*        -> Supabase REST
https://slot-host/storage/v1/*     -> Supabase Storage
https://slot-host/realtime/v1/*    -> Supabase Realtime
https://slot-host/graphql/v1/*     -> Supabase GraphQL
```

cloudflared 的 `path` 是正则表达式，必须锚定。不要写 `/api/*`，它可能会误伤
前端模块路径，比如 `/src/ui/lib/api.ts`。

推荐配置：

```yaml
tunnel: <tunnel-id>
credentials-file: /home/user/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: a-dev.example.com
    path: "^/api(/.*)?$"
    service: http://127.0.0.1:3002
  - hostname: a-dev.example.com
    path: "^/auth/v1(/.*)?$"
    service: http://127.0.0.1:54331
  - hostname: a-dev.example.com
    path: "^/rest/v1(/.*)?$"
    service: http://127.0.0.1:54331
  - hostname: a-dev.example.com
    path: "^/storage/v1(/.*)?$"
    service: http://127.0.0.1:54331
  - hostname: a-dev.example.com
    path: "^/realtime/v1(/.*)?$"
    service: http://127.0.0.1:54331
  - hostname: a-dev.example.com
    path: "^/graphql/v1(/.*)?$"
    service: http://127.0.0.1:54331
  - hostname: a-dev.example.com
    service: http://127.0.0.1:5174
  - service: http_status:404
```

## Vite / Web 配置

Web dev server 要读取 `.env.dev.local` 里的动态端口和 host：

- `WEB_PORT` 或项目自己的 web port env。
- `HOST=0.0.0.0`，便于 tunnel 访问。
- `allowedHosts` 包含 slot hostname。
- HMR host 使用 slot hostname。
- HMR client port 使用 `443`。

浏览器侧 Supabase URL 使用公网同源：

```bash
VITE_SUPABASE_URL=https://a-dev.example.com
```

服务端 Supabase URL 使用本地：

```bash
SUPABASE_URL=http://127.0.0.1:<supabase-api-port>
```

## OAuth 配置

Google OAuth 需要显式登记每个 slot。以 `dev.example.com` 为例：

Authorized JavaScript origins：

```text
https://dev.example.com
https://a-dev.example.com
https://b-dev.example.com
https://c-dev.example.com
https://d-dev.example.com
https://e-dev.example.com
https://f-dev.example.com
```

Authorized redirect URIs：

```text
https://dev.example.com/auth/v1/callback
https://a-dev.example.com/auth/v1/callback
https://b-dev.example.com/auth/v1/callback
https://c-dev.example.com/auth/v1/callback
https://d-dev.example.com/auth/v1/callback
https://e-dev.example.com/auth/v1/callback
https://f-dev.example.com/auth/v1/callback
```

Google OAuth 不支持这个场景下的 wildcard redirect URI，所以要逐个添加。

## 运行时输出

`pnpm dev` 启动成功后，终端应该用醒目颜色输出至少这些信息：

```text
Frontend   https://dev.example.com
Local Web  http://127.0.0.1:5173
API        https://dev.example.com/api/health
Local API  http://127.0.0.1:3001/api/health
Supabase   http://127.0.0.1:54321
Studio     http://127.0.0.1:54323
```

这里 Frontend 和 API URL 最重要，要最显眼。

## 推荐落地顺序

1. 新增 `.env.dev.example`，移除开发预览对 `.env.example` 的依赖。
2. 更新 `.gitignore`，忽略 `.env.dev`、`.env.dev.local`、`.dev/`。
3. 新增 shared workflow module，例如 `scripts/dev-workflow.ts`。
4. 新增每个命令自己的入口 script。
5. 实现 slot selection 和 machine-global reservation。
6. 实现 `.dev/worktree.json`。
7. 实现端口分配和持久化。
8. 实现 Supabase instance 复制、config patch、start、reset、status key 读取。
9. 实现 Cloudflare tunnel create/reuse 和 DNS upsert。
10. 实现 cloudflared ingress config，注意 path regex 锚定。
11. 更新 Web dev server 配置，支持动态端口、allowed host、HMR host。
12. 更新 API env loading，让 API 从 `.env.dev.local` 读取运行时配置。
13. 更新 README、development docs 和 ADR。
14. 跑 `pnpm dev`，验证：
    - public frontend 可以打开。
    - `/api/health` 可访问。
    - `/auth/v1/health` 可访问。
    - 前端源码路径没有被 `/api` tunnel rule 误匹配。
    - Google OAuth callback hostname 正确。

## 常见坑

- 不要把端口写进 `.env.dev`。端口应该由 runner 自动分配并写入
  `.env.dev.local`。
- 不要让 slot 跟进程生命周期绑定。slot 应该跟 worktree 生命周期绑定。
- 不要在 `pnpm dev` 退出时停止 Supabase，否则远程开发循环会很慢。
- 不要用 `a.dev.example.com`，如果证书只有 `*.example.com`，它不会覆盖二级子域。
- 不要使用 unanchored cloudflared path，例如 `/api/*`。
- 不要把 Supabase service role key 暴露给浏览器，只写给 API/server runtime。
- 不要让多个 worktree 共享同一个 Supabase project ID 或 DB port。
- Google OAuth secret 改了之后要重启 Supabase，不只是 reset DB。

## Open Growth 对应文件

当前项目里的实现可以参考这些文件：

- `scripts/dev-workflow.ts`
- `scripts/dev.ts`
- `scripts/worktree-init.ts`
- `scripts/worktree-clean.ts`
- `scripts/db-start.ts`
- `scripts/db-stop.ts`
- `scripts/db-reset.ts`
- `scripts/db-status.ts`
- `.env.dev.example`
- `apps/web/vite.config.ts`
- `packages/db/supabase/config.toml`
- `docs/dev-preview-workflow.md`
- `docs/adr/0005-adopt-remote-development-preview-workflow.md`
