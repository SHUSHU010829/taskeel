'use client';

import { useEffect, useRef, useState } from 'react';
import type { Project, StatusRow, Workspace } from '@/lib/types';
import { enterSubmit } from '@/lib/useEnterSubmit';
import StatusDot from './StatusDot';

export type View = 'board' | 'history';

const FONT_SIZES = [
  { label: '小', px: 13 },
  { label: '中', px: 15 },
  { label: '大', px: 17 },
  { label: '特大', px: 19 },
];

export default function Sidebar({
  open,
  onClose,
  workspaces,
  currentWorkspace,
  onSwitchWorkspace,
  onAddWorkspace,
  onEditWorkspace,
  projects,
  statuses,
  view,
  onSetView,
  onAddProject,
  onEditProject,
  onOpenStatusManager,
  fontPx,
  onSetFont,
  userEmail,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  onSwitchWorkspace: (ws: Workspace) => void;
  onAddWorkspace: () => void;
  onEditWorkspace: (ws: Workspace) => void;
  projects: Project[];
  statuses: StatusRow[];
  view: View;
  onSetView: (v: View) => void;
  onAddProject: (name: string, repo: string) => void;
  onEditProject: (p: Project) => void;
  onOpenStatusManager: () => void;
  fontPx: number;
  onSetFont: (px: number) => void;
  userEmail: string;
  onSignOut: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [repo, setRepo] = useState('');
  const [acctOpen, setAcctOpen] = useState(false);
  const acctRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!acctOpen) return;
    const h = (e: MouseEvent) => {
      if (acctRef.current && !acctRef.current.contains(e.target as Node))
        setAcctOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [acctOpen]);

  function submitProject() {
    if (!name.trim()) return;
    onAddProject(name.trim(), repo.trim());
    setName('');
    setRepo('');
    setAdding(false);
  }

  // Navigate + close the mobile drawer.
  function go(v: View) {
    onSetView(v);
    onClose();
  }

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
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
                <div className="ws-menu-row" key={ws.id}>
                  <button
                    className="ws-menu-item"
                    style={{ flex: 1 }}
                    onClick={() => {
                      onSwitchWorkspace(ws);
                      setMenuOpen(false);
                    }}
                  >
                    <span className="dot" style={{ background: ws.color }} />
                    {ws.name}
                  </button>
                  <button
                    className="icon-btn ws-edit"
                    title="編輯工作區"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditWorkspace(ws);
                      setMenuOpen(false);
                    }}
                  >
                    ✎
                  </button>
                </div>
              ))}
              <button
                className="ws-menu-item"
                style={{ color: 'var(--text-dim)' }}
                onClick={() => {
                  onAddWorkspace();
                  setMenuOpen(false);
                }}
              >
                ＋ 新增工作區
              </button>
            </div>
          )}
        </div>

        {/* nav */}
        <button
          className={`nav-item${view === 'board' ? ' active' : ''}`}
          onClick={() => go('board')}
        >
          任務看板
        </button>
        <button
          className={`nav-item${view === 'history' ? ' active' : ''}`}
          onClick={() => go('history')}
        >
          部署歷史
        </button>
        <button
          className="nav-item"
          title="編輯目前工作區的狀態"
          onClick={() => {
            onOpenStatusManager();
            onClose();
          }}
        >
          ⚙ 狀態設定
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
                {...enterSubmit(submitProject)}
              />
              <input
                className="text-input"
                style={{ marginBottom: 4 }}
                placeholder="repo（選填，如 owner/bibi-bot）"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                {...enterSubmit(submitProject)}
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

        {/* footer: legend + account menu */}
        <div className="sidebar-footer">
          <div className="sidebar-label">狀態</div>
          {statuses.map((s) => (
            <div className="legend-item" key={s.id}>
              <StatusDot color={s.color} style={s.style} sm />
              {s.name}
            </div>
          ))}

          <div className="acct" ref={acctRef}>
            <button
              className="acct-button"
              onClick={() => setAcctOpen((o) => !o)}
            >
              <span className="acct-avatar">
                {userEmail ? userEmail[0].toUpperCase() : '·'}
              </span>
              <span className="acct-email" title={userEmail}>
                {userEmail}
              </span>
              <span style={{ color: 'var(--text-faint)' }}>⚙</span>
            </button>
            {acctOpen && (
              <div className="acct-menu">
                <div className="font-control">
                  <span className="font-control-label">字體大小</span>
                  <div className="font-options">
                    {FONT_SIZES.map((f) => (
                      <button
                        key={f.px}
                        className={`font-option${fontPx === f.px ? ' on' : ''}`}
                        onClick={() => onSetFont(f.px)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  className="ws-menu-item"
                  onClick={() => {
                    setAcctOpen(false);
                    onSignOut();
                  }}
                >
                  ⇥ 登出
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
