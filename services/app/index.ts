// Öffentliche API der App-Komposition.
export { buildApp, buildServices, buildPgServices } from "./src/build-app";
export type { AppServices } from "./src/build-app";
export { createPool, migrate } from "./src/db";
// MODULGRENZE-20260815: Die Obergrenze des Entwurfs-Bodys ist Teil des Vertrags, den andere
// Module gegen die App pruefen duerfen. Sie stand nur in `src/routes/capture-routes.ts`, und
// `services/capture/src/service.test.ts` griff deshalb an der oeffentlichen API vorbei —
// zwei `module-boundaries`-Verstoesse, die das Gate erst zeigte, als der Lint davor gruen war.
export { DRAFTS_BODY_LIMIT } from "./src/routes/capture-routes";
