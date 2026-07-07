'use client';

import { useEffect, useRef, useState } from 'react';
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
  reorderStatuses: (orderedIds: string[]) => void;
  addDevState: (name: string) => void;
  updateDevState: (id: string, patch: Partial<DevStateRow>) => void;
  deleteDevState: (id: string) => void;
  reorderDevStates: (orderedIds: string[]) => void;
}

// Move the dragged id to the target id's slot; returns the new id order.
function reordered(ids: string[], dragId: string, targetId: string) {
  const from = ids.indexOf(dragId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return null;
  const next = [...ids];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

function ColorButton({
  color,
  onPick,
}: {
  color: string;
  onPick: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        className="color-swatch"
        style={{ width: 18, height: 18, background: color }}
        title="換顏色"
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="popover" style={{ top: 26, left: 0, minWidth: 0 }}>
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

function StyleSelect({
  value,
  onChange,
}: {
  value: DevStateStyle;
  onChange: (s: DevStateStyle) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const cur = DEV_STATE_STYLES.find((s) => s.value === value);
  return (
    <div ref={ref} style={{ position: 'relative', width: 118, flex: 'none' }}>
      <button className="select-btn" onClick={() => setOpen((o) => !o)}>
        <StatusDot color="#8A8F98" style={value} sm />
        <span style={{ flex: 1, textAlign: 'left' }}>{cur?.label}</span>
        <span className="caret">▾</span>
      </button>
      {open && (
        <div className="popover" style={{ top: 32, left: 0, right: 0 }}>
          {DEV_STATE_STYLES.map((s) => (
            <button
              key={s.value}
              className="popover-item"
              onClick={() => {
                onChange(s.value);
                setOpen(false);
              }}
            >
              <StatusDot color="#8A8F98" style={s.value} sm />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
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
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function submitNew() {
    if (!newName.trim()) return;
    if (tab === 'flow') handlers.addStatus(newName.trim());
    else handlers.addDevState(newName.trim());
    setNewName('');
  }

  function onDrop(targetId: string, ids: string[], persist: (o: string[]) => void) {
    if (!dragId) return;
    const next = reordered(ids, dragId, targetId);
    setDragId(null);
    setOverId(null);
    if (next) persist(next);
  }

  const grip = (
    <span className="drag-handle" title="拖曳排序">
      ⠿
    </span>
  );

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width: 580 }}
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
              流程狀態（看板分組）— 角色：★預設落點 · ⇧待部署 · ✔歸檔。拖曳左側握把排序。
            </div>
            {statuses.map((s) => (
              <div
                key={s.id}
                className={`status-row${overId === s.id ? ' drag-over' : ''}${
                  dragId === s.id ? ' dragging' : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverId(s.id);
                }}
                onDragLeave={() => setOverId((o) => (o === s.id ? null : o))}
                onDrop={() =>
                  onDrop(s.id, statuses.map((x) => x.id), handlers.reorderStatuses)
                }
              >
                <span
                  className="drag-handle"
                  title="拖曳排序"
                  draggable
                  onDragStart={() => setDragId(s.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                >
                  ⠿
                </span>
                <ColorButton
                  color={s.color}
                  onPick={(c) => handlers.updateStatus(s.id, { color: c })}
                />
                <input
                  className="text-input"
                  defaultValue={s.name}
                  key={s.name}
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
                  title={s.is_default || s.is_archive ? '預設／歸檔狀態不可刪除' : '刪除'}
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
              開發狀態（狀態圈）— 樣式為「打叉」的狀態會顯示卡住原因欄。拖曳左側握把排序。
            </div>
            {devStates.map((d) => (
              <div
                key={d.id}
                className={`status-row${overId === d.id ? ' drag-over' : ''}${
                  dragId === d.id ? ' dragging' : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverId(d.id);
                }}
                onDragLeave={() => setOverId((o) => (o === d.id ? null : o))}
                onDrop={() =>
                  onDrop(d.id, devStates.map((x) => x.id), handlers.reorderDevStates)
                }
              >
                <span
                  className="drag-handle"
                  title="拖曳排序"
                  draggable
                  onDragStart={() => setDragId(d.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                >
                  ⠿
                </span>
                <StatusDot color={d.color} style={d.style} />
                <ColorButton
                  color={d.color}
                  onPick={(c) => handlers.updateDevState(d.id, { color: c })}
                />
                <input
                  className="text-input"
                  defaultValue={d.name}
                  key={d.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== d.name) handlers.updateDevState(d.id, { name: v });
                  }}
                />
                <StyleSelect
                  value={d.style}
                  onChange={(st) => handlers.updateDevState(d.id, { style: st })}
                />
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
