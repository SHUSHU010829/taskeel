'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, GitBranch } from 'lucide-react';
import {
  type CategoryRow,
  type Project,
  type StatusRow,
  type TaskWithProjects,
  type Workspace,
} from '@/lib/types';
import StatusDot from './StatusDot';
import ConfirmDialog from './ConfirmDialog';
import MarkdownEditor from './MarkdownEditor';

export interface TaskDraft {
  title: string;
  description: string;
  status_id: string | null;
  category_id: string | null;
  blocked_reason: string | null;
  needs_backend: boolean;
  deploy_notes: string;
  links: Array<{ project_id: string; branch: string }>;
}

// Create / edit modal. `task` null = new task.
export default function TaskEditor({
  task,
  projects,
  statuses,
  categories,
  workspaces,
  currentWorkspaceId,
  onSave,
  onMoveWorkspace,
  onClose,
  onDelete,
}: {
  task: TaskWithProjects | null;
  projects: Project[];
  statuses: StatusRow[];
  categories: CategoryRow[];
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  onSave: (draft: TaskDraft) => void;
  onMoveWorkspace: (wsId: string) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const defaultStatus = statuses.find((s) => s.is_default) ?? statuses[0];

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [statusId, setStatusId] = useState<string | null>(
    task?.status_id ?? defaultStatus?.id ?? null
  );
  const [categoryId, setCategoryId] = useState<string | null>(task?.category_id ?? null);
  const [blockedReason, setBlockedReason] = useState(task?.blocked_reason ?? '');
  const [needsBackend, setNeedsBackend] = useState(task?.needs_backend ?? false);
  const [deployNotes, setDeployNotes] = useState(task?.deploy_notes ?? '');

  const [branches, setBranches] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    task?.links.forEach((l) => (m[l.project_id] = l.branch ?? ''));
    return m;
  });
  // Reading-first: existing tasks open with settings collapsed; new tasks
  // expand so you can fill them in.
  const [showSettings, setShowSettings] = useState(task === null);
  const [moveTo, setMoveTo] = useState<Workspace | null>(null);

  const selected = statuses.find((s) => s.id === statusId);
  const isBlocked = selected?.style === 'cross';
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedProjects = projects.filter((p) => p.id in branches);

  function toggleProject(id: string) {
    setBranches((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = '';
      return next;
    });
  }

  function save() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description,
      status_id: statusId,
      category_id: categoryId,
      blocked_reason: isBlocked ? blockedReason || null : null,
      needs_backend: needsBackend,
      deploy_notes: deployNotes,
      links: Object.entries(branches).map(([project_id, branch]) => ({
        project_id,
        branch,
      })),
    });
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <input
          className="modal-title-input"
          autoFocus
          placeholder="任務標題"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
          }}
        />
        <MarkdownEditor
          value={description}
          onChange={setDescription}
          startInEdit={task === null}
        />

        {/* settings toggle + compact summary when collapsed */}
        <div className="settings-bar">
          <button
            className="settings-toggle"
            onClick={() => setShowSettings((s) => !s)}
          >
            {showSettings ? (
              <>
                收合設定 <ChevronUp size={13} />
              </>
            ) : (
              <>
                設定 <ChevronDown size={13} />
              </>
            )}
          </button>
          {!showSettings && (
            <div className="settings-summary" onClick={() => setShowSettings(true)}>
              {selected && (
                <span className="summary-chip">
                  <StatusDot color={selected.color} style={selected.style} sm />
                  {selected.name}
                </span>
              )}
              {selectedCategory && (
                <span className="summary-chip">
                  <span
                    className="dot"
                    style={{ background: selectedCategory.color, width: 6, height: 6 }}
                  />
                  {selectedCategory.name}
                </span>
              )}
              {selectedProjects.map((p) => (
                <span className="summary-chip" key={p.id}>
                  <span className="dot" style={{ background: p.color, width: 6, height: 6 }} />
                  {p.name}
                  {branches[p.id] && (
                    <span className="branch">
                      <GitBranch size={11} /> {branches[p.id]}
                    </span>
                  )}
                </span>
              ))}
              {task?.needs_backend && <span className="badge-backend">後端</span>}
            </div>
          )}
        </div>

        {showSettings && (
        <>
        {/* workspace (move) — existing tasks only */}
        {task && workspaces.length > 1 && (
          <div className="field">
            <div className="field-label">工作區</div>
            <div className="option-row">
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  className={`option${w.id === currentWorkspaceId ? ' selected' : ''}`}
                  onClick={() => {
                    if (w.id !== currentWorkspaceId) setMoveTo(w);
                  }}
                >
                  <span className="dot" style={{ background: w.color }} />
                  {w.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* status */}
        <div className="field">
          <div className="field-label">狀態</div>
          <div className="option-row">
            {statuses.map((s) => (
              <button
                key={s.id}
                className={`option${statusId === s.id ? ' selected' : ''}`}
                onClick={() => setStatusId(s.id)}
              >
                <StatusDot color={s.color} style={s.style} sm />
                {s.name}
              </button>
            ))}
          </div>
          {isBlocked && (
            <input
              className="text-input"
              style={{ marginTop: 8 }}
              placeholder="卡在什麼？（如：等 Twitch API 回覆）"
              value={blockedReason}
              onChange={(e) => setBlockedReason(e.target.value)}
            />
          )}
        </div>

        {/* category */}
        <div className="field">
          <div className="field-label">分類</div>
          <div className="option-row">
            {categories.map((c) => (
              <button
                key={c.id}
                className={`option${categoryId === c.id ? ' selected' : ''}`}
                onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
              >
                <span className="cat-dot" style={{ background: c.color }} />
                {c.name}
              </button>
            ))}
            {categories.length === 0 && (
              <span style={{ color: 'var(--text-faint)', fontSize: '0.8rem' }}>
                尚無分類，可到工作區設定新增。
              </span>
            )}
          </div>
        </div>

        {/* projects + per-project branch */}
        <div className="field">
          <div className="field-label">專案與分支</div>
          {projects.length === 0 && (
            <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>
              此工作環境還沒有專案。
            </div>
          )}
          <div className="option-row">
            {projects.map((p) => (
              <button
                key={p.id}
                className={`option${p.id in branches ? ' selected' : ''}`}
                onClick={() => toggleProject(p.id)}
              >
                <span className="dot" style={{ background: p.color }} />
                {p.name}
              </button>
            ))}
          </div>
          {projects
            .filter((p) => p.id in branches)
            .map((p) => (
              <div className="branch-field" key={p.id}>
                <span className="proj-name" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {p.name} <GitBranch size={12} />
                </span>
                <input
                  className="text-input"
                  placeholder="分支名稱（如 feat/gacha）"
                  value={branches[p.id]}
                  onChange={(e) =>
                    setBranches((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                />
              </div>
            ))}
        </div>

        {/* backend + deploy notes */}
        <div className="field">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={needsBackend}
              onChange={(e) => setNeedsBackend(e.target.checked)}
            />
            通知後端也需加入代辦
          </label>
        </div>

        <div className="field">
          <div className="field-label">部署提醒</div>
          <textarea
            className="textarea"
            placeholder="本次部署要處理的事、提醒…"
            value={deployNotes}
            onChange={(e) => setDeployNotes(e.target.value)}
          />
        </div>
        </>
        )}

        <div className="modal-actions">
          {onDelete && (
            <button
              className="btn btn-ghost"
              style={{ marginRight: 'auto', color: '#EB5757' }}
              onClick={onDelete}
            >
              刪除
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" disabled={!title.trim()} onClick={save}>
            儲存
          </button>
        </div>
      </div>

      {moveTo && (
        <ConfirmDialog
          title="搬移工作區"
          message={`把此任務搬到「${moveTo.name}」？\n專案與分支關聯會被清除（專案綁定各自的工作區），並套用該工作區的預設狀態。`}
          confirmLabel="搬移"
          onConfirm={() => {
            const id = moveTo.id;
            setMoveTo(null);
            onMoveWorkspace(id);
          }}
          onCancel={() => setMoveTo(null)}
        />
      )}
    </div>
  );
}
