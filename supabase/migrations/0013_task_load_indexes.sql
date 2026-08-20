-- 0013 — indexes for the initial board load and the archive/history view.
-- The board query filters by workspace and orders by created_at (newest first);
-- the history view filters archived tasks and orders by archived_at.
create index if not exists tasks_ws_created on tasks (workspace_id, created_at desc);
create index if not exists tasks_ws_archived on tasks (workspace_id, archived_at desc);
