// @vitest-environment jsdom
// ================================================================================================
// JOB 4125 · E — DAS ERGEBNISBILD DES WIEDERHOLIMPORTS, AN DER MONTIERTEN FLÄCHE.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT (Codex, Runde 1, Korrekturpflicht 1): Die Oberflächen-
// hälfte von Lieferung 4 war GEBAUT, aber NICHT GEMESSEN. Codex hat es vorgeführt — beide neuen
// Anzeigebedingungen in `SharePointImportBereich.tsx` auf `false` gesetzt, und die 21 Fälle der
// Gruppe blieben grün. Ein montierter ZUGANGStest belegt kein Import-ERGEBNISBILD: die Datei
// `zugangsauskunft-faellt-aus.test.tsx` betätigt keinen Übernahmeknopf und liefert eine leere
// Übernahmeattrappe.
//
// DIESE DATEI BETÄTIGT DEN WEG: Datei ankreuzen → „Ausgewählte Dateien importieren" drücken → das
// Ergebnisbild lesen. Gemessen werden die SICHTBAREN TEXTE gegen die Zahlen, die die Antwort
// WIRKLICH führt — nicht gegen Konstanten im Test.
//
// ================================================================================================
// DIE DREI AUSGÄNGE DES WIEDERHOLIMPORTS AUF DER FLÄCHE — UND WARUM SIE SICH UNTERSCHEIDEN MÜSSEN.
// ================================================================================================
//
//   ERSTIMPORT              → die Datei steht im Bild. Kein „nichts Neues", kein „neuerer Stand":
//                             beide Sätze wären hier falsch.
//   UNVERÄNDERT, ZUM ZWEITEN→ `dateien` ist leer und `alreadyQueued` zählt. Bis JOB 4125 stand
//                             unter „Aus SharePoint geholt" dann GAR NICHTS, und der Mensch musste
//                             aus dem Fehlen schliessen, was geschehen ist.
//   GEÄNDERT, ZUM ZWEITEN   → `imported` zählt wie bei einer Erstanlage, aber zu derselben Quelle
//                             wartet ein ÄLTERER Vorgang. Ohne den Satz sieht dieser Ausgang aus
//                             wie ein Erstimport, und die zweite Zeile in der Prüfung wie eine
//                             Dublette.
//
// WAS ECHT IST UND WAS ATTRAPPE: Attrappe ist GENAU die Drahtgrenze
// (`components/sharepoint-import/api.ts`). Echt sind der Bereich, react-query (eigener
// `QueryClient`, `retry: false` wie im Betrieb), i18n mit den WIRKLICHEN Sätzen aus `i18n.ts` und
// die Zahlenbindung der Interpolation. KEIN durchgehender Browserlauf wird behauptet — die
// Serverhälfte liegt am Draht (`wiederholimport-am-draht.test.ts`), diese Hälfte an der Fläche.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DATEI_ID = "01WARTUNG7XYZ";
const DATEI_NAME = "Wartungsanweisung.docx";
const DATEI_URL =
  "https://contoso.sharepoint.test/sites/technik/Freigegeben/Wartungsanweisung.docx";
const STAND_NEU = "2026-09-14T17:05:00Z";

/** Die Antwort der Übernahme, wie der Server sie führt. Jede Probe stellt sie ein. */
interface Uebernahmeantwort {
  imported: number;
  alreadyQueued: number;
  neuerStand: string[];
  failed: { id: string; reason: string }[];
  notFound: string[];
  dateien: { id: string; name: string; url: string | null; geaendertAm: string | null }[];
}

const d = vi.hoisted(() => ({
  antwort: null as null | Record<string, unknown>,
  /** Womit die Fläche die Übernahme WIRKLICH gerufen hat — die Auswahl wird nicht geglaubt. */
  gerufenMit: [] as string[][],
  /** Wie oft die Dateiliste geholt wurde. Vorbedingung: sie wird überhaupt geholt. */
  listenRufe: 0,
}));

vi.mock("../../apps/web/src/components/sharepoint-import/api", () => ({
  sharepointApi: {
    zugang: async () => ({
      system: "sharepoint",
      enabled: true,
      credentials: [{ name: "KLARWERK_SHAREPOINT_TOKEN", present: true }],
      credentialsUsable: true,
      blocker: null,
      lastConnectedAt: null,
    }),
    dateien: async () => {
      d.listenRufe += 1;
      return {
        dateien: [
          {
            id: DATEI_ID,
            name: DATEI_NAME,
            url: DATEI_URL,
            geaendertAm: "2026-09-10T08:30:00Z",
            groesseBytes: 24_576,
          },
        ],
        truncated: false,
      };
    },
    uebernehmen: async (ids: string[]) => {
      d.gerufenMit.push([...ids]);
      return d.antwort;
    },
  },
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "admin" }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { SharePointImportBereich } from "../../apps/web/src/components/sharepoint-import/SharePointImportBereich";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const knoten = (testid: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
const text = (testid: string): string => (knoten(testid)?.textContent ?? "").replace(/\s+/g, " ");
const ergebnistext = (): string => text("sharepoint-ergebnis");
/** Alle Träger im Bild — die Fehlermeldung einer montierten Fläche soll sagen, WAS dasteht. */
const traeger = (): string[] =>
  [...container.querySelectorAll<HTMLElement>("[data-testid]")].map(
    (el) => el.dataset.testid ?? "",
  );

function abbauen(): void {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    neu.render(
      createElement(QueryClientProvider, { client: qc }, createElement(SharePointImportBereich)),
    );
    await flush();
  });
  // ZWEI Abfragen hintereinander: die Dateiliste startet erst, wenn die Zugangsauskunft da ist
  // (`enabled: istVerwalter && benutzbar`). Es wird deshalb NICHT einmal pauschal gewartet, sondern
  // bis die Liste WIRKLICH steht — mit harter Obergrenze, damit ein Ausbleiben ein Fehler wird und
  // keine Endlosschleife.
  for (let i = 0; i < 20 && !knoten(`sharepoint-datei-${DATEI_ID}`); i++) {
    await act(flush);
  }
}

/**
 * DER WEG, DEN EIN MENSCH GEHT: ankreuzen, drücken, lesen.
 *
 * Vorbedingungen werden GEMESSEN, nicht angenommen — ein Knopf, der nie freigegeben wurde, oder
 * eine Auswahl, die nie ankam, machte jede folgende Zusicherung über das Ergebnisbild wertlos.
 */
async function uebernimm(antwort: Uebernahmeantwort): Promise<void> {
  d.antwort = antwort as unknown as Record<string, unknown>;
  await mount();

  expect(d.listenRufe, "die Dateiliste wurde WIRKLICH geholt").toBeGreaterThanOrEqual(1);
  const kaestchen = knoten(`sharepoint-datei-${DATEI_ID}`) as HTMLInputElement | null;
  // Die Fehlermeldung trägt den GESEHENEN Zustand mit: ein „ist null" ohne das Bild daneben kostet
  // bei einer montierten Fläche eine ganze Runde.
  expect(
    kaestchen,
    `die Datei muss zum Ankreuzen dastehen — Listenabrufe: ${d.listenRufe}, gesehene Träger: ${traeger().join(", ") || "(keine)"}`,
  ).not.toBeNull();
  await act(async () => {
    (kaestchen as HTMLInputElement).click();
    await flush();
  });

  const knopf = knoten("sharepoint-uebernehmen") as HTMLButtonElement | null;
  expect(knopf, "der Übernahmeknopf muss da sein").not.toBeNull();
  expect((knopf as HTMLButtonElement).disabled, "mit einer Auswahl ist der Knopf freigegeben").toBe(
    false,
  );
  const vorher = d.gerufenMit.length;
  await act(async () => {
    (knopf as HTMLButtonElement).click();
    await flush();
  });
  await act(flush);
  expect(d.gerufenMit.length, "die Übernahme wurde WIRKLICH gerufen").toBe(vorher + 1);
  expect(d.gerufenMit[vorher], "und zwar mit der angekreuzten Kennung").toEqual([DATEI_ID]);
  expect(knoten("sharepoint-ergebnis"), "danach steht das Ergebnisbild da").not.toBeNull();
}

const ERSTIMPORT: Uebernahmeantwort = {
  imported: 1,
  alreadyQueued: 0,
  neuerStand: [],
  failed: [],
  notFound: [],
  dateien: [
    { id: DATEI_ID, name: DATEI_NAME, url: DATEI_URL, geaendertAm: "2026-09-10T08:30:00Z" },
  ],
};

/** Zweiter Aufruf, unveränderte Quelle: nichts eingereiht, die Datei steht schon in der Prüfung. */
const UNVERAENDERT: Uebernahmeantwort = {
  imported: 0,
  alreadyQueued: 1,
  neuerStand: [],
  failed: [],
  notFound: [],
  dateien: [],
};

/** Zweiter Aufruf, GEÄNDERTE Quelle: eingereiht — und ausdrücklich als neuerer Stand geführt. */
const NEUER_STAND: Uebernahmeantwort = {
  imported: 1,
  alreadyQueued: 0,
  neuerStand: [DATEI_ID],
  failed: [],
  notFound: [],
  dateien: [{ id: DATEI_ID, name: DATEI_NAME, url: DATEI_URL, geaendertAm: STAND_NEU }],
};

beforeEach(async () => {
  await i18n.changeLanguage("de");
  d.antwort = null;
  d.gerufenMit = [];
});

afterEach(() => {
  abbauen();
});

describe("JOB 4125 · E — das Ergebnisbild nach der Übernahme", () => {
  // ------------------------------------------------------------------------------------------------
  // E1 — DER UNVERÄNDERTE WIEDERHOLIMPORT SAGT, DASS NICHTS NEUES KAM.
  // ------------------------------------------------------------------------------------------------
  it("E1 · unverändert zum zweiten Mal: der Satz 'nichts Neues übernommen' plus der Grund — und KEIN neuer Stand", async () => {
    await uebernimm(UNVERAENDERT);

    expect(
      knoten("sharepoint-nichts-neu"),
      "die wortlose Leerstelle war der Befund aus Paket 1",
    ).not.toBeNull();
    expect(ergebnistext()).toContain(i18n.t("imp.sharepoint.nichtsNeu"));
    // Der GRUND steht daneben, und seine Zahl kommt aus der Antwort.
    expect(ergebnistext()).toContain(
      i18n.t("imp.sharepoint.schonVorgemerkt", { n: UNVERAENDERT.alreadyQueued }),
    );
    expect(
      knoten("sharepoint-neuer-stand"),
      "hier ist kein neuerer Stand gekommen — der Satz wäre eine Erfindung",
    ).toBeNull();
    // Und kein Dateiname: es wurde wirklich nichts übernommen.
    expect(ergebnistext()).not.toContain(DATEI_NAME);
  });

  // ------------------------------------------------------------------------------------------------
  // E2 — DER GEÄNDERTE WIEDERHOLIMPORT SAGT, DASS ES EIN NEUERER STAND IST.
  // ------------------------------------------------------------------------------------------------
  it("E2 · geändert zum zweiten Mal: der Satz 'neuerer Stand' steht da, mit der Zahl aus der Antwort", async () => {
    await uebernimm(NEUER_STAND);

    expect(knoten("sharepoint-neuer-stand")).not.toBeNull();
    expect(ergebnistext()).toContain(
      i18n.t("imp.sharepoint.neuerStand", { n: NEUER_STAND.neuerStand.length }),
    );
    // Die Datei selbst steht im Bild — sie wurde ja wirklich eingereiht.
    expect(ergebnistext()).toContain(DATEI_NAME);
    expect(
      knoten("sharepoint-nichts-neu"),
      "hier IST etwas übernommen worden — der Satz 'nichts Neues' wäre falsch",
    ).toBeNull();
  });

  // ------------------------------------------------------------------------------------------------
  // E3 — DIE KALIBRIERUNG. Ohne sie wären E1/E2 von „beide Sätze immer anzeigen" nicht zu trennen.
  // ------------------------------------------------------------------------------------------------
  it("E3 · Erstimport: WEDER 'nichts Neues' NOCH 'neuerer Stand' — nur die Datei", async () => {
    await uebernimm(ERSTIMPORT);

    expect(knoten("sharepoint-nichts-neu")).toBeNull();
    expect(knoten("sharepoint-neuer-stand")).toBeNull();
    expect(ergebnistext()).toContain(DATEI_NAME);
    expect(ergebnistext()).not.toContain(i18n.t("imp.sharepoint.nichtsNeu"));
  });

  // ------------------------------------------------------------------------------------------------
  // E4 — KEINE ZAHL OHNE ERZEUGER: die angezeigte Zahl IST die der Antwort, nicht eine feste 1.
  // ------------------------------------------------------------------------------------------------
  it("E4 · drei schon vorgemerkte und zwei neuere Stände erscheinen als 3 und 2, nicht als 1", async () => {
    await uebernimm({
      imported: 2,
      alreadyQueued: 3,
      neuerStand: [DATEI_ID, "01ZWEITE"],
      failed: [],
      notFound: [],
      dateien: [
        { id: DATEI_ID, name: DATEI_NAME, url: DATEI_URL, geaendertAm: STAND_NEU },
        { id: "01ZWEITE", name: "Pruefplan.docx", url: null, geaendertAm: null },
      ],
    });

    expect(ergebnistext()).toContain(i18n.t("imp.sharepoint.schonVorgemerkt", { n: 3 }));
    expect(ergebnistext()).toContain(i18n.t("imp.sharepoint.neuerStand", { n: 2 }));
    expect(ergebnistext(), "eine feste 1 wäre eine Zahl ohne Erzeuger").not.toContain(
      i18n.t("imp.sharepoint.neuerStand", { n: 1 }),
    );
  });

  // ------------------------------------------------------------------------------------------------
  // E5 — DIESELBEN ZWEI AUSSAGEN IN EN UND NL.
  // ------------------------------------------------------------------------------------------------
  //
  // „Übersetzt" heisst zweierlei, und beides wird gemessen: der Satz der EINGESTELLTEN Sprache steht
  // da (aufgelöst, nicht als Schlüssel), UND der deutsche steht nicht daneben.
  it("E5 · EN und NL zeigen beide neuen Sätze in ihrer eigenen Sprache — kein deutscher, kein Schlüssel", async () => {
    const satz = (lng: string, key: string): string => {
      const wert = i18n.getResource(lng, "translation", key);
      return typeof wert === "string" ? wert : "";
    };
    const deutschNichtsNeu = satz("de", "imp.sharepoint.nichtsNeu");
    expect(deutschNichtsNeu, "Vorbedingung: der deutsche Satz existiert").not.toBe("");

    for (const sprache of ["en", "nl"]) {
      await i18n.changeLanguage(sprache);

      // (a) der unveränderte Wiederholimport
      await uebernimm(UNVERAENDERT);
      const erwartetNichtsNeu = satz(sprache, "imp.sharepoint.nichtsNeu");
      expect(erwartetNichtsNeu, `Schlüssel fehlt in ${sprache}`).not.toBe("");
      expect(erwartetNichtsNeu, `${sprache} übersetzt nicht`).not.toBe(deutschNichtsNeu);
      expect(ergebnistext(), sprache).toContain(erwartetNichtsNeu);
      expect(ergebnistext(), `${sprache} zeigt den deutschen Satz`).not.toContain(deutschNichtsNeu);
      expect(ergebnistext(), `${sprache} zeigt einen unaufgelösten Schlüssel`).not.toContain(
        "imp.sharepoint.",
      );
      abbauen();

      // (b) der geänderte Wiederholimport — mit Zahl, also auch mit Interpolation
      await uebernimm(NEUER_STAND);
      expect(ergebnistext(), sprache).toContain(i18n.t("imp.sharepoint.neuerStand", { n: 1 }));
      expect(ergebnistext(), `${sprache} zeigt den deutschen Satz`).not.toContain(
        satz("de", "imp.sharepoint.neuerStand").replace("{{n}}", "1"),
      );
      expect(ergebnistext(), `${sprache} zeigt einen unaufgelösten Platzhalter`).not.toContain(
        "{{n}}",
      );
      abbauen();
    }
  });
});
