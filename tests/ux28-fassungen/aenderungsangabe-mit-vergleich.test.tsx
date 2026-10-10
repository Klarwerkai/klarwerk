// @vitest-environment jsdom
// ================================================================================================
// N-0057 (aufnahme:20260922:gesamt-wissen-versionen) — ÄNDERUNGSANGABE VERSTÄNDLICH, MIT VERGLEICH.
// ================================================================================================
//
// Pedis Vorschlag wörtlich: „Geänderte Felder: Aussage und Erste gespeicherte Version schreiben;
// Änderungsdetails direkt mit einer verständlichen Vergleichsaktion verbinden."
//
// Gemessen an der gemounteten Karte (dieselbe Vorrichtung wie der Rest des Ordners):
//   A  die Beschriftungen stehen so da, wie ein Mensch sie liest — Sollwerte als Literal, damit ein
//      Rückfall auf „Ausgangsversion — kein Vorgänger-Diff." rot wird.
//   B  die Vergleichsaktion an der Karte belegt den vorhandenen Vergleich mit Vorgänger und dieser
//      Fassung, zeigt das geänderte Feld Seite an Seite und bringt den Fokus dorthin.
//   C  die erste Fassung bietet keinen Vergleich an — sie hat keinen Vorgänger.
// Die Taste selbst (Enter/Leertaste → click) misst `tastatur-im-browser-chromium.test.tsx`; hier
// wird, wie im ganzen Ordner, über das Klick-Ereignis ausgelöst.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () => (await import("./netz")).endpointsDoppel());
vi.mock("../../apps/web/src/api/auth", async () => (await import("./netz")).authDoppel());

import {
  abbauen,
  abschnitt,
  ausloesen,
  fassungsKnopf,
  flaecheMitFassungen,
  i18n,
  tabFolge,
  text,
} from "./flaeche";
import { fassung, netz } from "./netz";

const AUSSAGE_V1 = "Die Spritzzone wird wöchentlich trocken gereinigt.";
const AUSSAGE_V2 = "Die Spritzzone wird nach jeder Schicht nass gereinigt.";

function karte(version: number): HTMLElement {
  const li = fassungsKnopf(version).closest("li");
  if (!li) {
    throw new Error(`Die Fassung v${version} steht in keiner Karte`);
  }
  return li;
}

/** Das erste Element im Abschnitt, das die Marke trägt — oder `null`. */
function marke(selektor: string): HTMLElement | null {
  return abschnitt()?.querySelector<HTMLElement>(selektor) ?? null;
}

const aenderungszeile = (version: number): HTMLElement | null =>
  marke(`[data-bib-fassung-aenderung="ko-1:${version}"]`);

function vergleichsAktion(version: number): HTMLButtonElement | null {
  const e = marke(`[data-bib-fassung-vergleichen="ko-1:${version}"]`);
  return e instanceof HTMLButtonElement ? e : null;
}

function wahl(welche: "von" | "bis"): HTMLSelectElement {
  const e = marke(`[data-bib-fassung-vergleich="${welche}"]`);
  if (!(e instanceof HTMLSelectElement)) {
    throw new Error(`die Vergleichsauswahl „${welche}" fehlt`);
  }
  return e;
}

const vergleichsFlaeche = (): HTMLElement | null => marke("[data-bib-fassung-vergleich-flaeche]");

async function zweiFassungenMitAussage(): Promise<void> {
  netz.fassungen = [fassung(1, { statement: AUSSAGE_V1 }), fassung(2, { statement: AUSSAGE_V2 })];
  await flaecheMitFassungen();
}

afterEach(() => {
  abbauen();
});

describe("N-0057 · A — die Beschriftung sagt, was sie ist", () => {
  it("die erste Fassung heißt „Erste gespeicherte Version“ — kein „Vorgänger-Diff“ mehr", async () => {
    await zweiFassungenMitAussage();
    expect(text(aenderungszeile(1))).toBe("Erste gespeicherte Version");
    const gelesen = text(karte(1));
    expect(gelesen, "das Fachwort „Diff“ steht weiter an der Karte").not.toContain("Diff");
  });

  it("die geänderte Fassung nennt „Geänderte Felder: Aussage“", async () => {
    await zweiFassungenMitAussage();
    const zeile = text(aenderungszeile(2));
    expect(zeile, `die Zeile lautet „${zeile}"`).toContain("Geänderte Felder: Aussage");
    expect(zeile, "ein unverändertes Feld wird als geändert genannt").not.toContain("Bedingungen");
  });

  it("dieselben Sätze stehen in EN und NL übersetzt da", () => {
    const erste = (lng: string): string => String(i18n.t("fassungsangabe.ersteFassung", { lng }));
    const felder = (lng: string): string =>
      String(i18n.t("fassungsangabe.geaenderteFelder", { lng, felder: "X" }));
    expect(erste("en")).toBe("First saved version");
    expect(erste("nl")).toBe("Eerste opgeslagen versie");
    expect(felder("en")).toBe("Changed fields: X");
    expect(felder("nl")).toBe("Gewijzigde velden: X");
  });
});

describe("N-0057 · B — die Änderungsangabe führt direkt in den Vergleich", () => {
  it("die Aktion ist ein nativer, benannter Knopf in der Tabulator-Reihenfolge", async () => {
    await zweiFassungenMitAussage();
    const aktion = vergleichsAktion(2);
    expect(aktion, "an der geänderten Fassung steht keine Vergleichsaktion").not.toBeNull();
    expect(aktion?.type).toBe("button");
    expect(text(aktion), "die Aktion nennt den Vorgänger nicht").toBe("Mit v1 vergleichen");
    expect(aktion?.getAttribute("aria-label") ?? "").toContain("v2");
    const erreichbar = tabFolge().includes(aktion as HTMLElement);
    expect(erreichbar, "der Tabulator überspringt die Aktion").toBe(true);
  });

  it("auslösen belegt v1/v2, zeigt beide Aussagen und bringt den Fokus dorthin", async () => {
    await zweiFassungenMitAussage();
    // Ausgangslage: nichts gewählt, keine Gegenüberstellung (JOB 4213 A bleibt unberührt).
    expect(wahl("von").value).toBe("");
    expect(wahl("bis").value).toBe("");
    expect(marke('[data-bib-fassung-vergleich-feld="statement"]')).toBeNull();

    await ausloesen(vergleichsAktion(2) as HTMLButtonElement);

    expect(wahl("von").value, "die ältere Fassung ist nicht der Vorgänger").toBe("1");
    expect(wahl("bis").value, "die jüngere Fassung ist nicht die Fassung der Karte").toBe("2");
    expect(marke('[data-bib-fassung-vergleich-feld="statement"]')).not.toBeNull();
    expect(text(marke('[data-bib-vergleich-alt="statement"]'))).toContain(AUSSAGE_V1);
    expect(text(marke('[data-bib-vergleich-neu="statement"]'))).toContain(AUSSAGE_V2);
    expect(
      document.activeElement,
      "der Fokus bleibt an der Karte — wer mit der Tastatur liest, findet den Vergleich nicht",
    ).toBe(vergleichsFlaeche());
  });

  it("die Vergleichsfläche wird dadurch KEIN zusätzlicher Tabulator-Halt", async () => {
    await zweiFassungenMitAussage();
    expect(tabFolge().includes(vergleichsFlaeche() as HTMLElement)).toBe(false);
  });
});

describe("N-0057 · C — die erste Fassung bietet keinen Vergleich an", () => {
  it("ohne Vorgänger keine Vergleichsaktion", async () => {
    await zweiFassungenMitAussage();
    expect(vergleichsAktion(1)).toBeNull();
  });

  it("ohne geänderte Hauptfelder bleibt der Vergleich erreichbar und sagt das ehrlich", async () => {
    netz.fassungen = [fassung(1), fassung(2)];
    await flaecheMitFassungen();
    expect(text(aenderungszeile(2))).toContain(i18n.t("ko.snapshotNoChanges"));
    await ausloesen(vergleichsAktion(2) as HTMLButtonElement);
    expect(text(vergleichsFlaeche())).toContain(i18n.t("ko.snapshotCompareNone"));
  });
});
