// ================================================================================================
// Aufnahme `gesamt-erfassung-einstieg` — der Satz im roten Kasten (R-0080, R-1002, R-0101) und der
// Wortlaut der Hilfe (R-1000), ohne Oberfläche.
// ================================================================================================
//
// Die gemountete Gegenprobe am echten Server steht in `blatt-einstieg-mounted.test.tsx`. Hier
// steht die Zuordnung selbst — jede Lage einzeln, in allen drei Sprachen — und die Regel, dass die
// Hilfe nur Knöpfe zitiert, die es auf dem Blatt gibt.
import { describe, expect, it } from "vitest";
import { ApiError } from "../../apps/web/src/api/client";
import i18n from "../../apps/web/src/i18n";
import { FrontDoorSaveTimeoutError } from "../../apps/web/src/lib/captureFrontDoor";
import {
  erfassenFehlerSchluessel,
  erfassenFehlersatz,
} from "../../apps/web/src/lib/erfassenFehlersatz";

const SPRACHEN = ["de", "en", "nl"] as const;

function tIn(sprache: string) {
  return i18n.getFixedT(sprache);
}

describe("Fehlersatz · jede Lage bekommt ihren Satz", () => {
  it("F1 · Formfehler (400, draftPayload.*): übersetzter Satz, kein interner Feldname", () => {
    const fehler = new ApiError(400, "BAD_REQUEST", "draftPayload.title muss Text sein.");
    expect(erfassenFehlerSchluessel(fehler)).toBe("einstieg.fehler.form");
    const saetze = SPRACHEN.map((s) => erfassenFehlersatz(fehler, tIn(s), "rueckfall"));
    for (const satz of saetze) {
      expect(satz).not.toContain("draftPayload");
      expect(satz).not.toBe("einstieg.fehler.form");
    }
    // Drei Sprachen, drei verschiedene Sätze — kein stiller deutscher Rückfall.
    expect(new Set(saetze).size).toBe(3);
  });

  it("F2 · zu gross (413, egal mit welchem Code): „zu lang“, nicht „kaputt“", () => {
    for (const fehler of [
      new ApiError(413, "DRAFT_BODY_TOO_LARGE", "Das Dokument ist zu gross fuer die Uebernahme"),
      new ApiError(413, "Payload Too Large", "Request body is too large"),
    ]) {
      expect(erfassenFehlerSchluessel(fehler)).toBe("einstieg.fehler.zuLang");
      for (const sprache of SPRACHEN) {
        const satz = erfassenFehlersatz(fehler, tIn(sprache), "rueckfall");
        expect(satz).toBe(tIn(sprache)("einstieg.fehler.zuLang"));
        expect(satz).not.toContain("Request body");
      }
    }
  });

  it("F3 · abgelaufene Frist (408 TIMEOUT des Clients, Speicherfrist der Vordertür): übersetzt", () => {
    const client = new ApiError(408, "TIMEOUT", "… wurde clientseitig abgebrochen.");
    const speichern = new FrontDoorSaveTimeoutError();
    for (const fehler of [client, speichern]) {
      expect(erfassenFehlerSchluessel(fehler)).toBe("einstieg.fehler.frist");
      expect(erfassenFehlersatz(fehler, tIn("en"), "x")).toBe(tIn("en")("einstieg.fehler.frist"));
      expect(erfassenFehlersatz(fehler, tIn("en"), "x")).not.toContain("clientseitig");
    }
  });

  it("F4 · Gegenprobe: eine fachliche Servermeldung gewinnt weiter (JOB 2690 F5)", () => {
    const nichtGefunden = new ApiError(404, "DRAFT_NOT_FOUND", "Draft not found.");
    expect(erfassenFehlerSchluessel(nichtGefunden)).toBeNull();
    expect(erfassenFehlersatz(nichtGefunden, tIn("en"), "x")).toBe("Draft not found.");
    // Ein 400 OHNE Formbefund (z. B. Stufenpflicht) ist ebenfalls fachlich und bleibt stehen.
    const fachlich = new ApiError(400, "BAD_REQUEST", "Vertraulichkeitsstufe fehlt.");
    expect(erfassenFehlerSchluessel(fachlich)).toBeNull();
    // 408 ohne den Client-Code wäre eine Auskunft des Servers — sie bleibt.
    expect(erfassenFehlerSchluessel(new ApiError(408, "SERVER_TIMEOUT", "s"))).toBeNull();
    // Kein Fehlerobjekt: der Rückfallsatz.
    expect(erfassenFehlersatz("kaputt", tIn("de"), "Rückfall")).toBe("Rückfall");
  });
});

// ------------------------------------------------------------------------------------------------
// R-1000 — DIE HILFE ZITIERT KEINE KNOPFBESCHRIFTUNG, DIE ES NICHT GIBT
// ------------------------------------------------------------------------------------------------

/** Die Hilfetexte, die Knöpfe oder Wege des Blattes beim Namen nennen. */
const HILFE_MIT_ZITAT = [
  "chelp.wizardSteps.body",
  "chelp.saveDraftHelp.body",
  "chelp.discardHelp.body",
  "fd.whatOnSaveBody",
  "einstieg.knopf.entwurf",
] as const;

/** Die Beschriftungen, die auf dem Blatt wirklich stehen (Werkzeugleiste, Menüs, Knöpfe). */
const BLATT_BESCHRIFTUNGEN = [
  "erfassen.entwurfSichern",
  "erfassen.einreichen",
  "erfassen.werkzeug.diktieren",
  "erfassen.werkzeug.bild",
  "erfassen.werkzeug.datei",
  "erfassen.werkzeug.ki",
  "erfassen.werkzeug.bereich",
  "erfassen.werkzeug.vertraulichkeit",
  "erfassen.werkzeug.mehr",
  "erfassen.mehr.entwuerfe",
  "erfassen.mehr.anhaenge",
  "erfassen.mehr.status",
  "erfassen.mehr.zurueck",
] as const;

/** Alles in „…“, “…”, „…” oder "…" — die Form, in der die Hilfe einen Knopf zitiert. */
function zitate(text: string): string[] {
  return [...text.matchAll(/[„“"]([^„“”"]+)[“”"]/g)].map((m) => m[1] ?? "");
}

function unbekannteZitate(text: string, beschriftungen: ReadonlySet<string>): string[] {
  return zitate(text).filter((z) => !beschriftungen.has(z));
}

describe("R-1000 · die Hilfe nennt nur, was auf dem Blatt steht", () => {
  it("H0 · Kalibrierung: der alte Wortlaut „Prüfen / Einreichen“ wäre ein Befund", () => {
    const t = tIn("de");
    const beschriftungen = new Set(BLATT_BESCHRIFTUNGEN.map((k) => t(k)));
    expect(unbekannteZitate("wenn du „Prüfen / Einreichen“ wählst", beschriftungen)).toEqual([
      "Prüfen / Einreichen",
    ]);
    expect(unbekannteZitate("wenn du „Einreichen“ wählst", beschriftungen)).toEqual([]);
  });

  for (const sprache of SPRACHEN) {
    it(`H1 · ${sprache}: jedes Zitat ist eine vorhandene Beschriftung`, () => {
      const t = tIn(sprache);
      const beschriftungen = new Set(BLATT_BESCHRIFTUNGEN.map((k) => t(k)));
      for (const schluessel of HILFE_MIT_ZITAT) {
        const text = t(schluessel);
        expect(text, `${schluessel} fehlt in ${sprache}`).not.toBe(schluessel);
        expect(unbekannteZitate(text, beschriftungen), `${sprache} · ${schluessel}`).toEqual([]);
      }
    });

    it(`H2 · ${sprache}: keine Schrittleiste und keine Browser-Ablage, die es nicht gibt`, () => {
      const t = tIn(sprache);
      const verboten =
        /Schritt-Leiste|step bar|stappenbalk|lokal in deinem Browser|locally in your browser|lokaal in je browser|anklicken und zurückgehen|steps are clickable/i;
      for (const schluessel of HILFE_MIT_ZITAT) {
        expect(t(schluessel), `${sprache} · ${schluessel}`).not.toMatch(verboten);
      }
    });
  }
});
