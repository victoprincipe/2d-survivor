export function getDailyKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getWeeklyKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - yearStart.getTime()) / 86400000);
  const week = Math.floor((days + yearStart.getDay()) / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getDaySeed(date: Date = new Date()): number {
  const yearStart = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date.getTime() - yearStart.getTime()) / 86400000);
}
