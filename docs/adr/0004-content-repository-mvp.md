# ADR-0004: Content Repository MVP import, edit, and export workflow

Status: accepted
Date: 2026-05-19

## Context

Open Growth's next product increment prioritizes the Content Repository over external Web system connections and publishing-page export workflows. The product requirement is captured in `docs/prd/content-repository-prd.md`.

The current Repository already supports project-scoped asset upload and basic preview, backed by Supabase Postgres and Supabase Storage. The next version needs to make Repository the working content panel for three asset types:

- Text snippets, created empty and edited in place.
- Image assets, uploaded and edited with an embedded image editor.
- Video assets, uploaded and played back without editing.

The product also requires a large Grid-based Content Panel, right-side Drawer details, search, independent Tag Filter, English UI copy, and native export through copy/download actions.

This ADR records the implementation path and test coverage expected before the feature is considered complete.

## Decision

Implement the Content Repository MVP as a project-scoped asset workflow with the following product and technical decisions:

- Use a Grid Content Panel as the primary Repository surface.
- Use a right-side Drawer for asset details.
- Use `Add content` in the top-right corner with menu items:
  - `Text snippet`
  - `Upload image`
  - `Upload video`
- Store text snippets as Markdown in Postgres.
- Use Milkdown as the WYSIWYG Markdown editor for text snippets.
- Use Filerobot Image Editor for image editing.
- Keep image editing non-destructive:
  - Preserve the original upload.
  - Store only the latest edited output for this MVP.
  - Do not implement full image revision history yet.
- Allow `.gif` and `.svg` upload and preview, but disable image editing for those formats.
- Support video upload and playback only; do not support video editing or video copy.
- Limit video upload size to 100MB.
- Store image and video objects in Supabase Storage under a user-scoped object path:
  - `user_id/workspace_id/project_id/asset_id/original/original_filename`
  - `user_id/workspace_id/project_id/asset_id/edited/latest.ext`
- Use API proxy URLs for image Copy URL behavior.
- Do not copy images as Base64 or clipboard binary data.
- Copy text copies only the body.
- Copy Markdown includes title and body.
- Implement independent Tag Filter in addition to search.
- Use OR logic for multi-select Tag Filter.
- Keep all UI copy in English.

## Implementable Paths

### Path A: Extend The Existing Content Asset Model

This is the accepted path.

Extend the existing `content_assets` storage shape rather than introducing a full content object hierarchy. Add the minimum schema needed for text snippets and latest image edit output:

- Add or standardize `kind`: `text`, `image`, `video`.
- Add `current_storage_path` for the currently displayed/downloaded image output.
- Add `content_asset_texts` for Markdown body and preview fields.
- Add `content_asset_image_edits` only if the implementation needs to preserve Filerobot design state separately from `content_assets`.

Benefits:

- Smallest migration surface.
- Fits the current API and Repository page.
- Keeps MVP fast to ship.
- Avoids premature revision abstractions.

Tradeoffs:

- Does not support full edit history.
- Future revision support will require another migration.

### Path B: Introduce A Full Revision And Rendition Model

This path is deferred.

Introduce `content_asset_revisions` and `content_asset_renditions` immediately, even though the MVP only needs latest image output.

Benefits:

- Cleaner long-term modeling for image edit history and generated derivatives.
- Easier to add future AI edits and thumbnails.

Tradeoffs:

- More migration and UI complexity.
- More API surface to test.
- Overbuilds the current product scope.

### Path C: Keep Text Snippets In The Existing Preview Field

This path is rejected.

Store text snippet content directly in `content_assets.preview` or another existing metadata field.

Benefits:

- No new text table.

Tradeoffs:

- Blurs preview and canonical content.
- Makes search, copy, Markdown editing, and future migrations more fragile.
- Encourages overloading metadata fields.

## Implementation Plan

### Shared Types

Affected paths:

- `packages/shared/src/content.ts`
- `packages/shared/src/index.ts`

Add or update shared types:

- `ContentAssetKind`: include or normalize `text`, `image`, `video`.
- `ContentAsset`: include `kind`, `title`, `description`, `tags`, `currentStoragePath`, and text-specific fields where appropriate.
- Add request/response DTOs if the API starts sharing typed payloads across web and API.

### Database

Affected paths:

- `packages/db/supabase/migrations/`
- `packages/db/src/database-store.ts`
- `packages/db/src/content-assets.ts`

Add a migration to support:

- Text snippets:
  - `content_asset_texts`
  - `body_markdown`
  - `body_preview`
  - `character_count`
- Current output path:
  - `content_assets.current_storage_path`
- Asset kind:
  - either migrate existing asset type semantics or add a clear `kind` column.
- Optional Filerobot edit state:
  - `content_asset_image_edits`
  - `edited_storage_path`
  - `edit_state`

Database rules:

- All project-scoped rows include `workspace_id` and `project_id`.
- RLS policies follow the existing Workspace membership boundary.
- Text snippets can have no Storage object.
- Image and video objects must use the user-scoped Storage path.

### API

Affected paths:

- `apps/api/src/app.ts`
- `apps/api/src/lib/domain-store.ts`
- `apps/api/src/lib/media-storage.ts`
- `apps/api/src/lib/content-server.ts`

Add or update endpoints:

- `GET /api/content-assets`
  - optional `kind`, `q`, and `tag` query params.
- `GET /api/content-assets/:id`
  - returns full asset detail.
- `PATCH /api/content-assets/:id`
  - updates title, description, tags.
- `POST /api/content-assets/text-snippets`
  - creates an empty or seeded text snippet.
- `PATCH /api/content-assets/:id/text`
  - updates Markdown body and text metadata.
- `POST /api/content-assets/images`
  - uploads image files.
- `POST /api/content-assets/:id/image-edits`
  - saves Filerobot edited output.
- `POST /api/content-assets/videos`
  - uploads video files with a 100MB limit.
- `GET /api/content-assets/:id/blob`
  - returns current image output or original video.
- `GET /api/content-assets/:id/original`
  - optional original file read endpoint.
- `POST /api/content-assets/:id/copy-url`
  - returns an API proxy URL for image copy.
- `POST /api/content-assets/:id/export`
  - returns text/Markdown output or file download metadata.

API behavior:

- Reject unsupported MIME types and extensions.
- Allow `.gif` and `.svg` upload and preview, but report `editable: false`.
- Reject video uploads over 100MB.
- Never return service-role credentials or permanent public Storage URLs.
- For image Copy URL, return an API proxy URL that re-checks authorization on access.
- Do not implement video Copy URL in this MVP.

### Web UI

Affected paths:

- `apps/web/src/components/repository-client.tsx`
- `apps/web/src/ui/pages/repository-page.tsx`
- `apps/web/src/ui/lib/api.ts`
- New colocated components as needed under `apps/web/src/components/` or `apps/web/src/ui/pages/`

Implement:

- Grid Content Panel.
- `Add content` dropdown in the top-right corner.
- Text snippet creation flow.
- Image upload flow.
- Video upload flow.
- Search box.
- Independent Tag Filter with OR logic.
- Right-side Drawer asset detail.
- Milkdown editor for text snippets.
- Filerobot editor for editable images.
- Video playback for video assets.
- Copy text body only.
- Copy Markdown with title and body.
- Copy image URL through API proxy URL.
- Download for text, image, and video.
- English-only UI labels and errors.

UI rules:

- Video assets never show an edit action.
- `.gif` and `.svg` image assets show preview and download/copy URL actions, but not Filerobot editing.
- Upload and save failures show clear errors.
- Copy failure offers download as fallback.

### Documentation

Affected paths:

- `docs/prd/content-repository-prd.md`
- `CONTEXT.md`
- `README.md` or `README.zh-CN.md` if current capabilities are listed there.

Update docs only when implementation changes visible behavior or domain vocabulary.

## Test Coverage

### Shared Type Tests

Add or update tests to cover:

- Asset kind values for text, image, and video.
- Export format values for text and Markdown.
- Editable capability for image MIME types:
  - editable: PNG, JPG, JPEG, WebP
  - not editable: GIF, SVG

Potential locations:

- `packages/shared/src/content.test.ts`
- or colocated tests near shared helpers if introduced.

### Database Tests

Add tests in `packages/db` for:

- Creating a text snippet asset with no Storage path.
- Updating `content_asset_texts.body_markdown`.
- Generating `body_preview` and `character_count`.
- Creating an image asset with `storage_path` and `current_storage_path`.
- Saving latest edited image output and updating `current_storage_path`.
- Creating a video asset with a Storage path.
- Listing assets filtered by project.
- Searching by title, filename, tags, description, and text body.
- Filtering by one tag.
- Filtering by multiple tags using OR semantics.
- Ensuring assets from another Project are not returned.
- RLS-sensitive access where practical in existing integration setup.

Potential locations:

- `packages/db/src/content-assets.test.ts`
- `packages/db/src/database-store.test.ts`
- `packages/db/integration/`

### API Unit And Integration Tests

Add tests in `apps/api` for:

- `POST /api/content-assets/text-snippets`
  - creates empty snippet.
  - accepts seeded title/body/tags.
  - requires authentication.
- `PATCH /api/content-assets/:id/text`
  - updates Markdown body.
  - updates preview/count fields.
  - rejects non-text assets.
- `POST /api/content-assets/images`
  - accepts PNG/JPG/JPEG/WebP.
  - accepts GIF/SVG but returns `editable: false`.
  - rejects unsupported file types.
- `POST /api/content-assets/:id/image-edits`
  - saves edited output.
  - updates current output path.
  - rejects edits for GIF/SVG/video/text assets.
- `POST /api/content-assets/videos`
  - accepts MP4/WebM.
  - rejects files over 100MB.
  - rejects unsupported video types.
- `POST /api/content-assets/:id/copy-url`
  - returns API proxy URL for images.
  - rejects video copy URL.
  - rejects text copy URL if text export should use export endpoint.
  - requires project access.
- `POST /api/content-assets/:id/export`
  - text format returns body only.
  - Markdown format returns title plus body.
- `GET /api/content-assets`
  - supports `q`.
  - supports `tag`.
  - supports multiple tags with OR behavior.
  - supports `kind`.
- `GET /api/content-assets/:id/blob`
  - image returns latest edited output when present.
  - image falls back to original when no edit exists.
  - video returns original.

Potential locations:

- `apps/api/integration/app.test.ts`
- `apps/api/src/lib/media-storage.test.ts`
- `apps/api/src/lib/content-server.test.ts` if helpers are added.

### Web Component Tests

Add tests in `apps/web` for:

- Repository renders Grid cards for text, image, and video assets.
- `Add content` dropdown shows English menu items.
- Text snippet menu item calls create endpoint and opens Drawer.
- Image upload menu item opens image upload flow.
- Video upload menu item opens video upload flow.
- Clicking a card opens a right-side Drawer.
- Text Drawer renders Milkdown editor wrapper or editor host.
- Text Copy text copies body only.
- Text Copy Markdown copies title plus body.
- Image Drawer shows `Edit with Filerobot` for PNG/JPG/WebP.
- Image Drawer hides edit action for GIF/SVG.
- Video Drawer does not show edit or copy action.
- Image Copy URL calls copy-url endpoint.
- Download actions are available for text, image, and video.
- Search filters Grid results.
- Tag Filter filters Grid results.
- Multi-tag filter uses OR behavior.
- Tag add/remove updates the asset metadata.
- UI labels are English for the core flows.

Potential locations:

- `apps/web/src/components/repository-client.test.tsx`
- New tests near new components, such as:
  - `apps/web/src/components/content-panel.test.tsx`
  - `apps/web/src/components/asset-detail-drawer.test.tsx`
  - `apps/web/src/components/add-content-menu.test.tsx`

### Editor Integration Tests

Milkdown and Filerobot are UI-heavy third-party editors. Avoid testing their internals. Test our integration boundaries:

- Milkdown wrapper receives initial Markdown.
- Milkdown wrapper calls `onChange` with Markdown.
- Save action sends Markdown to the API.
- Filerobot wrapper receives source image URL.
- Filerobot save callback sends edited blob and optional design state to the API.
- Filerobot editor is not mounted for GIF/SVG/video/text assets.

If jsdom cannot fully mount either editor, mock the editor package and test our adapter component contract.

### Security And Storage Tests

Add tests or assertions for:

- Storage paths include `user_id/workspace_id/project_id/asset_id`.
- Image Copy URL is an API proxy URL, not a permanent public Storage URL.
- Copy URL access requires authentication.
- API responses do not expose service-role credentials.
- SVG preview path does not inline executable SVG markup into the DOM.
- Unsupported uploads fail before Storage write where possible.

### Manual Verification

Before marking the feature complete, manually verify:

- Create an empty text snippet, edit it, copy body, copy Markdown, download Markdown.
- Upload PNG, edit in Filerobot, save, verify Grid updates, copy URL, download latest image.
- Upload GIF/SVG, preview, confirm edit action is hidden.
- Upload MP4/WebM under 100MB and play in the Drawer.
- Attempt video over 100MB and confirm clear rejection.
- Search by title/body/tag.
- Select multiple tags and confirm OR behavior.
- Switch active Project and confirm assets are isolated.

## Verification Checklist

- [ ] Content Repository PRD remains aligned with this ADR.
- [ ] `content_assets` supports text, image, and video kinds.
- [ ] Text snippets are stored as Markdown.
- [ ] Milkdown is integrated through a wrapper component.
- [ ] Filerobot is integrated through a wrapper component.
- [ ] Image edits preserve original files and update latest edited output.
- [ ] Video upload limit is enforced at 100MB.
- [ ] GIF and SVG upload/preview works without edit actions.
- [ ] Image Copy URL returns an API proxy URL.
- [ ] Video copy is absent from the UI and API behavior.
- [ ] Search and independent Tag Filter work together.
- [ ] Multi-tag filtering uses OR semantics.
- [ ] All core UI copy is English.
- [ ] Database, API, web component, editor adapter, and storage/security tests cover the MVP behavior.

## Revisit Conditions

Revisit this ADR if:

- Image edit history becomes a product requirement.
- Video editing, transcoding, poster generation, or range streaming becomes required.
- Text snippets need collaborative editing or Markdown/source split mode.
- The product chooses to move copy/export behavior into Publish as the primary path.
- Supabase Storage object paths need to change because of policy or migration constraints.
