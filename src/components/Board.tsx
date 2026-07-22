'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Plus, Search, X, TriangleAlert } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { createClient } from '@/lib/supabase/client';
import { enterSubmit } from '@/lib/useEnterSubmit';
import {
  DEFAULT_STATUSES,
  DEFAULT_CATEGORIES,
  type CategoryRow,
  type Comment,
  type DocumentRow,
  type Project,
  type StatusRow,
  type Task,
  type TaskWithProjects,
  type Workspace,
} from '@/lib/types';
import Sidebar, { type View } from './Sidebar';
import TaskRow from './TaskRow';
import TaskEditor, { type TaskDraft } from './TaskEditor';
import ProjectEditor from './ProjectEditor';
import WorkspaceEditor from './WorkspaceEditor';
import { type StatusManagerHandlers } from './StatusList';
import { type CategoryHandlers } from './CategoryList';
import DeploySheet from './DeploySheet';
import DeployHistory from './DeployHistory';
import CommandPalette from './CommandPalette';
import DocumentsView from './DocumentsView';
import DiscussionView, { type CommentWithTask } from './DiscussionView';

const TASK_SELECT = '*, task_projects(*, project:projects(*))';

// Map a `!token` from quick capture to a priority level (0 = not a priority).
function priorityFromToken(tok: string): number {
  const t = tok.toLowerCase();
  if (t === 'p0' || t === 'urgent' || t === '緊急') return 4;
  if (t === 'p1' || t === 'high' || t === '高') return 3;
  if (t === 'p2' || t === 'med' || t === 'medium' || t === '中') return 2;
  if (t === 'p3' || t === 'low' || t === '低') return 1;
  return 0;
}

// Map raw joined task rows (from either the server or the client query) into
// TaskWithProjects.
function mapTaskRows(data: unknown[]): TaskWithProjects[] {
  return (data as any[]).map((t) => {
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
}

export default function Board({
  userId,
  userName,
  userAvatar,
  initialWorkspaces,
  initialProjects,
  initialStatuses,
  initialCategories,
  initialTaskRows,
  initialTasksWorkspaceId,
}: {
  userId: string;
  userName: string;
  userAvatar: string;
  initialWorkspaces: Workspace[];
  initialProjects: Project[];
  initialStatuses: StatusRow[];
  initialCategories: CategoryRow[];
  initialTaskRows: unknown[];
  initialTasksWorkspaceId: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [statuses, setStatuses] = useState<StatusRow[]>(initialStatuses);
  const [categories, setCategories] = useState<CategoryRow[]>(initialCategories);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [editingComments, setEditingComments] = useState<Comment[]>([]);
  const [editingDocuments, setEditingDocuments] = useState<DocumentRow[]>([]);
  const [wsComments, setWsComments] = useState<CommentWithTask[]>([]);
  const [currentWs, setCurrentWs] = useState<Workspace | null>(initialWorkspaces[0] ?? null);
  const [tasks, setTasks] = useState<TaskWithProjects[]>(() =>
    initialTasksWorkspaceId && initialTasksWorkspaceId === (initialWorkspaces[0]?.id ?? null)
      ? mapTaskRows(initialTaskRows)
      : []
  );
  const [view, setView] = useState<View>('board');
  const [editing, setEditing] = useState<TaskWithProjects | null | 'new'>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingWs, setEditingWs] = useState<Workspace | null | 'new'>(null);
  const [deployOpen, setDeployOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capture, setCapture] = useState('');
  const [fontPx, setFontPx] = useState(15);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [pinnedWsId, setPinnedWsId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const seedWsRef = useRef(false);
  const seedingStatusRef = useRef<Set<string>>(new Set());
  const seedingCategoryRef = useRef<Set<string>>(new Set());
  // SSR already delivered the first workspace's tasks — skip the redundant
  // client re-fetch on mount so the board paints instantly with no reload.
  const skipFirstTaskLoadRef = useRef(
    !!initialTasksWorkspaceId &&
      initialTasksWorkspaceId === (initialWorkspaces[0]?.id ?? null)
  );

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
  const wsCategories = useMemo(
    () =>
      categories
        .filter((c) => c.workspace_id === currentWs?.id)
        .sort((a, b) => a.position - b.position),
    [categories, currentWs]
  );
  const wsDocuments = useMemo(
    () => documents.filter((d) => d.workspace_id === currentWs?.id),
    [documents, currentWs]
  );

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

  // seed default categories for any workspace that lacks them
  useEffect(() => {
    const need = workspaces.filter(
      (w) =>
        !categories.some((c) => c.workspace_id === w.id) && !seedingCategoryRef.current.has(w.id)
    );
    if (need.length === 0) return;
    need.forEach((w) => seedingCategoryRef.current.add(w.id));
    (async () => {
      for (const w of need) {
        const rows = DEFAULT_CATEGORIES.map((c, i) => ({
          owner_id: userId,
          workspace_id: w.id,
          position: i,
          ...c,
        }));
        const { data, error } = await supabase.from('categories').insert(rows).select('*');
        if (error) {
          report('建立分類失敗', error);
          seedingCategoryRef.current.delete(w.id);
        } else if (data) {
          setCategories((prev) => [...prev, ...(data as CategoryRow[])]);
        }
      }
    })();
  }, [workspaces, categories, supabase, userId, report]);

  // ---------- data loading ----------
  const loadTasks = useCallback(async () => {
    if (!currentWs) return;
    const run = () =>
      supabase
        .from('tasks')
        .select(TASK_SELECT)
        .eq('workspace_id', currentWs.id)
        .order('created_at', { ascending: false });

    let { data, error } = await run();
    if (error) {
      // one retry — transient failures (e.g. token refresh mid-flight)
      await new Promise((r) => setTimeout(r, 400));
      ({ data, error } = await run());
    }
    // keep whatever is shown if it still failed, rather than blanking out
    if (error) return report('載入任務失敗', error);
    if (data) setTasks(mapTaskRows(data));
  }, [supabase, currentWs, report]);

  const loadStatuses = useCallback(async () => {
    const { data } = await supabase.from('task_statuses').select('*').order('position');
    if (data) setStatuses(data as StatusRow[]);
  }, [supabase]);

  const loadCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('position');
    if (data) setCategories(data as CategoryRow[]);
  }, [supabase]);

  const loadDocuments = useCallback(async () => {
    if (!currentWs) return;
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('workspace_id', currentWs.id)
      .order('created_at', { ascending: true });
    if (data) setDocuments(data as DocumentRow[]);
  }, [supabase, currentWs]);

  useEffect(() => {
    if (skipFirstTaskLoadRef.current) {
      skipFirstTaskLoadRef.current = false; // consume once; SSR data is fresh
      return;
    }
    loadTasks();
  }, [loadTasks]);

  // Documents are only needed in the 文件 view and the task editor's picker —
  // keep them off the initial critical path.
  const editorOpen = editing !== null;
  useEffect(() => {
    if (view === 'docs' || editorOpen) loadDocuments();
  }, [view, editorOpen, loadDocuments]);

  // Workspace-wide discussion feed (all comments across the ws's tasks).
  const loadWsComments = useCallback(async () => {
    if (!currentWs) return;
    const { data } = await supabase
      .from('comments')
      .select('id, body, created_at, task_id, task:tasks!inner(id, title, workspace_id)')
      .eq('task.workspace_id', currentWs.id)
      .order('created_at', { ascending: false });
    if (data) {
      setWsComments(
        (data as any[]).map((c) => ({
          id: c.id,
          body: c.body,
          created_at: c.created_at,
          task_id: c.task_id,
          task: c.task ? { id: c.task.id, title: c.task.title } : null,
        }))
      );
    }
  }, [supabase, currentWs]);

  useEffect(() => {
    if (view === 'discussion') loadWsComments();
  }, [view, loadWsComments]);

  // Lazy-load the open task's comments + bound documents (by id, so field edits
  // don't refetch). Kept separate from the board task query so a missing 0010
  // migration can't break the board.
  const editingId = editing && editing !== 'new' ? editing.id : null;

  const loadEditingDocs = useCallback(async () => {
    if (!editingId) return;
    const { data } = await supabase
      .from('task_documents')
      .select('document:documents(*)')
      .eq('task_id', editingId);
    if (data) {
      setEditingDocuments(
        (data as any[]).map((r) => r.document).filter(Boolean) as DocumentRow[]
      );
    }
  }, [editingId, supabase]);

  useEffect(() => {
    if (!editingId) {
      setEditingComments([]);
      setEditingDocuments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: cs }, { data: ds }] = await Promise.all([
        supabase
          .from('comments')
          .select('*')
          .eq('task_id', editingId)
          .order('created_at', { ascending: true }),
        supabase.from('task_documents').select('document:documents(*)').eq('task_id', editingId),
      ]);
      if (cancelled) return;
      if (cs) setEditingComments(cs as Comment[]);
      if (ds)
        setEditingDocuments((ds as any[]).map((r) => r.document).filter(Boolean) as DocumentRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [editingId, supabase]);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, loadCategories)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, loadDocuments)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, currentWs, loadTasks, loadStatuses, loadCategories, loadDocuments]);

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

  // ---------- collapsed sidebar rail ----------
  useEffect(() => {
    try {
      if (localStorage.getItem('taskeel.sidebarCollapsed') === '1') setCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        if (next) localStorage.setItem('taskeel.sidebarCollapsed', '1');
        else localStorage.removeItem('taskeel.sidebarCollapsed');
      } catch {
        // ignore
      }
      return next;
    });
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

  useEffect(() => {
    try {
      const t = localStorage.getItem('taskeel.theme');
      if (t === 'light' || t === 'dark') setTheme(t);
    } catch {
      // ignore
    }
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('taskeel.theme', next);
    } catch {
      // ignore
    }
  }

  // ---------- quick capture 'c' shortcut ----------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // ⌘K / Ctrl+K opens search from anywhere (even while typing)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === 'c') {
        e.preventDefault();
        captureRef.current?.focus();
      } else if (e.key === '/') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Parse quick-capture syntax: `#分類 @專案 !p1`. Unmatched tokens stay in the
  // title. Names are matched case-insensitively against the current workspace.
  function parseCapture(raw: string) {
    let priority = 0;
    let category_id: string | null = null;
    const projectIds: string[] = [];
    const titleParts: string[] = [];
    for (const tk of raw.trim().split(/\s+/)) {
      if (tk.length > 1 && tk[0] === '!') {
        const p = priorityFromToken(tk.slice(1));
        if (p) { priority = p; continue; }
      } else if (tk.length > 1 && tk[0] === '#') {
        const key = tk.slice(1).toLowerCase();
        const c = wsCategories.find(
          (x) => x.name.toLowerCase() === key || x.abbr?.toLowerCase() === key
        );
        if (c) { category_id = c.id; continue; }
      } else if (tk.length > 1 && tk[0] === '@') {
        const key = tk.slice(1).toLowerCase();
        const p = wsProjects.find(
          (x) => x.name.toLowerCase() === key || x.abbr?.toLowerCase() === key
        );
        if (p) { if (!projectIds.includes(p.id)) projectIds.push(p.id); continue; }
      }
      titleParts.push(tk);
    }
    return { title: titleParts.join(' ').trim() || raw.trim(), priority, category_id, projectIds };
  }

  // ---------- task mutations ----------
  async function quickCapture(raw: string) {
    if (!raw.trim() || !currentWs) return;
    const { title, priority, category_id, projectIds } = parseCapture(raw);
    const def = wsStatuses.find((s) => s.is_default) ?? wsStatuses[0];
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        workspace_id: currentWs.id,
        owner_id: userId,
        title,
        status_id: def?.id ?? null,
        priority,
        category_id,
      })
      .select('id')
      .single();
    if (error || !data) return report('新增任務失敗', error);
    if (projectIds.length) {
      await supabase
        .from('task_projects')
        .insert(projectIds.map((project_id) => ({ task_id: data.id, project_id })));
    }
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
      category_id: draft.category_id,
      blocked_reason: draft.blocked_reason,
      priority: draft.priority,
      due_date: draft.due_date,
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

  // Auto-save a single set of task fields (used by the editor's live controls).
  async function patchTask(task: TaskWithProjects, patch: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...patch } : t)));
    setEditing((cur) =>
      cur && cur !== 'new' && cur.id === task.id ? { ...cur, ...patch } : cur
    );
    const { error } = await supabase.from('tasks').update(patch).eq('id', task.id);
    if (error) {
      report('儲存失敗', error);
      loadTasks();
    }
  }

  // Auto-save a task's project/branch links (reconcile to exactly `links`).
  async function setTaskProjects(
    task: TaskWithProjects,
    links: Array<{ project_id: string; branch: string }>
  ) {
    const keepIds = links.map((l) => l.project_id);
    if (links.length > 0) {
      const { error } = await supabase.from('task_projects').upsert(
        links.map((l) => ({ task_id: task.id, project_id: l.project_id, branch: l.branch || null })),
        { onConflict: 'task_id,project_id' }
      );
      if (error) report('儲存專案失敗', error);
    }
    let del = supabase.from('task_projects').delete().eq('task_id', task.id);
    del = keepIds.length ? del.not('project_id', 'in', `(${keepIds.join(',')})`) : del;
    const { error: e2 } = await del;
    if (e2) report('儲存專案失敗', e2);
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

  async function setTaskCategory(task: TaskWithProjects, catId: string | null) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, category_id: catId } : t)));
    const { error } = await supabase.from('tasks').update({ category_id: catId }).eq('id', task.id);
    if (error) report('更新分類失敗', error);
  }

  // Manually mark one or more tasks fully deployed from the deploy sheet: stamp
  // all their pending project links deployed (timestamped) and archive them.
  async function markTasksDeployed(taskList: TaskWithProjects[]) {
    const ids = taskList.map((t) => t.id);
    if (!ids.length) return;
    const now = new Date().toISOString();
    const { error: e1 } = await supabase
      .from('task_projects')
      .update({ deploy_status: 'deployed', deployed_at: now })
      .in('task_id', ids)
      .eq('deploy_status', 'pending');
    if (e1) return report('標記部署失敗', e1);
    const archive = wsStatuses.find((s) => s.is_archive);
    const patch = archive ? { status_id: archive.id, archived_at: now } : { archived_at: now };
    const { error: e2 } = await supabase.from('tasks').update(patch).in('id', ids);
    if (e2) return report('歸檔失敗', e2);
    loadTasks();
  }

  // Mark a single (task, project) link deployed. If that was the last pending
  // one, archive the task too.
  async function markLinkDeployed(task: TaskWithProjects, projectId: string) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('task_projects')
      .update({ deploy_status: 'deployed', deployed_at: now })
      .eq('task_id', task.id)
      .eq('project_id', projectId);
    if (error) return report('標記部署失敗', error);
    const allDeployed = task.links.every(
      (l) => l.project_id === projectId || l.deploy_status === 'deployed'
    );
    if (allDeployed) {
      const archive = wsStatuses.find((s) => s.is_archive);
      const { error: e2 } = await supabase
        .from('tasks')
        .update({ status_id: archive?.id ?? task.status_id, archived_at: now })
        .eq('id', task.id);
      if (e2) return report('歸檔失敗', e2);
    }
    loadTasks();
  }

  // Branch off a new task from `source` (a pivot / new direction). It stays a
  // top-level board task but records `origin_id` back to the source; it inherits
  // the source's projects + category so the context carries over.
  async function spinOff(source: TaskWithProjects) {
    if (!currentWs) return;
    const def = wsStatuses.find((s) => s.is_default) ?? wsStatuses[0];
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        workspace_id: source.workspace_id,
        owner_id: userId,
        origin_id: source.id,
        title: source.title,
        status_id: def?.id ?? null,
        category_id: source.category_id,
        priority: source.priority,
      })
      .select('id')
      .single();
    if (error || !data) return report('延伸任務失敗', error);
    if (source.links.length) {
      await supabase.from('task_projects').insert(
        source.links.map((l) => ({ task_id: data.id, project_id: l.project_id, branch: l.branch }))
      );
    }
    const { data: full } = await supabase.from('tasks').select(TASK_SELECT).eq('id', data.id).single();
    await loadTasks();
    if (full) setEditing(mapTaskRows([full])[0]);
  }

  // Row-level quick toggle: attach / detach a project (no branch) on a task.
  async function toggleTaskProject(task: TaskWithProjects, projectId: string) {
    const has = task.links.some((l) => l.project_id === projectId);
    if (has) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, links: t.links.filter((l) => l.project_id !== projectId) }
            : t
        )
      );
      const { error } = await supabase
        .from('task_projects')
        .delete()
        .eq('task_id', task.id)
        .eq('project_id', projectId);
      if (error) {
        report('更新專案失敗', error);
        loadTasks();
      }
    } else {
      const proj = projects.find((p) => p.id === projectId);
      if (proj) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  links: [
                    ...t.links,
                    {
                      task_id: task.id,
                      project_id: projectId,
                      branch: null,
                      deploy_status: 'pending' as const,
                      deployed_at: null,
                      project: proj,
                    },
                  ],
                }
              : t
          )
        );
      }
      const { error } = await supabase
        .from('task_projects')
        .insert({ task_id: task.id, project_id: projectId });
      if (error) report('更新專案失敗', error);
      loadTasks();
    }
  }

  // ---------- documents (workspace-level, standalone) ----------
  async function addDocument(title: string): Promise<string | null> {
    if (!currentWs || !title.trim()) return null;
    const { data, error } = await supabase
      .from('documents')
      .insert({ owner_id: userId, workspace_id: currentWs.id, title: title.trim() })
      .select('*')
      .single();
    if (error || !data) {
      report('新增文件失敗', error);
      return null;
    }
    setDocuments((prev) => [...prev, data as DocumentRow]);
    return (data as DocumentRow).id;
  }

  async function updateDocument(id: string, patch: Partial<DocumentRow>) {
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    const { error } = await supabase.from('documents').update(patch).eq('id', id);
    if (error) {
      report('更新文件失敗', error);
      loadDocuments();
    }
  }

  async function deleteDocument(id: string) {
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) return report('刪除文件失敗', error);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    loadTasks(); // any task references cascade-delete
  }

  async function bindDocument(task: TaskWithProjects, docId: string) {
    const { error } = await supabase
      .from('task_documents')
      .insert({ task_id: task.id, document_id: docId });
    if (error) return report('綁定文件失敗', error);
    loadEditingDocs();
  }

  async function unbindDocument(task: TaskWithProjects, docId: string) {
    const { error } = await supabase
      .from('task_documents')
      .delete()
      .eq('task_id', task.id)
      .eq('document_id', docId);
    if (error) return report('取消綁定失敗', error);
    loadEditingDocs();
  }

  // ---------- comments ----------
  async function addComment(taskId: string, body: string) {
    if (!body.trim()) return;
    const { data, error } = await supabase
      .from('comments')
      .insert({ owner_id: userId, task_id: taskId, body: body.trim() })
      .select('*')
      .single();
    if (error || !data) return report('新增討論失敗', error);
    setEditingComments((prev) => [...prev, data as Comment]);
  }

  async function deleteComment(id: string) {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) return report('刪除討論失敗', error);
    setEditingComments((prev) => prev.filter((c) => c.id !== id));
    setWsComments((prev) => prev.filter((c) => c.id !== id));
  }

  // Move a task to another workspace: projects are workspace-scoped, so its
  // project/branch links are cleared and it gets the target's default status.
  // It also detaches from any parent (parents are workspace-bound).
  async function moveTaskWorkspace(task: TaskWithProjects, wsId: string) {
    const def = statuses.find((s) => s.workspace_id === wsId && s.is_default);
    await supabase.from('task_projects').delete().eq('task_id', task.id);
    const { error } = await supabase
      .from('tasks')
      .update({
        workspace_id: wsId,
        status_id: def?.id ?? null,
        blocked_reason: null,
        parent_id: null,
        origin_id: null,
        bundle_id: null,
      })
      .eq('id', task.id);
    if (error) return report('搬移工作區失敗', error);
    setEditing(null);
    loadTasks();
  }

  // Split a task into a subtask that inherits the parent's status, category,
  // backend flag, deploy notes, and project/branch tags.
  async function addSubtask(parent: TaskWithProjects, title: string) {
    if (!title.trim()) return;
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        workspace_id: parent.workspace_id,
        owner_id: userId,
        parent_id: parent.id,
        title: title.trim(),
        status_id: parent.status_id,
        category_id: parent.category_id,
        needs_backend: parent.needs_backend,
        deploy_notes: parent.deploy_notes,
      })
      .select('id')
      .single();
    if (error || !data) return report('新增子任務失敗', error);
    if (parent.links.length) {
      await supabase.from('task_projects').insert(
        parent.links.map((l) => ({
          task_id: data.id,
          project_id: l.project_id,
          branch: l.branch,
        }))
      );
    }
    loadTasks();
  }

  async function deleteTask() {
    if (!editing || editing === 'new') return;
    const { error } = await supabase.from('tasks').delete().eq('id', editing.id);
    if (error) return report('刪除任務失敗', error);
    setEditing(null);
    loadTasks();
  }

  // Promote a subtask to a top-level 主任務 (detach from its parent) so it can
  // stand on its own board row and take part in deploy bundles.
  async function detachParent(task: TaskWithProjects) {
    setEditing((cur) =>
      cur && cur !== 'new' && cur.id === task.id ? { ...cur, parent_id: null } : cur
    );
    const { error } = await supabase
      .from('tasks')
      .update({ parent_id: null })
      .eq('id', task.id);
    if (error) return report('升為主任務失敗', error);
    loadTasks();
  }

  // Set the deploy bundle for `task`: it plus `otherIds` become one bundle
  // (must ship together). An empty `otherIds` dissolves the bundle.
  async function setBundle(task: TaskWithProjects, otherIds: string[]) {
    const desired = new Set([task.id, ...otherIds]);
    // any existing bundle these tasks already belong to (may be several)
    const oldBundleIds = new Set(
      tasks
        .filter((t) => desired.has(t.id) && t.bundle_id)
        .map((t) => t.bundle_id as string)
    );
    // tasks currently in those bundles but no longer wanted → unbind
    const toUnbind = tasks
      .filter((t) => t.bundle_id && oldBundleIds.has(t.bundle_id) && !desired.has(t.id))
      .map((t) => t.id);

    if (desired.size >= 2) {
      const bundleId = [...oldBundleIds][0] ?? crypto.randomUUID();
      const { error } = await supabase
        .from('tasks')
        .update({ bundle_id: bundleId })
        .in('id', [...desired]);
      if (error) return report('部署綁定失敗', error);
      if (toUnbind.length) {
        const { error: e2 } = await supabase
          .from('tasks')
          .update({ bundle_id: null })
          .in('id', toUnbind);
        if (e2) return report('部署綁定失敗', e2);
      }
    } else {
      // dissolve: this task and any orphaned partners drop their bundle
      const ids = [task.id, ...toUnbind];
      const { error } = await supabase.from('tasks').update({ bundle_id: null }).in('id', ids);
      if (error) return report('部署綁定失敗', error);
    }
    loadTasks();
  }

  // ---------- workspace mutations ----------
  async function addWorkspace(name: string, color: string, icon: string | null) {
    const { data, error } = await supabase
      .from('workspaces')
      .insert({ owner_id: userId, name, color, icon })
      .select('*')
      .single();
    if (error || !data) return report('新增工作區失敗', error);
    setWorkspaces((prev) => [...prev, data as Workspace]);
    setCurrentWs(data as Workspace); // statuses seed via effect
    setEditingWs(null);
  }

  // Auto-save a workspace field patch (name / color / icon), keeping the editor
  // open — mirrors the task editor's live-save model.
  async function patchWorkspace(
    id: string,
    patch: Partial<{ name: string; color: string; icon: string | null }>,
  ) {
    const { data, error } = await supabase
      .from('workspaces')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) return report('更新工作區失敗', error);
    setWorkspaces((prev) => prev.map((w) => (w.id === id ? (data as Workspace) : w)));
    setCurrentWs((c) => (c?.id === id ? (data as Workspace) : c));
    setEditingWs((e) => (e && e !== 'new' && e.id === id ? (data as Workspace) : e));
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
    patch: { name: string; repo: string | null; color: string; abbr: string | null }
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

  // ---------- status management (workspace-aware, so the workspace editor can
  // manage any workspace's statuses, not just the current one) ----------
  async function addStatus(wsId: string, name: string) {
    const pos =
      statuses.filter((s) => s.workspace_id === wsId).reduce((m, s) => Math.max(m, s.position), -1) +
      1;
    const { data, error } = await supabase
      .from('task_statuses')
      .insert({ owner_id: userId, workspace_id: wsId, name, position: pos })
      .select('*')
      .single();
    if (error || !data) return report('新增狀態失敗', error);
    setStatuses((prev) => [...prev, data as StatusRow]);
  }

  async function updateStatus(id: string, patch: Partial<StatusRow>) {
    const wsId = statuses.find((s) => s.id === id)?.workspace_id;
    if (patch.is_default && wsId) {
      await supabase
        .from('task_statuses')
        .update({ is_default: false })
        .eq('workspace_id', wsId)
        .eq('is_default', true);
      setStatuses((prev) =>
        prev.map((s) => (s.workspace_id === wsId ? { ...s, is_default: false } : s))
      );
    }
    if (patch.is_archive && wsId) {
      await supabase
        .from('task_statuses')
        .update({ is_archive: false })
        .eq('workspace_id', wsId)
        .eq('is_archive', true);
      setStatuses((prev) =>
        prev.map((s) => (s.workspace_id === wsId ? { ...s, is_archive: false } : s))
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
    const wsId = statuses.find((s) => s.id === id)?.workspace_id;
    const def = statuses.find((s) => s.workspace_id === wsId && s.is_default && s.id !== id);
    if (def && wsId) {
      await supabase
        .from('tasks')
        .update({ status_id: def.id })
        .eq('workspace_id', wsId)
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

  // Status handlers bound to the workspace currently being edited.
  const editedWs = editingWs && editingWs !== 'new' ? editingWs : null;
  const editedWsStatuses = editedWs
    ? statuses.filter((s) => s.workspace_id === editedWs.id).sort((a, b) => a.position - b.position)
    : [];
  const editStatusHandlers: StatusManagerHandlers | null = editedWs
    ? {
        addStatus: (name) => addStatus(editedWs.id, name),
        updateStatus,
        deleteStatus,
        reorderStatuses,
      }
    : null;

  // ---------- category management (workspace-aware) ----------
  async function addCategory(wsId: string, name: string) {
    const pos =
      categories.filter((c) => c.workspace_id === wsId).reduce((m, c) => Math.max(m, c.position), -1) +
      1;
    const { data, error } = await supabase
      .from('categories')
      .insert({ owner_id: userId, workspace_id: wsId, name, position: pos })
      .select('*')
      .single();
    if (error || !data) return report('新增分類失敗', error);
    setCategories((prev) => [...prev, data as CategoryRow]);
  }

  async function updateCategory(id: string, patch: Partial<CategoryRow>) {
    const { data, error } = await supabase
      .from('categories')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) return report('更新分類失敗', error);
    setCategories((prev) => prev.map((c) => (c.id === id ? (data as CategoryRow) : c)));
  }

  async function deleteCategory(id: string) {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) return report('刪除分類失敗', error);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    loadTasks(); // tasks using it become uncategorised (FK on delete set null)
  }

  async function reorderCategories(ids: string[]) {
    setCategories((prev) =>
      prev.map((c) => (ids.includes(c.id) ? { ...c, position: ids.indexOf(c.id) } : c))
    );
    const results = await Promise.all(
      ids.map((id, i) => supabase.from('categories').update({ position: i }).eq('id', id))
    );
    const err = results.find((r) => r.error)?.error;
    if (err) report('排序分類失敗', err);
  }

  const editedWsCategories = editedWs
    ? categories
        .filter((c) => c.workspace_id === editedWs.id)
        .sort((a, b) => a.position - b.position)
    : [];
  const editCategoryHandlers: CategoryHandlers | null = editedWs
    ? {
        addCategory: (name) => addCategory(editedWs.id, name),
        updateCategory,
        deleteCategory,
        reorderCategories,
      }
    : null;

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  // ---------- derived ----------
  // A task with subtasks is hidden — its subtasks stand in for it.
  const parentIds = new Set(
    tasks.map((t) => t.parent_id).filter((id): id is string => !!id)
  );
  const titleById: Record<string, string> = {};
  tasks.forEach((t) => (titleById[t.id] = t.title));
  const leafTasks = tasks.filter((t) => !parentIds.has(t.id));

  const archiveIds = new Set(wsStatuses.filter((s) => s.is_archive).map((s) => s.id));
  const boardTasks = leafTasks
    .filter((t) => !t.status_id || !archiveIds.has(t.status_id))
    .filter((t) => !projectFilter || t.links.some((l) => l.project_id === projectFilter))
    // higher priority first, then nearer due date, then newest
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.due_date !== b.due_date) {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date < b.due_date ? -1 : 1;
      }
      return a.created_at < b.created_at ? 1 : -1;
    });
  const filteredProject = projects.find((p) => p.id === projectFilter) ?? null;
  const deployIds = new Set(wsStatuses.filter((s) => s.is_deploy).map((s) => s.id));
  const pendingDeployCount = leafTasks.filter(
    (t) =>
      t.status_id &&
      deployIds.has(t.status_id) &&
      t.links.some((l) => l.deploy_status === 'pending')
  ).length;

  // task being edited: its subtasks and its parent (if it's a subtask)
  const editingTask = editing && editing !== 'new' ? editing : null;
  const editingSubtasks = editingTask
    ? tasks.filter((t) => t.parent_id === editingTask.id)
    : [];
  const editingParent = editingTask?.parent_id
    ? tasks.find((t) => t.id === editingTask.parent_id) ?? null
    : null;
  // 延伸自 / 延伸出 — origin task and tasks branched off from this one
  const editingOrigin = editingTask?.origin_id
    ? tasks.find((t) => t.id === editingTask.origin_id) ?? null
    : null;
  const editingDerived = editingTask
    ? tasks.filter((t) => t.origin_id === editingTask.id)
    : [];
  // deploy-bundle: sibling tasks that must ship together with the edited task
  const bundleMemberIds = editingTask?.bundle_id
    ? tasks
        .filter((t) => t.id !== editingTask.id && t.bundle_id === editingTask.bundle_id)
        .map((t) => t.id)
    : [];
  // Only offer tasks currently in a deploy-stage (待部署) status as bundle
  // options — plus any already-bound member so it stays removable.
  const bundleMemberSet = new Set(bundleMemberIds);
  const bundleCandidates = editingTask
    ? tasks
        .filter(
          (t) =>
            t.id !== editingTask.id &&
            t.workspace_id === editingTask.workspace_id &&
            !t.parent_id && // only top-level tasks (主任務) can be bound
            ((t.status_id && deployIds.has(t.status_id)) || bundleMemberSet.has(t.id)),
        )
        .map((t) => ({ id: t.id, title: t.title, status_id: t.status_id }))
    : [];
  const openTaskId = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (t) setEditing(t);
  };

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
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
        fontPx={fontPx}
        onSetFont={changeFont}
        theme={theme}
        onToggleTheme={toggleTheme}
        userName={userName}
        userAvatar={userAvatar}
        onSignOut={signOut}
      />

      <div className="main">
        {error && (
          <div className="error-banner" onClick={() => setError(null)}>
            <TriangleAlert size={14} />
            {error}
            <span style={{ marginLeft: 'auto', opacity: 0.7, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              點此關閉 <X size={12} />
            </span>
          </div>
        )}
        <div className="topbar">
          <button className="hamburger icon-btn" title="選單" onClick={() => setSidebarOpen(true)}>
            <Menu size={18} />
          </button>
          <span className="breadcrumb">
            {currentWs?.name} ·{' '}
            {view === 'board'
              ? '任務看板'
              : view === 'history'
                ? '部署歷史'
                : view === 'docs'
                  ? '文件'
                  : '討論'}
          </span>
          {view === 'board' && filteredProject && (
            <button
              className="filter-chip"
              title="清除專案篩選"
              onClick={() => setProjectFilter(null)}
            >
              <span className="dot" style={{ background: filteredProject.color }} />
              {filteredProject.name}
              <X size={13} style={{ color: 'var(--text-faint)' }} />
            </button>
          )}
          <div className="spacer" />
          <button className="btn topbar-search" title="搜尋（⌘K）" onClick={() => setPaletteOpen(true)}>
            <Search size={14} />
            <span className="topbar-search-label">搜尋</span>
            <span className="kbd">⌘K</span>
          </button>
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
            <span className="capture-plus">
              <Plus size={16} />
            </span>
            <input
              ref={captureRef}
              value={capture}
              placeholder="快速捕捉：打一行字…（#分類 @專案 !p1）"
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
            <DeployHistory
              tasks={leafTasks}
              projects={wsProjects}
              statuses={wsStatuses}
              categories={wsCategories}
            />
          ) : view === 'docs' ? (
            <DocumentsView
              documents={wsDocuments}
              onAdd={addDocument}
              onUpdate={updateDocument}
              onDelete={deleteDocument}
            />
          ) : view === 'discussion' ? (
            <DiscussionView
              comments={wsComments}
              onOpenTask={(taskId) => {
                const t = tasks.find((x) => x.id === taskId);
                if (t) setEditing(t);
              }}
              onDelete={deleteComment}
            />
          ) : (
            <BoardList
              boardStatuses={boardStatuses}
              tasks={boardTasks}
              statuses={wsStatuses}
              categories={wsCategories}
              projects={wsProjects}
              parentTitleById={titleById}
              onOpen={setEditing}
              onOpenTaskId={openTaskId}
              onStatus={setTaskStatus}
              onCategory={setTaskCategory}
              onToggleProject={toggleTaskProject}
              onMoveToStatus={(t, statusId) => setTaskStatus(t, statusId, t.blocked_reason)}
            />
          )}
        </div>
      </div>

      {editing !== null && (
        <TaskEditor
          key={editing === 'new' ? 'new' : editing.id}
          task={editing === 'new' ? null : editing}
          projects={wsProjects}
          statuses={wsStatuses}
          categories={wsCategories}
          workspaces={workspaces}
          currentWorkspaceId={currentWs?.id ?? null}
          subtasks={editingSubtasks}
          parentTask={editingParent}
          bundleCandidates={bundleCandidates}
          bundleMemberIds={bundleMemberIds}
          onSetBundle={(otherIds) => editingTask && setBundle(editingTask, otherIds)}
          onDetachParent={() => editingTask && detachParent(editingTask)}
          originTask={editingOrigin}
          derivedTasks={editingDerived}
          onSpinOff={() => editingTask && spinOff(editingTask)}
          boundDocuments={editingDocuments}
          docCandidates={wsDocuments}
          comments={editingComments}
          onBindDocument={(docId) => editingTask && bindDocument(editingTask, docId)}
          onUnbindDocument={(docId) => editingTask && unbindDocument(editingTask, docId)}
          onAddComment={(body) => editingTask && addComment(editingTask.id, body)}
          onDeleteComment={deleteComment}
          onSave={saveTask}
          onPatch={(patch) => editingTask && patchTask(editingTask, patch)}
          onSetProjects={(links) => editingTask && setTaskProjects(editingTask, links)}
          onAddSubtask={(title) => editingTask && addSubtask(editingTask, title)}
          onOpenTask={(t) => setEditing(t)}
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
          statuses={editedWsStatuses}
          statusHandlers={editStatusHandlers}
          categories={editedWsCategories}
          categoryHandlers={editCategoryHandlers}
          onSave={(patch) => addWorkspace(patch.name, patch.color, patch.icon)}
          onPatch={(patch) => editingWs !== 'new' && editingWs && patchWorkspace(editingWs.id, patch)}
          onDelete={editingWs === 'new' ? undefined : () => deleteWorkspace(editingWs.id)}
          onClose={() => setEditingWs(null)}
        />
      )}

      {deployOpen && (
        <DeploySheet
          tasks={leafTasks}
          allTasks={tasks}
          statuses={wsStatuses}
          onMarkTasks={markTasksDeployed}
          onMarkLink={markLinkDeployed}
          onClose={() => setDeployOpen(false)}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        tasks={tasks}
        statuses={wsStatuses}
        categories={wsCategories}
        parentTitleById={titleById}
        onOpenTask={(t) => {
          setPaletteOpen(false);
          setEditing(t);
        }}
        onNewTask={(t) => {
          setPaletteOpen(false);
          quickCapture(t);
        }}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}

// A status column that is a dnd-kit drop target.
function StatusGroup({
  status,
  count,
  children,
}: {
  status: StatusRow;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <div ref={setNodeRef} className={`group${isOver ? ' drop-target' : ''}`}>
      <div className="group-header">
        <span className="group-square" style={{ background: status.color }} />
        <span className="group-title">{status.name}</span>
        <span className="badge-count">{count}</span>
      </div>
      {children}
    </div>
  );
}

// Grouped-by-status list. Drag a task onto another status column to move it
// (dnd-kit pointer/touch drag — no native browser drag).
function BoardList({
  boardStatuses,
  tasks,
  statuses,
  categories,
  projects,
  parentTitleById,
  onOpen,
  onOpenTaskId,
  onStatus,
  onCategory,
  onToggleProject,
  onMoveToStatus,
}: {
  boardStatuses: StatusRow[];
  tasks: TaskWithProjects[];
  statuses: StatusRow[];
  categories: CategoryRow[];
  projects: Project[];
  parentTitleById: Record<string, string>;
  onOpen: (t: TaskWithProjects) => void;
  onOpenTaskId: (id: string) => void;
  onStatus: (t: TaskWithProjects, id: string, r: string | null) => void;
  onCategory: (t: TaskWithProjects, c: string | null) => void;
  onToggleProject: (t: TaskWithProjects, projectId: string) => void;
  onMoveToStatus: (t: TaskWithProjects, statusId: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    // mouse: start after a small move so clicks still work;
    // touch: press-and-hold so a normal swipe still scrolls the board.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  if (boardStatuses.length === 0) {
    return <div className="empty">還沒有狀態。到左側「工作區設定」新增。</div>;
  }

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const t = tasks.find((x) => x.id === active.id);
    const statusId = String(over.id);
    if (t && t.status_id !== statusId) onMoveToStatus(t, statusId);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {boardStatuses.map((status) => {
        const items = tasks.filter((t) => t.status_id === status.id);
        return (
          <StatusGroup key={status.id} status={status} count={items.length}>
            {items.length === 0 ? (
              <div className="empty-row">—</div>
            ) : (
              items.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  statuses={statuses}
                  categories={categories}
                  parentLabel={task.parent_id ? parentTitleById[task.parent_id] : undefined}
                  onOpenParent={
                    task.parent_id ? () => onOpenTaskId(task.parent_id!) : undefined
                  }
                  projects={projects}
                  onOpen={() => onOpen(task)}
                  onStatus={(id, r) => onStatus(task, id, r)}
                  onCategory={(c) => onCategory(task, c)}
                  onToggleProject={(pid) => onToggleProject(task, pid)}
                />
              ))
            )}
          </StatusGroup>
        );
      })}
      <DragOverlay>
        {activeTask ? (
          <div className="task-drag-overlay">{activeTask.title}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
