// ============================================================
// taskeel — shared domain types (mirrors supabase/schema.sql)
// Flow statuses and dev states are user-editable rows (not enums).
// ============================================================

export type TaskCategory = 'hotfix' | 'feature' | 'wishlist';

export type DeployStatus = 'pending' | 'deployed';

export type DevStateStyle = 'ring' | 'filled' | 'spinner' | 'cross';

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  repo: string | null;
  created_at: string;
}

// A flow status (board column). One set per user (shared across workspaces).
export interface StatusRow {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  position: number;
  is_default: boolean; // quick capture lands here
  is_deploy: boolean; // shown in the deploy sheet
  is_archive: boolean; // hidden from board; deploy-archive target; history
  created_at: string;
}

// A development state (the status circle).
export interface DevStateRow {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  style: DevStateStyle;
  position: number;
  is_default: boolean; // quick capture starts here
  created_at: string;
}

export interface TaskProject {
  task_id: string;
  project_id: string;
  branch: string | null;
  deploy_status: DeployStatus;
  deployed_at: string | null;
}

export interface Task {
  id: string;
  workspace_id: string;
  owner_id: string;
  title: string;
  description: string;
  status_id: string | null;
  category: TaskCategory | null;
  dev_state_id: string | null;
  blocked_reason: string | null;
  needs_backend: boolean;
  deploy_notes: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

// A task joined with its per-project branch links (and the projects themselves).
export interface TaskWithProjects extends Task {
  links: Array<TaskProject & { project: Project }>;
}

// ---------- category (still a fixed set) ----------

export const CATEGORY_META: Record<
  TaskCategory,
  { label: string; color: string }
> = {
  hotfix: { label: 'hotfix', color: '#EB5757' },
  feature: { label: 'feature', color: '#4CB782' },
  wishlist: { label: 'wishlist', color: '#5E6AD2' },
};

// ---------- seed defaults (used when a user has none yet) ----------

export const DEFAULT_STATUSES: Array<
  Pick<StatusRow, 'name' | 'color' | 'is_default' | 'is_deploy' | 'is_archive'>
> = [
  { name: '暫存區', color: '#6B7280', is_default: true, is_deploy: false, is_archive: false },
  { name: '進行中', color: '#E5A00D', is_default: false, is_deploy: false, is_archive: false },
  { name: '等後端', color: '#26B5CE', is_default: false, is_deploy: false, is_archive: false },
  { name: '待部署', color: '#4CB782', is_default: false, is_deploy: true, is_archive: false },
  { name: '已歸檔', color: '#6E7178', is_default: false, is_deploy: false, is_archive: true },
];

export const DEFAULT_DEV_STATES: Array<
  Pick<DevStateRow, 'name' | 'color' | 'style'>
> = [
  { name: '未開始', color: '#6B7280', style: 'ring' },
  { name: '已規劃完成', color: '#5E6AD2', style: 'filled' },
  { name: 'Claude 處理中', color: '#E5A00D', style: 'spinner' },
  { name: '卡住', color: '#EB5757', style: 'cross' },
];

export const STATUS_COLORS = [
  '#6B7280',
  '#5E6AD2',
  '#26B5CE',
  '#4CB782',
  '#E5A00D',
  '#EB5757',
  '#B57EDC',
  '#F2994A',
];

export const DEV_STATE_STYLES: { value: DevStateStyle; label: string }[] = [
  { value: 'ring', label: '空心圈' },
  { value: 'filled', label: '實心' },
  { value: 'spinner', label: 'spinner' },
  { value: 'cross', label: '打叉' },
];
