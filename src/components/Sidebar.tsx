'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Diamond,
  FileText,
  GitBranch,
  LayoutList,
  LogOut,
  MessagesSquare,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Pin,
  Plus,
  Rocket,
  Settings,
  Sun,
} from 'lucide-react';
import type { Project, StatusRow, Workspace } from '@/lib/types';
import { enterSubmit } from '@/lib/useEnterSubmit';
import ConfirmDialog from './ConfirmDialog';
import StatusDot from './StatusDot';
import WorkspaceIcon from './WorkspaceIcon';

export type View = 'board' | 'history' | 'docs' | 'discussion';

const FONT_SIZES = [
  { label: '小', px: 13 },
  { label: '中', px: 15 },
  { label: '大', px: 17 },
  { label: '特大', px: 19 },
];

const PRESET_COLORS = [
  '#5E6AD2',
  '#26B5CE',
  '#4CB782',
  '#E5A00D',
  '#EB5757',
  '#8A8F98',
  '#B57EDC',
  '#F2994A',
];

type ProjectPatch = { name: string; repo: string | null; color: string; abbr: string | null };

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
  onUpdateProject,
  onDeleteProject,
  width,
  fontPx,
  onSetFont,
  theme,
  onToggleTheme,
  userName,
  userAvatar,
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
  onAddProject: (patch: ProjectPatch) => void;
  onUpdateProject: (id: string, patch: ProjectPatch) => void;
  onDeleteProject: (id: string) => void;
  width: number;
  fontPx: number;
  onSetFont: (px: number) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  userName: string;
  userAvatar: string;
  onSignOut: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [repo, setRepo] = useState('');
  const [addAbbr, setAddAbbr] = useState('');
  const [addColor, setAddColor] = useState(PRESET_COLORS[0]);
  const [acctOpen, setAcctOpen] = useState(false);
  const acctRef = useRef<HTMLDivElement>(null);
  // inline project settings (was a center modal, now lives in the sidebar)
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState('');
  const [eRepo, setERepo] = useState('');
  const [eAbbr, setEAbbr] = useState('');
  const [eColor, setEColor] = useState('#5E6AD2');
  const [confirmDel, setConfirmDel] = useState<Project | null>(null);

  function openEdit(p: Project) {
    setAdding(false);
    setEditId((cur) => (cur === p.id ? null : p.id));
    setEName(p.name);
    setERepo(p.repo ?? '');
    setEAbbr(p.abbr ?? '');
    setEColor(p.color);
  }
  function saveEdit() {
    if (!editId || !eName.trim()) return;
    onUpdateProject(editId, {
      name: eName.trim(),
      repo: eRepo.trim() || null,
      abbr: eAbbr.trim() || null,
      color: eColor,
    });
    setEditId(null);
  }

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
    onAddProject({
      name: name.trim(),
      repo: repo.trim() || null,
      abbr: addAbbr.trim() || null,
      color: addColor,
    });
    setName('');
    setRepo('');
    setAddAbbr('');
    setAddColor(PRESET_COLORS[0]);
    setAdding(false);
  }

  function openAdd() {
    setEditId(null);
    setName('');
    setRepo('');
    setAddAbbr('');
    setAddColor(PRESET_COLORS[0]);
    setAdding((a) => !a);
  }

  // Navigate + close the mobile drawer.
  function go(v: View) {
    onSetView(v);
    onClose();
  }

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside
        className={`sidebar${open ? ' open' : ''}${rail ? ' rail' : ''}`}
        style={{ ['--sidebar-w' as string]: `${width}px` } as React.CSSProperties}
      >
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
                    title="工作區設定"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditWorkspace(ws);
                      setMenuOpen(false);
                    }}
                  >
                    <Settings size={14} />
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
          className={`nav-item${view === 'docs' ? ' active' : ''}`}
          title={rail ? '文件' : undefined}
          onClick={() => go('docs')}
        >
          <FileText size={15} />
          {!rail && '文件'}
        </button>
        <button
          className={`nav-item${view === 'discussion' ? ' active' : ''}`}
          title={rail ? '討論' : undefined}
          onClick={() => go('discussion')}
        >
          <MessagesSquare size={15} />
          {!rail && '討論'}
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
                  onClick={openAdd}
                >
                  <Plus size={14} />
                </button>
              </div>
              {projects.map((p) => (
                <div key={p.id}>
                  <div
                    className={`project-row${projectFilter === p.id ? ' active' : ''}${
                      editId === p.id ? ' editing' : ''
                    }`}
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
                      title="專案設定"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(p);
                      }}
                    >
                      <Settings size={13} />
                    </button>
                  </div>

                  {editId === p.id && (
                    <div className="project-edit-panel" onClick={(e) => e.stopPropagation()}>
                      <input
                        className="text-input"
                        placeholder="專案名稱"
                        autoFocus
                        value={eName}
                        onChange={(e) => setEName(e.target.value)}
                        {...enterSubmit(saveEdit)}
                      />
                      <input
                        className="text-input"
                        placeholder="repo（供部署歸檔比對，如 owner/bibi-bot）"
                        value={eRepo}
                        onChange={(e) => setERepo(e.target.value)}
                        {...enterSubmit(saveEdit)}
                      />
                      <input
                        className="text-input"
                        placeholder="縮寫（快速捕捉用 @縮寫，如 et）"
                        value={eAbbr}
                        onChange={(e) => setEAbbr(e.target.value)}
                        {...enterSubmit(saveEdit)}
                      />
                      <div className="project-edit-colors">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            className="color-swatch"
                            onClick={() => setEColor(c)}
                            style={{
                              background: c,
                              outline: eColor === c ? '2px solid var(--text)' : '2px solid transparent',
                            }}
                            title={c}
                          />
                        ))}
                      </div>
                      <div className="project-edit-actions">
                        <button
                          className="btn btn-ghost"
                          style={{ color: '#EB5757', marginRight: 'auto' }}
                          onClick={() => setConfirmDel(p)}
                        >
                          刪除
                        </button>
                        <button className="btn btn-ghost" onClick={() => setEditId(null)}>
                          取消
                        </button>
                        <button className="btn btn-primary" disabled={!eName.trim()} onClick={saveEdit}>
                          儲存
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {adding && (
                <div className="project-edit-panel">
                  <input
                    className="text-input"
                    placeholder="專案名稱"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    {...enterSubmit(submitProject)}
                  />
                  <input
                    className="text-input"
                    placeholder="repo（供部署歸檔比對，如 owner/bibi-bot）"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    {...enterSubmit(submitProject)}
                  />
                  <input
                    className="text-input"
                    placeholder="縮寫（快速捕捉用 @縮寫，如 et）"
                    value={addAbbr}
                    onChange={(e) => setAddAbbr(e.target.value)}
                    {...enterSubmit(submitProject)}
                  />
                  <div className="project-edit-colors">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        className="color-swatch"
                        onClick={() => setAddColor(c)}
                        style={{
                          background: c,
                          outline: addColor === c ? '2px solid var(--text)' : '2px solid transparent',
                        }}
                        title={c}
                      />
                    ))}
                  </div>
                  <div className="project-edit-actions">
                    <button
                      className="btn btn-ghost"
                      style={{ marginLeft: 'auto' }}
                      onClick={() => setAdding(false)}
                    >
                      取消
                    </button>
                    <button className="btn btn-primary" disabled={!name.trim()} onClick={submitProject}>
                      新增
                    </button>
                  </div>
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
              title={rail ? userName : undefined}
              onClick={() => setAcctOpen((o) => !o)}
            >
              <span className="acct-avatar">
                {userAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userAvatar} alt="" className="acct-avatar-img" />
                ) : userName ? (
                  userName[0].toUpperCase()
                ) : (
                  '·'
                )}
              </span>
              {!rail && (
                <>
                  <span className="acct-email" title={userName}>
                    {userName}
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
                <div className="acct-sep" />
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

      {confirmDel && (
        <ConfirmDialog
          title="刪除專案"
          message={`刪除專案「${confirmDel.name}」？\n該專案在所有任務上的分支關聯也會一併移除（任務本身保留）。`}
          confirmLabel="刪除"
          danger
          onConfirm={() => {
            const id = confirmDel.id;
            setConfirmDel(null);
            setEditId(null);
            onDeleteProject(id);
          }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </>
  );
}
