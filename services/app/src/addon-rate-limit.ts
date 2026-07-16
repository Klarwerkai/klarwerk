import type { FastifyRequest } from "fastify";
import { addonActorForRequest } from "./addon-api";

// SCRUM-490 (D3): wiederverwendbare Drossel-Config für die addon-authentifizierten Endpunkte.
// EINE Bremse, mehrfach genutzt: POST /api/ask (Slice 1) und später /api/check-text (Slice 5, der
// teuerste Endpunkt) ziehen exakt dieselbe Config — kein Duplikat. Die Registrierung des
// @fastify/rate-limit-Plugins passiert flag-gegated in build-app.ts (global:false); diese Config
// wird pro Route unter `config.rateLimit` gehängt und greift nur, wenn das Plugin registriert ist
// (Flag AN). Flag AUS → Plugin nicht registriert → Config inert → heutiges Verhalten.

// Konservative Defaults: 30 Anfragen pro Minute je Add-on-Actor. Der Add-on-Pfad ist LLM-gestützt
// (Reasoner-Aufruf pro Anfrage) und teilt sich EINEN Schlüssel (ein Tenant) → ein knappes, aber im
// normalen Panel-Betrieb ausreichendes Fenster. Beides env-tunebar.
const DEFAULT_MAX = 30;
const DEFAULT_WINDOW_MS = 60_000; // 1 Minute

function rateMax(): number {
  const raw = Number(process.env.KLARWERK_ADDON_RATE_MAX);
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_MAX;
}

function rateWindowMs(): number {
  const raw = Number(process.env.KLARWERK_ADDON_RATE_WINDOW);
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_WINDOW_MS;
}

// Route-Config für @fastify/rate-limit. Kernidee:
//  - allowList exempt-iert JEDEN nicht-addon-Request (v. a. die Session-Requests der Live-App) → die
//    bleiben ungedrosselt. Nur addon-authentifizierte Requests werden gezählt.
//  - keyGenerator keyt auf den STABILEN synthetischen Add-on-Actor, nicht auf die IP (Proxy davor).
//    (Der ip-Zweig ist nur ein defensiver Fallback; für allow-gelistete Requests wird er nie benutzt.)
//  - Überschreitung → 429 + Retry-After (Default-Verhalten des Plugins).
export function addonRateLimit() {
  return {
    max: rateMax(),
    timeWindow: rateWindowMs(),
    keyGenerator: (request: FastifyRequest): string =>
      addonActorForRequest(request) ?? `ip:${request.ip}`,
    allowList: (request: FastifyRequest): boolean => addonActorForRequest(request) === null,
  };
}
