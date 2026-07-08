'use client';

import { useState } from 'react';
import { ArrowUpFromLine, Check, CornerUpLeft, GitBranch, Link2, Plus, Settings2 } from 'lucide-react';
import {
  type CategoryRow,
  type Project,
  type StatusRow,
  type TaskWithProjects,
  type Workspace,
} from '@/lib/types';
import { enterSubmit } from '@/lib/useEnterSubmit';
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
  subtasks,
  parentTask,
  bundleCandidates,
  bundleMemberIds,
  onSetBundle,
  onDetachParent,
  onSave,
  onAddSubtask,
  onOpenTask,
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
  subtasks: TaskWithProjects[];
  parentTask: TaskWithProjects | null;
  bundleCandidates: Array<{ id: string; title: string; status_id: string | null }>;
  bundleMemberIds: string[];
  onSetBundle: (otherIds: string[]) => void;
  onDetachParent: () => void;
  onSave: (draft: TaskDraft) => void;
  onAddSubtask: (title: string) => void;
  onOpenTask: (t: TaskWithProjects) => void;
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
  // Settings open as an overlay over the description when the 設定 button is
  // clicked; closed by default so the title + description read first.
  const [showSettings, setShowSettings] = useState(false);
  const [moveTo, setMoveTo] = useState<Workspace | null>(null);
  const [newSubtask, setNewSubtask] = useState('');
  // deploy bundle: ids of tasks that must ship together with this one
  const [boundIds, setBoundIds] = useState<string[]>(bundleMemberIds);
  const [bundleFilter, setBundleFilter] = useState('');
  // Only top-level, already-saved tasks can hold subtasks.
  const canHaveSubtasks = !!task && !task.parent_id;

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

  function addSubtaskNow() {
    if (!newSubtask.trim()) return;
    onAddSubtask(newSubtask.trim());
    setNewSubtask('');
  }

  function toggleBound(id: string) {
    setBoundIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      onSetBundle(next);
      return next;
    });
  }

  const filteredCandidates = bundleFilter.trim()
    ? bundleCandidates.filter((c) => c.title.toLowerCase().includes(bundleFilter.trim().toLowerCase()))
    : bundleCandidates;
  const boundCandidates = bundleCandidates.filter((c) => boundIds.includes(c.id));

  // Subtasks / parent link — shown next to the description (commonly used).
  const subtaskBlock =
    parentTask || canHaveSubtasks ? (
      <div className="ed-section">
        {parentTask && (
          <div className="ed-parent">
            <span className="field-label" style={{ margin: 0 }}>
              母任務
            </span>
            <button className="parent-chip lg" onClick={() => onOpenTask(parentTask)}>
              <CornerUpLeft size={13} />
              {parentTask.title}
            </button>
            <button
              className="btn btn-ghost promote-btn"
              title="脫離母任務，成為獨立的母任務（可加入部署綁定）"
              onClick={onDetachParent}
            >
              <ArrowUpFromLine size={13} /> 升為母任務
            </button>
          </div>
        )}
        {canHaveSubtasks && (
          <div>
            <div className="field-label" style={{ marginTop: parentTask ? 10 : 0 }}>
              子任務{subtasks.length > 0 ? `（${subtasks.length}）` : ''}
            </div>
            {subtasks.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                {subtasks.map((st) => {
                  const s = statuses.find((x) => x.id === st.status_id);
                  return (
                    <button
                      key={st.id}
                      className="subtask-item"
                      onClick={() => onOpenTask(st)}
                    >
                      {s && <StatusDot color={s.color} style={s.style} sm />}
                      <span className="subtask-title">{st.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="branch-field" style={{ marginTop: 0 }}>
              <input
                className="text-input"
                placeholder="拆一個子任務…（繼承母任務的專案/狀態/分類）"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                {...enterSubmit(addSubtaskNow)}
              />
              <button className="btn btn-primary" onClick={addSubtaskNow}>
                <Plus size={14} />
              </button>
            </div>
            {subtasks.length > 0 && (
              <div style={{ color: 'var(--text-faint)', fontSize: '0.78rem', marginTop: 6 }}>
                有子任務後，此母任務不顯示在看板，改由子任務呈現。
              </div>
            )}
          </div>
        )}
      </div>
    ) : null;

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal editor-modal" onMouseDown={(e) => e.stopPropagation()}>
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

        {/* control bar: settings button + compact summary */}
        <div className="editor-bar">
          <button
            className={`settings-toggle${showSettings ? ' on' : ''}`}
            onClick={() => setShowSettings((s) => !s)}
          >
            <Settings2 size={14} /> 設定
          </button>
          <div className="settings-summary">
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
            {needsBackend && <span className="badge-backend">後端</span>}
          </div>
        </div>

        <div className="editor-body">
          {showSettings ? (
            <div className="settings-inline">
                {/* workspace (move) — existing tasks only */}
                {task && workspaces.length > 1 && (
                  <div className="field" style={{ marginTop: 0 }}>
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
                <div className="field" style={task && workspaces.length > 1 ? {} : { marginTop: 0 }}>
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
                        <span
                          className="proj-name"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
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

                {/* deploy notes */}
                <div className="field">
                  <div className="field-label">部署提醒</div>
                  <textarea
                    className="textarea"
                    placeholder="本次部署要處理的事、提醒…"
                    value={deployNotes}
                    onChange={(e) => setDeployNotes(e.target.value)}
                  />
                </div>

                {/* backend toggle */}
                <div className="field">
                  <div className="toggle-row">
                    <span>需後端部署</span>
                    <button
                      type="button"
                      className={`toggle${needsBackend ? ' on' : ''}`}
                      role="switch"
                      aria-checked={needsBackend}
                      onClick={() => setNeedsBackend((v) => !v)}
                    >
                      <span className="toggle-knob" />
                    </button>
                  </div>
                </div>

                {/* deploy bundle — top-level (母任務) existing tasks only */}
                {task && !task.parent_id && (
                  <div className="field">
                    <div className="field-label">部署綁定（需一併部署的母任務）</div>
                    {boundCandidates.length > 0 ? (
                      <div className="bundle-current">
                        <Link2 size={13} />
                        已綁定 {boundCandidates.length} 個任務，部署時會一併提醒。
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-faint)', fontSize: '0.8rem', marginBottom: 6 }}>
                        勾選其他任務，讓它們與此任務同一次部署。
                      </div>
                    )}
                    {bundleCandidates.length > 6 && (
                      <input
                        className="text-input"
                        style={{ marginBottom: 6 }}
                        placeholder="搜尋任務…"
                        value={bundleFilter}
                        onChange={(e) => setBundleFilter(e.target.value)}
                      />
                    )}
                    {bundleCandidates.length === 0 ? (
                      <div style={{ color: 'var(--text-faint)', fontSize: '0.8rem' }}>
                        此工作區沒有其他可綁定的任務。
                      </div>
                    ) : (
                      <div className="bundle-list">
                        {filteredCandidates.map((c) => {
                          const s = statuses.find((x) => x.id === c.status_id);
                          const on = boundIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              className={`bundle-item${on ? ' on' : ''}`}
                              onClick={() => toggleBound(c.id)}
                            >
                              <span className={`bundle-check${on ? ' on' : ''}`}>
                                {on && <Check size={12} />}
                              </span>
                              {s && <StatusDot color={s.color} style={s.style} sm />}
                              <span className="bundle-item-title">{c.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
            </div>
          ) : (
            <>
              {subtaskBlock}
              <MarkdownEditor
                value={description}
                onChange={setDescription}
                startInEdit={task === null}
              />
            </>
          )}
        </div>

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
