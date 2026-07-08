import { Flag } from 'lucide-react';
import { PRIORITIES } from '@/lib/types';

// A small filled flag in the priority colour. Renders nothing for priority 0.
export default function PriorityFlag({ priority, size = 13 }: { priority: number; size?: number }) {
  if (!priority) return null;
  const p = PRIORITIES.find((x) => x.value === priority);
  if (!p) return null;
  return (
    <span
      title={`優先度：${p.label}`}
      style={{ display: 'inline-flex', color: p.color, flexShrink: 0 }}
    >
      <Flag size={size} fill="currentColor" />
    </span>
  );
}
