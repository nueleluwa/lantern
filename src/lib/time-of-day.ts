// Shared by TagForm.tsx and LitTonightQuickAction.tsx — was previously
// duplicated verbatim in both (found by audit-project review). Feeds
// directly into scoring.ts's bucketMatches day/evening/night logic, so
// this boundary is a single source of truth rather than two copies that
// could drift out of sync.
export function getCurrentTimeOfDay(now = new Date()): "day" | "evening" | "night" {
  const hour = now.getHours();
  if (hour >= 6 && hour < 18) return "day";
  if (hour >= 18 && hour < 21) return "evening";
  return "night";
}
