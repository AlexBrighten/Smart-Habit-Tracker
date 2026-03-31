/**
 * Local notification helpers.
 * Uses the browser Notification API — no server needed.
 */

const REFLECTION_REMINDER_KEY = "habit-tracker-reflection-reminder";

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function scheduleWeeklyReflectionReminder() {
  if (typeof window === "undefined") return;
  // Clear any existing timer
  const existingId = localStorage.getItem(REFLECTION_REMINDER_KEY);
  if (existingId) clearTimeout(Number(existingId));

  const now = new Date();
  const nextSunday = getNextSunday7PM(now);
  const ms = nextSunday.getTime() - now.getTime();

  if (ms <= 0) return; // already past

  const timerId = window.setTimeout(() => {
    showReflectionNotification();
    // Schedule next week
    scheduleWeeklyReflectionReminder();
  }, ms);

  localStorage.setItem(REFLECTION_REMINDER_KEY, String(timerId));
}

function getNextSunday7PM(from: Date): Date {
  const d = new Date(from);
  const dayOfWeek = d.getDay(); // 0=Sunday
  let daysUntilSunday = (7 - dayOfWeek) % 7;

  // If it's Sunday but past 7 PM, go to next Sunday
  if (daysUntilSunday === 0) {
    const sunday7PM = new Date(d);
    sunday7PM.setHours(19, 0, 0, 0);
    if (d >= sunday7PM) daysUntilSunday = 7;
  }

  const target = new Date(d);
  target.setDate(target.getDate() + daysUntilSunday);
  target.setHours(19, 0, 0, 0);
  return target;
}

function showReflectionNotification() {
  if (Notification.permission !== "granted") return;
  new Notification("Time to reflect on your week 💭", {
    body: "Review your habits, read your AI analysis, and set intentions for next week.",
    icon: "/icon-192.png",
    tag: "weekly-reflection",
  });
}
