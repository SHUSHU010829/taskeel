'use client';

import { ArrowRight, MessagesSquare, Trash2 } from 'lucide-react';

export interface CommentWithTask {
  id: string;
  body: string;
  created_at: string;
  task_id: string;
  task: { id: string; title: string } | null;
}

// Workspace-wide discussion feed: every comment across the workspace's tasks,
// newest first, with a one-click jump back to the owning task.
export default function DiscussionView({
  comments,
  onOpenTask,
  onDelete,
}: {
  comments: CommentWithTask[];
  onOpenTask: (taskId: string) => void;
  onDelete: (id: string) => void;
}) {
  if (comments.length === 0) {
    return (
      <div className="empty" style={{ padding: 40 }}>
        還沒有任何討論。到任務裡的「討論」區留下第一則。
      </div>
    );
  }

  return (
    <div className="discussion-view">
      {comments.map((c) => (
        <div className="disc-item" key={c.id}>
          <div className="disc-body">{c.body}</div>
          <div className="disc-meta">
            <button
              className="disc-task"
              title="查看所屬任務"
              onClick={() => onOpenTask(c.task_id)}
            >
              <MessagesSquare size={12} />
              {c.task?.title ?? '（任務已刪除）'}
              <ArrowRight size={12} />
            </button>
            <span className="disc-time">{new Date(c.created_at).toLocaleString()}</span>
            <button className="disc-del" title="刪除討論" onClick={() => onDelete(c.id)}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
