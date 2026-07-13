"use client";

import { useEffect, useRef, useState } from "react";

// Phase 3 (MVP_SCOPE.md): "Live share / walk-with-me companion mode."
// Explicit opt-in per tap (DO_NOT.md's opt-in bar for anything location-
// related), ends when the walker taps stop or the session hard-expires
// server-side (src/lib/live-share.ts) — never runs silently in the
// background.
const UPDATE_INTERVAL_MS = 15_000;

export function LiveShareControl() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPositionRef = useRef<{ lng: number; lat: number } | null>(null);

  useEffect(() => {
    return () => {
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    if (!("geolocation" in navigator)) return;

    const res = await fetch("/api/live-share", { method: "POST" });
    const { id } = await res.json();
    setSessionId(id);
    setShareUrl(`${window.location.origin}/share/${id}`);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastPositionRef.current = { lng: pos.coords.longitude, lat: pos.coords.latitude };
      },
      undefined,
      { enableHighAccuracy: true }
    );

    intervalRef.current = setInterval(async () => {
      if (!lastPositionRef.current) return;
      await fetch(`/api/live-share/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lastPositionRef.current),
      });
    }, UPDATE_INTERVAL_MS);
  }

  async function stop() {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (sessionId) await fetch(`/api/live-share/${sessionId}`, { method: "DELETE" });
    setSessionId(null);
    setShareUrl(null);
  }

  if (shareUrl) {
    return (
      <div
        style={{
          background: "var(--night-800)",
          borderRadius: 12,
          padding: "var(--space-2)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-1)",
        }}
      >
        <p style={{ fontSize: "var(--text-label)", color: "var(--mist-100)" }}>
          Sharing your live location. Send this link to someone you trust:
        </p>
        <code
          style={{
            fontFamily: "var(--font-data)",
            fontSize: "var(--text-data)",
            wordBreak: "break-all",
            color: "var(--lamp-300)",
          }}
        >
          {shareUrl}
        </code>
        <button
          type="button"
          onClick={stop}
          style={{
            height: 48,
            borderRadius: 8,
            border: "none",
            background: "var(--avoid-500)",
            color: "var(--mist-100)",
          }}
        >
          Stop sharing — I&apos;m safe
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      style={{
        height: 48,
        padding: "0 var(--space-2)",
        borderRadius: 8,
        border: "none",
        background: "var(--night-800)",
        color: "var(--mist-100)",
        fontSize: "var(--text-label)",
      }}
    >
      Share my walk live
    </button>
  );
}
