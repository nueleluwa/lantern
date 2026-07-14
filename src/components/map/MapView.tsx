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

    // Aborts the previous in-flight request on each new call — audit-
    // project review found rapid pan/zoom could let an older, slower
    // response's setSegments() run after a newer one, showing a stale
    // viewport's segments.
    let controller: AbortController | null = null;

    const fetchForCurrentView = async () => {
      controller?.abort();
      controller = new AbortController();

      const bounds = map.getBounds();
      const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ].join(",");

      try {
        const res = await fetch(
          `/api/segments?bbox=${bbox}&time_of_day=${timeOfDay}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        setSegments(await res.json());
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        throw err;
      }
    };

    fetchForCurrentView();
    map.on("moveend", fetchForCurrentView);
    return () => {
      controller?.abort();
      map.off("moveend", fetchForCurrentView);
    };
  }, [map, timeOfDay]);

  // PRD.md Flow A step 3: "Tap a segment -> see tag breakdown..."
  //
  // Queries rendered features at click/move time rather than binding
  // per-layer listeners (map.on('click', layerId, cb)) — those only
  // attach successfully if the layer already exists at attach time, but
  // SegmentLayer creates the layers asynchronously from this same
  // segments data. Binding per-layer meant this effect had to depend on
  // `segments` just to retry attachment once the layers appeared, which
  // also re-attached listeners on every viewport refetch. A plain
  // map-level handler that queries whichever layers currently exist
  // works regardless of load order and only needs [map, mode].
  useEffect(() => {
    if (!map) return;

    const layerIds = ["segments-safe", "segments-caution", "segments-avoid", "segments-unrated"];
    const existingLayerIds = () => layerIds.filter((id) => map.getLayer(id));

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (mode === "routing") return; // routing mode uses its own map-level click handler below
      const layers = existingLayerIds();
      if (layers.length === 0) return;
      const feature = map.queryRenderedFeatures(e.point, { layers })[0];
      const id = feature?.properties?.id;
      if (id) setSelectedSegmentId(id);
    };

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      const layers = existingLayerIds();
      const hovering = layers.length > 0 && map.queryRenderedFeatures(e.point, { layers }).length > 0;
      map.getCanvas().style.cursor = hovering ? "pointer" : "";
    };

    map.on("click", handleClick);
    map.on("mousemove", handleMouseMove);

    return () => {
      map.off("click", handleClick);
      map.off("mousemove", handleMouseMove);
    };
  }, [map, mode]);

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
