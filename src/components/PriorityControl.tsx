'use client';

import { useEffect, useRef, useState } from 'react';
import { Flag } from 'lucide-react';
import { PRIORITIES } from '@/lib/types';
import PriorityFlag from './PriorityFlag';

// Row hover control: set a task's priority from a small popover.
export default function PriorityControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
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

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      <button
        className="row-act"
        title="優先度"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {value > 0 ? <PriorityFlag priority={value} size={13} /> : <Flag size={13} />}
      </button>
      {open && (
        <div className="popover" style={{ top: 24, right: 0, minWidth: 120 }}>
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              className="popover-item"
              onClick={(e) => {
                e.stopPropagation();
                onChange(p.value);
                setOpen(false);
              }}
            >
              {p.value > 0 ? (
                <PriorityFlag priority={p.value} size={12} />
              ) : (
                <span style={{ width: 12, display: 'inline-block' }} />
              )}
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
