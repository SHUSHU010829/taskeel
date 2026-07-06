'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  STATUS_ORDER,
  STATUS_META,
  type Project,
  type TaskWithProjects,
  type Workspace,
  type DevState,
  type TaskStatus,
} from '@/lib/types';
import Sidebar, { type View } from './Sidebar';
import TaskRow from './TaskRow';
import TaskEditor, { type TaskDraft } from './TaskEditor';
import DeploySheet from './DeploySheet';
import DeployHistory from './DeployHistory';

export default function Board({
  userId,
  userEmail,
  initialWorkspaces,
  initialProjects,
}: {
  userId: string;
  userEmail: string;
  initialWorkspaces: Workspace[];
  initialProjects: Project[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [workspaces] = useState<Workspace[]>(initialWorkspaces);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [currentWs, setCurrentWs] = useState<Workspace | null>(
    initialWorkspaces[0] ?? null
  );
  const [tasks, setTasks] = useState<TaskWithProjects[]>([]);
  const [view, setView] = useState<View>('board');
  const [editing, setEditing] = useState<TaskWithProjects | null | 'new'>(null);
  const [deployOpen, setDeployOpen] = useState(false);
  const captureRef = useRef<HTMLInputElement>(null);

  const wsProjects = useMemo(
    () => projects.filter((p) => p.workspace_id === currentWs?.id),
    [projects, currentWs]
  );

  // ---------- data loading ----------
  const loadTasks = useCallback(async () => {
    if (!currentWs) return;
    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_projects(*, project:projects(*))')
      .eq('workspace_id', currentWs.id)
      .order('created_at', { ascending: false });

    if (error || !data) return;
    const mapped: TaskWithProjects[] = data.map((t: any) => {
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
    });
    setTasks(mapped);
  }, [supabase, currentWs]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // ---------- realtime (multi-device sync) ----------
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
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `workspace_id=eq.${currentWs.id}`,
        },
        refetch
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_projects' },
        refetch
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, currentWs, loadTasks]);

  // ---------- quick capture 'c' shortcut ----------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (typing) return;
      if (e.key === 'c') {
        e.preventDefault();
        captureRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------- mutations ----------
  async function quickCapture(title: string) {
    if (!title.trim() || !currentWs) return;
    await supabase.from('tasks').insert({
      workspace_id: currentWs.id,
      owner_id: userId,
      title: title.trim(),
      status: 'inbox',
      dev_state: 'idle',
    });
    loadTasks();
  }

  async function saveTask(draft: TaskDraft) {
    if (!currentWs) return;
    const base = {
      title: draft.title,
      description: draft.description,
      category: draft.category,
      dev_state: draft.dev_state,
      blocked_reason: draft.blocked_reason,
      needs_backend: draft.needs_backend,
      deploy_notes: draft.deploy_notes,
    };

    let taskId: string;
    if (editing && editing !== 'new') {
      taskId = editing.id;
      await supabase.from('tasks').update(base).eq('id', taskId);
    } else {
      const { data } = await supabase
        .from('tasks')
        .insert({
          ...base,
          workspace_id: currentWs.id,
          owner_id: userId,
          status: 'active',
        })
        .select('id')
        .single();
      if (!data) return;
      taskId = data.id;
    }

    // Sync per-project branch links, preserving deploy_status on existing rows.
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
    // Remove links the user deselected.
    let del = supabase.from('task_projects').delete().eq('task_id', taskId);
    del = keepIds.length
      ? del.not('project_id', 'in', `(${keepIds.join(',')})`)
      : del;
    await del;

    setEditing(null);
    loadTasks();
  }

  async function updateDevState(
    task: TaskWithProjects,
    next: DevState,
    reason: string | null
  ) {
    // optimistic
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, dev_state: next, blocked_reason: reason }
          : t
      )
    );
    await supabase
      .from('tasks')
      .update({ dev_state: next, blocked_reason: reason })
      .eq('id', task.id);
  }

  async function moveStatus(task: TaskWithProjects, dir: -1 | 1) {
    const idx = STATUS_ORDER.indexOf(task.status);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= STATUS_ORDER.length) return;
    const next = STATUS_ORDER[nextIdx];
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: next } : t))
    );
    await supabase.from('tasks').update({ status: next }).eq('id', task.id);
  }

  async function deleteTask() {
    if (!editing || editing === 'new') return;
    await supabase.from('tasks').delete().eq('id', editing.id);
    setEditing(null);
    loadTasks();
  }

  async function addProject(name: string, repo: string) {
    if (!currentWs) return;
    const { data } = await supabase
      .from('projects')
      .insert({
        workspace_id: currentWs.id,
        name,
        repo: repo || null,
      })
      .select('*')
      .single();
    if (data) setProjects((prev) => [...prev, data as Project]);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  // ---------- derived ----------
  const boardTasks = tasks.filter((t) => t.status !== 'archived');
  const pendingDeployCount = tasks.filter(
    (t) =>
      t.status === 'ready_to_deploy' &&
      t.links.some((l) => l.deploy_status === 'pending')
  ).length;

  return (
    <div className="app">
      <Sidebar
        workspaces={workspaces}
        currentWorkspace={currentWs}
        onSwitchWorkspace={setCurrentWs}
        projects={wsProjects}
        view={view}
        onSetView={setView}
        onAddProject={addProject}
        userEmail={userEmail}
        onSignOut={signOut}
      />

      <div className="main">
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
              <button
                className="btn btn-primary"
                onClick={() => setEditing('new')}
              >
                新任務
              </button>
            </>
          )}
        </div>

        {view === 'board' && (
          <div className="quick-capture">
            <input
              ref={captureRef}
              placeholder="快速捕捉：打一行字 Enter 丟進暫存區…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  quickCapture((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
            <span className="kbd">c</span>
          </div>
        )}

        <div className="content">
          {view === 'history' ? (
            <DeployHistory tasks={tasks} projects={wsProjects} />
          ) : (
            <BoardList
              tasks={boardTasks}
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
          onSave={saveTask}
          onClose={() => setEditing(null)}
          onDelete={editing === 'new' ? undefined : deleteTask}
        />
      )}

      {deployOpen && (
        <DeploySheet tasks={tasks} onClose={() => setDeployOpen(false)} />
      )}
    </div>
  );
}

// Grouped-by-status list.
function BoardList({
  tasks,
  onOpen,
  onDevState,
  onMove,
}: {
  tasks: TaskWithProjects[];
  onOpen: (t: TaskWithProjects) => void;
  onDevState: (t: TaskWithProjects, s: DevState, r: string | null) => void;
  onMove: (t: TaskWithProjects, dir: -1 | 1) => void;
}) {
  const groups = STATUS_ORDER.map((status) => ({
    status,
    items: tasks.filter((t) => t.status === status),
  }));

  const total = tasks.length;

  if (total === 0) {
    return <div className="empty">還沒有任務。用上方快速捕捉丟第一筆吧。</div>;
  }

  return (
    <>
      {groups.map(({ status, items }) => {
        if (items.length === 0) return null;
        const meta = STATUS_META[status as TaskStatus];
        return (
          <div className="group" key={status}>
            <div className="group-header">
              <span
                className="group-square"
                style={{ background: meta.color }}
              />
              <span className="group-title">{meta.label}</span>
              <span className="badge-count">{items.length}</span>
            </div>
            {items.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={() => onOpen(task)}
                onDevState={(s, r) => onDevState(task, s, r)}
                onMove={(dir) => onMove(task, dir)}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}
