'use client';

import { useState } from 'react';
import {
  ArrowUpFromLine,
  Check,
  CornerUpLeft,
  GitBranch,
  Link2,
  Pencil,
  Plus,
  Settings2,
} from 'lucide-react';
import {
  type CategoryRow,
  type Project,
  type StatusRow,
  type Task,
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
// Existing tasks auto-save every control change (onPatch / onSetProjects); the
// title and description are read-only until you press their edit affordance.
// New tasks accumulate a draft and commit once via 建立任務 (onSave).
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
  onPatch,
  onSetProjects,
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
  onPatch: (patch: Partial<Task>) => void;
  onSetProjects: (links: Array<{ project_id: string; branch: string }>) => void;
  onAddSubtask: (title: string) => void;
  onOpenTask: (t: TaskWithProjects) => void;
  onMoveWorkspace: (wsId: string) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const isNew = !task;
  const defaultStatus = statuses.find((s) => s.is_default) ?? statuses[0];

  const [title, setTitle] = useState(task?.title ?? '');
  const [editingTitle, setEditingTitle] = useState(isNew);
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
  const [showSettings, setShowSettings] = useState(false);
  const [moveTo, setMoveTo] = useState<Workspace | null>(null);
  const [newSubtask, setNewSubtask] = useState('');
  const [boundIds, setBoundIds] = useState<string[]>(bundleMemberIds);
  const [bundleFilter, setBundleFilter] = useState('');
  const canHaveSubtasks = !!task && !task.parent_id;

  const selected = statuses.find((s) => s.id === statusId);
  const isBlocked = selected?.style === 'cross';
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedProjects = projects.filter((p) => p.id in branches);

  const linksArray = (b: Record<string, string>) =>
    Object.entries(b).map(([project_id, branch]) => ({ project_id, branch }));

  // Persist a field patch immediately (existing tasks only; new tasks stay
  // local until 建立任務).
  const commit = (patch: Partial<Task>) => {
    if (!isNew) onPatch(patch);
  };

  function chooseStatus(id: string) {
    setStatusId(id);
    const st = statuses.find((s) => s.id === id);
    const patch: Partial<Task> = { status_id: id };
    if (st?.style !== 'cross') {
      setBlockedReason('');
      patch.blocked_reason = null;
    }
    commit(patch);
  }

  function chooseCategory(id: string) {
    const next = categoryId === id ? null : id;
    setCategoryId(next);
    commit({ category_id: next });
  }

  function toggleProject(id: string) {
    const next = { ...branches };
    if (id in next) delete next[id];
    else next[id] = '';
    setBranches(next);
    if (!isNew) onSetProjects(linksArray(next));
  }

  function commitBranches() {
    if (!isNew) onSetProjects(linksArray(branches));
  }

  function toggleBackend() {
    const next = !needsBackend;
    setNeedsBackend(next);
    commit({ needs_backend: next });
  }

  function create() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description,
      status_id: statusId,
      category_id: categoryId,
      blocked_reason: isBlocked ? blockedReason || null : null,
      needs_backend: needsBackend,
      deploy_notes: deployNotes,
      links: linksArray(branches),
    });
  }

  // Closing flushes any pending description edit (its onChange keeps `description`
  // live, but the DB only updates on 儲存 — so persist it here too, if changed).
  function closeEditor() {
    if (task && description !== (task.description ?? '')) onPatch({ description });
    onClose();
  }

  function commitTitle() {
    const t = title.trim();
    if (!t) {
      if (task) setTitle(task.title); // revert empty back to the saved title
      setEditingTitle(false);
      return;
    }
    if (task && t !== task.title) onPatch({ title: t });
    setEditingTitle(false);
  }

  function addSubtaskNow() {
    if (!newSubtask.trim()) return;
    onAddSubtask(newSubtask.trim());
    setNewSubtask('');
  }

  function toggleBound(id: string) {
    const next = boundIds.includes(id) ? boundIds.filter((x) => x !== id) : [...boundIds, id];
    setBoundIds(next);
    onSetBundle(next);
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
              主任務
            </span>
            <button className="parent-chip lg" onClick={() => onOpenTask(parentTask)}>
              <CornerUpLeft size={13} />
              {parentTask.title}
            </button>
            <button
              className="btn btn-ghost promote-btn"
              title="脫離主任務，成為獨立的主任務（可加入部署綁定）"
              onClick={onDetachParent}
            >
              <ArrowUpFromLine size={13} /> 升為主任務
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
                placeholder="拆一個子任務…（繼承主任務的專案/狀態/分類）"
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
                有子任務後，此主任務不顯示在看板，改由子任務呈現。
              </div>
            )}
          </div>
        )}
      </div>
    ) : null;

  return (
    <div className="overlay" onMouseDown={isNew ? onClose : closeEditor}>
      <div className="modal editor-modal" onMouseDown={(e) => e.stopPropagation()}>
        {isNew ? (
          <input
            className="modal-title-input"
            autoFocus
            placeholder="任務標題"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) create();
            }}
          />
        ) : editingTitle ? (
          <input
            className="modal-title-input"
            autoFocus
            placeholder="任務標題"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            {...enterSubmit(commitTitle)}
          />
        ) : (
          <div className="editor-title-view">
            <h2 className="editor-title-text">{title}</h2>
            <button
              className="icon-btn"
              title="編輯標題"
              onClick={() => setEditingTitle(true)}
            >
              <Pencil size={15} />
            </button>
          </div>
        )}

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
                        onClick={() => chooseStatus(s.id)}
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
                      onBlur={() => commit({ blocked_reason: blockedReason || null })}
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
                        onClick={() => chooseCategory(c.id)}
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
                          onBlur={commitBranches}
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
                    onBlur={() => commit({ deploy_notes: deployNotes })}
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
                      onClick={toggleBackend}
                    >
                      <span className="toggle-knob" />
                    </button>
                  </div>
                </div>

                {/* deploy bundle — top-level (主任務) existing tasks only */}
                {task && !task.parent_id && (
                  <div className="field">
                    <div className="field-label">部署綁定（需一併部署的主任務）</div>
                    {boundCandidates.length > 0 ? (
                      <div className="bundle-current">
                        <Link2 size={13} />
                        已綁定 {boundCandidates.length} 個任務，部署時會一併提醒。
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-faint)', fontSize: '0.8rem', marginBottom: 6 }}>
                        勾選其他待部署的任務，讓它們與此任務同一次部署。
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
                        目前沒有其他待部署的主任務可綁定。
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
                onSave={() => commit({ description })}
                startInEdit={isNew}
              />
            </>
          )}
        </div>

        <div className="modal-actions">
          {isNew ? (
            <>
              <button className="btn btn-ghost" onClick={onClose}>
                取消
              </button>
              <button className="btn btn-primary" disabled={!title.trim()} onClick={create}>
                建立任務
              </button>
            </>
          ) : (
            <>
              {onDelete && (
                <button
                  className="btn btn-ghost"
                  style={{ marginRight: 'auto', color: '#EB5757' }}
                  onClick={onDelete}
                >
                  刪除
                </button>
              )}
              <button className="btn btn-primary" onClick={closeEditor}>
                完成
              </button>
            </>
          )}
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
