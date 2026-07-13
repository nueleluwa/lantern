"use client";

import { useState } from "react";
import { LightBulbIcon, MoonIcon } from "@heroicons/react/24/solid";
import { enqueueTag, drainTagQueue } from "@/lib/tag-queue";
import { getCurrentTimeOfDay } from "@/lib/time-of-day";

// MVP_SCOPE.md Phase 2 / PRD.md P1: "'Lit tonight' real-time lighting
// status distinct from static lighting infrastructure." Uses tags.kind =
// 'lit_tonight' (1-day half-life in src/lib/scoring.ts — DATA_MODEL.md:
// "'Lit tonight' tags use a short half-life ... they expire by
// morning"), so this only nudges the score transiently, unlike a
// standard or infrastructure report.
export function LitTonightQuickAction({ segmentId }: { segmentId: string }) {
  const [sent, setSent] = useState<"lit" | "dark" | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);

  async function report(status: "lit" | "dark") {
    const timeOfDay = getCurrentTimeOfDay();

    const entry = enqueueTag(segmentId, {
      timeOfDay,
      lighting: status,
      safetyFeeling: status === "lit" ? "safe" : "avoid",
      kind: "lit_tonight",
    });
    const { succeeded } = await drainTagQueue();
    // Check this specific entry's outcome rather than assuming success —
    // audit-project review found the previous version claimed success
    // unconditionally even when the submission was actually still
    // offline-queued (worse here than the full tag form, since "lit
    // tonight" reports have a 1-day half-life and silently queuing
    // without telling the user matters more).
    setQueuedOffline(!succeeded.includes(entry.localId));
    setSent(status);
  }

  if (sent) {
    return (
      <p style={{ fontSize: "var(--text-label)", color: "var(--mist-400)" }}>
        {queuedOffline
          ? `Saved — will submit when you're back online.`
          : `Thanks — reported ${sent} right now.`}
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
