export function greetingForNow(date: Date = new Date()): string {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  return "Good evening";
}

export function firstName(fullName?: string | null): string {
  if (!fullName) return "";
  return fullName.trim().split(/\s+/)[0];
}