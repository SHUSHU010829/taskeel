-- 0014 — a seeding race could insert the default categories twice for a
-- workspace. De-duplicate (keeping the earliest of each name and repointing any
-- tasks to it), then enforce one category name per workspace so it can't recur.

-- repoint tasks that referenced a duplicate row to the kept (earliest) one
update tasks t
set category_id = k.keep_id
from (
  select id,
         first_value(id) over (
           partition by workspace_id, name order by created_at, id
         ) as keep_id
  from categories
) k
where t.category_id = k.id and k.id <> k.keep_id;

-- delete the duplicate rows (keep row_number = 1)
delete from categories c
using (
  select id,
         row_number() over (
           partition by workspace_id, name order by created_at, id
         ) as rn
  from categories
) d
where c.id = d.id and d.rn > 1;

-- prevent it from happening again
create unique index if not exists categories_ws_name_unique
  on categories (workspace_id, name);
