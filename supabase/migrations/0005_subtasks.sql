-- ============================================================
-- Migration: 子任務（母任務拆分）
-- 需先跑過 0001~0004。可安全重跑。於 Supabase → SQL Editor 執行。
-- 一個 task 可有 parent_id 指向母任務；刪母任務時子任務改為 null（變回一般任務）。
-- ============================================================

alter table tasks add column if not exists parent_id uuid references tasks(id) on delete set null;
create index if not exists tasks_parent_id on tasks (parent_id);
