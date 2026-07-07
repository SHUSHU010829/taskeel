'use client';

import type { StatusRow, TaskWithProjects } from '@/lib/types';
import StatusDot from './StatusDot';

// Slide-over aggregating everything waiting to deploy: each task in a
// deploy-stage status with its still-pending project branches, plus deploy
// reminders and backend flags. Actual archiving is CI-driven.
export default function DeploySheet({
  tasks,
  statuses,
  onClose,
}: {
  tasks: TaskWithProjects[];
  statuses: StatusRow[];
  onClose: () => void;
}) {
  const deployIds = new Set(
    statuses.filter((s) => s.is_deploy).map((s) => s.id)
  );

  const pending = tasks
    .filter((t) => t.status_id && deployIds.has(t.status_id))
    .map((t) => ({
      task: t,
      links: t.links.filter((l) => l.deploy_status === 'pending'),
    }))
    .filter((x) => x.links.length > 0);

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-header">
          <h2>部署清單</h2>
          <span className="badge-count" style={{ marginLeft: 8 }}>
            {pending.length}
          </span>
          <div className="spacer" />
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="sheet-body">
          {pending.length === 0 && (
            <div className="empty">沒有待部署的任務。</div>
          )}
          {pending.map(({ task, links }) => {
            const st = statuses.find((s) => s.id === task.status_id);
            return (
              <div className="deploy-card" key={task.id}>
                <div className="deploy-card-title">
                  {st && <StatusDot color={st.color} style={st.style} sm />}
                  <span>{task.title}</span>
                  {task.needs_backend && (
                    <span className="badge-backend">後端</span>
                  )}
                </div>
                <div className="history-meta">
                  {links.map((l) => (
                    <span key={l.project_id} className="chip">
                      <span
                        className="dot"
                        style={{ background: l.project.color, width: 6, height: 6 }}
                      />
                      {l.project.name}
                      {l.branch && <span className="branch">⎇ {l.branch}</span>}
                    </span>
                  ))}
                </div>
                {task.deploy_notes.trim() && (
                  <div className="deploy-note">⚠ {task.deploy_notes}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
