-- ============================================================
-- Migration: 分類改為「每 workspace 一組、可自訂」
-- 需先跑過 0001~0003。可安全重跑。於 Supabase → SQL Editor 執行。
-- ============================================================

-- 1. categories 表
create table if not exists categories (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  color        text not null default '#5E6AD2',
  position     int  not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists categories_ws_pos on categories (workspace_id, position);

alter table categories enable row level security;
drop policy if exists "own categories" on categories;
create policy "own categories" on categories
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.categories to authenticated;

do $$ begin
  alter publication supabase_realtime add table categories;
exception when duplicate_object then null; end $$;

-- 2. 為每個 workspace 種預設分類（沒有才種）
insert into categories (owner_id, workspace_id, name, color, position)
select w.owner_id, w.id, x.name, x.color, x.position
from workspaces w
cross join (values
  ('hotfix',   '#EB5757', 0),
  ('feature',  '#4CB782', 1),
  ('wishlist', '#5E6AD2', 2)
) as x(name, color, position)
where not exists (select 1 from categories c where c.workspace_id = w.id);

-- 3. tasks 加 category_id，從舊 enum 回填，再丟掉舊欄位/型別
alter table tasks add column if not exists category_id uuid references categories(id) on delete set null;

do $$ begin
  if exists (select 1 from information_schema.columns
             where table_name = 'tasks' and column_name = 'category') then
    update tasks t set category_id = c.id
    from categories c
    where c.workspace_id = t.workspace_id
      and t.category_id is null
      and t.category is not null
      and c.name = t.category::text;
  end if;
end $$;

alter table tasks drop column if exists category;
drop type if exists task_category;
