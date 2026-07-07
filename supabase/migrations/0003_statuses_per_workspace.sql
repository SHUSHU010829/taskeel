-- ============================================================
-- Migration: 狀態改為「每 workspace 一組」
-- 需先跑過 0001、0002。可安全重跑。於 Supabase → SQL Editor 執行。
-- ============================================================

-- 1. 加 workspace_id
alter table task_statuses add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

-- 2. 先移除「每 owner 唯一」的索引（否則複製時會撞唯一鍵）
drop index if exists task_statuses_one_default;
drop index if exists task_statuses_one_archive;

-- 3. 把每個 owner 現有的狀態，複製到該 owner 的每個 workspace
insert into task_statuses (owner_id, workspace_id, name, color, style, position, is_default, is_deploy, is_archive)
select s.owner_id, w.id, s.name, s.color, s.style, s.position, s.is_default, s.is_deploy, s.is_archive
from task_statuses s
join workspaces w on w.owner_id = s.owner_id
where s.workspace_id is null;

-- 4. 把任務重新指到「自己 workspace 內同名」的新狀態
update tasks t
set status_id = ns.id
from task_statuses os, task_statuses ns
where t.status_id = os.id
  and os.workspace_id is null
  and ns.workspace_id = t.workspace_id
  and ns.name = os.name;

-- 5. 移除舊的 owner 層級（workspace_id 為 null）狀態
delete from task_statuses where workspace_id is null;

-- 6. workspace_id 設為 not null，改成「每 workspace 唯一」
alter table task_statuses alter column workspace_id set not null;
create unique index if not exists task_statuses_ws_one_default on task_statuses (workspace_id) where is_default;
create unique index if not exists task_statuses_ws_one_archive on task_statuses (workspace_id) where is_archive;
create index if not exists task_statuses_ws_pos on task_statuses (workspace_id, position);

-- 7. 歸檔函式改用「該專案所屬 workspace」的歸檔狀態
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
