'use client';

import type { DevStateStyle } from '@/lib/types';

// The dev-state indicator, rendered as an SVG. Driven by a colour + style so
// user-defined dev states still render:
//   ring    — faint hollow ring        filled — ring + filled center
//   spinner — partial arc, breathing   cross  — ring + cross
export default function StatusDot({
  color,
  style = 'ring',
  sm = false,
}: {
  color: string;
  style?: DevStateStyle;
  sm?: boolean;
}) {
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
        style={style === 'spinner' ? { animation: 'pulse 1.6s ease-in-out infinite' } : undefined}
      >
        <circle
          cx="7"
          cy="7"
          r="6"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity={style === 'ring' || style === 'spinner' ? 0.4 : 1}
        />
        {style === 'filled' && <circle cx="7" cy="7" r="3" fill={color} />}
        {style === 'spinner' && (
          <path
            d="M7 7 L7 1 A6 6 0 0 1 12.2 4"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
          />
        )}
        {style === 'cross' && (
          <path
            d="M4.5 4.5 L9.5 9.5 M9.5 4.5 L4.5 9.5"
            stroke={color}
            strokeWidth="1.6"
          />
        )}
      </svg>
    </span>
  );
}
