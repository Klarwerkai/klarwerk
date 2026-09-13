// ================================================================================================
// JOB 3808 · O6 — DIE VIERTE LAGE IM GEMEINSAMEN LADEVERTRAG, DOM-FREI GEMESSEN.
// ================================================================================================
//
// `lib/loadingState.ts` kannte bis hierher genau drei Phasen und EINEN Grund, warum ein gezeigter
// Stand nicht mehr für JETZT einsteht: ein Neuabruf ist GESCHEITERT (`isGroupStale`, `isError`).
// Ohne Netz gibt es diesen gescheiterten Versuch aber gar nicht — react-query v5 setzt
// `fetchStatus: "paused"` und KEINEN Fehler. `isGroupStale()` wird dort nie wahr; wer daraus
// „alles in Ordnung" liest, schreibt offline eine Verneinung hin, die er nicht prüfen kann.
//
// Diese Datei misst die neue Frage `gruppeAngehalten(quellen, online)` an ihren zwei Gründen und
// hält zugleich fest, dass die vier Bestandsfunktionen für DIESELBEN Eingaben DIESELBEN Werte
// liefern wie vorher (Auftrag §5 Lieferung 1: „Signatur UND Verhalten unangetastet" — Start,
// Navigation, Analytics und Bereitschaft teilen diese Datei).
//
// Reiner Node-Test: kein DOM, keine Bibliothek, kein Mock. Die Datei hat keine Importe und ist
// genau dafür gebaut.
import { describe, expect, it } from "vitest";
import {
  type HasData,
  ZAEHLER_FRISCHE_MS,
  groupLoadPhase,
  gruppeAngehalten,
  gruppeVeraltet,
  isGroupError,
  isGroupLoaded,
  isGroupLoading,
  isGroupStale,
  naechsterFristablauf,
} from "../../apps/web/src/lib/loadingState";

/** Eine geholte Quelle, deren Abruf gerade nichts tut — der Normalfall zwischen zwei Abrufen. */
const RUHIG: HasData = { data: [], fetchStatus: "idle" };
/** Dieselbe Quelle, während ein Abruf LÄUFT. Das ist nicht „angehalten", das ist Arbeit. */
const LAEUFT: HasData = { data: [], fetchStatus: "fetching" };
/** Dieselbe Quelle, deren gewollter Abruf auf das Netz WARTET. */
const ANGEHALTEN: HasData = { data: [], fetchStatus: "paused" };
/** Ein Bestandsaufruf, wie ihn `lib/loadingState.ts` seit jeher kennt: nur `data`. */
const BESTAND: HasData = { data: [] };

describe("JOB 3808 · O6 · `gruppeAngehalten` — ruht der Abruf dieser Gruppe?", () => {
  it("O6a · mit Netz und mindestens einer wartenden Quelle ⇒ wahr", () => {
    expect(gruppeAngehalten([RUHIG, ANGEHALTEN, LAEUFT], true)).toBe(true);
  });

  it("O6b · mit Netz und ausschliesslich `fetching`/`idle` ⇒ falsch", () => {
    expect(gruppeAngehalten([RUHIG, LAEUFT], true)).toBe(false);
    expect(gruppeAngehalten([LAEUFT, LAEUFT], true)).toBe(false);
    expect(gruppeAngehalten([RUHIG, RUHIG], true)).toBe(false);
  });

  it("O6c · Bestandsaufrufe OHNE das neue Feld bleiben gültig und ergeben mit Netz falsch", () => {
    expect(gruppeAngehalten([BESTAND, BESTAND], true)).toBe(false);
    expect(gruppeAngehalten([{ data: undefined }, { data: [], isError: true }], true)).toBe(false);
  });

  // ----------------------------------------------------------------------------------------------
  // O6d — DER ZWEITE GRUND, UND WARUM ER NICHT AUS `fetchStatus` ABZULEITEN IST.
  // ----------------------------------------------------------------------------------------------
  // Codex' Befund R-1585 (`lib/netzzustand.ts:5-11`): innerhalb der `staleTime` von 30 s will nach
  // dem Zurückkommen auf eine Seite NIEMAND einen Abruf. Jede Quelle steht dann auf `idle` — nicht
  // auf `paused`, denn `paused` entsteht nur an einem GEWOLLTEN Abruf. Wer nur die Query-Skalare
  // liest, liest daraus „frisch", obwohl das Gerät kein Netz hat. Genau dieser Fall steht hier.
  it("O6d · ohne Netz ⇒ wahr, auch wenn keine einzige Quelle `paused` meldet", () => {
    expect(gruppeAngehalten([RUHIG, RUHIG], false)).toBe(true);
    expect(gruppeAngehalten([BESTAND, BESTAND], false)).toBe(true);
    expect(gruppeAngehalten([], false)).toBe(true);
  });

  it("O6e · eine leere Gruppe MIT Netz behauptet nichts", () => {
    expect(gruppeAngehalten([], true)).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
// O6f — DIE BESTANDSFUNKTIONEN SIND UNANGETASTET.
// ------------------------------------------------------------------------------------------------
// Dieselben Eingaben, einmal OHNE und einmal MIT dem neuen Feld: die vier Antworten dürfen sich
// nicht unterscheiden. Der neue Wert darf nichts umlenken — er kommt daneben, nicht davor.
describe("JOB 3808 · O6f · das neue Feld ändert keine der vorhandenen Antworten", () => {
  const faelle: ReadonlyArray<{ name: string; ohne: HasData[]; mit: HasData[] }> = [
    {
      name: "alle geladen",
      ohne: [{ data: [] }, { data: [] }],
      mit: [
        { data: [], fetchStatus: "paused" },
        { data: [], fetchStatus: "idle" },
      ],
    },
    {
      name: "geladen, ein Refetch gescheitert",
      ohne: [{ data: [], isError: true }, { data: [] }],
      mit: [
        { data: [], isError: true, fetchStatus: "paused" },
        { data: [], fetchStatus: "fetching" },
      ],
    },
    {
      name: "eine Quelle ohne Daten im Fehler",
      ohne: [{ data: undefined, isError: true }, { data: [] }],
      mit: [
        { data: undefined, isError: true, fetchStatus: "paused" },
        { data: [], fetchStatus: "idle" },
      ],
    },
    {
      name: "eine Quelle lädt noch",
      ohne: [{ data: undefined }, { data: [] }],
      mit: [
        { data: undefined, fetchStatus: "paused" },
        { data: [], fetchStatus: "idle" },
      ],
    },
  ];

  for (const fall of faelle) {
    it(`O6f · ${fall.name} ⇒ Phase, Stale und die drei Prädikate bleiben gleich`, () => {
      expect(groupLoadPhase(fall.mit)).toBe(groupLoadPhase(fall.ohne));
      expect(isGroupStale(fall.mit)).toBe(isGroupStale(fall.ohne));
      expect(isGroupLoaded(fall.mit)).toBe(isGroupLoaded(fall.ohne));
      expect(isGroupLoading(fall.mit)).toBe(isGroupLoading(fall.ohne));
      expect(isGroupError(fall.mit)).toBe(isGroupError(fall.ohne));
    });
  }

  // Die Frischefrage liest ein anderes Feld (`dataUpdatedAt`) und darf vom neuen erst recht nichts
  // wissen. Beide Male dieselbe Antwort — sonst wäre die Trennung der zwei Gründe aufgeweicht.
  it("O6f · `gruppeVeraltet` und `naechsterFristablauf` bleiben unberührt", () => {
    const jetzt = 1_000_000;
    const frisch = jetzt - 1_000;
    const alt = jetzt - ZAEHLER_FRISCHE_MS;
    expect(gruppeVeraltet([{ dataUpdatedAt: frisch }], jetzt)).toBe(false);
    expect(gruppeVeraltet([{ dataUpdatedAt: alt }], jetzt)).toBe(true);
    expect(naechsterFristablauf([{ dataUpdatedAt: frisch }], jetzt)).toBe(
      frisch + ZAEHLER_FRISCHE_MS,
    );
    expect(naechsterFristablauf([{ dataUpdatedAt: alt }], jetzt)).toBeNull();
  });

  // KALIBRIERUNG: die neue Frage und die alte sind wirklich VERSCHIEDEN. Ohne diesen Fall könnte
  // `gruppeAngehalten` ein zweiter Name für `isGroupStale` sein und die Datei bliebe grün.
  it("O6f · derselbe Eingang, zwei verschiedene Antworten — die Lagen fallen nicht zusammen", () => {
    const offlineOhneFehler: HasData[] = [
      { data: [], fetchStatus: "paused" },
      { data: [], fetchStatus: "idle" },
    ];
    expect(isGroupStale(offlineOhneFehler), "offline ist kein Fehler").toBe(false);
    expect(gruppeAngehalten(offlineOhneFehler, true)).toBe(true);

    const onlineMitFehler: HasData[] = [
      { data: [], isError: true, fetchStatus: "idle" },
      { data: [], fetchStatus: "idle" },
    ];
    expect(isGroupStale(onlineMitFehler)).toBe(true);
    expect(gruppeAngehalten(onlineMitFehler, true), "ein Fehler ist kein Ruhen").toBe(false);
  });
});
