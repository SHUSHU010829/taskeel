import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// Called by CI after a successful deploy. Marks the matching (project, branch)
// task_projects rows deployed; a task is archived once ALL its projects are
// deployed. Uses the service role to bypass RLS.
//
//   POST /api/deploy-hook
//   headers: x-deploy-secret: <DEPLOY_HOOK_SECRET>
//   body: { repo: "owner/bibi-bot", branch: "feat/gacha", owner_id: "<uuid>" }
export async function POST(request: Request) {
  const secret = request.headers.get('x-deploy-secret');
  if (!secret || secret !== process.env.DEPLOY_HOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { repo?: string; branch?: string; owner_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { repo, branch, owner_id } = body;
  if (!repo || !branch || !owner_id) {
    return NextResponse.json(
      { error: 'repo, branch and owner_id are required' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('archive_branch', {
    p_repo: repo,
    p_branch: branch,
    p_owner: owner_id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Optional: mirror the result to Discord (continues the CI/CD notify habit).
  const discord = process.env.DISCORD_WEBHOOK_URL;
  if (discord && data && !(data as any).error) {
    const r = data as {
      repo: string;
      branch: string;
      marked_deployed: number;
      tasks_archived: number;
    };
    try {
      await fetch(discord, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🚀 **${r.repo}** \`${r.branch}\` deployed — ${r.marked_deployed} task(s) marked, ${r.tasks_archived} archived.`,
        }),
      });
    } catch {
      // Discord failure must not fail the deploy hook.
    }
  }

  return NextResponse.json(data);
}
