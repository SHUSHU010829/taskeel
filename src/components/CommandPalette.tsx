'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownRight, Plus, Search } from 'lucide-react';
import type { CategoryRow, StatusRow, TaskWithProjects } from '@/lib/types';
import StatusDot from './StatusDot';
import PriorityFlag from './PriorityFlag';

// ⌘K / `/` search-and-jump over the current workspace's tasks, plus a
// "create task" action for the typed text.
export default function CommandPalette({
  open,
  tasks,
  statuses,
  categories,
  parentTitleById,
  onOpenTask,
  onNewTask,
  onClose,
}: {
  open: boolean;
  tasks: TaskWithProjects[];
  statuses: StatusRow[];
  categories: CategoryRow[];
  parentTitleById: Record<string, string>;
  onOpenTask: (t: TaskWithProjects) => void;
  onNewTask: (title: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSel(0);
      // focus after mount
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return tasks.slice(0, 8);
    return tasks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [q, tasks]);

  const showCreate = q.length > 0;
  const itemCount = matches.length + (showCreate ? 1 : 0);

  useEffect(() => {
    if (sel > itemCount - 1) setSel(Math.max(0, itemCount - 1));
  }, [itemCount, sel]);

  if (!open) return null;

  function activate(i: number) {
    if (i < matches.length) {
      onOpenTask(matches[i]);
    } else if (showCreate) {
      onNewTask(query.trim());
    }
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, itemCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (itemCount > 0) activate(sel);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="cmdk-overlay" onMouseDown={onClose}>
      <div className="cmdk" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <Search size={16} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="搜尋任務，或輸入以建立…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKeyDown}
          />
          <span className="kbd">esc</span>
        </div>

        <div className="cmdk-list">
          {matches.map((t, i) => {
            const s = statuses.find((x) => x.id === t.status_id);
            const cat = categories.find((c) => c.id === t.category_id);
            const parent = t.parent_id ? parentTitleById[t.parent_id] : null;
            return (
              <button
                key={t.id}
                className={`cmdk-item${sel === i ? ' active' : ''}`}
                onMouseEnter={() => setSel(i)}
                onClick={() => activate(i)}
              >
                {s ? (
                  <StatusDot color={s.color} style={s.style} sm />
                ) : (
                  <span style={{ width: 14, flexShrink: 0 }} />
                )}
                <PriorityFlag priority={t.priority} size={12} />
                <span className="cmdk-item-title">{t.title}</span>
                {parent && (
                  <span className="cmdk-item-parent" title={`主任務：${parent}`}>
                    <CornerDownRight size={11} /> {parent}
                  </span>
                )}
                {cat && (
                  <span className="cmdk-item-cat">
                    <span className="cat-dot" style={{ background: cat.color }} />
                    {cat.name}
                  </span>
                )}
              </button>
            );
          })}

          {matches.length === 0 && !showCreate && (
            <div className="cmdk-empty">此工作區還沒有任務。</div>
          )}

          {showCreate && (
            <button
              className={`cmdk-item cmdk-create${sel === matches.length ? ' active' : ''}`}
              onMouseEnter={() => setSel(matches.length)}
              onClick={() => activate(matches.length)}
            >
              <Plus size={14} style={{ flexShrink: 0 }} />
              <span className="cmdk-item-title">
                建立任務「{query.trim()}」
              </span>
            </button>
          )}
        </div>

        <div className="cmdk-foot">
          <span><span className="kbd">↑</span><span className="kbd">↓</span> 選擇</span>
          <span><span className="kbd">↵</span> 開啟</span>
          <span>支援 <span className="kbd">#分類</span> <span className="kbd">@專案</span> <span className="kbd">!p1</span>（建立時）</span>
        </div>
      </div>
    </div>
  );
}
