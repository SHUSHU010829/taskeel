'use client';

import { useState } from 'react';
import type { Project } from '@/lib/types';
import { enterSubmit } from '@/lib/useEnterSubmit';
import ConfirmDialog from './ConfirmDialog';

const PRESET_COLORS = [
  '#5E6AD2',
  '#26B5CE',
  '#4CB782',
  '#E5A00D',
  '#EB5757',
  '#8A8F98',
  '#B57EDC',
  '#F2994A',
];

// Edit / delete an existing project (name, repo, colour).
export default function ProjectEditor({
  project,
  onSave,
  onDelete,
  onClose,
}: {
  project: Project;
  onSave: (patch: { name: string; repo: string | null; color: string; abbr: string | null }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [repo, setRepo] = useState(project.repo ?? '');
  const [abbr, setAbbr] = useState(project.abbr ?? '');
  const [color, setColor] = useState(project.color);
  const [confirming, setConfirming] = useState(false);

  function save() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      repo: repo.trim() || null,
      color,
      abbr: abbr.trim() || null,
    });
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width: 420 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          className="modal-title-input"
          autoFocus
          placeholder="專案名稱"
          value={name}
          onChange={(e) => setName(e.target.value)}
          {...enterSubmit(save)}
        />

        <div className="field">
          <div className="field-label">repo（供部署歸檔比對）</div>
          <input
            className="text-input"
            placeholder="owner/bibi-bot"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            {...enterSubmit(save)}
          />
        </div>

        <div className="field">
          <div className="field-label">縮寫（快速捕捉用 @縮寫）</div>
          <input
            className="text-input"
            placeholder="如 et"
            value={abbr}
            onChange={(e) => setAbbr(e.target.value)}
            {...enterSubmit(save)}
          />
        </div>

        <div className="field">
          <div className="field-label">顏色</div>
          <div className="option-row">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className="color-swatch"
                onClick={() => setColor(c)}
                style={{
                  background: c,
                  outline:
                    color === c ? '2px solid var(--text)' : '2px solid transparent',
                }}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-ghost"
            style={{ marginRight: 'auto', color: '#EB5757' }}
            onClick={() => setConfirming(true)}
          >
            刪除
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            disabled={!name.trim()}
            onClick={save}
          >
            儲存
          </button>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title="刪除專案"
          message={`刪除專案「${project.name}」？\n該專案在所有任務上的分支關聯也會一併移除（任務本身保留）。`}
          confirmLabel="刪除"
          danger
          onConfirm={() => {
            setConfirming(false);
            onDelete();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
