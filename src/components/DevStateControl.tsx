'use client';

import { useState, useRef, useEffect } from 'react';
import type { DevStateRow } from '@/lib/types';
import StatusDot from './StatusDot';

// The dev-state indicator at the left of each row. Click to open a popover and
// switch state. States with the `cross` style (i.e. "blocked") reveal a reason
// input.
export default function DevStateControl({
  devStates,
  valueId,
  blockedReason,
  onChange,
}: {
  devStates: DevStateRow[];
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
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = devStates.find((d) => d.id === valueId) ?? devStates[0];
  const isBlocked = current?.style === 'cross';

  if (!current) {
    return <span className="dev-state" style={{ width: 17 }} />;
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      <button
        className="dev-state"
        title={
          isBlocked && blockedReason ? `${current.name}：${blockedReason}` : current.name
        }
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <StatusDot color={current.color} style={current.style} />
      </button>

      {open && (
        <div className="popover" style={{ top: 24, left: 0 }}>
          {devStates.map((d) => (
            <button
              key={d.id}
              className="popover-item"
              onClick={(e) => {
                e.stopPropagation();
                if (d.style === 'cross') {
                  onChange(d.id, reason || null);
                } else {
                  onChange(d.id, null);
                  setOpen(false);
                }
              }}
            >
              <StatusDot color={d.color} style={d.style} sm />
              {d.name}
            </button>
          ))}

          {isBlocked && (
            <input
              autoFocus
              placeholder="卡在什麼？（如：等 Twitch API 回覆）"
              value={reason}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onChange(current.id, reason || null);
                  setOpen(false);
                }
              }}
              onBlur={() => onChange(current.id, reason || null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
