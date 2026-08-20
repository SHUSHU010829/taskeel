'use client';

import { useState } from 'react';
import type { CategoryRow, StatusRow, Workspace } from '@/lib/types';
import { STATUS_COLORS } from '@/lib/types';
import { enterSubmit } from '@/lib/useEnterSubmit';
import ConfirmDialog from './ConfirmDialog';
import StatusList, { type StatusManagerHandlers } from './StatusList';
import CategoryList, { type CategoryHandlers } from './CategoryList';
import WorkspaceIcon, { WS_ICON_KEYS } from './WorkspaceIcon';

// Add / edit a workspace. Existing workspaces auto-save every field (name on
// blur, colour / icon on click), like the task editor; statuses & categories
// already auto-save. New workspaces accumulate a draft and 建立 once. `workspace`
// null = new.
export default function WorkspaceEditor({
  workspace,
  canDelete,
  statuses,
  statusHandlers,
  categories,
  categoryHandlers,
  onSave,
  onPatch,
  onDelete,
  onClose,
}: {
  workspace: Workspace | null;
  canDelete: boolean;
  statuses: StatusRow[];
  statusHandlers: StatusManagerHandlers | null;
  categories: CategoryRow[];
  categoryHandlers: CategoryHandlers | null;
  onSave: (patch: { name: string; color: string; icon: string | null }) => void;
  onPatch: (patch: Partial<{ name: string; color: string; icon: string | null }>) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const isNew = !workspace;
  const [name, setName] = useState(workspace?.name ?? '');
  const [color, setColor] = useState(workspace?.color ?? '#5E6AD2');
  const [icon, setIcon] = useState<string | null>(workspace?.icon ?? 'diamond');
  const [confirming, setConfirming] = useState(false);
  const [tab, setTab] = useState<'general' | 'status' | 'category'>('general');

  function create() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), color, icon });
  }

  function commitName() {
    const t = name.trim();
    if (!t) {
      if (workspace) setName(workspace.name); // revert empty
      return;
    }
    if (workspace && t !== workspace.name) onPatch({ name: t });
  }

  function chooseColor(c: string) {
    setColor(c);
    if (workspace) onPatch({ color: c });
  }

  function chooseIcon(k: string) {
    setIcon(k);
    if (workspace) onPatch({ icon: k });
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="modal ws-editor"
        style={{ width: workspace ? 640 : 420 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">{workspace ? '工作區設定' : '新增工作區'}</div>

        {workspace && (
          <div className="ws-tabs">
            <button
              className={`ws-tab${tab === 'general' ? ' on' : ''}`}
              onClick={() => setTab('general')}
            >
              一般
            </button>
            <button
              className={`ws-tab${tab === 'status' ? ' on' : ''}`}
              onClick={() => setTab('status')}
            >
              狀態
            </button>
            <button
              className={`ws-tab${tab === 'category' ? ' on' : ''}`}
              onClick={() => setTab('category')}
            >
              分類
            </button>
          </div>
        )}

        <div className="ws-tab-body">
          {tab === 'general' && (
            <>
              <div className="field">
                <div className="field-label">名稱</div>
                <input
                  className="text-input"
                  autoFocus
                  placeholder="工作區名稱"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={commitName}
                  {...enterSubmit(isNew ? create : commitName)}
                />
              </div>

              <div className="field">
                <div className="field-label">顏色</div>
                <div className="option-row">
                  {STATUS_COLORS.map((c) => (
                    <button
                      key={c}
                      className="color-swatch"
                      onClick={() => chooseColor(c)}
                      style={{
                        background: c,
                        outline: color === c ? '2px solid var(--text)' : '2px solid transparent',
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              <div className="field">
                <div className="field-label">圖示（收合側欄時代表此工作區）</div>
                <div className="icon-grid">
                  {WS_ICON_KEYS.map((key) => (
                    <button
                      key={key}
                      className={`icon-swatch${icon === key ? ' on' : ''}`}
                      style={icon === key ? { color, borderColor: color } : undefined}
                      onClick={() => chooseIcon(key)}
                      title={key}
                    >
                      <WorkspaceIcon icon={key} size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'status' && workspace && statusHandlers && (
            <div className="field">
              <div className="field-hint">拖曳排序；點顏色換色，右側可設角色與刪除。</div>
              <StatusList statuses={statuses} handlers={statusHandlers} />
            </div>
          )}

          {tab === 'category' && workspace && categoryHandlers && (
            <div className="field">
              <div className="field-hint">★ 設為預設分類（新任務自動歸入）；縮寫供快速捕捉 #縮寫。</div>
              <CategoryList categories={categories} handlers={categoryHandlers} />
            </div>
          )}
        </div>

        <div className="modal-actions">
          {isNew ? (
            <>
              <button className="btn btn-ghost" onClick={onClose}>
                取消
              </button>
              <button className="btn btn-primary" disabled={!name.trim()} onClick={create}>
                建立
              </button>
            </>
          ) : (
            <>
              {onDelete && (
                <button
                  className="btn btn-ghost"
                  style={{
                    marginRight: 'auto',
                    color: canDelete ? '#EB5757' : 'var(--text-faint)',
                  }}
                  disabled={!canDelete}
                  title={canDelete ? '刪除工作區' : '至少要保留一個工作區'}
                  onClick={() => setConfirming(true)}
                >
                  刪除工作區
                </button>
              )}
              <button className="btn btn-primary" onClick={onClose}>
                完成
              </button>
            </>
          )}
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
