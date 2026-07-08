-- 0007 — deploy bundles: tasks that must ship in the same deploy.
-- Tasks sharing a bundle_id are "deploy-together"; the app reminds you of the
-- other members when one of them is up for deploy. A plain grouping key (no
-- separate table): a bundle is simply the set of tasks with the same id.
alter table tasks add column if not exists bundle_id uuid;
create index if not exists tasks_bundle_id_idx on tasks(bundle_id);
