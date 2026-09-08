// @vitest-environment jsdom
// ================================================================================================
// JOB 3277 · D — DIE FLÄCHE SAGT VOR DEM LADEN, WAS KOMMT, UND DANACH, WAS GESCHAH.
// ================================================================================================
//
// Gemessen wird an der GEMOUNTETEN Komponente: echtes React, echtes i18n, echtes React-Query. Die
// einzige Attrappe ist die Endpunktgrenze (`api/endpoints`) — Bauform wie
// tests/wissensnetz-sichtmetrik/flaeche.test.tsx.
//
//   D1  Vor dem Laden       Beschreibung, Sprache, Umfang und „erfundene Demodaten" stehen da.
//   D2  Sprachwahrheit      Bei englischer Oberfläche steht die englische Beschreibung, nicht die deutsche.
//   D3  Laden               Der Knopf ruft den Ladeweg und die Bilanz nennt beide Zahlen.
//   D4  Zurücksetzen        Zweistufig; „n aktualisiert, m unverändert" — wörtlich aus der Antwort.
//   D5  Entfernen           Zweistufig; der erste Klick entfernt NICHTS.
//   D6  Leerer Stand        Ohne geladene Objekte sind Zurücksetzen und Entfernen gesperrt.
//   D7  Vorschau (R2)       Zwischen Frage und Vollzug stehen GENAU die zugeordneten Kennungen.
//   D8  Vorschau fehlt (R2) Scheitert sie, bleibt der Vollzug GESPERRT — lieber gar nicht als blind.
//   D9  Dubletten (R2)      Überzählige Kopien werden auf der Fläche GENANNT, nicht weggezählt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => {
  const list = vi.fn();
  const preview = vi.fn();
  const load = vi.fn();
  const reset = vi.fn();
  const remove = vi.fn();
  const loadExamples = vi.fn();
  return { list, preview, load, reset, remove, loadExamples };
});

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: {
      demoPackages: {
        list: d.list,
        preview: d.preview,
        load: d.load,
        reset: d.reset,
        remove: d.remove,
      },
      import: { loadExamples: d.loadExamples },
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ExamplePackages } from "../../apps/web/src/components/ExamplePackages";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PAKET = {
  id: "advisor-ict-en-v1",
  language: "en",
  fictional: true,
  title: { de: "Advisor ICT (EN)", en: "Advisor ICT (EN)", nl: "Advisor ICT (EN)" },
  description: {
    de: "Sechs freigegebene englische Grundlagen-Beiträge, vor dem Confluence-Import laden.",
    en: "Six approved English baseline entries, load before the Confluence import.",
    nl: "Zes goedgekeurde Engelse basisbijdragen, laad ze voor de Confluence-import.",
  },
  items: 6,
  areas: ["Sales", "Commercial", "Technical"],
  loaded: 0,
  duplicates: 0,
  edited: 0,
  registered: 0,
  runs: 0,
};

const bilanz = (teile: Record<string, unknown>) => ({
  package: PAKET.id,
  run: "lauf-1",
  created: 0,
  updated: 0,
  skipped: 0,
  removed: 0,
  removedAssigned: 0,
  registered: 0,
  duplicates: 0,
  skippedInTrash: 0,
  closedConflicts: 0,
  closedDuplicates: 0,
  failures: [],
  ...teile,
});

const SEED_IDS = ["ko-1", "ko-2", "ko-3", "ko-4", "ko-5", "ko-6"];
const SEED_KEYS = ["S02", "S04", "C01", "C02", "T01", "T03"];

/** Die sechs Bausteine als Vorschauzeilen, mit der Behandlung, die die jeweilige Aktion ihnen gibt. */
const bausteine = (behandlung: "wiederherstellen" | "entfernen") =>
  SEED_IDS.map((id, i) => ({
    id,
    art: "seed",
    run: "lauf-1",
    key: SEED_KEYS[i] ?? null,
    title: `[Beispiel] Baustein ${i + 1}`,
    behandlung,
    grund: "baustein",
    abweichungen: [],
  }));

/**
 * Die Vorschau des ZURÜCKSETZENS, wie der Server sie liefert: ALLE zugeordneten Objekte mit
 * Kennung, Behandlung und Grund. JOB 3277 R3 — `unregistered` als eigene Liste gibt es nicht mehr:
 * unregistrierter Altbestand steht in derselben Liste (mit `art: null`), weil er auch derselben
 * Behandlung unterliegt.
 */
const vorschau = (teile: Record<string, unknown> = {}) => ({
  package: PAKET.id,
  aktion: "zuruecksetzen",
  runs: ["lauf-1"],
  counts: { seed: 6 },
  entries: bausteine("wiederherstellen"),
  missing: 0,
  ...teile,
});

/**
 * Die Vorschau des ENTFERNENS — JOB 3277 R4, Bens Befund zu Runde 3.
 *
 * Dieselben Objekte, aber JEDES als Löschung, und `missing: 0`: nach dem Entfernen gibt es kein
 * Paket mehr, also wird nichts hergestellt und nichts angelegt. Sie steht hier ABSICHTLICH
 * ausgeschrieben und wird nicht aus der Reset-Vorschau umgerechnet — ein Testhelfer, der die
 * Produktionslogik nachbaut, würde genau den Fehler verdecken, den er prüfen soll.
 */
const vorschauEntfernen = (teile: Record<string, unknown> = {}) => ({
  package: PAKET.id,
  aktion: "entfernen",
  runs: ["lauf-1"],
  counts: { seed: 6 },
  entries: bausteine("entfernen"),
  missing: 0,
  ...teile,
});

/** Eine Zeile der Vorschau, die ENTFERNT würde — Dublette, Altbestand oder zugeordnetes Objekt. */
const geht = (id: string, teile: Record<string, unknown> = {}) => ({
  id,
  art: null,
  run: null,
  key: null,
  title: `Objekt ${id}`,
  behandlung: "entfernen",
  grund: "zugeordnet",
  abweichungen: [],
  ...teile,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function stelleAuf(): Promise<void> {
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: qc }, createElement(ExamplePackages)));
  });
  await act(async () => {
    await flush();
  });
}

/** Nur die Knöpfe DIESER Kachel: der WP-B6-Kasten darüber trägt ebenfalls einen „Laden"-Knopf,
 *  und ein Test, der den erwischt, misst die falsche Fläche. */
function knopf(beschriftung: string): HTMLButtonElement {
  const treffer = [...kasten().querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").includes(beschriftung),
  );
  expect(treffer.length, `Knopf „${beschriftung}"`).toBeGreaterThan(0);
  return treffer[0] as HTMLButtonElement;
}

async function klick(beschriftung: string): Promise<void> {
  const b = knopf(beschriftung);
  await act(async () => {
    b.click();
    await flush();
  });
}

const kasten = (): HTMLElement => {
  const el = container.querySelector('[data-demopaket="advisor-ict-en-v1"]');
  expect(el, "Demopaket-Kachel").not.toBeNull();
  return el as HTMLElement;
};

beforeEach(async () => {
  await i18n.changeLanguage("de");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  d.list.mockReset();
  d.preview.mockReset();
  d.load.mockReset();
  d.reset.mockReset();
  d.remove.mockReset();
  d.list.mockResolvedValue({ packages: [PAKET] });
  // Der Server antwortet auf die AKTION, nach der gefragt wurde — die Attrappe tut dasselbe.
  d.preview.mockImplementation((_id: string, aktion: string) =>
    Promise.resolve(aktion === "entfernen" ? vorschauEntfernen() : vorschau()),
  );
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  qc.clear();
});

describe("JOB 3277 D1 · vor dem Laden steht da, was kommt", () => {
  it("Beschreibung, Umfang, Sprache und das Fiktionsmerkmal", async () => {
    await stelleAuf();
    const text = kasten().textContent ?? "";
    expect(text).toContain("Advisor ICT (EN)");
    expect(text).toContain("vor dem Confluence-Import laden");
    // Umfang und Sprache — beides aus der Antwort, nicht aus der Fläche.
    expect(text).toContain("6 Objekte");
    expect(text).toContain("Sales, Commercial, Technical");
    expect(text).toContain("EN");
    // Und die Fläche sagt ehrlich dazu, woraus das Paket besteht.
    expect(text).toContain("erfundene Demodaten");
    expect(text).toContain("noch nicht geladen");
    // Vor dem Laden wurde NICHTS geladen.
    expect(d.load).not.toHaveBeenCalled();
  });
});

describe("JOB 3277 D2 · die Beschreibung folgt der Sprache der Oberfläche", () => {
  it("englische Oberfläche → englische Beschreibung, nicht die deutsche", async () => {
    await i18n.changeLanguage("en");
    await stelleAuf();
    const text = kasten().textContent ?? "";
    expect(text).toContain("load before the Confluence import");
    expect(text).not.toContain("vor dem Confluence-Import laden");
    expect(text).toContain("invented demo data");
    // Zurückgestellt wird in beforeEach — hier würde die Umschaltung den noch stehenden Baum
    // ausserhalb von act() neu rendern.
  });
});

describe("JOB 3277 D3/D4/D5 · die drei Handgriffe und ihre ehrlichen Zahlen", () => {
  it("Laden ruft den Ladeweg und zeigt „6 angelegt, 0 unverändert“", async () => {
    d.load.mockResolvedValue(bilanz({ created: 6 }));
    await stelleAuf();
    await klick("Laden");
    expect(d.load).toHaveBeenCalledWith(PAKET.id);
    const zeile = container.querySelector('[data-demopaket-bilanz="advisor-ict-en-v1"]');
    expect(zeile?.textContent).toContain("6 angelegt");
    expect(zeile?.textContent).toContain("0 unverändert");
  });

  it("Zurücksetzen ist ZWEISTUFIG und zeigt danach „1 aktualisiert, 5 unverändert“", async () => {
    d.list.mockResolvedValue({ packages: [{ ...PAKET, loaded: 6, edited: 1, registered: 6 }] });
    d.reset.mockResolvedValue(bilanz({ updated: 1, skipped: 5 }));
    await stelleAuf();
    // Der bearbeitete Stand steht schon vor dem Klick auf der Fläche.
    expect(kasten().textContent).toContain("6 von 6 geladen");
    expect(kasten().textContent).toContain("1 davon bearbeitet");
    // Erster Klick: nur die Frage. Zurückgesetzt wird NICHTS — auch das Zurücksetzen greift ein.
    await klick("Zurücksetzen");
    expect(d.reset).not.toHaveBeenCalled();
    expect(kasten().textContent).toContain("Wirklich zurücksetzen");
    await klick("Wirklich zurücksetzen");
    expect(d.reset).toHaveBeenCalledWith(PAKET.id);
    const zeile = container.querySelector('[data-demopaket-bilanz="advisor-ict-en-v1"]');
    expect(zeile?.textContent).toContain("1 aktualisiert");
    expect(zeile?.textContent).toContain("5 unverändert");
  });

  it("Entfernen ist ZWEISTUFIG: der erste Klick fragt nur", async () => {
    d.list.mockResolvedValue({ packages: [{ ...PAKET, loaded: 6 }] });
    d.remove.mockResolvedValue(bilanz({ removed: 6, closedConflicts: 2, closedDuplicates: 1 }));
    await stelleAuf();
    await klick("Paket entfernen");
    // Nichts entfernt — die Fläche fragt zurück.
    expect(d.remove).not.toHaveBeenCalled();
    expect(kasten().textContent).toContain("Wirklich entfernen");
    await klick("Wirklich entfernen");
    expect(d.remove).toHaveBeenCalledWith(PAKET.id);
    const zeile = container.querySelector('[data-demopaket-bilanz="advisor-ict-en-v1"]');
    expect(zeile?.textContent).toContain("6 entfernt");
    expect(zeile?.textContent).toContain("2 Konflikte");
    expect(zeile?.textContent).toContain("1 Doppelungen");
  });

  it("Abbrechen nimmt die Frage zurück, ohne zu entfernen", async () => {
    d.list.mockResolvedValue({ packages: [{ ...PAKET, loaded: 6 }] });
    await stelleAuf();
    await klick("Paket entfernen");
    await klick("Abbrechen");
    expect(d.remove).not.toHaveBeenCalled();
    expect(kasten().textContent).not.toContain("Wirklich entfernen");
  });
});

describe("JOB 3277 D6 · was nichts beträfe, ist gesperrt", () => {
  it("ohne geladene Objekte sind Zurücksetzen und Entfernen nicht klickbar", async () => {
    await stelleAuf();
    expect(knopf("Zurücksetzen").disabled).toBe(true);
    expect(knopf("Paket entfernen").disabled).toBe(true);
    expect(knopf("Laden").disabled).toBe(false);
  });
});

// ================================================================================================
// JOB 3277 R2 · D7–D9 — WAS BEN AN RUNDE 1 FEHLTE: DER UMFANG STEHT VOR DEM EINGRIFF DA.
// ================================================================================================
describe("JOB 3277 D7 · zwischen Frage und Vollzug steht die Vorschau", () => {
  it("sie nennt GENAU die zugeordneten Kennungen und die Anzahl je Art — vor dem Eingriff", async () => {
    d.list.mockResolvedValue({ packages: [{ ...PAKET, loaded: 6, registered: 6, runs: 1 }] });
    await stelleAuf();
    await klick("Paket entfernen");
    // Gefragt wird nach dem Plan DIESES Handgriffs — nicht nach „irgendeiner" Vorschau.
    expect(d.preview).toHaveBeenCalledWith(PAKET.id, "entfernen");
    const zeile = container.querySelector('[data-demopaket-vorschau="advisor-ict-en-v1"]');
    // Anzahl je Art, in der Sprache der Fläche — nicht der Rohname „seed".
    expect(zeile?.textContent).toContain("6 × Grundbestand");
    // Und die Kennungen selbst: der Umfang ist ABLESBAR, nicht behauptet.
    expect(zeile?.textContent).toContain("ko-1");
    expect(zeile?.textContent).toContain("ko-6");
    // Bis hierher ist nichts geschehen.
    expect(d.remove).not.toHaveBeenCalled();
  });

  // ============================================================================================
  // BENS KORREKTURPFLICHT 1 (Runde 3) — DIE ANKÜNDIGUNG MUSS ZUR AKTION PASSEN.
  // ============================================================================================
  // Runde 3 holte für BEIDE Handgriffe dieselbe Vorschau, und die zeigte den Reset-Plan. Vor dem
  // Entfernen stand damit „wird hergestellt (6)" — unmittelbar bevor genau diese sechs Objekte
  // endgültig gelöscht wurden. Diese zwei Fälle halten Bens Gegenbeispiele wörtlich fest.
  it("beim ENTFERNEN kündigt die Vorschau Löschung an — nie Wiederherstellung", async () => {
    d.list.mockResolvedValue({ packages: [{ ...PAKET, loaded: 6, registered: 6 }] });
    await stelleAuf();
    await klick("Paket entfernen");
    const text =
      container.querySelector('[data-demopaket-vorschau="advisor-ict-en-v1"]')?.textContent ?? "";
    // Alle sechs gehen — mit ihren Kennungen.
    expect(text).toContain("wird entfernt (6): ko-1, ko-2, ko-3, ko-4, ko-5, ko-6");
    // Und NICHTS wird hergestellt. Das ist der Satz, der in Runde 3 fälschlich dastand.
    expect(text).not.toContain("wird hergestellt");
  });

  it("beim ENTFERNEN mit unvollständigem Bestand wird KEINE Neuanlage angekündigt", async () => {
    // Bens zweites Gegenbeispiel: vier vorhandene Seeds. Beim Zurücksetzen würden zwei fehlende
    // neu angelegt — beim Entfernen entsteht nichts, es geht ja alles.
    d.list.mockResolvedValue({ packages: [{ ...PAKET, loaded: 4, registered: 4 }] });
    d.preview.mockImplementation((_id: string, aktion: string) =>
      Promise.resolve(
        aktion === "entfernen"
          ? vorschauEntfernen({
              entries: bausteine("entfernen").slice(0, 4),
              counts: { seed: 4 },
              missing: 0,
            })
          : vorschau({
              entries: bausteine("wiederherstellen").slice(0, 4),
              counts: { seed: 4 },
              missing: 2,
            }),
      ),
    );
    await stelleAuf();
    await klick("Paket entfernen");
    const beimEntfernen =
      container.querySelector('[data-demopaket-vorschau="advisor-ict-en-v1"]')?.textContent ?? "";
    expect(beimEntfernen).toContain("wird entfernt (4)");
    expect(beimEntfernen).not.toContain("neu angelegt");
    expect(beimEntfernen).not.toContain("wird hergestellt");

    // Gegenprobe im selben Fall: beim ZURÜCKSETZEN ist beides richtig und steht auch da.
    await klick("Abbrechen");
    await klick("Zurücksetzen");
    const beimReset =
      container.querySelector('[data-demopaket-vorschau="advisor-ict-en-v1"]')?.textContent ?? "";
    expect(beimReset).toContain("wird hergestellt (4)");
    expect(beimReset).toContain("2 fehlende Bausteine werden neu angelegt");
  });

  it("eine verspätete Vorschau der VORIGEN Frage wird nicht angezeigt", async () => {
    // Wer erst „Zurücksetzen" und dann „Entfernen" drückt, darf nicht den Herstellungsplan zur
    // Löschung sehen — dieselbe falsche Zusage, nur über den Umweg einer langsamen Antwort.
    d.list.mockResolvedValue({ packages: [{ ...PAKET, loaded: 6, registered: 6 }] });
    let langsam: ((wert: unknown) => void) | null = null;
    d.preview.mockImplementation((_id: string, aktion: string) =>
      aktion === "zuruecksetzen"
        ? new Promise((aufloesen) => {
            langsam = aufloesen as (wert: unknown) => void;
          })
        : Promise.resolve(vorschauEntfernen()),
    );
    await stelleAuf();
    await klick("Zurücksetzen");
    await klick("Abbrechen");
    await klick("Paket entfernen");
    // Jetzt trifft die alte Antwort ein.
    await act(async () => {
      (langsam as unknown as (wert: unknown) => void)?.(vorschau());
      await flush();
    });
    const text =
      container.querySelector('[data-demopaket-vorschau="advisor-ict-en-v1"]')?.textContent ?? "";
    expect(text).toContain("wird entfernt (6)");
    expect(text).not.toContain("wird hergestellt");
  });

  // ============================================================================================
  // BENS KORREKTURPFLICHT 2 (Runde 2): „Vorschau um alle tatsächlich betroffenen IDs ergänzen."
  // ============================================================================================
  // Der alte Fall verlangte nur „1 ohne Registereintrag" — eine ANZAHL. Genau daran ging er
  // vorbei: das Objekt wurde gelöscht, ohne dass seine Kennung je auf der Fläche stand. Jetzt
  // verlangt der Fall die KENNUNG, und zwar in der Gruppe, die sagt, was mit ihr geschieht.
  it("Altbestand ohne Registereintrag steht mit seiner KENNUNG da — nicht nur als Anzahl", async () => {
    d.list.mockResolvedValue({ packages: [{ ...PAKET, loaded: 7, registered: 6 }] });
    d.preview.mockResolvedValue(
      vorschau({
        counts: { seed: 6, nicht_registriert: 1 },
        entries: [
          ...vorschau().entries,
          geht("alt-1", { key: "S02", grund: "dublette", title: "[Beispiel] Altbestand" }),
        ],
      }),
    );
    await stelleAuf();
    await klick("Zurücksetzen");
    const zeile = container.querySelector('[data-demopaket-vorschau="advisor-ict-en-v1"]');
    const text = zeile?.textContent ?? "";
    // Die Art steht in der Sprache der Fläche da …
    expect(text).toContain("1 × ohne Registereintrag");
    // … und die Kennung steht IN DER GRUPPE, die sagt, was mit ihr geschieht. Nur „alt-1 kommt
    // irgendwo vor" wäre zu schwach: die Kennungsliste oben nennt ohnehin alle. Die Frage, die
    // Pedi vor dem Klick beantwortet haben muss, ist „was passiert MIT DIESEM Objekt?".
    expect(text).toContain("wird entfernt (1): alt-1");
    // Die sechs Bausteine stehen in der anderen Gruppe, ebenfalls mit ihren Kennungen.
    expect(text).toContain("wird hergestellt (6): ko-1, ko-2, ko-3, ko-4, ko-5, ko-6");
  });

  it("fehlende Bausteine werden vor dem Zurücksetzen als Neuanlage angekündigt", async () => {
    d.list.mockResolvedValue({ packages: [{ ...PAKET, loaded: 4, registered: 4 }] });
    d.preview.mockResolvedValue(
      vorschau({ entries: vorschau().entries.slice(0, 4), counts: { seed: 4 }, missing: 2 }),
    );
    await stelleAuf();
    await klick("Zurücksetzen");
    const zeile = container.querySelector('[data-demopaket-vorschau="advisor-ict-en-v1"]');
    expect(zeile?.textContent).toContain("2 fehlende Bausteine werden neu angelegt");
  });
});

describe("JOB 3277 D8 · ohne Vorschau kein Vollzug", () => {
  it("scheitert die Vorschau, bleibt der Bestätigungsknopf GESPERRT und nichts wird entfernt", async () => {
    d.list.mockResolvedValue({ packages: [{ ...PAKET, loaded: 6, registered: 6 }] });
    d.preview.mockRejectedValue(new Error("Netz weg"));
    await stelleAuf();
    await klick("Paket entfernen");
    const zeile = container.querySelector('[data-demopaket-vorschau="advisor-ict-en-v1"]');
    expect(zeile?.textContent).toContain("Vorschau nicht abrufbar");
    // Der Vollzug ist gesperrt — blind entfernen wäre genau der Fehler, den die Vorschau verhindert.
    expect(knopf("Wirklich entfernen").disabled).toBe(true);
    await klick("Wirklich entfernen");
    expect(d.remove).not.toHaveBeenCalled();
  });
});

describe("JOB 3277 D9 · überzählige Kopien werden genannt", () => {
  it("die Kachel sagt „6 überzählige Kopien“, und das Zurücksetzen meldet, dass es sie wegräumte", async () => {
    d.list.mockResolvedValue({
      packages: [{ ...PAKET, loaded: 12, duplicates: 6, registered: 6 }],
    });
    d.reset.mockResolvedValue(bilanz({ updated: 0, skipped: 6, removed: 6, duplicates: 6 }));
    await stelleAuf();
    // Zwölf liegen da, und die Fläche sagt es — in Runde 1 meldete sie sechs.
    expect(kasten().textContent).toContain("12 von 6 geladen");
    expect(kasten().textContent).toContain("6 überzählige Kopien");
    await klick("Zurücksetzen");
    await klick("Wirklich zurücksetzen");
    const zeile = container.querySelector('[data-demopaket-bilanz="advisor-ict-en-v1"]');
    expect(zeile?.textContent).toContain("6 überzählige Kopien entfernt");
  });

  // JOB 3277 R3: Dubletten und zugeordnete Objekte sind zwei verschiedene Nachrichten und werden
  // getrennt gemeldet — „6 entfernt" allein liesse offen, ob Kopien oder Importobjekte gingen.
  it("entfernte Importobjekte werden getrennt von Dubletten gemeldet", async () => {
    d.list.mockResolvedValue({ packages: [{ ...PAKET, loaded: 9, registered: 9 }] });
    d.reset.mockResolvedValue(
      bilanz({ updated: 0, skipped: 6, removed: 3, removedAssigned: 2, duplicates: 1 }),
    );
    await stelleAuf();
    await klick("Zurücksetzen");
    await klick("Wirklich zurücksetzen");
    const text =
      container.querySelector('[data-demopaket-bilanz="advisor-ict-en-v1"]')?.textContent ?? "";
    expect(text).toContain("2 zugeordnete Objekte entfernt");
    // 3 entfernt minus 2 zugeordnete = 1 Dublette — gerechnet, nicht doppelt gemeldet.
    expect(text).toContain("1 überzählige Kopien entfernt");
  });
});
