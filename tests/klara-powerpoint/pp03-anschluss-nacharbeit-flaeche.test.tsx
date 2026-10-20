// @vitest-environment jsdom
// ================================================================================================
// produkt:20261015:klara-powerpoint-validierung (PP-03) · ANSCHLUSS — NACHARBEIT AN DER FLÄCHE.
// ================================================================================================
//
// Gemountet sind die echten Bausteine `DatenLage` und `DatenKontrolle` (`DatenKontrolle.tsx`).
//
//   V1  Setup › Klara „nur Klärungen einzeln“: eine WIEDER GEÖFFNETE Prüfung (früher bestanden, durch
//       eine Kontrolle wieder offen) bleibt einzeln sichtbar; nur noch nie geprüfte offene Prüfungen
//       werden zur einblendbaren Anzahl zusammengefasst (unabhängige Prüfung, Hinweis 8).
//   V2  Klärungsbedarf und überholte Prüfungen tragen eine Farbe, die das Theme wirklich kennt
//       (`text-trust-crit-text`); das frühere `text-danger` hat kein Token und blieb ohne Wirkung.
//   UI-VORPROBE (UI-06, Risiken der UI-Vorbereitung; Vorprobestand, keine Hostabnahme):
//   V3  R12 „Alle zeigen“ ist ein Umschalter mit `aria-expanded`/`aria-controls` und Rückweg.
//   V4  R11 die Setup-Optionen sind nie `disabled`, sondern `aria-disabled`; gesperrt löst keine Wahl aus.
//   V5  R14 eingebettet im Detailbereich: keine eigene Überschrift, benannte Gruppe statt Region.
//   V6  Hell/Dunkel: die PP-03-Flächen setzen nur Theme-Tokens (keine festen Farben), und beide
//       Darstellungen (Klassisch, Modern) definieren die verwendete Warnfarbe; die App erklärt
//       `color-scheme: light` (kein Dunkelthema im Produkt — siehe ERGEBNIS, Entscheidung).
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { assistenzProfilApi } from "../../apps/web/src/api/assistenzProfil";
import {
  DatenKontrolle,
  DatenLage,
  type DatenkontrolleSicht,
  type DatenlageSicht,
} from "../../apps/web/src/components/bibliothek/DatenKontrolle";
import { KlaraDatenkontrolleGruppe } from "../../apps/web/src/components/klara-setup/KlaraSetup";
import i18n from "../../apps/web/src/i18n";
import { verwerfeAssistenzProfil } from "../../apps/web/src/lib/assistenzProfil";
import { repoPfad } from "../support/repoPfad";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LAGE: DatenlageSicht = {
  anzahl: 2,
  jeZustand: { erfasst: 1, in_pruefung: 1, klaerung: 0, validiert: 0, ueberpruefung_noetig: 0 },
  offenePunkte: [
    {
      datenpunktId: "dp-a",
      zustand: "in_pruefung",
      dimension: "konsistenz",
      stand: "offen",
      titel: "Abweichung bei unsicherer Erkennung",
      grund: "Eine später erfasste, unsicher erkannte Gegenangabe weicht ab (fiktiv).",
      naechsteArbeit: "Die unsicher erkannte Angabe am Bild bestätigen oder korrigieren.",
      wiedergeoeffnet: true,
    },
    {
      datenpunktId: "dp-b",
      zustand: "erfasst",
      dimension: "struktur",
      stand: "offen",
      titel: "Struktur offen",
      grund: "Format, Einheit, Zeitraum und Zuordnung sind noch nicht geprüft.",
      naechsteArbeit: "Struktur prüfen.",
    },
  ],
};

const KLAERUNG: DatenkontrolleSicht = {
  datenpunktId: "dp-k",
  datenFassung: 1,
  zustand: "klaerung",
  grund: "Klärungsbedarf (Struktur): Für „12 %“ fehlt der Bezugszeitraum (fiktiv).",
  naechsteArbeit: ["Bezugszeitraum ergänzen (Korrektur am Datenpunkt)."],
  dimensionen: [
    {
      dimension: "struktur",
      stand: "klaerung",
      grund: "Für „12 %“ fehlt der Bezugszeitraum (fiktiv).",
      herkunft: "kontrolle",
      befunde: [],
    },
  ],
  prognose: false,
  gepruefAm: "2026-10-17T09:00:00.000Z",
};

let aufraeumen: (() => void) | null = null;
afterEach(() => {
  aufraeumen?.();
  aufraeumen = null;
});

async function montieren(element: ReturnType<typeof createElement>): Promise<HTMLElement> {
  await i18n.changeLanguage("de");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  aufraeumen = () => {
    act(() => root.unmount());
    container.remove();
  };
  return container;
}

const punkte = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLElement>("[data-offener-punkt]")].map((p) => p.dataset.offenerPunkt);

describe("PP-03 · Anschluss — Nacharbeit an der Fläche", () => {
  it("V1 · nur Klärungen einzeln: wieder geöffnete Prüfung bleibt sichtbar, nie geprüfte wird gezählt", async () => {
    const c = await montieren(createElement(DatenLage, { lage: LAGE, wahl: "nur_klaerung" }));
    expect(punkte(c)).toEqual(["dp-a"]);
    expect(
      c.querySelector("[data-offene-zusammengefasst]")?.getAttribute("data-offene-zusammengefasst"),
    ).toBe("1");
    await act(async () => {
      c.querySelector<HTMLButtonElement>("[data-offene-einblenden]")?.click();
    });
    expect(punkte(c)).toEqual(["dp-a", "dp-b"]);
    const alle = await montieren(createElement(DatenLage, { lage: LAGE }));
    expect(punkte(alle)).toEqual(["dp-a", "dp-b"]);
  });

  it("V2 · Klärungsbedarf in einer Farbe, die das Theme kennt", async () => {
    const c = await montieren(createElement(DatenKontrolle, { kontrolle: KLAERUNG }));
    const zustand = c.querySelector("[data-zustand]");
    expect(zustand?.className).toContain("text-trust-crit-text");
    expect(c.innerHTML).not.toContain("text-danger");
    const theme = readFileSync(repoPfad("apps/web/tailwind.config.ts"), "utf8");
    expect(theme).toContain('"crit-text": token("trust-crit-text")');
    expect(theme).not.toMatch(/\bdanger\b/);
  });

  it("V3 · R12 Umschalter mit aria-expanded und Rückweg", async () => {
    const c = await montieren(createElement(DatenLage, { lage: LAGE, wahl: "nur_klaerung" }));
    const ein = c.querySelector<HTMLButtonElement>("[data-offene-einblenden]");
    expect(ein?.getAttribute("aria-expanded")).toBe("false");
    const liste = ein?.getAttribute("aria-controls") ?? "";
    expect(c.querySelector(`[id="${liste}"]`)?.tagName).toBe("UL");
    await act(async () => {
      ein?.click();
    });
    expect(punkte(c)).toEqual(["dp-a", "dp-b"]);
    const zurueck = c.querySelector<HTMLButtonElement>("[data-offene-zusammenfassen]");
    expect(zurueck?.getAttribute("aria-expanded")).toBe("true");
    expect(zurueck?.getAttribute("aria-controls")).toBe(liste);
    await act(async () => {
      zurueck?.click();
    });
    expect(punkte(c)).toEqual(["dp-a"]);
    expect(c.querySelector("[data-offene-einblenden]")).toBeTruthy();
    // Ohne etwas Zusammenzufassendes kein Umschalter.
    const ohne = await montieren(
      createElement(DatenLage, {
        lage: { ...LAGE, offenePunkte: LAGE.offenePunkte.slice(0, 1) },
        wahl: "nur_klaerung",
      }),
    );
    expect(ohne.querySelector("[data-offene-einblenden], [data-offene-zusammenfassen]")).toBeNull();
  });

  it("V4 · R11 Setup-Optionen aria-disabled statt disabled, gesperrt ohne Wirkung", async () => {
    verwerfeAssistenzProfil();
    const speichern = vi.spyOn(assistenzProfilApi, "speichern");
    const c = await montieren(createElement(KlaraDatenkontrolleGruppe));
    const radios = [...c.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios).toHaveLength(2);
    for (const r of radios) {
      expect(r.disabled).toBe(false);
      expect(r.getAttribute("aria-disabled")).toBe("true");
    }
    await act(async () => {
      radios[1]?.click();
    });
    expect(speichern).not.toHaveBeenCalled();
    expect(radios[0]?.checked).toBe(true);
    speichern.mockRestore();
  });

  it("V5 · R14 eingebettet: keine eigene Überschrift, benannte Gruppe", async () => {
    const c = await montieren(
      createElement(DatenKontrolle, { kontrolle: KLAERUNG, eingebettet: true }),
    );
    const flaeche = c.querySelector("[data-datenkontrolle]");
    expect(flaeche?.tagName).toBe("DIV");
    expect(flaeche?.getAttribute("role")).toBe("group");
    expect(flaeche?.getAttribute("aria-label")).toBe("Prüfstand und Kontrollen");
    expect(c.querySelector("h6")).toBeNull();
    const allein = await montieren(createElement(DatenKontrolle, { kontrolle: KLAERUNG }));
    expect(allein.querySelector("section[data-datenkontrolle] h6")?.textContent).toBe(
      "Prüfstand und Kontrollen",
    );
  });

  it("V6 · Hell/Dunkel: nur Theme-Tokens; beide Darstellungen kennen die Warnfarbe", () => {
    const quelle = readFileSync(
      repoPfad("apps/web/src/components/bibliothek/DatenKontrolle.tsx"),
      "utf8",
    );
    const setup = readFileSync(
      repoPfad("apps/web/src/components/klara-setup/KlaraSetup.tsx"),
      "utf8",
    );
    const gruppe = setup.slice(
      setup.indexOf("export function KlaraDatenkontrolleGruppe"),
      setup.indexOf("// Sprachausgabe (E08)"),
    );
    for (const text of [quelle, gruppe]) {
      expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text).not.toMatch(/\b(bg|text|border)-(white|black)\b/);
      expect(text).not.toMatch(/\b(bg|text|border)-(red|green|blue|gray|slate|zinc)-\d/);
    }
    const themes = readFileSync(repoPfad("apps/web/src/styles/themes.css"), "utf8");
    expect(themes.match(/--kw-trust-crit-text:/g)?.length).toBeGreaterThanOrEqual(2);
    const html = readFileSync(repoPfad("apps/web/index.html"), "utf8");
    expect(html).toContain('<meta name="color-scheme" content="light" />');
  });
});
