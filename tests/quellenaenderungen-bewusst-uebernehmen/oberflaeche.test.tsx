// @vitest-environment jsdom
// ================================================================================================
// QUELLENÄNDERUNGEN (aufnahme:20260928) · DER BEDIENWEG AM DOM.
// ================================================================================================
//
// Gezeichnet im ECHTEN Baum (jsdom + `createRoot`), bedient per Klick — wie
// `tests/wiki-gesamtanweisung-fassungsbindung/lesestand-ansicht.test.tsx`. Belegt:
//   K2  der betroffene Abschnitt nennt verwendete und neuere Fassung;
//   K3  Quelle, bisherige/neue Fassung, betroffene Abschnitte; Unterschiede ansehen (über die
//       vorhandene `paarDiff`); bisherige Fassung beibehalten, ohne dass etwas geschrieben wird;
//   K4  „übernehmen" ruft genau die Übernahme dieses Abschnitts — sonst nichts;
//   K5  während die Änderung offen ist, steht die weiterhin verwendete Fassung da;
//   K7  letzte Prüfung, gefundene und übernommene Änderungen getrennt; ein Ausfall und eine
//       gescheiterte Auffrischung sind nie „aktuell";
//   K8  die hochgeladene Datei ist als Momentaufnahme gekennzeichnet, eine Überwachung wird nicht
//       behauptet.
//
// GRENZE, ausdrücklich: das ist jsdom, kein Browser und kein Mensch. Eine echte Bedienung durch
// Pedi oder Ben ersetzt dieser Fall nicht.
import { describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type {
  AnweisungLesestand,
  BausteinLesestand,
  KoVersionSnapshot,
} from "../../apps/web/src/api/types";
import {
  type Aenderungsbearbeitung,
  LesestandAnsicht,
} from "../../apps/web/src/components/gesamtanweisung/LesestandAnsicht";
import type { Anzeigelage } from "../../apps/web/src/components/gesamtanweisung/zustand";
import "../../apps/web/src/i18n";
import { formatKoTimestamp } from "../../apps/web/src/lib/koDates";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PRUEFZEIT = "2026-10-01T08:30:00.000Z";
const LESBAR = formatKoTimestamp(PRUEFZEIT, "de");

function baustein(over: Partial<BausteinLesestand> & { id: string }): BausteinLesestand {
  return {
    id: over.id,
    position: over.position ?? 0,
    koId: over.koId ?? "ko-a",
    koVersion: over.koVersion ?? 1,
    nachweisHash: over.nachweisHash ?? "h-1",
    voraussetzung: null,
    herkunft: {
      titel: over.herkunft?.titel ?? "Druck einstellen",
      autor: "anna",
      fassungAm: "2026-09-01T09:00:00.000Z",
      status: "offen",
    },
    rumpfHtml: over.rumpfHtml ?? "<p>Druck auf 4 bar.</p>",
    aktuelleKoVersion: over.aktuelleKoVersion ?? 1,
    aktualisierungsvorschlag: over.aktualisierungsvorschlag ?? null,
    inhalt: { tabellenUeberschriften: [], abbildungen: [], geltung: "Werk 1" },
    ...(over.momentaufnahmen === undefined ? {} : { momentaufnahmen: over.momentaufnahmen }),
  };
}

function lesestand(
  bausteine: readonly BausteinLesestand[],
  over: Partial<AnweisungLesestand> = {},
): AnweisungLesestand {
  const gefunden = bausteine.filter((b) => b.aktualisierungsvorschlag !== null).length;
  return {
    id: "a-1",
    titel: "Anfahren",
    zweck: "Sicheres Anfahren",
    geltungsbereich: "Werk 1",
    voraussetzungen: "",
    stand: "entschieden",
    version: 4,
    urheber: "anna",
    erstelltAm: "2026-09-15T09:00:00.000Z",
    geaendertAm: "2026-09-15T10:00:00.000Z",
    bausteine: [...bausteine],
    unvollstaendig: false,
    verborgeneBausteine: 0,
    pruefanbindung: "nicht_angebunden",
    aenderungspruefung: {
      pruefzeitpunkt: PRUEFZEIT,
      ergebnis: gefunden > 0 ? "aenderungen_gefunden" : "aktuell",
      gefundeneAenderungen: gefunden,
      fehlgeschlageneQuellen: 0,
      ueberwachung: "nicht_eingerichtet",
    },
    uebernommeneAenderungen: [],
    ...over,
  };
}

const FRISCH: Anzeigelage = {
  art: "stand",
  frisch: true,
  auffrischungGescheitert: false,
  offline: false,
};

/** Zwei echte Fassungssätze desselben Eintrags — die Gegenüberstellung macht `paarDiff`. */
function fassungen(): KoVersionSnapshot[] {
  const basis = {
    id: "ko-a",
    title: "Druck einstellen",
    statement: "Druck einstellen",
    conditions: [],
    measures: [],
    type: "technik",
    status: "offen",
  };
  return [
    {
      version: 1,
      at: "2026-09-01T09:00:00.000Z",
      author: "anna",
      snapshot: { ...basis, version: 1, bodyHtml: "<p>Druck auf 4 bar.</p>" },
    },
    {
      version: 2,
      at: "2026-09-20T09:00:00.000Z",
      author: "anna",
      snapshot: { ...basis, version: 2, bodyHtml: "<p>Druck auf 5 bar.</p>" },
    },
  ] as unknown as KoVersionSnapshot[];
}

async function zeichne(
  stand: AnweisungLesestand,
  optionen: { lage?: Anzeigelage; aenderung?: Aenderungsbearbeitung } = {},
): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(LesestandAnsicht, {
        lage: optionen.lage ?? FRISCH,
        stand,
        zeit: stand.geaendertAm,
        ...(optionen.aenderung ? { aenderung: optionen.aenderung } : {}),
      }),
    );
  });
  return container;
}

function knopf(container: HTMLElement, text: string): HTMLButtonElement {
  const treffer = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(text),
  );
  expect(treffer, `Knopf „${text}" fehlt`).toBeTruthy();
  return treffer as HTMLButtonElement;
}

async function klick(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click();
  });
  // Der Fassungsabruf ist ein Promise — die Ereignisschleife einmal ganz durchlaufen lassen.
  await act(async () => {
    await new Promise((fertig) => setTimeout(fertig, 0));
  });
}

function text(container: HTMLElement, testid: string): string {
  return container.querySelector(`[data-testid="${testid}"]`)?.textContent ?? "";
}

function bearbeitung(over: Partial<Aenderungsbearbeitung> = {}): Aenderungsbearbeitung & {
  uebernehmen: ReturnType<typeof vi.fn>;
  fassungenLaden: ReturnType<typeof vi.fn>;
} {
  return {
    fassungenLaden: vi.fn(async () => fassungen()),
    uebernehmen: vi.fn(),
    gesperrt: false,
    ...over,
  } as Aenderungsbearbeitung & {
    uebernehmen: ReturnType<typeof vi.fn>;
    fassungenLaden: ReturnType<typeof vi.fn>;
  };
}

const MIT_AENDERUNG = () =>
  lesestand([
    baustein({
      id: "b-1",
      koId: "ko-a",
      aktuelleKoVersion: 2,
      aktualisierungsvorschlag: { aufVersion: 2 },
    }),
    baustein({ id: "b-2", position: 1, koId: "ko-b" }),
    baustein({
      id: "b-3",
      position: 2,
      koId: "ko-a",
      aktuelleKoVersion: 2,
      aktualisierungsvorschlag: { aufVersion: 2 },
    }),
  ]);

describe("K2/K3/K5 · die Änderung ist sichtbar, ansehbar und die bisherige Fassung bleibt", () => {
  it("Quelle, bisherige und neue Fassung, betroffene Abschnitte stehen am Abschnitt", async () => {
    const container = await zeichne(MIT_AENDERUNG(), { aenderung: bearbeitung() });
    const karte = container.querySelector('[data-testid="ga-lesestand-aenderung"]');
    expect(karte).not.toBeNull();
    expect(text(container, "ga-lesestand-aenderung-quelle")).toBe("Druck einstellen");
    expect(text(container, "ga-lesestand-aenderung-bisher")).toBe("Fassung 1");
    expect(text(container, "ga-lesestand-aenderung-neu")).toBe("Fassung 2");
    // Beide Abschnitte mit derselben Quelle sind betroffen — nicht nur der erste.
    expect(text(container, "ga-lesestand-aenderung-abschnitte")).toBe("1, 3");
    // Die Herkunftszeile nennt weiterhin die GEBUNDENE Fassung.
    expect(text(container, "ga-lesestand-herkunft")).toContain("Gebundene Fassung 1");
    // Der Text ist der der gebundenen Fassung.
    expect(text(container, "ga-lesestand-text")).toContain("4 bar");
  });

  it("Unterschiede ansehen: Gegenüberstellung über paarDiff, verwendete Fassung bleibt genannt", async () => {
    const aenderung = bearbeitung();
    const container = await zeichne(MIT_AENDERUNG(), { aenderung });
    const erste = container.querySelector('[data-testid="ga-lesestand-aenderung"]') as HTMLElement;
    await klick(knopf(erste, "Unterschiede ansehen"));

    expect(aenderung.fassungenLaden).toHaveBeenCalledWith("ko-a");
    expect(text(erste, "ga-lesestand-weiterhin")).toBe(
      "Während du die Änderung ansiehst, verwendet die Anleitung weiterhin Fassung 1.",
    );
    const unterschiede = erste.querySelector('[data-testid="ga-lesestand-unterschiede"]');
    expect(unterschiede, "die Gegenüberstellung fehlt").not.toBeNull();
    expect(unterschiede?.querySelector('[data-feld="bodyHtml"]')?.textContent).toContain("4 bar");
    expect(unterschiede?.querySelector('[data-feld="bodyHtml"]')?.textContent).toContain("5 bar");
    expect(aenderung.uebernehmen).not.toHaveBeenCalled();
  });

  it("bisherige Fassung beibehalten: Hinweis, keine Übernahme, keine Schreibanfrage", async () => {
    const aenderung = bearbeitung();
    const container = await zeichne(MIT_AENDERUNG(), { aenderung });
    const erste = container.querySelector('[data-testid="ga-lesestand-aenderung"]') as HTMLElement;
    await klick(knopf(erste, "Unterschiede ansehen"));
    await klick(knopf(erste, "Bisherige Fassung beibehalten"));

    expect(text(erste, "ga-lesestand-beibehalten")).toBe(
      "Die Anleitung verwendet weiterhin Fassung 1. Es wurde nichts geändert.",
    );
    expect(erste.querySelector('[data-testid="ga-lesestand-aenderung-offen"]')).toBeNull();
    expect(aenderung.uebernehmen).not.toHaveBeenCalled();
  });

  it("ohne Bedienrecht bleibt die Änderung sichtbar, aber es gibt keinen Knopf", async () => {
    const container = await zeichne(MIT_AENDERUNG());
    expect(container.querySelector('[data-testid="ga-lesestand-aenderung"]')).not.toBeNull();
    expect(container.textContent).not.toContain("übernehmen");
  });
});

describe("K4/K6 · bewusste Übernahme genau dieses Abschnitts", () => {
  it("der Knopf übernimmt GENAU diesen Abschnitt auf GENAU die neue Fassung", async () => {
    const aenderung = bearbeitung();
    const container = await zeichne(MIT_AENDERUNG(), { aenderung });
    const karten = container.querySelectorAll('[data-testid="ga-lesestand-aenderung"]');
    await klick(knopf(karten[1] as HTMLElement, "Fassung 2 übernehmen"));
    expect(aenderung.uebernehmen).toHaveBeenCalledTimes(1);
    expect(aenderung.uebernehmen).toHaveBeenCalledWith("b-3", 2);
    // Die Folge steht VOR dem Klick da: neuer Stand, alte bleiben, wieder Entwurf.
    expect(container.textContent).toContain("frühere Stände bleiben erhalten");
    expect(container.textContent).toContain("wieder zum Entwurf");
  });

  it("gesperrt: der Übernahmeknopf ist nicht bedienbar", async () => {
    const container = await zeichne(MIT_AENDERUNG(), {
      aenderung: bearbeitung({ gesperrt: true }),
    });
    expect(knopf(container, "Fassung 2 übernehmen").disabled).toBe(true);
  });
});

describe("K7 · letzte Prüfung, gefundene und übernommene Änderungen — getrennt", () => {
  it("Zeitpunkt, Ergebnis, gefundene und übernommene stehen als drei Aussagen da", async () => {
    const stand = lesestand(MIT_AENDERUNG().bausteine, {
      uebernommeneAenderungen: [
        {
          bausteinId: "b-2",
          vonFassung: 3,
          aufFassung: 4,
          anweisungVersion: 3,
          uebernommenAm: "2026-09-30T07:00:00.000Z",
        },
      ],
    });
    const container = await zeichne(stand);
    expect(text(container, "ga-lesestand-quellen-letzte")).toBe(
      `Letzte Änderungsprüfung: ${LESBAR}`,
    );
    expect(text(container, "ga-lesestand-quellen-ergebnis")).toBe(
      "Ergebnis: Es gibt neuere Quellenfassungen.",
    );
    expect(text(container, "ga-lesestand-quellen-gefunden")).toBe("Gefundene Änderungen: 2");
    expect(text(container, "ga-lesestand-quellen-uebernommen")).toContain(
      "Abschnitt 2: Fassung 3 → 4",
    );
    expect(text(container, "ga-lesestand-quellen-ueberwachung")).toContain("nicht eingerichtet");
  });

  it("aktuell nur bei frischem, vollständigem Befund", async () => {
    const container = await zeichne(lesestand([baustein({ id: "b-1" })]));
    expect(text(container, "ga-lesestand-quellen-ergebnis")).toBe(
      "Ergebnis: Alle verwendeten Quellenfassungen sind aktuell.",
    );
    expect(text(container, "ga-lesestand-quellen-uebernommen")).toContain("keine");
  });

  it("fehlgeschlagene Prüfung: Fehlersatz, nie „aktuell“", async () => {
    const stand = lesestand([baustein({ id: "b-1" })]);
    const container = await zeichne({
      ...stand,
      aenderungspruefung: {
        pruefzeitpunkt: PRUEFZEIT,
        ergebnis: "fehlgeschlagen",
        gefundeneAenderungen: 0,
        fehlgeschlageneQuellen: 1,
        ueberwachung: "nicht_eingerichtet",
      },
    });
    const ergebnis = container.querySelector('[data-testid="ga-lesestand-quellen-ergebnis"]');
    expect(ergebnis?.getAttribute("data-ergebnis")).toBe("fehlgeschlagen");
    expect(ergebnis?.textContent).toContain("Prüfung fehlgeschlagen");
    expect(ergebnis?.textContent).not.toContain("aktuell");
  });

  it("gescheiterte Auffrischung: ein früheres „aktuell“ wird nicht als heutiges gezeigt", async () => {
    const container = await zeichne(lesestand([baustein({ id: "b-1" })]), {
      lage: { art: "stand", frisch: false, auffrischungGescheitert: true, offline: false },
    });
    expect(text(container, "ga-lesestand-quellen-ergebnis")).toBe(
      "Ergebnis: nicht gesichert – die Prüfung konnte nicht wiederholt werden.",
    );
    expect(container.textContent).not.toContain("sind aktuell");
  });

  it("eine ältere Antwort ohne Prüfangabe zeigt GAR KEINE Prüfaussage", async () => {
    const {
      aenderungspruefung: _weg,
      uebernommeneAenderungen: _auch,
      ...alt
    } = lesestand([baustein({ id: "b-1" })]);
    const container = await zeichne(alt as AnweisungLesestand);
    expect(container.querySelector('[data-testid="ga-lesestand-quellen"]')).toBeNull();
    expect(container.querySelector("[data-ergebnis]")).toBeNull();
    expect(container.textContent).not.toContain("sind aktuell");
  });
});

describe("K8 · Momentaufnahme statt Überwachung", () => {
  it("die hochgeladene Datei trägt den Vermerk Momentaufnahme samt Zeitpunkt", async () => {
    const container = await zeichne(
      lesestand([
        baustein({
          id: "b-1",
          momentaufnahmen: [{ bezeichnung: "Wartungsplan.pdf", erfasstAm: PRUEFZEIT }],
        }),
      ]),
    );
    expect(text(container, "ga-lesestand-momentaufnahme")).toBe(
      `Hochgeladene Datei „Wartungsplan.pdf“: Momentaufnahme vom ${LESBAR}. Spätere Änderungen an der Originaldatei werden nicht erkannt.`,
    );
    // Keine Behauptung einer laufenden Überwachung.
    expect(container.textContent).not.toMatch(/Überwachung: (aktiv|eingerichtet)/);
  });
});
