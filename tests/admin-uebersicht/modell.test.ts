// ================================================================================================
// ADMIN-01 · DAS MODELL DER VERWALTUNGSÜBERSICHT — DOM-frei gegen die echten Register gemessen.
// ================================================================================================
//
// produkt:20261009:admin-verwaltung-uebersicht.
//   K1  Jede Gruppe erklärt ihren Zweck (DE/EN/NL aufgelöst) und führt zu VORHANDENEN Bedienorten;
//       jedes der sieben Themen und jede statische Detailkarte bleibt von der Übersicht aus
//       erreichbar — gemessen gegen `ADMIN_SECTIONS`/`ADMIN_DETAILS`, nicht gegen eine Abschrift.
//   K2  Jeder Zähler hat einen Weg in eine gefilterte Liste, und Zähler und Liste wählen mit
//       DERSELBEN Regel aus (`offeneLuecken`, `wartendeKonten`).
//   „Funktionen ohne Umsetzung nicht als benutzbar anbieten": Kommunikation führt keinen Weg.
import { describe, expect, it } from "vitest";
import { ALL_ITEMS } from "../../apps/web/src/app/navigation";
import { isAdminDetailId } from "../../apps/web/src/app/navigationGliederung";
import i18n from "../../apps/web/src/i18n";
import { ADMIN_DETAILS, ADMIN_SECTIONS, adminHref } from "../../apps/web/src/lib/adminSections";
import {
  AUFGABEN,
  VERWALTUNG_GRUPPEN,
  aufgabeHref,
  kiZugangsLage,
  nurOffeneLuecken,
  nurWartendeKonten,
  offeneLuecken,
  verwaltungsZielHref,
  verwaltungsZielLabelKey,
  wartendeKonten,
  zielKennung,
} from "../../apps/web/src/lib/adminUebersicht";
import { aiAccessRows } from "../../apps/web/src/lib/aiOverview";

const verwaltungsziele = VERWALTUNG_GRUPPEN.flatMap((g) =>
  g.ziele.flatMap((z) => (z.art === "verwaltung" ? [z] : [])),
);

describe("ADMIN-01 · K1 · die sieben Gruppen erklären sich und führen zum Bestand", () => {
  it("genau die sieben fachlichen Gruppen des Auftrags, in seiner Reihenfolge", () => {
    expect(VERWALTUNG_GRUPPEN.map((g) => g.id)).toEqual([
      "menschen",
      "spaces",
      "qualitaet",
      "ki",
      "kommunikation",
      "berichte",
      "betrieb",
    ]);
  });

  it("jede Gruppe trägt Namen und Zweck in DE, EN und NL — kein roher Schlüssel", async () => {
    for (const sprache of ["de", "en", "nl"] as const) {
      await i18n.changeLanguage(sprache);
      for (const g of VERWALTUNG_GRUPPEN) {
        for (const key of [g.labelKey, g.zweckKey]) {
          const text = i18n.t(key);
          expect(text, `${sprache}: ${key} ist nicht aufgelöst`).not.toBe(key);
          expect(text.trim().length, `${sprache}: ${key} ist leer`).toBeGreaterThan(0);
        }
      }
    }
    await i18n.changeLanguage("de");
  });

  it("jedes der sieben Themen und jede statische Detailkarte ist von der Übersicht aus erreichbar", () => {
    const themen = new Set(verwaltungsziele.map((z) => z.section));
    const fehlendeThemen = ADMIN_SECTIONS.map((s) => s.id).filter((id) => !themen.has(id));
    expect(fehlendeThemen, "Thema ohne Weg aus der Übersicht").toEqual([]);

    const details = new Set(verwaltungsziele.flatMap((z) => (z.detail ? [z.detail] : [])));
    const fehlendeDetails = ADMIN_DETAILS.map((d) => d.id).filter((id) => !details.has(id));
    expect(fehlendeDetails, "Detailkarte ohne Weg aus der Übersicht").toEqual([]);
  });

  it("jeder Verwaltungsweg ist eine erlaubte, vorhandene Adresse mit aufgelöstem Namen", async () => {
    await i18n.changeLanguage("de");
    for (const z of verwaltungsziele) {
      if (z.detail !== undefined) {
        expect(isAdminDetailId(z.detail), `${z.detail} ist keine erlaubte Detailkennung`).toBe(
          true,
        );
        const wohnort = ADMIN_DETAILS.find((d) => d.id === z.detail)?.section;
        expect(wohnort, `${z.detail} steht unter dem falschen Thema`).toBe(z.section);
      }
      expect(verwaltungsZielHref(z)).toBe(adminHref(z.section, z.detail));
      const key = verwaltungsZielLabelKey(z);
      expect(i18n.t(key), `${key} ist nicht aufgelöst`).not.toBe(key);
    }
  });

  it("jeder App-Bereich ist ein vorhandener Menüeintrag; Spaces ist die vorhandene Route", () => {
    for (const g of VERWALTUNG_GRUPPEN) {
      for (const z of g.ziele) {
        if (z.art === "bereich") {
          expect(
            ALL_ITEMS.some((i) => i.id === z.navId),
            `${z.navId} gibt es nicht`,
          ).toBe(true);
        }
        if (z.art === "pfad") {
          expect(z.pfad).toBe("/spaces");
        }
      }
    }
  });

  it("die Kennungen der Wege sind eindeutig (sie sind die Anker der Fläche)", () => {
    const kennungen = VERWALTUNG_GRUPPEN.flatMap((g) => g.ziele.map(zielKennung));
    expect(new Set(kennungen).size).toBe(kennungen.length);
    expect(kennungen).toContain("uebergabe");
    expect(kennungen).toContain("konten");
  });

  it("Kommunikation bietet nichts als benutzbar an — die Gruppe hat keinen Weg", () => {
    const kommunikation = VERWALTUNG_GRUPPEN.find((g) => g.id === "kommunikation");
    expect(kommunikation?.ziele).toEqual([]);
  });

  it("die Beitragsübergabe führt in die Kontenliste, aus der die Kontokarte mit der Übergabe aufgeht", () => {
    const uebergabe = verwaltungsziele.find((z) => zielKennung(z) === "uebergabe");
    expect(uebergabe && verwaltungsZielHref(uebergabe)).toBe(adminHref("konten"));
  });
});

describe("ADMIN-01 · K2 · jeder Zähler hat seine gefilterte Liste — mit derselben Auswahlregel", () => {
  it("vier Aufgaben an vorhandenen Quellen: Prüfungen, Lücken, Freigaben, KI-Verbindungen", () => {
    expect(AUFGABEN).toEqual(["pruefungen", "luecken", "freigaben", "kiZugaenge"]);
    expect(aufgabeHref("pruefungen")).toBe("/validierung");
    expect(aufgabeHref("luecken")).toBe("/risiko?luecken=offen");
    expect(aufgabeHref("freigaben")).toBe("/admin?bereich=konten&filter=wartet");
    expect(aufgabeHref("kiZugaenge")).toBe(adminHref("ki", "kiZugaenge"));
  });

  it("der Filter der Adresse wird von der Liste gelesen — und nur genau dieser Wert", () => {
    const parameter = (href: string): URLSearchParams =>
      new URLSearchParams(href.slice(href.indexOf("?") + 1));
    expect(nurOffeneLuecken(parameter(aufgabeHref("luecken")))).toBe(true);
    expect(nurWartendeKonten(parameter(aufgabeHref("freigaben")))).toBe(true);
    expect(nurOffeneLuecken(new URLSearchParams("luecken=alle"))).toBe(false);
    expect(nurWartendeKonten(new URLSearchParams("filter=irgendwas"))).toBe(false);
    expect(nurWartendeKonten(new URLSearchParams(""))).toBe(false);
  });

  // Nacharbeit 3 (Bens Befund): ohne eingerichtetes Modell stand „1 von 4" — der Ersatzmodus
  // wurde als KI-Zugang gezählt. Gemessen an DEN Zeilen, die auch die Karte „KI-Zugänge" zeigt.
  it("KI-Zugänge: ohne Modell kein aktiver Zugang — der Ersatzmodus steht getrennt", () => {
    const ohneModell = aiAccessRows({
      configured: false,
      cloudConfigured: false,
      provider: "deterministic",
      mode: "fallback",
      localConfigured: false,
    });
    expect(ohneModell.find((z) => z.id === "fallback")?.state).toBe("active");
    expect(kiZugangsLage(ohneModell)).toEqual({ aktiv: 0, gesamt: 3, ersatzAktiv: true });

    const mitModell = aiAccessRows({
      configured: true,
      cloudConfigured: true,
      provider: "anthropic:claude-test",
      model: "anthropic:claude-test",
      mode: "model",
      localConfigured: false,
    });
    expect(kiZugangsLage(mitModell)).toEqual({ aktiv: 1, gesamt: 3, ersatzAktiv: false });
  });

  it("offene Lücken und wartende Konten: dieselbe Menge für Zähler und Liste", () => {
    const luecken = [
      { id: "g1", status: "offen" },
      { id: "g2", status: "geschlossen" },
      { id: "g3", status: "offen" },
    ];
    expect(offeneLuecken(luecken).map((g) => g.id)).toEqual(["g1", "g3"]);
    const konten = [
      { id: "u1", approved: true },
      { id: "u2", approved: false },
    ];
    expect(wartendeKonten(konten).map((u) => u.id)).toEqual(["u2"]);
    // Leere Bestände ergeben leere Mengen — die Fläche sagt dann „0" nur nach einer Antwort.
    expect(offeneLuecken([])).toEqual([]);
    expect(wartendeKonten([])).toEqual([]);
  });
});
