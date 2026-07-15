'use client';

import { useState } from 'react';
import { MessagesSquare, Send, X } from 'lucide-react';
import type { Comment } from '@/lib/types';
import { enterSubmit } from '@/lib/useEnterSubmit';

// Per-task discussion / notes — a small running thread (questions for a
// supervisor, reminders…). Single-user, so it's really a personal note log.
export default function TaskComments({
  comments,
  onAdd,
  onDelete,
}: {
  comments: Comment[];
  onAdd: (body: string) => void;
  onDelete: (id: string) => void;
}) {
  const [text, setText] = useState('');

  function submit() {
    const v = text.trim();
    if (!v) return;
    onAdd(v);
    setText('');
  }

  return (
    <div className="ed-section">
      <div className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
        <MessagesSquare size={12} />
        討論／註記{comments.length > 0 ? `（${comments.length}）` : ''}
      </div>

      <div className="comment-list">
        {comments.map((c) => (
          <div className="comment" key={c.id}>
            <div className="comment-body">{c.body}</div>
            <div className="comment-meta">
              <span>{new Date(c.created_at).toLocaleString()}</span>
              <button className="comment-del" title="刪除" onClick={() => onDelete(c.id)}>
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="branch-field" style={{ marginTop: 8 }}>
        <input
          className="text-input"
          placeholder="記一則註記或想問的問題…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          {...enterSubmit(submit)}
        />
        <button className="btn btn-primary" onClick={submit} disabled={!text.trim()}>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
