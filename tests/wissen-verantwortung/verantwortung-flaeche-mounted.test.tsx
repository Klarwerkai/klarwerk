// @vitest-environment jsdom
// ================================================================================================
// R-0507 / R-0546 — VERANTWORTUNG UND BEARBEITUNG AN DER ECHTEN OBJEKTFLÄCHE (`MehrAbschnitte`).
// ================================================================================================
//
// Vorrichtung und Netzdoppel sind die von JOB 4213 (`tests/wiki-nachvollziehen`): echte Fläche,
// echter QueryClient, nur das Netz ist ein Doppel. Angemeldet ist dort „u1" (Eva).
//
// R-0507: im Abschnitt „Provenienz" steht, wer verantwortlich ist, wer geprüft und wer freigegeben
//         hat — und der benannte Eigentümer selbst sieht „Verantwortung zurückgeben".
// R-0546: der Name an einer Fassung der Historie steht als „bearbeitet von …" da, und ein Satz sagt,
//         dass Bearbeiternamen keine Verantwortung aussagen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("../wiki-nachvollziehen/netz")).endpointsDoppel(),
);
vi.mock("../../apps/web/src/api/auth", async () =>
  (await import("../wiki-nachvollziehen/netz")).authDoppel(),
);

import type { HistoryEntry } from "../../apps/web/src/api/types";
import {
  HISTORIE,
  abbauen,
  ausloesen,
  flaecheMit,
  historienVermerk,
  i18n,
  text,
} from "../wiki-nachvollziehen/flaeche";
import { netz, zuruecksetzen } from "../wiki-nachvollziehen/netz";

const PROVENIENZ = "provenienz";

const feld = (name: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-ko-verantwortung-${name}]`);

function knopfMit(beschriftung: string): HTMLButtonElement | null {
  const bereich = document.querySelector("[data-ko-verantwortung]");
  return (
    [...(bereich?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find(
      (b) => text(b) === beschriftung,
    ) ?? null
  );
}

const rueckgabeKnopf = (): HTMLButtonElement | null =>
  knopfMit(i18n.t("verantwortung.zurueckgeben"));

beforeEach(() => {
  zuruecksetzen();
});

afterEach(() => {
  abbauen();
});

describe("R-0507 · wer verantwortlich ist, wer geprüft und wer freigegeben hat", () => {
  it("V1 · benannte Eigentümerin, Prüfer und Freigebende stehen da — die Eigentümerin gibt zurück", async () => {
    await flaecheMit(PROVENIENZ, {
      ownership: { owner: "u1", reviewers: ["u1"], validators: [] },
    });
    expect(text(feld("eigentuemer"))).toBe("Eva");
    expect(text(feld("geprueft"))).toBe("Eva");
    expect(text(feld("freigegeben"))).toBe(i18n.t("verantwortung.niemand"));
    expect(text(feld("hinweis"))).toBe(i18n.t("verantwortung.bearbeiterHinweis"));

    const knopf = rueckgabeKnopf();
    expect(knopf, "die Eigentümerin sieht den Rückgabeweg nicht").not.toBeNull();
    await ausloesen(knopf as HTMLButtonElement);
    expect(netz.aufrufe).toContainEqual({ action: "ownership-release" });
  });

  it("V2 · wer nicht Eigentümer ist, bekommt den Rückgabeweg nicht angeboten", async () => {
    await flaecheMit(PROVENIENZ, {
      ownership: { owner: "u2", reviewers: [], validators: ["u1"] },
    });
    // Eine andere Person ist benannt — weder Eva noch der „nicht benannt"-Satz.
    expect(text(feld("eigentuemer"))).not.toBe("Eva");
    expect(text(feld("eigentuemer"))).not.toBe(i18n.t("verantwortung.eigentuemerFehlt"));
    expect(text(feld("freigegeben"))).toBe("Eva");
    expect(rueckgabeKnopf()).toBeNull();
  });

  it("V3 · ohne benannte Verantwortung wird der Autor NICHT als Eigentümer ausgegeben", async () => {
    await flaecheMit(PROVENIENZ, {});
    expect(text(feld("eigentuemer"))).toBe(i18n.t("verantwortung.eigentuemerFehlt"));
    expect(rueckgabeKnopf()).toBeNull();
  });

  it("V5 · die freigabeberechtigte Eigentümerin gibt ein offenes Objekt frei — getrennt von der Rückgabe", async () => {
    // Angemeldet ist u1 als Admin (Freigaberecht); das Objekt ist offen.
    await flaecheMit(PROVENIENZ, {
      status: "offen",
      ownership: { owner: "u1", reviewers: [], validators: [] },
    });
    const freigabe = knopfMit(i18n.t("verantwortung.freigeben"));
    expect(freigabe, "die Eigentümerin sieht den Freigabeweg nicht").not.toBeNull();
    expect(rueckgabeKnopf(), "die Rückgabe bleibt daneben erhalten").not.toBeNull();
    await ausloesen(freigabe as HTMLButtonElement);
    expect(netz.aufrufe).toEqual([{ action: "owner-validate" }]);
  });

  it("V6 · ohne Freigaberecht oder bei bereits freigegebenem Objekt kein Freigabeknopf", async () => {
    netz.rolle = "experte";
    await flaecheMit(PROVENIENZ, {
      status: "offen",
      ownership: { owner: "u1", reviewers: [], validators: [] },
    });
    expect(knopfMit(i18n.t("verantwortung.freigeben"))).toBeNull();
    expect(rueckgabeKnopf()).not.toBeNull();
    abbauen();
    netz.rolle = "admin";
    await flaecheMit(PROVENIENZ, {
      status: "validiert",
      ownership: { owner: "u1", reviewers: [], validators: [] },
    });
    expect(knopfMit(i18n.t("verantwortung.freigeben"))).toBeNull();
  });

  it("V4 · auf Englisch und Niederländisch steht die eigene Sprache da", async () => {
    try {
      await flaecheMit(PROVENIENZ, {}, "en");
      expect(text(document.querySelector("[data-ko-verantwortung]"))).toContain("Responsible");
      abbauen();
      await flaecheMit(PROVENIENZ, {}, "nl");
      expect(text(document.querySelector("[data-ko-verantwortung]"))).toContain("Verantwoordelijk");
    } finally {
      await i18n.changeLanguage("de");
    }
  });
});

describe("R-0546 · ein früherer Bearbeiter hat bearbeitet — mehr sagt sein Name nicht", () => {
  const HISTORIE_ZWEI = [
    { version: 1, at: "2026-08-01T10:00:00.000Z", author: "u1", note: "erstellt" },
    { version: 2, at: "2026-08-02T10:00:00.000Z", author: "u1", note: "überarbeitet" },
    { version: 3, at: "2026-08-03T10:00:00.000Z", author: "", note: "überarbeitet" },
  ] as unknown as HistoryEntry[];

  it("H1 · jede Fassung nennt ihren Bearbeiter als „bearbeitet von …“, neben dem Vermerk", async () => {
    await flaecheMit(HISTORIE, { history: HISTORIE_ZWEI });
    const zwei = text(historienVermerk(2));
    expect(zwei).toContain(i18n.t("ko.historyNote.revised"));
    expect(zwei).toContain(i18n.t("verantwortung.bearbeitetVon", { name: "Eva" }));
    // Ohne Bearbeiter steht keiner da — kein „bearbeitet von" mit leerem Namen.
    expect(text(historienVermerk(3))).not.toContain(
      i18n.t("verantwortung.bearbeitetVon", { name: "" }).trim(),
    );
  });
});
