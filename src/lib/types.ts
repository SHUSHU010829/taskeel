// ============================================================
// taskeel — shared domain types (mirrors supabase/schema.sql)
// ============================================================

export type TaskStatus =
  | 'inbox'
  | 'active'
  | 'notify_backend'
  | 'ready_to_deploy'
  | 'archived';

export type TaskCategory = 'hotfix' | 'feature' | 'wishlist';

export type DevState = 'idle' | 'spec_ready' | 'claude' | 'blocked';

export type DeployStatus = 'pending' | 'deployed';

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
  status: TaskStatus;
  category: TaskCategory | null;
  dev_state: DevState;
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

// ---------- display metadata ----------

export const STATUS_ORDER: TaskStatus[] = [
  'inbox',
  'active',
  'notify_backend',
  'ready_to_deploy',
];

export const STATUS_META: Record<
  TaskStatus,
  { label: string; color: string }
> = {
  inbox: { label: '暫存區', color: '#6B7280' },
  active: { label: '進行中', color: '#E5A00D' },
  notify_backend: { label: '等後端', color: '#26B5CE' },
  ready_to_deploy: { label: '待部署', color: '#4CB782' },
  archived: { label: '已歸檔', color: '#6E7178' },
};

export const CATEGORY_META: Record<
  TaskCategory,
  { label: string; color: string }
> = {
  hotfix: { label: 'hotfix', color: '#EB5757' },
  feature: { label: 'feature', color: '#4CB782' },
  wishlist: { label: 'wishlist', color: '#5E6AD2' },
};

export const DEV_STATE_ORDER: DevState[] = [
  'idle',
  'spec_ready',
  'claude',
  'blocked',
];

// `ring`: 0 = faint hollow ring, 1 = full ring + filled center,
// 0<r<1 = partial arc (spinner). `pulse`/`cross` toggle animation / X mark.
export const DEV_STATE_META: Record<
  DevState,
  { label: string; color: string; ring: number; pulse?: boolean; cross?: boolean }
> = {
  idle: { label: '未開始', color: '#6B7280', ring: 0 },
  spec_ready: { label: '已規劃完成', color: '#5E6AD2', ring: 1 },
  claude: { label: 'Claude 處理中', color: '#E5A00D', ring: 0.6, pulse: true },
  blocked: { label: '卡住', color: '#EB5757', ring: 1, cross: true },
};
