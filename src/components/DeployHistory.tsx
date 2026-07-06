'use client';

import { useState } from 'react';
import {
  CATEGORY_META,
  type Project,
  type TaskWithProjects,
} from '@/lib/types';

// Read-only changelog: archived tasks newest-first, filterable by project.
export default function DeployHistory({
  tasks,
  projects,
}: {
  tasks: TaskWithProjects[];
  projects: Project[];
}) {
  const [filter, setFilter] = useState<string | null>(null);

  const archived = tasks
    .filter((t) => t.status === 'archived')
    .filter(
      (t) => !filter || t.links.some((l) => l.project_id === filter)
    )
    .sort((a, b) =>
      (b.archived_at ?? '').localeCompare(a.archived_at ?? '')
    );

  return (
    <div>
      <div className="filter-bar">
        <button
          className={`option${filter === null ? ' selected' : ''}`}
          onClick={() => setFilter(null)}
        >
          全部
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            className={`option${filter === p.id ? ' selected' : ''}`}
            onClick={() => setFilter(p.id)}
          >
            <span className="dot" style={{ background: p.color }} />
            {p.name}
          </button>
        ))}
      </div>

      {archived.length === 0 && <div className="empty">還沒有已歸檔的任務。</div>}

      {archived.map((t) => {
        const cat = t.category ? CATEGORY_META[t.category] : null;
        return (
          <div className="history-row" key={t.id}>
            <div className="history-head">
              {cat && (
                <span className="cat-dot" style={{ background: cat.color }} />
              )}
              <span className="history-title">{t.title}</span>
              <span className="history-time">
                {t.archived_at
                  ? new Date(t.archived_at).toLocaleString()
                  : ''}
              </span>
            </div>
            <div className="history-meta">
              {t.links.map((l) => (
                <span key={l.project_id} className="chip deployed">
                  <span
                    className="dot"
                    style={{ background: l.project.color, width: 6, height: 6 }}
                  />
                  {l.project.name}
                  {l.branch && <span className="branch">⎇ {l.branch}</span>}
                  {l.deployed_at && (
                    <span className="branch">
                      · {new Date(l.deployed_at).toLocaleDateString()}
                    </span>
                  )}
                </span>
              ))}
            </div>
            {t.deploy_notes.trim() && (
              <div className="deploy-note" style={{ marginTop: 8 }}>
                {t.deploy_notes}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
