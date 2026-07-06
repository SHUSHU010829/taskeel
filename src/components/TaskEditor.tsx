'use client';

import { useState } from 'react';
import {
  CATEGORY_META,
  DEV_STATE_ORDER,
  DEV_STATE_META,
  type DevState,
  type Project,
  type TaskCategory,
  type TaskWithProjects,
} from '@/lib/types';
import StatusDot from './StatusDot';

export interface TaskDraft {
  title: string;
  description: string;
  category: TaskCategory | null;
  dev_state: DevState;
  blocked_reason: string | null;
  needs_backend: boolean;
  deploy_notes: string;
  links: Array<{ project_id: string; branch: string }>;
}

// Create / edit modal. `task` null = new task.
export default function TaskEditor({
  task,
  projects,
  onSave,
  onClose,
  onDelete,
}: {
  task: TaskWithProjects | null;
  projects: Project[];
  onSave: (draft: TaskDraft) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [category, setCategory] = useState<TaskCategory | null>(
    task?.category ?? null
  );
  const [devState, setDevState] = useState<DevState>(task?.dev_state ?? 'idle');
  const [blockedReason, setBlockedReason] = useState(
    task?.blocked_reason ?? ''
  );
  const [needsBackend, setNeedsBackend] = useState(task?.needs_backend ?? false);
  const [deployNotes, setDeployNotes] = useState(task?.deploy_notes ?? '');

  // Map of project_id -> branch for the currently selected projects.
  const [branches, setBranches] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    task?.links.forEach((l) => (m[l.project_id] = l.branch ?? ''));
    return m;
  });

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
      category,
      dev_state: devState,
      blocked_reason: devState === 'blocked' ? blockedReason || null : null,
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
        <textarea
          className="modal-desc"
          placeholder="加點說明…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* dev state */}
        <div className="field">
          <div className="field-label">開發狀態</div>
          <div className="option-row">
            {DEV_STATE_ORDER.map((s) => (
              <button
                key={s}
                className={`option${devState === s ? ' selected' : ''}`}
                onClick={() => setDevState(s)}
              >
                <StatusDot ds={s} sm />
                {DEV_STATE_META[s].label}
              </button>
            ))}
          </div>
          {devState === 'blocked' && (
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
            {(Object.keys(CATEGORY_META) as TaskCategory[]).map((c) => (
              <button
                key={c}
                className={`option${category === c ? ' selected' : ''}`}
                onClick={() => setCategory(category === c ? null : c)}
              >
                <span
                  className="cat-dot"
                  style={{ background: CATEGORY_META[c].color }}
                />
                {CATEGORY_META[c].label}
              </button>
            ))}
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
                <span className="proj-name">{p.name} ⎇</span>
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
          <button
            className="btn btn-primary"
            disabled={!title.trim()}
            onClick={save}
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}
