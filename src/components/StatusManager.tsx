'use client';

import { useEffect, useRef, useState } from 'react';
import {
  STATUS_COLORS,
  STATUS_STYLES,
  type StatusRow,
  type StatusStyle,
} from '@/lib/types';
import { enterSubmit } from '@/lib/useEnterSubmit';
import StatusDot from './StatusDot';
import ConfirmDialog from './ConfirmDialog';

export interface StatusManagerHandlers {
  addStatus: (name: string) => void;
  updateStatus: (id: string, patch: Partial<StatusRow>) => void;
  deleteStatus: (id: string) => void;
  reorderStatuses: (orderedIds: string[]) => void;
}

function reordered(ids: string[], dragId: string, targetId: string) {
  const from = ids.indexOf(dragId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return null;
  const next = [...ids];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

function ColorButton({ color, onPick }: { color: string; onPick: (c: string) => void }) {
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
  color,
  onChange,
}: {
  value: StatusStyle;
  color: string;
  onChange: (s: StatusStyle) => void;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  function toggle() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      const menuH = STATUS_STYLES.length * 36 + 8;
      // open upward when there isn't room below
      setUp(window.innerHeight - r.bottom < menuH);
    }
    setOpen((o) => !o);
  }

  const cur = STATUS_STYLES.find((s) => s.value === value);
  return (
    <div ref={ref} style={{ position: 'relative', width: 116, flex: 'none' }}>
      <button className="select-btn" onClick={toggle}>
        <StatusDot color={color} style={value} sm />
        <span style={{ flex: 1, textAlign: 'left' }}>{cur?.label}</span>
        <span className="caret">▾</span>
      </button>
      {open && (
        <div
          className="popover"
          style={up ? { bottom: 'calc(100% + 4px)', left: 0, right: 0 } : { top: 32, left: 0, right: 0 }}
        >
          {STATUS_STYLES.map((s) => (
            <button
              key={s.value}
              className="popover-item"
              onClick={() => {
                onChange(s.value);
                setOpen(false);
              }}
            >
              <StatusDot color={color} style={s.value} sm />
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
  handlers,
  onClose,
}: {
  statuses: StatusRow[];
  handlers: StatusManagerHandlers;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; onYes: () => void } | null>(null);

  function submitNew() {
    if (!newName.trim()) return;
    handlers.addStatus(newName.trim());
    setNewName('');
  }

  function onDrop(targetId: string) {
    if (!dragId) return;
    const next = reordered(statuses.map((x) => x.id), dragId, targetId);
    setDragId(null);
    setOverId(null);
    if (next) handlers.reorderStatuses(next);
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" style={{ width: 620 }} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div className="modal-heading">狀態設定</div>
          <div className="spacer" />
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="field-label" style={{ marginTop: 0 }}>
          一個任務只有一個狀態，決定看板分欄與圖示。角色：★預設落點 · ⇧待部署 · ✔歸檔。
          圖示為「打叉」的狀態會顯示卡住原因欄。拖曳左側握把排序。
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
            onDrop={() => onDrop(s.id)}
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
            <ColorButton color={s.color} onPick={(c) => handlers.updateStatus(s.id, { color: c })} />
            <input
              className="text-input"
              defaultValue={s.name}
              key={s.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== s.name) handlers.updateStatus(s.id, { name: v });
              }}
            />
            <StyleSelect
              value={s.style}
              color={s.color}
              onChange={(st) => handlers.updateStatus(s.id, { style: st })}
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
              onClick={() => handlers.updateStatus(s.id, { is_deploy: !s.is_deploy })}
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
              onClick={() =>
                setConfirm({
                  message: `刪除狀態「${s.name}」？該狀態的任務會移到預設區。`,
                  onYes: () => handlers.deleteStatus(s.id),
                })
              }
            >
              ✕
            </button>
          </div>
        ))}

        <div className="branch-field" style={{ marginTop: 12 }}>
          <input
            className="text-input"
            placeholder="新增狀態…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            {...enterSubmit(submitNew)}
          />
          <button className="btn btn-primary" onClick={submitNew}>
            新增
          </button>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          title="刪除狀態"
          message={confirm.message}
          confirmLabel="刪除"
          danger
          onConfirm={() => {
            confirm.onYes();
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
