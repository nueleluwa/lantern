"use client";

import { ListBulletIcon, XMarkIcon } from "@heroicons/react/24/solid";

const BAND_LABEL: Record<string, string> = {
  lit_safe: "Lit & safe",
  caution: "Caution",
  avoid: "Avoid",
  unrated: "Not enough reports",
};

const BAND_COLOR: Record<string, string> = {
  lit_safe: "var(--safe-500)",
  caution: "var(--caution-500)",
  avoid: "var(--avoid-500)",
  unrated: "var(--mist-400)",
};

// audit-project review (critical, frontend): segment selection was a
// MapLibre canvas click with zero keyboard/screen-reader path — canvas
// isn't in the accessibility tree at all, so a keyboard-only or
// switch-control user had no way to reach the core tagging flow (PRD.md
// Flow A). This is a real, focusable DOM list covering the same
// segments currently in view, offering an equivalent path to TagSheet.
export function SegmentList({
  open,
  onOpenChange,
  segments,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segments: GeoJSON.FeatureCollection | null;
  onSelect: (segmentId: string) => void;
}) {
  const features = segments?.features ?? [];

  return (
    <>
      <button
        type="button"
        className="lantern-btn"
        onClick={() => onOpenChange(true)}
        aria-label="Browse streets in view as a list"
        style={{
          height: 48,
          padding: "0 var(--space-2)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderRadius: 8,
          border: "none",
          background: "var(--night-800)",
          color: "var(--mist-100)",
          fontSize: "var(--text-label)",
        }}
      >
        <ListBulletIcon width={18} height={18} />
        Browse streets
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Streets in view"
          onKeyDown={(e) => {
            if (e.key === "Escape") onOpenChange(false);
          }}
          style={{
            // fixed, not absolute — this component's trigger button sits
            // inside MapView's absolutely-positioned control cluster, so
            // an "absolute" dialog would size itself to that small
            // container instead of covering the viewport.
            position: "fixed",
            inset: 0,
            background: "var(--night-950)",
            overflowY: "auto",
            padding: "var(--space-2)",
            zIndex: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-2)",
            }}
          >
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-display)" }}>
              Streets in view
            </h2>
            <button
              type="button"
              className="lantern-btn"
              onClick={() => onOpenChange(false)}
              aria-label="Close street list"
              autoFocus
              style={{
                width: 48,
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                border: "none",
                background: "var(--night-800)",
                color: "var(--mist-100)",
              }}
            >
              <XMarkIcon width={20} height={20} />
            </button>
          </div>

          {features.length === 0 && <p>No streets loaded in this view yet.</p>}

          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            {features.map((feature) => {
              const props = feature.properties ?? {};
              const segmentBand = props.band ?? "unrated";
              return (
                <li key={props.id}>
                  <button
                    type="button"
                    className="lantern-btn"
                    onClick={() => {
                      onSelect(props.id);
                      onOpenChange(false);
                    }}
                    style={{
                      width: "100%",
                      minHeight: 56,
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      gap: 2,
                      padding: "var(--space-1) var(--space-2)",
                      borderRadius: "var(--radius-button)",
                      border: "none",
                      background: "var(--night-800)",
                      color: "var(--mist-100)",
                    }}
                  >
                    <span>{props.name ?? "Unnamed street"}</span>
                    <span
                      style={{
                        fontSize: "var(--text-label)",
                        color: BAND_COLOR[segmentBand],
                      }}
                    >
                      {BAND_LABEL[segmentBand]}
                      {props.tagCount ? ` · ${props.tagCount} tags` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
