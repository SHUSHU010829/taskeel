-- ============================================================
-- Migration: 把寫死的 status / dev_state enum 改為可自訂資料表
-- 對「已經有資料」的專案執行一次。全新安裝請直接用 schema.sql。
-- 於 Supabase → SQL Editor 貼上執行。可安全重跑（有 guard）。
-- ============================================================

-- 1. 樣式 enum
do $$ begin
  if not exists (select 1 from pg_type where typname = 'dev_state_style') then
    create type dev_state_style as enum ('ring', 'filled', 'spinner', 'cross');
  end if;
end $$;

-- 2. 新資料表
create table if not exists task_statuses (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#6B7280',
  position   int  not null default 0,
  is_default boolean not null default false,
  is_deploy  boolean not null default false,
  is_archive boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists task_statuses_one_default on task_statuses (owner_id) where is_default;
create unique index if not exists task_statuses_one_archive on task_statuses (owner_id) where is_archive;
create index if not exists task_statuses_owner_pos on task_statuses (owner_id, position);

create table if not exists dev_states (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#6B7280',
  style      dev_state_style not null default 'ring',
  position   int  not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists dev_states_one_default on dev_states (owner_id) where is_default;
create index if not exists dev_states_owner_pos on dev_states (owner_id, position);

-- 3. RLS + grants
alter table task_statuses enable row level security;
alter table dev_states    enable row level security;

drop policy if exists "own task_statuses" on task_statuses;
create policy "own task_statuses" on task_statuses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "own dev_states" on dev_states;
create policy "own dev_states" on dev_states
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.task_statuses, public.dev_states to authenticated;

-- 4. Realtime (重複加入會報錯，忽略)
do $$ begin
  alter publication supabase_realtime add table task_statuses;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table dev_states;
exception when duplicate_object then null; end $$;

-- 5. 為每個既有 owner 種預設狀態（沒有才種，可重跑）
insert into task_statuses (owner_id, name, color, position, is_default, is_deploy, is_archive)
select w.owner_id, x.name, x.color, x.position, x.is_default, x.is_deploy, x.is_archive
from (select distinct owner_id from workspaces) w
cross join (values
  ('暫存區', '#6B7280', 0, true,  false, false),
  ('進行中', '#E5A00D', 1, false, false, false),
  ('等後端', '#26B5CE', 2, false, false, false),
  ('待部署', '#4CB782', 3, false, true,  false),
  ('已歸檔', '#6E7178', 4, false, false, true)
) as x(name, color, position, is_default, is_deploy, is_archive)
where not exists (select 1 from task_statuses ts where ts.owner_id = w.owner_id);

insert into dev_states (owner_id, name, color, style, position, is_default)
select w.owner_id, x.name, x.color, x.style::dev_state_style, x.position, x.is_default
from (select distinct owner_id from workspaces) w
cross join (values
  ('未開始',        '#6B7280', 'ring',    0, true),
  ('已規劃完成',    '#5E6AD2', 'filled',  1, false),
  ('Claude 處理中', '#E5A00D', 'spinner', 2, false),
  ('卡住',          '#EB5757', 'cross',   3, false)
) as x(name, color, style, position, is_default)
where not exists (select 1 from dev_states ds where ds.owner_id = w.owner_id);

-- 6. tasks 加新欄位
alter table tasks add column if not exists status_id    uuid references task_statuses(id) on delete set null;
alter table tasks add column if not exists dev_state_id uuid references dev_states(id)    on delete set null;

-- 7. 回填：舊 enum → 新的列（只填尚未有值的）
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_name = 'tasks' and column_name = 'status') then
    update tasks t set status_id = s.id
    from task_statuses s
    where s.owner_id = t.owner_id and t.status_id is null
      and s.name = case t.status::text
        when 'inbox'           then '暫存區'
        when 'active'          then '進行中'
        when 'notify_backend'  then '等後端'
        when 'ready_to_deploy' then '待部署'
        when 'archived'        then '已歸檔' end;
  end if;

  if exists (select 1 from information_schema.columns
             where table_name = 'tasks' and column_name = 'dev_state') then
    update tasks t set dev_state_id = d.id
    from dev_states d
    where d.owner_id = t.owner_id and t.dev_state_id is null
      and d.name = case t.dev_state::text
        when 'idle'       then '未開始'
        when 'spec_ready' then '已規劃完成'
        when 'claude'     then 'Claude 處理中'
        when 'blocked'    then '卡住' end;
  end if;
end $$;

create index if not exists tasks_workspace_status_id on tasks (workspace_id, status_id);

-- 8. 更新歸檔函式（改用 status_id）
create or replace function archive_branch(p_repo text, p_branch text, p_owner uuid)
returns jsonb as $$
declare
  v_project_id uuid;
  v_archive_status uuid;
  v_marked int := 0;
  v_archived int := 0;
begin
  select pr.id into v_project_id
  from projects pr
  join workspaces w on w.id = pr.workspace_id
  where pr.repo = p_repo and w.owner_id = p_owner
  limit 1;

  if v_project_id is null then
    return jsonb_build_object('error', 'project not found for repo', 'repo', p_repo);
  end if;

  select id into v_archive_status
  from task_statuses where owner_id = p_owner and is_archive limit 1;

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

-- 9. 丟掉舊的 enum 欄位與型別
alter table tasks drop column if exists status;
alter table tasks drop column if exists dev_state;
drop type if exists task_status;
drop type if exists dev_state;
