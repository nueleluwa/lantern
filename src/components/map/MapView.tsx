"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DEFAULT_LAUNCH_AREA } from "@/config/launch-area";
import { PLACEHOLDER_MAP_STYLE_URL } from "@/styles/map-style";
import { SegmentLayer } from "./SegmentLayer";
import { DayNightToggle } from "./DayNightToggle";
import { TagSheet } from "@/components/tagging/TagSheet";

type TimeOfDay = "day" | "night";

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("night");
  const [segments, setSegments] = useState<GeoJSON.FeatureCollection | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: PLACEHOLDER_MAP_STYLE_URL,
      center: DEFAULT_LAUNCH_AREA.center,
      zoom: DEFAULT_LAUNCH_AREA.defaultZoom,
      // DESIGN_SYSTEM.md: never disable pinch-zoom.
      touchZoomRotate: true,
    });

    instance.on("load", () => setLoading(false));
    setMap(instance);

    return () => instance.remove();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      timeOfDay === "day" ? "day" : "night"
    );
  }, [timeOfDay]);

  useEffect(() => {
    if (!map) return;

    const fetchForCurrentView = async () => {
      const bounds = map.getBounds();
      const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ].join(",");

      const res = await fetch(
        `/api/segments?bbox=${bbox}&time_of_day=${timeOfDay}`
      );
      if (!res.ok) return;
      setSegments(await res.json());
    };

    fetchForCurrentView();
    map.on("moveend", fetchForCurrentView);
    return () => {
      map.off("moveend", fetchForCurrentView);
    };
  }, [map, timeOfDay]);

  // PRD.md Flow A step 3: "Tap a segment -> see tag breakdown..."
  useEffect(() => {
    if (!map) return;

    const layerIds = ["segments-safe", "segments-caution", "segments-avoid", "segments-unrated"];

    const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const id = feature?.properties?.id;
      if (id) setSelectedSegmentId(id);
    };

    const setPointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const unsetPointer = () => {
      map.getCanvas().style.cursor = "";
    };

    const attach = () => {
      for (const layerId of layerIds) {
        if (!map.getLayer(layerId)) continue;
        map.on("click", layerId, handleClick);
        map.on("mouseenter", layerId, setPointer);
        map.on("mouseleave", layerId, unsetPointer);
      }
    };

    if (map.isStyleLoaded()) attach();
    else map.once("load", attach);

    return () => {
      for (const layerId of layerIds) {
        map.off("click", layerId, handleClick);
        map.off("mouseenter", layerId, setPointer);
        map.off("mouseleave", layerId, unsetPointer);
      }
    };
  }, [map, segments]);

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
        }}
      >
        <DayNightToggle value={timeOfDay} onChange={setTimeOfDay} />
      </div>

      <SegmentLayer map={map} data={segments} />

      {selectedSegmentId && (
        <TagSheet
          segmentId={selectedSegmentId}
          timeOfDay={timeOfDay}
          onClose={() => setSelectedSegmentId(null)}
        />
      )}
    </div>
  );
}
