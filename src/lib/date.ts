// Relative due-date display. `due` is an ISO date (yyyy-mm-dd) or null.
export function dueMeta(
  due: string | null
): { label: string; full: string; overdue: boolean; soon: boolean } | null {
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${due}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);

  let label: string;
  if (diff === 0) label = '今天';
  else if (diff === 1) label = '明天';
  else if (diff === -1) label = '昨天';
  else if (diff < 0) label = `逾期 ${-diff} 天`;
  else if (diff <= 7) label = `${diff} 天後`;
  else label = due.slice(5); // mm-dd for far-off dates

  return {
    label,
    full: due,
    overdue: diff < 0,
    soon: diff >= 0 && diff <= 2,
  };
}
