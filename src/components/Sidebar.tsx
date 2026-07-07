'use client';

import { useState } from 'react';
import type { DevStateRow, Project, Workspace } from '@/lib/types';
import { useEnterSubmit } from '@/lib/useEnterSubmit';
import StatusDot from './StatusDot';

export type View = 'board' | 'history';

export default function Sidebar({
  workspaces,
  currentWorkspace,
  onSwitchWorkspace,
  projects,
  devStates,
  view,
  onSetView,
  onAddProject,
  onEditProject,
  onOpenStatusManager,
  userEmail,
  onSignOut,
}: {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  onSwitchWorkspace: (ws: Workspace) => void;
  projects: Project[];
  devStates: DevStateRow[];
  view: View;
  onSetView: (v: View) => void;
  onAddProject: (name: string, repo: string) => void;
  onEditProject: (p: Project) => void;
  onOpenStatusManager: () => void;
  userEmail: string;
  onSignOut: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [repo, setRepo] = useState('');

  function submitProject() {
    if (!name.trim()) return;
    onAddProject(name.trim(), repo.trim());
    setName('');
    setRepo('');
    setAdding(false);
  }

  return (
    <aside className="sidebar">
      <div className="brand">◆ taskeel</div>

      {/* workspace switcher */}
      <div className="ws-switcher">
        <button className="ws-button" onClick={() => setMenuOpen((o) => !o)}>
          <span
            className="dot"
            style={{ background: currentWorkspace?.color ?? '#5E6AD2' }}
          />
          <span style={{ flex: 1 }}>{currentWorkspace?.name ?? '—'}</span>
          <span style={{ color: 'var(--text-faint)' }}>▾</span>
        </button>
        {menuOpen && (
          <div className="ws-menu">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                className="ws-menu-item"
                onClick={() => {
                  onSwitchWorkspace(ws);
                  setMenuOpen(false);
                }}
              >
                <span className="dot" style={{ background: ws.color }} />
                {ws.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* nav */}
      <button
        className={`nav-item${view === 'board' ? ' active' : ''}`}
        onClick={() => onSetView('board')}
      >
        任務看板
      </button>
      <button
        className={`nav-item${view === 'history' ? ' active' : ''}`}
        onClick={() => onSetView('history')}
      >
        部署歷史
      </button>
      <button className="nav-item" onClick={onOpenStatusManager}>
        狀態設定
      </button>

      {/* projects */}
      <div className="sidebar-section">
        <div
          className="sidebar-label"
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <span style={{ flex: 1 }}>專案</span>
          <button
            className="icon-btn"
            style={{ width: 20, height: 20 }}
            title="新專案"
            onClick={() => setAdding((a) => !a)}
          >
            +
          </button>
        </div>
        {projects.map((p) => (
          <div
            className="project-row"
            key={p.id}
            role="button"
            title="編輯專案"
            onClick={() => onEditProject(p)}
          >
            <span className="dot" style={{ background: p.color }} />
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {p.name}
            </span>
            {p.repo && (
              <span
                style={{ fontSize: 10, color: 'var(--text-faint)' }}
                title={p.repo}
              >
                ⎇
              </span>
            )}
            <span className="project-edit">✎</span>
          </div>
        ))}
        {adding && (
          <div style={{ padding: '4px 8px' }}>
            <input
              className="text-input"
              style={{ marginBottom: 4 }}
              placeholder="專案名稱"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              {...useEnterSubmit(submitProject)}
            />
            <input
              className="text-input"
              style={{ marginBottom: 4 }}
              placeholder="repo（選填，如 owner/bibi-bot）"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              {...useEnterSubmit(submitProject)}
            />
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={submitProject}
            >
              新增
            </button>
          </div>
        )}
      </div>

      {/* footer: legend + account */}
      <div className="sidebar-footer">
        <div className="sidebar-label">開發狀態</div>
        {devStates.map((d) => (
          <div className="legend-item" key={d.id}>
            <StatusDot color={d.color} style={d.style} sm />
            {d.name}
          </div>
        ))}
        <div
          className="legend-item"
          style={{ marginTop: 12, justifyContent: 'space-between' }}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={userEmail}
          >
            {userEmail}
          </span>
          <button className="btn-ghost" style={{ padding: '2px 6px' }} onClick={onSignOut}>
            登出
          </button>
        </div>
      </div>
    </aside>
  );
}
