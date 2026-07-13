-- 0009 — short aliases for quick-capture. `@abbr` / `#abbr` match a project or
-- category in addition to its full name.
alter table projects add column if not exists abbr text;
alter table categories add column if not exists abbr text;
