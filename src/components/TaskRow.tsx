'use client';

import { Check, GitBranch } from 'lucide-react';
import type { CategoryRow, StatusRow, TaskWithProjects } from '@/lib/types';
import StatusControl from './StatusControl';
import CategoryControl from './CategoryControl';

// One task row in the grouped board list. Draggable between status columns.
export default function TaskRow({
  task,
  statuses,
  categories,
  dragging,
  onOpen,
  onStatus,
  onCategory,
  onDragStart,
  onDragEnd,
}: {
  task: TaskWithProjects;
  statuses: StatusRow[];
  categories: CategoryRow[];
  dragging: boolean;
  onOpen: () => void;
  onStatus: (nextId: string, reason: string | null) => void;
  onCategory: (next: string | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      className={`task-row${dragging ? ' dragging' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <StatusControl
        statuses={statuses}
        valueId={task.status_id}
        blockedReason={task.blocked_reason}
        onChange={onStatus}
      />

      <CategoryControl categories={categories} value={task.category_id} onChange={onCategory} />

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
            {link.branch && (
              <span className="branch">
                <GitBranch size={11} /> {link.branch}
              </span>
            )}
            {link.deploy_status === 'deployed' && <Check size={12} />}
          </span>
        ))}
      </div>
    </div>
  );
}
