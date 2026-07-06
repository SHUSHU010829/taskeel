import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Project, Workspace } from '@/lib/types';
import Board from '@/components/Board';

// Home = the task board. Server component: authenticates, ensures the two
// default workspaces exist, then hands off to the client Board.
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  let { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: true });

  // First login → seed 個人 / 工作.
  if (!workspaces || workspaces.length === 0) {
    await supabase.from('workspaces').insert([
      { owner_id: user.id, name: '個人', color: '#5E6AD2' },
      { owner_id: user.id, name: '工作', color: '#26B5CE' },
    ]);
    const seeded = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: true });
    workspaces = seeded.data ?? [];
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true });

  return (
    <Board
      userId={user.id}
      userEmail={user.email ?? ''}
      initialWorkspaces={(workspaces ?? []) as Workspace[]}
      initialProjects={(projects ?? []) as Project[]}
    />
  );
}
