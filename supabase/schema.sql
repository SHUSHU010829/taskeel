-- ============================================================
-- taskeel — Supabase schema
-- workspaces (個人/工作) + tasks + projects + 每專案分支 + RLS + Realtime
-- 分支下放到 task_projects；部署歸檔以 (專案,分支) 為單位、可分批
-- 在 Supabase Dashboard → SQL Editor 貼上執行
-- ============================================================

-- ---------- ENUMS ----------
create type task_status as enum ('inbox', 'active', 'notify_backend', 'ready_to_deploy', 'archived');
create type task_category as enum ('hotfix', 'feature', 'wishlist');
create type dev_state as enum ('idle', 'spec_ready', 'claude', 'blocked');
create type deploy_status as enum ('pending', 'deployed');

-- ---------- WORKSPACES ----------
create table workspaces (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null,               -- 個人 / 工作
  color      text not null default '#5E6AD2',
  created_at timestamptz not null default now()
);

-- ---------- PROJECTS ----------
create table projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  color        text not null default '#5E6AD2',
  repo         text,                       -- git repo 識別，如 'owner/bibi-bot'，供部署歸檔比對
  created_at   timestamptz not null default now()
);

-- ---------- TASKS ----------
-- 注意：branch 已移除，改放到 task_projects
create table tasks (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  owner_id       uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  description    text not null default '',
  status         task_status not null default 'inbox',
  category       task_category,
  dev_state      dev_state not null default 'idle',
  blocked_reason text,                     -- 僅 dev_state = blocked 時有意義
  needs_backend  boolean not null default false,
  deploy_notes   text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz
);

-- ---------- TASK ↔ PROJECT (多對多，承載每專案的分支與部署狀態) ----------
create table task_projects (
  task_id       uuid not null references tasks(id) on delete cascade,
  project_id    uuid not null references projects(id) on delete cascade,
  branch        text,                                   -- 該任務在該專案的分支
  deploy_status deploy_status not null default 'pending',
  deployed_at   timestamptz,
  primary key (task_id, project_id)
);

-- updated_at 自動更新
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger tasks_touch before update on tasks
  for each row execute function touch_updated_at();

-- ---------- INDEXES ----------
create index on tasks (workspace_id, status);
create index on projects (workspace_id);
create index on projects (repo);
create index on task_projects (project_id, branch);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table workspaces    enable row level security;
alter table projects      enable row level security;
alter table tasks         enable row level security;
alter table task_projects enable row level security;

create policy "own workspaces" on workspaces
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own projects" on projects
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  ) with check (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create policy "own tasks" on tasks
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own task_projects" on task_projects
  for all using (
    task_id in (select id from tasks where owner_id = auth.uid())
  ) with check (
    task_id in (select id from tasks where owner_id = auth.uid())
  );

-- ============================================================
-- REALTIME — 多裝置即時同步
-- ============================================================
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table task_projects;

-- ============================================================
-- 分批部署歸檔函式 (給 deploy-hook 呼叫)
-- 依 (repo, branch) 找到對應 task_projects 標為 deployed；
-- 某 task 的所有所屬專案都 deployed 時，才把 task 整體歸檔。
-- ============================================================
create or replace function archive_branch(p_repo text, p_branch text, p_owner uuid)
returns jsonb as $$
declare
  v_project_id uuid;
  v_marked int := 0;
  v_archived int := 0;
begin
  -- 1. 依 repo 找專案 (需屬於此 owner)
  select pr.id into v_project_id
  from projects pr
  join workspaces w on w.id = pr.workspace_id
  where pr.repo = p_repo and w.owner_id = p_owner
  limit 1;

  if v_project_id is null then
    return jsonb_build_object('error', 'project not found for repo', 'repo', p_repo);
  end if;

  -- 2. 把該 (專案,分支) 且 pending 的關聯標為 deployed
  update task_projects tp
    set deploy_status = 'deployed', deployed_at = now()
    where tp.project_id = v_project_id
      and tp.branch = p_branch
      and tp.deploy_status = 'pending'
      and tp.task_id in (select id from tasks where owner_id = p_owner);
  get diagnostics v_marked = row_count;

  -- 3. 對「所有所屬專案都已 deployed」的 task 整體歸檔
  update tasks t
    set status = 'archived', archived_at = now()
    where t.owner_id = p_owner
      and t.status <> 'archived'
      and t.id in (
        select task_id from task_projects
        group by task_id
        having bool_and(deploy_status = 'deployed')
      );
  get diagnostics v_archived = row_count;

  return jsonb_build_object(
    'repo', p_repo, 'branch', p_branch,
    'marked_deployed', v_marked, 'tasks_archived', v_archived
  );
end;
$$ language plpgsql security definer;
