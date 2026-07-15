'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, X } from 'lucide-react';
import type { DocumentRow } from '@/lib/types';
import { enterSubmit } from '@/lib/useEnterSubmit';
import ConfirmDialog from './ConfirmDialog';

export interface DocumentHandlers {
  addDocument: (title: string) => void;
  updateDocument: (id: string, patch: Partial<DocumentRow>) => void;
  deleteDocument: (id: string) => void;
}

// Project document area — list + inline edit (title / url / markdown body).
export default function DocumentList({
  documents,
  handlers,
}: {
  documents: DocumentRow[];
  handlers: DocumentHandlers;
}) {
  const [newTitle, setNewTitle] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; title: string } | null>(null);

  function submitNew() {
    if (!newTitle.trim()) return;
    handlers.addDocument(newTitle.trim());
    setNewTitle('');
  }

  return (
    <div>
      {documents.map((d) => {
        const open = openId === d.id;
        return (
          <div key={d.id} className="doc-item">
            <div className="doc-item-head">
              <button
                className="doc-toggle"
                onClick={() => setOpenId((o) => (o === d.id ? null : d.id))}
              >
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="doc-title-text">{d.title || '未命名文件'}</span>
              </button>
              {d.url && (
                <a className="icon-btn" href={d.url} target="_blank" rel="noreferrer" title={d.url}>
                  <ExternalLink size={13} />
                </a>
              )}
              <button
                className="icon-btn"
                title="刪除文件"
                onClick={() => setConfirm({ id: d.id, title: d.title })}
              >
                <X size={14} />
              </button>
            </div>
            {open && (
              <div className="doc-edit">
                <input
                  className="text-input"
                  placeholder="文件標題"
                  defaultValue={d.title}
                  key={`t-${d.title}`}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== d.title) handlers.updateDocument(d.id, { title: v });
                  }}
                />
                <input
                  className="text-input"
                  placeholder="連結（選填，如 Notion / Google Docs 網址）"
                  defaultValue={d.url ?? ''}
                  key={`u-${d.url ?? ''}`}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (d.url ?? '')) handlers.updateDocument(d.id, { url: v || null });
                  }}
                />
                <textarea
                  className="textarea"
                  placeholder="文件內容（支援 Markdown，會顯示在綁定此文件的任務說明中）"
                  defaultValue={d.body}
                  key={`b-${d.id}`}
                  rows={6}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== d.body) handlers.updateDocument(d.id, { body: v });
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      <div className="branch-field" style={{ marginTop: 10 }}>
        <input
          className="text-input"
          placeholder="新增文件…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          {...enterSubmit(submitNew)}
        />
        <button className="btn btn-primary" onClick={submitNew}>
          新增
        </button>
      </div>

      {confirm && (
        <ConfirmDialog
          title="刪除文件"
          message={`刪除文件「${confirm.title || '未命名文件'}」？綁定此文件的任務會一併取消綁定。`}
          confirmLabel="刪除"
          danger
          onConfirm={() => {
            handlers.deleteDocument(confirm.id);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
