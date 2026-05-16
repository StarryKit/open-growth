# Context

Open Growth is a workspace for social media operations and growth workflows.

## Domain

- Open Growth is a growth operations workbench for managing content, publishing, tracking, and trans workflows.
- Each user has one Workspace.
- A Workspace can contain multiple Projects.
- Workspaces are private to a single user in the first version.
- Projects are isolated from one another and do not share assets in the first version.
- The content repository stores image, video, and text assets.
- Publish, tracking, and trends are the current workflow surfaces in the UI, even when they are placeholders.
- The initial connector targets are X, Reddit, Hacker News, Xiaohongshu, and WeChat.
- The first version is expected to deliver working content management, publishing, tracking, and trans workflows.

## Glossary

- **Workspace**: the full Open Growth application.
- **Workspace**: a user-owned top-level container for multiple projects.
- **Growth operations workbench**: the product focus centered on content management and growth workflows.
- **Project**: a grouped working area inside a workspace for growth work around a specific product, campaign, or business initiative.
- **Content asset**: a stored raw image, video, or text asset managed by the API.
- **Published content**: a draft or already published post record derived from raw content assets.
- **Trends**: the workflow for finding related posts across the web and responding to them to promote a project.
- **Active project**: the project currently selected in the app.
- **Repository page**: the UI for browsing and managing content assets.

## Current Structure

- `apps/web`: React 19 + Vite UI
- `apps/api`: Fastify API and static asset server
- `packages/shared`: shared types and helpers

## Rules

- Use glossary terms consistently in code, issues, tests, and ADRs.
- Treat the codebase as the source of truth when docs drift.
- Update this file when a domain term changes or a new concept is introduced.
