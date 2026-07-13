"use client";

import { useEffect, useState } from "react";

type FlagRow = {
  flagId: string;
  reason: string;
  createdAt: string;
  tagId: string;
  tagNote: string | null;
  tagCategory: string | null;
  tagSafetyFeeling: string;
  tagFlaggedCount: number;
  segmentId: string;
  segmentName: string | null;
};

// MVP_SCOPE.md Phase 1: "Basic flagging (submit flag, store it —
// moderator review UI can be a simple admin table, not a polished
// screen yet)". Phase 2 upgrades this to a proper moderator admin UI
// (see /moderation/review for the Phase 2 version).
export default function ModerationQueuePage() {
  const [secret, setSecret] = useState("");
  const [flags, setFlags] = useState<FlagRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("lantern_admin_secret");
    if (stored) setSecret(stored);
  }, []);

  async function loadQueue(currentSecret: string) {
    setError(null);
    const res = await fetch("/api/moderation/queue", {
      headers: { "x-admin-secret": currentSecret },
    });
    if (!res.ok) {
      setError(res.status === 401 ? "Wrong admin secret" : "Failed to load queue");
      setFlags(null);
      return;
    }
    const data = await res.json();
    setFlags(data.flags);
    sessionStorage.setItem("lantern_admin_secret", currentSecret);
  }

  async function resolve(flagId: string, resolution: "upheld" | "dismissed") {
    await fetch(`/api/moderation/flags/${flagId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify({ resolution }),
    });
    loadQueue(secret);
  }

  return (
    <div style={{ padding: "var(--space-3)", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-display)" }}>
        Moderation queue
      </h1>

      <div style={{ display: "flex", gap: "var(--space-1)", margin: "var(--space-2) 0" }}>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Admin secret"
          style={{ flex: 1, height: 48, padding: "0 var(--space-1)" }}
        />
        <button
          type="button"
          onClick={() => loadQueue(secret)}
          style={{
            height: 48,
            padding: "0 var(--space-2)",
            borderRadius: 8,
            border: "none",
            background: "var(--lamp-500)",
            color: "var(--night-950)",
          }}
        >
          Load
        </button>
      </div>

      {error && <p style={{ color: "var(--avoid-500)" }}>{error}</p>}

      {flags && flags.length === 0 && <p>No pending flags.</p>}

      {flags?.map((flag) => (
        <div
          key={flag.flagId}
          style={{
            border: "1px solid var(--mist-400)",
            borderRadius: 8,
            padding: "var(--space-2)",
            marginBottom: "var(--space-1)",
          }}
        >
          <p>
            <strong>{flag.segmentName ?? "Unnamed segment"}</strong> — reason:{" "}
            {flag.reason.replace(/_/g, " ")} — flagged {flag.tagFlaggedCount}x
          </p>
          <p style={{ fontSize: "var(--text-label)", color: "var(--mist-400)" }}>
            Tag: {flag.tagSafetyFeeling}
            {flag.tagCategory ? ` · ${flag.tagCategory}` : ""}
            {flag.tagNote ? ` · "${flag.tagNote}"` : ""}
          </p>
          <div style={{ display: "flex", gap: "var(--space-1)", marginTop: "var(--space-1)" }}>
            <button
              type="button"
              onClick={() => resolve(flag.flagId, "upheld")}
              style={{
                height: 48,
                padding: "0 var(--space-2)",
                borderRadius: 8,
                border: "none",
                background: "var(--avoid-500)",
                color: "var(--mist-100)",
              }}
            >
              Uphold (remove tag)
            </button>
            <button
              type="button"
              onClick={() => resolve(flag.flagId, "dismissed")}
              style={{
                height: 48,
                padding: "0 var(--space-2)",
                borderRadius: 8,
                border: "none",
                background: "var(--night-800)",
                color: "var(--mist-100)",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
