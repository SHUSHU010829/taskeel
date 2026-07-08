'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

// Casual multi-line notes: keep a standalone `---`/`***`/`___` line as a
// divider (horizontal rule) instead of letting it turn the preceding block into
// a big setext heading. Insert a blank line before it when it follows content.
function normalizeMarkdown(md: string) {
  const lines = md.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if (
      /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line) &&
      out.length > 0 &&
      out[out.length - 1].trim() !== ''
    ) {
      out.push('');
    }
    out.push(line);
  }
  return out.join('\n');
}
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Quote,
} from 'lucide-react';

// A lightweight Markdown editor: write Markdown (with a small toolbar), or flip
// to a rendered preview. The stored value stays plain text.
export default function MarkdownEditor({
  value,
  onChange,
  startInEdit,
}: {
  value: string;
  onChange: (v: string) => void;
  startInEdit: boolean;
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>(
    startInEdit || !value.trim() ? 'edit' : 'preview'
  );
  const ref = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (pending.current && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(pending.current[0], pending.current[1]);
      pending.current = null;
    }
  }, [value]);

  function surround(before: string, after = before) {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const sel = value.slice(s, e);
    onChange(value.slice(0, s) + before + sel + after + value.slice(e));
    pending.current = [s + before.length, e + before.length];
  }

  function linePrefix(prefix: string) {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart));
    pending.current = [s + prefix.length, s + prefix.length];
  }

  // Enter continues the current list item: `1. ` → `2. `, `- ` → `- `.
  // Pressing Enter on an empty item ends the list (clears the marker).
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter') return;
    if (e.nativeEvent.isComposing || e.keyCode === 229) return; // IME confirm
    if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    if (s !== el.selectionEnd) return; // let ranged Enter behave normally
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const nlEnd = value.indexOf('\n', s);
    const lineEnd = nlEnd === -1 ? value.length : nlEnd;
    if (s !== lineEnd) return; // only continue when at end of the line
    const line = value.slice(lineStart, lineEnd);

    const ordered = line.match(/^(\s*)(\d+)([.)])\s+(.*)$/);
    const bullet = line.match(/^(\s*)([-*+])\s+(.*)$/);
    if (!ordered && !bullet) return;

    e.preventDefault();
    const content = (ordered ? ordered[4] : bullet![3]).trim();
    if (content === '') {
      // empty item → exit the list: clear this line's marker
      onChange(value.slice(0, lineStart) + value.slice(lineEnd));
      pending.current = [lineStart, lineStart];
      return;
    }
    const marker = ordered
      ? `${ordered[1]}${parseInt(ordered[2], 10) + 1}${ordered[3]} `
      : `${bullet![1]}${bullet![2]} `;
    const insert = `\n${marker}`;
    onChange(value.slice(0, s) + insert + value.slice(s));
    pending.current = [s + insert.length, s + insert.length];
  }

  const tools = [
    { icon: Heading1, title: '大標題', fn: () => linePrefix('# ') },
    { icon: Heading2, title: '小標題', fn: () => linePrefix('## ') },
    { icon: Bold, title: '粗體', fn: () => surround('**') },
    { icon: Italic, title: '斜體', fn: () => surround('*') },
    { icon: List, title: '清單', fn: () => linePrefix('- ') },
    { icon: ListOrdered, title: '編號清單', fn: () => linePrefix('1. ') },
    { icon: Quote, title: '引用', fn: () => linePrefix('> ') },
    { icon: Code, title: '程式碼', fn: () => surround('`') },
  ];

  return (
    <div className="md-editor">
      <div className="md-toolbar">
        {mode === 'edit' &&
          tools.map((t, i) => (
            <button
              key={i}
              type="button"
              className="icon-btn"
              title={t.title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={t.fn}
            >
              <t.icon size={15} />
            </button>
          ))}
        <div className="spacer" />
        <button
          type="button"
          className={`md-tab${mode === 'edit' ? ' on' : ''}`}
          onClick={() => setMode('edit')}
        >
          編輯
        </button>
        <button
          type="button"
          className={`md-tab${mode === 'preview' ? ' on' : ''}`}
          onClick={() => setMode('preview')}
        >
          預覽
        </button>
      </div>

      {mode === 'edit' ? (
        <textarea
          ref={ref}
          className="modal-desc"
          placeholder="加點說明…（支援 Markdown：# 標題、- 清單、**粗體**）"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      ) : value.trim() ? (
        <div className="modal-desc md" onClick={() => setMode('edit')}>
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
            {normalizeMarkdown(value)}
          </ReactMarkdown>
        </div>
      ) : (
        <div
          className="modal-desc md md-empty"
          onClick={() => setMode('edit')}
        >
          點此加說明…
        </div>
      )}
    </div>
  );
}
