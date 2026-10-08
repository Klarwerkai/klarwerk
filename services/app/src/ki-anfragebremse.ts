import type { FastifyInstance } from "fastify";
import { sprache } from "../../auth";
import { Anfragebremse, type BremsGrenze, bremsSatz } from "./anfragebremse";
import { tokenFromRequest } from "./http";

// ================================================================================================
// Aufnahme gesamt-integrations-api (R-0842) — ZUGRIFFSBREMSE AUCH FÜR ANGEMELDETE NUTZER.
// ================================================================================================
//
// Befund 15 (28.08.): die Bremse griff nur für den Word-Zusatz (Add-on-Schlüssel); eine angemeldete
// Sitzung konnte modellgestützte Anfragen unbegrenzt hintereinander auslösen. Ab hier zählt jede
// angemeldete Person ihre Aufrufe der KI-Routen unten — gemeinsam, je Konto (nicht je Sitzung: ein
// zweites Anmelden öffnet kein zweites Kontingent). Über der Grenze antwortet der Server mit 429,
// `Retry-After` und einem Satz in der Sprache der Anfrage, der die Wartezeit nennt.
//
// NICHT gezählt: anonyme Anfragen (die Route antwortet ohnehin 401), Schlüsselzugänge (Klara-Schlüssel
// und Dienst-Schlüssel haben ihre eigenen Bremsen) und alle Routen, die kein Modell erreichen.

/** Die Routen, deren Aufruf ein Modell (und damit Kosten) auslösen kann — kanonische Fastify-Pfade. */
export const KI_ROUTEN: readonly { readonly methode: "POST"; readonly pfad: string }[] = [
  { methode: "POST", pfad: "/api/ask" },
  { methode: "POST", pfad: "/api/reasoner" },
  { methode: "POST", pfad: "/api/reasoner/describe" },
  { methode: "POST", pfad: "/api/reasoner/enrich" },
  { methode: "POST", pfad: "/api/check-text" },
  { methode: "POST", pfad: "/api/kos/:id/ai-check" },
  { methode: "POST", pfad: "/api/help/explain" },
  { methode: "POST", pfad: "/api/media/analyze" },
];

export const KI_GRENZE_STANDARD: BremsGrenze = { max: 30, fensterMs: 60_000 };

export const KI_ANFRAGEN_GEBREMST = "KI_ANFRAGEN_GEBREMST";

function ganzzahlPositiv(roh: string | undefined): number | undefined {
  const n = Number(roh);
  return roh !== undefined && Number.isInteger(n) && n > 0 ? n : undefined;
}

/**
 * `KLARWERK_KI_ANFRAGEN_MAX` (Aufrufe je Fenster, Standard 30) und `KLARWERK_KI_ANFRAGEN_FENSTER_SEK`
 * (Standard 60). `KLARWERK_KI_ANFRAGEN_MAX=aus` schaltet die Bremse bewusst ab → `null`. Ein
 * unlesbarer Wert fällt auf den Standard zurück — nie auf „unbegrenzt".
 */
export function kiGrenzeAusEnv(
  env: Record<string, string | undefined> = process.env,
): BremsGrenze | null {
  if (env.KLARWERK_KI_ANFRAGEN_MAX?.trim().toLowerCase() === "aus") {
    return null;
  }
  const max = ganzzahlPositiv(env.KLARWERK_KI_ANFRAGEN_MAX) ?? KI_GRENZE_STANDARD.max;
  const fensterSek =
    ganzzahlPositiv(env.KLARWERK_KI_ANFRAGEN_FENSTER_SEK) ?? KI_GRENZE_STANDARD.fensterMs / 1000;
  return { max, fensterMs: fensterSek * 1000 };
}

export function istKiRoute(methode: string, kanonisch: string | undefined): boolean {
  return KI_ROUTEN.some((r) => r.methode === methode && r.pfad === kanonisch);
}

export interface KiAnfragebremseDeps {
  authenticate(token: string): Promise<{ id: string } | undefined>;
  grenze: BremsGrenze | null;
  jetzt?: () => number;
}

export function registriereKiAnfragebremse(app: FastifyInstance, deps: KiAnfragebremseDeps): void {
  const grenze = deps.grenze;
  if (grenze === null) {
    return;
  }
  const bremse = new Anfragebremse();
  const jetzt = deps.jetzt ?? (() => Date.now());
  app.addHook("onRequest", async (request, reply) => {
    if (!istKiRoute(request.method, request.routeOptions?.url)) {
      return;
    }
    if (request.authContext?.authKind === "addon") {
      return;
    }
    const token = tokenFromRequest(request);
    const nutzer = token ? await deps.authenticate(token) : undefined;
    if (!nutzer) {
      return;
    }
    const urteil = bremse.zaehle(`nutzer:${nutzer.id}`, grenze, jetzt());
    if (urteil.erlaubt) {
      return;
    }
    reply
      .code(429)
      .header("retry-after", String(urteil.wartenSek))
      .send({
        error: KI_ANFRAGEN_GEBREMST,
        message: bremsSatz("ki", sprache(request), urteil.wartenSek),
        wartenSek: urteil.wartenSek,
      });
    return reply;
  });
}
