-- 0010 — project documents, task↔document references, and per-task comments.
-- Run after 0001–0009. Safe to re-run.

-- Per-project reference documents (markdown body, optional URL).
create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id   uuid references projects(id) on delete cascade,
  title        text not null,
  body         text not null default '',
  url          text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists documents_project_idx on documents(project_id);
create index if not exists documents_workspace_idx on documents(workspace_id);

-- A task can reference specific documents (參考資料).
create table if not exists task_documents (
  task_id     uuid not null references tasks(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  primary key (task_id, document_id)
);

-- Per-task discussion / notes (questions for supervisor, small notes…).
create table if not exists comments (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  task_id    uuid not null references tasks(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_task_idx on comments(task_id, created_at);

alter table documents      enable row level security;
alter table task_documents enable row level security;
alter table comments       enable row level security;

drop policy if exists "own documents" on documents;
create policy "own documents" on documents
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "own comments" on comments;
create policy "own comments" on comments
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "own task_documents" on task_documents;
create policy "own task_documents" on task_documents
  for all using (
    task_id in (select id from tasks where owner_id = auth.uid())
  ) with check (
    task_id in (select id from tasks where owner_id = auth.uid())
  );

grant select, insert, update, delete on
  public.documents, public.task_documents, public.comments
  to authenticated;

alter publication supabase_realtime add table documents;
alter publication supabase_realtime add table task_documents;
alter publication supabase_realtime add table comments;
