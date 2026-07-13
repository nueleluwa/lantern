// PROJECT.md: "Start narrow: one Port Harcourt neighborhood or a university
// campus." MVP_SCOPE.md: "config-driven bounding box, not hardcoded — makes
// expansion trivial later." This is the one place that changes when the
// launch geography changes or a new area is added in Phase 3.

export type LaunchArea = {
  slug: string;
  label: string;
  /** [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number];
  center: [number, number];
  defaultZoom: number;
};

// Placeholder bbox — replace with the real launch neighborhood's bounds
// before seeding OSM ways or going live.
export const LAUNCH_AREAS: LaunchArea[] = [
  {
    slug: "placeholder-phc",
    label: "TODO: name the launch neighborhood",
    bbox: [7.0, 4.75, 7.05, 4.8],
    center: [7.025, 4.775],
    defaultZoom: 15,
  },
];

export const DEFAULT_LAUNCH_AREA = LAUNCH_AREAS[0];
