import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { Role } from "../../auth";
import type { AddonCapability, AddonPrincipal } from "./addon-principal";
import type { BremsGrenze } from "./anfragebremse";
import type { SessionUser } from "./http";

// ================================================================================================
// Aufnahme gesamt-integrations-api (R-0677 / R-0688 / R-0704 / R-0698) — DIENST-SCHLÜSSEL.
// ================================================================================================
//
// Angebundene Systeme melden sich mit einem EIGENEN Schlüssel an, nicht mit einem Menschenkonto.
// Jeder Schlüssel hat
//   · eine Kennung (`id`) — sie steht im Protokoll als Akteur `dienst:<id>` und ist der Zähler der
//     eigenen Zugriffsbremse,
//   · eigene Rechte (`rechte`) — je Recht genau die Route(n) aus `DIENST_ROUTEN`, sonst 403,
//   · eine eigene Grenze (`max` Aufrufe je `fensterSek`) — darüber 429 mit Wartezeit.
//
// WECHSELBAR: ein Eintrag nimmt mehrere Prüfsummen (`sha256` als Liste). Für einen Wechsel wird
// die Prüfsumme des neuen Schlüssels NEBEN die alte gestellt, das angebundene System umgestellt und
// danach die alte entfernt — Kennung, Rechte, Bremse und Protokollspur bleiben dabei dieselben. Ein
// Schlüssel wird gesperrt, indem seine Prüfsumme (oder der ganze Eintrag) entfällt.
//
// GEHEIMNISSCHUTZ: in der Konfiguration steht NIE der Schlüssel selbst, nur seine SHA-256-
// Prüfsumme. Wer die Umgebung lesen kann, kann sich damit nicht anmelden. Der Schlüssel wird nie
// protokolliert und nie in eine Antwort geschrieben. Verglichen wird in `addon-principal.ts`
// (die einzige Vergleichsstelle für Zugangsschlüssel, gehalten von `addon-principal.test.ts`).
//
// Konfiguration: `KLARWERK_SERVICE_KEYS` als JSON-Liste, z. B.
//   [{"id":"wiki-sync","sha256":["<64 hex>"],"rechte":["export.validated","status.read"],
//     "max":60,"fensterSek":60}]
// Ein fehlerhafter Eintrag wird verworfen (fail-closed) und beim Start gemeldet — ohne Prüfsumme.

/** Eigener Kopf — bewusst nicht `Authorization`, damit er nie als Sitzungstoken gelesen wird. */
export const DIENST_SCHLUESSEL_HEADER = "x-klarwerk-service-key";

export const DIENST_SCHLUESSEL_ENV = "KLARWERK_SERVICE_KEYS";

/** Die Rechte, die ein Dienst-Schlüssel tragen kann — jedes öffnet genau seine Routen. */
export const DIENST_RECHTE = [
  "ask.validated",
  "checktext.validated",
  "export.validated",
  "import.kandidaten",
  "status.read",
  "mcp.werkzeug",
] as const satisfies readonly AddonCapability[];
export type DienstRecht = (typeof DIENST_RECHTE)[number];

export const DIENST_GRENZE_STANDARD: BremsGrenze = { max: 60, fensterMs: 60_000 };

export interface DienstSchluessel {
  readonly id: string;
  /** SHA-256 der gültigen Schlüssel (mehrere während eines Wechsels). */
  readonly pruefsummen: readonly Buffer[];
  readonly rechte: readonly DienstRecht[];
  readonly grenze: BremsGrenze;
}

export interface DienstSchluesselLage {
  readonly schluessel: readonly DienstSchluessel[];
  /** Gründe, aus denen Einträge verworfen wurden — ohne Schlüssel und ohne Prüfsumme. */
  readonly fehler: readonly string[];
}

export const KEINE_DIENST_SCHLUESSEL: DienstSchluesselLage = { schluessel: [], fehler: [] };

// ------------------------------------------------------------------------------------------------
// Die Routen, die ein Dienst-Schlüssel erreichen darf (Deny-by-default). `sitzungsrolle` nennt die
// Rolle, mit der die BESTEHENDE Route den Schlüssel behandelt — die schmalste, die die Route
// öffnet; ihre Rechteprüfung, Sichtbarkeitsregeln und Protokollierung laufen unverändert:
//   · Export als `viewer`: nur validiertes, nicht vertrauliches Wissen (SCRUM-506).
//   · Kandidaten als `experte`: reiht in die Prüfwarteschlange ein, legt KEIN Wissensobjekt an
//     (R-0143); angenommen wird nur durch einen Menschen mit `ko.validate`.
// Fragen und Textprüfung haben ihren eigenen Schlüsselzweig (nur validiertes Wissen, kein Modell).
// Aufnahme gesamt-mcp (R-0713): `/mcp` ist der MCP-Zugang für fremde KI-Programme. Er hat ein
// EIGENES Recht und reicht Werkzeugaufrufe mit demselben Schlüssel an die Route ihres Rechts weiter
// (`routes/mcp-routes.ts`) — ohne `ask.validated` gibt es dort kein Fragewerkzeug.
// ------------------------------------------------------------------------------------------------
export interface DienstRoute {
  readonly methode: "GET" | "POST";
  readonly pfad: string;
  readonly recht: DienstRecht;
  readonly sitzungsrolle?: Role;
}

export const DIENST_ROUTEN: readonly DienstRoute[] = [
  { methode: "POST", pfad: "/api/ask", recht: "ask.validated" },
  { methode: "POST", pfad: "/api/check-text", recht: "checktext.validated" },
  {
    methode: "GET",
    pfad: "/api/library/export",
    recht: "export.validated",
    sitzungsrolle: "viewer",
  },
  {
    methode: "POST",
    pfad: "/api/library/import/candidates",
    recht: "import.kandidaten",
    sitzungsrolle: "experte",
  },
  { methode: "GET", pfad: "/health", recht: "status.read" },
  { methode: "GET", pfad: "/api/reasoner/status", recht: "status.read" },
  { methode: "POST", pfad: "/mcp", recht: "mcp.werkzeug" },
  { methode: "GET", pfad: "/mcp", recht: "mcp.werkzeug" },
];

// Wie `matchAddonRoute`: Methode, kanonischer Fastify-Pfad UND der byte-genaue Rohpfad müssen
// passen — keine enkodierte oder normalisierte Variante erreicht eine Dienst-Route.
export function matchDienstRoute(
  methode: string,
  kanonisch: string | undefined,
  roh: string | undefined,
): DienstRoute | null {
  const rohPfad = (roh ?? "").split("?")[0];
  for (const route of DIENST_ROUTEN) {
    if (methode === route.methode && kanonisch === route.pfad && rohPfad === route.pfad) {
      return route;
    }
  }
  return null;
}

const KENNUNG = /^[a-z0-9][a-z0-9-]{1,47}$/;
const PRUEFSUMME = /^[0-9a-f]{64}$/;

function ganzzahlPositiv(wert: unknown): number | undefined {
  return typeof wert === "number" && Number.isInteger(wert) && wert > 0 ? wert : undefined;
}

/** Liest `KLARWERK_SERVICE_KEYS`. Nicht gesetzt → keine Schlüssel (der Weg bleibt zu). */
export function ladeDienstSchluessel(
  env: Record<string, string | undefined> = process.env,
): DienstSchluesselLage {
  const roh = env[DIENST_SCHLUESSEL_ENV]?.trim();
  if (!roh) {
    return KEINE_DIENST_SCHLUESSEL;
  }
  let liste: unknown;
  try {
    liste = JSON.parse(roh);
  } catch {
    return { schluessel: [], fehler: [`${DIENST_SCHLUESSEL_ENV} ist kein gültiges JSON.`] };
  }
  if (!Array.isArray(liste)) {
    return { schluessel: [], fehler: [`${DIENST_SCHLUESSEL_ENV} muss eine JSON-Liste sein.`] };
  }
  const schluessel: DienstSchluessel[] = [];
  const fehler: string[] = [];
  const vergebeneIds = new Set<string>();
  const vergebeneSummen = new Set<string>();
  for (const [i, eintrag] of (liste as unknown[]).entries()) {
    const e = (eintrag ?? {}) as Record<string, unknown>;
    const id = typeof e.id === "string" ? e.id : "";
    if (!KENNUNG.test(id)) {
      fehler.push(`Eintrag ${i + 1}: Kennung fehlt oder ist ungültig (a-z, 0-9, Bindestrich).`);
      continue;
    }
    if (vergebeneIds.has(id)) {
      fehler.push(`Eintrag ${i + 1} (${id}): Kennung doppelt vergeben.`);
      continue;
    }
    const summenRoh: unknown[] = Array.isArray(e.sha256) ? e.sha256 : [e.sha256];
    const summen = summenRoh.map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""));
    if (summen.length === 0 || summen.some((s) => !PRUEFSUMME.test(s))) {
      fehler.push(`Eintrag ${i + 1} (${id}): sha256 braucht 64 Hexzeichen je Schlüssel.`);
      continue;
    }
    if (summen.some((s) => vergebeneSummen.has(s))) {
      fehler.push(
        `Eintrag ${i + 1} (${id}): derselbe Schlüssel steht schon bei einem anderen Eintrag.`,
      );
      continue;
    }
    const rechteRoh: unknown[] = Array.isArray(e.rechte) ? e.rechte : [];
    const rechte = rechteRoh.filter((r): r is DienstRecht =>
      (DIENST_RECHTE as readonly unknown[]).includes(r),
    );
    if (rechte.length === 0 || rechte.length !== rechteRoh.length) {
      fehler.push(
        `Eintrag ${i + 1} (${id}): rechte braucht mindestens eines aus ${DIENST_RECHTE.join(", ")} und nichts anderes.`,
      );
      continue;
    }
    const max = e.max === undefined ? DIENST_GRENZE_STANDARD.max : ganzzahlPositiv(e.max);
    const fensterSek =
      e.fensterSek === undefined
        ? DIENST_GRENZE_STANDARD.fensterMs / 1000
        : ganzzahlPositiv(e.fensterSek);
    if (max === undefined || fensterSek === undefined) {
      fehler.push(
        `Eintrag ${i + 1} (${id}): max und fensterSek müssen positive ganze Zahlen sein.`,
      );
      continue;
    }
    vergebeneIds.add(id);
    for (const s of summen) {
      vergebeneSummen.add(s);
    }
    schluessel.push({
      id,
      pruefsummen: summen.map((s) => Buffer.from(s, "hex")),
      rechte: [...new Set(rechte)],
      grenze: { max, fensterMs: fensterSek * 1000 },
    });
  }
  return { schluessel, fehler };
}

/** SHA-256 eines angegebenen Schlüssels — der Vergleich selbst steht in `addon-principal.ts`. */
export function pruefsummeVon(angegeben: string): Buffer {
  return createHash("sha256").update(angegeben, "utf8").digest();
}

export function dienstPrincipal(s: DienstSchluessel): AddonPrincipal {
  return {
    kind: "addon",
    id: `dienst:${s.id}`,
    capabilities: s.rechte,
    dienst: { schluessel: s.id, grenze: s.grenze },
  };
}

// Für `makeGuards` (http.ts): ein gültiger Dienst-Schlüssel erscheint an den BESTEHENDEN Routen mit
// `sitzungsrolle` als schmaler Sitzungsnutzer — aber nur auf genau dieser Route und nur mit dem
// passenden Recht. Ohne Spaces-Angabe (`spaceLesbar` fehlt) sieht er kein Objekt mit führendem
// Space (fail-closed, `http.ts`).
export function dienstSitzungsnutzer(request: FastifyRequest): SessionUser | undefined {
  const auth = request.authContext;
  if (auth?.authKind !== "addon" || !auth.principal.dienst) {
    return undefined;
  }
  const route = matchDienstRoute(request.method, request.routeOptions?.url, request.raw.url);
  if (!route?.sitzungsrolle || !auth.principal.capabilities.includes(route.recht)) {
    return undefined;
  }
  return { id: auth.principal.id, role: route.sitzungsrolle };
}
