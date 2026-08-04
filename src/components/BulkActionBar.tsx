'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  CalendarClock,
  CheckSquare,
  Flag,
  FolderPlus,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { CategoryRow, Project, StatusRow } from '@/lib/types';
import { PRIORITIES } from '@/lib/types';
import PriorityFlag from './PriorityFlag';
import StatusDot from './StatusDot';

type MenuKey = 'status' | 'project' | 'due' | 'priority' | 'category' | null;

// Floating bar shown while multi-select is active. Applies one field to every
// selected task at once (status / project / due date / priority / category),
// or deletes them.
export default function BulkActionBar({
  count,
  statuses,
  categories,
  projects,
  allSelected,
  onSelectAll,
  onStatus,
  onProject,
  onDue,
  onPriority,
  onCategory,
  onGenerateSpec,
  onArchive,
  onDelete,
  onClose,
}: {
  count: number;
  statuses: StatusRow[];
  categories: CategoryRow[];
  projects: Project[];
  allSelected: boolean;
  onSelectAll: () => void;
  onStatus: (id: string) => void;
  onProject: (id: string) => void;
  onDue: (v: string | null) => void;
  onPriority: (v: number) => void;
  onCategory: (id: string | null) => void;
  onGenerateSpec: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [menu, setMenu] = useState<MenuKey>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu && !confirmDel) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenu(null);
        setConfirmDel(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menu, confirmDel]);

  const toggle = (k: MenuKey) => setMenu((m) => (m === k ? null : k));

  return (
    <div className="bulk-bar" ref={ref}>
      <span className="bulk-count">
        <CheckSquare size={15} /> 已選 {count} 項
      </span>

      <div className="bulk-sep" />

      {/* status */}
      <div className="bulk-item">
        <button className="bulk-btn" onClick={() => toggle('status')}>
          狀態
        </button>
        {menu === 'status' && (
          <div className="popover bulk-pop">
            {statuses.map((s) => (
              <button
                key={s.id}
                className="popover-item"
                onClick={() => {
                  onStatus(s.id);
                  setMenu(null);
                }}
              >
                <StatusDot color={s.color} style={s.style} sm />
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* add project */}
      <div className="bulk-item">
        <button className="bulk-btn" onClick={() => toggle('project')}>
          <FolderPlus size={14} /> 專案
        </button>
        {menu === 'project' && (
          <div className="popover bulk-pop">
            {projects.length === 0 ? (
              <div className="popover-empty">尚無專案</div>
            ) : (
              projects.map((p) => (
                <button
                  key={p.id}
                  className="popover-item"
                  onClick={() => {
                    onProject(p.id);
                    setMenu(null);
                  }}
                >
                  <span className="dot" style={{ background: p.color, width: 8, height: 8 }} />
                  {p.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* due date */}
      <div className="bulk-item">
        <button className="bulk-btn" onClick={() => toggle('due')}>
          <CalendarClock size={14} /> 日期
        </button>
        {menu === 'due' && (
          <div className="popover bulk-pop bulk-pop-due">
            <input
              type="date"
              className="text-input"
              onChange={(e) => {
                onDue(e.target.value || null);
                setMenu(null);
              }}
              autoFocus
            />
            <button
              className="popover-item"
              onClick={() => {
                onDue(null);
                setMenu(null);
              }}
            >
              清除截止日
            </button>
          </div>
        )}
      </div>

      {/* priority */}
      <div className="bulk-item">
        <button className="bulk-btn" onClick={() => toggle('priority')}>
          <Flag size={14} /> 優先
        </button>
        {menu === 'priority' && (
          <div className="popover bulk-pop">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                className="popover-item"
                onClick={() => {
                  onPriority(p.value);
                  setMenu(null);
                }}
              >
                {p.value > 0 ? (
                  <PriorityFlag priority={p.value} size={12} />
                ) : (
                  <span style={{ width: 12, display: 'inline-block' }} />
                )}
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* category */}
      <div className="bulk-item">
        <button className="bulk-btn" onClick={() => toggle('category')}>
          <Tag size={14} /> 分類
        </button>
        {menu === 'category' && (
          <div className="popover bulk-pop">
            <button
              className="popover-item"
              onClick={() => {
                onCategory(null);
                setMenu(null);
              }}
            >
              <span className="cat-empty-dot" />
              無分類
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className="popover-item"
                onClick={() => {
                  onCategory(c.id);
                  setMenu(null);
                }}
              >
                <span className="dot" style={{ background: c.color, width: 8, height: 8 }} />
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bulk-sep" />

      <button className="bulk-btn bulk-spec" onClick={onGenerateSpec} title="用 AI 統整成開發需求說明">
        <Sparkles size={14} /> 產生需求
      </button>

      <div className="bulk-sep" />

      <button className="bulk-btn" onClick={onSelectAll} disabled={allSelected}>
        全選
      </button>

      <button className="bulk-btn" onClick={onArchive} title="不需部署，直接封存">
        <Archive size={14} /> 封存
      </button>

      <div className="bulk-item">
        <button className="bulk-btn bulk-del" onClick={() => setConfirmDel((v) => !v)}>
          <Trash2 size={14} /> 刪除
        </button>
        {confirmDel && (
          <div className="popover bulk-pop bulk-confirm">
            <div className="bulk-confirm-msg">刪除選取的 {count} 項？無法復原。</div>
            <div className="bulk-confirm-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDel(false)}>
                取消
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setConfirmDel(false);
                  onDelete();
                }}
              >
                刪除
              </button>
            </div>
          </div>
        )}
      </div>

      <button className="bulk-btn bulk-close" title="結束多選（Esc）" onClick={onClose}>
        <X size={15} />
      </button>
    </div>
  );
}
