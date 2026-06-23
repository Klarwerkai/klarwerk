// Öffentliche API der App-Komposition.
export { buildApp, buildServices, buildPgServices } from "./src/build-app";
export type { AppServices } from "./src/build-app";
export { createPool, migrate } from "./src/db";
