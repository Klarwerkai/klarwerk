// ================================================================================================
// JOB 3023 — FAIL-CLOSED: WAS NICHT GEPRUEFT WERDEN KANN, WIRD NICHT EINGESPIELT.
// ================================================================================================
//
// Die Begruendung steht an der Stelle selbst (`service.ts`, importJson): eine unbemerkte Dublette
// im Bestand ist teurer als ein nicht eingespielter Eintrag, den der Einspielende in der Antwort
// sieht. Und: ein Fehler der Pruefung darf den GANZEN Import nie kippen — die uebrigen Eintraege
// laufen weiter.
//
// WARUM HIER DER DIENST UND NICHT DIE ROUTE: der Ausfall der Pruefung ist genau der Fall, den die
// Kompositionswurzel nicht herstellen kann (sie verdrahtet die funktionierende Pruefung). Der
// Vertrag, der hier gemessen wird, gehoert dem Dienst: er nimmt den Port entgegen und entscheidet,
// was bei dessen Ausfall geschieht. Die 200er-Antwort der Route ueber demselben Weg misst
// `echt-neu.test.ts`.
import { describe, expect, it } from "vitest";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";
import type {
  DublettenBefund,
  DublettenPruefung,
  ImportItem,
} from "../../services/library-analytics";

const ITEMS: ImportItem[] = [
  {
    title: "Kessel reinigen",
    statement: "Den Kessel halbjaehrlich reinigen.",
    type: "best_practice",
    category: "Wartung",
  },
  {
    title: "Leitung spuelen",
    statement: "Die Leitung nach jedem Wechsel spuelen.",
    type: "best_practice",
    category: "Wartung",
  },
];

async function aufbau() {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  return { koService, library: new LibraryService({ koService }) };
}

describe("JOB 3023 · C — die Pruefung faellt aus", () => {
  it("C1 · eine werfende Pruefung → `pruefung_nicht_moeglich`, kein neues Objekt, kein Abbruch", async () => {
    const { koService, library } = await aufbau();

    const res = await library.importJson(ITEMS, "importeur", () => {
      throw new Error("Pruefung nicht verfuegbar");
    });

    expect(res.imported).toBe(0);
    expect(res.skipped).toBe(2);
    expect(res.uebersprungen.map((e) => e.grund)).toEqual([
      "pruefung_nicht_moeglich",
      "pruefung_nicht_moeglich",
    ]);
    expect(res.uebersprungen.map((e) => e.titel)).toEqual(["Kessel reinigen", "Leitung spuelen"]);
    expect(
      res.uebersprungen.map((e) => e.koId),
      "Ohne Pruefung gibt es kein getroffenes Objekt — `null` ist die ehrliche Aussage.",
    ).toEqual([null, null]);
    expect(
      await koService.list(),
      "Was nicht geprueft werden konnte, darf nicht im Bestand landen.",
    ).toHaveLength(0);
  });

  it("C2 · der Ausfall gilt je Eintrag — die uebrigen laufen weiter", async () => {
    const { koService, library } = await aufbau();

    const res = await library.importJson(ITEMS, "importeur", (item) => {
      if (item.title === "Kessel reinigen") {
        throw new Error("Pruefung nicht verfuegbar");
      }
      return { dublette: false };
    });

    expect(res.imported).toBe(1);
    expect(res.skipped).toBe(1);
    expect(res.uebersprungen).toEqual([
      { titel: "Kessel reinigen", grund: "pruefung_nicht_moeglich", koId: null },
    ]);
    expect((await koService.list()).map((ko) => ko.title)).toEqual(["Leitung spuelen"]);
  });

  it("C3 · ein unbrauchbarer Befund ist kein Freibrief — er zaehlt als nicht pruefbar", async () => {
    const { koService, library } = await aufbau();

    // Der Aufrufer unterhalb des Compilers: ein Befund, der `dublette: true` behauptet, aber kein
    // getroffenes Objekt nennt. Ein wohlwollendes „dann eben importieren" waere die unbemerkte
    // Dublette, gegen die dieser Auftrag steht.
    const kaputt = { dublette: true } as unknown as DublettenBefund;
    const res = await library.importJson(ITEMS, "importeur", () => kaputt);

    expect(res.imported).toBe(0);
    expect(res.uebersprungen.map((e) => e.grund)).toEqual([
      "pruefung_nicht_moeglich",
      "pruefung_nicht_moeglich",
    ]);
    expect(await koService.list()).toHaveLength(0);
  });

  // ==============================================================================================
  // C5–C7 — RUNDE 2 (bens Befund 2): EIN STUMMER PRUEFER DARF NICHT DEN GANZEN IMPORT KIPPEN.
  // ==============================================================================================
  //
  // Runde 1 rief die Pruefung im `try` auf, wertete ihren Befund aber DANACH ungeschuetzt aus. Gab
  // sie `null` oder `undefined` zurueck, warf erst der Zugriff `befund.dublette` — ausserhalb des
  // Schutzes — und riss den gesamten Import mit (`TypeError: Cannot read properties of undefined`).
  // Diese drei Faelle halten fest, dass jede unbrauchbare Rueckgabe LOKAL bleibt.
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["eine Zeichenkette", "vielleicht"],
    ["eine Zahl", 0],
    ["ein Aehnlichkeitswert NaN", { dublette: true, koId: "ko-1", aehnlichkeit: Number.NaN }],
    ["eine leere koId", { dublette: true, koId: "   ", aehnlichkeit: 0.99 }],
  ])(
    "C5 · Rueckgabe %s → `pruefung_nicht_moeglich`, kein Abbruch, kein neues Objekt",
    async (_name, rueckgabe) => {
      const { koService, library } = await aufbau();

      const res = await library.importJson(
        ITEMS,
        "importeur",
        (() => rueckgabe) as unknown as DublettenPruefung,
      );

      expect(res.imported).toBe(0);
      expect(res.skipped).toBe(2);
      expect(res.uebersprungen.map((e) => e.grund)).toEqual([
        "pruefung_nicht_moeglich",
        "pruefung_nicht_moeglich",
      ]);
      expect(res.uebersprungen.map((e) => e.koId)).toEqual([null, null]);
      expect(await koService.list()).toHaveLength(0);
    },
  );

  it("C6 · eine stumme Rueckgabe gilt JE EINTRAG — die uebrigen laufen weiter", async () => {
    const { koService, library } = await aufbau();

    const res = await library.importJson(ITEMS, "importeur", ((item: ImportItem) =>
      item.title === "Kessel reinigen"
        ? undefined
        : { dublette: false }) as unknown as DublettenPruefung);

    expect(
      res.imported,
      "Ein stummer Pruefer kostet hoechstens seinen eigenen Eintrag, nie den ganzen Lauf.",
    ).toBe(1);
    expect(res.uebersprungen).toEqual([
      { titel: "Kessel reinigen", grund: "pruefung_nicht_moeglich", koId: null },
    ]);
    expect((await koService.list()).map((ko) => ko.title)).toEqual(["Leitung spuelen"]);
  });

  it("C7 · ein Befund, dessen Auswertung selbst wirft, bleibt ebenfalls lokal", async () => {
    const { koService, library } = await aufbau();

    // Der feindselige Fall: der Zugriff auf `dublette` wirft erst beim Lesen. Runde 1 haette auch
    // hier den ganzen Import verloren, weil die Auswertung ausserhalb des `try` stand.
    const boshaft = Object.defineProperty({}, "dublette", {
      get() {
        throw new Error("Befund nicht lesbar");
      },
    }) as DublettenBefund;

    const res = await library.importJson(ITEMS, "importeur", (item) =>
      item.title === "Kessel reinigen" ? boshaft : { dublette: false },
    );

    expect(res.imported).toBe(1);
    expect(res.uebersprungen.map((e) => e.grund)).toEqual(["pruefung_nicht_moeglich"]);
    expect((await koService.list()).map((ko) => ko.title)).toEqual(["Leitung spuelen"]);
  });

  // ==============================================================================================
  // C8/C9 — RUNDE 3 (bens Befund): DER BEFUND WIRD GENAU EINMAL GELESEN.
  // ==============================================================================================
  //
  // C7 laesst den Getter schon beim ERSTEN Lesen werfen — damit erreicht er nie den Zugriff, der
  // NACH der Pruefung kommt. Genau dort lag die Luecke der Runde 2: der Praedikat-Pruefer bestaetigte
  // die Form, der Dienst griff danach WEITER auf das fremde Objekt zu, und dieser Zugriff stand
  // ausserhalb des `try`. Ben hat einen Getter gebaut, der beim ersten Lesen `false` liefert und
  // beim zweiten wirft: er kam durch die Pruefung und riss dann den ganzen Import mit.
  //
  // Die Faelle hier bauen genau diesen Getter — und pruefen zusaetzlich die Ursache statt nur die
  // Wirkung: der Zaehler belegt, dass jede Eigenschaft GENAU EINMAL gelesen wird. Ein zweiter
  // Zugriff kann dann weder werfen noch seine Meinung aendern.

  /** Ein Befund, dessen Eigenschaften beim ersten Lesen antworten und danach werfen. */
  function tueckischerBefund(werte: Record<string, unknown>) {
    const gelesen: Record<string, number> = {};
    const objekt = {};
    for (const [name, wert] of Object.entries(werte)) {
      gelesen[name] = 0;
      Object.defineProperty(objekt, name, {
        enumerable: true,
        get() {
          gelesen[name] = (gelesen[name] ?? 0) + 1;
          if ((gelesen[name] ?? 0) > 1) {
            throw new Error(`zweites Lesen von ${name}`);
          }
          return wert;
        },
      });
    }
    return { objekt: objekt as DublettenBefund, gelesen };
  }

  it("C8 · ein Getter, der die erste Auswertung passiert und danach wirft, kippt den Import NICHT", async () => {
    const { koService, library } = await aufbau();
    const { objekt, gelesen } = tueckischerBefund({ dublette: false });

    const res = await library.importJson(ITEMS, "importeur", (item) =>
      item.title === "Kessel reinigen" ? objekt : { dublette: false },
    );

    expect(
      res.imported,
      "Der Lauf laeuft durch — beide Eintraege werden verarbeitet, keiner geht verloren.",
    ).toBe(2);
    expect(res.uebersprungen).toEqual([]);
    expect((await koService.list()).map((ko) => ko.title)).toEqual([
      "Kessel reinigen",
      "Leitung spuelen",
    ]);
    expect(
      gelesen.dublette,
      "DIE URSACHE: `dublette` wird genau EINMAL gelesen — es gibt keinen zweiten Zugriff.",
    ).toBe(1);
  });

  it("C9 · auch ein Duplikatbefund wird genau einmal gelesen und aus der eigenen Kopie beantwortet", async () => {
    const { koService, library } = await aufbau();
    const { objekt, gelesen } = tueckischerBefund({
      dublette: true,
      koId: "ko-vorhanden",
      aehnlichkeit: 0.93,
    });

    const res = await library.importJson(ITEMS, "importeur", (item) =>
      item.title === "Kessel reinigen" ? objekt : { dublette: false },
    );

    expect(res.imported).toBe(1);
    expect(
      res.uebersprungen,
      "Grund, getroffene koId und Wert stammen aus der eigenen Kopie, nicht aus dem fremden Objekt.",
    ).toEqual([
      { titel: "Kessel reinigen", grund: "aehnlich", koId: "ko-vorhanden", aehnlichkeit: 0.93 },
    ]);
    expect((await koService.list()).map((ko) => ko.title)).toEqual(["Leitung spuelen"]);
    // Alle drei Eigenschaften: genau ein Lesevorgang. Die Antwort oben stammt also nachweislich
    // NICHT aus einem zweiten Zugriff auf das fremde Objekt.
    expect(gelesen.dublette).toBe(1);
    expect(gelesen.koId).toBe(1);
    expect(gelesen.aehnlichkeit).toBe(1);
  });

  it("C4 · gar keine Pruefung (Aufrufer unterhalb des Compilers) → nichts wird eingespielt", async () => {
    const { koService, library } = await aufbau();

    const res = await library.importJson(ITEMS, "importeur", undefined as never);

    expect(
      res.imported,
      "Ein optionaler Schutz ist ein angebotener Schutz — ohne Pruefung wird nichts eingespielt.",
    ).toBe(0);
    expect(res.uebersprungen.map((e) => e.grund)).toEqual([
      "pruefung_nicht_moeglich",
      "pruefung_nicht_moeglich",
    ]);
    expect(await koService.list()).toHaveLength(0);
  });
});
