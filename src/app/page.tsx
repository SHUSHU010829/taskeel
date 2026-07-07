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

  // Note: the two default workspaces (個人 / 工作) are seeded client-side in
  // <Board> on first login — the browser client reliably carries the auth
  // session, so RLS accepts the insert.
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: true });

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
