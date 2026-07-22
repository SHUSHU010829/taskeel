'use client';

import { useState } from 'react';
import { Check, CircleCheck, Copy, Download, FileText, GitBranch, Link2, List, TriangleAlert, X } from 'lucide-react';
import type { StatusRow, TaskWithProjects } from '@/lib/types';
import StatusDot from './StatusDot';

// Slide-over aggregating everything waiting to deploy: each task in a
// deploy-stage status with its still-pending project branches, plus deploy
// reminders and backend flags. Actual archiving is CI-driven.
export default function DeploySheet({
  tasks,
  allTasks,
  statuses,
  onMarkDeployed,
  onClose,
}: {
  tasks: TaskWithProjects[];
  allTasks: TaskWithProjects[];
  statuses: StatusRow[];
  onMarkDeployed: (task: TaskWithProjects) => void;
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

  // Build an editable, project-grouped plain-text deploy list.
  function buildText() {
    const byProject = new Map<string, { name: string; items: string[] }>();
    const order: string[] = [];
    pending.forEach(({ task, links }) => {
      links.forEach((l) => {
        if (!byProject.has(l.project_id)) {
          byProject.set(l.project_id, { name: l.project.name, items: [] });
          order.push(l.project_id);
        }
        const branch = l.branch ? `（${l.branch}）` : '';
        const backend = task.needs_backend ? ' [需後端]' : '';
        byProject.get(l.project_id)!.items.push(`- ${task.title}${branch}${backend}`);
      });
    });
    const lines: string[] = [`部署清單（${pending.length} 項）`, ''];
    for (const id of order) {
      const g = byProject.get(id)!;
      lines.push(`【${g.name}】`, ...g.items, '');
    }
    return lines.join('\n').trim();
  }

  const [textMode, setTextMode] = useState(false);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  function openText() {
    setText(buildText());
    setCopied(false);
    setTextMode(true);
  }

  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function download() {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '部署清單.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

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
          {pending.length > 0 && (
            <button
              className="btn deploy-text-toggle"
              onClick={() => (textMode ? setTextMode(false) : openText())}
            >
              {textMode ? (
                <>
                  <List size={14} /> 清單
                </>
              ) : (
                <>
                  <FileText size={14} /> 文字檔
                </>
              )}
            </button>
          )}
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {textMode ? (
          <div className="deploy-text-pane">
            <div className="deploy-text-actions">
              <button className="btn" onClick={copy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? '已複製' : '複製'}
              </button>
              <button className="btn" onClick={download}>
                <Download size={14} /> 下載 .txt
              </button>
            </div>
            <textarea
              className="deploy-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
          </div>
        ) : (
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
                <div className="deploy-card-actions">
                  <button
                    className="btn deploy-done-btn"
                    title="標記此任務所有專案為已部署，並歸檔"
                    onClick={() => onMarkDeployed(task)}
                  >
                    <CircleCheck size={14} /> 標記已部署完畢
                  </button>
                </div>
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
        )}
      </div>
    </>
  );
}
