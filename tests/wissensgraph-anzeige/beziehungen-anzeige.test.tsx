// @vitest-environment jsdom
// ================================================================================================
// JOB 4153 (WG-ANZEIGE) — R1 bis R8 AM ECHTEN BAUTEIL.
// ================================================================================================
//
// Gemessen wird `WissensbeziehungenBereich` (und für R2 die Einbindung in `KnowledgeNeighborhood`)
// gegen die Antwortformen des verbindlichen API-Vertrags (`jobs/4151/HINWEIS.md`). Kein laufender
// Server, keine Serverdatei angefasst: die Gegenseite ist der Prüfstand in `./bestand.ts`, und er
// rechnet `aktuell`/`abweichung` beim Lesen und dedupliziert beim Schreiben — sonst prüften die
// Fälle nur, ob die Fläche Zeichenketten durchreicht (Lehre JOB 4141 R1).
//
// WAS DIESE DATEI NICHT BEWEIST: jsdom rechnet kein Layout. Über Geometrie, Umbruch und echte
// Tastaturfokus-Reihenfolge im Browser sagt sie nichts — dafür steht die Browser-Abnahme des
// Integrationsnachfolgers WG-LUECKEN. Und sie beweist NICHT „App-Anzeige geliefert": der Bereich
// hängt heute in einem zugeklappten „Mehr"-Abschnitt (Nachtrag 2 §2).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type Kantenbestand,
  QUELLE_ID,
  ZIEL_A,
  ZIEL_B,
  kanteMitAlterFassung,
  kanteOhneBeurteilteFassung,
  kanteWiderspricht,
  neuerPruefstand,
  zweiAktiveKanten,
} from "./bestand";

// Ein Prüfstand für die ganze Datei; `beforeEach` setzt ihn zurück. Die Mock-Fabrik unten liest
// `stand.p` erst beim AUFRUF — sie darf beim Erzeugen nichts von aussen anfassen (Vitest hebt
// `vi.mock` über die Importe).
const stand: { p: ReturnType<typeof neuerPruefstand> } = { p: neuerPruefstand() };

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    ko: {
      beziehungen: vi.fn((id: string) => stand.p.beziehungen(id)),
      beziehungSetzen: vi.fn((id: string, body: never) => stand.p.setzen(id, body)),
      beziehungWiderrufen: vi.fn((kanteId: string, body: { version: number }) =>
        stand.p.widerruf(kanteId, body),
      ),
      get: vi.fn((id: string) => stand.p.ko(id)),
      neighbors: vi.fn(async (id: string) => ({
        center: { id, title: "Filter F3", status: "validiert" },
        neighbors: [{ id: "nb-1", title: "Pumpe P2 schmieren", status: "offen", via: ["wartung"] }],
        total: 1,
        truncated: false,
        excludedTags: [],
      })),
    },
    library: { search: vi.fn((params: { q?: string }) => stand.p.suche(params)) },
  };
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => leer() });
    },
  });
  return { endpoints };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { KnowledgeNeighborhood } from "../../apps/web/src/components/KnowledgeNeighborhood";
import { WissensbeziehungenBereich } from "../../apps/web/src/components/WissensbeziehungenBereich";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * Einen Wert setzen, den React auch BEMERKT.
 *
 * React verfolgt den Wert eines Feldes über einen eigenen Setter auf dem Knoten; eine einfache
 * Zuweisung `feld.value = x` aktualisiert diesen Tracker mit, React sieht anschliessend KEINE
 * Änderung, und `onChange` bleibt aus. GEMESSEN im ersten Lauf dieser Datei: die Suchtreffer
 * erschienen nie, und sieben Fälle waren rot aus diesem Grund und nicht aus einem des Produkts.
 * Der Prototyp-Setter umgeht den Tracker — dieselbe Bauform wie
 * `tests/import-freitext-titel/auswahl-sagt-was-die-ki-verstand.test.tsx:145-152`.
 */
function nativSetzen(el: HTMLInputElement | HTMLSelectElement, wert: string): void {
  const prototyp =
    el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototyp, "value")?.set;
  setter?.call(el, wert);
}

interface Buehne {
  container: HTMLElement;
  text: () => string;
  finde: (marke: string) => HTMLElement | null;
  alle: (marke: string) => HTMLElement[];
  klick: (el: Element | null | undefined) => Promise<void>;
  tippe: (el: Element | null | undefined, wert: string) => Promise<void>;
  waehle: (el: Element | null | undefined, wert: string) => Promise<void>;
  /** Die Liste neu anfordern — so entstehen die zwei Cache-Zustände ohne Umweg. */
  auffrischen: () => Promise<void>;
  unmount: () => void;
}

async function montiere(was: "bereich" | "nachbarschaft" = "bereich"): Promise<Buehne> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(
          QueryClientProvider,
          { client },
          was === "bereich"
            ? createElement(WissensbeziehungenBereich, { koId: QUELLE_ID })
            : createElement(KnowledgeNeighborhood, { koId: QUELLE_ID, koTitle: "Filter F3" }),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return {
    container,
    text: () => container.textContent ?? "",
    finde: (marke) => container.querySelector<HTMLElement>(`[data-testid="${marke}"]`),
    alle: (marke) => [...container.querySelectorAll<HTMLElement>(`[data-testid="${marke}"]`)],
    klick: async (el) => {
      await act(async () => {
        (el as HTMLElement | undefined)?.click();
        await flush();
      });
      await act(flush);
    },
    tippe: async (el, wert) => {
      const feld = el as HTMLInputElement;
      await act(async () => {
        nativSetzen(feld, wert);
        feld.dispatchEvent(new Event("input", { bubbles: true }));
        await flush();
      });
      await act(flush);
    },
    waehle: async (el, wert) => {
      const feld = el as HTMLSelectElement;
      await act(async () => {
        nativSetzen(feld, wert);
        feld.dispatchEvent(new Event("change", { bubbles: true }));
        await flush();
      });
      await act(flush);
    },
    auffrischen: async () => {
      await act(async () => {
        void client.invalidateQueries({ queryKey: ["ko-beziehungen", QUELLE_ID] });
        await flush();
      });
      await act(flush);
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Die Sätze, die an dieser Fläche NIE stehen dürfen (Vertrag Nr. 2 und Nr. 6, G6). */
const VERBOTEN = ["aktuell geprüft", "bestätigt", "konfliktfrei", "geprüft konfliktfrei"];

function verboteneAussage(text: string): string[] {
  const klein = text.toLowerCase();
  return VERBOTEN.filter((v) => klein.includes(v.toLowerCase()));
}

/** Die Zeit aus „Stand von <Zeit>" — sie kommt aus `dataUpdatedAt` und ist nicht vorhersagbar. */
function standZeit(satz: string): string {
  return satz.replace("Stand von ", "").trim();
}

/** Das Ziel über die Suche wählen — derselbe Weg, den ein Mensch geht. */
async function zielWaehlen(b: Buehne, titel: string): Promise<void> {
  await b.tippe(b.finde("wb-suche"), titel.slice(0, 10));
  const treffer = b.alle("wb-treffer").find((t) => (t.textContent ?? "").includes(titel));
  expect(treffer, `Suchtreffer „${titel}" fehlt`).toBeDefined();
  await b.klick(treffer);
}

beforeEach(async () => {
  stand.p = neuerPruefstand();
  await i18n.changeLanguage("de");
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("R1 · Art, Richtung und der Satz, der ohne Vorwissen stimmt", () => {
  it("gerichtete ersetzt-Kante trägt den Richtungssatz, die ungerichtete trägt KEINEN", async () => {
    stand.p.kanten = zweiAktiveKanten();
    const b = await montiere();
    const text = b.text();
    // Beide Gegenstücke stehen da, beide Arten in Klartext — kein Rohbezeichner.
    expect(text).toContain(ZIEL_A.title);
    expect(text).toContain(ZIEL_B.title);
    expect(text).not.toContain("gehoert_zu");
    expect(text).not.toContain("beispiel_fuer");
    // Die gerichtete Kante: der aktive Satz, abgeleitet aus `rolle: "quelle"`.
    expect(text).toContain(i18n.t("wb.satz.ersetzt.quelle", { title: ZIEL_A.title }));
    // Die ungerichtete: ausdrücklich OHNE Richtungsaussage.
    expect(text).toContain(
      i18n.t("wb.satz.ohneRichtung", { title: ZIEL_B.title, art: i18n.t("wb.art.ergaenzt") }),
    );
    // Der Gegenfall, wörtlich: für ZIEL_B entsteht kein „ersetzt"/„wird ersetzt"-Satz.
    expect(text).not.toContain(i18n.t("wb.satz.ersetzt.ziel", { title: ZIEL_B.title }));
    expect(text).not.toContain(i18n.t("wb.satz.ersetzt.quelle", { title: ZIEL_B.title }));
    // Urheber und Datum stehen an der Kante.
    expect(text).toContain("Pedi");
    expect(text).toContain("Anna");
    expect(text).toContain("14.09.2026");
    b.unmount();
  });

  it("rolle: 'ziel' dreht den Satz — „wird ersetzt von“, nicht „ersetzt“", async () => {
    const kanten = zweiAktiveKanten();
    const erste = kanten[0];
    if (!erste) {
      throw new Error("Prüfstand: erste Kante fehlt");
    }
    erste.rolle = "ziel";
    stand.p.kanten = kanten;
    const b = await montiere();
    expect(b.text()).toContain(i18n.t("wb.satz.ersetzt.ziel", { title: ZIEL_A.title }));
    expect(b.text()).not.toContain(i18n.t("wb.satz.ersetzt.quelle", { title: ZIEL_A.title }));
    b.unmount();
  });

  it("gerichtet OHNE rolle behauptet keine Richtung, sondern nennt sie unbekannt", async () => {
    const erste = zweiAktiveKanten()[0];
    if (!erste) {
      throw new Error("Prüfstand: erste Kante fehlt");
    }
    // Der Vertrag LÄSST `rolle` weg, wenn es keine Aussage gibt (`kanten-service.ts:221`) — das
    // Feld wird hier deshalb nicht auf `undefined` gesetzt, sondern gar nicht erst gebaut.
    const ohneRolle: Kantenbestand = {
      id: erste.id,
      art: erste.art,
      richtung: erste.richtung,
      gegenstueck: erste.gegenstueck,
      urheber: erste.urheber,
      gesetztAm: erste.gesetztAm,
      version: erste.version,
      status: erste.status,
      beurteilt: erste.beurteilt,
    };
    stand.p.kanten = [ohneRolle];
    const b = await montiere();
    expect(b.text()).toContain(
      i18n.t("wb.satz.richtungUnbekannt", {
        title: ZIEL_A.title,
        art: i18n.t("wb.art.ersetzt"),
      }),
    );
    expect(b.text()).not.toContain(i18n.t("wb.satz.ersetzt.quelle", { title: ZIEL_A.title }));
    b.unmount();
  });

  it("die fachlichen Grenzen stehen an der Kante: widerspricht ist kein Beweis", async () => {
    stand.p.kanten = kanteWiderspricht();
    const b = await montiere();
    expect(b.text()).toContain(i18n.t("wb.grenze.widerspricht"));
    // Und die Konfliktnummer der Beziehung (version 3) wird dem Menschen NICHT angeboten.
    expect(b.finde("wb-kante")?.textContent ?? "").not.toMatch(/Version\s*3|Fassung\s*3\b/);
    b.unmount();
  });
});

describe("R2 · Trennung der Herkunft: „gesetzt“ gegen „aus Schlagwörtern abgeleitet“", () => {
  it("beide Etiketten stehen im DOM und sind verschiedene Zeichenketten", async () => {
    stand.p.kanten = zweiAktiveKanten();
    const b = await montiere("nachbarschaft");
    const gesetzt = b.finde("wb-herkunft")?.textContent?.trim() ?? "";
    const abgeleitet = b.finde("nb-herkunft")?.textContent?.trim() ?? "";
    expect(gesetzt.length).toBeGreaterThan(0);
    expect(abgeleitet.length).toBeGreaterThan(0);
    // DER KERN: zwei Herkünfte, zwei Wörter. Wären sie gleich, wäre die Trennung nur behauptet.
    expect(gesetzt).not.toBe(abgeleitet);
    // Die bestehende Nachbarschaft bleibt vollständig erhalten.
    expect(b.container.querySelector("svg")).not.toBeNull();
    expect(b.text()).toContain("Pumpe P2 schmieren");
    expect(b.text()).toContain("wartung");
    b.unmount();
  });
});

describe("R3 · Der Fassungsvermerk (G6)", () => {
  it("abweichung 'geaendert': beide Zahlenpaare stehen da, und kein Wort behauptet eine Prüfung", async () => {
    stand.p.kanten = kanteMitAlterFassung();
    // Der Prüfstand rechnet `aktuell` beim Lesen: beurteilt war Fassung 3, heute ist es 5.
    stand.p.quelleVersion = 5;
    const b = await montiere();
    const vermerk = b.finde("wb-fassung")?.textContent ?? "";
    expect(vermerk).toBe(
      i18n.t("wb.fassung.geaendert", {
        beurteiltQuelle: 3,
        beurteiltZiel: 2,
        aktuellQuelle: 5,
        aktuellZiel: 2,
      }),
    );
    // Beide Zahlen ausdrücklich — der Vergleich, nicht nur ein Feld (Lehre JOB 4141 R1).
    expect(vermerk).toMatch(/\b3\b/);
    expect(vermerk).toMatch(/\b5\b/);
    expect(verboteneAussage(b.text())).toEqual([]);
    b.unmount();
  });

  it("fehlende beurteilte Fassung heißt „unbekannt“ — und wird nicht mit dem heutigen Stand gefüllt", async () => {
    stand.p.kanten = kanteOhneBeurteilteFassung();
    stand.p.quelleVersion = 7;
    const b = await montiere();
    const vermerk = b.finde("wb-fassung")?.textContent ?? "";
    expect(vermerk).toBe(i18n.t("wb.fassung.unbekannt"));
    // Die heutige Fassung 7 wird hier NICHT als beurteilte ausgegeben.
    expect(vermerk).not.toMatch(/\b7\b/);
    expect(verboteneAussage(b.text())).toEqual([]);
    b.unmount();
  });

  it("unverändert sagt genau das — und nichts über Inhalt", async () => {
    stand.p.kanten = kanteMitAlterFassung();
    stand.p.quelleVersion = 3;
    const b = await montiere();
    expect(b.finde("wb-fassung")?.textContent ?? "").toBe(
      i18n.t("wb.fassung.unveraendert", { aktuellQuelle: 3, aktuellZiel: 2 }),
    );
    expect(verboteneAussage(b.text())).toEqual([]);
    b.unmount();
  });
});

describe("R4 · Bestätigt wird erst nach Servererfolg", () => {
  it("hängende Mutation: keine Erfolgsmeldung, kein neuer Listeneintrag", async () => {
    const b = await montiere();
    expect(b.finde("wb-leer")).not.toBeNull();
    await zielWaehlen(b, ZIEL_A.title);
    stand.p.stoerung = "haengt";
    await b.klick(b.finde("wb-setzen-knopf"));
    // Gesendet ist gesendet — aber bestätigt ist nichts.
    expect(stand.p.gesendet.length).toBe(1);
    expect(b.finde("wb-setzen-erfolg")).toBeNull();
    expect(b.alle("wb-kante").length).toBe(0);
    // Die Eingabe bleibt vollständig sichtbar, der Knopf sagt, dass er arbeitet.
    expect(b.finde("wb-ziel")?.textContent ?? "").toContain(ZIEL_A.title);
    expect(b.finde("wb-setzen-knopf")?.textContent ?? "").toBe(i18n.t("wb.setzen.laeuft"));
    b.unmount();
  });

  it("nach der Serverantwort erscheint der Eintrag — mit den Feldern des Servers", async () => {
    const b = await montiere();
    await zielWaehlen(b, ZIEL_A.title);
    await b.waehle(b.finde("wb-art"), "ergaenzt");
    await b.klick(b.finde("wb-setzen-knopf"));
    expect(b.finde("wb-setzen-erfolg")?.textContent ?? "").toBe(i18n.t("wb.setzen.erfolg"));
    expect(b.alle("wb-kante").length).toBe(1);
    expect(b.text()).toContain(i18n.t("wb.satz.ergaenzt.quelle", { title: ZIEL_A.title }));
    // `gesehen` trägt die Fassungen, die auf der Fläche standen — nicht geratene.
    const rumpf = stand.p.gesendet[0];
    expect(rumpf?.gesehen).toEqual({ quelleVersion: 4, zielVersion: ZIEL_A.version });
    expect(rumpf?.zielId).toBe(ZIEL_A.id);
    expect(rumpf?.art).toBe("ergaenzt");
    b.unmount();
  });
});

describe("R5 · Idempotenz: dieselbe Übertragung, derselbe Vorgangsschlüssel", () => {
  it("nach abgebrochener Übertragung sendet der zweite Versuch denselben Schlüssel — und es entsteht EINE Kante", async () => {
    const b = await montiere();
    await zielWaehlen(b, ZIEL_A.title);
    // Der Prüfstand SCHREIBT und verliert dann die Antwort — der klassische unklare Ausgang.
    stand.p.uebertragungBricht = true;
    await b.klick(b.finde("wb-setzen-knopf"));
    expect(b.finde("wb-schreibfehler")?.textContent ?? "").toBe(i18n.t("wb.fehler.unklar"));
    // Die Eingabe steht noch, also kann der Mensch einfach erneut senden.
    expect(b.finde("wb-ziel")?.textContent ?? "").toContain(ZIEL_A.title);
    await b.klick(b.finde("wb-setzen-knopf"));
    expect(stand.p.gesendet.length).toBe(2);
    const ersterSchluessel = stand.p.gesendet[0]?.beitragSchluessel;
    expect(ersterSchluessel).toBeTruthy();
    // DER KERN von G3: derselbe Schlüssel.
    expect(stand.p.gesendet[1]?.beitragSchluessel).toBe(ersterSchluessel);
    // Und deshalb EINE fachliche Beziehung, nicht zwei.
    expect(stand.p.kanten.length).toBe(1);
    expect(b.alle("wb-kante").length).toBe(1);
    b.unmount();
  });

  it("nach bestätigtem Erfolg ist der nächste Vorgang ein NEUER — mit neuem Schlüssel", async () => {
    const b = await montiere();
    await zielWaehlen(b, ZIEL_A.title);
    await b.klick(b.finde("wb-setzen-knopf"));
    await zielWaehlen(b, ZIEL_B.title);
    await b.klick(b.finde("wb-setzen-knopf"));
    expect(stand.p.gesendet.length).toBe(2);
    expect(stand.p.gesendet[1]?.beitragSchluessel).not.toBe(stand.p.gesendet[0]?.beitragSchluessel);
    expect(stand.p.kanten.length).toBe(2);
    b.unmount();
  });

  it("dieselbe fachliche Beziehung zweimal (Dedup, 200) erzeugt keinen zweiten Listeneintrag", async () => {
    const b = await montiere();
    await zielWaehlen(b, ZIEL_A.title);
    await b.klick(b.finde("wb-setzen-knopf"));
    expect(b.alle("wb-kante").length).toBe(1);
    // Zweiter Vorgang, neuer Schlüssel — aber dasselbe Paar und dieselbe Art.
    await zielWaehlen(b, ZIEL_A.title);
    await b.klick(b.finde("wb-setzen-knopf"));
    expect(stand.p.kanten.length).toBe(1);
    expect(b.alle("wb-kante").length).toBe(1);
    b.unmount();
  });
});

// ================================================================================================
// R12 (RUNDE 3) — DER UNKLARE AUSGANG UND DER GEÄNDERTE AUFTRAG. BENS ZWEI GEGENBEISPIELE.
// ================================================================================================
//
// BEN hat in Runde 2 zwei Dinge gemessen, die kein Vertragstest dieses Pakets abgedeckt hatte:
//
//   BEN1  Der Server SPEICHERT, die Antwort geht auf dem Rückweg verloren. Die Fläche sagte
//         „Nicht gesendet. Nichts wurde gespeichert" — eine Aussage über den Bestand ohne Beleg,
//         und im Gegenbeispiel falsch (`gespeichert: 1`).
//   BEN2  Danach ändert der Mensch die Art und sendet erneut. Unter DEMSELBEN Vorgangsschlüssel
//         antwortet der Server idempotent mit der ALTEN Kante — und die Fläche meldete
//         „Die Beziehung ist gesetzt — der Server hat sie bestätigt."
//
// Beide Fälle haben eine gemeinsame Gestalt: eine Behauptung, für die es keinen Beleg gibt. Diese
// Fälle prüfen deshalb IMMER DREI DINGE ZUSAMMEN — den gesendeten Auftrag, den gespeicherten
// Bestand und den Text auf der Fläche (BEN, Prüflücke 6). Einzeln gelesen wäre jeder von ihnen
// weiterhin grün zu bekommen.
describe("R12 · Unklarer Ausgang: die Fläche behauptet nichts über den Bestand", () => {
  it("BEN1 · Server speichert, Antwort verloren: kein Erfolg, KEINE Nicht-Speicherung, und die Liste zeigt den Stand", async () => {
    const b = await montiere();
    await zielWaehlen(b, ZIEL_A.title);
    stand.p.uebertragungBricht = true;
    await b.klick(b.finde("wb-setzen-knopf"));

    // (1) DER BESTAND: der Server HAT gespeichert.
    expect(stand.p.kanten.length, "der Prüfstand hat geschrieben").toBe(1);
    // (2) DER TEXT: kein Erfolg — und keine Aussage über den Bestand.
    expect(b.finde("wb-setzen-erfolg")).toBeNull();
    const satz = b.finde("wb-schreibfehler")?.textContent ?? "";
    expect(satz).toBe(i18n.t("wb.fehler.unklar"));
    for (const luege of ["nichts wurde gespeichert", "nicht gesendet", "nichts wurde gesetzt"]) {
      expect(satz.toLowerCase(), `„${luege}" ist bei verlorener Antwort unbelegt`).not.toContain(
        luege,
      );
    }
    // (3) DIE LISTE: sie wurde nach dem Fehlschlag aufgefrischt und zeigt, was wirklich da ist —
    // genau das, worauf der Satz verweist. Ohne `onSettled` in `useBeziehungSetzen` stünde hier 0.
    expect(b.alle("wb-kante").length, "die Liste wurde nach dem unklaren Ausgang geholt").toBe(1);
    expect(b.text()).toContain(ZIEL_A.title);
    b.unmount();
  });

  it("BEN1 beim WIDERRUF · widerrufen, Antwort verloren: dieselbe Ehrlichkeit auf dem zweiten Weg", async () => {
    stand.p.kanten = kanteWiderspricht();
    const b = await montiere();
    await b.klick(b.finde("wb-widerruf"));
    stand.p.widerrufBricht = true;
    await b.klick(b.finde("wb-widerruf-ja"));

    // Der Bestand: der Widerruf IST erfolgt.
    expect(stand.p.kanten[0]?.status).toBe("widerrufen");
    // Der Text: keine Erfolgsmeldung, keine Behauptung über den Bestand — und kein Wort von Löschung.
    expect(b.finde("wb-widerruf-erfolg")).toBeNull();
    const satz = b.finde("wb-widerruf-fehler")?.textContent ?? "";
    expect(satz).toBe(i18n.t("wb.widerruf.unklar"));
    expect(satz.toLowerCase()).not.toContain("nichts wurde");
    expect(satz.toLowerCase()).not.toContain("gelöscht");
    // Und die Liste zeigt den Stand: die widerrufene Kante ist nicht mehr aktiv.
    expect(b.alle("wb-kante").length).toBe(0);
    b.unmount();
  });

  it("der unklare Satz behauptet in KEINER der drei Sprachen eine Nicht-Speicherung", async () => {
    const verboten: Record<string, readonly string[]> = {
      de: ["nichts wurde gespeichert", "nicht gesendet", "nichts wurde gesetzt"],
      en: ["nothing was saved", "not sent", "nothing was set"],
      nl: ["er is niets opgeslagen", "niet verzonden", "er is niets gezet"],
    };
    const unklarwort: Record<string, string> = {
      de: "unklar",
      en: "unclear",
      nl: "onduidelijk",
    };
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      for (const schluessel of ["wb.fehler.unklar", "wb.widerruf.unklar"]) {
        const satz = i18n.t(schluessel).toLowerCase();
        for (const luege of verboten[sprache] ?? []) {
          expect(satz, `${sprache}/${schluessel}: „${luege}" ist unbelegt`).not.toContain(luege);
        }
        // Und er sagt ausdrücklich, DASS es unklar ist — Schweigen wäre auch eine Behauptung.
        expect(satz, `${sprache}/${schluessel} benennt die Unklarheit nicht`).toContain(
          unklarwort[sprache] ?? "",
        );
      }
    }
    await i18n.changeLanguage("de");
  });
});

describe("R13 · Der geänderte Auftrag bekommt einen eigenen Vorgang (BEN2)", () => {
  /** Der gemeinsame Anlauf beider Fälle: senden, Antwort verloren, Eingabe steht noch. */
  async function nachAntwortverlust(): Promise<Buehne> {
    const b = await montiere();
    await zielWaehlen(b, ZIEL_A.title);
    stand.p.uebertragungBricht = true;
    await b.klick(b.finde("wb-setzen-knopf"));
    expect(stand.p.gesendet.length).toBe(1);
    expect(stand.p.gesendet[0]?.art).toBe("gehoert_zu");
    expect(stand.p.kanten.length).toBe(1);
    return b;
  }

  it("geänderte ART: neuer Schlüssel, neue Beziehung, und der Erfolg gilt dem NEUEN Auftrag", async () => {
    const b = await nachAntwortverlust();
    await b.waehle(b.finde("wb-art"), "widerspricht");
    await b.klick(b.finde("wb-setzen-knopf"));

    // (1) DER AUFTRAG: anderer Inhalt, also anderer Vorgang.
    expect(stand.p.gesendet.length).toBe(2);
    expect(stand.p.gesendet[1]?.art).toBe("widerspricht");
    expect(stand.p.gesendet[1]?.beitragSchluessel).not.toBe(stand.p.gesendet[0]?.beitragSchluessel);
    // (2) DER BESTAND: die neue Beziehung ist wirklich entstanden, die alte bleibt.
    expect(stand.p.kanten.map((k) => k.art).sort()).toEqual(["gehoert_zu", "widerspricht"]);
    // (3) DER TEXT: der Erfolg gilt dem gegebenen Auftrag, und die Liste zeigt ihn.
    expect(b.finde("wb-setzen-erfolg")?.textContent ?? "").toBe(i18n.t("wb.setzen.erfolg"));
    expect(b.finde("wb-abweichende-antwort")).toBeNull();
    expect(b.text()).toContain(i18n.t("wb.satz.widerspricht.quelle", { title: ZIEL_A.title }));
    b.unmount();
  });

  it("geändertes ZIEL: neuer Schlüssel, und bestätigt wird die Beziehung zum neuen Ziel", async () => {
    const b = await nachAntwortverlust();
    await b.klick(b.finde("wb-ziel-aendern"));
    await zielWaehlen(b, ZIEL_B.title);
    await b.klick(b.finde("wb-setzen-knopf"));

    expect(stand.p.gesendet[1]?.zielId).toBe(ZIEL_B.id);
    expect(stand.p.gesendet[1]?.beitragSchluessel).not.toBe(stand.p.gesendet[0]?.beitragSchluessel);
    expect(stand.p.kanten.map((k) => k.gegenstueck.id).sort()).toEqual(
      [ZIEL_A.id, ZIEL_B.id].sort(),
    );
    expect(b.finde("wb-setzen-erfolg")?.textContent ?? "").toBe(i18n.t("wb.setzen.erfolg"));
    expect(b.finde("wb-abweichende-antwort")).toBeNull();
    b.unmount();
  });

  it("geänderte RICHTUNG: der Server dedupliziert auf Paar+Art und gibt die alte Kante zurück — das ist KEIN Erfolg", async () => {
    // DIESER FALL IST DIE ZWEITE VERTEIDIGUNGSLINIE, und er ist nicht konstruiert: der Vertrag
    // dedupliziert über kanonisches Paar UND Art (`kanten-paar.ts`) — die RICHTUNG gehört nicht
    // dazu. Ein neuer Schlüssel allein rettet hier also nichts; die Antwort muss verglichen werden.
    const b = await nachAntwortverlust();
    await b.waehle(b.finde("wb-richtung"), "ungerichtet");
    await b.klick(b.finde("wb-setzen-knopf"));

    // (1) DER AUFTRAG ist ein anderer und bekommt einen eigenen Schlüssel.
    expect(stand.p.gesendet[1]?.richtung).toBe("ungerichtet");
    expect(stand.p.gesendet[1]?.beitragSchluessel).not.toBe(stand.p.gesendet[0]?.beitragSchluessel);
    // (2) DER BESTAND hat ihn NICHT ausgeführt — die Kante ist weiterhin gerichtet.
    expect(stand.p.kanten.length).toBe(1);
    expect(stand.p.kanten[0]?.richtung).toBe("gerichtet");
    // (3) DER TEXT behauptet deshalb keinen Erfolg, sondern nennt die Abweichung.
    expect(b.finde("wb-setzen-erfolg")).toBeNull();
    expect(b.finde("wb-abweichende-antwort")?.textContent ?? "").toBe(
      i18n.t("wb.fehler.andereAntwort"),
    );
    // Und die Eingabe bleibt stehen — der Mensch kann entscheiden, was er will.
    expect(b.finde("wb-ziel")?.textContent ?? "").toContain(ZIEL_A.title);
    expect((b.finde("wb-richtung") as HTMLSelectElement | null)?.value).toBe("ungerichtet");
    b.unmount();
  });

  it("eine Antwort mit fremdem ZIEL wird ebenfalls nicht als Erfolg ausgegeben", async () => {
    // Derselbe Schutz, andere Komponente des Vergleichs: hier stimmt die Art, aber das Gegenstück
    // der Antwort ist ein anderes als das angeforderte.
    stand.p.kanten = zweiAktiveKanten();
    const b = await montiere();
    await zielWaehlen(b, ZIEL_B.title);
    await b.waehle(b.finde("wb-art"), "gehoert_zu");
    stand.p.antwortVerdreht = true;
    await b.klick(b.finde("wb-setzen-knopf"));
    expect(b.finde("wb-setzen-erfolg")).toBeNull();
    expect(b.finde("wb-abweichende-antwort")?.textContent ?? "").toBe(
      i18n.t("wb.fehler.andereAntwort"),
    );
    b.unmount();
  });

  it("UNVERÄNDERTE Wiederholung behält ihren Schlüssel — die Idempotenz bleibt", async () => {
    // Die Gegenrichtung zur neuen Regel: sie darf die Zusage aus G3 nicht beschädigen.
    const b = await nachAntwortverlust();
    await b.klick(b.finde("wb-setzen-knopf"));
    expect(stand.p.gesendet[1]?.beitragSchluessel).toBe(stand.p.gesendet[0]?.beitragSchluessel);
    expect(stand.p.kanten.length).toBe(1);
    expect(b.alle("wb-kante").length).toBe(1);
    expect(b.finde("wb-setzen-erfolg")?.textContent ?? "").toBe(i18n.t("wb.setzen.erfolg"));
    b.unmount();
  });
});

// ================================================================================================
// R14 (RUNDE 4) — DIE BESTANDSAUSKUNFT HÄNGT AM GEMESSENEN AUSGANG DER AUFFRISCHUNG (BEN-R3-F).
// ================================================================================================
//
// DER BEFUND aus Runde 3: nach einem Antwortverlust WURDE die Auffrischung ausgelöst — und der Satz
// daneben behauptete, die Liste zeige „den Stand, den der Server jetzt meldet". Das ist zweierlei:
// eine ausgelöste Abfrage und eine zurückgekommene. Scheitert sie oder hängt sie, steht dort der
// alte Cache, und der Satz erklärt ihn zur jetzigen Serverauskunft.
//
// Diese Fälle vergleichen deshalb DREI Dinge zusammen: den Bestand des Prüfstands, die Liste auf der
// Fläche und den Satz. Genau dort, wo die beiden ersten AUSEINANDERGEHEN, muss der Satz es sagen.
describe("R14 · Unklarer Ausgang UND eine Auffrischung, die nicht ankommt", () => {
  it("Setzen · Antwort verloren, Auffrischung SCHEITERT: der Satz nennt den älteren Stand", async () => {
    const b = await montiere();
    await zielWaehlen(b, ZIEL_A.title);
    // Beides zugleich: der Server schreibt und verliert die Antwort — und die Liste ist danach
    // nicht erreichbar. Genau die Lage aus BENs Gegenbeispiel.
    stand.p.uebertragungBricht = true;
    stand.p.listeStoerung = true;
    await b.klick(b.finde("wb-setzen-knopf"));

    // (1) DER BESTAND: geschrieben wurde.
    expect(stand.p.kanten.length, "der Prüfstand hat geschrieben").toBe(1);
    // (2) DIE LISTE: sie zeigt weiterhin den alten, leeren Stand — die Auffrischung kam nicht an.
    expect(b.alle("wb-kante").length).toBe(0);
    // (3) DER SATZ: er sagt genau das und zeigt NICHT auf die Liste als jetzige Serverauskunft.
    const satz = b.finde("wb-schreibfehler")?.textContent ?? "";
    expect(satz).toBe(i18n.t("wb.fehler.unklarNichtGeladen"));
    expect(satz).not.toBe(i18n.t("wb.fehler.unklar"));
    expect(satz).toContain("konnte nicht neu geladen werden");
    expect(b.finde("wb-setzen-erfolg")).toBeNull();
    // Und die Eingabe steht vollständig — der Mensch kann unverändert wiederholen.
    expect(b.finde("wb-ziel")?.textContent ?? "").toContain(ZIEL_A.title);
    b.unmount();
  });

  it("Setzen · Antwort verloren, Auffrischung HÄNGT: der Satz behauptet keinen fertigen Stand", async () => {
    const b = await montiere();
    await zielWaehlen(b, ZIEL_A.title);
    stand.p.uebertragungBricht = true;
    stand.p.listeHaengt = true;
    await b.klick(b.finde("wb-setzen-knopf"));

    expect(stand.p.kanten.length).toBe(1);
    expect(b.alle("wb-kante").length).toBe(0);
    const satz = b.finde("wb-schreibfehler")?.textContent ?? "";
    expect(satz).toBe(i18n.t("wb.fehler.unklarLaedt"));
    expect(satz).not.toBe(i18n.t("wb.fehler.unklar"));
    expect(b.finde("wb-setzen-erfolg")).toBeNull();
    expect(b.finde("wb-ziel")?.textContent ?? "").toContain(ZIEL_A.title);
    b.unmount();
  });

  it("Widerruf · Antwort verloren, Auffrischung SCHEITERT: derselbe Massstab auf dem zweiten Weg", async () => {
    stand.p.kanten = kanteWiderspricht();
    const b = await montiere();
    await b.klick(b.finde("wb-widerruf"));
    stand.p.widerrufBricht = true;
    stand.p.listeStoerung = true;
    await b.klick(b.finde("wb-widerruf-ja"));

    // Der Bestand: widerrufen. Die Liste: zeigt die Kante weiterhin (alter Stand).
    expect(stand.p.kanten[0]?.status).toBe("widerrufen");
    expect(b.alle("wb-kante").length).toBe(1);
    const satz = b.finde("wb-widerruf-fehler")?.textContent ?? "";
    expect(satz).toBe(i18n.t("wb.widerruf.unklarNichtGeladen"));
    expect(satz).not.toBe(i18n.t("wb.widerruf.unklar"));
    expect(b.finde("wb-widerruf-erfolg")).toBeNull();
    b.unmount();
  });

  it("Widerruf · Antwort verloren, Auffrischung HÄNGT: kein fertiger Stand, keine Erfolgsmeldung", async () => {
    stand.p.kanten = kanteWiderspricht();
    const b = await montiere();
    await b.klick(b.finde("wb-widerruf"));
    stand.p.widerrufBricht = true;
    stand.p.listeHaengt = true;
    await b.klick(b.finde("wb-widerruf-ja"));

    expect(stand.p.kanten[0]?.status).toBe("widerrufen");
    const satz = b.finde("wb-widerruf-fehler")?.textContent ?? "";
    expect(satz).toBe(i18n.t("wb.widerruf.unklarLaedt"));
    expect(satz).not.toBe(i18n.t("wb.widerruf.unklar"));
    expect(b.finde("wb-widerruf-erfolg")).toBeNull();
    b.unmount();
  });

  it("die drei Fassungen sind in allen drei Sprachen verschieden und benennen den fehlenden Nachladestand", async () => {
    // Jede Fassung ist eine EIGENE Aussage. Wären zwei gleich, könnte der Mensch den Unterschied
    // nicht sehen — und der ganze Fall wäre wieder eine Behauptung ohne Beleg.
    const nichtGeladen: Record<string, string> = {
      de: "konnte nicht neu geladen werden",
      en: "could not be reloaded",
      nl: "kon niet opnieuw worden geladen",
    };
    const unklarwort: Record<string, string> = { de: "unklar", en: "unclear", nl: "onduidelijk" };
    const verboten: Record<string, readonly string[]> = {
      de: ["nichts wurde gespeichert", "nicht gesendet", "nichts wurde gesetzt"],
      en: ["nothing was saved", "not sent", "nothing was set"],
      nl: ["er is niets opgeslagen", "niet verzonden", "er is niets gezet"],
    };
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      for (const stamm of ["wb.fehler", "wb.widerruf"]) {
        const fassungen = [
          i18n.t(`${stamm}.unklar`),
          i18n.t(`${stamm}.unklarLaedt`),
          i18n.t(`${stamm}.unklarNichtGeladen`),
        ];
        expect(new Set(fassungen).size, `${sprache}/${stamm}: Fassungen nicht unterscheidbar`).toBe(
          3,
        );
        for (const satz of fassungen) {
          expect(satz.toLowerCase()).toContain(unklarwort[sprache] ?? "");
          for (const luege of verboten[sprache] ?? []) {
            expect(
              satz.toLowerCase(),
              `${sprache}/${stamm}: „${luege}" ist unbelegt`,
            ).not.toContain(luege);
          }
        }
        // Die gescheiterte Auffrischung SAGT, dass sie gescheitert ist — Schweigen wäre wieder die
        // stille Behauptung, der gezeigte Stand sei der jetzige.
        expect(
          i18n.t(`${stamm}.unklarNichtGeladen`).toLowerCase(),
          `${sprache}/${stamm}: der gescheiterte Nachladeversuch wird nicht benannt`,
        ).toContain((nichtGeladen[sprache] ?? "").toLowerCase());
      }
    }
    await i18n.changeLanguage("de");
  });
});

// ================================================================================================
// R15 (RUNDE 4) — EINE ANGEKOMMENE ANTWORT IST KEINE GELTENDE BEZIEHUNG (BEN-R3-W).
// ================================================================================================
//
// Der Vertrag lässt beide Fälle ausdrücklich zu: `POST` antwortet idempotent mit DERSELBEN Kante
// (gleicher `beitragSchluessel`), und `status` ist ein eigenes Feld der Ansicht. Wird die Kante
// zwischen Verlust und Wiederholung von jemandem widerrufen, kommt genau diese Kante zurück — mit
// `status: "widerrufen"`. HTTP 200 heisst dann: „das ist der Stand dieser Beziehung", nicht
// „gesetzt". Dasselbe gilt auf dem zweiten Weg: eine beantwortete Widerrufsbitte, die die Kante
// weiterhin als aktiv meldet, ist kein Widerruf.
describe("R15 · Der Antwortstatus entscheidet über den Erfolg", () => {
  it("BEN-R3-W · Antwort verloren, inzwischen widerrufen, unveränderte Wiederholung: KEIN Setzerfolg", async () => {
    const b = await montiere();
    await zielWaehlen(b, ZIEL_A.title);
    stand.p.uebertragungBricht = true;
    await b.klick(b.finde("wb-setzen-knopf"));
    expect(stand.p.kanten.length).toBe(1);

    // Zwischen Verlust und Wiederholung widerruft jemand anders genau diese Beziehung.
    const entstanden = stand.p.kanten[0];
    expect(entstanden).toBeDefined();
    if (entstanden) {
      entstanden.status = "widerrufen";
    }

    // UNVERÄNDERT wiederholen: derselbe Vorgang, derselbe Schlüssel — und die Antwort ist die
    // widerrufene Kante.
    await b.klick(b.finde("wb-setzen-knopf"));
    expect(stand.p.gesendet.length).toBe(2);
    expect(stand.p.gesendet[1]?.beitragSchluessel).toBe(stand.p.gesendet[0]?.beitragSchluessel);

    // (1) DER BESTAND: keine aktive Beziehung.
    expect(stand.p.kanten.filter((k) => k.status === "aktiv").length).toBe(0);
    // (2) DIE LISTE: leer — und (3) DER TEXT: kein Erfolg, sondern der Grund.
    expect(b.alle("wb-kante").length).toBe(0);
    expect(b.finde("wb-setzen-erfolg")).toBeNull();
    expect(b.finde("wb-widerrufene-antwort")?.textContent ?? "").toBe(
      i18n.t("wb.fehler.widerrufeneAntwort"),
    );
    // Die Eingabe bleibt vollständig erhalten.
    expect(b.finde("wb-ziel")?.textContent ?? "").toContain(ZIEL_A.title);
    expect((b.finde("wb-art") as HTMLSelectElement | null)?.value).toBe("gehoert_zu");
    b.unmount();
  });

  it("und der nächste Versuch kommt durch: neuer Vorgang, neue aktive Kante, Erfolg erst dann", async () => {
    // Die Gegenrichtung: der Schutz darf keine Sackgasse sein. Der verbrauchte Vorgang bekommt
    // einen neuen Schlüssel, und damit entsteht eine wirklich aktive Beziehung.
    const b = await montiere();
    await zielWaehlen(b, ZIEL_A.title);
    stand.p.uebertragungBricht = true;
    await b.klick(b.finde("wb-setzen-knopf"));
    const entstanden = stand.p.kanten[0];
    if (entstanden) {
      entstanden.status = "widerrufen";
    }
    await b.klick(b.finde("wb-setzen-knopf"));
    expect(b.finde("wb-widerrufene-antwort")).not.toBeNull();

    await b.klick(b.finde("wb-setzen-knopf"));
    expect(stand.p.gesendet.length).toBe(3);
    expect(stand.p.gesendet[2]?.beitragSchluessel).not.toBe(stand.p.gesendet[1]?.beitragSchluessel);
    expect(stand.p.kanten.filter((k) => k.status === "aktiv").length).toBe(1);
    expect(b.finde("wb-widerrufene-antwort")).toBeNull();
    expect(b.finde("wb-setzen-erfolg")?.textContent ?? "").toBe(i18n.t("wb.setzen.erfolg"));
    expect(b.alle("wb-kante").length).toBe(1);
    b.unmount();
  });

  it("Widerruf mit 200, aber weiterhin aktiver Kante: kein „Widerrufen“, sondern der Widerspruch", async () => {
    stand.p.kanten = kanteWiderspricht();
    stand.p.widerrufOhneWirkung = true;
    const b = await montiere();
    await b.klick(b.finde("wb-widerruf"));
    await b.klick(b.finde("wb-widerruf-ja"));

    // Der Bestand: unverändert aktiv. Der Text: kein Erfolg.
    expect(stand.p.kanten[0]?.status).toBe("aktiv");
    expect(b.finde("wb-widerruf-erfolg")).toBeNull();
    expect(b.finde("wb-widerruf-ohne-wirkung")?.textContent ?? "").toBe(
      i18n.t("wb.widerruf.nichtBestaetigt"),
    );
    // Und die Kante steht weiterhin in der aktiven Liste — sie gilt ja.
    expect(b.alle("wb-kante").length).toBe(1);
    b.unmount();
  });
});

describe("R6 · Rechte und Konflikt ohne Textverlust", () => {
  it("403: ein verständlicher Satz ohne Titel oder Kennung eines geschützten Eintrags", async () => {
    const b = await montiere();
    await zielWaehlen(b, ZIEL_B.title);
    await b.waehle(b.finde("wb-richtung"), "ungerichtet");
    stand.p.stoerung = "403";
    await b.klick(b.finde("wb-setzen-knopf"));
    const satz = b.finde("wb-schreibfehler")?.textContent ?? "";
    expect(satz).toBe(i18n.t("wb.fehler.keinRecht"));
    // Die Servermeldung wird NICHT durchgereicht — sie könnte einen geschützten Titel tragen.
    expect(satz).not.toContain("Prüfstand");
    expect(satz).not.toContain("FORBIDDEN");
    // Die Eingabe ist unverändert erhalten: Ziel, Art und Richtung stehen noch.
    expect(b.finde("wb-ziel")?.textContent ?? "").toContain(ZIEL_B.title);
    expect((b.finde("wb-richtung") as HTMLSelectElement | null)?.value).toBe("ungerichtet");
    expect(b.finde("wb-setzen-erfolg")).toBeNull();
    b.unmount();
  });

  it("409 stand_veraltet: der Satz nennt den NEUEN Stand, die Eingabe bleibt stehen", async () => {
    const b = await montiere();
    await zielWaehlen(b, ZIEL_A.title);
    // Der Bestand wandert unter dem Formular weg.
    stand.p.quelleVersion = 11;
    stand.p.zielVersionen.set(ZIEL_A.id, 6);
    await b.klick(b.finde("wb-setzen-knopf"));
    const satz = b.finde("wb-schreibfehler")?.textContent ?? "";
    expect(satz).toBe(i18n.t("wb.fehler.standVeraltet", { quelle: 11, ziel: 6 }));
    expect(satz).toMatch(/\b11\b/);
    expect(satz).toMatch(/\b6\b/);
    // Nichts wurde gesetzt, und kein stilles Neuschreiben: die Eingabe steht noch.
    expect(stand.p.kanten.length).toBe(0);
    expect(b.finde("wb-ziel")?.textContent ?? "").toContain(ZIEL_A.title);
    // Und die angezeigte Fassung des Ziels ist die NEUE — was angezeigt wird, wird auch gesendet.
    expect(b.finde("wb-ziel")?.textContent ?? "").toContain("6");
    await b.klick(b.finde("wb-setzen-knopf"));
    expect(stand.p.gesendet[1]?.gesehen).toEqual({ quelleVersion: 11, zielVersion: 6 });
    expect(stand.p.kanten.length).toBe(1);
    b.unmount();
  });
});

describe("R7 · Widerruf: Rückfrage, `version` im Rumpf, kein Wort von Löschung", () => {
  it("die Rückfrage kommt zuerst, dann geht `version` mit — und die Kante verlässt die aktive Liste", async () => {
    stand.p.kanten = kanteWiderspricht();
    const b = await montiere();
    expect(b.alle("wb-kante").length).toBe(1);
    // Kein Widerruf ohne ausdrückliche Rückfrage.
    await b.klick(b.finde("wb-widerruf"));
    expect(b.finde("wb-widerruf-frage")?.textContent ?? "").toContain(i18n.t("wb.widerruf.frage"));
    expect(b.text()).toContain(i18n.t("wb.widerruf.frageText"));
    expect(stand.p.kanten[0]?.status).toBe("aktiv");
    await b.klick(b.finde("wb-widerruf-ja"));
    expect(stand.p.kanten[0]?.status).toBe("widerrufen");
    expect(b.alle("wb-kante").length).toBe(0);
    expect(b.finde("wb-widerruf-erfolg")?.textContent ?? "").toBe(i18n.t("wb.widerruf.erfolg"));
    // Nirgends behauptet ein Text eine Löschung.
    const klein = b.text().toLowerCase();
    for (const wort of ["gelöscht", "löschen", "entfernt", "entfernen"]) {
      expect(klein, `„${wort}" darf im Widerrufsweg nicht stehen`).not.toContain(wort);
    }
    b.unmount();
  });

  it("veraltete `version`: der Server lehnt ab, die Kante bleibt aktiv, der Fehler ist sichtbar", async () => {
    stand.p.kanten = kanteWiderspricht();
    const b = await montiere();
    await b.klick(b.finde("wb-widerruf"));
    stand.p.widerrufStoerung = "409";
    await b.klick(b.finde("wb-widerruf-ja"));
    expect(stand.p.kanten[0]?.status).toBe("aktiv");
    expect(b.finde("wb-widerruf-fehler")?.textContent ?? "").toBe(i18n.t("wb.fehler.konflikt"));
    expect(b.finde("wb-widerruf-erfolg")).toBeNull();
    b.unmount();
  });

  it("die Rückfrage lässt sich zurücknehmen, ohne dass etwas gesendet wird", async () => {
    stand.p.kanten = kanteWiderspricht();
    const b = await montiere();
    await b.klick(b.finde("wb-widerruf"));
    await b.klick(b.finde("wb-widerruf-nein"));
    expect(b.finde("wb-widerruf-frage")).toBeNull();
    expect(stand.p.kanten[0]?.status).toBe("aktiv");
    b.unmount();
  });
});

describe("R8 · Das Zustandsmodell — jede Aussage hängt an ihrer Voraussetzung", () => {
  it("erfolgreich leer: „keine Beziehungen gesetzt“ samt Hinweis, was das NICHT heißt", async () => {
    const b = await montiere();
    expect(b.finde("wb-leer")?.textContent ?? "").toContain(i18n.t("wb.leer"));
    expect(b.text()).toContain(i18n.t("wb.leerHinweis"));
    const klein = b.text().toLowerCase();
    expect(klein).not.toContain("keine widersprüche");
    expect(verboteneAussage(b.text())).toEqual([]);
    b.unmount();
  });

  it("Fehler ohne Cache: ein Fehlersatz und GAR KEINE Mengenaussage", async () => {
    stand.p.listeStoerung = true;
    const b = await montiere();
    expect(b.finde("wb-fehler")?.textContent ?? "").toBe(i18n.t("wb.fehler"));
    // Kein Leersatz, keine Liste, kein Stand — über die Menge ist nichts bekannt.
    expect(b.finde("wb-leer")).toBeNull();
    expect(b.finde("wb-liste")).toBeNull();
    expect(b.finde("wb-stand")).toBeNull();
    expect(b.text()).not.toContain(i18n.t("wb.leer"));
    b.unmount();
  });

  it("laden: „Lädt …“ und keine Mengen- oder Leeraussage", async () => {
    stand.p.listeHaengt = true;
    const b = await montiere();
    expect(b.finde("wb-laedt")?.textContent ?? "").toBe(i18n.t("state.loading"));
    expect(b.finde("wb-leer")).toBeNull();
    expect(b.finde("wb-liste")).toBeNull();
    expect(b.finde("wb-fehler")).toBeNull();
    expect(b.text()).not.toContain(i18n.t("wb.leer"));
    b.unmount();
  });

  it("Cache mit LAUFENDER Auffrischung: der Stand bleibt sichtbar und ist als Stand gekennzeichnet", async () => {
    stand.p.kanten = zweiAktiveKanten();
    const b = await montiere();
    expect(b.alle("wb-kante").length).toBe(2);
    const frisch = b.finde("wb-stand")?.textContent ?? "";
    expect(frisch).toContain("Stand von");
    expect(frisch).not.toContain("Auffrischung");
    // Die Auffrischung kommt nie zurück.
    stand.p.listeHaengt = true;
    await b.auffrischen();
    // NICHTS wurde leer geräumt, und der Stand ist als nicht frisch gekennzeichnet.
    expect(b.alle("wb-kante").length).toBe(2);
    expect(b.finde("wb-stand")?.textContent ?? "").toBe(
      i18n.t("wb.standAuffrischung", { zeit: standZeit(frisch) }),
    );
    b.unmount();
  });

  it("Cache mit GESCHEITERTER Auffrischung: der alte Stand bleibt stehen UND der Fehler ist sichtbar", async () => {
    stand.p.kanten = zweiAktiveKanten();
    const b = await montiere();
    expect(b.alle("wb-kante").length).toBe(2);
    stand.p.listeStoerung = true;
    await b.auffrischen();
    // Die Werte bleiben — keine Karte, keine Zeile wird geleert (Regel 7 des Bahnvertrags).
    expect(b.alle("wb-kante").length).toBe(2);
    expect(b.text()).toContain(ZIEL_A.title);
    // Und der Stand wird NICHT als frisch ausgegeben: der Hinweis des Hauses steht da.
    expect(b.finde("auffrischung-fehlgeschlagen")?.textContent ?? "").toContain(
      "Auffrischung fehlgeschlagen",
    );
    expect(b.finde("wb-stand")).toBeNull();
    // Trotz Fehler keine falsche Mengenaussage: der Leersatz erscheint nicht.
    expect(b.finde("wb-leer")).toBeNull();
    b.unmount();
  });
});
