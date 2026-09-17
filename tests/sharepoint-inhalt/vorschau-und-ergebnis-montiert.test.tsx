// @vitest-environment jsdom
// ================================================================================================
// JOB 4232 · V — DIE FLÄCHENHÄLFTE: „INHALT ODER NUR MERKMALE", AN DER MONTIERTEN OBERFLÄCHE.
// ================================================================================================
//
// DIE LEHRE, GEGEN DIE DIESE DATEI STEHT (Codex an JOB 4125 R1, `LEHREN.md:5571`): „Ein montierter
// ZUGANGStest belegt kein Import-ERGEBNISBILD." Gebaut zu sein heisst nicht, gemessen zu sein — die
// Anzeigebedingung auf `false` zu setzen muss einen Fall ROT machen, sonst deckt ihn niemand.
//
// DIESE DATEI BETÄTIGT DEN WEG: Liste lesen → die Kennzeichnung je Datei prüfen → ankreuzen →
// übernehmen → das Ergebnisbild lesen. Gemessen werden die SICHTBAREN TEXTE gegen die WIRKLICHEN
// Sätze aus `i18n.ts` — nicht gegen Konstanten im Test und nicht gegen Schlüsselnamen.
//
// WAS ECHT IST UND WAS ATTRAPPE: Attrappe ist GENAU die Drahtgrenze
// (`components/sharepoint-import/api.ts`). Echt sind der Bereich, react-query (eigener
// `QueryClient`, `retry: false` wie im Betrieb) und i18n mit den wirklichen Sätzen. KEIN
// durchgehender Browserlauf wird behauptet — die Serverhälfte liegt in
// `weg-am-draht-und-neustart.test.ts`, diese Hälfte an der Fläche.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TXT = "01NOTIZTXT";
const DOCX = "01ANWEISUNGDOCX";
const LEER = "01LEERTXT";
const RIESIG = "01RIESIGTXT";

interface Zeile {
  id: string;
  name: string;
  url: string | null;
  geaendertAm: string | null;
  groesseBytes: number | null;
  inhaltstyp: string;
}

const d = vi.hoisted(() => ({
  antwort: null as null | Record<string, unknown>,
  zeilen: [] as unknown[],
  /** Scheitert die Liste? Dann darf DANEBEN keine Inhaltszusage stehen bleiben. */
  listeScheitert: false,
  listenRufe: 0,
  /** JOB 4232 R2: die GEMESSENEN Befunde je Kennung — das, was ein echter Inhaltsabruf ergäbe. */
  befunde: {} as Record<string, string>,
  /** Scheitert die Messung? Dann gibt es KEINE positive Zusage (bens Korrekturpflicht 2). */
  messungScheitert: false,
  /** JOB 4232 R3: Fehler OHNE deutbaren Code — der Offlinefall. */
  messungBricht: false,
  /** JOB 4232 R3: hält die Messung an, damit der LAUFENDE Zustand messbar wird. */
  haltMessung: null as Promise<void> | null,
  /** Mit welchen Kennungen wurde WIRKLICH gemessen — die Auswahl wird nicht geglaubt. */
  gemessenMit: [] as string[][],
  /** Wie oft die Übernahme WIRKLICH gerufen wurde. Ein gesperrter Knopf muss 0 bedeuten. */
  uebernahmeRufe: 0,
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
      if (d.listeScheitert) {
        throw new Error("Liste nicht abrufbar");
      }
      return { dateien: d.zeilen, truncated: false, nurBefunde: false, befunde: [] };
    },
    inhalte: async (ids: string[]) => {
      d.gemessenMit.push([...ids]);
      if (d.haltMessung) {
        // Der LAUFENDE Zustand, angehalten: nur so ist messbar, was die Fläche tut, WÄHREND sie
        // wartet (bens Korrekturpflicht 3).
        await d.haltMessung;
      }
      if (d.messungBricht) {
        // Kein deutbarer Code — der Offlinefall. Die Fläche fällt auf „Verbindung weg".
        throw new Error("offline");
      }
      if (d.messungScheitert) {
        // Genau bens Fall: die Quelle verweigert den Inhalt. Die Fläche darf daraus keine Zusage
        // machen — der Code ist derselbe, den die Serverhälfte misst (`SHAREPOINT_FORBIDDEN`).
        //
        // ERST HIER GEHOLT, nicht als Kopfimport: die Attrappen-Fabrik wird VOR den Importen dieser
        // Datei ausgeführt, ein Kopfimport läge dann in der zeitlichen Totzone. Zur Aufrufzeit ist
        // das Modul längst da — und es ist der ECHTE Fehlertyp, nicht ein nachgebauter, sonst
        // träfe die Abbildung `err instanceof ApiError → Code → Satz` gar nicht zu.
        const { ApiError } = await import("../../apps/web/src/api/client");
        throw new ApiError(403, "SHAREPOINT_FORBIDDEN", "Keine Leseberechtigung.");
      }
      return {
        dateien: [],
        truncated: false,
        nurBefunde: true,
        befunde: ids
          .filter((id) => d.befunde[id] !== undefined)
          .map((id) => ({ id, befund: d.befunde[id] })),
      };
    },
    uebernehmen: async () => {
      d.uebernahmeRufe += 1;
      return d.antwort;
    },
  },
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "admin" }) }));

import {
  QueryClient,
  QueryClientProvider,
  // JOB 4232 R4: der ECHTE Onlineschalter von react-query — derselbe, den der Browser bedient.
  // Ein selbstgebauter Offlinezustand wäre wieder nur ein geworfener Fehler (bens Befund).
  onlineManager,
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
const traeger = (): string[] =>
  [...container.querySelectorAll<HTMLElement>("[data-testid]")].map(
    (el) => el.dataset.testid ?? "",
  );

function zeile(
  id: string,
  name: string,
  inhaltstyp: string,
  geaendertAm = "2026-09-12T09:15:00Z",
): Zeile {
  return {
    id,
    name,
    url: null,
    geaendertAm,
    groesseBytes: 12,
    inhaltstyp,
  };
}

const VIER_ZEILEN: Zeile[] = [
  zeile(TXT, "Wartungsnotiz.txt", "text"),
  zeile(DOCX, "Wartungsanweisung.docx", "nur-merkmale"),
  zeile(LEER, "Leer.txt", "leer"),
  zeile(RIESIG, "Riesig.txt", "zu-gross"),
];

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
  // (`enabled: istVerwalter && benutzbar`). Gewartet wird deshalb nicht pauschal, sondern bis die
  // Liste WIRKLICH steht — an einem Knoten des Bildes gemessen und nicht an einem Zähler, der über
  // mehrere Montierungen derselben Datei weiterläuft. Harte Obergrenze: ein Ausbleiben wird ein
  // Fehler und keine Endlosschleife.
  const ersteZeile = (d.zeilen[0] as { id?: string } | undefined)?.id;
  // Gewartet wird auf den AUSGANG der Liste — Zeile oder Fehlersatz. Beides sind Endzustände; nur
  // auf einen von beiden zu warten hiesse, den anderen Fall gegen ein noch ladendes Bild zu messen.
  const steht = (): boolean =>
    knoten("sharepoint-listenfehler") !== null ||
    (ersteZeile !== undefined && knoten(`sharepoint-datei-${ersteZeile}`) !== null);
  for (let i = 0; i < 20 && !steht(); i++) {
    await act(flush);
  }
  await act(flush);
}

/**
 * Der Weg eines Menschen: ankreuzen, warten, drücken, lesen. Vorbedingungen werden GEMESSEN.
 *
 * JOB 4232 R3: Der Knopf ist seit dieser Runde an eine abgeschlossene, gültige Messung GEBUNDEN
 * (bens Korrekturpflicht 3). Dieser Weg stellt sie deshalb ausdrücklich her — sonst misst er ein
 * Ergebnisbild, das ein Mensch gar nicht auslösen könnte.
 */
async function uebernimm(antwort: Record<string, unknown>): Promise<void> {
  d.antwort = antwort;
  if (d.befunde[TXT] === undefined) {
    d.befunde = { ...d.befunde, [TXT]: "text" };
  }
  await mount();
  await waehle(TXT);
  const knopf = knoten("sharepoint-uebernehmen") as HTMLButtonElement | null;
  expect(knopf, "der Übernahmeknopf muss da sein").not.toBeNull();
  expect(
    (knopf as HTMLButtonElement).disabled,
    `mit abgeschlossener Messung ist der Knopf offen — gesehene Träger: ${traeger().join(", ")}`,
  ).toBe(false);
  await act(async () => {
    (knopf as HTMLButtonElement).click();
    await flush();
  });
  for (let i = 0; i < 20 && knoten("sharepoint-ergebnis") === null; i++) {
    await act(flush);
  }
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  d.antwort = null;
  d.zeilen = VIER_ZEILEN;
  d.listeScheitert = false;
  d.listenRufe = 0;
  d.befunde = {};
  d.messungScheitert = false;
  d.messungBricht = false;
  d.haltMessung = null;
  d.gemessenMit = [];
  d.uebernahmeRufe = 0;
});

/**
 * „Neu laden" drücken und auf den Endzustand warten.
 *
 * JOB 4232 R3: Die AUSWAHL bleibt dabei unberührt — genau das war bens Befund an Runde 2, deren
 * Auffrischungsfall die Auswahl änderte und damit eine neue Abfrage mass statt einer Auffrischung.
 */
async function neuLaden(): Promise<void> {
  const knopf = knoten("sharepoint-neu-laden") as HTMLButtonElement | null;
  expect(knopf, "der Weg zur Auffrischung muss erreichbar sein").not.toBeNull();
  const vorher = d.gemessenMit.length;
  await act(async () => {
    (knopf as HTMLButtonElement).click();
    await flush();
  });
  for (let i = 0; i < 20 && d.gemessenMit.length === vorher; i++) {
    await act(flush);
  }
  await act(flush);
}

/** Kreuzt eine Zeile an und wartet, bis die Messung ihren Endzustand erreicht hat. */
async function waehle(id: string): Promise<void> {
  const kaestchen = knoten(`sharepoint-datei-${id}`) as HTMLInputElement | null;
  expect(kaestchen, `${id} muss zum Ankreuzen dastehen`).not.toBeNull();
  await act(async () => {
    (kaestchen as HTMLInputElement).click();
    await flush();
  });
  // Gewartet wird auf den AUSGANG der Messung — Befund am Abzeichen oder Fehlersatz. Auf einen
  // festen Zeitwert zu warten hiesse, den Ladezustand zufällig mitzumessen.
  for (
    let i = 0;
    i < 20 &&
    knoten("sharepoint-probefehler") === null &&
    (knoten(`sharepoint-inhaltstyp-${id}`)?.dataset.gemessen ?? "") === "";
    i++
  ) {
    await act(flush);
  }
}

afterEach(() => {
  abbauen();
});

describe("JOB 4232 · V1 — die Vorschau unterscheidet VOR der Annahme", () => {
  it("jede der vier Zeilen trägt ihren eigenen Satz, und keine trägt den einer anderen", async () => {
    await mount();

    // JOB 4232 RUNDE 2: Vor der Messung ist die Textzeile eine ANKÜNDIGUNG und keine Zusage —
    // „Inhalt kommt mit" stünde hier ohne Deckung (bens Korrekturpflicht 2). Die drei anderen
    // Befunde sind an den Merkmalen bereits entschieden und bleiben, was sie waren.
    const erwartet: [string, string][] = [
      [TXT, "imp.sharepoint.vorschau.textdatei"],
      [DOCX, "imp.sharepoint.vorschau.nurMerkmale"],
      [LEER, "imp.sharepoint.vorschau.leer"],
      [RIESIG, "imp.sharepoint.vorschau.zuGross"],
    ];
    for (const [id, key] of erwartet) {
      const gesehen = text(`sharepoint-inhaltstyp-${id}`);
      expect(gesehen, `${id}: gesehene Träger ${traeger().join(", ")}`).toBe(i18n.t(key));
    }
    // Und die vier Sätze sind WIRKLICH verschieden — sonst unterschiede die Fläche nichts.
    const saetze = erwartet.map(([, key]) => i18n.t(key));
    expect(new Set(saetze).size).toBe(4);
    // OHNE AUSWAHL WIRD NICHTS GEMESSEN: ein Blick in die Liste lädt nicht die halbe Bibliothek.
    expect(d.gemessenMit).toEqual([]);
    // Und die Zusage steht nirgends im Bild, solange nichts gemessen ist.
    expect(container.textContent ?? "").not.toContain(i18n.t("imp.sharepoint.vorschau.text"));
  });

  it("die Regel VOR dem Import sagt nicht mehr, der Inhalt werde nie gelesen", async () => {
    await mount();
    const bild = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(bild).toContain(i18n.t("imp.sharepoint.inhaltRegel"));
    // Der abgelöste Satz aus JOB 4086 steht nicht mehr da — er wäre für `.txt` falsch.
    expect(bild).not.toContain(i18n.t("imp.sharepoint.ohneInhalt"));
  });

  it("ein unbekannter Befund zeigt GAR NICHTS statt eines geratenen Satzes", async () => {
    d.zeilen = [zeile(TXT, "Rätsel.txt", "etwas-ganz-neues")];
    await mount();
    // Die Zeile selbst ist da (sie ist wählbar) — nur die Aussage über ihren Inhalt fehlt.
    expect(knoten(`sharepoint-datei-${TXT}`)).not.toBeNull();
    expect(knoten(`sharepoint-inhaltstyp-${TXT}`)).toBeNull();
    expect(container.textContent ?? "").not.toContain("etwas-ganz-neues");
  });

  it("scheitert der ERSTE Abruf, steht der Fehlersatz und keine Inhaltszusage", async () => {
    // Zustandsmodell §9: Eine Zusage ohne frische erfolgreiche Grundlage gibt es nicht.
    d.listeScheitert = true;
    await mount();
    expect(knoten("sharepoint-listenfehler")).not.toBeNull();
    expect(knoten(`sharepoint-inhaltstyp-${TXT}`)).toBeNull();
    expect(knoten(`sharepoint-datei-${TXT}`)).toBeNull();
    // Und ohne Liste gibt es auch keinen Bedienweg zur Annahme.
    expect(knoten("sharepoint-uebernehmen")).toBeNull();
  });

  // ------------------------------------------------------------------------------------------------
  // JOB 4232 RUNDE 2 — DIE ECHTE AUFFRISCHUNG (bens Prüflücke 6).
  // ------------------------------------------------------------------------------------------------
  //
  // DER BEFUND: „Der angebliche Auffrischungstest startet bereits mit Fehler und prüft keinen
  // vorher gefüllten Cache." Ben hat recht — ein Abruf, der nie gelang, hat auch nichts, was
  // stehenbleiben könnte. Der harte Fall ist der ANDERE: erst ein erfolgreiches Bild, DANN eine
  // scheiternde Auffrischung. Genau dann hält react-query die alten Daten fest, und genau dann
  // entscheidet sich, ob die Fläche einen veralteten Stand als aktuellen ausgibt.
  it("erst erfolgreich, dann gescheiterte AUFFRISCHUNG: die alte Liste verliert ihre Gültigkeit", async () => {
    await mount();
    // (1) VORBEDINGUNG, gemessen: das Bild steht wirklich, mit Zeile und Kennzeichnung.
    expect(knoten(`sharepoint-datei-${TXT}`), "Vorbedingung: die Liste kam an").not.toBeNull();
    expect(text(`sharepoint-inhaltstyp-${TXT}`)).toBe(i18n.t("imp.sharepoint.vorschau.textdatei"));
    expect(knoten("sharepoint-listenfehler")).toBeNull();

    // (2) Die AUFFRISCHUNG scheitert — über den Knopf, den ein Mensch wirklich drückt.
    d.listeScheitert = true;
    const neuLaden = knoten("sharepoint-neu-laden") as HTMLButtonElement | null;
    expect(neuLaden, "der Weg zur Auffrischung muss erreichbar sein").not.toBeNull();
    await act(async () => {
      (neuLaden as HTMLButtonElement).click();
      await flush();
    });
    for (let i = 0; i < 20 && knoten("sharepoint-listenfehler") === null; i++) {
      await act(flush);
    }

    // (3) DIE ALTE LISTE IST WEG — mit ihr jede Aussage über den Inhalt und jeder Bedienweg.
    // Eine gecachte Zeile ist kein erfolgreiches Nachlesen.
    expect(knoten("sharepoint-listenfehler"), "der Fehlersatz steht").not.toBeNull();
    expect(knoten(`sharepoint-datei-${TXT}`), "die alte Zeile bleibt NICHT stehen").toBeNull();
    expect(knoten(`sharepoint-inhaltstyp-${TXT}`)).toBeNull();
    expect(knoten("sharepoint-uebernehmen")).toBeNull();
  });
});

// ==================================================================================================
// JOB 4232 RUNDE 2 · V3 — DIE ZUSAGE FÄLLT ERST NACH DER MESSUNG (bens Korrekturpflicht 2).
// ==================================================================================================
//
// Die Serverhälfte liegt in `weg-am-draht-und-neustart.test.ts` (W3); beide hängen an demselben
// Fehlercode. Hier wird gemessen, was ein Mensch SIEHT.
describe("JOB 4232 · V3 — gemessene Zusage statt Ankündigung", () => {
  it("nach dem Ankreuzen wird WIRKLICH gemessen, und erst dann steht die Zusage da", async () => {
    d.befunde = { [TXT]: "text" };
    await mount();
    // Vorher: die Ankündigung.
    expect(text(`sharepoint-inhaltstyp-${TXT}`)).toBe(i18n.t("imp.sharepoint.vorschau.textdatei"));

    await waehle(TXT);

    // Die Messung lief WIRKLICH — und mit genau dieser Kennung, nicht auf Verdacht mit allen.
    expect(d.gemessenMit).toEqual([[TXT]]);
    // Und jetzt, und erst jetzt, steht die Zusage da.
    expect(text(`sharepoint-inhaltstyp-${TXT}`)).toBe(i18n.t("imp.sharepoint.vorschau.text"));
    expect(knoten(`sharepoint-inhaltstyp-${TXT}`)?.dataset.gemessen).toBe("text");
    // Die nicht gewählten Zeilen bleiben bei ihrer Ankündigung — gemessen wurde nur die gewählte.
    expect(text(`sharepoint-inhaltstyp-${DOCX}`)).toBe(
      i18n.t("imp.sharepoint.vorschau.nurMerkmale"),
    );
  });

  it("die MESSUNG schlägt die Ankündigung: `text` angekündigt, `unlesbar` gemessen", async () => {
    // Die Merkmale versprechen Text (`inhaltstyp: "text"`), die Bytes halten es nicht. Was der
    // Mensch liest, ist der Messwert.
    d.befunde = { [TXT]: "unlesbar" };
    await mount();
    await waehle(TXT);

    expect(text(`sharepoint-inhaltstyp-${TXT}`)).toBe(i18n.t("imp.sharepoint.vorschau.unlesbar"));
    expect(knoten(`sharepoint-inhaltstyp-${TXT}`)?.dataset.gemessen).toBe("unlesbar");
    // Und die Zusage steht nirgends mehr im Bild.
    expect(container.textContent ?? "").not.toContain(i18n.t("imp.sharepoint.vorschau.text"));
  });

  it("verweigert die Quelle den Inhalt (403), steht der Fehlersatz — und KEINE Zusage", async () => {
    // BENS FALL, wörtlich: „Download antwortet 403; Vorschau meldet trotzdem `text`."
    d.messungScheitert = true;
    await mount();
    await waehle(TXT);

    // Der Satz aus den vier Lagen — derselbe Katalog wie überall, kein roher Code.
    expect(text("sharepoint-probefehler")).toBe(i18n.t("imp.sharepoint.fehler.keineBerechtigung"));
    const bild = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(bild, "kein Servercode auf der Fläche").not.toContain("SHAREPOINT_FORBIDDEN");
    expect(bild, "und keine Zusage über den Inhalt").not.toContain(
      i18n.t("imp.sharepoint.vorschau.text"),
    );
    // Die Zeile fällt auf ihre Ankündigung zurück — sie behauptet nichts Gemessenes.
    expect(text(`sharepoint-inhaltstyp-${TXT}`)).toBe(i18n.t("imp.sharepoint.vorschau.textdatei"));
    expect(knoten(`sharepoint-inhaltstyp-${TXT}`)?.dataset.gemessen).toBe("");
  });

  it("erst gemessen, dann scheitert die Messung: die Zusage wird ZURÜCKGENOMMEN", async () => {
    // Derselbe harte Fall wie bei der Liste, eine Ebene tiefer (§9): ein alter Messwert darf eine
    // gescheiterte Auffrischung nicht überleben.
    d.befunde = { [TXT]: "text" };
    await mount();
    await waehle(TXT);
    expect(text(`sharepoint-inhaltstyp-${TXT}`), "Vorbedingung: die Zusage stand").toBe(
      i18n.t("imp.sharepoint.vorschau.text"),
    );

    // Die zweite Datei dazunehmen — das ist eine NEUE Messung derselben Fläche, und sie scheitert.
    d.messungScheitert = true;
    await waehle(DOCX);

    expect(knoten("sharepoint-probefehler"), "der Fehlersatz steht").not.toBeNull();
    const bild = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(bild, "die alte Zusage ist zurückgenommen").not.toContain(
      i18n.t("imp.sharepoint.vorschau.text"),
    );
    expect(knoten(`sharepoint-inhaltstyp-${TXT}`)?.dataset.gemessen).toBe("");
  });
});

// ==================================================================================================
// JOB 4232 RUNDE 3 · V4 — „NEU LADEN" ENTWERTET DIE ALTE ZUSAGE (bens Korrekturpflicht 2).
// ==================================================================================================
//
// BENS MESSUNG: „Erfolgreiche Inhaltsprüfung, danach geänderte Dateiversion und ‚Neu laden': Alte
// Zusage bleibt stehen → expected 'Inhalt kommt mit' to be 'nicht als Text lesbar'." Und sein
// Befund zur Testaussagekraft: der Auffrischungsfall aus Runde 2 änderte die AUSWAHL und damit den
// Abfrageschlüssel — er mass also eine neue Abfrage, nicht die Auffrischung derselben.
//
// DIESE FÄLLE ÄNDERN DIE AUSWAHL NICHT. Sie drücken den sichtbaren Knopf.
describe("JOB 4232 · V4 — Auffrischen bei UNVERÄNDERTER Auswahl", () => {
  it("die Datei ändert sich, „Neu laden“ bringt den NEUEN Befund — nicht den alten", async () => {
    d.befunde = { [TXT]: "text" };
    await mount();
    await waehle(TXT);
    expect(text(`sharepoint-inhaltstyp-${TXT}`), "Vorbedingung: die Zusage stand").toBe(
      i18n.t("imp.sharepoint.vorschau.text"),
    );

    // Die Quelle ändert sich WIRKLICH: neuer Stand, anderer Inhalt. Die AUSWAHL bleibt dieselbe.
    d.zeilen = [
      zeile(TXT, "Wartungsnotiz.txt", "text", "2026-09-14T17:05:00Z"),
      ...VIER_ZEILEN.slice(1),
    ];
    d.befunde = { [TXT]: "unlesbar" };
    await neuLaden();

    expect(text(`sharepoint-inhaltstyp-${TXT}`), "der NEUE Befund steht da").toBe(
      i18n.t("imp.sharepoint.vorschau.unlesbar"),
    );
    expect(knoten(`sharepoint-inhaltstyp-${TXT}`)?.dataset.gemessen).toBe("unlesbar");
    expect(
      (container.textContent ?? "").replace(/\s+/g, " "),
      "die Zusage von vorhin ist weg",
    ).not.toContain(i18n.t("imp.sharepoint.vorschau.text"));
    // Und es wurde WIRKLICH erneut gemessen, mit DERSELBEN Auswahl. Die genaue Anzahl wird nicht
    // festgenagelt: mit dem neuen Dateistand entsteht auch ein neuer Messschlüssel, und wie oft
    // react-query dabei anfragt, ist seine Sache und nicht die Zusage dieses Falls.
    expect(d.gemessenMit.length, "nach dem Auffrischen wurde neu gemessen").toBeGreaterThan(1);
    expect(d.gemessenMit.every((ids) => ids.join(",") === TXT)).toBe(true);
  });

  it("auch OHNE Änderung wird neu gemessen — und ein 403 nimmt die Zusage zurück", async () => {
    d.befunde = { [TXT]: "text" };
    await mount();
    await waehle(TXT);
    expect(text(`sharepoint-inhaltstyp-${TXT}`)).toBe(i18n.t("imp.sharepoint.vorschau.text"));

    // Nichts an der Datei ändert sich — nur die Quelle verweigert jetzt den Inhalt.
    d.messungScheitert = true;
    await neuLaden();

    expect(d.gemessenMit, "auffrischen heisst erneut messen").toEqual([[TXT], [TXT]]);
    expect(text("sharepoint-probefehler")).toBe(i18n.t("imp.sharepoint.fehler.keineBerechtigung"));
    expect(
      (container.textContent ?? "").replace(/\s+/g, " "),
      "keine Zusage auf gescheiterter Grundlage",
    ).not.toContain(i18n.t("imp.sharepoint.vorschau.text"));
  });
});

// ==================================================================================================
// JOB 4232 RUNDE 3 · V5 — OHNE GÜLTIGE MESSUNG KEINE ÜBERNAHME (bens Korrekturpflicht 3).
// ==================================================================================================
//
// BENS MESSUNG: „Laufende beziehungsweise mit 403 gescheiterte Inhaltsprüfung: Übernahmeknopf bleibt
// aktiviert → jeweils `expected false to be true`." Die Messung war eine Anzeige, keine Bedingung.
describe("JOB 4232 · V5 — der Übernahmeknopf wartet auf die Messung", () => {
  const knopf = (): HTMLButtonElement | null =>
    knoten("sharepoint-uebernehmen") as HTMLButtonElement | null;

  it("WÄHREND die Messung läuft: gesperrt, mit sichtbarem Grund", async () => {
    // Die Messung wird angehalten — genau der Zustand, in dem Ben übernehmen konnte.
    let freigeben: (() => void) | null = null;
    d.haltMessung = new Promise<void>((fertig) => {
      freigeben = fertig;
    });
    d.befunde = { [TXT]: "text" };
    await mount();
    const kaestchen = knoten(`sharepoint-datei-${TXT}`) as HTMLInputElement;
    await act(async () => {
      kaestchen.click();
      await flush();
    });

    expect(knopf()?.disabled, "kein Import auf unbekannter Grundlage").toBe(true);
    expect(text("sharepoint-wartegrund")).toBe(i18n.t("imp.sharepoint.pruefungLaeuft"));

    // Und sobald die Messung da ist, geht er auf — der Weg ist keine Sackgasse.
    (freigeben as unknown as () => void)();
    for (let i = 0; i < 20 && knopf()?.disabled !== false; i++) {
      await act(flush);
    }
    expect(knopf()?.disabled, "nach der Messung ist der Weg offen").toBe(false);
    expect(knoten("sharepoint-wartegrund")).toBeNull();
  });

  it("NACH einem 403 (auch offline): gesperrt, und der Fehlersatz steht", async () => {
    d.messungScheitert = true;
    await mount();
    await waehle(TXT);

    expect(knopf()?.disabled, "kein Import nach gescheiterter Messung").toBe(true);
    expect(text("sharepoint-probefehler")).toBe(i18n.t("imp.sharepoint.fehler.keineBerechtigung"));
    // Der Fehlersatz IST der Grund — ein zweiter daneben wäre doppelt gemoppelt.
    expect(knoten("sharepoint-wartegrund")).toBeNull();
    expect(d.uebernahmeRufe, "es wurde nichts übernommen").toBe(0);
  });

  it("OFFLINE (Fehler ohne deutbaren Code): ebenfalls gesperrt", async () => {
    d.messungBricht = true;
    await mount();
    await waehle(TXT);

    expect(knopf()?.disabled).toBe(true);
    expect(text("sharepoint-probefehler")).toBe(i18n.t("imp.sharepoint.fehler.verbindungWeg"));
    expect(d.uebernahmeRufe).toBe(0);
  });

  it("liegt zu EINER gewählten Datei kein Befund vor, bleibt alles zu — mit Grund", async () => {
    // Zwei Dateien gewählt, nur zu einer gibt es ein Ergebnis. Über die andere weiss niemand etwas,
    // und „unbekannt" ist kein Grund zu importieren.
    d.befunde = { [TXT]: "text" };
    await mount();
    await waehle(TXT);
    await waehle(DOCX);

    expect(knopf()?.disabled).toBe(true);
    expect(text("sharepoint-wartegrund")).toBe(i18n.t("imp.sharepoint.pruefungFehlt"));
    expect(d.uebernahmeRufe).toBe(0);
  });

  it("KALIBRIERUNG: mit vollständiger Messung geht die Übernahme wirklich durch", async () => {
    // Ohne diesen Fall wäre eine Sperre, die IMMER zu ist, ebenfalls grün — und der Import tot.
    d.befunde = { [TXT]: "text", [DOCX]: "nur-merkmale" };
    await mount();
    await waehle(TXT);
    await waehle(DOCX);

    expect(knopf()?.disabled).toBe(false);
    expect(knoten("sharepoint-wartegrund")).toBeNull();
  });
});

// ================================================================================================
// JOB 4232 · V6 — DER PAUSIERTE OFFLINEABRUF (bens Korrekturpflicht 2 aus Runde 3).
// ================================================================================================
//
// BENS BEFUND, wörtlich: „ein geworfener Netzwerkfehler ersetzt keinen pausierten Offlineabruf mit
// Cache." Er hat recht, und der Fall V5 „OFFLINE" oben beweist das Gegenteil von dem, was sein Name
// sagt: Dort WIRFT die Attrappe (`d.messungBricht`) — der Abruf läuft also, er scheitert nur. Der
// echte Offlinezustand sieht anders aus: react-query fährt den Abruf GAR NICHT ERST, er steht auf
// `paused`, und der Befund von vorhin bleibt als `data` liegen. `isError` ist dabei `false`,
// `isFetching` ebenfalls — die zwei Grössen, an denen Runde 3 ihre ganze Sperre aufgehängt hatte.
//
// GEMESSEN WIRD DER WEG, DEN BEN GEGANGEN IST: erfolgreiche Vorschau → offline → unveränderte
// Auswahl auffrischen → es darf keine Zusage und keine Übernahme mehr geben. Und danach der Rückweg,
// ohne den die Sperre eine Sackgasse wäre: wieder online → erneut gemessen → wieder bedienbar.
describe("JOB 4232 · V6 — offline pausiert der Abruf, und ein alter Befund trägt keine Zusage", () => {
  const knopf = (): HTMLButtonElement | null =>
    knoten("sharepoint-uebernehmen") as HTMLButtonElement | null;

  afterEach(() => {
    // Der Onlinezustand ist global — er darf keinen anderen Fall dieser Datei erreichen.
    onlineManager.setOnline(true);
  });

  it("erfolgreiche Vorschau → offline → auffrischen: Fehlersatz, keine Zusage, kein apply", async () => {
    d.befunde = { [TXT]: "text" };
    await mount();
    await waehle(TXT);

    // (1) VORBEDINGUNG, gemessen: die Zusage steht wirklich da, und der Knopf ist offen.
    expect(text(`sharepoint-inhaltstyp-${TXT}`)).toBe(i18n.t("imp.sharepoint.vorschau.text"));
    expect(knopf()?.disabled, "Vorbedingung: mit frischer Messung ist der Knopf offen").toBe(false);
    const messungenVorher = d.gemessenMit.length;

    // (2) OFFLINE. Und dann auffrischen, bei UNVERÄNDERTER Auswahl — bens Weg.
    onlineManager.setOnline(false);
    const neuLadenKnopf = knoten("sharepoint-neu-laden") as HTMLButtonElement | null;
    expect(neuLadenKnopf, "der Weg zur Auffrischung muss erreichbar sein").not.toBeNull();
    await act(async () => {
      (neuLadenKnopf as HTMLButtonElement).click();
      await flush();
    });
    await act(flush);

    // (3) DER ABRUF LIEF GAR NICHT — das ist der Unterschied zu einem geworfenen Fehler.
    expect(
      d.gemessenMit.length,
      "offline darf keine neue Messung hinausgehen (sie ist pausiert)",
    ).toBe(messungenVorher);

    // (4) KEINE ZUSAGE MEHR. Der alte Befund liegt noch im Cache — er darf nichts mehr tragen.
    expect(
      text(`sharepoint-inhaltstyp-${TXT}`),
      `die Zusage von vorhin steht noch da — gesehene Träger: ${traeger().join(", ")}`,
    ).not.toBe(i18n.t("imp.sharepoint.vorschau.text"));
    expect(knoten(`sharepoint-inhaltstyp-${TXT}`)?.dataset.gemessen ?? "").toBe("");

    // (5) EIN FEHLERSATZ AUS DEN VIER LAGEN — kein Code, kein Schweigen.
    expect(text("sharepoint-probefehler")).toBe(i18n.t("imp.sharepoint.fehler.verbindungWeg"));

    // (6) KEIN apply. Gesperrt — und der Druck darauf löst wirklich nichts aus.
    expect(knopf()?.disabled, "offline gibt es keine Übernahme").toBe(true);
    await act(async () => {
      knopf()?.click();
      await flush();
    });
    expect(d.uebernahmeRufe, "es wurde nichts übernommen").toBe(0);
  });

  it("wieder online: es wird ERNEUT gemessen, und erst dann ist der Weg wieder offen", async () => {
    // Ohne diesen Fall wäre eine Sperre, die offline zuschnappt und nie wieder aufgeht, ebenfalls
    // grün — und der Import nach jedem Verbindungsabriss tot.
    d.befunde = { [TXT]: "text" };
    await mount();
    await waehle(TXT);
    onlineManager.setOnline(false);
    const neuLadenKnopf = knoten("sharepoint-neu-laden") as HTMLButtonElement;
    await act(async () => {
      neuLadenKnopf.click();
      await flush();
    });
    await act(flush);
    expect(knopf()?.disabled, "Vorbedingung: offline ist zu").toBe(true);
    const messungenVorher = d.gemessenMit.length;

    // Zurück ins Netz: react-query nimmt den pausierten Abruf von selbst wieder auf.
    onlineManager.setOnline(true);
    for (let i = 0; i < 25 && knopf()?.disabled !== false; i++) {
      await act(flush);
    }

    expect(
      d.gemessenMit.length,
      "nach dem Rückweg muss WIRKLICH neu gemessen worden sein",
    ).toBeGreaterThan(messungenVorher);
    expect(text(`sharepoint-inhaltstyp-${TXT}`)).toBe(i18n.t("imp.sharepoint.vorschau.text"));
    expect(knoten("sharepoint-probefehler")).toBeNull();
    expect(knopf()?.disabled, "nach erfolgreicher erneuter Messung wieder bedienbar").toBe(false);
  });
});

describe("JOB 4232 · V2 — das Ergebnisbild sagt, was WIRKLICH ankam", () => {
  const MIT_INHALT = {
    imported: 1,
    alreadyQueued: 0,
    neuerStand: [],
    failed: [],
    notFound: [],
    ohneInhalt: [],
    dateien: [
      {
        id: TXT,
        name: "Wartungsnotiz.txt",
        url: null,
        geaendertAm: "2026-09-12T09:15:00Z",
        inhalt: "text",
      },
    ],
  };

  const NICHTS_GETRAGEN = {
    imported: 0,
    alreadyQueued: 0,
    neuerStand: [],
    failed: [],
    notFound: [],
    ohneInhalt: [
      { id: LEER, befund: "leer" },
      { id: RIESIG, befund: "zu-gross" },
      { id: "01KAPUTTTXT", befund: "unlesbar" },
    ],
    dateien: [],
  };

  it("eine übernommene Textdatei steht mit ihrem Inhaltsbefund im Bild", async () => {
    await uebernimm(MIT_INHALT);
    expect(text(`sharepoint-ergebnis-inhalt-${TXT}`)).toBe(
      i18n.t("imp.sharepoint.uebernommen.text"),
    );
    expect(knoten("sharepoint-ohne-inhalt")).toBeNull();
  });

  it("was nicht getragen hat, steht EINZELN mit seinem eigenen Grund da", async () => {
    await uebernimm(NICHTS_GETRAGEN);

    expect(knoten("sharepoint-ohne-inhalt")).not.toBeNull();
    expect(text(`sharepoint-ohne-inhalt-${LEER}`)).toBe(
      i18n.t("imp.sharepoint.nichtUebernommen.leer"),
    );
    expect(text(`sharepoint-ohne-inhalt-${RIESIG}`)).toBe(
      i18n.t("imp.sharepoint.nichtUebernommen.zuGross"),
    );
    expect(text("sharepoint-ohne-inhalt-01KAPUTTTXT")).toBe(
      i18n.t("imp.sharepoint.nichtUebernommen.unlesbar"),
    );
    // Die drei Gründe sind WIRKLICH verschieden — ein Sammelsatz wäre keine Auskunft.
    expect(
      new Set([
        text(`sharepoint-ohne-inhalt-${LEER}`),
        text(`sharepoint-ohne-inhalt-${RIESIG}`),
        text("sharepoint-ohne-inhalt-01KAPUTTTXT"),
      ]).size,
    ).toBe(3);
  });

  it("die drei Sätze stehen in EN und NL in ihrer eigenen Sprache — kein deutscher, kein Schlüssel", async () => {
    const deutsch = ["leer", "zuGross", "unlesbar"].map((k) =>
      i18n.getFixedT("de")(`imp.sharepoint.nichtUebernommen.${k}`),
    );
    for (const sprache of ["en", "nl"] as const) {
      await i18n.changeLanguage(sprache);
      await uebernimm(NICHTS_GETRAGEN);
      const bild = (knoten("sharepoint-ohne-inhalt")?.textContent ?? "").replace(/\s+/g, " ");
      for (const k of ["leer", "zuGross", "unlesbar"]) {
        const satz = i18n.t(`imp.sharepoint.nichtUebernommen.${k}`);
        expect(satz, `${sprache}/${k}: kein Schlüssel als Text`).not.toContain("imp.sharepoint");
        expect(bild, `${sprache}/${k}`).toContain(satz);
      }
      for (const satz of deutsch) {
        expect(bild, `${sprache}: kein deutscher Satz im fremdsprachigen Bild`).not.toContain(satz);
      }
      abbauen();
    }
  });
});
