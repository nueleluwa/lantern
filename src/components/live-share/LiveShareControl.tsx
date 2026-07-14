"use client";

import { useEffect, useRef, useState } from "react";
import { getOrCreateDeviceId } from "@/lib/device-id";

// Phase 3 (MVP_SCOPE.md): "Live share / walk-with-me companion mode."
// Explicit opt-in per tap (DO_NOT.md's opt-in bar for anything location-
// related), ends when the walker taps stop or the session hard-expires
// server-side (src/lib/live-share.ts) — never runs silently in the
// background.
const UPDATE_INTERVAL_MS = 15_000;

export function LiveShareControl() {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPositionRef = useRef<{ lng: number; lat: number } | null>(null);
  // A ref, not state — the unmount cleanup's stop() closure would
  // otherwise only ever see the value from the initial render (null),
  // so the server-side session was never explicitly ended on
  // navigate-away mid-share. Found by audit-project review.
  const sessionIdRef = useRef<string | null>(null);
  // Separate from the share link on purpose — only this device holds
  // it, and only it can update/end the session (audit-project review:
  // previously the share link itself doubled as the credential, so
  // anyone who obtained it could overwrite the walker's position or end
  // the session, not just view it).
  const ownerTokenRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    if (!("geolocation" in navigator)) return;

    const res = await fetch("/api/live-share", {
      method: "POST",
      headers: { "X-Device-Id": getOrCreateDeviceId() },
    });
    const { id, ownerToken } = await res.json();
    sessionIdRef.current = id;
    ownerTokenRef.current = ownerToken;
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
        headers: { "Content-Type": "application/json", "X-Owner-Token": ownerToken },
        body: JSON.stringify(lastPositionRef.current),
      });
    }, UPDATE_INTERVAL_MS);
  }

  async function stop() {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (sessionIdRef.current && ownerTokenRef.current) {
      await fetch(`/api/live-share/${sessionIdRef.current}`, {
        method: "DELETE",
        headers: { "X-Owner-Token": ownerTokenRef.current },
      });
    }
    sessionIdRef.current = null;
    ownerTokenRef.current = null;
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
            height: "var(--button-height-primary)",
            borderRadius: "var(--radius-button)",
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
        height: "var(--button-height-primary)",
        padding: "0 var(--space-2)",
        borderRadius: "var(--radius-button)",
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
