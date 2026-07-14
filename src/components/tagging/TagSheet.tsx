"use client";

import { useEffect, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { TagForm } from "./TagForm";
import { LitTonightQuickAction } from "./LitTonightQuickAction";
import { ShareButton } from "./ShareButton";
import { FlagButton } from "../moderation/FlagButton";

type SegmentDetail = {
  segment: {
    id: string;
    name: string | null;
    neighborhood: string | null;
    dayScore: string;
    nightScore: string;
    tagCount: number;
    lastTaggedAt: string | null;
  };
  breakdown: { safe: number; caution: number; avoid: number };
  recentTags: {
    id: string;
    createdAt: string;
    timeOfDay: string;
    lighting: string;
    safetyFeeling: string;
    category: string | null;
    note: string | null;
    kind: string;
  }[];
};

const BAND_LABEL: Record<string, string> = {
  lit_safe: "LIT & SAFE",
  caution: "CAUTION",
  avoid: "AVOID",
  unrated: "NOT ENOUGH REPORTS YET",
};

const BAND_COLOR: Record<string, string> = {
  lit_safe: "var(--safe-500)",
  caution: "var(--caution-500)",
  avoid: "var(--avoid-500)",
  unrated: "var(--mist-400)",
};

// PRD.md Flow A step 3 + DESIGN_SYSTEM.md "Bottom sheet (segment
// detail)": slides up from tap, night-800 surface, rounded top corners,
// drag handle. Never a bare number — band + icon + label together
// (DESIGN_SYSTEM.md do-not list).
export function TagSheet({
  segmentId,
  timeOfDay,
  onClose,
}: {
  segmentId: string;
  timeOfDay: "day" | "night";
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<SegmentDetail | null>(null);
  const [showForm, setShowForm] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // audit-project review: tapping segment A then quickly segment B
    // before A's fetch resolves could let A's response land after B's
    // and overwrite `detail` with the wrong segment's data.
    let cancelled = false;
    setDetail(null);
    fetch(`/api/segments/${segmentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setDetail(data);
      });
    return () => {
      cancelled = true;
    };
  }, [segmentId]);

  // role="dialog" without any actual modal behavior isn't accessible —
  // audit-project review found no focus moved on open, no focus trap,
  // and no Escape-to-close anywhere in the codebase.
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;

    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const band = detail
    ? timeOfDay === "day"
      ? detail.segment.dayScore
      : detail.segment.nightScore
    : null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Street segment detail"
      onKeyDown={handleKeyDown}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: "70dvh",
        overflowY: "auto",
        background: "var(--night-800)",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: "var(--space-2)",
        paddingBottom: "var(--space-4)",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 40,
          height: 4,
          borderRadius: 2,
          background: "var(--mist-400)",
          margin: "0 auto var(--space-2)",
        }}
      />

      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Close street detail"
        style={{
          position: "absolute",
          top: "var(--space-2)",
          right: "var(--space-2)",
          width: 48,
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          border: "none",
          background: "var(--night-950)",
          color: "var(--mist-100)",
        }}
      >
        <XMarkIcon width={20} height={20} />
      </button>

      {!detail && <p>Loading…</p>}

      {detail && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-display)",
                color: BAND_COLOR[band ?? "unrated"],
              }}
            >
              {BAND_LABEL[band ?? "unrated"]}
            </h2>
            <ShareButton
              segmentId={segmentId}
              segmentName={detail.segment.name}
              band={band ?? "unrated"}
            />
          </div>
          <p style={{ color: "var(--mist-100)", fontSize: "var(--text-body)" }}>
            {detail.segment.name ?? "Unnamed street"}
          </p>
          <p
            style={{
              fontFamily: "var(--font-data)",
              fontSize: "var(--text-data)",
              color: "var(--mist-400)",
            }}
          >
            {detail.segment.tagCount} tags
            {detail.segment.lastTaggedAt &&
              ` · last ${formatRelative(detail.segment.lastTaggedAt)}`}
          </p>

          {detail.segment.tagCount === 0 && (
            <p style={{ marginTop: "var(--space-2)" }}>
              No reports yet — be the first to tag this street.
            </p>
          )}

          <div style={{ marginTop: "var(--space-2)" }}>
            <LitTonightQuickAction segmentId={segmentId} />
          </div>

          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              style={{
                marginTop: "var(--space-2)",
                width: "100%",
                height: "var(--button-height-primary)",
                borderRadius: "var(--radius-button)",
                border: "none",
                background: "var(--lamp-500)",
                color: "var(--night-950)",
                fontSize: "var(--text-body-lg)",
                fontWeight: 500,
              }}
            >
              Tag this street
            </button>
          )}

          {showForm && (
            <div style={{ marginTop: "var(--space-2)" }}>
              <TagForm segmentId={segmentId} onSubmitted={() => setShowForm(false)} />
            </div>
          )}

          {detail.recentTags.length > 0 && (
            <div style={{ marginTop: "var(--space-3)" }}>
              <h3 style={{ fontSize: "var(--text-label)", marginBottom: "var(--space-1)" }}>
                Recent reports
              </h3>
              {detail.recentTags.map((tag) => (
                <div
                  key={tag.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "var(--space-1) 0",
                    borderBottom: "1px solid var(--night-950)",
                  }}
                >
                  <div>
                    <p style={{ fontSize: "var(--text-body)" }}>
                      {tag.lighting} · {tag.safetyFeeling}
                      {tag.category ? ` · ${tag.category.replace(/_/g, " ")}` : ""}
                    </p>
                    {tag.note && (
                      <p style={{ fontSize: "var(--text-label)", color: "var(--mist-400)" }}>
                        {tag.note}
                      </p>
                    )}
                    <p
                      style={{
                        fontFamily: "var(--font-data)",
                        fontSize: "var(--text-data)",
                        color: "var(--mist-400)",
                      }}
                    >
                      {formatRelative(tag.createdAt)}
                    </p>
                  </div>
                  <FlagButton tagId={tag.id} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
