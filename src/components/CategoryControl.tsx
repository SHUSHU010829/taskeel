'use client';

import { useEffect, useRef, useState } from 'react';
import type { CategoryRow } from '@/lib/types';

// A compact category tag on each row. Shows the category (colour + name), or a
// faint empty placeholder when none. Click to pick / clear a category inline.
export default function CategoryControl({
  categories,
  value,
  onChange,
}: {
  categories: CategoryRow[];
  value: string | null;
  onChange: (next: string | null) => void;
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

  const cat = categories.find((c) => c.id === value) ?? null;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      <button
        className={`cat-tag${cat ? '' : ' empty'}`}
        title={cat ? cat.name : '設定分類'}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {cat ? (
          <>
            <span className="dot" style={{ background: cat.color, width: 6, height: 6 }} />
            <span>{cat.name}</span>
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
          {categories.map((c) => (
            <button
              key={c.id}
              className="popover-item"
              onClick={(e) => {
                e.stopPropagation();
                onChange(c.id);
                setOpen(false);
              }}
            >
              <span className="dot" style={{ background: c.color, width: 8, height: 8 }} />
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
