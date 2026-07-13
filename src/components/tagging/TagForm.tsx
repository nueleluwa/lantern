"use client";

import { useState } from "react";
import {
  LightBulbIcon,
  MoonIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/solid";
import { enqueueTag, drainTagQueue } from "@/lib/tag-queue";
import { getCurrentTimeOfDay } from "@/lib/time-of-day";

type Lighting = "lit" | "dim" | "dark";
type SafetyFeeling = "safe" | "caution" | "avoid";
type Category =
  | "harassment"
  | "no_sidewalk"
  | "flooding"
  | "animals"
  | "no_transport_available"
  | "other";

const LIGHTING_OPTIONS: { value: Lighting; label: string; icon: typeof LightBulbIcon }[] = [
  { value: "lit", label: "Lit", icon: LightBulbIcon },
  { value: "dim", label: "Dim", icon: MoonIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
];

const SAFETY_OPTIONS: { value: SafetyFeeling; label: string; icon: typeof ShieldCheckIcon }[] = [
  { value: "safe", label: "Safe", icon: ShieldCheckIcon },
  { value: "caution", label: "Caution", icon: ExclamationTriangleIcon },
  { value: "avoid", label: "Avoid", icon: NoSymbolIcon },
];

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "harassment", label: "Harassment" },
  { value: "no_sidewalk", label: "No sidewalk" },
  { value: "flooding", label: "Flooding" },
  { value: "animals", label: "Stray animals" },
  { value: "no_transport_available", label: "No okada/transport" },
  { value: "other", label: "Other" },
];

type SubmitState = "idle" | "submitting" | "queued-offline" | "success" | "error";

// Flow B (PRD.md): "Select: lighting status -> safety feeling -> optional
// category chip -> optional note. Submit -> segment recalculates,
// contributor sees immediate visual confirmation."
export function TagForm({
  segmentId,
  onSubmitted,
}: {
  segmentId: string;
  onSubmitted?: () => void;
}) {
  const [lighting, setLighting] = useState<Lighting | null>(null);
  const [safetyFeeling, setSafetyFeeling] = useState<SafetyFeeling | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<SubmitState>("idle");

  const canSubmit = lighting !== null && safetyFeeling !== null && state !== "submitting";

  async function handleSubmit() {
    if (!lighting || !safetyFeeling) return;
    setState("submitting");

    const timeOfDay = getCurrentTimeOfDay();

    const entry = enqueueTag(segmentId, {
      timeOfDay,
      lighting,
      safetyFeeling,
      category,
      note: note.trim() || null,
    });

    // Check this specific entry's outcome, not the whole queue's —
    // audit-project review found the previous version could misattribute
    // an unrelated older queued entry's expiry/success to this
    // submission (e.g. drainTagQueue expiring a stale 24h+ entry from a
    // prior offline session while this submission is still queued, not
    // failed, would have shown a hard error here).
    const { succeeded, expired } = await drainTagQueue();
    if (succeeded.includes(entry.localId)) {
      setState("success");
      onSubmitted?.();
      return;
    }
    if (expired.includes(entry.localId)) {
      setState("error");
      return;
    }
    // Still queued — likely offline. Not an error; DESIGN_SYSTEM.md:
    // never fail silently or block the user.
    setState("queued-offline");
    onSubmitted?.();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <ButtonGroup
        label="How's the lighting?"
        options={LIGHTING_OPTIONS}
        value={lighting}
        onChange={setLighting}
      />
      <ButtonGroup
        label="How does it feel?"
        options={SAFETY_OPTIONS}
        value={safetyFeeling}
        onChange={setSafetyFeeling}
      />

      <div>
        <p style={{ fontSize: "var(--text-label)", marginBottom: "var(--space-1)" }}>
          Anything specific? (optional)
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={category === opt.value}
              onClick={() => setCategory(category === opt.value ? null : opt.value)}
              style={{
                minHeight: 48,
                padding: "0 var(--space-2)",
                borderRadius: 999,
                border: "none",
                background: category === opt.value ? "var(--lamp-500)" : "var(--night-800)",
                color: category === opt.value ? "var(--night-950)" : "var(--mist-100)",
                fontSize: "var(--text-label)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={note}
        maxLength={280}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (max 280 characters)"
        style={{
          minHeight: 64,
          padding: "var(--space-1)",
          borderRadius: 8,
          border: "1px solid var(--mist-400)",
          background: "var(--night-800)",
          color: "var(--mist-100)",
          fontSize: "var(--text-body)",
          fontFamily: "var(--font-body)",
          resize: "vertical",
        }}
      />

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        style={{
          height: "var(--button-height-primary)",
          borderRadius: "var(--radius-button)",
          border: "none",
          background: "var(--lamp-500)",
          color: "var(--night-950)",
          fontSize: "var(--text-body-lg)",
          fontWeight: 500,
          opacity: canSubmit ? 1 : 0.4,
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
      >
        {state === "submitting" ? "Saving…" : "Tag this street"}
      </button>

      {state === "queued-offline" && (
        <p role="status" style={{ color: "var(--mist-400)", fontSize: "var(--text-label)" }}>
          Saved — will submit when you&apos;re back online.
        </p>
      )}
      {state === "success" && (
        <p role="status" style={{ color: "var(--safe-500)", fontSize: "var(--text-label)" }}>
          Tag recorded. Thank you.
        </p>
      )}
      {state === "error" && (
        <p role="alert" style={{ color: "var(--avoid-500)", fontSize: "var(--text-label)" }}>
          Couldn&apos;t submit — check your connection and try again.
        </p>
      )}
    </div>
  );
}

function ButtonGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; icon: typeof LightBulbIcon }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p style={{ fontSize: "var(--text-label)", marginBottom: "var(--space-1)" }}>{label}</p>
      <div role="group" style={{ display: "flex", gap: "var(--space-1)" }}>
        {options.map((opt) => {
          const Icon = opt.icon;
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(opt.value)}
              style={{
                flex: 1,
                minHeight: 56,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                borderRadius: "var(--radius-button)",
                border: "none",
                background: selected ? "var(--lamp-500)" : "var(--night-800)",
                color: selected ? "var(--night-950)" : "var(--mist-100)",
              }}
            >
              <Icon width={20} height={20} />
              <span style={{ fontSize: "var(--text-label)" }}>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
