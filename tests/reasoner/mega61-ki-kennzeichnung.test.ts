// ================================================================================================
// AUFTRAG-mega61 BLOCK F — DIE MASCHINENLESBARE KENNZEICHNUNG, GEDECKT.
// ================================================================================================
//
// Artikel 50 Absatz 2 der KI-Verordnung verlangt für ERZEUGTE Inhalte eine Kennzeichnung in einem
// maschinenlesbaren Format. Für Text gibt es kein robustes Wasserzeichen — maschinenlesbar heißt
// hier ein ausdrückliches Feld in der Serverantwort.
//
// Der Test hat zwei Hälften, und die zweite ist die wichtigere:
//   F1  Die drei ERZEUGENDEN Aufgaben tragen das Feld, richtig gefüllt.
//   F2  Die fünf AUSGENOMMENEN Aufgaben tragen es NICHT.
//
// F2 deckt eine Rechtsauslegung ab (Ausnahme für „unterstützende Standardbearbeitung", Begründung
// ausgeschrieben in services/model-runs/src/types.ts). Fiele sie still weg — kennzeichnete also
// jemand plötzlich alles —, wäre das zwar kein Verstoß, aber die begründete Unterscheidung wäre
// verloren, und niemand wüsste mehr, warum sie einmal getroffen wurde.
import { describe, expect, it } from "vitest";
import { KI_ERZEUGENDE_AUFGABEN, aiGeneratedMark } from "../../services/model-runs";
import { ModelProvider, Reasoner } from "../../services/reasoner";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

// Ohne Provider läuft ausschließlich der deterministische Rückfall — kein Modell, kein Egress.
// Genau das prüft die Betriebsmodus-Angabe unten mit ab.
const reasoner = (): Reasoner => new Reasoner();

describe("mega61 F1 · die drei erzeugenden Aufgaben tragen die Kennzeichnung", () => {
  it("answer", async () => {
    const res = await reasoner().answer("Was tun bei Überdruck?", [], "de");
    expect(res.aiGenerated).toBeDefined();
    expect(res.aiGenerated?.aiGenerated).toBe(true);
    expect(res.aiGenerated?.task).toBe("answer");
    // Ohne Modell in der Kette ist der ehrliche Betriebsmodus „deterministic" — nicht „model".
    expect(res.aiGenerated?.mode).toBe("deterministic");
    expect(Number.isNaN(Date.parse(String(res.aiGenerated?.at)))).toBe(false);
  });

  it("interview", async () => {
    const res = await reasoner().interview([], "de");
    expect(res.aiGenerated?.aiGenerated).toBe(true);
    expect(res.aiGenerated?.task).toBe("interview");
    expect(res.aiGenerated?.mode).toBe("deterministic");
  });

  it("describe — auf BEIDEN Rückgabewegen der Methode", async () => {
    // describeImage hat zwei Ausgänge (Modell geantwortet / deterministischer Rückfall mit
    // Ursache). Ohne Provider läuft der zweite — und genau der wurde beim Bauen leicht vergessen.
    const res = await reasoner().describeImage("data:image/png;base64,AAAA", "de");
    expect(res.aiGenerated?.aiGenerated).toBe(true);
    expect(res.aiGenerated?.task).toBe("describe");
    expect(res.aiGenerated?.mode).toBe("deterministic");
    // Die bestehende Ehrlichkeit bleibt daneben stehen: ohne Vision-Modell gibt es KEINEN Text.
    expect(res.text).toBeNull();
    expect(res.fallbackReason).toBe("no-model");
  });

  it("der Betriebsmodus ist „model“, wenn WIRKLICH ein Modell geantwortet hat", async () => {
    // Die Gegenprobe zu den drei Fällen oben: ohne sie wäre „deterministic" auch dann grün, wenn
    // die Ableitung fest verdrahtet wäre.
    expect(aiGeneratedMark("answer", false).mode).toBe("model");
    expect(aiGeneratedMark("answer", true).mode).toBe("deterministic");
  });

  it("die Liste der erzeugenden Aufgaben ist die BEGRÜNDETE — nicht mehr und nicht weniger", () => {
    expect([...KI_ERZEUGENDE_AUFGABEN].sort()).toEqual(["answer", "describe", "interview"]);
  });
});

describe("mega61 F2 · die ausgenommenen Aufgaben tragen die Kennzeichnung NICHT", () => {
  it("structure — gliedert vorhandene Notizen", async () => {
    const res = await reasoner().structure("Ventil bei Überdruck schließen.", "de");
    expect((res as { aiGenerated?: unknown }).aiGenerated).toBeUndefined();
  });

  // JOB 3276: dieser Fall braucht ein antwortendes Modell. Ohne eines gibt es bei `assist` kein
  // Ergebnis mehr, das man auf die Kennzeichnung prüfen könnte — der deterministische Ersatz gibt
  // dort nur den Eingabetext zurück, und das ist seit JOB 3276 eine ehrliche Meldung statt eines
  // Vorschlags (tests/ki-assist-leer). Geprüft bleibt exakt dieselbe Zusage: assist trägt KEINE
  // KI-Kennzeichnung, auch dann nicht, wenn wirklich ein Modell gearbeitet hat.
  it("assist — formuliert vorhandenen Text um", async () => {
    const mitModell = new Reasoner(
      new ModelProvider({
        name: "anthropic:testmodell",
        complete: async () => "Das Ventil ist bei Überdruck zu schließen.",
      }),
    );
    // JOB 3570: die Grundfreigabe im Aufbau — dieser Fall braucht ein ANTWORTENDES Modell
    // (`demo: false`). Ohne sie gäbe es keinen Vorschlag, an dem die fehlende Kennzeichnung zu
    // prüfen wäre. Alle anderen Fälle dieser Datei laufen ohne öffentlichen Anbieter.
    await erteileKiFreigabe(mitModell);

    const res = await mitModell.assistText("Ventil schließen.", "de");
    expect(res.demo).toBe(false);
    expect((res as { aiGenerated?: unknown }).aiGenerated).toBeUndefined();
  });

  it("extract — holt Punkte aus einer vorhandenen Datei", async () => {
    const res = await reasoner().extract("Ein Dokumenttext mit Inhalten.", "de");
    expect((res as { aiGenerated?: unknown }).aiGenerated).toBeUndefined();
  });

  it("group — ordnet vorhandene Dokumente in Themen", async () => {
    const res = await reasoner().groupCandidates(
      [{ id: "a", title: "Ventil", text: "Ventil schließen" }],
      "de",
    );
    expect((res as { aiGenerated?: unknown }).aiGenerated).toBeUndefined();
  });

  it("select — wählt aus und erzeugt gar keinen Text", () => {
    // Sie liefert eine Auswahl der ÜBERGEBENEN Objekte zurück, keinen neuen Inhalt. Deshalb ist
    // hier nicht nur „kein Feld" zu prüfen, sondern dass die Rückgabe wirklich nur Vorhandenes ist.
    const kandidat = {
      id: "a",
      title: "Ventil",
      statement: "Ventil schließen",
      status: "offen" as const,
      trust: 0,
    };
    const res = reasoner().select("Ventil", [kandidat]);
    for (const eintrag of res) {
      expect((eintrag as { aiGenerated?: unknown }).aiGenerated).toBeUndefined();
    }
    expect(res.every((e) => e.id === kandidat.id)).toBe(true);
  });
});
