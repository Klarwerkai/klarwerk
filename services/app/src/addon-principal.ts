import { timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import {
  ADDON_ASK_PATH,
  ADDON_CHECK_TEXT_PATH,
  ADDON_KEY_HEADER,
  addonApiEnabled,
} from "./addon-api";

// SCRUM-490 D2 / SCRUM-491 Slice 5: dedizierter Add-on-Principal. KEIN User, KEIN Viewer, KEIN
// generisches ko.read — nur schmale, GETRENNTE Capabilities (ask.validated, checktext.validated).
// Jede autorisiert GENAU ihren Endpunkt (POST /api/ask bzw. POST /api/check-text), und dort nur
// validated-only (keine unvalidierten Inhalte). Der Principal ersetzt den synthetischen ko.read-Viewer
// aus 48f24e2 vollständig.
//
// Mandantenmodell (ben-Review): Klarwerk ist pro Kunde SINGLE-TENANT — ein Deployment = ein Mandant,
// die Instanz-/Datengrenze IST die Mandantengrenze. Es gibt daher bewusst KEINE per-Request-
// Tenant-Bindung und keine tenant-basierte Retrieval-Filterung. Multi-Tenant (mit erzwungener
// Isolation) ist v2/SSO. Es bleibt bewusst kein tenant-Feld am Principal, das eine Grenze suggeriert,
// die nicht erzwungen wird.

// Stabile Bucket-/Audit-ID des Add-on-Pfads (bleibt die Rate-Limit-Bucket-ID). Reine Kennung, kein
// realer Nutzer, keine PII.
export const ADDON_ACTOR_ID = "addon:klara";

// Die schmalen Capabilities des Add-on-Principals. Least-Privilege: GETRENNTE Rechte je Endpunkt,
// KEINE breite Sammel-Capability. SCRUM-491 Slice 5 ergänzt checktext.validated neben ask.validated.
export const ASK_CAPABILITY = "ask.validated" as const;
export const CHECKTEXT_CAPABILITY = "checktext.validated" as const;
export type AddonCapability = typeof ASK_CAPABILITY | typeof CHECKTEXT_CAPABILITY;

// Rückwärtskompatibler Alias (SCRUM-490): früher trug der Principal genau diese eine Capability.
export const ADDON_CAPABILITY = ASK_CAPABILITY;

// Die Capabilities, die der HEUTE per Key aufgelöste Principal trägt: EIN Key bedient beide Endpunkte
// (ein Tenant), also beide Rechte. Die Enge liegt pro Route (jede verlangt GENAU ihr Recht), nicht am
// Key — ein künftiger, schmaler ausgestellter Principal (nur eines der Rechte) erreicht den jeweils
// anderen Endpunkt nicht.
export const ADDON_CAPABILITIES: readonly AddonCapability[] = [
  ASK_CAPABILITY,
  CHECKTEXT_CAPABILITY,
];

export interface AddonPrincipal {
  readonly kind: "addon";
  readonly id: string; // ADDON_ACTOR_ID — stabile Bucket-/Audit-ID
  readonly capabilities: readonly AddonCapability[];
}

// Trägt der Principal genau dieses schmale Recht? Fail-closed gegen unbekannte/fehlende Capabilities.
export function principalHasCapability(principal: AddonPrincipal, cap: AddonCapability): boolean {
  return principal.capabilities.includes(cap);
}

// Defense-in-Depth (ben-Review): der jeweilige Handler autorisiert zusätzlich zum Hook nur einen
// Principal mit GENAU dem Recht seines Endpunkts. Benannte Helfer für Lesbarkeit am Aufrufort.
export function authorizesAsk(principal: AddonPrincipal): boolean {
  return principalHasCapability(principal, ASK_CAPABILITY);
}
export function authorizesCheckText(principal: AddonPrincipal): boolean {
  return principalHasCapability(principal, CHECKTEXT_CAPABILITY);
}

// Byte-genaue Roh-Pfad-Prüfung (ben-Review): der Teil vor "?" MUSS exakt der erwartete Pfad sein — kein
// Prozent-Enkodieren (/api/%61sk), kein Dot-Segment (/%2e%2e/api/ask), kein Trailing-Slash, keine
// Groß-/Kleinschreibungs-Variante. Ergänzt den kanonischen routeOptions.url-Check, den Fastify nach
// Normalisierung matcht. Node liefert req.url (request.raw.url) un-normalisiert → dieser Check greift
// in Produktion. (Hinweis: light-my-request/inject löst Dot-Segmente vorab auf, daher wird diese
// Funktion byte-genau unit-getestet statt nur über inject.)
export function isLiteralPath(rawUrl: string | undefined, path: string): boolean {
  return (rawUrl ?? "").split("?")[0] === path;
}
// Bestehende Ask-Variante (byte-genau getestet) — delegiert an isLiteralPath.
export function isLiteralAskPath(rawUrl: string | undefined): boolean {
  return isLiteralPath(rawUrl, ADDON_ASK_PATH);
}

// SCRUM-491 Slice 5 (D2-Erweiterung): die EINZIGEN Routen, die ein Add-on-Principal erreichen darf.
// Deny-by-default — was hier nicht steht, ist für den Add-on-Key 403. Jede Route ist an GENAU ein
// schmales Recht gebunden (Least-Privilege).
export interface AddonRoute {
  readonly method: "POST";
  readonly path: string; // kanonischer routeOptions.url
  readonly capability: AddonCapability;
}
export const ADDON_ROUTES: readonly AddonRoute[] = [
  { method: "POST", path: ADDON_ASK_PATH, capability: ASK_CAPABILITY },
  { method: "POST", path: ADDON_CHECK_TEXT_PATH, capability: CHECKTEXT_CAPABILITY },
];

// Findet die passende Add-on-Route für (Methode, kanonischer Pfad, roher Pfad) — oder null (→ 403).
// ALLE drei müssen passen: method, der Fastify-normalisierte routeOptions.url UND der byte-genaue
// Rohpfad. So matcht keine enkodierte/normalisierte Variante auf einen Add-on-Endpunkt.
export function matchAddonRoute(
  method: string,
  canonicalUrl: string | undefined,
  rawUrl: string | undefined,
): AddonRoute | null {
  for (const route of ADDON_ROUTES) {
    if (
      method === route.method &&
      canonicalUrl === route.path &&
      isLiteralPath(rawUrl, route.path)
    ) {
      return route;
    }
  }
  return null;
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
    principal: { kind: "addon", id: ADDON_ACTOR_ID, capabilities: ADDON_CAPABILITIES },
  };
}
