# Content Repository PRD

日期：2026-05-19

## 1. 背景与目标

下一阶段优先完善 Open Growth 的 Content Repository。当前版本暂不推进外部 Web 系统连接，也不把重点放在发布页的多平台导出，而是先把内容素材的导入、管理、编辑、复制和下载导出做好。

Content Repository 的核心目标是让用户在一个 Project 内集中管理三类素材：

1. 文字 snippet：可创建空白文案元素，打开后填写和编辑文字。
2. 图片素材：可上传图片，并使用内置 Filerobot 图片编辑器进行基础编辑。
3. 视频素材：可上传视频，并在平台内查看和播放。

本阶段交付重点：

- Content Panel 使用大 Grid 布局罗列所有素材。
- 右上角提供上传/新建入口，下拉选择素材类型。
- 点击素材后查看详情。
- 文字和图片支持编辑。
- 视频仅支持查看和播放。
- 支持搜索和独立 Tag Filter。
- 支持通过复制或下载方式导出素材。
- 所有界面语言和文案统一使用英文。

## 2. 范围

### 2.1 本阶段包含

- Project-scoped Content Repository。
- Content Panel Grid 视图。
- 右上角上传按钮与下拉菜单。
- 创建文字 snippet。
- 上传图片。
- 上传视频。
- 查看素材详情。
- 编辑文字 snippet。
- 使用 Filerobot 编辑图片。
- 视频播放。
- 搜索素材。
- 独立 Tag Filter。
- 为素材添加和编辑标签。
- 复制导出。
- 下载导出。
- Supabase Postgres 元数据存储。
- Supabase Storage 文件存储。
- API 与前端完整流程。

### 2.2 本阶段不包含

- 连接外部 Web 系统。
- 从网页、第三方云盘或社交平台导入内容。
- Publish 页面直接导出全部内容。
- 视频编辑。
- AI 图片编辑。
- 文档格式转换，例如 docx、pdf、html 转 Markdown。
- 复杂版本历史、多人协作、审批流。
- 自动生成文案。

## 3. 用户故事

1. 作为内容创作者，我想创建一个空白文字 snippet，这样我可以先记录一段文案元素，之后再完善。
2. 作为内容创作者，我想上传图片，并在 Repository 内完成裁剪、调整和加文字，这样我不用跳出 Open Growth 做基础图片处理。
3. 作为内容创作者，我想上传视频并直接播放确认，这样我可以判断视频素材是否可用。
4. 作为运营人员，我想在一个网格中浏览所有素材，这样我可以快速找到当前 Project 的内容资产。
5. 作为运营人员，我想搜索素材并给素材打标签，这样后续可以快速筛选和复用。
6. 作为运营人员，我想复制或下载素材，这样当前阶段即使不进入 Publish 页面，也可以把素材带到外部工具中使用。

## 4. 核心概念

- **Content asset**：Repository 中的一条素材记录。
- **Text snippet**：文字类 Content asset。可以为空白创建，后续填写正文。
- **Image asset**：图片类 Content asset。上传后可用 Filerobot 做基础编辑。
- **Video asset**：视频类 Content asset。上传后可查看和播放，不支持编辑。
- **Content Panel**：Repository 主界面的大 Grid 素材面板。
- **Asset detail panel**：点击素材后打开的查看和编辑区域。
- **Native export**：按素材原始或当前可用格式复制 URL 或下载文件，不经过发布流程。

## 5. 产品功能

## 5.1 Content Panel

Content Panel 是 Repository 页面主体，采用大 Grid 布局展示当前 Project 的所有素材。

每个素材卡片展示：

- 预览图或类型图标。
- 标题或文件名。
- 素材类型：Text、Image、Video。
- 标签。
- 更新时间。
- 状态：ready、uploading、processing、failed。

交互要求：

- 点击卡片打开素材详情。
- 图片卡片展示图片缩略图。
- 视频卡片展示视频占位预览或首帧占位。
- 文字卡片展示前几行文本预览。
- 空白文字 snippet 展示 empty 状态。
- 上传中素材展示进度或 loading 状态。
- 失败素材展示错误状态，并允许删除或重试。

## 5.2 上传/新建入口

Repository 页面右上角设置主按钮：

- 按钮文案：`Add content`
- 点击后打开下拉菜单。

下拉菜单包含：

1. `Text snippet`
   - 创建一个新的文字 snippet。
   - 可以为空白。
   - 创建后立即打开详情编辑。

2. `Upload image`
   - 打开文件选择器。
   - 允许选择图片文件。

3. `Upload video`
   - 打开文件选择器。
   - 允许选择视频文件。

后续可以扩展 `Import from web`，但本阶段不实现。

## 5.3 文字 Snippet

### 5.3.1 创建

用户从 `Add content -> Text snippet` 创建文字素材。

创建行为：

- 后端创建一条 `kind = text` 的 Content asset。
- 初始标题可为 `Untitled snippet`。
- 初始正文可以为空。
- 状态为 `ready`。
- 创建成功后打开详情面板。

### 5.3.2 编辑

文字详情支持：

- 编辑标题。
- 编辑正文。
- 编辑标签。
- 编辑描述。
- 保存。

正文以 Markdown 方式存储。当前阶段需要提供所见即所得 Markdown 编辑器，而不是普通 textarea。

### 5.3.2.1 Markdown 编辑器选型

本阶段首选 **Milkdown** 作为文字 snippet 的所见即所得 Markdown 编辑器。

选择原因：

- 开源，MIT license。
- 定位就是 WYSIWYG Markdown editor framework。
- 基于 ProseMirror 和 remark，适合以 Markdown 作为 canonical storage format。
- 支持 React 集成。
- 交互体验接近 Typora/Notion 风格，比纯 textarea 更适合非技术用户。

Milkdown 参考：

- [Milkdown GitHub](https://github.com/Milkdown/milkdown)
- [Milkdown docs](https://milkdown.dev/core)

备选方案：

1. **TOAST UI Editor**
   - 支持 Markdown mode 和 WYSIWYG mode。
   - 有 `@toast-ui/react-editor` React wrapper。
   - 适合需要成熟开箱体验的备选路线。
   - 参考：[TOAST UI Editor](https://ui.toast.com/tui-editor)。

2. **Tiptap + `@tiptap/markdown`**
   - Tiptap 是成熟 headless rich text editor。
   - 官方 Markdown extension 支持 Markdown parse/serialize。
   - 但官方文档仍标注 Markdown extension 为 beta，因此不作为本阶段首选。
   - 参考：[Tiptap Markdown docs](https://tiptap.dev/docs/editor/markdown)。

PRD 决策：

- MVP 使用 Milkdown。
- 文档内容保存为 Markdown。
- 编辑器输出必须能稳定转换为 Markdown 字符串。
- 不要求 Markdown source / WYSIWYG 双模式切换。
- 不要求协同编辑、评论、复杂块编辑和 slash command。

### 5.3.3 查看

详情面板显示：

- 标题。
- 正文。
- 标签。
- 更新时间。
- 字符数。

Grid 卡片显示正文前几行作为 preview。

### 5.3.4 导出

文字 snippet 支持：

- Copy text。
- Copy Markdown。
- Download `.md`。

Copy text 可以只复制正文。

Copy Markdown / Download `.md` 输出：

```markdown
# Title

Body...
```

如果标题为空，则只导出正文。

## 5.4 图片素材

### 5.4.1 上传

用户从 `Add content -> Upload image` 上传图片。

支持格式：

- `.png`
- `.jpg`
- `.jpeg`
- `.webp`

可选支持：

- `.gif`：作为图片素材上传和预览，但不进入编辑器。
- `.svg`：作为图片素材上传和预览，但不进入位图编辑器。

`gif` 和 `svg` 决策：

- 本阶段允许上传和预览。
- 不支持 Filerobot 编辑。
- 详情页不显示 Edit with Filerobot 操作。

上传后：

- 原始图片保存到 Supabase Storage。
- Postgres 保存文件元数据。
- Grid 显示缩略图。
- 详情面板显示大图预览。

### 5.4.2 图片编辑器

本阶段明确选择 **Filerobot Image Editor** 作为内置图片编辑器。

选择原因：

- 开源。
- 免费。
- React 集成成本低。
- 支持基础图片编辑能力。
- 用户体验足够覆盖当前阶段需求。

Filerobot 参考：

- [GitHub](https://github.com/scaleflex/filerobot-image-editor)
- [npm react-filerobot-image-editor](https://www.npmjs.com/package/react-filerobot-image-editor)

MVP 开启功能：

- Crop。
- Resize。
- Rotate。
- Adjust / Finetune。
- Text。
- Annotate。
- Undo / redo。
- Save。

不要求：

- AI 编辑。
- 背景移除。
- 多图层复杂设计。
- 模板系统。

### 5.4.3 编辑保存

图片编辑保存行为：

- 不覆盖原始上传文件。
- 编辑后的图片保存为当前 edited output。
- Postgres 记录当前图片使用的 edited storage path。
- Grid 和详情默认展示最新 edited output。
- 用户可以下载 edited output。

当前阶段可以只保留：

- original object。
- latest edited object。

不要求完整历史版本管理。未来如需要再扩展 revision 表。

### 5.4.4 查看

图片详情显示：

- 当前图片预览。
- 原始文件名。
- 文件大小。
- MIME 类型。
- 标签。
- 更新时间。
- Edit 按钮。
- Copy / Download 操作。

### 5.4.5 导出

图片素材支持：

- Copy image URL。
- Download image。

说明：

- 图片复制统一复制 URL，不使用 Base64，也不要求复制图片二进制。
- Copy URL 使用 API 代理 URL。
- URL 不应是永久公开链接。
- Download 默认下载最新 edited output；如果没有编辑结果，则下载原图。

## 5.5 视频素材

### 5.5.1 上传

用户从 `Add content -> Upload video` 上传视频。

支持格式：

- `.mp4`
- `.webm`

上传后：

- 视频文件保存到 Supabase Storage。
- Postgres 保存文件元数据。
- Grid 显示视频卡片。
- 详情面板提供播放器。

### 5.5.2 查看和播放

视频详情显示：

- HTML5 video 播放器。
- 文件名。
- 文件大小。
- MIME 类型。
- 标签。
- 更新时间。

本阶段不支持：

- 视频裁剪。
- 转码。
- 字幕编辑。
- 封面编辑。
- 时间轴编辑。

### 5.5.3 导出

视频素材支持：

- Download video。

本阶段不支持视频复制功能。视频仅支持查看、播放和下载。

视频上传大小限制：

- MVP 最大上传大小为 100MB。

MVP 可以通过 API 代理下载或返回短期 signed URL。视频播放如果暂不支持 Range request，需要记录为技术债，但仍需保证 100MB 以内视频的基础播放体验。

## 5.6 搜索和标签

### 5.6.1 搜索

Content Panel 顶部提供搜索框。

搜索范围：

- 标题。
- 文件名。
- 标签。
- 描述。
- 文字 snippet 正文。

搜索结果实时过滤或提交后过滤均可，MVP 优先实现前端过滤；如果素材数量增大，再改为后端搜索。

### 5.6.2 标签

Content Panel 必须提供独立 Tag Filter，不能只依赖搜索框。

每个素材支持标签：

- 查看标签。
- 添加标签。
- 删除标签。
- 按标签筛选。

标签存储在 Postgres 的 `tags` 字段中。

MVP 可以使用自由输入标签，不要求预设标签管理。

Tag Filter 要求：

- 展示当前 Project 内已存在的标签。
- 支持选择一个或多个标签过滤 Grid。
- 多选标签使用 OR 逻辑：展示包含任一已选标签的素材。
- 搜索关键词和 Tag Filter 可以同时生效。
- 素材详情中可以添加和编辑标签。

## 6. API 设计

## 6.1 通用 API

### `GET /api/content-assets`

返回当前 Project 的素材列表。

Query 可选：

- `kind=text|image|video`
- `q=keyword`
- `tag=tag`

### `GET /api/content-assets/:id`

返回单个素材详情。

### `PATCH /api/content-assets/:id`

更新通用元数据：

- title
- description
- tags

### `DELETE /api/content-assets/:id`

删除素材。删除应先标记状态，再清理 Storage。

## 6.2 文字 API

### `POST /api/content-assets/text-snippets`

创建文字 snippet。

Request:

```json
{
  "title": "Untitled snippet",
  "body": "",
  "tags": []
}
```

Response:

```json
{
  "asset": {
    "id": "...",
    "kind": "text",
    "title": "Untitled snippet",
    "body": "",
    "tags": [],
    "status": "ready"
  }
}
```

### `PATCH /api/content-assets/:id/text`

更新文字内容。

Request:

```json
{
  "title": "Launch copy",
  "body": "Markdown body...",
  "tags": ["launch"]
}
```

### `POST /api/content-assets/:id/export`

导出文字、图片或视频。

Request:

```json
{
  "format": "text"
}
```

文字支持格式：

- `text`
- `markdown`

## 6.3 图片 API

### `POST /api/content-assets/images`

上传图片。使用 multipart form-data。

### `POST /api/content-assets/:id/image-edits`

保存 Filerobot 编辑结果。

Request 使用 multipart form-data：

- `file`: edited image blob
- `editState`: Filerobot design state JSON，可选

Response:

```json
{
  "asset": {
    "id": "...",
    "kind": "image",
    "currentPath": "workspace/project/asset/edited/latest.png"
  }
}
```

### `GET /api/content-assets/:id/blob`

读取当前可展示文件：

- 图片：返回 latest edited output 或 original。
- 视频：返回 original。

### `GET /api/content-assets/:id/original`

读取原始上传文件。MVP 可选。

## 6.4 视频 API

### `POST /api/content-assets/videos`

上传视频。使用 multipart form-data。

### `GET /api/content-assets/:id/video`

返回视频元数据和播放地址。

### `POST /api/content-assets/:id/copy-url`

返回图片可复制 URL。

Request:

```json
{
  "target": "current"
}
```

Response:

```json
{
  "url": "https://...",
  "expiresAt": "2026-05-19T00:00:00.000Z"
}
```

说明：

- 仅图片需要 Copy URL。
- 视频本阶段不支持复制 URL。
- URL 使用 API 代理路径，并由 API 做权限校验。

## 7. 数据模型

当前阶段尽量在现有 `content_assets` 基础上扩展，避免过早引入复杂版本系统。

### 7.1 `content_assets`

建议字段：

- `id`
- `workspace_id`
- `project_id`
- `kind`: `text` | `image` | `video`
- `title`
- `description`
- `tags`
- `status`
- `original_filename`
- `mime_type`
- `byte_size`
- `sha256`
- `storage_bucket`
- `storage_path`
- `current_storage_path`
- `preview`
- `created_by`
- `created_at`
- `updated_at`

说明：

- `storage_path` 表示原始上传文件。
- `current_storage_path` 表示当前展示/导出的文件。图片编辑保存后更新此字段；没有编辑结果时等于 `storage_path`。
- 文字 snippet 可以没有 `storage_path`。

### 7.2 `content_asset_texts`

新增文字内容表：

- `asset_id`
- `workspace_id`
- `project_id`
- `body_markdown`
- `body_preview`
- `character_count`
- `created_at`
- `updated_at`

### 7.3 `content_asset_image_edits`

可选新增，用于记录最新编辑状态：

- `asset_id`
- `workspace_id`
- `project_id`
- `edited_storage_path`
- `edit_state`
- `mime_type`
- `byte_size`
- `width`
- `height`
- `updated_at`

MVP 如果想更简单，也可以先不建该表，把 `current_storage_path` 和必要元数据直接存在 `content_assets`。但为了保留 Filerobot design state，建议新增此表。

## 8. Storage 策略

Storage path：

```text
user_id/workspace_id/project_id/asset_id/original/original_filename
user_id/workspace_id/project_id/asset_id/edited/latest.png
```

规则：

- 所有素材对象都应上传到 Supabase Storage 的当前用户目录下。
- 图片和视频原始文件保存到 `original/`。
- 图片编辑结果保存到 `edited/latest.*`。
- 当前阶段不要求保存完整历史版本。
- 删除素材时清理 asset_id 目录下所有对象。
- 文字 snippet 默认不创建 Storage object。
- 文本内容保存在 Postgres；如未来需要文件化导出，可以按需生成 `.md` 下载响应，不必提前创建 Storage object。

## 9. 前端交互

## 9.1 Repository 页面布局

页面结构：

- 顶部栏：
  - 左侧：页面标题、搜索框、Tag Filter。
  - 右侧：`Add content` 按钮。
- 主区域：
  - 大 Grid Content Panel。
- 详情层：
  - 点击素材后打开右侧 Drawer。

## 9.2 Add Content 下拉菜单

菜单项：

- Text snippet
- Upload image
- Upload video

行为：

- Text snippet：调用创建 API，成功后打开编辑详情。
- Upload image：打开图片文件选择器，上传后打开详情。
- Upload video：打开视频文件选择器，上传后打开详情。

所有菜单、按钮、状态和错误文案统一使用英文。

## 9.3 素材详情

文字：

- 标题输入。
- Milkdown WYSIWYG Markdown editor。
- 标签编辑。
- Copy text。
- Copy Markdown。
- Download Markdown。

图片：

- 图片预览。
- Edit with Filerobot。
- 标签编辑。
- Copy image URL。
- Download image。

视频：

- 视频播放器。
- 标签编辑。
- Download video。

## 10. 状态与错误

状态：

- `uploading`
- `ready`
- `failed`
- `deleting`
- `deleted`

错误：

- unsupported_file_type
- file_too_large
- empty_file
- upload_failed
- save_failed
- storage_object_missing
- video_not_playable

UI 要求：

- 上传失败显示明确错误。
- 视频不可播放时显示文件已上传但当前浏览器无法播放。
- 图片编辑保存失败时不影响原图。
- 复制失败时提供下载 fallback。

## 11. 权限与安全

- 所有素材按 Project 隔离。
- API 必须验证 Supabase access token。
- 所有查询必须带 workspace/project scope。
- 上传文件必须校验 MIME 类型和扩展名。
- SVG 如果允许预览，必须避免脚本执行风险。
- Copy link 不应暴露长期公开 URL。
- 下载可以通过 API 代理或短期 signed URL。
- 图片 Copy URL 只能返回 API 代理 URL。
- 视频本阶段不提供 Copy URL。

## 12. 验收标准

1. 用户可以从右上角 `Add content` 下拉菜单创建文字 snippet。
2. 新建文字 snippet 可以为空白，打开后可以填写和保存正文。
3. 文字 snippet 使用 WYSIWYG Markdown editor 编辑，并以 Markdown 保存。
4. 用户可以上传图片，并在 Grid 中看到图片卡片。
5. 用户可以打开图片详情，并使用 Filerobot 完成裁剪、调整和添加文字。
6. 图片编辑保存后，Grid 和详情展示编辑后的图片。
7. 图片编辑不会破坏原图。
8. 图片复制功能复制 URL，不使用 Base64。
9. 用户可以上传 100MB 以内的视频，并在详情中播放支持格式的视频。
10. 视频详情不提供编辑入口。
11. 视频本阶段不提供复制功能。
12. Content Panel 以 Grid 形式展示所有素材。
13. 用户可以搜索素材。
14. 用户可以使用独立 Tag Filter 过滤素材。
15. Tag Filter 多选使用 OR 逻辑。
16. 用户可以在素材详情中添加和删除标签。
17. 用户可以下载文字、图片或视频。
18. Copy text 只复制正文，Copy Markdown 才包含标题。
19. `gif` 和 `svg` 可以上传和预览，但不能编辑。
20. 所有界面文案统一使用英文。
21. 所有素材只出现在当前 active Project 中。
22. 图片和视频保存在 Supabase Storage 当前用户目录下，元数据保存在 Supabase Postgres。

## 13. 实现计划

### Phase 1: 数据与 API

- 增加 `kind = text|image|video` 语义。
- 增加文字 snippet 创建和更新 API。
- 增加图片上传 API。
- 增加视频上传 API。
- 增加 export/download API。
- 增加图片 copy URL API。
- 将视频上传大小限制为 100MB。
- 补充数据库 migration 和测试。

### Phase 2: Content Panel

- 实现 Grid 素材面板。
- 实现搜索。
- 实现独立 Tag Filter。
- 实现标签展示和编辑。
- 实现右上角 `Add content` 下拉菜单。
- 实现素材详情面板。
- 所有 UI 文案统一使用英文。

### Phase 3: 编辑与导出

- 集成 Milkdown，实现文字 snippet WYSIWYG Markdown 编辑。
- 集成 Filerobot 图片编辑器。
- 保存图片编辑结果。
- 实现文字复制/下载。
- 实现图片 URL 复制/下载。
- 实现视频下载。

## 14. 已确认决策

1. 图片 Copy URL 使用 API 代理 URL。
2. Text snippet 的 Copy text 只复制正文；Copy Markdown 才包含标题。
3. 图片 `.gif` 和 `.svg` 本阶段允许上传和预览，但禁用编辑。
4. Tag Filter 多选使用 OR 逻辑。
