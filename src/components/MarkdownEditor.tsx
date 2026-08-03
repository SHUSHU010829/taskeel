'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Bold, Check, Code, Heading1, Heading2, Italic, List, ListOrdered, Pencil, Quote } from 'lucide-react';

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

// A lightweight Markdown editor. Preview is read-only (text stays selectable /
// copyable); press 編輯 to switch to editing, then 儲存 to persist and return to
// preview. `onSave` is called with the current value when 儲存 is pressed.
export default function MarkdownEditor({
  value,
  onChange,
  onSave,
  startInEdit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  startInEdit: boolean;
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>(startInEdit ? 'edit' : 'preview');
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

  // 3 spaces per level: enough to nest ordered items (`1. ` content starts at
  // column 3) as well as bullets in the GFM renderer.
  const INDENT = '   ';
  const LIST_RE = /^(\s*)([-*+]|\d+[.)])(\s+)/;

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return; // IME confirm
    if (e.key === 'Tab') {
      handleTab(e, e.shiftKey);
      return;
    }
    if (e.key === 'Enter') handleEnter(e);
  }

  // Tab / Shift+Tab nests or un-nests the list line(s) touched by the caret or
  // selection. Indenting an ordered item resets its number to 1 (start of a
  // sub-list); the renderer sequences the rest.
  function handleTab(e: KeyboardEvent<HTMLTextAreaElement>, outdent: boolean) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const eEnd = el.selectionEnd;
    const firstLineStart = value.lastIndexOf('\n', s - 1) + 1;
    const nl = value.indexOf('\n', eEnd);
    const blockEnd = nl === -1 ? value.length : nl;
    const lines = value.slice(firstLineStart, blockEnd).split('\n');
    if (!lines.some((l) => LIST_RE.test(l))) return; // not a list — let Tab do its thing

    e.preventDefault();
    let firstDelta = 0;
    const newLines = lines.map((l, idx) => {
      if (!LIST_RE.test(l)) return l;
      let next: string;
      if (outdent) {
        next = l.replace(/^( {1,3}|\t)/, '');
      } else {
        next = (INDENT + l).replace(/^(\s*)(\d+)([.)])/, (_m, ws, _n, dot) => `${ws}1${dot}`);
      }
      if (idx === 0) firstDelta = next.length - l.length;
      return next;
    });
    const newBlock = newLines.join('\n');
    onChange(value.slice(0, firstLineStart) + newBlock + value.slice(blockEnd));
    if (s === eEnd) {
      const caret = Math.max(firstLineStart, s + firstDelta);
      pending.current = [caret, caret];
    } else {
      pending.current = [firstLineStart, firstLineStart + newBlock.length];
    }
  }

  // Enter continues the current list item: `1. ` → `2. `, `- ` → `- `.
  // Pressing Enter on an empty item ends the list (clears the marker).
  function handleEnter(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    if (s !== el.selectionEnd) return;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const nlEnd = value.indexOf('\n', s);
    const lineEnd = nlEnd === -1 ? value.length : nlEnd;
    if (s !== lineEnd) return;
    const line = value.slice(lineStart, lineEnd);

    const ordered = line.match(/^(\s*)(\d+)([.)])\s+(.*)$/);
    const bullet = line.match(/^(\s*)([-*+])\s+(.*)$/);
    if (!ordered && !bullet) return;

    e.preventDefault();
    const content = (ordered ? ordered[4] : bullet![3]).trim();
    if (content === '') {
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

  function save() {
    onSave();
    setMode('preview');
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

  if (mode === 'preview') {
    return (
      <div className="md-editor">
        <div className="md-toolbar">
          <span className="md-desc-label">說明</span>
          <div className="spacer" />
          <button type="button" className="md-tab" onClick={() => setMode('edit')}>
            <Pencil size={13} /> 編輯
          </button>
        </div>
        {value.trim() ? (
          <div className="modal-desc md">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
              {normalizeMarkdown(value)}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="modal-desc md md-empty" onClick={() => setMode('edit')}>
            點「編輯」加說明…
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="md-editor">
      <div className="md-toolbar">
        {tools.map((t, i) => (
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
        <button type="button" className="md-save" onClick={save}>
          <Check size={13} /> 儲存
        </button>
      </div>
      <textarea
        ref={ref}
        className="modal-desc"
        placeholder="加點說明…（Markdown：# 標題、- 清單、**粗體**；清單按 Enter 續行、Tab 縮排／Shift+Tab 退回）"
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
