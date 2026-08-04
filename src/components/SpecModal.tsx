'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, FileText, Loader2, RefreshCw, Sparkles } from 'lucide-react';

type Detail = 'concise' | 'standard' | 'detailed';
const DETAILS: { value: Detail; label: string }[] = [
  { value: 'concise', label: '精簡' },
  { value: 'standard', label: '標準' },
  { value: 'detailed', label: '完整' },
];

// one-click direction presets that toggle into the hint field
const HINT_PRESETS: { label: string; phrase: string }[] = [
  { label: '前端', phrase: '偏前端' },
  { label: '後端', phrase: '偏後端' },
  { label: '含 API', phrase: '請包含 API 介面設計' },
  { label: '資料結構', phrase: '請包含資料結構／欄位' },
  { label: 'MVP', phrase: '先做 MVP、範圍精簡' },
  { label: '含測試', phrase: '請包含測試重點' },
];

const splitNote = (s: string) =>
  s
    .split(/[，,、\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);

// AI development-requirements brief for the selected tasks. Pick detail + hints
// first, then 產生; the result is editable, copyable, and re-runnable.
export default function SpecModal({
  count,
  loading,
  error,
  spec,
  onGenerate,
  onClose,
}: {
  count: number;
  loading: boolean;
  error: string | null;
  spec: string | null;
  onGenerate: (detail: Detail, note: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(spec ?? '');
  const [view, setView] = useState<'text' | 'preview'>('text');
  const [copied, setCopied] = useState(false);
  const [detail, setDetail] = useState<Detail>('standard');
  const [note, setNote] = useState('');

  useEffect(() => {
    setText(spec ?? '');
  }, [spec]);

  const gen = () => onGenerate(detail, note.trim());

  const noteParts = splitNote(note);
  function toggleHint(phrase: string) {
    setNote(
      noteParts.includes(phrase)
        ? noteParts.filter((p) => p !== phrase).join('、')
        : [...noteParts, phrase].join('、')
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  const hasResult = spec != null;

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal spec-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-heading" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={16} style={{ color: 'var(--accent)' }} /> 開發需求說明
          <span className="spec-sub">從 {count} 個任務統整</span>
        </div>

        {/* settings — chosen before generating, tweakable for re-generating */}
        <div className="spec-settings">
          <span className="spec-settings-label">詳細程度</span>
          <div className="spec-detail">
            {DETAILS.map((d) => (
              <button
                key={d.value}
                className={`spec-detail-opt${detail === d.value ? ' on' : ''}`}
                onClick={() => setDetail(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <input
            className="text-input spec-note"
            placeholder="方向提示（選填，可用下方標籤或自行輸入）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="spec-hints">
          {HINT_PRESETS.map((h) => (
            <button
              key={h.phrase}
              className={`spec-hint${noteParts.includes(h.phrase) ? ' on' : ''}`}
              onClick={() => toggleHint(h.phrase)}
              title={h.phrase}
            >
              {h.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="login-msg login-error" style={{ margin: '8px 0 0' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="spec-loading">
            <Loader2 size={20} className="spin" />
            <span>Claude 正在統整需求…</span>
          </div>
        ) : hasResult ? (
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
              <button className="btn btn-ghost" onClick={gen} title="用目前設定重新產生">
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
          </>
        ) : (
          <div className="spec-setup">
            <p className="spec-setup-hint">
              選好詳細程度與方向後，讓 Claude 把這 {count} 個任務統整成一段開發需求說明。
            </p>
            <button className="btn btn-primary spec-go" onClick={gen}>
              <Sparkles size={15} /> 產生開發需求
            </button>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
