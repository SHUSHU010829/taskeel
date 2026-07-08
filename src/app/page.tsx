import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { CategoryRow, Project, StatusRow, Workspace } from '@/lib/types';
import Board from '@/components/Board';

// Home = the task board. Server component: authenticates, then hands off to the
// client Board (which seeds workspaces + statuses on first login).
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: workspaces }, { data: projects }, { data: statuses }, { data: cats }] =
    await Promise.all([
      supabase.from('workspaces').select('*').order('created_at', { ascending: true }),
      supabase.from('projects').select('*').order('created_at', { ascending: true }),
      supabase.from('task_statuses').select('*').order('position', { ascending: true }),
      supabase.from('categories').select('*').order('position', { ascending: true }),
    ]);

  return (
    <Board
      userId={user.id}
      userEmail={user.email ?? ''}
      initialWorkspaces={(workspaces ?? []) as Workspace[]}
      initialProjects={(projects ?? []) as Project[]}
      initialStatuses={(statuses ?? []) as StatusRow[]}
      initialCategories={(cats ?? []) as CategoryRow[]}
    />
  );
}
