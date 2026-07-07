'use client';

import { useState, useRef, useEffect } from 'react';
import type { StatusRow } from '@/lib/types';
import { enterSubmit } from '@/lib/useEnterSubmit';
import StatusDot from './StatusDot';

// The status icon at the left of each row. Click to open a popover and switch
// the task's status (which also moves it to that column). A status with the
// `cross` style reveals a "blocked reason" input.
export default function StatusControl({
  statuses,
  valueId,
  blockedReason,
  onChange,
}: {
  statuses: StatusRow[];
  valueId: string | null;
  blockedReason: string | null;
  onChange: (nextId: string, reason: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(blockedReason ?? '');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setReason(blockedReason ?? ''), [blockedReason]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = statuses.find((s) => s.id === valueId) ?? statuses[0];
  const isBlocked = current?.style === 'cross';

  if (!current) return <span className="dev-state" style={{ width: 17 }} />;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      <button
        className="dev-state"
        title={isBlocked && blockedReason ? `${current.name}：${blockedReason}` : current.name}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <StatusDot color={current.color} style={current.style} />
      </button>

      {open && (
        <div className="popover" style={{ top: 24, left: 0 }}>
          {statuses.map((s) => (
            <button
              key={s.id}
              className="popover-item"
              onClick={(e) => {
                e.stopPropagation();
                if (s.style === 'cross') {
                  onChange(s.id, reason || null);
                } else {
                  onChange(s.id, null);
                  setOpen(false);
                }
              }}
            >
              <StatusDot color={s.color} style={s.style} sm />
              {s.name}
            </button>
          ))}

          {isBlocked && (
            <input
              autoFocus
              placeholder="卡在什麼？（如：等 Twitch API 回覆）"
              value={reason}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setReason(e.target.value)}
              {...enterSubmit(() => {
                onChange(current.id, reason || null);
                setOpen(false);
              })}
              onBlur={() => onChange(current.id, reason || null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
