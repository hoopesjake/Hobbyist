export function shortDate(value?: string | null) {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  if (!match) return null;
  const [, y, m, d] = match;
  return `${m}/${d}/${y.slice(2)}`;
}
