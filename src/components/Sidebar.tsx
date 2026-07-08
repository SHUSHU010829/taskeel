'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Diamond,
  GitBranch,
  LayoutList,
  LogOut,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Pencil,
  Pin,
  Plus,
  Rocket,
  Settings,
  Sun,
} from 'lucide-react';
import type { Project, StatusRow, Workspace } from '@/lib/types';
import { enterSubmit } from '@/lib/useEnterSubmit';
import StatusDot from './StatusDot';
import WorkspaceIcon from './WorkspaceIcon';

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
  collapsed,
  onToggleCollapsed,
  workspaces,
  currentWorkspace,
  onSwitchWorkspace,
  onAddWorkspace,
  onEditWorkspace,
  pinnedWsId,
  onTogglePin,
  projects,
  projectFilter,
  onFilterProject,
  statuses,
  view,
  onSetView,
  onAddProject,
  onEditProject,
  onOpenStatusManager,
  fontPx,
  onSetFont,
  theme,
  onToggleTheme,
  userEmail,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  onSwitchWorkspace: (ws: Workspace) => void;
  onAddWorkspace: () => void;
  onEditWorkspace: (ws: Workspace) => void;
  pinnedWsId: string | null;
  onTogglePin: (wsId: string) => void;
  projects: Project[];
  projectFilter: string | null;
  onFilterProject: (id: string) => void;
  statuses: StatusRow[];
  view: View;
  onSetView: (v: View) => void;
  onAddProject: (name: string, repo: string) => void;
  onEditProject: (p: Project) => void;
  onOpenStatusManager: () => void;
  fontPx: number;
  onSetFont: (px: number) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  userEmail: string;
  onSignOut: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [repo, setRepo] = useState('');
  const [acctOpen, setAcctOpen] = useState(false);
  const acctRef = useRef<HTMLDivElement>(null);

  // A drawer that's explicitly open (mobile) always shows the full layout.
  const rail = collapsed && !open;

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
      <aside className={`sidebar${open ? ' open' : ''}${rail ? ' rail' : ''}`}>
        <div className="brand">
          {!rail && (
            <>
              <Diamond size={15} fill="currentColor" />
              <span style={{ flex: 1 }}>Taskeel</span>
            </>
          )}
          <button
            className="collapse-toggle"
            title={rail ? '展開側欄' : '收合側欄'}
            onClick={onToggleCollapsed}
          >
            {rail ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>

        {/* workspace switcher */}
        <div className="ws-switcher">
          <button
            className={rail ? 'ws-rail' : 'ws-button'}
            title={rail ? currentWorkspace?.name : undefined}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span style={{ color: currentWorkspace?.color ?? '#5E6AD2', display: 'inline-flex' }}>
              <WorkspaceIcon icon={currentWorkspace?.icon} size={16} />
            </span>
            {!rail && (
              <>
                <span style={{ flex: 1 }}>{currentWorkspace?.name ?? '—'}</span>
                {currentWorkspace && pinnedWsId === currentWorkspace.id && (
                  <Pin size={12} fill="currentColor" style={{ color: 'var(--accent)' }} />
                )}
                <ChevronDown size={14} style={{ color: 'var(--text-faint)' }} />
              </>
            )}
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
                    <span style={{ color: ws.color, display: 'inline-flex' }}>
                      <WorkspaceIcon icon={ws.icon} size={15} />
                    </span>
                    {ws.name}
                  </button>
                  <button
                    className={`icon-btn ws-pin${pinnedWsId === ws.id ? ' on' : ''}`}
                    title={pinnedWsId === ws.id ? '取消釘選' : '釘選（每次進來預設顯示）'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(ws.id);
                    }}
                  >
                    <Pin size={14} fill={pinnedWsId === ws.id ? 'currentColor' : 'none'} />
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
                    <Pencil size={14} />
                  </button>
                </div>
              ))}
              <button
                className="ws-menu-item"
                style={{ color: 'var(--text-dim)', gap: 6 }}
                onClick={() => {
                  onAddWorkspace();
                  setMenuOpen(false);
                }}
              >
                <Plus size={14} /> 新增工作區
              </button>
            </div>
          )}
        </div>

        {/* nav */}
        <button
          className={`nav-item${view === 'board' ? ' active' : ''}`}
          title={rail ? '任務看板' : undefined}
          onClick={() => go('board')}
        >
          <LayoutList size={15} />
          {!rail && '任務看板'}
        </button>
        <button
          className={`nav-item${view === 'history' ? ' active' : ''}`}
          title={rail ? '部署歷史' : undefined}
          onClick={() => go('history')}
        >
          <Rocket size={15} />
          {!rail && '部署歷史'}
        </button>
        <button
          className="nav-item"
          title={rail ? '工作區設定' : '編輯目前工作區（名稱、顏色、狀態）'}
          onClick={() => {
            onOpenStatusManager();
            onClose();
          }}
        >
          <Settings size={15} />
          {!rail && '工作區設定'}
        </button>

        {/* projects */}
        <div className="sidebar-section">
          {rail ? (
            <div className="rail-projects">
              {projects.map((p) => (
                <button
                  key={p.id}
                  className={`rail-project${projectFilter === p.id ? ' active' : ''}`}
                  title={p.name}
                  onClick={() => onFilterProject(p.id)}
                >
                  <span className="dot" style={{ background: p.color, width: 10, height: 10 }} />
                </button>
              ))}
            </div>
          ) : (
            <>
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
                  <Plus size={14} />
                </button>
              </div>
              {projects.map((p) => (
                <div
                  className={`project-row${projectFilter === p.id ? ' active' : ''}`}
                  key={p.id}
                  role="button"
                  title="只看此專案的任務"
                  onClick={() => onFilterProject(p.id)}
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
                    <span title={p.repo} style={{ display: 'inline-flex', color: 'var(--text-faint)' }}>
                      <GitBranch size={12} />
                    </span>
                  )}
                  <button
                    className="icon-btn project-edit"
                    title="編輯專案"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditProject(p);
                    }}
                  >
                    <Pencil size={13} />
                  </button>
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
                    placeholder="repo（選填,如 owner/bibi-bot）"
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
            </>
          )}
        </div>

        {/* footer: legend + account menu */}
        <div className="sidebar-footer">
          {!rail && (
            <>
              <div className="sidebar-label">狀態</div>
              {statuses.map((s) => (
                <div className="legend-item" key={s.id}>
                  <StatusDot color={s.color} style={s.style} sm />
                  {s.name}
                </div>
              ))}
            </>
          )}

          <div className="acct" ref={acctRef}>
            <button
              className={rail ? 'acct-rail' : 'acct-button'}
              title={rail ? userEmail : undefined}
              onClick={() => setAcctOpen((o) => !o)}
            >
              <span className="acct-avatar">
                {userEmail ? userEmail[0].toUpperCase() : '·'}
              </span>
              {!rail && (
                <>
                  <span className="acct-email" title={userEmail}>
                    {userEmail}
                  </span>
                  <Settings size={15} style={{ color: 'var(--text-faint)' }} />
                </>
              )}
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
                  style={{ gap: 8 }}
                  onClick={onToggleTheme}
                >
                  {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                  {theme === 'dark' ? '切換為淺色' : '切換為深色'}
                </button>
                <button
                  className="ws-menu-item"
                  style={{ gap: 8 }}
                  onClick={() => {
                    setAcctOpen(false);
                    onSignOut();
                  }}
                >
                  <LogOut size={14} /> 登出
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
