'use client';

import { useEffect, useRef, useState } from 'react';
import { CATEGORY_META, type TaskCategory } from '@/lib/types';

// A compact category tag on each row. Shows the category (colour + label), or a
// faint empty placeholder when none. Click to pick / clear a category inline.
export default function CategoryControl({
  value,
  onChange,
}: {
  value: TaskCategory | null;
  onChange: (next: TaskCategory | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const meta = value ? CATEGORY_META[value] : null;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      <button
        className={`cat-tag${meta ? '' : ' empty'}`}
        title={meta ? meta.label : '設定分類'}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {meta ? (
          <>
            <span className="dot" style={{ background: meta.color, width: 6, height: 6 }} />
            <span>{meta.label}</span>
          </>
        ) : (
          <span className="cat-empty-dot" />
        )}
      </button>

      {open && (
        <div className="popover" style={{ top: 24, left: 0, minWidth: 140 }}>
          <button
            className="popover-item"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setOpen(false);
            }}
          >
            <span className="cat-empty-dot" />
            無分類
          </button>
          {(Object.keys(CATEGORY_META) as TaskCategory[]).map((c) => (
            <button
              key={c}
              className="popover-item"
              onClick={(e) => {
                e.stopPropagation();
                onChange(c);
                setOpen(false);
              }}
            >
              <span
                className="dot"
                style={{ background: CATEGORY_META[c].color, width: 8, height: 8 }}
              />
              {CATEGORY_META[c].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
