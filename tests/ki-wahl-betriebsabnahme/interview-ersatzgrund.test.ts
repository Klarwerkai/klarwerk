// ================================================================================================
// KI-WAHL-BETRIEBSABNAHME · N-0087 — FESTE ERSATZFRAGEN: GRUND, SOWEIT BEKANNT, UND NÄCHSTER SCHRITT.
// ================================================================================================
//
// ORIGINALPUNKT (wörtlich): „In Alltagssprache erklären, dass gerade feste Ersatzfragen genutzt
// werden; Anbieter-/Fehlergrund soweit bekannt und sicheren nächsten Schritt anzeigen."
//
// WAS SCHON GELIEFERT WAR und hier NICHT wiederholt wird: die Beschriftung in Alltagssprache
// (JOB 3276, `tests/ki-assist-leer/interview-fallback-beschriftung.test.ts` — „Feste Ersatzfragen,
// ohne Antwort der KI", kein „Fallback", DE/EN/NL). Dort steht ausdrücklich, dass die Fläche den
// GRUND nicht kennt: die Interview-Antwort trug nur `demo: true`.
//
// WAS DIESER AUFTRAG ERGÄNZT (Nacharbeit 3, BEN): der Grund und der nächste Schritt.
//   I1–I4 · `Reasoner.interview` trägt bei Ersatzfragen `fallbackReason` — dieselben vier Ursachen
//           wie `structure` (WP-D8/WP-D10/WP-SHIP9-S2): kein Modell, Zeitüberschreitung, Fehler,
//           Vertraulichkeit. Gemessen am ECHTEN Reasoner mit einem lokalen Anbieter (Position 5,
//           `secondary`), damit kein öffentlicher Anbieter und keine Freigabe im Spiel ist.
//   I5    · der nächste Schritt hält, was er verspricht: „Mit jeder Antwort wird die KI erneut
//           gefragt" — die zweite Anfrage geht wieder an das Modell und kommt von ihm.
//   I6    · die Fläche wählt je Grund den richtigen Satz; ohne Ersatz gibt es keinen.
//   I7    · die Sätze stehen in DE/EN/NL, ohne Fachwort, mit Grund UND nächstem Schritt.
//
// WAS NICHT BEHAUPTET WIRD: ob ein ECHTER Anbieter im Betrieb antwortet. Das ist K2.
import { describe, expect, it } from "vitest";
import {
  INTERVIEW_ERSATZ_WEITER_KEY,
  interviewErsatzGrundKey,
} from "../../apps/web/src/lib/interviewFlow";
import { ModelProvider, ModelTimeoutError, Reasoner } from "../../services/reasoner";
import { alleSprachbestaende } from "../support/i18nBestand";

type Lokal = ConstructorParameters<typeof Reasoner>[4];

/** Ein Reasoner, dessen EINZIGES Modell der lokale Anbieter ist (kein Cloud-Anbieter). */
function mitLokal(lokal: Lokal): Reasoner {
  return new Reasoner(undefined, undefined, undefined, undefined, lokal);
}

const LEERER_ENTWURF = {
  title: "",
  statement: "",
  conditions: [],
  measures: [],
  tags: [],
  confidence: 0,
  demo: false,
};

describe("N-0087 · Reasoner.interview nennt den Grund der Ersatzfragen", () => {
  it("I1 · kein Modell in der Kette → Ersatzfragen mit Grund no-model", async () => {
    const ergebnis = await new Reasoner().interview([], "de");
    expect(ergebnis.demo).toBe(true);
    expect(ergebnis.question, "auch ohne Modell kommt eine Frage").toBeTruthy();
    expect(ergebnis.fallbackReason).toBe("no-model");
  });

  it("I2 · das lokale Modell scheitert → Grund model-error, und es WURDE gefragt", async () => {
    let gefragt = 0;
    const kaputt = new ModelProvider({
      name: "local:ersatzgrund",
      complete: async () => {
        gefragt += 1;
        throw new Error("Lokaler LLM antwortete mit 500");
      },
    });
    const ergebnis = await mitLokal(kaputt).interview([], "de");
    expect(gefragt, "das Modell wurde gar nicht versucht").toBeGreaterThan(0);
    expect(ergebnis.demo).toBe(true);
    expect(ergebnis.fallbackReason).toBe("model-error");
  });

  it("I3 · das lokale Modell überschreitet das Zeitlimit → Grund model-timeout", async () => {
    const langsam = new ModelProvider({
      name: "local:ersatzgrund",
      complete: async () => {
        throw new ModelTimeoutError("Lokaler LLM überschritt das Zeitlimit von 15000 ms", 15_000);
      },
    });
    const ergebnis = await mitLokal(langsam).interview([], "de");
    expect(ergebnis.demo).toBe(true);
    expect(ergebnis.fallbackReason).toBe("model-timeout");
  });

  it("I4 · vertraulicher Text, nur Cloud verdrahtet → Grund confidential, die Cloud wird NICHT gefragt", async () => {
    let cloudGefragt = 0;
    const cloud = new ModelProvider({
      name: "anthropic:ersatzgrund",
      complete: async () => {
        cloudGefragt += 1;
        return "{}";
      },
    });
    const ergebnis = await new Reasoner(cloud).interview([], "de", true);
    expect(cloudGefragt, "vertraulicher Text ging an die Cloud").toBe(0);
    expect(ergebnis.demo).toBe(true);
    expect(ergebnis.fallbackReason).toBe("confidential");
  });

  it("I5 · der nächste Schritt hält: nach einem Ausfall fragt die nächste Antwort das Modell erneut", async () => {
    let aufrufe = 0;
    const erstAusfallDannDa = {
      name: "local:ersatzgrund",
      isAvailable: () => true,
      interview: async () => {
        aufrufe += 1;
        if (aufrufe === 1) {
          throw new Error("Lokaler LLM antwortete mit 503");
        }
        return {
          question: "Woran erkennst du den Verschleiss?",
          done: false,
          draft: LEERER_ENTWURF,
          demo: false,
        };
      },
    } as unknown as Lokal;
    const reasoner = mitLokal(erstAusfallDannDa);
    const erste = await reasoner.interview([], "de");
    expect(erste.demo).toBe(true);
    expect(erste.fallbackReason).toBe("model-error");
    const zweite = await reasoner.interview(["Die Dichtung tropft."], "de");
    expect(aufrufe, "die zweite Antwort hat das Modell nicht erneut gefragt").toBe(2);
    expect(zweite.demo).toBe(false);
    expect(zweite.fallbackReason, "eine Modellantwort trägt keinen Ersatzgrund").toBeUndefined();
    expect(zweite.question).toBe("Woran erkennst du den Verschleiss?");
  });
});

describe("N-0087 · die Fläche wählt den Satz zum Grund", () => {
  it("I6 · je Grund ein eigener Satz; ohne Ersatz keiner; ohne bekannten Grund wird nicht geraten", () => {
    expect(interviewErsatzGrundKey({ demo: false })).toBeNull();
    const schluessel = [
      interviewErsatzGrundKey({ demo: true, fallbackReason: "no-model" }),
      interviewErsatzGrundKey({ demo: true, fallbackReason: "model-timeout" }),
      interviewErsatzGrundKey({ demo: true, fallbackReason: "model-error" }),
      interviewErsatzGrundKey({ demo: true, fallbackReason: "confidential" }),
      interviewErsatzGrundKey({ demo: true }),
    ];
    expect(new Set(schluessel).size, "zwei Gründe teilen sich einen Satz").toBe(5);
    expect(schluessel.every((s) => typeof s === "string")).toBe(true);
  });

  for (const [sprache, tabelle] of Object.entries(alleSprachbestaende())) {
    it(`I7-${sprache} · Grund und nächster Schritt stehen da, in Alltagssprache`, () => {
      const saetze = ["no-model", "model-timeout", "model-error", "confidential", undefined].map(
        (grund) => {
          const s = interviewErsatzGrundKey(
            grund === undefined
              ? { demo: true }
              : { demo: true, fallbackReason: grund as "no-model" },
          ) as string;
          return tabelle[s];
        },
      );
      const weiter = tabelle[INTERVIEW_ERSATZ_WEITER_KEY];
      for (const satz of [...saetze, weiter]) {
        expect(typeof satz, `${sprache}: ein Satz fehlt im Wörterbuch`).toBe("string");
        expect((satz as string).toLowerCase()).not.toContain("fallback");
        expect((satz as string).toLowerCase()).not.toContain("determinist");
      }
      // Der nächste Schritt nennt das Weiterantworten UND den Ort, an dem der Zugang geprüft wird.
      const verwaltung = tabelle["adm.ai.title"] as string;
      expect(weiter as string, `${sprache}: der Ort der Prüfung fehlt`).toContain(verwaltung);
      expect(weiter as string, `${sprache}: der Prüfknopf fehlt`).toContain(
        tabelle["adm.ai.test"] as string,
      );
    });
  }
});
