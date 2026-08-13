export function startOfLocalDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfLocalDay(d: Date = new Date()): Date {
  const start = startOfLocalDay(d);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
}
