-- ============================================================
-- Migration: 合併流程狀態與開發狀態成「單一狀態」
-- 每個任務只有一個 status；status 帶 style（圖示），dev_states 移除。
-- 需先跑過 0001。可安全重跑。於 Supabase → SQL Editor 執行。
-- ============================================================

-- 1. task_statuses 加 style 欄位（text，圖示樣式）
alter table task_statuses add column if not exists style text not null default 'ring';

-- 2. 依名稱/角色回填合理的圖示
update task_statuses set style = case
    when name = '暫存區' then 'dashed'
    when name = '進行中' then 'half'
    when name = '等後端' then 'spinner'
    when name = '待部署' then 'filled'
    when name = '已歸檔' then 'check'
    when is_archive then 'check'
    when is_deploy  then 'filled'
    when is_default then 'dashed'
    else 'ring'
  end
where style = 'ring';

-- 3. 移除開發狀態：先丟 tasks 的 FK 欄位，再丟表與型別
alter table tasks drop column if exists dev_state_id;
drop table if exists dev_states;
drop type if exists dev_state_style;

-- （blocked_reason 保留；當某狀態 style = 'cross' 時才有意義）
-- 若想保留「卡住」的概念，到 App 的「狀態設定」新增一個 style 選「打叉」的狀態即可。
