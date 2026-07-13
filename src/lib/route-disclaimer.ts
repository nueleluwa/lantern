// Split out from routing.ts (server-only — imports the Postgres driver)
// so client components can import just this constant without pulling
// server-only code into the browser bundle.
export const ROUTE_DISCLAIMER =
  "This route prefers streets with better community-reported lighting and safety — it is not a guarantee of safety. Always use your own judgment.";
