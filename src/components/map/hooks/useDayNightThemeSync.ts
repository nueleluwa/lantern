import { useEffect } from "react";

type TimeOfDay = "day" | "night";

// Syncs the day/night toggle to the document's data-theme attribute,
// which tokens.css and globals.css read for chrome colors.
export function useDayNightThemeSync(timeOfDay: TimeOfDay) {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", timeOfDay === "day" ? "day" : "night");
  }, [timeOfDay]);
}
