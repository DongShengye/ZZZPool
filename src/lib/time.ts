import { Timestamp } from "firebase/firestore";

export function approximateTimeAgo(value?: Timestamp) {
  if (!value) return "just now";

  const minutes = Math.max(0, Math.round((Date.now() - value.toMillis()) / 60000));

  if (minutes < 2) return "just now";
  if (minutes < 45) return "a little while ago";
  if (minutes < 90) return "1h ago";

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "yesterday-ish";

  return "a while ago";
}

export function isStale(value?: Timestamp) {
  if (!value) return false;
  return Date.now() - value.toMillis() > 1000 * 60 * 60 * 8;
}
