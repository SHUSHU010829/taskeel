'use client';

import { DEV_STATE_META, type DevState } from '@/lib/types';

// The dev-state indicator, rendered as an SVG (ported from the prototype):
//   idle       — faint hollow ring
//   spec_ready — full ring + filled center
//   claude     — partial arc (spinner), breathing pulse
//   blocked    — full ring + cross
export default function StatusDot({
  ds,
  sm = false,
}: {
  ds: DevState;
  sm?: boolean;
}) {
  const v = DEV_STATE_META[ds];
  const sz = sm ? 10 : 13;

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: sz + 4,
        height: sz + 4,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg
        width={sz}
        height={sz}
        viewBox="0 0 14 14"
        style={v.pulse ? { animation: 'pulse 1.6s ease-in-out infinite' } : undefined}
      >
        <circle
          cx="7"
          cy="7"
          r="6"
          fill="none"
          stroke={v.color}
          strokeWidth="1.5"
          opacity={v.ring < 1 ? 0.35 : 1}
        />
        {v.ring >= 1 && <circle cx="7" cy="7" r="3" fill={v.color} />}
        {v.ring > 0 && v.ring < 1 && (
          <path
            d="M7 7 L7 1 A6 6 0 0 1 12.2 4"
            fill="none"
            stroke={v.color}
            strokeWidth="2.5"
          />
        )}
        {v.cross && (
          <path
            d="M4.5 4.5 L9.5 9.5 M9.5 4.5 L4.5 9.5"
            stroke={v.color}
            strokeWidth="1.6"
          />
        )}
      </svg>
    </span>
  );
}
