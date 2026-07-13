"use client";

import { LAUNCH_AREAS, type LaunchArea } from "@/config/launch-area";

// Phase 3 (MVP_SCOPE.md): "Expansion beyond the launch geography — repeat
// Phase 1's seeding playbook per new area, don't go city-wide in one
// jump." The config array (src/config/launch-area.ts) already supports
// multiple areas; this just exposes switching between them once a
// second one exists. Hidden entirely with a single area configured, so
// Phase 1's single-neighborhood launch stays uncluttered.
export function AreaSelector({
  onSelect,
}: {
  onSelect: (area: LaunchArea) => void;
}) {
  if (LAUNCH_AREAS.length <= 1) return null;

  return (
    <select
      aria-label="Choose neighborhood"
      onChange={(e) => {
        const area = LAUNCH_AREAS.find((a) => a.slug === e.target.value);
        if (area) onSelect(area);
      }}
      style={{
        height: 40,
        borderRadius: 8,
        border: "none",
        background: "var(--night-800)",
        color: "var(--mist-100)",
        padding: "0 var(--space-1)",
      }}
    >
      {LAUNCH_AREAS.map((area) => (
        <option key={area.slug} value={area.slug}>
          {area.label}
        </option>
      ))}
    </select>
  );
}
