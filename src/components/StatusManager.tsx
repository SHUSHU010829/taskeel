'use client';

import { useState } from 'react';
import {
  DEV_STATE_STYLES,
  STATUS_COLORS,
  type DevStateRow,
  type DevStateStyle,
  type StatusRow,
} from '@/lib/types';
import StatusDot from './StatusDot';

export interface StatusManagerHandlers {
  addStatus: (name: string) => void;
  updateStatus: (id: string, patch: Partial<StatusRow>) => void;
  deleteStatus: (id: string) => void;
  moveStatus: (id: string, dir: -1 | 1) => void;
  addDevState: (name: string) => void;
  updateDevState: (id: string, patch: Partial<DevStateRow>) => void;
  deleteDevState: (id: string) => void;
  moveDevState: (id: string, dir: -1 | 1) => void;
}

function ColorButton({
  color,
  onPick,
}: {
  color: string;
  onPick: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        className="color-swatch"
        style={{ width: 18, height: 18, background: color }}
        title="換顏色"
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="popover" style={{ top: 24, left: 0, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, padding: 4 }}>
            {STATUS_COLORS.map((c) => (
              <button
                key={c}
                className="color-swatch"
                style={{
                  width: 18,
                  height: 18,
                  background: c,
                  outline: color === c ? '2px solid var(--text)' : 'none',
                }}
                onClick={() => {
                  onPick(c);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

export default function StatusManager({
  statuses,
  devStates,
  handlers,
  onClose,
}: {
  statuses: StatusRow[];
  devStates: DevStateRow[];
  handlers: StatusManagerHandlers;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'flow' | 'dev'>('flow');
  const [newName, setNewName] = useState('');

  function submitNew() {
    if (!newName.trim()) return;
    if (tab === 'flow') handlers.addStatus(newName.trim());
    else handlers.addDevState(newName.trim());
    setNewName('');
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width: 560 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button
            className={`option${tab === 'flow' ? ' selected' : ''}`}
            onClick={() => setTab('flow')}
          >
            流程狀態
          </button>
          <button
            className={`option${tab === 'dev' ? ' selected' : ''}`}
            onClick={() => setTab('dev')}
          >
            開發狀態
          </button>
          <div className="spacer" />
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {tab === 'flow' ? (
          <div>
            <div className="field-label">
              流程狀態（看板分組）— 角色：★預設落點 · ⇧待部署 · ✔歸檔
            </div>
            {statuses.map((s, i) => (
              <div className="status-row" key={s.id}>
                <div className="reorder">
                  <button
                    className="move-btn"
                    disabled={i === 0}
                    onClick={() => handlers.moveStatus(s.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="move-btn"
                    disabled={i === statuses.length - 1}
                    onClick={() => handlers.moveStatus(s.id, 1)}
                  >
                    ↓
                  </button>
                </div>
                <ColorButton
                  color={s.color}
                  onPick={(c) => handlers.updateStatus(s.id, { color: c })}
                />
                <input
                  className="text-input"
                  defaultValue={s.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== s.name) handlers.updateStatus(s.id, { name: v });
                  }}
                />
                <button
                  className={`role-chip${s.is_default ? ' on' : ''}`}
                  title="快速捕捉落點"
                  onClick={() => handlers.updateStatus(s.id, { is_default: true })}
                >
                  ★
                </button>
                <button
                  className={`role-chip${s.is_deploy ? ' on' : ''}`}
                  title="部署清單抓這區"
                  onClick={() =>
                    handlers.updateStatus(s.id, { is_deploy: !s.is_deploy })
                  }
                >
                  ⇧
                </button>
                <button
                  className={`role-chip${s.is_archive ? ' on' : ''}`}
                  title="歸檔（進部署歷史）"
                  onClick={() => handlers.updateStatus(s.id, { is_archive: true })}
                >
                  ✔
                </button>
                <button
                  className="icon-btn"
                  disabled={s.is_default || s.is_archive}
                  title={
                    s.is_default || s.is_archive
                      ? '預設／歸檔狀態不可刪除'
                      : '刪除'
                  }
                  onClick={() => {
                    if (confirm(`刪除狀態「${s.name}」？該狀態的任務會移到預設區。`))
                      handlers.deleteStatus(s.id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div className="field-label">
              開發狀態（狀態圈）— 樣式為「打叉」的狀態會顯示卡住原因欄
            </div>
            {devStates.map((d, i) => (
              <div className="status-row" key={d.id}>
                <div className="reorder">
                  <button
                    className="move-btn"
                    disabled={i === 0}
                    onClick={() => handlers.moveDevState(d.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="move-btn"
                    disabled={i === devStates.length - 1}
                    onClick={() => handlers.moveDevState(d.id, 1)}
                  >
                    ↓
                  </button>
                </div>
                <StatusDot color={d.color} style={d.style} />
                <ColorButton
                  color={d.color}
                  onPick={(c) => handlers.updateDevState(d.id, { color: c })}
                />
                <input
                  className="text-input"
                  defaultValue={d.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== d.name) handlers.updateDevState(d.id, { name: v });
                  }}
                />
                <select
                  className="text-input"
                  style={{ width: 100, flex: 'none' }}
                  value={d.style}
                  onChange={(e) =>
                    handlers.updateDevState(d.id, {
                      style: e.target.value as DevStateStyle,
                    })
                  }
                >
                  {DEV_STATE_STYLES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
                <button
                  className={`role-chip${d.is_default ? ' on' : ''}`}
                  title="快速捕捉起始開發狀態"
                  onClick={() => handlers.updateDevState(d.id, { is_default: true })}
                >
                  ★
                </button>
                <button
                  className="icon-btn"
                  disabled={d.is_default}
                  title={d.is_default ? '預設狀態不可刪除' : '刪除'}
                  onClick={() => {
                    if (confirm(`刪除開發狀態「${d.name}」？相關任務會移到預設。`))
                      handlers.deleteDevState(d.id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="branch-field" style={{ marginTop: 12 }}>
          <input
            className="text-input"
            placeholder={tab === 'flow' ? '新增流程狀態…' : '新增開發狀態…'}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitNew()}
          />
          <button className="btn btn-primary" onClick={submitNew}>
            新增
          </button>
        </div>
      </div>
    </div>
  );
}
