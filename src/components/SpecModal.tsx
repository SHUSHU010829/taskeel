'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, FileText, Loader2, RefreshCw } from 'lucide-react';

// Shows the AI-generated development-requirements brief for the selected tasks.
// Editable, copyable (paste into Claude Code), and re-runnable.
export default function SpecModal({
  count,
  loading,
  error,
  spec,
  onRegenerate,
  onClose,
}: {
  count: number;
  loading: boolean;
  error: string | null;
  spec: string | null;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(spec ?? '');
  const [view, setView] = useState<'text' | 'preview'>('text');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setText(spec ?? '');
  }, [spec]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal spec-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-heading" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={16} style={{ color: 'var(--accent)' }} /> 開發需求說明
          <span className="spec-sub">從 {count} 個任務統整</span>
        </div>

        {loading ? (
          <div className="spec-loading">
            <Loader2 size={20} className="spin" />
            <span>Claude 正在統整需求…</span>
          </div>
        ) : error ? (
          <>
            <div className="login-msg login-error" style={{ margin: '8px 0' }}>
              {error}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>
                關閉
              </button>
              <button className="btn btn-primary" onClick={onRegenerate}>
                <RefreshCw size={14} /> 重試
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="spec-tabs">
              <button
                className={`spec-tab${view === 'text' ? ' on' : ''}`}
                onClick={() => setView('text')}
              >
                原文
              </button>
              <button
                className={`spec-tab${view === 'preview' ? ' on' : ''}`}
                onClick={() => setView('preview')}
              >
                預覽
              </button>
              <div className="spacer" />
              <button className="btn btn-ghost" onClick={onRegenerate} title="重新產生">
                <RefreshCw size={14} /> 重新產生
              </button>
              <button className="btn btn-primary" onClick={copy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? '已複製' : '複製'}
              </button>
            </div>

            {view === 'text' ? (
              <textarea
                className="textarea spec-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
              />
            ) : (
              <div className="spec-preview modal-desc md">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>
                關閉
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
