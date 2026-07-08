// ============================================================
// taskeel — shared domain types (mirrors supabase/schema.sql)
// A task has ONE status: it drives both the board column and the row icon.
// ============================================================

export type DeployStatus = 'pending' | 'deployed';

// Icon styles a status can render as.
export type StatusStyle =
  | 'ring'
  | 'dashed'
  | 'half'
  | 'filled'
  | 'spinner'
  | 'check'
  | 'cross'
  | 'dot';

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

// A status = one board column + its icon. One set per workspace.
export interface StatusRow {
  id: string;
  owner_id: string;
  workspace_id: string;
  name: string;
  color: string;
  style: StatusStyle;
  position: number;
  is_default: boolean; // quick capture lands here
  is_deploy: boolean; // shown in the deploy sheet
  is_archive: boolean; // hidden from board; deploy-archive target; history
  created_at: string;
}

// A category (tag), per workspace, user-editable.
export interface CategoryRow {
  id: string;
  owner_id: string;
  workspace_id: string;
  name: string;
  color: string;
  position: number;
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
  category_id: string | null;
  parent_id: string | null; // set on subtasks (points at the parent task)
  blocked_reason: string | null; // shown when the status style is `cross`
  needs_backend: boolean;
  deploy_notes: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface TaskWithProjects extends Task {
  links: Array<TaskProject & { project: Project }>;
}

// ---------- seed defaults (used when a user has none yet) ----------

export const DEFAULT_CATEGORIES: Array<Pick<CategoryRow, 'name' | 'color'>> = [
  { name: 'hotfix', color: '#EB5757' },
  { name: 'feature', color: '#4CB782' },
  { name: 'wishlist', color: '#5E6AD2' },
];

export const DEFAULT_STATUSES: Array<
  Pick<StatusRow, 'name' | 'color' | 'style' | 'is_default' | 'is_deploy' | 'is_archive'>
> = [
  { name: '暫存區', color: '#6B7280', style: 'dashed', is_default: true, is_deploy: false, is_archive: false },
  { name: '進行中', color: '#E5A00D', style: 'half', is_default: false, is_deploy: false, is_archive: false },
  { name: '等後端', color: '#26B5CE', style: 'spinner', is_default: false, is_deploy: false, is_archive: false },
  { name: '卡住', color: '#EB5757', style: 'cross', is_default: false, is_deploy: false, is_archive: false },
  { name: '待部署', color: '#4CB782', style: 'filled', is_default: false, is_deploy: true, is_archive: false },
  { name: '已歸檔', color: '#6E7178', style: 'check', is_default: false, is_deploy: false, is_archive: true },
];

export const STATUS_COLORS = [
  '#8A8F98', // slate
  '#6B7280', // gray
  '#5E6AD2', // indigo
  '#7C8CF8', // periwinkle
  '#4C8DF5', // blue
  '#26B5CE', // cyan
  '#3DB9A0', // teal
  '#4CB782', // green
  '#8FC740', // lime
  '#E5C044', // yellow
  '#E5A00D', // amber
  '#F2994A', // orange
  '#EB5757', // red
  '#F2688E', // pink
  '#B57EDC', // purple
  '#9B59B6', // magenta
];

export const STATUS_STYLES: { value: StatusStyle; label: string }[] = [
  { value: 'ring', label: '空心圈' },
  { value: 'dashed', label: '虛線圈' },
  { value: 'half', label: '半實心' },
  { value: 'filled', label: '實心' },
  { value: 'spinner', label: '轉圈' },
  { value: 'check', label: '打勾' },
  { value: 'cross', label: '打叉' },
  { value: 'dot', label: '圓點' },
];
