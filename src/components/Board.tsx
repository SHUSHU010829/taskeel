'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  DEFAULT_STATUSES,
  DEFAULT_DEV_STATES,
  type DevStateRow,
  type Project,
  type StatusRow,
  type TaskWithProjects,
  type Workspace,
} from '@/lib/types';
import Sidebar, { type View } from './Sidebar';
import TaskRow from './TaskRow';
import TaskEditor, { type TaskDraft } from './TaskEditor';
import ProjectEditor from './ProjectEditor';
import StatusManager, { type StatusManagerHandlers } from './StatusManager';
import DeploySheet from './DeploySheet';
import DeployHistory from './DeployHistory';

export default function Board({
  userId,
  userEmail,
  initialWorkspaces,
  initialProjects,
  initialStatuses,
  initialDevStates,
}: {
  userId: string;
  userEmail: string;
  initialWorkspaces: Workspace[];
  initialProjects: Project[];
  initialStatuses: StatusRow[];
  initialDevStates: DevStateRow[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [statuses, setStatuses] = useState<StatusRow[]>(initialStatuses);
  const [devStates, setDevStates] = useState<DevStateRow[]>(initialDevStates);
  const [currentWs, setCurrentWs] = useState<Workspace | null>(
    initialWorkspaces[0] ?? null
  );
  const [tasks, setTasks] = useState<TaskWithProjects[]>([]);
  const [view, setView] = useState<View>('board');
  const [editing, setEditing] = useState<TaskWithProjects | null | 'new'>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [statusMgrOpen, setStatusMgrOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capture, setCapture] = useState('');
  const captureRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const seedWsRef = useRef(false);
  const seedStatusRef = useRef(false);
  const seedDevRef = useRef(false);

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
  const orderedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.position - b.position),
    [statuses]
  );
  const orderedDevStates = useMemo(
    () => [...devStates].sort((a, b) => a.position - b.position),
    [devStates]
  );
  // Board columns = statuses that aren't the archive bucket.
  const boardStatuses = useMemo(
    () => orderedStatuses.filter((s) => !s.is_archive),
    [orderedStatuses]
  );

  // ---------- first-login seeding (browser client carries the session) ----------
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

  useEffect(() => {
    if (statuses.length > 0 || seedStatusRef.current) return;
    seedStatusRef.current = true;
    (async () => {
      const rows = DEFAULT_STATUSES.map((s, i) => ({
        owner_id: userId,
        position: i,
        ...s,
      }));
      const { data, error } = await supabase
        .from('task_statuses')
        .insert(rows)
        .select('*');
      if (error) return report('建立流程狀態失敗', error);
      if (data) setStatuses(data as StatusRow[]);
    })();
  }, [statuses.length, supabase, userId, report]);

  useEffect(() => {
    if (devStates.length > 0 || seedDevRef.current) return;
    seedDevRef.current = true;
    (async () => {
      const rows = DEFAULT_DEV_STATES.map((d, i) => ({
        owner_id: userId,
        position: i,
        is_default: i === 0,
        ...d,
      }));
      const { data, error } = await supabase
        .from('dev_states')
        .insert(rows)
        .select('*');
      if (error) return report('建立開發狀態失敗', error);
      if (data) setDevStates(data as DevStateRow[]);
    })();
  }, [devStates.length, supabase, userId, report]);

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

  const loadMeta = useCallback(async () => {
    const [{ data: s }, { data: d }] = await Promise.all([
      supabase.from('task_statuses').select('*').order('position'),
      supabase.from('dev_states').select('*').order('position'),
    ]);
    if (s) setStatuses(s as StatusRow[]);
    if (d) setDevStates(d as DevStateRow[]);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_statuses' }, loadMeta)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dev_states' }, loadMeta)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, currentWs, loadTasks, loadMeta]);

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
    const def = statuses.find((s) => s.is_default) ?? orderedStatuses[0];
    const dev = devStates.find((d) => d.is_default) ?? orderedDevStates[0];
    const { error } = await supabase.from('tasks').insert({
      workspace_id: currentWs.id,
      owner_id: userId,
      title: title.trim(),
      status_id: def?.id ?? null,
      dev_state_id: dev?.id ?? null,
    });
    if (error) return report('新增任務失敗', error);
    loadTasks();
  }

  async function saveTask(draft: TaskDraft) {
    if (!currentWs) return;
    const base = {
      title: draft.title,
      description: draft.description,
      status_id: draft.status_id,
      category: draft.category,
      dev_state_id: draft.dev_state_id,
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

  async function updateDevState(
    task: TaskWithProjects,
    nextId: string,
    reason: string | null
  ) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, dev_state_id: nextId, blocked_reason: reason } : t
      )
    );
    const { error } = await supabase
      .from('tasks')
      .update({ dev_state_id: nextId, blocked_reason: reason })
      .eq('id', task.id);
    if (error) report('更新開發狀態失敗', error);
  }

  async function moveStatus(task: TaskWithProjects, dir: -1 | 1) {
    const idx = boardStatuses.findIndex((s) => s.id === task.status_id);
    if (idx < 0) return;
    const next = boardStatuses[idx + dir];
    if (!next) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status_id: next.id } : t))
    );
    const { error } = await supabase
      .from('tasks')
      .update({ status_id: next.id })
      .eq('id', task.id);
    if (error) report('移動流程狀態失敗', error);
  }

  async function deleteTask() {
    if (!editing || editing === 'new') return;
    const { error } = await supabase.from('tasks').delete().eq('id', editing.id);
    if (error) return report('刪除任務失敗', error);
    setEditing(null);
    loadTasks();
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

  // ---------- status / dev-state management ----------
  async function addStatus(name: string) {
    const pos = statuses.reduce((m, s) => Math.max(m, s.position), -1) + 1;
    const { data, error } = await supabase
      .from('task_statuses')
      .insert({ owner_id: userId, name, position: pos })
      .select('*')
      .single();
    if (error || !data) return report('新增流程狀態失敗', error);
    setStatuses((prev) => [...prev, data as StatusRow]);
  }

  async function updateStatus(id: string, patch: Partial<StatusRow>) {
    // enforce a single is_default / is_archive per user
    if (patch.is_default) {
      await supabase
        .from('task_statuses')
        .update({ is_default: false })
        .eq('owner_id', userId)
        .eq('is_default', true);
      setStatuses((prev) => prev.map((s) => ({ ...s, is_default: false })));
    }
    if (patch.is_archive) {
      await supabase
        .from('task_statuses')
        .update({ is_archive: false })
        .eq('owner_id', userId)
        .eq('is_archive', true);
      setStatuses((prev) => prev.map((s) => ({ ...s, is_archive: false })));
    }
    const { data, error } = await supabase
      .from('task_statuses')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) return report('更新流程狀態失敗', error);
    setStatuses((prev) => prev.map((s) => (s.id === id ? (data as StatusRow) : s)));
  }

  async function deleteStatus(id: string) {
    const def = statuses.find((s) => s.is_default && s.id !== id);
    if (def) {
      await supabase
        .from('tasks')
        .update({ status_id: def.id })
        .eq('owner_id', userId)
        .eq('status_id', id);
    }
    const { error } = await supabase.from('task_statuses').delete().eq('id', id);
    if (error) return report('刪除流程狀態失敗', error);
    setStatuses((prev) => prev.filter((s) => s.id !== id));
    loadTasks();
  }

  async function reorderStatuses(ids: string[]) {
    setStatuses((prev) => prev.map((s) => ({ ...s, position: ids.indexOf(s.id) })));
    const results = await Promise.all(
      ids.map((id, i) =>
        supabase.from('task_statuses').update({ position: i }).eq('id', id)
      )
    );
    const err = results.find((r) => r.error)?.error;
    if (err) report('排序流程狀態失敗', err);
  }

  async function addDevState(name: string) {
    const pos = devStates.reduce((m, d) => Math.max(m, d.position), -1) + 1;
    const { data, error } = await supabase
      .from('dev_states')
      .insert({ owner_id: userId, name, position: pos })
      .select('*')
      .single();
    if (error || !data) return report('新增開發狀態失敗', error);
    setDevStates((prev) => [...prev, data as DevStateRow]);
  }

  async function updateDevStateRow(id: string, patch: Partial<DevStateRow>) {
    if (patch.is_default) {
      await supabase
        .from('dev_states')
        .update({ is_default: false })
        .eq('owner_id', userId)
        .eq('is_default', true);
      setDevStates((prev) => prev.map((d) => ({ ...d, is_default: false })));
    }
    const { data, error } = await supabase
      .from('dev_states')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) return report('更新開發狀態失敗', error);
    setDevStates((prev) => prev.map((d) => (d.id === id ? (data as DevStateRow) : d)));
  }

  async function deleteDevState(id: string) {
    const def = devStates.find((d) => d.is_default && d.id !== id);
    if (def) {
      await supabase
        .from('tasks')
        .update({ dev_state_id: def.id })
        .eq('owner_id', userId)
        .eq('dev_state_id', id);
    }
    const { error } = await supabase.from('dev_states').delete().eq('id', id);
    if (error) return report('刪除開發狀態失敗', error);
    setDevStates((prev) => prev.filter((d) => d.id !== id));
    loadTasks();
  }

  async function reorderDevStates(ids: string[]) {
    setDevStates((prev) => prev.map((d) => ({ ...d, position: ids.indexOf(d.id) })));
    const results = await Promise.all(
      ids.map((id, i) =>
        supabase.from('dev_states').update({ position: i }).eq('id', id)
      )
    );
    const err = results.find((r) => r.error)?.error;
    if (err) report('排序開發狀態失敗', err);
  }

  const statusHandlers: StatusManagerHandlers = {
    addStatus,
    updateStatus,
    deleteStatus,
    reorderStatuses,
    addDevState,
    updateDevState: updateDevStateRow,
    deleteDevState,
    reorderDevStates,
  };

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  // ---------- derived ----------
  const archiveIds = new Set(statuses.filter((s) => s.is_archive).map((s) => s.id));
  const boardTasks = tasks.filter(
    (t) => !t.status_id || !archiveIds.has(t.status_id)
  );
  const deployIds = new Set(statuses.filter((s) => s.is_deploy).map((s) => s.id));
  const pendingDeployCount = tasks.filter(
    (t) =>
      t.status_id &&
      deployIds.has(t.status_id) &&
      t.links.some((l) => l.deploy_status === 'pending')
  ).length;

  return (
    <div className="app">
      <Sidebar
        workspaces={workspaces}
        currentWorkspace={currentWs}
        onSwitchWorkspace={setCurrentWs}
        projects={wsProjects}
        devStates={orderedDevStates}
        view={view}
        onSetView={setView}
        onAddProject={addProject}
        onEditProject={setEditingProject}
        onOpenStatusManager={() => setStatusMgrOpen(true)}
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
          <span className="breadcrumb">
            {currentWs?.name} · {view === 'board' ? '任務看板' : '部署歷史'}
          </span>
          <div className="spacer" />
          {view === 'board' && (
            <>
              <button className="btn" onClick={() => setDeployOpen(true)}>
                部署
                {pendingDeployCount > 0 && (
                  <span className="badge-count">{pendingDeployCount}</span>
                )}
              </button>
              <button className="btn btn-primary" onClick={() => setEditing('new')}>
                新任務
              </button>
            </>
          )}
        </div>

        {view === 'board' && (
          <div className="quick-capture">
            <input
              ref={captureRef}
              value={capture}
              placeholder="快速捕捉：打一行字 Enter 丟進暫存區…"
              onChange={(e) => setCapture(e.target.value)}
              onCompositionStart={() => {
                composingRef.current = true;
              }}
              onCompositionEnd={() => {
                composingRef.current = false;
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                if (composingRef.current || e.nativeEvent.isComposing) return;
                e.preventDefault();
                const v = capture;
                if (!v.trim()) return;
                setCapture('');
                quickCapture(v);
              }}
            />
            <span className="kbd">c</span>
          </div>
        )}

        <div className="content">
          {view === 'history' ? (
            <DeployHistory tasks={tasks} projects={wsProjects} statuses={statuses} />
          ) : (
            <BoardList
              boardStatuses={boardStatuses}
              tasks={boardTasks}
              devStates={orderedDevStates}
              onOpen={setEditing}
              onDevState={updateDevState}
              onMove={moveStatus}
            />
          )}
        </div>
      </div>

      {editing !== null && (
        <TaskEditor
          task={editing === 'new' ? null : editing}
          projects={wsProjects}
          statuses={orderedStatuses}
          devStates={orderedDevStates}
          onSave={saveTask}
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

      {statusMgrOpen && (
        <StatusManager
          statuses={orderedStatuses}
          devStates={orderedDevStates}
          handlers={statusHandlers}
          onClose={() => setStatusMgrOpen(false)}
        />
      )}

      {deployOpen && (
        <DeploySheet
          tasks={tasks}
          statuses={statuses}
          devStates={orderedDevStates}
          onClose={() => setDeployOpen(false)}
        />
      )}
    </div>
  );
}

// Grouped-by-status list.
function BoardList({
  boardStatuses,
  tasks,
  devStates,
  onOpen,
  onDevState,
  onMove,
}: {
  boardStatuses: StatusRow[];
  tasks: TaskWithProjects[];
  devStates: DevStateRow[];
  onOpen: (t: TaskWithProjects) => void;
  onDevState: (t: TaskWithProjects, id: string, r: string | null) => void;
  onMove: (t: TaskWithProjects, dir: -1 | 1) => void;
}) {
  if (tasks.length === 0) {
    return <div className="empty">還沒有任務。用上方快速捕捉丟第一筆吧。</div>;
  }

  return (
    <>
      {boardStatuses.map((status, i) => {
        const items = tasks.filter((t) => t.status_id === status.id);
        if (items.length === 0) return null;
        return (
          <div className="group" key={status.id}>
            <div className="group-header">
              <span className="group-square" style={{ background: status.color }} />
              <span className="group-title">{status.name}</span>
              <span className="badge-count">{items.length}</span>
            </div>
            {items.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                devStates={devStates}
                canBack={i > 0}
                canFwd={i < boardStatuses.length - 1}
                onOpen={() => onOpen(task)}
                onDevState={(id, r) => onDevState(task, id, r)}
                onMove={(dir) => onMove(task, dir)}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}
