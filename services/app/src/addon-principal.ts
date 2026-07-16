import { timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { ADDON_KEY_HEADER, addonApiEnabled } from "./addon-api";

// SCRUM-490 D2: dedizierter Add-on-Principal. KEIN User, KEIN Viewer, KEIN generisches ko.read —
// genau EINE Capability: ask.validated. Diese autorisiert AUSSCHLIESSLICH POST /api/ask, und dort
// nur validated-only (keine unvalidierten Inhalte). Tenant-gebunden. Der Principal ersetzt den
// synthetischen ko.read-Viewer aus 48f24e2 vollständig.

// Stabile Bucket-/Audit-ID des Add-on-Pfads (bleibt die Rate-Limit-Bucket-ID). Reine Kennung, kein
// realer Nutzer, keine PII.
export const ADDON_ACTOR_ID = "addon:klara";

// Die einzige Capability, die ein Add-on-Principal trägt.
export const ADDON_CAPABILITY = "ask.validated" as const;

export interface AddonPrincipal {
  readonly kind: "addon";
  readonly id: string; // ADDON_ACTOR_ID — stabile Bucket-/Audit-ID
  readonly tenant: string; // tenant-gebunden (Env KLARWERK_ADDON_TENANT, Default "default")
  readonly capability: typeof ADDON_CAPABILITY;
}

// Request-lokaler Auth-Kontext: EINMAL pro Request bestimmt (onRequest-Hook), danach von
// Rate-Limiter, allowList und Handler GELESEN — nie neu validiert. Ersetzt die zuvor dreifache
// Key-Prüfung (keyGenerator/allowList/handler) durch eine einzige Auflösung.
export type AuthContext =
  | { readonly authKind: "addon"; readonly principal: AddonPrincipal }
  | { readonly authKind: "session"; readonly principal: null };

// Ergebnis der EINEN Key-Auflösung pro Request.
export type AddonAuthResolution =
  | { readonly kind: "valid"; readonly principal: AddonPrincipal }
  | { readonly kind: "invalid" } // Key vorhanden, aber falsch → 401 (kein Session-Fallback)
  | { readonly kind: "none" }; // kein Add-on-Versuch → Session-Pfad

// request.authContext am Fastify-Request tragen (Typaugmentation).
declare module "fastify" {
  interface FastifyRequest {
    authContext?: AuthContext | null;
  }
}

function addonTenant(): string {
  const raw = process.env.KLARWERK_ADDON_TENANT;
  const value = raw?.trim();
  return value && value.length > 0 ? value : "default";
}

// Konstantzeit-Vergleich gegen den konfigurierten Key. Ohne gesetzten Env-Key ist der Pfad ZU (false),
// auch bei aktivem Flag. PRIVAT — die einzige Stelle im Code, die den Key prüft. Der Key wird nie
// geloggt und nie in eine Antwort geschrieben.
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

// Die EINE Key-Auflösung pro Request (aufgerufen genau einmal im onRequest-Hook). Flag AUS oder kein
// Header → "none" (Session-Pfad). Header vorhanden + gültig → "valid" + Principal. Header vorhanden,
// aber ungültig → "invalid" (→ 401, kein Fallback auf Session mit falschem Key).
export function resolveAddonAuth(request: FastifyRequest): AddonAuthResolution {
  if (!addonApiEnabled()) {
    return { kind: "none" };
  }
  const provided = request.headers[ADDON_KEY_HEADER];
  if (typeof provided !== "string" || provided.length === 0) {
    return { kind: "none" };
  }
  if (!validAddonKey(provided)) {
    return { kind: "invalid" };
  }
  return {
    kind: "valid",
    principal: {
      kind: "addon",
      id: ADDON_ACTOR_ID,
      tenant: addonTenant(),
      capability: ADDON_CAPABILITY,
    },
  };
}
