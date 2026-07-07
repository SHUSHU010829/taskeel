'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { enterSubmit } from '@/lib/useEnterSubmit';
import {
  DEFAULT_STATUSES,
  type Project,
  type StatusRow,
  type TaskCategory,
  type TaskWithProjects,
  type Workspace,
} from '@/lib/types';
import Sidebar, { type View } from './Sidebar';
import TaskRow from './TaskRow';
import TaskEditor, { type TaskDraft } from './TaskEditor';
import ProjectEditor from './ProjectEditor';
import WorkspaceEditor from './WorkspaceEditor';
import StatusManager, { type StatusManagerHandlers } from './StatusManager';
import DeploySheet from './DeploySheet';
import DeployHistory from './DeployHistory';

export default function Board({
  userId,
  userEmail,
  initialWorkspaces,
  initialProjects,
  initialStatuses,
}: {
  userId: string;
  userEmail: string;
  initialWorkspaces: Workspace[];
  initialProjects: Project[];
  initialStatuses: StatusRow[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [statuses, setStatuses] = useState<StatusRow[]>(initialStatuses);
  const [currentWs, setCurrentWs] = useState<Workspace | null>(initialWorkspaces[0] ?? null);
  const [tasks, setTasks] = useState<TaskWithProjects[]>([]);
  const [view, setView] = useState<View>('board');
  const [editing, setEditing] = useState<TaskWithProjects | null | 'new'>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingWs, setEditingWs] = useState<Workspace | null | 'new'>(null);
  const [statusMgrOpen, setStatusMgrOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capture, setCapture] = useState('');
  const [fontPx, setFontPx] = useState(15);
  const [pinnedWsId, setPinnedWsId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const seedWsRef = useRef(false);
  const seedingStatusRef = useRef<Set<string>>(new Set());

  const report = useCallback((label: string, err: unknown) => {
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : String(err);
    console.error(`[taskeel] ${label}:`, err);
    setError(`${label}: ${msg}`);
  }, []);

  const wsProjects = useMemo(
    () => projects.filter((p) => p.workspace_id === currentWs?.id),
    [projects, currentWs]
  );
  const wsStatuses = useMemo(
    () =>
      statuses
        .filter((s) => s.workspace_id === currentWs?.id)
        .sort((a, b) => a.position - b.position),
    [statuses, currentWs]
  );
  const boardStatuses = useMemo(() => wsStatuses.filter((s) => !s.is_archive), [wsStatuses]);

  // ---------- first-login: seed the two default workspaces ----------
  useEffect(() => {
    if (workspaces.length > 0 || seedWsRef.current) return;
    seedWsRef.current = true;
    (async () => {
      const { data, error } = await supabase
        .from('workspaces')
        .insert([
          { owner_id: userId, name: '個人', color: '#5E6AD2' },
          { owner_id: userId, name: '工作', color: '#26B5CE' },
        ])
        .select('*');
      if (error) return report('建立 workspace 失敗', error);
      if (data?.length) {
        setWorkspaces(data as Workspace[]);
        setCurrentWs((p) => p ?? (data[0] as Workspace));
      }
    })();
  }, [workspaces.length, supabase, userId, report]);

  // ---------- seed default statuses for any workspace that lacks them ----------
  useEffect(() => {
    const need = workspaces.filter(
      (w) => !statuses.some((s) => s.workspace_id === w.id) && !seedingStatusRef.current.has(w.id)
    );
    if (need.length === 0) return;
    need.forEach((w) => seedingStatusRef.current.add(w.id));
    (async () => {
      for (const w of need) {
        const rows = DEFAULT_STATUSES.map((s, i) => ({
          owner_id: userId,
          workspace_id: w.id,
          position: i,
          ...s,
        }));
        const { data, error } = await supabase.from('task_statuses').insert(rows).select('*');
        if (error) {
          report('建立狀態失敗', error);
          seedingStatusRef.current.delete(w.id);
        } else if (data) {
          setStatuses((prev) => [...prev, ...(data as StatusRow[])]);
        }
      }
    })();
  }, [workspaces, statuses, supabase, userId, report]);

  // ---------- data loading ----------
  const loadTasks = useCallback(async () => {
    if (!currentWs) return;
    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_projects(*, project:projects(*))')
      .eq('workspace_id', currentWs.id)
      .order('created_at', { ascending: false });
    if (error || !data) return;
    setTasks(
      data.map((t: any) => {
        const { task_projects, ...rest } = t;
        return {
          ...rest,
          links: (task_projects ?? []).map((tp: any) => ({
            task_id: tp.task_id,
            project_id: tp.project_id,
            branch: tp.branch,
            deploy_status: tp.deploy_status,
            deployed_at: tp.deployed_at,
            project: tp.project,
          })),
        };
      })
    );
  }, [supabase, currentWs]);

  const loadStatuses = useCallback(async () => {
    const { data } = await supabase.from('task_statuses').select('*').order('position');
    if (data) setStatuses(data as StatusRow[]);
  }, [supabase]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // ---------- realtime ----------
  useEffect(() => {
    if (!currentWs) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(loadTasks, 150);
    };
    const channel = supabase
      .channel(`ws-${currentWs.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${currentWs.id}` },
        refetch
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_projects' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_statuses' }, loadStatuses)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, currentWs, loadTasks, loadStatuses]);

  // ---------- font-size preference ----------
  useEffect(() => {
    try {
      const f = localStorage.getItem('taskeel.fontPx');
      if (f) setFontPx(parseInt(f, 10));
    } catch {
      // ignore
    }
  }, []);

  // ---------- pinned workspace: land here on open ----------
  useEffect(() => {
    try {
      const p = localStorage.getItem('taskeel.pinnedWs');
      if (!p) return;
      setPinnedWsId(p);
      const ws = initialWorkspaces.find((w) => w.id === p);
      if (ws) setCurrentWs(ws);
    } catch {
      // ignore
    }
  }, [initialWorkspaces]);

  function togglePin(wsId: string) {
    const next = pinnedWsId === wsId ? null : wsId;
    setPinnedWsId(next);
    try {
      if (next) localStorage.setItem('taskeel.pinnedWs', next);
      else localStorage.removeItem('taskeel.pinnedWs');
    } catch {
      // ignore
    }
  }

  function switchWorkspace(ws: Workspace) {
    setCurrentWs(ws);
    setProjectFilter(null);
  }

  function changeFont(px: number) {
    setFontPx(px);
    document.documentElement.style.setProperty('--app-font', `${px}px`);
    try {
      localStorage.setItem('taskeel.fontPx', String(px));
    } catch {
      // ignore
    }
  }

  // ---------- quick capture 'c' shortcut ----------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === 'c') {
        e.preventDefault();
        captureRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------- task mutations ----------
  async function quickCapture(title: string) {
    if (!title.trim() || !currentWs) return;
    const def = wsStatuses.find((s) => s.is_default) ?? wsStatuses[0];
    const { error } = await supabase.from('tasks').insert({
      workspace_id: currentWs.id,
      owner_id: userId,
      title: title.trim(),
      status_id: def?.id ?? null,
    });
    if (error) return report('新增任務失敗', error);
    loadTasks();
  }

  function submitCapture() {
    const v = capture;
    if (!v.trim()) return;
    setCapture('');
    quickCapture(v);
  }

  async function saveTask(draft: TaskDraft) {
    if (!currentWs) return;
    const base = {
      title: draft.title,
      description: draft.description,
      status_id: draft.status_id,
      category: draft.category,
      blocked_reason: draft.blocked_reason,
      needs_backend: draft.needs_backend,
      deploy_notes: draft.deploy_notes,
    };

    let taskId: string;
    if (editing && editing !== 'new') {
      taskId = editing.id;
      const { error } = await supabase.from('tasks').update(base).eq('id', taskId);
      if (error) return report('更新任務失敗', error);
    } else {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...base, workspace_id: currentWs.id, owner_id: userId })
        .select('id')
        .single();
      if (error || !data) return report('儲存任務失敗', error);
      taskId = data.id;
    }

    const keepIds = draft.links.map((l) => l.project_id);
    if (draft.links.length > 0) {
      await supabase.from('task_projects').upsert(
        draft.links.map((l) => ({
          task_id: taskId,
          project_id: l.project_id,
          branch: l.branch || null,
        })),
        { onConflict: 'task_id,project_id' }
      );
    }
    let del = supabase.from('task_projects').delete().eq('task_id', taskId);
    del = keepIds.length ? del.not('project_id', 'in', `(${keepIds.join(',')})`) : del;
    await del;

    setEditing(null);
    loadTasks();
  }

  async function setTaskStatus(task: TaskWithProjects, nextId: string, reason: string | null) {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status_id: nextId, blocked_reason: reason } : t))
    );
    const { error } = await supabase
      .from('tasks')
      .update({ status_id: nextId, blocked_reason: reason })
      .eq('id', task.id);
    if (error) report('更新狀態失敗', error);
  }

  async function setTaskCategory(task: TaskWithProjects, cat: TaskCategory | null) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, category: cat } : t)));
    const { error } = await supabase.from('tasks').update({ category: cat }).eq('id', task.id);
    if (error) report('更新分類失敗', error);
  }

  async function moveStatus(task: TaskWithProjects, dir: -1 | 1) {
    const idx = boardStatuses.findIndex((s) => s.id === task.status_id);
    if (idx < 0) return;
    const next = boardStatuses[idx + dir];
    if (!next) return;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status_id: next.id } : t)));
    const { error } = await supabase.from('tasks').update({ status_id: next.id }).eq('id', task.id);
    if (error) report('移動狀態失敗', error);
  }

  // Move a task to another workspace: projects are workspace-scoped, so its
  // project/branch links are cleared and it gets the target's default status.
  async function moveTaskWorkspace(task: TaskWithProjects, wsId: string) {
    const def = statuses.find((s) => s.workspace_id === wsId && s.is_default);
    await supabase.from('task_projects').delete().eq('task_id', task.id);
    const { error } = await supabase
      .from('tasks')
      .update({ workspace_id: wsId, status_id: def?.id ?? null, blocked_reason: null })
      .eq('id', task.id);
    if (error) return report('搬移工作區失敗', error);
    setEditing(null);
    loadTasks();
  }

  async function deleteTask() {
    if (!editing || editing === 'new') return;
    const { error } = await supabase.from('tasks').delete().eq('id', editing.id);
    if (error) return report('刪除任務失敗', error);
    setEditing(null);
    loadTasks();
  }

  // ---------- workspace mutations ----------
  async function addWorkspace(name: string, color: string) {
    const { data, error } = await supabase
      .from('workspaces')
      .insert({ owner_id: userId, name, color })
      .select('*')
      .single();
    if (error || !data) return report('新增工作區失敗', error);
    setWorkspaces((prev) => [...prev, data as Workspace]);
    setCurrentWs(data as Workspace); // statuses seed via effect
    setEditingWs(null);
  }

  async function updateWorkspace(id: string, patch: { name: string; color: string }) {
    const { data, error } = await supabase
      .from('workspaces')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) return report('更新工作區失敗', error);
    setWorkspaces((prev) => prev.map((w) => (w.id === id ? (data as Workspace) : w)));
    setCurrentWs((c) => (c?.id === id ? (data as Workspace) : c));
    setEditingWs(null);
  }

  async function deleteWorkspace(id: string) {
    if (workspaces.length <= 1) return;
    const { error } = await supabase.from('workspaces').delete().eq('id', id);
    if (error) return report('刪除工作區失敗', error);
    const remaining = workspaces.filter((w) => w.id !== id);
    setWorkspaces(remaining);
    setProjects((prev) => prev.filter((p) => p.workspace_id !== id));
    setStatuses((prev) => prev.filter((s) => s.workspace_id !== id));
    if (currentWs?.id === id) setCurrentWs(remaining[0] ?? null);
    setEditingWs(null);
  }

  // ---------- project mutations ----------
  async function addProject(name: string, repo: string) {
    if (!currentWs) return;
    const { data, error } = await supabase
      .from('projects')
      .insert({ workspace_id: currentWs.id, name, repo: repo || null })
      .select('*')
      .single();
    if (error || !data) return report('新增專案失敗', error);
    setProjects((prev) => [...prev, data as Project]);
  }

  async function updateProject(
    id: string,
    patch: { name: string; repo: string | null; color: string }
  ) {
    const { data, error } = await supabase
      .from('projects')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) return report('更新專案失敗', error);
    setProjects((prev) => prev.map((p) => (p.id === id ? (data as Project) : p)));
    setEditingProject(null);
    loadTasks();
  }

  async function deleteProject(id: string) {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) return report('刪除專案失敗', error);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setEditingProject(null);
    loadTasks();
  }

  // ---------- status management (scoped to current workspace) ----------
  async function addStatus(name: string) {
    if (!currentWs) return;
    const pos = wsStatuses.reduce((m, s) => Math.max(m, s.position), -1) + 1;
    const { data, error } = await supabase
      .from('task_statuses')
      .insert({ owner_id: userId, workspace_id: currentWs.id, name, position: pos })
      .select('*')
      .single();
    if (error || !data) return report('新增狀態失敗', error);
    setStatuses((prev) => [...prev, data as StatusRow]);
  }

  async function updateStatus(id: string, patch: Partial<StatusRow>) {
    if (!currentWs) return;
    if (patch.is_default) {
      await supabase
        .from('task_statuses')
        .update({ is_default: false })
        .eq('workspace_id', currentWs.id)
        .eq('is_default', true);
      setStatuses((prev) =>
        prev.map((s) => (s.workspace_id === currentWs.id ? { ...s, is_default: false } : s))
      );
    }
    if (patch.is_archive) {
      await supabase
        .from('task_statuses')
        .update({ is_archive: false })
        .eq('workspace_id', currentWs.id)
        .eq('is_archive', true);
      setStatuses((prev) =>
        prev.map((s) => (s.workspace_id === currentWs.id ? { ...s, is_archive: false } : s))
      );
    }
    const { data, error } = await supabase
      .from('task_statuses')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) return report('更新狀態失敗', error);
    setStatuses((prev) => prev.map((s) => (s.id === id ? (data as StatusRow) : s)));
  }

  async function deleteStatus(id: string) {
    if (!currentWs) return;
    const def = wsStatuses.find((s) => s.is_default && s.id !== id);
    if (def) {
      await supabase
        .from('tasks')
        .update({ status_id: def.id })
        .eq('workspace_id', currentWs.id)
        .eq('status_id', id);
    }
    const { error } = await supabase.from('task_statuses').delete().eq('id', id);
    if (error) return report('刪除狀態失敗', error);
    setStatuses((prev) => prev.filter((s) => s.id !== id));
    loadTasks();
  }

  async function reorderStatuses(ids: string[]) {
    setStatuses((prev) =>
      prev.map((s) => (ids.includes(s.id) ? { ...s, position: ids.indexOf(s.id) } : s))
    );
    const results = await Promise.all(
      ids.map((id, i) => supabase.from('task_statuses').update({ position: i }).eq('id', id))
    );
    const err = results.find((r) => r.error)?.error;
    if (err) report('排序狀態失敗', err);
  }

  const statusHandlers: StatusManagerHandlers = {
    addStatus,
    updateStatus,
    deleteStatus,
    reorderStatuses,
  };

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  // ---------- derived ----------
  const archiveIds = new Set(wsStatuses.filter((s) => s.is_archive).map((s) => s.id));
  const boardTasks = tasks
    .filter((t) => !t.status_id || !archiveIds.has(t.status_id))
    .filter((t) => !projectFilter || t.links.some((l) => l.project_id === projectFilter));
  const filteredProject = projects.find((p) => p.id === projectFilter) ?? null;
  const deployIds = new Set(wsStatuses.filter((s) => s.is_deploy).map((s) => s.id));
  const pendingDeployCount = tasks.filter(
    (t) =>
      t.status_id &&
      deployIds.has(t.status_id) &&
      t.links.some((l) => l.deploy_status === 'pending')
  ).length;

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        workspaces={workspaces}
        currentWorkspace={currentWs}
        onSwitchWorkspace={switchWorkspace}
        onAddWorkspace={() => setEditingWs('new')}
        onEditWorkspace={setEditingWs}
        pinnedWsId={pinnedWsId}
        onTogglePin={togglePin}
        projects={wsProjects}
        projectFilter={projectFilter}
        onFilterProject={(id) => setProjectFilter((cur) => (cur === id ? null : id))}
        statuses={wsStatuses}
        view={view}
        onSetView={setView}
        onAddProject={addProject}
        onEditProject={setEditingProject}
        onOpenStatusManager={() => setStatusMgrOpen(true)}
        fontPx={fontPx}
        onSetFont={changeFont}
        userEmail={userEmail}
        onSignOut={signOut}
      />

      <div className="main">
        {error && (
          <div className="error-banner" onClick={() => setError(null)}>
            ⚠ {error}
            <span style={{ marginLeft: 'auto', opacity: 0.7 }}>點此關閉 ✕</span>
          </div>
        )}
        <div className="topbar">
          <button className="hamburger icon-btn" title="選單" onClick={() => setSidebarOpen(true)}>
            ☰
          </button>
          <span className="breadcrumb">
            {currentWs?.name} · {view === 'board' ? '任務看板' : '部署歷史'}
          </span>
          {view === 'board' && filteredProject && (
            <button
              className="filter-chip"
              title="清除專案篩選"
              onClick={() => setProjectFilter(null)}
            >
              <span className="dot" style={{ background: filteredProject.color }} />
              {filteredProject.name}
              <span style={{ color: 'var(--text-faint)' }}>✕</span>
            </button>
          )}
          <div className="spacer" />
          {view === 'board' && (
            <>
              <button className="btn" onClick={() => setDeployOpen(true)}>
                部署
                {pendingDeployCount > 0 && <span className="badge-count">{pendingDeployCount}</span>}
              </button>
              <button className="btn btn-primary" onClick={() => setEditing('new')}>
                新任務
              </button>
            </>
          )}
        </div>

        {view === 'board' && (
          <div className="quick-capture">
            <span className="capture-plus">＋</span>
            <input
              ref={captureRef}
              value={capture}
              placeholder="快速捕捉：打一行字丟進暫存區…"
              onChange={(e) => setCapture(e.target.value)}
              {...enterSubmit(submitCapture)}
            />
            <span className="kbd">c</span>
            <button className="capture-send" onClick={submitCapture} disabled={!capture.trim()}>
              丟入
            </button>
          </div>
        )}

        <div className="content">
          {view === 'history' ? (
            <DeployHistory tasks={tasks} projects={wsProjects} statuses={wsStatuses} />
          ) : (
            <BoardList
              boardStatuses={boardStatuses}
              tasks={boardTasks}
              statuses={wsStatuses}
              onOpen={setEditing}
              onStatus={setTaskStatus}
              onCategory={setTaskCategory}
              onMove={moveStatus}
            />
          )}
        </div>
      </div>

      {editing !== null && (
        <TaskEditor
          task={editing === 'new' ? null : editing}
          projects={wsProjects}
          statuses={wsStatuses}
          workspaces={workspaces}
          currentWorkspaceId={currentWs?.id ?? null}
          onSave={saveTask}
          onMoveWorkspace={(wsId) =>
            editing !== 'new' && editing && moveTaskWorkspace(editing, wsId)
          }
          onClose={() => setEditing(null)}
          onDelete={editing === 'new' ? undefined : deleteTask}
        />
      )}

      {editingProject && (
        <ProjectEditor
          project={editingProject}
          onSave={(patch) => updateProject(editingProject.id, patch)}
          onDelete={() => deleteProject(editingProject.id)}
          onClose={() => setEditingProject(null)}
        />
      )}

      {editingWs !== null && (
        <WorkspaceEditor
          workspace={editingWs === 'new' ? null : editingWs}
          canDelete={workspaces.length > 1}
          onSave={(patch) =>
            editingWs === 'new'
              ? addWorkspace(patch.name, patch.color)
              : updateWorkspace(editingWs.id, patch)
          }
          onDelete={editingWs === 'new' ? undefined : () => deleteWorkspace(editingWs.id)}
          onClose={() => setEditingWs(null)}
        />
      )}

      {statusMgrOpen && (
        <StatusManager
          statuses={wsStatuses}
          handlers={statusHandlers}
          workspaceName={currentWs?.name}
          onClose={() => setStatusMgrOpen(false)}
        />
      )}

      {deployOpen && (
        <DeploySheet tasks={tasks} statuses={wsStatuses} onClose={() => setDeployOpen(false)} />
      )}
    </div>
  );
}

// Grouped-by-status list.
function BoardList({
  boardStatuses,
  tasks,
  statuses,
  onOpen,
  onStatus,
  onCategory,
  onMove,
}: {
  boardStatuses: StatusRow[];
  tasks: TaskWithProjects[];
  statuses: StatusRow[];
  onOpen: (t: TaskWithProjects) => void;
  onStatus: (t: TaskWithProjects, id: string, r: string | null) => void;
  onCategory: (t: TaskWithProjects, c: TaskCategory | null) => void;
  onMove: (t: TaskWithProjects, dir: -1 | 1) => void;
}) {
  if (boardStatuses.length === 0) {
    return <div className="empty">還沒有狀態。到左側「狀態設定」新增。</div>;
  }

  return (
    <>
      {boardStatuses.map((status, i) => {
        const items = tasks.filter((t) => t.status_id === status.id);
        return (
          <div className="group" key={status.id}>
            <div className="group-header">
              <span className="group-square" style={{ background: status.color }} />
              <span className="group-title">{status.name}</span>
              <span className="badge-count">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <div className="empty-row">—</div>
            ) : (
              items.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  statuses={statuses}
                  canBack={i > 0}
                  canFwd={i < boardStatuses.length - 1}
                  onOpen={() => onOpen(task)}
                  onStatus={(id, r) => onStatus(task, id, r)}
                  onCategory={(c) => onCategory(task, c)}
                  onMove={(dir) => onMove(task, dir)}
                />
              ))
            )}
          </div>
        );
      })}
    </>
  );
}
