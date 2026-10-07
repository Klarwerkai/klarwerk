import { describe, expect, it } from "vitest";
import anmeldefehler from "../../apps/web/src/texte/anmeldefehler";
import { MELDUNGEN } from "../../services/auth/src/meldungen";

// ================================================================================================
// R-0531 · DIE WEB-KOPIE DER ANMELDEFEHLER IST ZEICHENGLEICH MIT DEM SERVER-KATALOG.
// ================================================================================================
//
// `apps/web` darf `services/` nicht importieren; die öffentlichen Masken erkennen einen
// eingetroffenen Serversatz deshalb an einer Kopie (`apps/web/src/texte/anmeldefehler.ts`). Erkennen
// heisst: Wortlaut gleich. Läuft eine Formulierung im Katalog weg, erkennt die Maske den Satz nicht
// mehr und zeigt nach einem Sprachwechsel nur noch die allgemeine Erklärung — still. Dieser Test
// macht das laut.

const SPRACHEN = ["de", "en", "nl"] as const;
const PRAEFIX = "anmeldefehler.";
const EIGENER_SATZ = `${PRAEFIX}unbekannt`;

/**
 * Die Katalogschlüssel, die Anmelden, Registrieren, Ersteinrichtung, Passwort vergessen und
 * Zurücksetzen (`services/auth/src/routes.ts`, `/api/auth/*` ohne Anmeldung) senden können.
 */
const OEFFENTLICH_ERREICHBAR = [
  "INVALID_CREDENTIALS",
  "NOT_APPROVED",
  "ACCESS_EXPIRED",
  "WEAK_PASSWORD",
  "EMAIL_TAKEN",
  "RESET_TOKEN_INVALID",
  "INTERNAL",
  "NOT_SIGNED_IN",
  "REGISTRATION_DISABLED",
  "REGISTRATION_RATE_LIMITED",
  "NAME_REQUIRED",
  "EMAIL_REQUIRED",
  "LOGIN_RATE_LIMITED",
  "RESET_RATE_LIMITED",
  "ALREADY_SETUP",
] as const;

describe("R-0531 · Anmeldefehler: Web-Kopie und Server-Katalog", () => {
  it("jeder öffentlich erreichbare Katalogsatz liegt in der Web-Kopie vor", () => {
    for (const schluessel of OEFFENTLICH_ERREICHBAR) {
      expect(Object.keys(anmeldefehler.de), schluessel).toContain(`${PRAEFIX}${schluessel}`);
    }
  });

  it("jede Fassung ist zeichengleich mit `meldungen.ts`", () => {
    for (const voll of Object.keys(anmeldefehler.de)) {
      if (voll === EIGENER_SATZ) {
        continue;
      }
      const schluessel = voll.slice(PRAEFIX.length);
      expect(Object.hasOwn(MELDUNGEN, schluessel), `${schluessel} fehlt im Katalog`).toBe(true);
      const katalog = MELDUNGEN[schluessel as keyof typeof MELDUNGEN];
      for (const l of SPRACHEN) {
        expect(
          (anmeldefehler[l] as Record<string, string>)[voll],
          `${schluessel} [${l}] weicht vom Katalog ab`,
        ).toBe(katalog[l]);
      }
    }
  });

  it("der eigene Satz kommt im Katalog nicht vor — er darf keinen Serversatz verdecken", () => {
    const alle = new Set(
      Object.values(MELDUNGEN).flatMap((fassungen) => SPRACHEN.map((l) => fassungen[l])),
    );
    for (const l of SPRACHEN) {
      expect(alle.has((anmeldefehler[l] as Record<string, string>)[EIGENER_SATZ] ?? "")).toBe(
        false,
      );
    }
  });
});
