"use client";

type TimeOfDay = "day" | "night";

export function DayNightToggle({
  value,
  onChange,
}: {
  value: TimeOfDay;
  onChange: (value: TimeOfDay) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Day or night view"
      style={{
        display: "flex",
        gap: "var(--space-1)",
        padding: "var(--space-1)",
        background: "var(--night-800)",
        borderRadius: "var(--radius-button)",
      }}
    >
      {(["day", "night"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          style={{
            minWidth: 48,
            minHeight: 48,
            borderRadius: "calc(var(--radius-button) - 6px)",
            border: "none",
            background: value === option ? "var(--lamp-500)" : "transparent",
            color: value === option ? "var(--night-950)" : "var(--mist-100)",
            fontFamily: "var(--font-label)",
            fontSize: "var(--text-label)",
            cursor: "pointer",
          }}
        >
          {option === "day" ? "Day" : "Night"}
        </button>
      ))}
    </div>
  );
}
