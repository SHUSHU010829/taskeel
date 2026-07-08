-- 0008 — task priority + due date.
-- priority: 0 none, 1 low, 2 medium, 3 high, 4 urgent (higher = more urgent).
alter table tasks add column if not exists priority smallint not null default 0;
alter table tasks add column if not exists due_date date;
create index if not exists tasks_priority_idx on tasks(priority);
create index if not exists tasks_due_date_idx on tasks(due_date);
