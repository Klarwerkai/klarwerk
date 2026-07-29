// AUFTRAG-mega54 BLOCK B — „GEPRÜFT" UND „PRÜFEN" SIND DASSELBE WORT.
//
// DER BEFUND (mega53 hat ihn benannt, provider.ts:539-542): `overlap` vergleicht GANZE Token. Damit
// trifft „geprüft" aus der Frage das Wort „prüfen" im validierten Wissensobjekt nicht — die Frage
// endet in einer Wissenslücke, obwohl die Antwort im Bestand liegt.
//
// DIE REGEL (B1): vor dem Vergleich laufen Token auf eine GRUNDFORM, und zwar SYMMETRISCH — Frage
// und Quelltext durch DIESELBE Funktion. Ohne Symmetrie vergleicht man Äpfel mit Birnen.
//
// DIE GRENZEN (B2): keine neue Bibliothek, keine Synonymliste, deterministisch und rein.
// DIE MINDESTLÄNGE (B3): eine Grundform wird nie unter vier Zeichen gekürzt (s. Bericht).
// DIE ZUSAGE (B4): der Repo-Prefilter sucht als TEILSTRING (`%term%`) mit EXAKT denselben Termen —
// die Grundform muss deshalb ein zusammenhängender Teilstring des Ausgangswortes bleiben.
import { describe, expect, it } from "vitest";
import { demoTexts } from "../../services/app/src/demo-content";
import { koCandidateScore } from "../../services/knowledge-object";
import type { KnowledgeObject } from "../../services/knowledge-object";
import type { KnowledgeRef } from "../../services/reasoner";
import { keywordSelect, queryTokens, rankCandidates } from "../../services/reasoner";
import { refMatchText } from "../../services/reasoner/src/provider";

// AUFTRAG-mega54 B3: die gesetzte Untergrenze. Steht hier, damit der Test rot wird, wenn jemand sie
// still absenkt — eine Grundform von drei Zeichen zieht fremde Wörter zusammen.
const MIN_GRUNDFORM = 4;

// ── Erhebungsgrundlage: erzeugte Beugungsreihen, keine Fallliste ────────────────────────────────
// Aus jedem Stamm werden die Formen ERZEUGT, die im Deutschen an denselben Stamm anschließen:
// Infinitiv, Präsens-3.-Person, Partizip II (mit Vorsilbe „ge"), Nominalisierung (Singular/Plural)
// und die schwache Endung. Wer die Grundform an einer Ausnahmeliste baut, wird hier rot.
const STAEMME = ["prüf", "tausch", "meld", "wärm", "kalibrier", "schmier", "dokumentier", "schalt"];
function formen(stamm: string): string[] {
  return [
    `${stamm}en`,
    `${stamm}t`,
    `ge${stamm}t`,
    `ge${stamm}te`,
    `ge${stamm}ten`,
    `${stamm}ung`,
    `${stamm}ungen`,
    `${stamm}e`,
  ];
}

function grundform(wort: string): string | undefined {
  return queryTokens(wort)[0];
}

// Der gesamte deutsche Demo-Bestand als Textkorpus — die Erhebung läuft über echte Sätze, nicht
// über konstruierte Wörter.
function korpus(): string[] {
  const t = demoTexts("de") as unknown as Record<string, { title?: string; statement?: string }>;
  const texte: string[] = [];
  for (const wert of Object.values(t)) {
    if (wert && typeof wert === "object") {
      if (typeof wert.title === "string") {
        texte.push(wert.title);
      }
      if (typeof wert.statement === "string") {
        texte.push(wert.statement);
      }
    }
  }
  return texte;
}

// Die zehn Abnahmefragen aus mega52 B3 / mega53 A5 — hier als Korpus, nicht als Erwartung.
const ZEHN_FRAGEN = [
  "Wie oft muss der Filter F3 geprüft werden?",
  "Was tun bei Überdruck am Ventil X?",
  "Welche Farbe müssen Firmenwagen haben?",
  "Wann muss ich das Sturzprotokoll anlegen?",
  "Wie lange vorher braucht die Gemeinde den Antrag?",
  "Muss ich vor dem Kaltstart vorwärmen?",
  "Wie oft wird der Drehmomentschlüssel kalibriert?",
  "Was ist bei einem gemeldeten Wasserschaden sofort zu tun?",
  "Der Filter F3 in der Abfüllanlage sieht verschmutzt aus, wie oft muss er eigentlich geprüft und getauscht werden?",
  "Wir haben eine Schweißnaht an der Baugruppe 7 mit viel Nacharbeit, hilft es das Werkstück vorher zu erwärmen?",
];

describe("AUFTRAG-mega54 B1 — die Grundform ist symmetrisch", () => {
  it("alle erzeugten Beugungsformen EINES Stammes ergeben EINE Grundform", () => {
    const abweichungen = STAEMME.flatMap((stamm) => {
      const gefunden = formen(stamm).map((f) => ({ form: f, grund: grundform(f) }));
      const erste = gefunden[0]?.grund;
      return gefunden
        .filter((g) => g.grund !== erste)
        .map((g) => ({ stamm, erwartet: erste, ...g }));
    });
    expect(abweichungen).toEqual([]);
  });

  it("verschiedene Stämme fallen NICHT auf dieselbe Grundform zusammen", () => {
    const grundformen = STAEMME.map((s) => grundform(`${s}en`));
    expect(new Set(grundformen).size).toBe(STAEMME.length);
  });

  it("Frage und Quelltext laufen durch dieselbe Funktion — jede Form findet jede andere", () => {
    // Genau EIN garantiert geteiltes Wort („bauteil") steht im Rahmen. Die Frage kommt damit auf
    // Überschneidung 1 — unter der Mindestsubstanz aus mega53. Erst wenn die Beugungsform der Frage
    // die Beugungsform des Quelltextes trifft, steht die zweite Überschneidung und der Kandidat
    // passiert. Der Test misst also die Grundform und nicht den Rahmen.
    const verfehlt: Array<{ frageForm: string; textForm: string }> = [];
    for (const stamm of STAEMME) {
      const alle = formen(stamm);
      for (const frageForm of alle) {
        for (const textForm of alle) {
          const ref: KnowledgeRef = {
            id: "x",
            title: "Anweisung Bauteil",
            statement: `Das Bauteil wird ${textForm}.`,
            status: "validiert",
            trust: 80,
          };
          if (rankCandidates(`Bauteil ${frageForm}?`, [ref]).length === 0) {
            verfehlt.push({ frageForm, textForm });
          }
        }
      }
    }
    expect(verfehlt).toEqual([]);
  });

  it("„geprüft“ trifft „prüfen“ — der Satz, der mega53 in die Lücke schickte", () => {
    expect(grundform("geprüft")).toBe(grundform("prüfen"));
    expect(grundform("getauscht")).toBe(grundform("tauschen"));
    expect(grundform("verschmutzt")).toBe(grundform("Verschmutzung"));
    expect(grundform("vorwärmen")).toBe(grundform("Vorwärmung"));
  });
});

describe("AUFTRAG-mega54 B3 — die Grundform bleibt lang genug", () => {
  it("keine Kürzung erzeugt jemals eine Grundform unter der Mindestlänge", () => {
    const zuKurz: Array<{ text: string; token: string }> = [];
    for (const text of [...korpus(), ...ZEHN_FRAGEN, ...STAEMME.flatMap(formen)]) {
      for (const token of queryTokens(text)) {
        // Ein Token, das gar nicht gekürzt wurde, darf kürzer sein (Kennungen wie „f3“, kurze
        // Inhaltswörter wie „oft“). Verboten ist nur eine KÜRZUNG unter die Grenze.
        const roh = text.toLowerCase().includes(token);
        if (roh && token.length < MIN_GRUNDFORM && !/[0-9]/.test(token)) {
          const stehtSoImText = new RegExp(`(^|[^a-zäöüß0-9])${token}([^a-zäöüß0-9]|$)`).test(
            text.toLowerCase(),
          );
          if (!stehtSoImText) {
            zuKurz.push({ text, token });
          }
        }
      }
    }
    expect(zuKurz).toEqual([]);
  });

  it("die Vorsilbe „ge“ fällt nicht, wenn der Rest zu kurz würde", () => {
    expect(queryTokens("Das Gerät steht bereit")).not.toContain("rä");
    expect(queryTokens("Das Gerät steht bereit")).toContain("gerä");
  });

  it("Kennungen bleiben unangetastet — die Grundform greift sie nicht an", () => {
    expect(queryTokens("Filter F3 und Ventil DN50 und Schraube M12 prüfen")).toEqual(
      expect.arrayContaining(["f3", "dn50", "m12"]),
    );
  });
});

describe("AUFTRAG-mega54 B4 — die Zusage an den Repo-Prefilter hält", () => {
  // Der Prefilter sucht `%term%` (ILIKE, repo-pg.ts:386-395; InMemory ebenso als Teilstring). Die
  // Zusage aus provider.ts — Vorauswahl und Ranking nutzen EXAKT dieselben Terme — hält nur, wenn
  // jede Grundform ein ZUSAMMENHÄNGENDER Teilstring ihres Ausgangswortes bleibt.
  it("jeder Term ist ein Teilstring des Textes, aus dem er stammt (ILIKE-Zusage)", () => {
    const gebrochen: Array<{ text: string; term: string }> = [];
    for (const text of [...korpus(), ...ZEHN_FRAGEN, ...STAEMME.flatMap(formen)]) {
      for (const term of queryTokens(text)) {
        if (!text.toLowerCase().includes(term)) {
          gebrochen.push({ text, term });
        }
      }
    }
    expect(gebrochen).toEqual([]);
  });

  it("die Vorauswahl erreicht das richtige Wissensobjekt für Pedis P0-Frage", () => {
    const t = demoTexts("de");
    const ko = {
      id: "koFilter",
      title: t.koFilter.title,
      statement: t.koFilter.statement,
      status: "validiert",
      trust: 75,
      category: "",
      tags: [],
    } as unknown as KnowledgeObject;
    const terms = queryTokens("Wie oft muss der Filter F3 geprüft werden?");
    // Teilstring-Vorauswahl (dieselbe Erhebung, die InMemory- und Pg-Adapter fahren).
    expect(koCandidateScore(ko, terms)).toBeGreaterThan(0);
    // …und dieselben Terme tragen das Ranking bis über die Mindestsubstanz.
    const ref: KnowledgeRef = {
      id: "koFilter",
      title: t.koFilter.title,
      statement: t.koFilter.statement,
      status: "validiert",
      trust: 75,
    };
    expect(rankCandidates("Wie oft muss der Filter F3 geprüft werden?", [ref])).toHaveLength(1);
  });

  it("Vorauswahl und Ranking messen auf DERSELBEN Zerlegung", () => {
    for (const frage of ZEHN_FRAGEN) {
      const ausFrage = queryTokens(frage);
      const ausRefText = queryTokens(
        refMatchText({ id: "x", title: frage, statement: "", status: "offen", trust: 0 }),
      );
      expect(ausRefText).toEqual(ausFrage);
    }
  });
});

describe("AUFTRAG-mega54 C3 — die Grundform hebelt die Mindestsubstanz nicht aus", () => {
  it("EIN geteiltes Wort bleibt EIN geteiltes Wort, auch in zwei Beugungen", () => {
    // Die Frage nennt denselben Begriff zweimal (gebeugt und im Infinitiv). Der Quelltext kennt ihn
    // einmal. Das ist EINE Überschneidung — nicht zwei. Sonst genügte ein einziger schwacher
    // Treffer, um die absolute Mindestsubstanz aus mega53 zu erfüllen.
    const ref: KnowledgeRef = {
      id: "schwach",
      title: "Sonstige Notiz",
      statement: "Hier wird gelegentlich etwas geprüft.",
      status: "offen",
      trust: 20,
    };
    expect(rankCandidates("Wurde das geprüft und wie oft muss man prüfen?", [ref])).toEqual([]);
    expect(keywordSelect("Wurde das geprüft und wie oft muss man prüfen?", [ref])).toEqual([]);
  });
});
