'use client';

import { useState } from 'react';
import type { Workspace } from '@/lib/types';
import { STATUS_COLORS } from '@/lib/types';
import { enterSubmit } from '@/lib/useEnterSubmit';
import ConfirmDialog from './ConfirmDialog';

// Add / edit a workspace. `workspace` null = new.
export default function WorkspaceEditor({
  workspace,
  canDelete,
  onSave,
  onDelete,
  onClose,
}: {
  workspace: Workspace | null;
  canDelete: boolean;
  onSave: (patch: { name: string; color: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(workspace?.name ?? '');
  const [color, setColor] = useState(workspace?.color ?? '#5E6AD2');
  const [confirming, setConfirming] = useState(false);

  function save() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), color });
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" style={{ width: 420 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-heading" style={{ marginBottom: 12 }}>
          {workspace ? '編輯工作區' : '新增工作區'}
        </div>

        <input
          className="text-input"
          autoFocus
          placeholder="工作區名稱"
          value={name}
          onChange={(e) => setName(e.target.value)}
          {...enterSubmit(save)}
        />

        <div className="field">
          <div className="field-label">顏色</div>
          <div className="option-row">
            {STATUS_COLORS.map((c) => (
              <button
                key={c}
                className="color-swatch"
                onClick={() => setColor(c)}
                style={{
                  background: c,
                  outline: color === c ? '2px solid var(--text)' : '2px solid transparent',
                }}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="modal-actions">
          {workspace && onDelete && (
            <button
              className="btn btn-ghost"
              style={{ marginRight: 'auto', color: canDelete ? '#EB5757' : 'var(--text-faint)' }}
              disabled={!canDelete}
              title={canDelete ? '刪除工作區' : '至少要保留一個工作區'}
              onClick={() => setConfirming(true)}
            >
              刪除
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" disabled={!name.trim()} onClick={save}>
            儲存
          </button>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title="刪除工作區"
          message={`刪除工作區「${workspace?.name}」？\n此工作區底下的所有專案、任務、狀態設定都會一併永久刪除，無法復原。`}
          confirmLabel="永久刪除"
          danger
          onConfirm={() => {
            setConfirming(false);
            onDelete?.();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
