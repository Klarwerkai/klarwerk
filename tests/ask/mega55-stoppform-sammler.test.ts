// AUFTRAG-mega55 BLOCK B — ZWEI PUNKTE SIND ZWEI FACHWÖRTER.
//
// DER BEFUND (ben, sammel52 ROT-1): `tokenize` filterte Stoppwörter auf der OBERFLÄCHENFORM und
// bildete ERST DANACH die Grundform. Nach der Grundform filterte nichts mehr — „meinem"/„meinen"
// wurden zu „mein", „deinem"/„deinen" zu „dein", beide stehen in der Stoppwortliste. Damit
// erfüllten ZWEI REIN GRAMMATISCHE WÖRTER die absolute Mindestsubstanz aus mega53, und die
// Mengenbildung aus mega54 half nicht: sie verhindert nur, dass DERSELBE Stamm zweimal zählt.
//
// DIE ERHEBUNG LÄUFT ÜBER DIE BAUFORM, NICHT ÜBER EINE LISTE DER HEUTIGEN SECHS FÄLLE (B3): die
// gebeugten Formen werden aus der Stoppwortliste des Produktcodes SELBST erzeugt — Liste und
// Endungen werden aus `provider.ts` gelesen, nicht abgeschrieben. Wer die Liste morgen erweitert,
// erweitert damit auch diesen Wächter. Wer die Reihenfolge in `tokenize` wieder umdreht, wird rot.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { KnowledgeRef } from "../../services/reasoner";
import { keywordSelect, queryTokens, rankCandidates } from "../../services/reasoner";

const PROVIDER = readFileSync(
  fileURLToPath(new URL("../../services/reasoner/src/provider.ts", import.meta.url)),
  "utf8",
);

// Die Stoppwortliste des Produktcodes, aus der Quelle erhoben statt hier zweitgeführt.
function ausQuelle(marker: string): string[] {
  const start = PROVIDER.indexOf(marker);
  if (start < 0) {
    throw new Error(`Marker nicht gefunden: ${marker}`);
  }
  const ende = PROVIDER.indexOf("]", start);
  return [...PROVIDER.slice(start, ende).matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
}

const STOPPWOERTER = ausQuelle("const STOPWORDS = new Set<string>([");
const ENDUNGEN = ausQuelle("const GRUNDFORM_ENDUNGEN = [");

function ref(statement: string): KnowledgeRef {
  return {
    id: "fachfremd",
    title: "Hinweis der Verwaltung",
    statement,
    status: "validiert",
    trust: 80,
  };
}

// ================================================================================================
// B1 — DER FALL AUS BENS BERICHT, WÖRTLICH.
// ================================================================================================
describe("AUFTRAG-mega55 B1 — zwei Possessivformen sind keine zwei Fachwörter", () => {
  const FRAGE = "Was ist mit meinem Vorgang und deinem Termin?";
  const QUELLE = ref("Hinweis zu meinen Akten und deinen Unterlagen.");

  it("die Zerlegung gibt kein rein grammatisches Token mehr aus", () => {
    // „meinem"/„deinem" laufen auf „mein"/„dein" — beide stehen in der Stoppwortliste und dürfen
    // die Zerlegung nicht verlassen. Was bleibt, sind die Fachwörter der Frage.
    expect(queryTokens(FRAGE)).not.toContain("mein");
    expect(queryTokens(FRAGE)).not.toContain("dein");
    expect(queryTokens(QUELLE.statement)).not.toContain("mein");
    expect(queryTokens(QUELLE.statement)).not.toContain("dein");
  });

  it("bens vollständiger Pfad endet in der Wissenslücke — in BEIDEN Auswahlwegen", () => {
    expect(rankCandidates(FRAGE, [QUELLE])).toEqual([]);
    expect(keywordSelect(FRAGE, [QUELLE])).toEqual([]);
  });

  it("die Fixture ist keine leere Behauptung: zwei Fachwörter tragen weiterhin", () => {
    // Gegenprobe zur Vakuität — dieselbe Bauform, aber mit ZWEI echten gemeinsamen Fachwörtern
    // erreicht die Mindestsubstanz sehr wohl. Der Test misst die Stoppform, nicht den Rahmen.
    const fachlich = ref("Zu deinem Vorgang und meinem Termin steht der Hinweis.");
    expect(rankCandidates(FRAGE, [fachlich]).length).toBe(1);
  });
});

// ================================================================================================
// B2 — DIESELBE ZUSICHERUNG FÜR „SEINEN"/„SEINEM" UND „IHREN"/„IHREM".
// ================================================================================================
describe("AUFTRAG-mega55 B2 — die Eigenschaft hängt nicht an zwei Possessivformen", () => {
  it("seinem/ihrem gegen seinen/ihren ergibt keine Kandidaten", () => {
    const frage = "Was ist mit seinem Vorgang und ihrem Termin?";
    const quelle = ref("Hinweis zu seinen Akten und ihren Unterlagen.");
    expect(rankCandidates(frage, [quelle])).toEqual([]);
    expect(keywordSelect(frage, [quelle])).toEqual([]);
  });

  it("keine dieser Beugungsformen erzeugt ein gelistetes Stoppwort", () => {
    const gelistet = new Set(["sein", "ihr", "ihre", "mein", "dein"]);
    const durchgerutscht = ["seinem", "seinen", "ihren", "ihres", "meinem", "deinen"].flatMap(
      (form) =>
        queryTokens(form)
          .filter((token) => gelistet.has(token))
          .map((token) => ({ form, token })),
    );
    expect(durchgerutscht).toEqual([]);
  });
});

// ================================================================================================
// B3 — SAMMLER: KEINE OBERFLÄCHENFORM ERZEUGT ÜBER DIE GRUNDFORM EIN STOPPWORT.
// ================================================================================================
describe("AUFTRAG-mega55 B3 — Sammler über die Bauform der Stoppwortliste", () => {
  // Aus jedem Listeneintrag werden die Formen ERZEUGT, die im Deutschen an denselben Stamm
  // anschließen: die Endungen, die die Grundform kennt (aus der Quelle gelesen), die Ableitung auf
  // „-er", und die Partizipbildung mit der Vorsilbe „ge".
  const ZUSATZ = ["er", "ungen"];
  function formen(wort: string): string[] {
    const angehaengt = [...ENDUNGEN, ...ZUSATZ].map((e) => `${wort}${e}`);
    return [wort, ...angehaengt, `ge${wort}`, `ge${wort}t`, `ge${wort}en`];
  }
  const ERZEUGT = STOPPWOERTER.flatMap(formen);
  const GELISTET = new Set(STOPPWOERTER);

  it("die Erhebung greift überhaupt — Liste und Endungen kommen aus dem Produktcode", () => {
    expect(STOPPWOERTER.length).toBeGreaterThan(100);
    expect(STOPPWOERTER).toContain("mein");
    expect(ENDUNGEN.length).toBeGreaterThanOrEqual(6);
    expect(ERZEUGT.length).toBeGreaterThan(1000);
    // Die im Befund benannten Formen entstehen wirklich aus der Erhebung, nicht aus einer Fallliste.
    expect(ERZEUGT).toEqual(expect.arrayContaining(["meinem", "meinen", "deinem", "deinen"]));
  });

  it("KEINE erzeugte Form liefert ein Token, das in der Stoppwortliste steht", () => {
    const durchgerutscht = ERZEUGT.flatMap((form) =>
      queryTokens(form)
        .filter((token) => GELISTET.has(token))
        .map((token) => ({ form, token })),
    );
    expect(durchgerutscht).toEqual([]);
  });

  it("das gilt auch mit Großschreibung und im Satz — die Zerlegung faltet beides", () => {
    const durchgerutscht = ERZEUGT.flatMap((form) => {
      const satz = `Hinweis zu ${form[0]?.toUpperCase()}${form.slice(1)} im Vorgang.`;
      return queryTokens(satz)
        .filter((token) => GELISTET.has(token))
        .map((token) => ({ satz, token }));
    });
    expect(durchgerutscht).toEqual([]);
  });

  it("der Wächter ist nicht leer grün — echte Fachwörter kommen weiterhin durch", () => {
    // Ohne diese Gegenprobe wäre der Sammler auch dann grün, wenn `tokenize` gar nichts mehr
    // zurückgäbe. Die Endung „-ung" ist dabei der wunde Punkt: „Wartung" läuft auf „wart", und
    // „wart" darf gerade NICHT als Beugungsform von „war" gelten.
    expect(queryTokens("Wartung")).toEqual(["wart"]);
    expect(queryTokens("prüfen")).toEqual(["prüf"]);
    expect(queryTokens("Der Filter F3 wird geprüft")).toEqual(["filter", "f3", "prüf"]);
  });
});

// ================================================================================================
// B4 — DIE BEIDEN VORHANDENEN REGRESSIONEN BLEIBEN GRÜN.
// ================================================================================================
describe("AUFTRAG-mega55 B4 — mega53 und mega54 halten", () => {
  it("mega53: mehrere Kandidaten mit Wert eins ergeben eine leere Menge", () => {
    const frage = "Wie oft muss der Filter eigentlich gewartet werden?";
    const einwort: KnowledgeRef[] = [
      {
        id: "sommerfest",
        title: "Sommerfest",
        statement: "Beim Sommerfest wird der Grill oft zu spät angezündet",
        status: "offen",
        trust: 50,
      },
      {
        id: "kaffee",
        title: "Kaffeeküche",
        statement: "Der Filter der Kaffeemaschine liegt in der oberen Schublade",
        status: "offen",
        trust: 50,
      },
      {
        id: "waesche",
        title: "Wäscherei",
        statement: "Die Wäsche wird gewartet, sobald der Korb voll ist",
        status: "offen",
        trust: 50,
      },
    ];
    expect(rankCandidates(frage, einwort)).toEqual([]);
    expect(keywordSelect(frage, einwort)).toEqual([]);
  });

  it("mega54: ein Begriff in zwei Beugungen zählt einmal", () => {
    const schwach: KnowledgeRef = {
      id: "schwach",
      title: "Sonstige Notiz",
      statement: "Hier wird gelegentlich etwas geprüft.",
      status: "offen",
      trust: 20,
    };
    expect(rankCandidates("Wurde das geprüft und wie oft muss man prüfen?", [schwach])).toEqual([]);
    expect(keywordSelect("Wurde das geprüft und wie oft muss man prüfen?", [schwach])).toEqual([]);
  });
});
