export function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return 'now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: diffDay > 365 ? 'numeric' : undefined });
}

export type DateGroup = 'Today' | 'Yesterday' | 'Earlier';

export function dateGroupOf(dateStr: string): DateGroup {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) return 'Today';
  if (date >= startOfYesterday) return 'Yesterday';
  return 'Earlier';
}

export function groupByDate<T extends { created_at: string }>(items: T[]): { group: DateGroup; items: T[] }[] {
  const order: DateGroup[] = ['Today', 'Yesterday', 'Earlier'];
  const buckets: Record<DateGroup, T[]> = { Today: [], Yesterday: [], Earlier: [] };
  for (const item of items) buckets[dateGroupOf(item.created_at)].push(item);
  return order.filter(g => buckets[g].length > 0).map(g => ({ group: g, items: buckets[g] }));
}
