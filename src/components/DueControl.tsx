'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarClock } from 'lucide-react';

// Row hover control: set / clear a task's due date from a small popover.
export default function DueControl({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
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
        className={`row-act${value ? ' on' : ''}`}
        title="截止日"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <CalendarClock size={13} />
      </button>
      {open && (
        <div className="popover" style={{ top: 24, right: 0, padding: 8, minWidth: 180 }}>
          <input
            type="date"
            className="text-input"
            value={value ?? ''}
            autoFocus
            onChange={(e) => onChange(e.target.value || null)}
          />
          {value && (
            <button
              className="popover-item"
              style={{ marginTop: 4 }}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
                setOpen(false);
              }}
            >
              清除截止日
            </button>
          )}
        </div>
      )}
    </div>
  );
}
