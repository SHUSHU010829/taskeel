-- 0012 — a per-workspace default category. New tasks with no category given
-- (quick capture, or the new-task form) land in it automatically.
alter table categories add column if not exists is_default boolean not null default false;

-- at most one default category per workspace
create unique index if not exists categories_ws_one_default
  on categories (workspace_id) where is_default;
