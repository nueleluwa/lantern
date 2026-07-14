"use client";

import { useState } from "react";
import { SegmentLayer } from "./SegmentLayer";
import { SegmentList } from "./SegmentList";
import { DayNightToggle } from "./DayNightToggle";
import { TagSheet } from "@/components/tagging/TagSheet";
import { RouteSuggestion } from "@/components/routing/RouteSuggestion";
import { RouteLayer } from "@/components/routing/RouteLayer";
import { LiveShareControl } from "@/components/live-share/LiveShareControl";
import { AreaSelector } from "./AreaSelector";
import type { LaunchArea } from "@/config/launch-area";
import { useMapInstance } from "./hooks/useMapInstance";
import { useSegments } from "./hooks/useSegments";
import { useSegmentSelection } from "./hooks/useSegmentSelection";
import { useRoutePicking } from "./hooks/useRoutePicking";
import { useDayNightThemeSync } from "./hooks/useDayNightThemeSync";

type TimeOfDay = "day" | "night";
type Mode = "explore" | "routing";

// A thin composition of map hooks — audit-project review found this
// component owning map lifecycle, day/night sync, segment fetching,
// click/hover wiring, and routing pick-point logic all in one 233-line
// component with six co-located effects. Each concern now lives in its
// own hook under ./hooks.
export function MapView() {
  const { containerRef, map, loading } = useMapInstance();
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("night");
  const [mode, setMode] = useState<Mode>("explore");

  useDayNightThemeSync(timeOfDay);

  const segments = useSegments(map, timeOfDay);
  const { selectedSegmentId, setSelectedSegmentId } = useSegmentSelection(map, mode === "explore");
  const { routeFrom, routeTo, pickFrom, pickTo, cancelPicking } = useRoutePicking(map);
  const [routeGeometry, setRouteGeometry] = useState<GeoJSON.LineString | null>(null);
  const [listOpen, setListOpen] = useState(false);

  return (
    <div style={{ position: "relative", width: "100%", height: "100dvh" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Feedback States: skeleton map, never a blank screen while tiles load. */}
      {loading && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--night-800)",
          }}
        >
          <div className="spinner" />
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: "var(--space-2)",
          right: "var(--space-2)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-1)",
          alignItems: "flex-end",
        }}
      >
        <DayNightToggle value={timeOfDay} onChange={setTimeOfDay} />
        {mode === "explore" && (
          <SegmentList
            open={listOpen}
            onOpenChange={setListOpen}
            segments={segments}
            onSelect={setSelectedSegmentId}
          />
        )}
        <AreaSelector
          onSelect={(area: LaunchArea) => {
            map?.flyTo({ center: area.center, zoom: area.defaultZoom });
          }}
        />
        <button
          type="button"
          className="lantern-btn"
          onClick={() => {
            setMode((m) => (m === "explore" ? "routing" : "explore"));
            setSelectedSegmentId(null);
            cancelPicking();
          }}
          style={{
            height: 40,
            padding: "0 var(--space-2)",
            borderRadius: 8,
            border: "none",
            background: mode === "routing" ? "var(--lamp-500)" : "var(--night-800)",
            color: mode === "routing" ? "var(--night-950)" : "var(--mist-100)",
            fontSize: "var(--text-label)",
          }}
        >
          {mode === "routing" ? "Exit route mode" : "Suggest a route"}
        </button>
      </div>

      <SegmentLayer map={map} data={segments} />
      <RouteLayer map={map} geometry={routeGeometry} />

      {mode === "routing" && (
        <RouteSuggestion
          from={routeFrom}
          to={routeTo}
          timeOfDay={timeOfDay}
          onPickFrom={pickFrom}
          onPickTo={pickTo}
          onResult={setRouteGeometry}
        />
      )}

      {mode === "explore" && selectedSegmentId && (
        <TagSheet
          segmentId={selectedSegmentId}
          timeOfDay={timeOfDay}
          onClose={() => setSelectedSegmentId(null)}
        />
      )}

      {mode === "explore" && !selectedSegmentId && (
        <div style={{ position: "absolute", bottom: "var(--space-2)", left: "var(--space-2)" }}>
          <LiveShareControl />
        </div>
      )}
    </div>
  );
}
