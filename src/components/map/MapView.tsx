"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DEFAULT_LAUNCH_AREA } from "@/config/launch-area";
import { PLACEHOLDER_MAP_STYLE_URL } from "@/styles/map-style";
import { SegmentLayer } from "./SegmentLayer";
import { DayNightToggle } from "./DayNightToggle";
import { TagSheet } from "@/components/tagging/TagSheet";
import { RouteSuggestion } from "@/components/routing/RouteSuggestion";
import { RouteLayer } from "@/components/routing/RouteLayer";
import { LiveShareControl } from "@/components/live-share/LiveShareControl";
import { AreaSelector } from "./AreaSelector";
import type { LaunchArea } from "@/config/launch-area";

type TimeOfDay = "day" | "night";
type Mode = "explore" | "routing";
type PickTarget = "from" | "to" | null;

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("night");
  const [segments, setSegments] = useState<GeoJSON.FeatureCollection | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("explore");
  const [picking, setPicking] = useState<PickTarget>(null);
  const [routeFrom, setRouteFrom] = useState<[number, number] | null>(null);
  const [routeTo, setRouteTo] = useState<[number, number] | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<GeoJSON.LineString | null>(null);

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
      if (mode === "routing") return; // routing mode uses its own map-level click handler below
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
  }, [map, segments, mode]);

  // Phase 3 routing mode: a plain map click (not tied to a segment
  // layer) sets the picked start/end point.
  useEffect(() => {
    if (!map || !picking) return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (picking === "from") setRouteFrom(point);
      else setRouteTo(point);
      setPicking(null);
    };

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [map, picking]);

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
        <AreaSelector
          onSelect={(area: LaunchArea) => {
            map?.flyTo({ center: area.center, zoom: area.defaultZoom });
          }}
        />
        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "explore" ? "routing" : "explore"));
            setSelectedSegmentId(null);
            setPicking(null);
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
          onPickFrom={() => setPicking("from")}
          onPickTo={() => setPicking("to")}
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
