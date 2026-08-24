'use client';

import { useState } from 'react';
import { GitBranch, Rocket } from 'lucide-react';
import {
  type CategoryRow,
  type Project,
  type StatusRow,
  type TaskWithProjects,
} from '@/lib/types';

// Read-only changelog: archived tasks newest-first, filterable by project.
export default function DeployHistory({
  tasks,
  projects,
  statuses,
  categories,
}: {
  tasks: TaskWithProjects[];
  projects: Project[];
  statuses: StatusRow[];
  categories: CategoryRow[];
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const archiveIds = new Set(
    statuses.filter((s) => s.is_archive).map((s) => s.id)
  );

  const archived = tasks
    .filter((t) => t.status_id && archiveIds.has(t.status_id))
    .filter((t) => !filter || t.links.some((l) => l.project_id === filter))
    .sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? ''));

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

      {/* tasks archived at the same instant were part of one deployment — group
          them (the list is already sorted by archived_at, so runs are contiguous) */}
      {groupByDeploy(archived).map((group) => (
        <div className="deploy-group" key={group.key}>
          <div className="deploy-group-head">
            <Rocket size={13} />
            <span className="deploy-group-time">
              {group.at ? new Date(group.at).toLocaleString() : '未記錄時間'}
            </span>
            {group.tasks.length > 1 && (
              <span className="deploy-group-count">{group.tasks.length} 項</span>
            )}
          </div>
          {group.tasks.map((t) => {
            const cat = categories.find((c) => c.id === t.category_id) ?? null;
            return (
              <div className="history-row" key={t.id}>
                <div className="history-head">
                  {cat && <span className="cat-dot" style={{ background: cat.color }} />}
                  <span className="history-title">{t.title}</span>
                </div>
                <div className="history-meta">
                  {t.links.map((l) => (
                    <span key={l.project_id} className="chip deployed">
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
                {t.deploy_notes.trim() && (
                  <div className="deploy-note" style={{ marginTop: 8 }}>
                    {t.deploy_notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Group contiguous tasks sharing the same archived_at (one deployment batch).
function groupByDeploy(tasks: TaskWithProjects[]) {
  const groups: { key: string; at: string | null; tasks: TaskWithProjects[] }[] = [];
  for (const t of tasks) {
    const key = t.archived_at ?? 'unknown';
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.tasks.push(t);
    else groups.push({ key, at: t.archived_at, tasks: [t] });
  }
  return groups;
}
