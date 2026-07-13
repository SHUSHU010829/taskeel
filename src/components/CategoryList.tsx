'use client';

import { useEffect, useRef, useState } from 'react';
import { GripVertical, X } from 'lucide-react';
import { STATUS_COLORS, type CategoryRow } from '@/lib/types';
import { enterSubmit } from '@/lib/useEnterSubmit';
import ConfirmDialog from './ConfirmDialog';

export interface CategoryHandlers {
  addCategory: (name: string) => void;
  updateCategory: (id: string, patch: Partial<CategoryRow>) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (orderedIds: string[]) => void;
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 4, width: 176 }}>
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

// Category list editor — used inside the workspace editor.
export default function CategoryList({
  categories,
  handlers,
}: {
  categories: CategoryRow[];
  handlers: CategoryHandlers;
}) {
  const [newName, setNewName] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; onYes: () => void } | null>(null);

  function submitNew() {
    if (!newName.trim()) return;
    handlers.addCategory(newName.trim());
    setNewName('');
  }

  function onDrop(targetId: string) {
    if (!dragId) return;
    const next = reordered(categories.map((x) => x.id), dragId, targetId);
    setDragId(null);
    setOverId(null);
    if (next) handlers.reorderCategories(next);
  }

  return (
    <div>
      {categories.map((c) => (
        <div
          key={c.id}
          className={`status-row${overId === c.id ? ' drag-over' : ''}${
            dragId === c.id ? ' dragging' : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setOverId(c.id);
          }}
          onDragLeave={() => setOverId((o) => (o === c.id ? null : o))}
          onDrop={() => onDrop(c.id)}
        >
          <span
            className="drag-handle"
            title="拖曳排序"
            draggable
            onDragStart={() => setDragId(c.id)}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
          >
            <GripVertical size={16} />
          </span>
          <ColorButton color={c.color} onPick={(col) => handlers.updateCategory(c.id, { color: col })} />
          <input
            className="text-input"
            defaultValue={c.name}
            key={c.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== c.name) handlers.updateCategory(c.id, { name: v });
            }}
          />
          <input
            className="text-input cat-abbr"
            placeholder="縮寫"
            title="快速捕捉用 #縮寫"
            defaultValue={c.abbr ?? ''}
            key={`abbr-${c.abbr ?? ''}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (c.abbr ?? '')) handlers.updateCategory(c.id, { abbr: v || null });
            }}
          />
          <button
            className="icon-btn"
            title="刪除"
            onClick={() =>
              setConfirm({
                message: `刪除分類「${c.name}」？使用此分類的任務會變成「無分類」。`,
                onYes: () => handlers.deleteCategory(c.id),
              })
            }
          >
            <X size={15} />
          </button>
        </div>
      ))}

      <div className="branch-field" style={{ marginTop: 12 }}>
        <input
          className="text-input"
          placeholder="新增分類…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          {...enterSubmit(submitNew)}
        />
        <button className="btn btn-primary" onClick={submitNew}>
          新增
        </button>
      </div>

      {confirm && (
        <ConfirmDialog
          title="刪除分類"
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
