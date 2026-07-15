'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import type { DocumentRow } from '@/lib/types';
import MarkdownEditor from './MarkdownEditor';
import ConfirmDialog from './ConfirmDialog';

// A standalone document — title + optional link + markdown body. Keyed by id
// so switching documents remounts (and re-seeds) the editor; body is flushed
// on unmount so switching away never loses edits.
function DocEditor({
  doc,
  onUpdate,
  onDelete,
}: {
  doc: DocumentRow;
  onUpdate: (id: string, patch: Partial<DocumentRow>) => void;
  onDelete: (id: string) => void;
}) {
  const [body, setBody] = useState(doc.body);
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    return () => {
      if (bodyRef.current !== doc.body) onUpdate(doc.id, { body: bodyRef.current });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  return (
    <div className="doc-main-inner">
      <input
        className="modal-title-input"
        placeholder="文件標題"
        defaultValue={doc.title}
        key={`t-${doc.id}`}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== doc.title) onUpdate(doc.id, { title: v });
        }}
      />
      <input
        className="text-input"
        style={{ marginBottom: 10 }}
        placeholder="連結（選填，如 Notion / Google Docs 網址）"
        defaultValue={doc.url ?? ''}
        key={`u-${doc.id}`}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== (doc.url ?? '')) onUpdate(doc.id, { url: v || null });
        }}
      />
      <MarkdownEditor
        value={body}
        onChange={setBody}
        onSave={() => onUpdate(doc.id, { body })}
        startInEdit={!doc.body.trim()}
      />
      <div className="doc-delete">
        <button
          className="btn btn-ghost"
          style={{ color: '#EB5757', gap: 4 }}
          onClick={() => setConfirming(true)}
        >
          <Trash2 size={14} /> 刪除文件
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          title="刪除文件"
          message={`刪除文件「${doc.title || '未命名文件'}」？綁定此文件的任務會一併取消綁定。`}
          confirmLabel="刪除"
          danger
          onConfirm={() => {
            setConfirming(false);
            onDelete(doc.id);
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

export default function DocumentsView({
  documents,
  onAdd,
  onUpdate,
  onDelete,
}: {
  documents: DocumentRow[];
  onAdd: (title: string) => Promise<string | null>;
  onUpdate: (id: string, patch: Partial<DocumentRow>) => void;
  onDelete: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(documents[0]?.id ?? null);

  // keep a valid selection as the list changes
  useEffect(() => {
    if (documents.length === 0) {
      setSelectedId(null);
    } else if (!documents.some((d) => d.id === selectedId)) {
      setSelectedId(documents[0].id);
    }
  }, [documents, selectedId]);

  const selected = documents.find((d) => d.id === selectedId) ?? null;

  async function addNew() {
    const id = await onAdd('未命名文件');
    if (id) setSelectedId(id);
  }

  return (
    <div className="docs-view">
      <div className="docs-list">
        <button className="docs-new" onClick={addNew}>
          <Plus size={15} /> 新增文件
        </button>
        {documents.map((d) => (
          <button
            key={d.id}
            className={`docs-list-item${selectedId === d.id ? ' active' : ''}`}
            onClick={() => setSelectedId(d.id)}
          >
            <FileText size={14} style={{ flexShrink: 0, color: 'var(--text-faint)' }} />
            <span className="docs-list-title">{d.title || '未命名文件'}</span>
          </button>
        ))}
        {documents.length === 0 && <div className="docs-empty">還沒有文件。</div>}
      </div>

      <div className="docs-main">
        {selected ? (
          <DocEditor key={selected.id} doc={selected} onUpdate={onUpdate} onDelete={onDelete} />
        ) : (
          <div className="docs-empty" style={{ padding: 32 }}>
            按「新增文件」開始寫一份文件；之後可在任務的「參考資料」綁定它。
          </div>
        )}
      </div>
    </div>
  );
}
