"use client";

import { useState } from "react";
import { FlagIcon } from "@heroicons/react/24/solid";

const REASONS = [
  { value: "inaccurate", label: "Inaccurate" },
  { value: "spam", label: "Spam" },
  { value: "hate_or_profiling", label: "Hate or profiling" },
  { value: "duplicate", label: "Duplicate" },
] as const;

// DESIGN_SYSTEM.md: flag is a safety-critical control, never icon-only —
// pairs with a text label and carries an aria-label regardless.
export function FlagButton({ tagId }: { tagId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  async function submitFlag(reason: (typeof REASONS)[number]["value"]) {
    await fetch(`/api/tags/${tagId}/flag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setSent(true);
    setOpen(false);
  }

  if (sent) {
    return (
      <span style={{ fontSize: "var(--text-label)", color: "var(--mist-400)" }}>Flagged</span>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="Flag this report"
        onClick={() => setOpen((v) => !v)}
        style={{
          minWidth: 48,
          minHeight: 48,
          display: "flex",
          alignItems: "center",
          gap: 4,
          borderRadius: "var(--radius-button)",
          border: "none",
          background: "transparent",
          color: "var(--mist-400)",
        }}
      >
        <FlagIcon width={18} height={18} />
        <span style={{ fontSize: "var(--text-label)" }}>Flag</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: "100%",
            background: "var(--night-950)",
            borderRadius: 8,
            padding: "var(--space-1)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            zIndex: 10,
            minWidth: 160,
          }}
        >
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => submitFlag(r.value)}
              style={{
                minHeight: 48,
                textAlign: "left",
                padding: "0 var(--space-1)",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "var(--mist-100)",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
