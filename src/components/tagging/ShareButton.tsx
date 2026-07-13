"use client";

import { ShareIcon } from "@heroicons/react/24/solid";

// MVP_SCOPE.md Phase 2 / PRD.md P1: "Share a segment/screenshot to
// WhatsApp." Uses the Web Share API where available (native share sheet
// on mobile, which includes WhatsApp if installed), falling back to a
// wa.me deep link — no WhatsApp Business API integration needed for a
// single outbound share action.
export function ShareButton({
  segmentId,
  segmentName,
  band,
}: {
  segmentId: string;
  segmentName: string | null;
  band: string;
}) {
  async function share() {
    const url = `${window.location.origin}/?segment=${segmentId}`;
    const bandLabel = band.replace(/_/g, " ");
    const text = `${segmentName ?? "This street"} is reported "${bandLabel}" on Lantern: ${url}`;

    if (navigator.share) {
      await navigator.share({ text, url }).catch(() => {});
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Share this street's report"
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
      <ShareIcon width={18} height={18} />
      <span style={{ fontSize: "var(--text-label)" }}>Share</span>
    </button>
  );
}
