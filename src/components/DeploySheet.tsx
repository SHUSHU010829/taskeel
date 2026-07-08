'use client';

import { GitBranch, Link2, TriangleAlert, X } from 'lucide-react';
import type { StatusRow, TaskWithProjects } from '@/lib/types';
import StatusDot from './StatusDot';

// Slide-over aggregating everything waiting to deploy: each task in a
// deploy-stage status with its still-pending project branches, plus deploy
// reminders and backend flags. Actual archiving is CI-driven.
export default function DeploySheet({
  tasks,
  allTasks,
  statuses,
  onClose,
}: {
  tasks: TaskWithProjects[];
  allTasks: TaskWithProjects[];
  statuses: StatusRow[];
  onClose: () => void;
}) {
  const deployIds = new Set(
    statuses.filter((s) => s.is_deploy).map((s) => s.id)
  );

  // Bundle-mates of a task that still need shipping (not yet archived).
  const bundleMates = (task: TaskWithProjects) =>
    task.bundle_id
      ? allTasks.filter(
          (t) => t.id !== task.id && t.bundle_id === task.bundle_id && !t.archived_at
        )
      : [];

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
            <X size={16} />
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
                      {l.branch && (
                        <span className="branch">
                          <GitBranch size={11} /> {l.branch}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
                {task.deploy_notes.trim() && (
                  <div className="deploy-note">
                    <TriangleAlert size={13} /> {task.deploy_notes}
                  </div>
                )}
                {(() => {
                  const mates = bundleMates(task);
                  if (mates.length === 0) return null;
                  return (
                    <div className="deploy-bundle">
                      <div className="deploy-bundle-head">
                        <Link2 size={13} /> 需一併部署
                      </div>
                      {mates.map((m) => {
                        const ms = statuses.find((s) => s.id === m.status_id);
                        return (
                          <div className="deploy-bundle-mate" key={m.id}>
                            {ms && <StatusDot color={ms.color} style={ms.style} sm />}
                            <span>{m.title}</span>
                            {ms && <span className="deploy-bundle-state">{ms.name}</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
