-- 0006 — give each workspace an icon (shown in the collapsed sidebar rail).
-- Nullable; the UI falls back to a diamond when unset.
alter table workspaces add column if not exists icon text;
