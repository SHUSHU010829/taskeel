-- 0011 — task origin: a task that branched off from another keeps a reference
-- to it (a "延伸自" link). Independent of parent_id (subtasks) and bundle_id.
alter table tasks add column if not exists origin_id uuid references tasks(id) on delete set null;
create index if not exists tasks_origin_id_idx on tasks(origin_id);
