# taskeel

> task + keel — a dev task tracker bound to git branches and deploys.

Next.js 15 (App Router) + Supabase (Postgres + Auth + Realtime), styled after
Linear (deep-grey base, hairline borders, restrained purple accent).

## What it does

- **Quick capture** — type a line, press Enter, it lands in the workspace inbox. Press `c` anywhere to focus the capture box. Inline tokens file it in one line: `#分類 @專案 !p1` (priority `!p0`–`!p3`). Projects and categories can each carry a short **abbreviation** (project/category editor) so `@et` matches "Easytax 後台".
- **Search / command palette** — `⌘K` (or `/`) opens a fuzzy search over the workspace's tasks; Enter jumps to one, or create a task from the typed text.
- **Priority & due dates** — tasks carry a priority (無/低/中/高/緊急) and an optional due date; rows show a flag and a due chip (soon/overdue coloured) and columns sort by priority → due → recency.
- **Row project toggle** — each board row has a far-right control to attach/detach projects without opening the editor.
- **Project documents & task references** — each project has a document area (markdown notes / links, in the project editor); a task can bind specific documents and read their content inline in its description area.
- **Per-task discussion** — a small notes/questions thread on each task.
- **Per-project branches** — one task can span multiple projects, each with its own repo and git branch.
- **Batched deploy → archive** — CI pings a webhook when a branch ships; that `(project, branch)` is marked deployed. A task is archived only once *all* its projects have deployed.
- **Deploy bundles** — tie tasks that must ship in the same release together (task editor → 設定 → 部署綁定). When one comes up in the deploy sheet, its bound siblings are listed as a "需一併部署" reminder.
- **One status per task** (Linear-style) — a task's status drives both its board column and its row icon. Statuses are **user-editable** under **狀態設定** (account menu): add / rename / recolour / reorder / delete, pick an icon (ring / dashed / half / filled / spinner / check / cross / dot), and flag roles (★ default capture bucket, ⇧ deploy stage, ✔ archive). A `cross`-icon status shows the "blocked reason" field.
- **Workspaces** — 個人 / 工作, each with its own projects and tasks (seeded on first login).
- **Deploy history** — archived tasks become a read-only, filterable changelog.
- **Realtime** — capture on your phone, the board updates on your laptop.

## Setup

### 1. Supabase

Create a project, then run [`supabase/schema.sql`](supabase/schema.sql) in the
SQL Editor. It creates the tables, enums, RLS policies, the realtime
publication, and the `archive_branch(repo, branch, owner)` function.

**Upgrading an existing project?** Run the migrations in
[`supabase/migrations/`](supabase/migrations) in order, once each: `0001`
(enums → editable status/dev-state tables), `0002` (merge into a single status
with an icon), `0003` (statuses per workspace), `0004` (categories per
workspace, editable), `0005` (subtasks / parent_id), `0006` (workspace icon),
`0007` (deploy bundles / bundle_id), `0008` (priority + due_date), `0009` (project/category abbr), `0010` (documents / task_documents /
comments). Fresh installs just run `schema.sql`.

Statuses and categories are per-workspace and edited in the workspace settings
(sidebar **工作區設定** or the switcher pencil). Light/dark theme, font size, and
a pinned landing workspace are in the account menu.

Sign-in is **Google OAuth** only. Enable Google under **Authentication →
Providers** (add the client ID / secret), set the Google console's authorized
redirect URI to the Supabase `.../auth/v1/callback`, and add
`https://<your-domain>/auth/callback` to Supabase's allowed redirect URLs.
Accounts that share the same verified email are auto-linked by Supabase, so a
user who first signed in another way lands on the same account (and data).

### 2. Environment

Copy `.env.example` to `.env.local` and fill in:

| var | purpose | public |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | project URL | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Publishable key** (`sb_publishable_…`) | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret key** (`sb_secret_…`), deploy-hook, bypasses RLS | **no, server only** |
| `DEPLOY_HOOK_SECRET` | webhook auth | no |
| `DISCORD_WEBHOOK_URL` | optional deploy notifications | no |

Keys come from Supabase → **Settings → API Keys**. Supabase's newer
publishable/secret keys replace the legacy anon/service_role keys; the variable
names above are unchanged — paste the new key values in. The Project URL is in
the top-right **Connect** button or Settings → General.

### 3. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000, sign in with a magic link. The 個人 / 工作
workspaces are created automatically on first login. Add projects from the
sidebar (`+`), optionally with a `owner/repo` identifier for deploy matching.

## Deploy automation

After a repo deploys, CI POSTs to `/api/deploy-hook`:

```
POST /api/deploy-hook
x-deploy-secret: <DEPLOY_HOOK_SECRET>
{ "repo": "owner/bibi-bot", "branch": "feat/gacha", "owner_id": "<uuid>" }
```

The route calls `archive_branch`, which:

1. finds the project by `repo`,
2. marks matching pending `(project, branch)` links as `deployed`,
3. archives any task whose projects are now *all* deployed.

A ready-to-use workflow is in
[`.github/workflows/deploy-hook.example.yml`](.github/workflows/deploy-hook.example.yml).
Single-project tasks archive immediately on deploy; multi-project tasks archive
only after the last project ships.

## Scope decisions

- **Cross-workspace projects (spec §7): Plan A** — a task only attaches projects
  from its own workspace. Workspaces stay clean isolation units.

## Deploy to Vercel

Import the repo, set the environment variables above (service role and secrets
as non-public), and deploy.

## Layout

```
src/
  app/            routes: board (/), /login, /auth/callback, /api/deploy-hook
  components/     Board, Sidebar, TaskRow, TaskEditor, DeploySheet, DeployHistory, DevStateControl
  lib/supabase/   client / server / admin clients
  lib/types.ts    domain types + display metadata
supabase/schema.sql
```
