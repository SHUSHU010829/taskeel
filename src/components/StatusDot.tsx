'use client';

import type { StatusStyle } from '@/lib/types';

// The status indicator, rendered as an SVG. Driven by colour + style so
// user-defined statuses render their chosen icon:
//   ring    hollow ring          dashed  dashed ring (backlog)
//   half    half-filled          filled  ring + solid center
//   spinner arc, breathing       check   ring + tick
//   cross   ring + X             dot     small solid dot
export default function StatusDot({
  color,
  style = 'ring',
  sm = false,
}: {
  color: string;
  style?: StatusStyle;
  sm?: boolean;
}) {
  const sz = sm ? 10 : 13;
  const ring = (opacity = 1, dash?: string) => (
    <circle
      cx="7"
      cy="7"
      r="6"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      opacity={opacity}
      strokeDasharray={dash}
    />
  );

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
        {style === 'dot' ? (
          <circle cx="7" cy="7" r="3.5" fill={color} />
        ) : (
          <>
            {style === 'ring' && ring(0.5)}
            {style === 'dashed' && ring(0.75, '2.2 2')}
            {style === 'spinner' && ring(0.35)}
            {(style === 'filled' || style === 'check' || style === 'cross' || style === 'half') &&
              ring(1)}

            {style === 'filled' && <circle cx="7" cy="7" r="3" fill={color} />}
            {style === 'half' && (
              <path d="M7 7 L7 1 A6 6 0 0 1 7 13 Z" fill={color} />
            )}
            {style === 'spinner' && (
              <path
                d="M7 7 L7 1 A6 6 0 0 1 12.2 4"
                fill="none"
                stroke={color}
                strokeWidth="2.5"
              />
            )}
            {style === 'check' && (
              <path
                d="M4 7.2 L6.2 9.3 L10 5"
                fill="none"
                stroke={color}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {style === 'cross' && (
              <path
                d="M4.5 4.5 L9.5 9.5 M9.5 4.5 L4.5 9.5"
                stroke={color}
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            )}
          </>
        )}
      </svg>
    </span>
  );
}
