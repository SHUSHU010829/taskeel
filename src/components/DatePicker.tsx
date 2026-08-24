'use client';

import { useEffect, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { zhTW } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { CalendarClock, X } from 'lucide-react';

// 'YYYY-MM-DD' <-> local Date (avoid UTC parsing that shifts the day).
function toDate(s: string | null): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function toStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// A calendar-popover date picker (react-day-picker), themed to the app.
export default function DatePicker({
  value,
  onChange,
  placeholder = '設定日期',
  align = 'left',
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  align?: 'left' | 'right';
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

  const selected = toDate(value);
  const label = selected
    ? selected.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
    : placeholder;

  return (
    <div className="datepicker" ref={ref}>
      <button
        type="button"
        className={`datepicker-btn${value ? ' has' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <CalendarClock size={14} />
        <span className="datepicker-label">{label}</span>
        {value && (
          <span
            className="datepicker-clear"
            role="button"
            title="清除"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setOpen(false);
            }}
          >
            <X size={13} />
          </span>
        )}
      </button>
      {open && (
        <div className={`popover datepicker-pop ${align}`} onMouseDown={(e) => e.stopPropagation()}>
          <DayPicker
            mode="single"
            locale={zhTW}
            weekStartsOn={1}
            showOutsideDays
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              onChange(d ? toStr(d) : null);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
