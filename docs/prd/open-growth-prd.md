# Open Growth 产品需求文档（PRD）

日期：2026-05-16

## 1. 背景与目标

Open Growth 是一个面向社交媒体运营与增长流程的开源工作区。当前版本已经具备 Workspace Project 管理、Content Repository 素材上传/预览/删除能力，并在 UI 中预留了 Publish、Tracking、Trends 三个工作流入口。

本 PRD 定义 Open Growth 的目标产品形态：围绕 Workspace，在多个 Project 中完成内容管理、内容发布、已发布内容 Engagement 追踪，以及面向全网的项目相关帖子发现与响应。

### 1.1 目标用户

- 独立开发者、创业团队、开源项目维护者。
- 负责产品增长、社区运营、内容分发的运营人员。
- 需要持续在 X、Reddit、Hacker News、小红书、微信等平台寻找相关讨论并参与互动的项目团队。

### 1.2 核心问题

用户目前往往需要在本地文件夹、社交平台后台、表格、监控工具之间切换，才能完成一条内容从素材整理、发布、效果追踪到趋势响应的闭环。这个流程分散、上下文容易丢失，也难以沉淀可复用的增长资产。

### 1.3 产品目标

1. 在一个 Workspace 中按 Project 隔离管理增长工作。
2. 把原始 Content asset 转化为可编辑、可发布、可追踪的 Published content。
3. 支持多平台内容发布工作流，从草稿、排期、发布到失败重试形成可审计记录。
4. 针对已发布内容持续拉取 Engagement 指标，让用户知道哪些内容有效。
5. 通过 Trends 功能检索全网与 Project 相关的帖子，帮助用户发现参与讨论和推广项目的机会。

## 2. 技术架构

### 2.1 当前架构基线

仓库遵循现有 ADR-0001 中记录的架构：

- `apps/web`：React 19 + Vite 前端工作台，使用 React Router 管理 Dashboard、Repository、Publish、Tracking、Trends 页面。
- `apps/api`：Fastify 5 API 与静态资源服务，当前提供项目管理、素材上传、素材列表、素材下载、素材删除接口。
- `packages/shared`：前后端共享类型与领域对象。
- 工程化：TypeScript、Biome、Vitest、Playwright。
- 存储：当前代码仍将项目元数据写入 API 进程工作目录下的 `data/`，项目素材写入 `~/.open-growth/<project>/content/`；目标版本必须迁移为数据库持久化，不能继续以纯文件存储保存用户数据。

### 2.2 目标架构

目标架构继续保持现有 monorepo 分层，不引入新的前端框架或后端框架。

```text
open-growth/
├─ apps/
│  ├─ web/                    React + Vite 工作台
│  │  ├─ src/ui/pages/         Repository、Publish、Tracking、Trends 页面
│  │  ├─ src/components/       工作台组件、表格、编辑器、连接器控件
│  │  └─ src/state/            Workspace、Project、发布状态与筛选状态
│  └─ api/                    Fastify API
│     ├─ src/lib/              Project、Content、Publishing、Tracking、Trends 深模块
│     └─ src/app.ts            API 路由组合
├─ packages/
│  └─ shared/                 共享类型、枚举、API DTO
├─ supabase/
│  ├─ migrations/             Supabase Postgres schema migration
│  └─ seed.sql                本地开发种子数据
└─ docs/
   ├─ adr/                    架构决策记录
   └─ prd/                    产品需求文档
```

### 2.3 后端模块划分

1. `project-store`
   - 继续负责 Workspace Project 列表、激活项目、项目根目录。
   - 后续应抽象为统一的 Project-scoped storage，避免各业务模块自行拼路径。

2. `content-server`
   - 继续负责 Content asset 的文件保存、读取、列表、删除。
   - 扩展支持标签、描述、来源、关联草稿、使用状态等元数据。

3. `database-store`
   - 新增模块，作为所有用户数据的持久化入口。
   - 保存 Workspace、Project、Content asset 元数据、Published content、Engagement 快照、TrendQuery、TrendPost、连接器授权引用和任务状态。
   - 直接使用 Supabase Postgres，不设计 SQLite 过渡阶段。
   - 所有用户可见数据必须能通过 `workspace_id` 或 `project_id` 追溯到 Workspace，并通过 `workspace_members` 判断访问权限。
   - Project 级数据必须包含 `project_id`。

4. `media-storage`
   - 新增模块，负责多媒体二进制数据的保存、读取、删除和流式输出。
   - 默认使用 Supabase Storage 保存图片、视频、附件等多媒体文件。
   - Supabase Postgres 保存媒体元数据、校验和、大小、MIME 类型、Storage bucket、Storage object path 和访问策略。
   - 不建议将视频和大图片直接作为 Postgres BLOB 保存；小型文本或缩略图可按需入库，但不能作为主媒体存储方案。

5. `auth-service`
   - 新增模块，负责 Supabase Auth 会话校验、用户身份解析、API 请求鉴权。
   - 前端通过 Supabase Auth 完成登录、注册、登出和 session refresh。
   - 后端 Fastify API 校验 Supabase JWT，并将 `user_id` 注入业务上下文。

6. `published-content-store`
   - 新增模块，保存 Published content、平台发布记录、发布状态、排期时间、平台 URL、错误信息。
   - 对外提供创建草稿、更新草稿、排期、标记发布成功/失败、查询列表、查询详情等接口。

7. `connector-service`
   - 新增模块，封装 X、Reddit、Hacker News、小红书、微信等平台连接器。
   - 对发布、追踪、趋势三个功能暴露统一接口，平台差异留在 connector 内部。

8. `engagement-tracker`
   - 新增模块，针对 Published content 拉取平台 Engagement 指标。
   - 保存指标快照，支持聚合统计、趋势变化、失败重试。

9. `trends-search`
   - 新增模块，基于 Project 关键词、品牌词、竞品词和自定义查询进行全网检索。
   - 返回候选帖子，支持去重、相关性评分、收藏、忽略、转为待响应任务。

### 2.4 前端页面划分

1. Content Repository
   - 作为内容资产入口，管理图片、视频、文本、链接和素材元数据。

2. Publish
   - 作为内容生产与分发入口，管理草稿、平台适配、排期、发布历史。

3. Tracking
   - 作为已发布内容效果分析入口，展示 Engagement 指标、平台表现、内容表现。

4. Trends
   - 作为外部机会发现入口，检索与 Project 相关的全网帖子，并管理响应状态。

### 2.5 数据存储策略

后端不能使用纯文件存储保存用户数据。目标版本直接使用 Supabase：Supabase Postgres 作为结构化用户数据的唯一事实来源，Supabase Auth 作为用户认证系统，Supabase Storage 作为多媒体文件存储。

推荐路径：

1. Supabase Postgres
   - 保存对象：UserProfile、Workspace、WorkspaceMember、Project、ContentAsset、PublishedContent、PlatformPublishTarget、EngagementSnapshot、TrendQuery、TrendPost、TrendRun、ConnectorAccount、Job。
   - 使用 migration 管理 schema，禁止手工漂移。
   - 使用 Row Level Security 限制用户只能访问自己所属 Workspace 和 Project 的数据。

2. Supabase Auth
   - 负责用户注册、登录、登出、session refresh。
   - 至少支持 email/password 登录；后续可扩展 OAuth provider。
   - 所有 API 请求必须携带 Supabase access token，后端验证后再访问业务数据。

3. Supabase Storage
   - 保存图片、视频、附件等多媒体二进制。
   - Storage object path 应包含 `workspace_id/project_id/asset_id`，方便权限管理、清理和迁移。
   - Postgres 的 `content_assets` 表保存 bucket、object path、MIME 类型、文件大小、sha256、原始文件名、预览信息和业务元数据。

4. 可选 Postgres BLOB
   - 小型文本、生成缩略图、低频访问的小型二进制可以按需保存为 Postgres BLOB。
   - 视频和大图片不作为 BLOB 主方案，避免数据库膨胀、备份变慢、查询性能下降。

### 2.5.1 目标数据模型

项目规模不大，因此数据模型一次性规划到目标形态，避免后续在权限、趋势执行历史、异步副作用和一致性上返工。设计原则是：表可以适度完整，但每张表必须对应独立业务事实，避免一对一无意义拆表。

- `profiles`
  - Supabase Auth 用户的业务侧资料表。
  - 字段包含 `user_id`、`display_name`、`avatar_url`、`created_at`、`updated_at`。
  - 不保存密码、密码哈希或 Supabase Auth 已负责的认证字段。

- `workspaces`
  - Workspace 主表。
  - 字段包含 `id`、`name`、`created_by`、`created_at`、`updated_at`。

- `workspace_members`
  - Workspace membership 与权限表。
  - 即使当前只开放 owner，也为每个 Workspace 插入一条 owner membership。
  - 字段包含 `workspace_id`、`user_id`、`role`、`created_at`。
  - RLS 统一基于 membership 判断访问权限，后续支持团队协作时不需要重写权限模型。

- `projects`
  - Project 主表。
  - 字段包含 `workspace_id`、`name`、`description`、`created_by`、`created_at`、`updated_at`。
  - Project 级数据统一通过 `project_id` 关联。

- `content_assets`
  - Content asset 主表，同时保存 Supabase Storage 引用。
  - 一条素材对应一个主 Storage object，不单独拆 `media_objects`。
  - 字段包含 `project_id`、`storage_bucket`、`storage_path`、`mime_type`、`byte_size`、`sha256`、`original_filename`、`title`、`description`、`tags`、`status`、`created_by`、`created_at`、`updated_at`。

- `published_contents`
  - Published content 主表，保存草稿和内容主体。
  - 字段包含 `project_id`、`title`、`body`、`asset_ids`、`source_trend_post_id`、`status`、`created_by`、`created_at`、`updated_at`。

- `platform_publish_targets`
  - 一条 Published content 对一个平台的发布目标。
  - 字段包含 `published_content_id`、`platform`、`status`、`body_override`、`scheduled_at`、`published_at`、`platform_content_id`、`platform_url`、`last_error`、`retry_count`、`updated_at`。

- `engagement_snapshots`
  - Engagement 指标快照表，只追加不覆盖。
  - 字段包含 `platform_publish_target_id`、`captured_at`、`metrics`、`platform_metrics`、`raw_payload`。

- `trend_queries`
  - Trends 检索配置。
  - 字段包含 `project_id`、`name`、`keywords`、`excluded_keywords`、`platforms`、`language`、`time_range`、`created_by`、`created_at`、`updated_at`。

- `trend_runs`
  - Trends 检索执行历史。
  - 每次执行 TrendQuery 都创建一条 run，用于记录执行参数、平台成功/失败、结果数量和错误摘要。
  - 字段包含 `trend_query_id`、`status`、`started_at`、`finished_at`、`platforms`、`result_count`、`error_summary`。

- `trend_posts`
  - Trends 检索结果与处理状态。
  - 字段包含 `project_id`、`trend_query_id`、`trend_run_id`、`platform`、`platform_post_id`、`url`、`title`、`summary`、`author`、`posted_at`、`metrics`、`relevance_score`、`status`、`created_at`、`updated_at`。
  - 对 `platform + platform_post_id` 或规范化 URL 建唯一约束，避免重复帖子污染结果。

- `connector_accounts`
  - 平台连接器授权引用。
  - 字段包含 `workspace_id`、`user_id`、`platform`、`status`、`credential_ref`、`expires_at`、`created_at`、`updated_at`。
  - 凭据密文或 secret 引用只允许服务端访问，不能暴露给前端。

- `outbox_events`
  - 异步副作用与跨系统一致性表。
  - 用于发布到外部平台、删除 Supabase Storage object、刷新 Engagement、运行 Trends 检索等副作用。
  - 字段包含 `event_type`、`aggregate_type`、`aggregate_id`、`payload`、`status`、`attempts`、`idempotency_key`、`available_at`、`last_error`、`created_at`、`updated_at`。
  - 业务事务与 outbox 写入必须在同一个 Postgres transaction 中提交。

### 2.5.2 原子性原则

Postgres 内部的结构化数据变更必须使用强事务。凡是会产生外部副作用的动作，都必须通过 `outbox_events` 建立可恢复的一致性边界，而不是在业务请求里直接假设外部调用一定成功。

强原子事务：

- 创建 Workspace：写入 `workspaces`、`workspace_members` owner 记录，必须同事务完成。
- 创建 Project：写入 `projects` 和必要默认配置，必须同事务完成。
- 创建/更新 Published content：写入 `published_contents` 与 `platform_publish_targets`，必须同事务完成。
- 排期或触发发布：更新 `platform_publish_targets` 状态，并写入 `outbox_events`，必须同事务完成。
- Engagement 刷新请求：写入 `outbox_events`，并更新目标内容刷新状态，必须同事务完成。
- Trends 检索请求：创建 `trend_runs`，写入 `outbox_events`，必须同事务完成。
- 从 TrendPost 创建响应草稿：更新 `trend_posts.status` 并写入 `published_contents`，必须同事务完成。

跨 Supabase Storage 的一致性流程：

1. 创建 Content asset 时，Postgres 插入 `content_assets`，状态为 `uploading`。
2. 前端或后端上传文件到 Supabase Storage，路径使用 `workspace_id/project_id/asset_id/original_filename`。
3. 上传成功后，后端校验 Storage object，更新 `content_assets` 为 `ready`，并写入 `storage_bucket`、`storage_path`、`byte_size`、`sha256`。
4. 如果上传失败，将 `content_assets` 标记为 `failed`，允许用户重试或清理。
5. 删除 Content asset 时，Postgres 先将状态标记为 `deleting`，并同事务写入 `outbox_events` 的 Storage 删除事件。
6. outbox worker 删除 Storage object 后，再将 `content_assets` 标记为 `deleted`。
7. Storage 删除失败时，outbox 记录错误并重试，用户界面展示 `delete_failed` 或待重试状态。

跨外部平台的一致性流程：

1. 用户发布内容时，Postgres 同事务更新 `platform_publish_targets.status = publishing` 并写入 publish outbox event。
2. outbox worker 调用平台 connector。
3. 平台发布成功后，更新 `platform_publish_targets.status = published`，写入平台内容 ID、URL 和发布时间。
4. 平台发布失败后，更新 `platform_publish_targets.status = failed`，写入错误和 retry count。
5. 所有 outbox worker 必须使用 `idempotency_key`，避免重复发布或重复删除。

因此，本 PRD 不要求视频和大图片以 Postgres BLOB 存储。结构化数据在 Postgres 中强原子；媒体与外部平台副作用通过 outbox、状态机、幂等 key 和补偿动作保证可观察、可重试、可恢复的一致性。

权限原则：

- 所有 Project 级表都必须包含 `project_id`。
- 所有用户可见数据都必须能追溯到 `workspace_id` 或 `user_id`。
- RLS policy 必须保证用户只能访问自己创建或被授权加入的 Workspace。
- 后端 service role key 只能存在服务端环境变量中，不能暴露给前端。

### 2.6 用户认证与权限模型

目标版本使用 Supabase Auth 作为唯一用户认证系统。Open Growth 不自建密码系统，不在业务数据库中保存密码哈希。

核心流程：

1. 前端登录
   - 用户通过 Supabase Auth 登录。
   - 前端保存 Supabase session，并在调用 Fastify API 时附带 access token。

2. 后端鉴权
   - Fastify API 从 `Authorization: Bearer <token>` 中读取 Supabase JWT。
   - 后端校验 token 后得到 `user_id`。
   - 所有 Project、Content、Publish、Tracking、Trends 请求都必须带上已认证用户上下文。

3. Workspace 权限
   - 每个用户默认拥有一个 Workspace。
   - `workspace_members` 保存用户与 Workspace 的关系。
   - 当前产品只需要 owner role，但 RLS 和 schema 统一通过 membership 判断权限。
   - 后续增加 admin/member role 时，不需要改写 Project、Content、Publish、Tracking、Trends 的权限边界。

4. RLS 策略
   - Supabase Postgres 中所有用户数据表必须开启 RLS。
   - 用户只能读取和修改自己在 `workspace_members` 中有权限的 Workspace 及其 Project 数据。
   - Storage bucket policy 必须与 Workspace membership 对齐，避免用户通过 object path 越权读取媒体文件。

### 2.7 连接器原则

连接器是发布、追踪、趋势三个模块共用的深模块，必须提供稳定接口：

- `publishContent(input)`：发布或排期内容。
- `getPublishStatus(platformContentId)`：查询发布状态。
- `fetchEngagement(platformContentId)`：拉取已发布内容的 Engagement 指标。
- `searchTrends(query)`：检索外部帖子。
- `getPostDetail(platformPostId)`：拉取帖子详情。

连接器需要处理认证、限流、平台字段映射、错误归一化和重试策略。业务层不直接依赖平台 SDK 的原始返回结构。

## 3. 功能总览

| 功能板块 | 核心价值 | 当前状态 | 目标能力 |
| --- | --- | --- | --- |
| 内容管理 | 管理 Project 内的增长素材 | 已支持文件上传、预览、删除 | 扩展为素材库、标签、搜索、草稿关联 |
| 内容发布 | 将素材和文案发布到目标平台 | 页面占位 | 支持草稿、平台适配、排期、发布记录 |
| Engagement 追踪 | 追踪已发布内容的互动表现 | 页面占位 | 拉取、存储、展示已发布内容指标 |
| Trending 功能 | 发现全网相关帖子和推广机会 | 页面占位 | 支持关键词配置、平台检索、相关性筛选、响应状态管理 |

## 4. 功能需求与实现方案

## 4.1 内容管理

### 4.1.1 功能目标

内容管理负责沉淀 Project 内所有可复用增长资产。用户可以上传、整理、搜索、预览、删除素材，并把素材转化为发布草稿。

### 4.1.2 功能点

1. Project-scoped 素材库
   - 用户在不同 Project 之间切换时，只看到当前 Project 的 Content asset。
   - 当前代码已通过 active project 的 `content/` 目录实现基础隔离；目标版本应迁移为数据库中的 `project_id` 隔离。

2. 素材上传
   - 支持 PNG、JPG、GIF、WebP、SVG、MP4、WebM、TXT、MD、JSON。
   - 支持拖拽上传和文件选择上传。
   - 上传时进行文件名清洗、同名文件自动重命名、类型校验。

3. 素材预览
   - 图片显示缩略图。
   - 视频显示视频占位与文件名，后续可扩展为内嵌播放器。
   - 文本显示前若干行预览。

4. 素材元数据
   - 每个 Content asset 应包含文件名、类型、大小、更新时间、预览信息。
   - 后续扩展字段：标题、描述、标签、来源、适用平台、关联 Project、关联 Published content、使用次数。

5. 素材搜索与筛选
   - 按类型筛选：图片、视频、文本。
   - 按标签筛选。
   - 按文件名、描述、文本预览搜索。
   - 按更新时间、大小、使用次数排序。

6. 素材删除
   - 删除前提示用户确认。
   - 若素材已被 Published content 引用，应提示影响范围。
   - 可以允许删除，但保留 Published content 中的引用快照，避免历史记录完全丢失。

7. 从素材创建草稿
   - 用户可以选择一个或多个素材创建 Published content 草稿。
   - 创建草稿时保留素材引用、默认标题、初始文案。

### 4.1.3 实现方案

后端继续复用现有 `/api/upload` 行为作为迁移起点，但不再把用户数据长期写入普通文件。目标版本应调整命名并演进为 `/api/content-assets`，由 `database-store` 保存 Supabase Postgres 元数据，由 `media-storage` 将多媒体写入 Supabase Storage：

- `GET /api/content-assets`：返回当前 active project 的素材列表。
- `POST /api/content-assets`：上传素材。
- `GET /api/content-assets/:id/blob`：读取素材二进制，后端可返回 Supabase Storage signed URL 或代理流式输出。
- `PATCH /api/content-assets/:id`：更新标题、描述、标签等元数据。
- `DELETE /api/content-assets/:id`：删除素材和元数据。

共享类型新增或扩展：

- `ContentAsset`
- `ContentAssetKind`
- `ContentAssetMetadata`
- `ContentAssetUsage`

前端在 Repository 页面增加：

- 搜索框。
- 类型筛选。
- 标签筛选。
- 素材详情侧栏。
- “Create draft” 操作。

测试重点：

- 文件名清洗、MIME 类型识别、内容哈希与重复上传处理。
- Project 切换后的素材隔离。
- 上传、列表、删除 API 行为。
- 数据一致性：Postgres 元数据与 Supabase Storage object 创建/删除失败时必须有补偿或清理机制。
- 文本预览长度与异常文件处理。

## 4.2 内容发布

### 4.2.1 功能目标

内容发布负责将 Project 中的 Content asset 与文案组织为 Published content，并发布到一个或多个平台。它需要覆盖草稿、平台适配、排期、发布、失败重试和发布历史。

### 4.2.2 功能点

1. 发布草稿管理
   - 创建、编辑、复制、删除草稿。
   - 草稿包含标题、正文、关联素材、目标平台、状态、创建时间、更新时间。
   - 状态包括：draft、scheduled、publishing、published、failed、cancelled。

2. 平台选择
   - 连接器目标：X、Reddit、Hacker News、小红书、微信。
   - 用户可以为同一个草稿选择一个或多个平台。
   - 每个平台显示连接状态、授权提示和能力限制。

3. 平台适配
   - 不同平台有不同的字数、媒体数量、标题/正文格式限制。
   - UI 应提供平台级编辑区域，支持从主文案复制并微调。
   - 平台适配规则由共享类型或 connector metadata 提供。

4. 排期发布
   - 用户可以立即发布或选择未来时间发布。
   - 排期任务由 outbox worker 或定时任务扫描 `platform_publish_targets` 执行。
   - worker 重启后应扫描 scheduled 内容并恢复可执行任务。

5. 发布执行
   - 发布请求进入后端，由 connector-service 调用目标平台。
   - 发布成功后保存平台内容 ID、URL、发布时间。
   - 发布失败后保存错误信息、失败时间、可重试标记。

6. 发布历史
   - 用户可以查看所有 Published content。
   - 支持按平台、状态、发布时间筛选。
   - 发布记录应能跳转到 Tracking 查看效果。

7. 失败重试
   - 对 failed 状态的发布记录提供重试。
   - 重试前允许用户修改内容或平台适配。
   - 每次尝试应保存 attempt 记录，便于审计。

### 4.2.3 实现方案

新增 `published-content-store` 模块，按 Project 保存发布数据。建议领域模型：

- `PublishedContent`
  - `id`
  - `projectId`
  - `title`
  - `body`
  - `assetIds`
  - `status`
  - `platformTargets`
  - `createdAt`
  - `updatedAt`

- `PlatformPublishTarget`
  - `platform`
  - `status`
  - `bodyOverride`
  - `scheduledAt`
  - `publishedAt`
  - `platformContentId`
  - `platformUrl`
  - `lastError`
  - `attempts`

API 建议：

- `GET /api/published-content`
- `POST /api/published-content`
- `GET /api/published-content/:id`
- `PATCH /api/published-content/:id`
- `DELETE /api/published-content/:id`
- `POST /api/published-content/:id/publish`
- `POST /api/published-content/:id/schedule`
- `POST /api/published-content/:id/retry`

前端 Publish 页面从占位页升级为工作台：

- 左侧：草稿/发布记录列表。
- 中间：内容编辑器。
- 右侧：平台适配、校验结果、发布设置。
- 顶部：状态筛选、平台筛选、创建草稿按钮。

测试重点：

- 草稿状态流转。
- 平台校验规则。
- 发布成功与失败记录。
- 排期任务恢复。
- connector 错误归一化。

## 4.3 Engagement 追踪

### 4.3.1 功能目标

Engagement 追踪负责针对已发布内容拉取互动数据，让用户知道哪些内容、平台、时间窗口带来了更好的增长效果。

### 4.3.2 功能点

1. 已发布内容列表
   - 只追踪 published 状态的 PlatformPublishTarget。
   - 显示标题、平台、发布时间、URL、最近更新时间、核心指标。

2. Engagement 指标
   - 通用指标：views、likes、comments、shares、bookmarks、clicks。
   - 平台特定指标通过 `platformMetrics` 扩展保存。
   - 指标必须记录采集时间，形成时间序列快照。

3. 手动刷新
   - 用户可以对单条内容刷新指标。
   - 用户可以对当前 Project 全部已发布内容批量刷新。

4. 自动刷新
   - 自动刷新由 outbox worker 或定时任务调度。
   - 默认对发布后 24 小时内的内容更频繁刷新，对较旧内容降低刷新频率。

5. 数据概览
   - Project 级总览：总曝光、总互动、平均互动率、表现最佳平台。
   - 内容级榜单：最高 views、最高 engagement rate、最近增长最快。
   - 平台级对比：各平台发布数量、互动总量、平均表现。

6. 内容详情
   - 展示单条 Published content 的指标趋势。
   - 展示平台 URL、发布文案、关联素材、历史快照。

7. 异常状态
   - 如果平台授权失效、内容被删除、接口限流，应展示明确状态。
   - 指标刷新失败不能覆盖上一份成功数据。

### 4.3.3 实现方案

新增 `engagement-tracker` 模块，依赖 `published-content-store` 和 `connector-service`。

领域模型：

- `EngagementSnapshot`
  - `id`
  - `projectId`
  - `publishedContentId`
  - `platform`
  - `platformContentId`
  - `capturedAt`
  - `metrics`
  - `platformMetrics`
  - `error`

- `EngagementMetrics`
  - `views`
  - `likes`
  - `comments`
  - `shares`
  - `bookmarks`
  - `clicks`

API 建议：

- `GET /api/engagement/overview`
- `GET /api/engagement/content`
- `GET /api/engagement/content/:publishedContentId`
- `POST /api/engagement/content/:publishedContentId/refresh`
- `POST /api/engagement/refresh`

前端 Tracking 页面升级为分析工作台：

- 顶部 Project 级 KPI。
- 中部内容表现表格。
- 右侧或详情页展示趋势图与指标快照。
- 筛选器支持平台、时间范围、发布状态。

测试重点：

- 只追踪 published 内容。
- 指标快照追加而非覆盖。
- 聚合统计准确性。
- 刷新失败时保留上一份成功指标。
- 平台字段映射。

## 4.4 Trending 功能

### 4.4.1 功能目标

Trending 功能用于全网检索与当前 Project 相关的帖子，帮助用户发现讨论、需求、竞品比较和推广机会。它不是传统热榜，而是 Project-aware 的外部机会发现工作流。

### 4.4.2 功能点

1. Project 关键词配置
   - 用户可以为 Project 配置品牌词、产品词、竞品词、问题词、行业词。
   - 支持保存多个 trend query。
   - 每个 query 可选择平台、语言、地区、时间范围。

2. 多平台检索
   - 目标平台：X、Reddit、Hacker News、小红书、微信。
   - 每个平台 connector 返回统一的 TrendPost 数据结构。
   - 若某平台暂不支持官方 API，可先采用手动导入、RSS、公开搜索或外部搜索 API 的 adapter，但必须封装在 connector 内。

3. 结果归一化
   - 每条帖子包含标题、正文摘要、作者、平台、URL、发布时间、互动指标、匹配关键词。
   - 结果按相关性、热度、时间排序。
   - 同一 URL 或高度相似内容需要去重。

4. 相关性评分
   - 基础版本可使用关键词命中、时间衰减、平台互动数加权。
   - 后续可接入语义相关性或 LLM 分类，但目标版本不依赖 LLM。

5. 处理状态
   - 用户可以将帖子标记为 new、saved、ignored、responded。
   - saved 表示值得后续处理。
   - responded 表示已经参与互动或完成外部响应。

6. 响应辅助
   - 用户可以从 TrendPost 创建响应草稿。
   - 响应草稿进入 Publish 模块，关联原始帖子 URL 和平台。
   - 支持记录响应内容、响应时间、响应 URL。

7. 检索历史
   - 每次运行 query 保存执行时间、平台、结果数量、错误信息。
   - 用户可以回看某个 query 的历史结果。

### 4.4.3 实现方案

新增 `trends-search` 模块，依赖 `connector-service`。

领域模型：

- `TrendQuery`
  - `id`
  - `projectId`
  - `name`
  - `keywords`
  - `excludedKeywords`
  - `platforms`
  - `language`
  - `timeRange`
  - `createdAt`
  - `updatedAt`

- `TrendPost`
  - `id`
  - `projectId`
  - `queryId`
  - `platform`
  - `platformPostId`
  - `url`
  - `title`
  - `summary`
  - `author`
  - `postedAt`
  - `capturedAt`
  - `matchedKeywords`
  - `metrics`
  - `relevanceScore`
  - `status`

- `TrendRun`
  - `id`
  - `queryId`
  - `startedAt`
  - `finishedAt`
  - `platforms`
  - `resultCount`
  - `errors`

API 建议：

- `GET /api/trends/queries`
- `POST /api/trends/queries`
- `PATCH /api/trends/queries/:id`
- `DELETE /api/trends/queries/:id`
- `POST /api/trends/queries/:id/run`
- `GET /api/trends/posts`
- `PATCH /api/trends/posts/:id`
- `POST /api/trends/posts/:id/create-response-draft`

前端 Trends 页面升级为检索工作台：

- 左侧：TrendQuery 列表与创建入口。
- 顶部：关键词、平台、时间范围筛选。
- 主区域：TrendPost 结果流。
- 结果项提供保存、忽略、创建响应草稿、打开原帖操作。
- 详情面板展示匹配原因、互动指标、检索历史。

测试重点：

- TrendQuery CRUD。
- 平台结果归一化。
- URL 去重。
- 相关性排序。
- TrendPost 状态流转。
- 从 TrendPost 创建 Published content 草稿。

## 5. 关键用户故事

1. 作为增长运营者，我想按 Project 管理素材，这样不同产品或活动的素材不会混在一起。
2. 作为增长运营者，我想上传图片、视频和文本素材，这样我可以把内容生产所需资料集中保存。
3. 作为增长运营者，我想预览素材，这样我可以快速判断素材是否适合当前发布任务。
4. 作为增长运营者，我想给素材加标签和描述，这样后续可以快速检索和复用。
5. 作为增长运营者，我想从素材创建发布草稿，这样我可以把素材管理和内容发布串起来。
6. 作为内容发布者，我想创建并编辑草稿，这样我可以在发布前反复打磨内容。
7. 作为内容发布者，我想为不同平台单独调整文案，这样内容能符合平台限制和语境。
8. 作为内容发布者，我想立即发布内容，这样我可以快速响应热点。
9. 作为内容发布者，我想排期发布内容，这样我可以提前安排多平台分发节奏。
10. 作为内容发布者，我想看到每个平台的发布状态，这样我知道哪些平台成功、哪些平台失败。
11. 作为内容发布者，我想重试失败发布，这样临时接口错误不会中断工作流。
12. 作为增长运营者，我想查看已发布内容的曝光和互动数据，这样我可以评估内容效果。
13. 作为增长运营者，我想按平台比较 Engagement，这样我可以知道哪个平台更适合当前 Project。
14. 作为增长运营者，我想查看单条内容的指标趋势，这样我可以判断内容生命周期。
15. 作为增长运营者，我想刷新最新 Engagement 数据，这样我可以基于当前数据决策。
16. 作为增长运营者，我想配置 Project 关键词，这样系统能持续发现相关讨论。
17. 作为增长运营者，我想跨平台搜索相关帖子，这样我可以找到潜在用户、竞品讨论和推广机会。
18. 作为增长运营者，我想保存有价值的 TrendPost，这样我可以稍后集中处理。
19. 作为增长运营者，我想忽略无关结果，这样趋势结果会更干净。
20. 作为增长运营者，我想从 TrendPost 创建响应草稿，这样我可以把发现机会转化为发布动作。

## 6. 非功能需求

### 6.1 可用性

- 页面状态必须明确区分 loading、empty、error、ready。
- 平台连接失败、发布失败、刷新失败必须给出可理解错误。
- 核心工作流不应依赖命令行操作。

### 6.2 可测试性

- 数据库 repository、Supabase Storage 媒体存取、发布状态机、指标聚合、趋势去重和评分应作为深模块独立测试。
- UI 测试重点覆盖跨页面主路径，而不是实现细节。

### 6.3 可扩展性

- 新增平台时应主要新增 connector，不应重写 Publish、Tracking、Trends 的业务层。
- 共享类型应统一描述平台、状态、指标和错误。

### 6.4 隐私与安全

- 使用 Supabase Auth 管理用户身份，Workspace 默认私有。
- 所有用户数据表必须开启 Supabase RLS，并以 Workspace membership 作为访问边界。
- 连接器凭据不得写入前端代码或普通日志；数据库中保存的 token、secret 应加密或使用系统级安全存储引用。
- Supabase Storage 中的媒体文件与用户生成内容属于用户数据，备份、导出和删除都必须覆盖这些数据。
- API 返回错误时不暴露 token、secret、完整平台响应。

### 6.5 可靠性

- 发布和刷新任务应保存状态，避免进程中断后丢失上下文。
- 外部平台接口失败时应保留历史数据并允许重试。
- 批量任务中单个平台失败不应阻断其他平台。
- 数据库内的多表变更必须使用 Postgres transaction，避免草稿、平台目标、指标快照等结构化数据出现部分写入。
- 涉及 Supabase Storage 或外部平台 API 的副作用必须通过 `outbox_events`、状态机、幂等重试和补偿清理保证一致性。

## 7. 暂不包含范围

- 团队邀请、成员管理 UI、复杂角色权限。
- 复杂审批流。
- 付费、账单、组织管理。
- 完整营销自动化编排。
- 依赖 LLM 的自动文案生成和自动回复。
- 跨设备实时同步。

## 8. 验收标准

1. 用户可以创建 Project，并在不同 Project 中看到隔离的素材、草稿、发布记录、追踪数据和趋势结果。
2. 用户可以通过 Supabase Auth 登录、登出，并只能访问自己所属 Workspace 的数据。
3. 用户数据保存到 Supabase Postgres 中，不能依赖纯文件 JSON 作为长期持久化机制。
4. 用户可以在 Content Repository 中上传、搜索、筛选、预览、删除素材。
5. 图片、视频和附件保存到 Supabase Storage，Postgres 保存媒体元数据和 Storage 引用。
6. 数据库内多表写入使用 Postgres transaction；Storage、外部平台发布、Engagement 刷新和 Trends 检索等副作用通过 `outbox_events` 保证可恢复的一致性。
7. 用户可以从素材创建草稿，并在 Publish 页面完成平台适配。
8. 用户可以发布或排期内容，并看到每个平台的发布状态和历史记录。
9. 已发布内容可以进入 Tracking 页面，并显示最新 Engagement 指标和历史快照。
10. 用户可以配置趋势检索关键词，运行检索，并保存、忽略或响应 TrendPost。
11. 从 TrendPost 创建的响应草稿可以进入 Publish 工作流。
12. 核心模块具备 Vitest 测试，主工作流具备 Playwright e2e 覆盖。

## 9. 后续决策点

1. Supabase migration、seed 和本地开发环境管理方式。
2. Supabase Storage bucket 命名、路径规范和 signed URL 策略。
3. Workspace role 是否只启用 owner，还是同时开放 admin/member UI。
4. 是否接受 Supabase Storage 的最终一致模型，或要求特定小文件使用 Postgres BLOB 获得严格事务原子性。
5. 真实平台连接器的接入优先级。
6. 小红书与微信的官方 API 能力、合规边界和替代方案。
7. 是否需要新增 ADR 来记录 Supabase、媒体存储和 connector 架构。
8. 是否需要把 Project-scoped storage 抽象为稳定接口，以支撑后续云端同步。
