'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, FileText, Plus, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type { DocumentRow } from '@/lib/types';

// Task "參考資料": bound documents (read their markdown body inline) plus a
// picker to bind more of the workspace's documents.
export default function TaskDocuments({
  bound,
  candidates,
  onBind,
  onUnbind,
}: {
  bound: DocumentRow[];
  candidates: DocumentRow[];
  onBind: (docId: string) => void;
  onUnbind: (docId: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const pickRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickOpen) {
      setFilter('');
      return;
    }
    const h = (e: MouseEvent) => {
      if (pickRef.current && !pickRef.current.contains(e.target as Node)) setPickOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [pickOpen]);

  const boundIds = new Set(bound.map((d) => d.id));
  const q = filter.trim().toLowerCase();
  const pickable = candidates
    .filter((d) => !boundIds.has(d.id))
    .filter((d) => !q || d.title.toLowerCase().includes(q));

  return (
    <div className="ed-section">
      <div className="field-label" style={{ display: 'flex', alignItems: 'center', margin: 0 }}>
        <FileText size={12} style={{ marginRight: 4 }} />
        <span style={{ flex: 1 }}>參考資料{bound.length > 0 ? `（${bound.length}）` : ''}</span>
        <div ref={pickRef} style={{ position: 'relative' }}>
          <button className="doc-add-btn" onClick={() => setPickOpen((o) => !o)}>
            <Plus size={13} /> 引用文件
          </button>
          {pickOpen && (
            <div className="popover doc-pick" style={{ top: 24, right: 0, minWidth: 240 }}>
              <input
                className="text-input"
                style={{ marginBottom: 4 }}
                placeholder="搜尋文件…"
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <div className="doc-pick-list">
                {pickable.length === 0 && (
                  <div className="popover-empty">
                    {candidates.length === 0
                      ? '沒有文件，到左側「文件」新增。'
                      : q
                        ? '找不到符合的文件。'
                        : '全部文件都已引用。'}
                  </div>
                )}
                {pickable.map((d) => (
                  <button key={d.id} className="popover-item" onClick={() => onBind(d.id)}>
                    <FileText size={13} style={{ flexShrink: 0, color: 'var(--text-faint)' }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {bound.length === 0 ? (
        <div style={{ color: 'var(--text-faint)', fontSize: '0.8rem', marginTop: 6 }}>
          引用文件後，可在這裡直接展開閱讀內容。
        </div>
      ) : (
        <div style={{ marginTop: 6 }}>
          {bound.map((d) => {
            const open = openId === d.id;
            return (
              <div key={d.id} className="doc-item">
                <div className="doc-item-head">
                  <button
                    className="doc-toggle"
                    onClick={() => setOpenId((o) => (o === d.id ? null : d.id))}
                  >
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="doc-title-text">{d.title}</span>
                  </button>
                  {d.url && (
                    <a
                      className="icon-btn"
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      title={d.url}
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <button className="icon-btn" title="移除引用" onClick={() => onUnbind(d.id)}>
                    <X size={14} />
                  </button>
                </div>
                {open && (
                  <div className="doc-read md">
                    {d.body.trim() ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                        {d.body}
                      </ReactMarkdown>
                    ) : (
                      <span style={{ color: 'var(--text-faint)', fontSize: '0.82rem' }}>
                        （此文件尚無內容，可到專案文件區編輯）
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
