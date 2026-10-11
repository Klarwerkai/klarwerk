// ================================================================================================
// R-1624 · FOTO-ZU-WISSEN — die Rückfragen zum Foto, an der Dienstgrenze gemessen.
// ================================================================================================
//
// Originalwortlaut (Roadmap 1.2): „KLARWERK erkennt aus dem Bild Kontext (Maschine, Bauteil-Typ)
// und stellt gezielte Rückfragen: ‚Welcher Fehler ist hier zu sehen? Welche Ursache vermutest du?
// Was wäre die Lösung?' — und baut daraus ein Wissensobjekt mit Bild-Anker."
//
// Gemessen wird hier die Hälfte, die im Reasoner liegt:
//   F1  Mit Bildbefund gilt die Foto-Fragenfolge — wörtlich die drei Fragen der Quelle, in DE/EN/NL;
//       ohne Befund bleibt das bisherige Interview unverändert.
//   F2  Die Antworten werden unverändert verdichtet: Fehler → Aussage, Ursache → Bedingung,
//       Lösung → Maßnahme; Abschluss nach diesen drei Antworten.
//   F3  Das Modell bekommt den Befund als gekennzeichneten Kontext und die Anweisung, das Objekt
//       beim Namen zu nennen, aber nichts vorwegzunehmen — und dasselbe Vertraulichkeitsbit.
//   F4  Der Befund ist gekappt; Fremdtypen ergeben „kein Foto-Interview".
//   F5  Der Dienst (`Reasoner.interview`) reicht den Befund bis zum Modell durch.
// Kein echtes Modell, kein Netz: der Modellclient ist eine Aufzeichnung.
import { describe, expect, it } from "vitest";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import {
  INTERVIEW_PHOTO_QUESTIONS,
  INTERVIEW_QUESTIONS,
  MAX_INTERVIEW_IMAGE_CONTEXT_LENGTH,
  normalizeInterviewImageContext,
} from "../../services/reasoner/src/provider";
import type { ModelClient } from "../../services/reasoner/src/provider-model";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const BEFUND = "Schweißnaht an einem Stahlträger mit Riss am Nahtübergang.";

interface Aufruf {
  system: string;
  user: string;
  confidential: boolean | undefined;
}

function aufzeichnung(antwort: string, aufrufe: Aufruf[]): ModelClient {
  return {
    name: "fake:foto",
    complete: async (system, user, confidential) => {
      aufrufe.push({ system, user, confidential });
      return antwort;
    },
  };
}

describe("R-1624 F1 · die Foto-Fragenfolge ist die der Quelle", () => {
  it("DE: Fehler · Ursache · Lösung, wörtlich und in dieser Reihenfolge", () => {
    expect(INTERVIEW_PHOTO_QUESTIONS.de.slice(0, 3)).toEqual([
      "Welcher Fehler ist hier zu sehen?",
      "Welche Ursache vermutest du?",
      "Was wäre die Lösung?",
    ]);
  });

  it("alle drei Sprachen tragen eine eigene Folge gleicher Länge wie das bisherige Interview", () => {
    for (const sprache of ["de", "en", "nl"] as const) {
      expect(INTERVIEW_PHOTO_QUESTIONS[sprache]).toHaveLength(INTERVIEW_QUESTIONS[sprache].length);
    }
    expect(INTERVIEW_PHOTO_QUESTIONS.en[0]).toBe("Which fault can be seen here?");
    expect(INTERVIEW_PHOTO_QUESTIONS.nl[0]).toBe("Welke fout is hier te zien?");
  });

  it("ohne Modell: mit Befund fragt der Rückfall nach dem Fehler, ohne Befund wie bisher", async () => {
    const p = new DeterministicProvider();
    const foto = await p.interview([], "de", false, BEFUND);
    expect(foto.question).toBe("Welcher Fehler ist hier zu sehen?");
    expect(foto.demo).toBe(true);
    const zwei = await p.interview(["Riss am Nahtübergang."], "de", false, BEFUND);
    expect(zwei.question).toBe("Welche Ursache vermutest du?");
    const drei = await p.interview(["Riss.", "Wasserstoffversprödung."], "de", false, BEFUND);
    expect(drei.question).toBe("Was wäre die Lösung?");

    const ohne = await p.interview([], "de");
    expect(ohne.question).toBe(INTERVIEW_QUESTIONS.de[0]);
    const leer = await p.interview([], "de", false, "   ");
    expect(leer.question).toBe(INTERVIEW_QUESTIONS.de[0]);
  });
});

describe("R-1624 F2 · aus den Antworten wird ein Entwurf — unverändert verdichtet", () => {
  it("Fehler → Aussage/Titel, Ursache → Bedingung, Lösung → Maßnahme; danach fertig", async () => {
    const res = await new DeterministicProvider().interview(
      [
        "Riss am Nahtübergang der Kehlnaht.",
        "Wasserstoffversprödung durch feuchte Elektroden.",
        "Elektroden trocknen, Naht ausschleifen und neu schweißen.",
      ],
      "de",
      false,
      BEFUND,
    );
    expect(res.done).toBe(true);
    expect(res.question).toBeNull();
    expect(res.draft.title).toBe("Riss am Nahtübergang der Kehlnaht.");
    expect(res.draft.statement).toBe("Riss am Nahtübergang der Kehlnaht.");
    expect(res.draft.conditions).toEqual(["Wasserstoffversprödung durch feuchte Elektroden."]);
    expect(res.draft.measures).toEqual([
      "Elektroden trocknen, Naht ausschleifen und neu schweißen.",
    ]);
    // Der Befund selbst ist KEINE Antwort und landet nirgends im Entwurf.
    expect(JSON.stringify(res.draft)).not.toContain("Stahlträger");
  });
});

describe("R-1624 F3 · das Modell fragt im Kontext des Fotos", () => {
  it("Befund steht gekennzeichnet im Prompt, die Leitfrage ist die Foto-Frage", async () => {
    const aufrufe: Aufruf[] = [];
    const res = await new ModelProvider(
      aufzeichnung("Welchen Fehler siehst du an der Schweißnaht des Stahlträgers?", aufrufe),
    ).interview([], "de", false, BEFUND);

    expect(res.question).toBe("Welchen Fehler siehst du an der Schweißnaht des Stahlträgers?");
    expect(res.demo).toBe(false);
    expect(aufrufe).toHaveLength(1);
    const [aufruf] = aufrufe;
    expect(aufruf?.user).toContain("Bildbefund (Foto, vom Experten bestätigt):");
    expect(aufruf?.user).toContain(BEFUND);
    expect(aufruf?.user).toContain("Leitfrage: Welcher Fehler ist hier zu sehen?");
    expect(aufruf?.system).toContain("beim Namen");
    expect(aufruf?.system).toContain("KEINEN Fehler, KEINE Ursache und KEINE Lösung");
    // Die bisherigen Leitplanken bleiben vollständig erhalten.
    expect(aufruf?.system).toContain("genau EINE");
  });

  it("ohne Befund ändert sich der Prompt nicht — kein Bildbefund-Block, keine Foto-Anweisung", async () => {
    const aufrufe: Aufruf[] = [];
    await new ModelProvider(aufzeichnung("Worum geht es genau?", aufrufe)).interview([], "de");
    expect(aufrufe[0]?.user).not.toContain("Bildbefund");
    expect(aufrufe[0]?.user).toContain(`Leitfrage: ${INTERVIEW_QUESTIONS.de[0]}`);
    expect(aufrufe[0]?.system).not.toContain("beim Namen");
  });

  it("das Vertraulichkeitsbit reist mit dem Befund unverändert zum Modellclient", async () => {
    const aufrufe: Aufruf[] = [];
    const provider = new ModelProvider(aufzeichnung("Frage?", aufrufe));
    await provider.interview([], "de", true, BEFUND);
    await provider.interview([], "de", false, BEFUND);
    expect(aufrufe.map((a) => a.confidential)).toEqual([true, false]);
  });

  it("EN: eigener Befund-Titel und englische Leitfrage", async () => {
    const aufrufe: Aufruf[] = [];
    await new ModelProvider(aufzeichnung("Which fault do you see?", aufrufe)).interview(
      [],
      "en",
      false,
      "Weld seam on a steel beam.",
    );
    expect(aufrufe[0]?.user).toContain("Image finding (photo, confirmed by the expert):");
    expect(aufrufe[0]?.user).toContain("Guiding question: Which fault can be seen here?");
  });

  it("nach drei Antworten fragt das Modell nicht mehr — Abschluss bleibt deterministisch", async () => {
    const aufrufe: Aufruf[] = [];
    const res = await new ModelProvider(aufzeichnung("Noch eine Frage?", aufrufe)).interview(
      ["Riss.", "Feuchte Elektroden.", "Trocknen und neu schweißen."],
      "de",
      false,
      BEFUND,
    );
    expect(res.done).toBe(true);
    expect(aufrufe).toHaveLength(0);
  });
});

describe("R-1624 F4 · der Befund ist begrenzt", () => {
  it("gekappt auf die Obergrenze der Bildbeschreibung", () => {
    expect(MAX_INTERVIEW_IMAGE_CONTEXT_LENGTH).toBe(300);
    expect(normalizeInterviewImageContext(`  ${"x".repeat(500)}  `)).toHaveLength(300);
  });

  it("Fremdtypen ergeben leer — kein Foto-Interview statt eines Fehlers", () => {
    expect(normalizeInterviewImageContext(undefined)).toBe("");
    expect(normalizeInterviewImageContext(42)).toBe("");
    expect(normalizeInterviewImageContext({ text: BEFUND })).toBe("");
  });

  it("der Prompt trägt höchstens den gekappten Befund", async () => {
    const aufrufe: Aufruf[] = [];
    await new ModelProvider(aufzeichnung("Frage?", aufrufe)).interview(
      [],
      "de",
      false,
      "y".repeat(1000),
    );
    expect(aufrufe[0]?.user).toContain("y".repeat(300));
    expect(aufrufe[0]?.user).not.toContain("y".repeat(301));
  });
});

describe("R-1624 F5 · der Dienst reicht den Befund durch", () => {
  it("Reasoner.interview → Modell mit Befund, Ergebnis gekennzeichnet", async () => {
    const aufrufe: Aufruf[] = [];
    const reasoner = new Reasoner(
      new ModelProvider(aufzeichnung("Welcher Fehler zeigt sich an der Naht?", aufrufe)),
      new DeterministicProvider(),
    );
    await erteileKiFreigabe(reasoner);
    const res = await reasoner.interview([], "de", false, BEFUND);
    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0]?.user).toContain(BEFUND);
    expect(res.question).toBe("Welcher Fehler zeigt sich an der Naht?");
    expect(res.aiGenerated?.task).toBe("interview");
  });

  it("ohne Modell: Rückfall auf die feste Foto-Frage, ehrlich als deterministisch markiert", async () => {
    const res = await new Reasoner().interview([], "de", false, BEFUND);
    expect(res.question).toBe("Welcher Fehler ist hier zu sehen?");
    expect(res.demo).toBe(true);
    expect(res.aiGenerated?.mode).toBe("deterministic");
  });
});
