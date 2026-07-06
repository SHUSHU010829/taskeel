'use client';

import { useState, useRef, useEffect } from 'react';
import {
  DEV_STATE_ORDER,
  DEV_STATE_META,
  type DevState,
} from '@/lib/types';

// The small dev-state circle at the left of each row. Click to open a
// popover and switch state; choosing `blocked` reveals a reason input.
export default function DevStateControl({
  value,
  blockedReason,
  onChange,
}: {
  value: DevState;
  blockedReason: string | null;
  onChange: (next: DevState, reason: string | null) => void;
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

  const meta = DEV_STATE_META[value];

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      <button
        className={`dev-state ds-${value}`}
        title={
          value === 'blocked' && blockedReason
            ? `卡住：${blockedReason}`
            : meta.label
        }
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {value === 'blocked' ? (
          <span className="ds-x" style={{ position: 'relative', width: 13, height: 13 }}>
            <span className="ds-circle" />
          </span>
        ) : (
          <span className="ds-circle" />
        )}
      </button>

      {open && (
        <div className="popover" style={{ top: 22, left: 0 }}>
          {DEV_STATE_ORDER.map((s) => (
            <button
              key={s}
              className="popover-item"
              onClick={(e) => {
                e.stopPropagation();
                if (s === 'blocked') {
                  onChange('blocked', reason || null);
                } else {
                  onChange(s, null);
                  setOpen(false);
                }
              }}
            >
              <span
                className={`dev-state ds-${s}`}
                style={{ pointerEvents: 'none' }}
              >
                {s === 'blocked' ? (
                  <span
                    className="ds-x"
                    style={{ position: 'relative', width: 13, height: 13 }}
                  >
                    <span className="ds-circle" />
                  </span>
                ) : (
                  <span className="ds-circle" />
                )}
              </span>
              {DEV_STATE_META[s].label}
            </button>
          ))}

          {value === 'blocked' && (
            <input
              autoFocus
              placeholder="卡在什麼？（如：等 Twitch API 回覆）"
              value={reason}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onChange('blocked', reason || null);
                  setOpen(false);
                }
              }}
              onBlur={() => onChange('blocked', reason || null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
