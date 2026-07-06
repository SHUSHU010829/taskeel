'use client';

import {
  CATEGORY_META,
  STATUS_ORDER,
  type DevState,
  type TaskWithProjects,
} from '@/lib/types';
import DevStateControl from './DevStateControl';

// One task row in the grouped board list.
export default function TaskRow({
  task,
  onOpen,
  onDevState,
  onMove,
}: {
  task: TaskWithProjects;
  onOpen: () => void;
  onDevState: (next: DevState, reason: string | null) => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const cat = task.category ? CATEGORY_META[task.category] : null;
  const idx = STATUS_ORDER.indexOf(task.status);
  const canBack = idx > 0;
  const canFwd = idx >= 0 && idx < STATUS_ORDER.length - 1;

  return (
    <div className="task-row">
      <DevStateControl
        value={task.dev_state}
        blockedReason={task.blocked_reason}
        onChange={onDevState}
      />

      {cat && (
        <span
          className="cat-dot"
          style={{ background: cat.color }}
          title={cat.label}
        />
      )}

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
              <span className="branch">⎇ {link.branch}</span>
            )}
            {link.deploy_status === 'deployed' && <span>✓</span>}
          </span>
        ))}
      </div>

      <div className="move-btns">
        <button
          className="move-btn"
          disabled={!canBack}
          title="上一階段"
          onClick={() => onMove(-1)}
        >
          ←
        </button>
        <button
          className="move-btn"
          disabled={!canFwd}
          title="下一階段"
          onClick={() => onMove(1)}
        >
          →
        </button>
      </div>
    </div>
  );
}
