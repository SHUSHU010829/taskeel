import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { CategoryRow, Project, StatusRow, Workspace } from '@/lib/types';
import Board from '@/components/Board';

const TASK_SELECT = '*, task_projects(*, project:projects(*))';

// Home = the task board. Server component: authenticates and loads the initial
// data (including the first workspace's tasks) so the board paints immediately
// without a client round-trip.
export default async function HomePage() {
  const supabase = await createClient();
  // middleware.ts already revalidated the token with getUser() and redirects
  // unauthed requests, so here we read the (fresh) session from cookies without
  // a second auth round-trip on the critical path.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) redirect('/login');

  const [{ data: workspaces }, { data: projects }, { data: statuses }, { data: cats }] =
    await Promise.all([
      supabase.from('workspaces').select('*').order('created_at', { ascending: true }),
      supabase.from('projects').select('*').order('created_at', { ascending: true }),
      supabase.from('task_statuses').select('*').order('position', { ascending: true }),
      supabase.from('categories').select('*').order('position', { ascending: true }),
    ]);

  const firstWs = (workspaces ?? [])[0];
  let initialTasks: unknown[] = [];
  if (firstWs) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('workspace_id', firstWs.id)
      .order('created_at', { ascending: false });
    initialTasks = tasks ?? [];
  }

  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const userName =
    meta.full_name || meta.name || meta.user_name || user.email || '使用者';
  const userAvatar = meta.avatar_url || meta.picture || '';

  return (
    <Board
      userId={user.id}
      userName={userName}
      userAvatar={userAvatar}
      initialWorkspaces={(workspaces ?? []) as Workspace[]}
      initialProjects={(projects ?? []) as Project[]}
      initialStatuses={(statuses ?? []) as StatusRow[]}
      initialCategories={(cats ?? []) as CategoryRow[]}
      initialTaskRows={initialTasks}
      initialTasksWorkspaceId={firstWs?.id ?? null}
    />
  );
}
