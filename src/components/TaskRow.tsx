'use client';

import type { StatusRow, TaskCategory, TaskWithProjects } from '@/lib/types';
import StatusControl from './StatusControl';
import CategoryControl from './CategoryControl';

// One task row in the grouped board list.
export default function TaskRow({
  task,
  statuses,
  canBack,
  canFwd,
  onOpen,
  onStatus,
  onCategory,
  onMove,
}: {
  task: TaskWithProjects;
  statuses: StatusRow[];
  canBack: boolean;
  canFwd: boolean;
  onOpen: () => void;
  onStatus: (nextId: string, reason: string | null) => void;
  onCategory: (next: TaskCategory | null) => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="task-row">
      <StatusControl
        statuses={statuses}
        valueId={task.status_id}
        blockedReason={task.blocked_reason}
        onChange={onStatus}
      />

      <CategoryControl value={task.category} onChange={onCategory} />

      <span className="task-title" onClick={onOpen}>
        {task.title}
      </span>

      <div className="task-meta">
        {task.needs_backend && <span className="badge-backend">後端</span>}

        {task.links.map((link) => (
          <span
            key={link.project_id}
            className={`chip${link.deploy_status === 'deployed' ? ' deployed' : ''}`}
            title={
              link.deploy_status === 'deployed'
                ? `已部署${link.deployed_at ? ' · ' + new Date(link.deployed_at).toLocaleString() : ''}`
                : '待部署'
            }
          >
            <span
              className="dot"
              style={{ background: link.project.color, width: 6, height: 6 }}
            />
            {link.project.name}
            {link.branch && <span className="branch">⎇ {link.branch}</span>}
            {link.deploy_status === 'deployed' && <span>✓</span>}
          </span>
        ))}
      </div>

      <div className="move-btns">
        <button className="move-btn" disabled={!canBack} title="上一階段" onClick={() => onMove(-1)}>
          ←
        </button>
        <button className="move-btn" disabled={!canFwd} title="下一階段" onClick={() => onMove(1)}>
          →
        </button>
      </div>
    </div>
  );
}
