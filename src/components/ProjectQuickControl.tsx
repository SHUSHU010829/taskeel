'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, FolderGit2 } from 'lucide-react';
import type { Project } from '@/lib/types';

// Far-right control on a board row: quick-toggle which projects a task is
// attached to, without opening the editor. Popover stays open so several
// projects can be ticked in a row.
export default function ProjectQuickControl({
  projects,
  selectedIds,
  onToggle,
}: {
  projects: Project[];
  selectedIds: string[];
  onToggle: (projectId: string) => void;
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

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      <button
        className={`proj-quick${selectedIds.length ? ' on' : ''}`}
        title="快速勾選專案"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <FolderGit2 size={13} />
        {selectedIds.length > 0 && <span className="proj-quick-count">{selectedIds.length}</span>}
      </button>

      {open && (
        <div className="popover" style={{ top: 24, right: 0, minWidth: 168 }}>
          {projects.length === 0 && <div className="popover-empty">此工作區沒有專案</div>}
          {projects.map((p) => {
            const on = selectedIds.includes(p.id);
            return (
              <button
                key={p.id}
                className="popover-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(p.id);
                }}
              >
                <span className={`mini-check${on ? ' on' : ''}`}>{on && <Check size={11} />}</span>
                <span className="dot" style={{ background: p.color, width: 8, height: 8 }} />
                {p.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
