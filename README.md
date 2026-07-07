# taskeel

> task + keel — a dev task tracker bound to git branches and deploys.

Next.js 15 (App Router) + Supabase (Postgres + Auth + Realtime), styled after
Linear (deep-grey base, hairline borders, restrained purple accent).

## What it does

- **Quick capture** — type a line, press Enter, it lands in the workspace inbox. Press `c` anywhere to focus the capture box.
- **Per-project branches** — one task can span multiple projects, each with its own repo and git branch.
- **Batched deploy → archive** — CI pings a webhook when a branch ships; that `(project, branch)` is marked deployed. A task is archived only once *all* its projects have deployed.
- **Two independent axes** — flow `status` (inbox → active → notify_backend → ready_to_deploy → archived) and `dev_state` (idle / spec_ready / claude / blocked), shown as a clickable status circle per row.
- **Workspaces** — 個人 / 工作, each with its own projects and tasks (seeded on first login).
- **Deploy history** — archived tasks become a read-only, filterable changelog.
- **Realtime** — capture on your phone, the board updates on your laptop.

## Setup

### 1. Supabase

Create a project, then run [`supabase/schema.sql`](supabase/schema.sql) in the
SQL Editor. It creates the tables, enums, RLS policies, the realtime
publication, and the `archive_branch(repo, branch, owner)` function.

Enable an auth provider — **magic link (email OTP)** is what the login page uses.

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
