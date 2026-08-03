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
  // latest value for the native beforeinput handler (attached once per edit)
  const valueRef = useRef(value);
  valueRef.current = value;
  const shiftRef = useRef(false); // Shift held on the last keydown

  useEffect(() => {
    if (pending.current && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(pending.current[0], pending.current[1]);
      pending.current = null;
    }
  }, [value]);

  // Continue the list on a real line break. Using `beforeinput` (fired only for
  // an actual newline, *after* an IME commit) sidesteps the flaky
  // isComposing/keyCode-229 state that made Enter continuation miss after
  // Chinese input or a paste.
  useEffect(() => {
    const el = ref.current;
    if (mode !== 'edit' || !el) return;
    const onBeforeInput = (ev: Event) => {
      const ie = ev as InputEvent;
      if (ie.inputType !== 'insertLineBreak' && ie.inputType !== 'insertParagraph') return;
      if (continueList()) ie.preventDefault();
    };
    el.addEventListener('beforeinput', onBeforeInput);
    return () => el.removeEventListener('beforeinput', onBeforeInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

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
    const nlEnd = value.indexOf('\n', s);
    const lineEnd = nlEnd === -1 ? value.length : nlEnd;
    onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart));
    // caret to the end of the now-prefixed line so typing (and Enter) continue
    const end = lineEnd + prefix.length;
    pending.current = [end, end];
  }

  // 3 spaces per level: enough to nest ordered items (`1. ` content starts at
  // column 3) as well as bullets in the GFM renderer.
  const INDENT = '   ';
  const LIST_RE = /^(\s*)([-*+]|\d+[.)])(\s+)/;

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // remember Shift so the beforeinput handler can treat Shift+Enter as a
    // plain line break (an escape hatch out of the list)
    shiftRef.current = e.shiftKey;
    if (e.nativeEvent.isComposing || e.keyCode === 229) return; // IME confirm
    if (e.key === 'Tab') handleTab(e, e.shiftKey);
    // Enter/list-continuation is handled via the beforeinput listener above.
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

  // Continue the current list item on Enter: `1. ` → `2. `, `- ` → `- `.
  // Works with the caret anywhere inside the item's content (not only at the
  // line end), so it fires after a paste or a toolbar-inserted marker too.
  // An empty item ends the list. Returns true if it handled the break.
  function continueList(): boolean {
    if (shiftRef.current) return false; // Shift+Enter → plain line break
    const el = ref.current;
    if (!el) return false;
    const s = el.selectionStart;
    if (s !== el.selectionEnd) return false; // a selection: let it replace normally
    const v = valueRef.current;
    const lineStart = v.lastIndexOf('\n', s - 1) + 1;
    const nlEnd = v.indexOf('\n', s);
    const lineEnd = nlEnd === -1 ? v.length : nlEnd;
    const line = v.slice(lineStart, lineEnd);

    const ordered = line.match(/^(\s*)(\d+)([.)])(\s+)(.*)$/);
    const bullet = line.match(/^(\s*)([-*+])(\s+)(.*)$/);
    if (!ordered && !bullet) return false;

    const markerLen = ordered
      ? ordered[1].length + ordered[2].length + ordered[3].length + ordered[4].length
      : bullet![1].length + bullet![2].length + bullet![3].length;
    // caret before the marker's content area — leave the break alone
    if (s < lineStart + markerLen) return false;

    const itemContent = ordered ? ordered[5] : bullet![4];
    if (itemContent.trim() === '') {
      // empty item → end the list
      onChange(v.slice(0, lineStart) + v.slice(lineEnd));
      pending.current = [lineStart, lineStart];
      return true;
    }
    const marker = ordered
      ? `${ordered[1]}${parseInt(ordered[2], 10) + 1}${ordered[3]} `
      : `${bullet![1]}${bullet![2]} `;
    const insert = `\n${marker}`;
    onChange(v.slice(0, s) + insert + v.slice(s));
    pending.current = [s + insert.length, s + insert.length];
    return true;
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
