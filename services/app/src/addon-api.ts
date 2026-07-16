import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Guards, SessionUser } from "./http";

// SCRUM-Klara (Add-on-API): EIN Flag schaltet den GESAMTEN Add-in-Pfad (CORS + schmaler Token-Zugang
// für /api/ask). Default AUS = exakt heutiges Verhalten (kein CORS-Header, kein Token-Pfad). Erst
// KLARWERK_ADDON_API=1|true aktiviert ihn — bewusst konservativ, damit Bestand/12.08.-Pfad unberührt bleibt.
export function addonApiEnabled(): boolean {
  const flag = process.env.KLARWERK_ADDON_API;
  return flag === "1" || flag === "true";
}

// Der einzige Pfad, für den der Add-on-Pfad CORS öffnet — nichts sonst.
export const ADDON_ASK_PATH = "/api/ask";

// Validiert die konfigurierte Add-in-Origin als ECHTE URL-Origin (ben-Review SCRUM-490, P2). Fail-closed:
// "*", leer, mit Pfad/Query/Fragment oder syntaktisch ungültig → null. null bedeutet: KEIN CORS registrieren,
// nichts durchreichen. Nicht gesetzt (undefined) → konservativer, valider HTTPS-Dev-Default.
export function resolveAddonOrigin(): string | null {
  const raw = process.env.KLARWERK_ADDON_ORIGIN;
  const value = raw === undefined ? "https://localhost:3000" : raw.trim();
  // Explizit leer oder Wildcard (auch teil-Wildcard wie https://*.x) → fail-closed.
  if (value === "" || value.includes("*")) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  // Nur http/https, und der Wert MUSS exakt die Origin sein (kein Pfad, kein Trailing-Slash, keine Query).
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  if (url.origin !== value) {
    return null;
  }
  return url.origin;
}

// Eigener Header — bewusst NICHT Authorization/Cookie, damit der Key nie als Session-Token (tokenFromRequest)
// auf anderen Routen interpretiert werden kann. Der Key wird ausschließlich hier, für /api/ask, geprüft.
export const ADDON_KEY_HEADER = "x-klarwerk-addon-key";

// Synthetischer Actor des Add-in-Pfads — reine Audit-Kennung, kein realer Nutzer, keine PII.
const ADDON_ACTOR_ID = "addon:klara";

// Konstantzeit-Vergleich gegen den konfigurierten Key. Ohne gesetzten Env-Key ist der Pfad ZU (false),
// auch bei aktivem Flag. Der Key wird nie geloggt und nie in eine Antwort geschrieben.
function validAddonKey(provided: string): boolean {
  const expected = process.env.KLARWERK_ADDON_API_KEY;
  if (!expected) {
    return false;
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

// SCRUM-490 (D3, Rate-Limit): stabile Keying-Kennung für die Drossel. Liefert für einen gültig
// addon-authentifizierten Request den synthetischen Actor (ADDON_ACTOR_ID), sonst null. REIN lesend
// — kein 401, keine Nebenwirkung (die eigentliche Auth macht weiter resolveAskUser). Flag AUS → immer
// null (kein Add-on-Pfad). Der Key wird hier nur konstantzeit-verglichen, nie geloggt/zurückgegeben.
export function addonActorForRequest(request: FastifyRequest): string | null {
  if (!addonApiEnabled()) {
    return null;
  }
  const provided = request.headers[ADDON_KEY_HEADER];
  if (typeof provided === "string" && provided.length > 0 && validAddonKey(provided)) {
    return ADDON_ACTOR_ID;
  }
  return null;
}

// Auth-Auflösung NUR für /api/ask:
//  - Flag AUS  → unverändert der Session-Guard (Bestandsverhalten).
//  - Flag AN + gültiger Add-in-Key → synthetischer „viewer" (RBAC viewer = EXAKT nur ko.read).
//  - Flag AN + vorhandener, aber ungültiger Key → 401 (kein Fallback auf Session mit falschem Key).
//  - Flag AN, aber KEIN Add-in-Key im Header → Session-Guard (Browser-App unverändert).
// Der Add-in-Pfad gewährt damit nie mehr als ko.read und greift nirgends außer hier.
export async function resolveAskUser(
  request: FastifyRequest,
  reply: FastifyReply,
  guards: Guards,
): Promise<SessionUser | undefined> {
  if (addonApiEnabled()) {
    const provided = request.headers[ADDON_KEY_HEADER];
    if (typeof provided === "string" && provided.length > 0) {
      if (validAddonKey(provided)) {
        return { id: ADDON_ACTOR_ID, role: "viewer" };
      }
      reply.code(401).send({ error: "UNAUTHENTICATED", message: "Ungültiger Add-in-Zugang." });
      return undefined;
    }
  }
  return guards.requirePermission("ko.read", request, reply);
}
