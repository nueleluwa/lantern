"use client";

import { useState } from "react";
import { LightBulbIcon, MoonIcon } from "@heroicons/react/24/solid";
import { enqueueTag, drainTagQueue } from "@/lib/tag-queue";

// MVP_SCOPE.md Phase 2 / PRD.md P1: "'Lit tonight' real-time lighting
// status distinct from static lighting infrastructure." Uses tags.kind =
// 'lit_tonight' (1-day half-life in src/lib/scoring.ts — DATA_MODEL.md:
// "'Lit tonight' tags use a short half-life ... they expire by
// morning"), so this only nudges the score transiently, unlike a
// standard or infrastructure report.
export function LitTonightQuickAction({ segmentId }: { segmentId: string }) {
  const [sent, setSent] = useState<"lit" | "dark" | null>(null);

  async function report(status: "lit" | "dark") {
    const hour = new Date().getHours();
    const timeOfDay = hour >= 6 && hour < 18 ? "day" : hour >= 18 && hour < 21 ? "evening" : "night";

    enqueueTag(segmentId, {
      timeOfDay,
      lighting: status,
      safetyFeeling: status === "lit" ? "safe" : "avoid",
      kind: "lit_tonight",
    });
    await drainTagQueue();
    setSent(status);
  }

  if (sent) {
    return (
      <p style={{ fontSize: "var(--text-label)", color: "var(--mist-400)" }}>
        Thanks — reported {sent === "lit" ? "lit" : "dark"} right now.
      </p>
    );
  }

  return (
    <div>
      <p style={{ fontSize: "var(--text-label)", marginBottom: "var(--space-1)" }}>
        Is it lit right now?
      </p>
      <div style={{ display: "flex", gap: "var(--space-1)" }}>
        <button
          type="button"
          onClick={() => report("lit")}
          style={{
            flex: 1,
            minHeight: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            borderRadius: "var(--radius-button)",
            border: "none",
            background: "var(--night-800)",
            color: "var(--lamp-500)",
          }}
        >
          <LightBulbIcon width={18} height={18} /> Lit
        </button>
        <button
          type="button"
          onClick={() => report("dark")}
          style={{
            flex: 1,
            minHeight: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            borderRadius: "var(--radius-button)",
            border: "none",
            background: "var(--night-800)",
            color: "var(--mist-400)",
          }}
        >
          <MoonIcon width={18} height={18} /> Dark
        </button>
      </div>
    </div>
  );
}
