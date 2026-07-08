-- ============================================================
-- taskeel — Supabase schema
-- workspaces (個人/工作) + tasks + projects + 每專案分支 + RLS + Realtime
-- 單一狀態：task_statuses 同時決定看板分欄與圖示（可自訂，每使用者一組）
-- 分支下放到 task_projects；部署歸檔以 (專案,分支) 為單位、可分批
-- 在 Supabase Dashboard → SQL Editor 貼上執行
-- ============================================================

-- ---------- ENUMS ----------
create type deploy_status as enum ('pending', 'deployed');

-- ---------- WORKSPACES ----------
create table workspaces (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#5E6AD2',
  created_at timestamptz not null default now()
);

-- ---------- PROJECTS ----------
create table projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  color        text not null default '#5E6AD2',
  repo         text,                       -- 'owner/bibi-bot'，供部署歸檔比對
  created_at   timestamptz not null default now()
);

-- ---------- STATUSES (單一狀態軸：看板分欄 + 圖示，每 workspace 一組) ----------
-- style: ring | dashed | half | filled | spinner | check | cross | dot
create table task_statuses (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  color        text not null default '#6B7280',
  style        text not null default 'ring',
  position     int  not null default 0,
  is_default   boolean not null default false,  -- 快速捕捉落點
  is_deploy    boolean not null default false,  -- 部署清單抓這區
  is_archive   boolean not null default false,  -- 不進看板、進部署歷史、CI 歸檔目標
  created_at   timestamptz not null default now()
);
create unique index task_statuses_ws_one_default on task_statuses (workspace_id) where is_default;
create unique index task_statuses_ws_one_archive on task_statuses (workspace_id) where is_archive;

-- ---------- CATEGORIES (分類，每 workspace 一組，可自訂) ----------
create table categories (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  color        text not null default '#5E6AD2',
  position     int  not null default 0,
  created_at   timestamptz not null default now()
);
create index on categories (workspace_id, position);

-- ---------- TASKS ----------
create table tasks (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  owner_id       uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  description    text not null default '',
  status_id      uuid references task_statuses(id) on delete set null,
  category_id    uuid references categories(id) on delete set null,
  blocked_reason text,                     -- 僅當狀態圖示為 cross 時有意義
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
  branch        text,
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
create index on tasks (workspace_id, status_id);
create index on projects (workspace_id);
create index on projects (repo);
create index on task_projects (project_id, branch);
create index on task_statuses (workspace_id, position);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table workspaces    enable row level security;
alter table projects      enable row level security;
alter table task_statuses enable row level security;
alter table categories    enable row level security;
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

create policy "own task_statuses" on task_statuses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own categories" on categories
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own tasks" on tasks
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own task_projects" on task_projects
  for all using (
    task_id in (select id from tasks where owner_id = auth.uid())
  ) with check (
    task_id in (select id from tasks where owner_id = auth.uid())
  );

-- ============================================================
-- TABLE PRIVILEGES
-- RLS 只限制「哪些列」，表級 GRANT 決定「角色能否碰這張表」。
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.workspaces, public.projects, public.task_statuses, public.categories,
  public.tasks, public.task_projects
  to authenticated;

-- ============================================================
-- REALTIME — 多裝置即時同步
-- ============================================================
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table task_projects;
alter publication supabase_realtime add table task_statuses;
alter publication supabase_realtime add table categories;

-- ============================================================
-- 分批部署歸檔函式 (給 deploy-hook 呼叫)
-- ============================================================
create or replace function archive_branch(p_repo text, p_branch text, p_owner uuid)
returns jsonb as $$
declare
  v_project_id uuid;
  v_workspace_id uuid;
  v_archive_status uuid;
  v_marked int := 0;
  v_archived int := 0;
begin
  select pr.id, pr.workspace_id into v_project_id, v_workspace_id
  from projects pr
  join workspaces w on w.id = pr.workspace_id
  where pr.repo = p_repo and w.owner_id = p_owner
  limit 1;

  if v_project_id is null then
    return jsonb_build_object('error', 'project not found for repo', 'repo', p_repo);
  end if;

  select id into v_archive_status
  from task_statuses where workspace_id = v_workspace_id and is_archive limit 1;

  update task_projects tp
    set deploy_status = 'deployed', deployed_at = now()
    where tp.project_id = v_project_id
      and tp.branch = p_branch
      and tp.deploy_status = 'pending'
      and tp.task_id in (select id from tasks where owner_id = p_owner);
  get diagnostics v_marked = row_count;

  if v_archive_status is not null then
    update tasks t
      set status_id = v_archive_status, archived_at = now()
      where t.owner_id = p_owner
        and t.workspace_id = v_workspace_id
        and (t.status_id is distinct from v_archive_status)
        and t.id in (
          select task_id from task_projects
          group by task_id
          having bool_and(deploy_status = 'deployed')
        );
    get diagnostics v_archived = row_count;
  end if;

  return jsonb_build_object(
    'repo', p_repo, 'branch', p_branch,
    'marked_deployed', v_marked, 'tasks_archived', v_archived
  );
end;
$$ language plpgsql security definer;
