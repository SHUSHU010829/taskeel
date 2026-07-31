'use client';

import { useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { PRIORITIES } from '@/lib/types';
import PriorityFlag from './PriorityFlag';

interface OrgSub {
  title: string;
  description?: string;
}
interface OrgTask {
  title: string;
  description?: string;
  category?: string;
  project?: string;
  priority?: number;
  subtasks?: OrgSub[];
  include?: boolean;
}

export interface OrganizedTask {
  title: string;
  description: string;
  category: string;
  project: string;
  priority: number;
  subtasks: { title: string; description: string }[];
}

// AI 整理：貼一段說明 → Claude 整理成主/子任務 → 檢視編輯 → 一鍵建立。
interface NamedRef {
  name: string;
  abbr?: string;
}

export default function OrganizeModal({
  categories,
  projects,
  onCreate,
  onClose,
}: {
  categories: NamedRef[];
  projects: NamedRef[];
  onCreate: (items: OrganizedTask[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<OrgTask[] | null>(null);

  async function organize() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/organize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, categories, projects }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '整理失敗');
      const tasks: OrgTask[] = (data.tasks ?? []).map((t: OrgTask) => ({ ...t, include: true }));
      if (tasks.length === 0) {
        setError('沒有整理出任何任務，換個說法再試試。');
      } else {
        setItems(tasks);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function patch(i: number, p: Partial<OrgTask>) {
    setItems((prev) => prev!.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  }
  function patchSub(i: number, j: number, p: Partial<OrgSub>) {
    setItems((prev) =>
      prev!.map((it, idx) =>
        idx === i
          ? { ...it, subtasks: it.subtasks!.map((s, sj) => (sj === j ? { ...s, ...p } : s)) }
          : it
      )
    );
  }
  function removeSub(i: number, j: number) {
    setItems((prev) =>
      prev!.map((it, idx) =>
        idx === i ? { ...it, subtasks: it.subtasks!.filter((_, sj) => sj !== j) } : it
      )
    );
  }

  const chosen = (items ?? []).filter((it) => it.include && it.title.trim());
  const total = chosen.reduce((n, it) => n + 1 + (it.subtasks?.filter((s) => s.title.trim()).length ?? 0), 0);

  function create() {
    onCreate(
      chosen.map((it) => ({
        title: it.title.trim(),
        description: it.description ?? '',
        category: it.category ?? '',
        project: it.project ?? '',
        priority: it.priority ?? 0,
        subtasks: (it.subtasks ?? [])
          .filter((s) => s.title.trim())
          .map((s) => ({ title: s.title.trim(), description: s.description ?? '' })),
      }))
    );
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal organize-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-heading" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={16} style={{ color: 'var(--accent)' }} /> AI 整理任務
        </div>

        {!items ? (
          <>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: '4px 0 10px' }}>
              把一長串想法／需求／會議記錄貼進來，AI 會整理成主任務與子任務。
            </p>
            <textarea
              className="textarea organize-input"
              placeholder="例如：Easytax 後台批次上傳要能篩選公司狀態，另外通知訊息顯示要優化，還要預留營所稅欄位……"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            {error && <div className="login-msg login-error">{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>
                取消
              </button>
              <button className="btn btn-primary" disabled={!text.trim() || loading} onClick={organize}>
                {loading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                {loading ? '整理中…' : '整理'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="organize-review">
              {items.map((it, i) => (
                <div className={`org-task${it.include ? '' : ' off'}`} key={i}>
                  <div className="org-task-head">
                    <input
                      type="checkbox"
                      className="org-check"
                      checked={!!it.include}
                      onChange={(e) => patch(i, { include: e.target.checked })}
                    />
                    <input
                      className="text-input org-title"
                      value={it.title}
                      onChange={(e) => patch(i, { title: e.target.value })}
                    />
                    {it.project && <span className="summary-chip org-proj-chip">{it.project}</span>}
                    {it.category && <span className="summary-chip">{it.category}</span>}
                    {!!it.priority && (
                      <span className="summary-chip">
                        <PriorityFlag priority={it.priority} size={11} />
                        {PRIORITIES.find((p) => p.value === it.priority)?.label}
                      </span>
                    )}
                  </div>
                  {it.include && (
                    <div className="org-task-body">
                      <textarea
                        className="textarea org-desc"
                        placeholder="說明（選填）"
                        value={it.description ?? ''}
                        onChange={(e) => patch(i, { description: e.target.value })}
                        rows={2}
                      />
                      {(it.subtasks?.length ?? 0) > 0 && (
                        <div className="org-subs">
                          {it.subtasks!.map((s, j) => (
                            <div className="org-sub" key={j}>
                              <span className="org-sub-dot" />
                              <input
                                className="text-input"
                                value={s.title}
                                onChange={(e) => patchSub(i, j, { title: e.target.value })}
                              />
                              <button className="icon-btn" title="移除子任務" onClick={() => removeSub(i, j)}>
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {error && <div className="login-msg login-error">{error}</div>}
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                style={{ marginRight: 'auto' }}
                onClick={() => setItems(null)}
              >
                ← 重新整理
              </button>
              <button className="btn btn-ghost" onClick={onClose}>
                取消
              </button>
              <button className="btn btn-primary" disabled={total === 0} onClick={create}>
                建立 {total} 個任務
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
