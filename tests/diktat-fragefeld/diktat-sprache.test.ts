// @vitest-environment jsdom
// ================================================================================================
// JOB 3038 · F5 — DAS DIKTAT SPRICHT DIE SPRACHE DER OBERFLÄCHE.
// ================================================================================================
//
// DER AUSGANGSFEHLER, gemessen am Produkt-HEAD `c875f4b`: `apps/web/src/pages/Capture.tsx:2570`
// setzte `rec.lang = "de-DE"` FEST. Die App führt aber drei Sprachbündel (`i18n.ts:13348`:
// `resources: { de, en, nl }`) — wer die Oberfläche auf Englisch oder Niederländisch stellt,
// diktierte trotzdem gegen ein deutsches Erkennungsmodell und bekam Kauderwelsch zurück.
//
// WAS HIER GEMESSEN WIRD, und warum an dieser Stelle: Die echte Spracherkennung ist headless nicht
// prüfbar — kein Mikrofon, kein Modell, kein Ton. Prüfbar ist genau das, was das Produkt der
// Browser-API ÜBERGIBT. Deshalb misst dieser Test zwei Dinge und keine Behauptung dazwischen:
//   (1) die reine Abbildung `diktatSprache` (i18n-Kürzel → BCP-47),
//   (2) den Wert `lang` an einem Rekorder-DOPPEL, das `makeRec` wirklich instanziiert hat.
//
// DIE VORGABE FÜR UNBEKANNTES ist bewusst `de-DE` und nicht etwa der Rohwert: das ist der HEUTIGE
// Wert. Ein unbekanntes Kürzel darf das Verhalten nicht still schlechter machen als vorher.
import { afterEach, describe, expect, it } from "vitest";
import { diktatSprache, makeRec } from "../../apps/web/src/lib/speechDictation";

interface ErgebnisEreignis {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

/**
 * Das Rekorder-Doppel. Es hat dieselbe Form wie die Web-Speech-API, spricht aber nur, wenn der
 * Test es heißt — so ist der gemessene `lang`-Wert der Wert, den das PRODUKT gesetzt hat.
 */
class RekorderDoppel {
  static letzter: RekorderDoppel | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  gestartet = 0;
  gestoppt = 0;
  onresult: ((e: ErgebnisEreignis) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    RekorderDoppel.letzter = this;
  }
  start(): void {
    this.gestartet += 1;
  }
  stop(): void {
    this.gestoppt += 1;
    this.onend?.();
  }
  /** Erkanntes ausliefern — genau die Form, die `makeRec` in `onresult` auswertet. */
  spricht(...worte: string[]): void {
    this.onresult?.({
      resultIndex: 0,
      results: worte.map((w) => [{ transcript: w }]),
    });
  }
}

// `globalThis` statt `window`: in jsdom sind beide dasselbe Objekt, aber nur `globalThis` kennt
// auch der node-reine Root-Typcheck (`tsconfig.json:6`), in den diese `.ts`-Datei fällt.
const global = globalThis as unknown as {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
};

function biete(): void {
  global.SpeechRecognition = RekorderDoppel;
}

afterEach(() => {
  RekorderDoppel.letzter = null;
  global.SpeechRecognition = undefined;
  global.webkitSpeechRecognition = undefined;
});

describe("JOB 3038 F5 · diktatSprache — BCP-47 aus dem Oberflächenkürzel", () => {
  it("die drei geführten Bündel bekommen ihr echtes Erkennungsgebiet", () => {
    expect(diktatSprache("de")).toBe("de-DE");
    expect(diktatSprache("en")).toBe("en-US");
    expect(diktatSprache("nl")).toBe("nl-NL");
  });

  it("ein Regionskürzel wird auf die Basissprache reduziert, bevor abgebildet wird", () => {
    // `i18n.language` trägt in echten Browsern regelmäßig eine Region („de-CH", „en-GB").
    // Ohne die Reduktion fiele jeder dieser Werte in den Unbekannt-Zweig.
    expect(diktatSprache("de-CH")).toBe("de-DE");
    expect(diktatSprache("en-GB")).toBe("en-US");
    expect(diktatSprache("nl-BE")).toBe("nl-NL");
  });

  it("Unbekanntes fällt auf den HEUTIGEN Wert zurück — kein stiller Rückschritt", () => {
    expect(diktatSprache("xx")).toBe("de-DE");
    expect(diktatSprache("")).toBe("de-DE");
  });
});

describe("JOB 3038 F5 · makeRec — der gesetzte Wert am Rekorder, nicht die Behauptung", () => {
  it("der übergebene Sprachwert steht am erzeugten Rekorder", () => {
    biete();
    const rec = makeRec(
      () => {},
      () => {},
      diktatSprache("en"),
    );
    expect(rec).not.toBeNull();
    // GEGENPROBE-ANKER: wird `lang` im Produkt wieder auf „de-DE" festverdrahtet, kippt genau hier.
    expect(RekorderDoppel.letzter?.lang).toBe("en-US");
    expect(RekorderDoppel.letzter?.continuous).toBe(true);
    expect(RekorderDoppel.letzter?.interimResults).toBe(false);
  });

  it("ohne Browser-Konstruktor gibt es keinen Rekorder — und keinen Absturz", () => {
    expect(
      makeRec(
        () => {},
        () => {},
        "de-DE",
      ),
    ).toBeNull();
  });

  // JOB 3038 RUNDE 3: Der Fabrik-Vertrag, auf dem die Identitätsprüfung der Fläche aufsitzt.
  // `Ask.tsx` entscheidet mit `recRef.current !== beendet`, ob ein Rückruf zur GELTENDEN Aufnahme
  // gehört. Diese Entscheidung kann nur richtig sein, wenn die Fabrik wirklich den Rekorder
  // weiterreicht, der sich verabschiedet — sonst prüfte die Fläche gegen einen falschen Absender.
  // Der Absender kommt aus dem Abschluss, nicht vom Browser (der ruft `onend(event)`).
  it("`onDone` bekommt DEN Rekorder, der sich verabschiedet — bei Ende und bei Fehler", () => {
    biete();
    const absender: unknown[] = [];
    const rec = makeRec(
      () => {},
      (beendet) => absender.push(beendet),
      "de-DE",
    );
    expect(rec).not.toBeNull();
    RekorderDoppel.letzter?.onend?.();
    RekorderDoppel.letzter?.onerror?.();
    // Beide Wege melden dasselbe Gerät — und zwar genau das erzeugte, nicht irgendeines.
    expect(absender).toEqual([rec, rec]);
    expect(absender[0]).toBe(RekorderDoppel.letzter);
  });

  it("zwei Rekorder melden sich getrennt — der Absender unterscheidet sie", () => {
    // Ohne diesen Fall wäre der Vertrag oben auch von einer Fabrik erfüllt, die IMMER dasselbe
    // (etwa das zuletzt erzeugte) Gerät meldet — genau der Fehler, der F8 rot gemacht hat.
    biete();
    const absender: unknown[] = [];
    const a = makeRec(
      () => {},
      (beendet) => absender.push(beendet),
      "de-DE",
    );
    const b = makeRec(
      () => {},
      (beendet) => absender.push(beendet),
      "de-DE",
    );
    expect(a).not.toBe(b);
    (a as { onend?: (() => void) | null })?.onend?.();
    expect(absender).toEqual([a]);
    (b as { onend?: (() => void) | null })?.onend?.();
    expect(absender).toEqual([a, b]);
  });

  it("Erkanntes läuft über `append`, Ende UND Fehler über `onDone` (kein Dauer-Läuft-Zustand)", () => {
    biete();
    const gehoert: string[] = [];
    let fertig = 0;
    makeRec(
      (text) => gehoert.push(text),
      () => {
        fertig += 1;
      },
      "de-DE",
    );
    const rec = RekorderDoppel.letzter;
    rec?.spricht("wie lange", " gilt der Urlaub");
    expect(gehoert).toEqual(["wie lange gilt der Urlaub"]);
    rec?.onend?.();
    rec?.onerror?.();
    expect(fertig).toBe(2);
  });
});
