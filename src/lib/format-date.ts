/**
 * Deterministic date formatting for UI that is server-rendered AND hydrated.
 *
 * `toLocaleDateString()` without arguments uses the runtime's locale/time zone,
 * which differs between the server (Node, often en-US / UTC) and the browser
 * (e.g. en-IN / IST) and causes React hydration mismatches. Pinning both the
 * locale and the time zone makes the output identical everywhere.
 */
const DISPLAY_LOCALE = 'en-IN';
const DISPLAY_TIME_ZONE = 'Asia/Kolkata';

const dateFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const shortDateFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  day: 'numeric',
  month: 'short',
});

/** e.g. "26 Nov 2026" */
export function formatDate(date: Date | string): string {
  return dateFormatter.format(new Date(date));
}

/** e.g. "26 Nov" */
export function formatShortDate(date: Date | string): string {
  return shortDateFormatter.format(new Date(date));
}

const hourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIME_ZONE,
  hour: 'numeric',
  hourCycle: 'h23',
});

/** "Good morning" / "Good afternoon" / "Good evening" in the team's time zone. */
export function getGreeting(now: Date = new Date()): string {
  const hour = Number(hourFormatter.format(now));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * "just now", "5 minutes ago", "3 hours ago", "yesterday", then "26 Nov".
 * Call from Server Components only: "now" differs between server and browser.
 */
export function formatRelativeTime(date: Date | string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days === 1) return 'yesterday';
  return formatShortDate(date);
}
