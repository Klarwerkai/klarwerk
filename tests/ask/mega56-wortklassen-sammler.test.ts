// AUFTRAG-mega56 BLOCK C — DER SAMMLER ERHEBT DIE EIGENSCHAFT, NICHT DIE LISTE.
//
// DIE ZUSICHERUNG lautet nicht „diese sechs Formen fallen weg" — das wäre die Liste von heute und
// wäre morgen falsch. Sie lautet: ZWEI REIN GRAMMATISCHE WÖRTER ALLEIN ERREICHEN
// `MIN_ANSWER_SUBSTANCE` NIE.
//
// DER SAMMLER STEHT AUF ZWEI BEINEN, weil ein Bein allein die Eigenschaft nicht trägt:
//
//   C1 KLASSENPROBE — die Kopplung an den Produktcode. Die deklarierten Klassen werden aus den
//      Marken `// --- KLASSE … ---` in `provider.ts` GELESEN, nicht abgeschrieben. Jedes Paar aus
//      zwei deklarierten Einträgen muss die leere Kandidatenmenge ergeben. Wer die Liste
//      zusammenstreicht, wird hier rot.
//
//   C2 PARADIGMENPROBE — die eigentliche Substanz. Die Klassenprobe allein wäre schwach: jeder
//      deklarierte Eintrag steht schon als OBERFLÄCHENFORM in der Liste und fällt im ersten Sieb.
//      Der Befund lebte aber in den Formen, die NICHT in der Liste stehen und erst über die
//      Grundform auf einen Eintrag fallen — „könnten" → „könn", „unserem" → „unser". Deshalb wird
//      je geschlossenem Lemma sein VOLLSTÄNDIGES Paradigma erzeugt und geprüft. Wer die Reihenfolge
//      in `tokenize` zurückdreht oder die Normalformenmenge zurückbaut, wird hier rot.
//
// WAS DER SAMMLER NICHT KANN (dieselbe Ehrlichkeit wie BLOCK D im Produktcode): ein Wächter, der
// aus der Produktliste liest, findet keine grammatischen Wörter, die in dieser Liste FEHLEN. Er
// pinnt die Zusage für die deklarierten Klassen und die hier aufgeführten Paradigmen — nicht für
// „grammatische Wörter überhaupt". Die bewusst zurückgehaltenen Lemmata (B3, s. `provider.ts`:
// „wollen", „würde"/„würden", „waren"/„wart", „falls", „halt", „laut" …) stehen deshalb NICHT in
// der Paradigmentabelle: ihre Formen sind heute Inhaltstoken, und das ist eine benannte Lücke,
// keine stille.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { KnowledgeRef } from "../../services/reasoner";
import { keywordSelect, queryTokens, rankCandidates } from "../../services/reasoner";

const PROVIDER = readFileSync(
  fileURLToPath(new URL("../../services/reasoner/src/provider.ts", import.meta.url)),
  "utf8",
);

// Die DEKLARIERTEN Klassen, aus der Quelle erhoben: jede Marke eröffnet eine Klasse, jedes folgende
// Zeichenkettenliteral gehört zu ihr, bis die nächste Marke kommt.
function deklarierteKlassen(): Map<string, string[]> {
  const start = PROVIDER.indexOf("const STOPWORDS = new Set<string>([");
  const ende = PROVIDER.indexOf("]);", start);
  if (start < 0 || ende < 0) {
    throw new Error("STOPWORDS-Block nicht gefunden");
  }
  const klassen = new Map<string, string[]>();
  let aktuell: string[] | null = null;
  for (const zeile of PROVIDER.slice(start, ende).split("\n")) {
    const marke = zeile.match(/^\s*\/\/ --- KLASSE (.+?) ---\s*$/);
    if (marke?.[1]) {
      aktuell = [];
      klassen.set(marke[1], aktuell);
      continue;
    }
    const wort = zeile.match(/^\s*"([^"]+)",?\s*$/);
    if (wort?.[1] && aktuell) {
      aktuell.push(wort[1]);
    }
  }
  return klassen;
}

const KLASSEN = deklarierteKlassen();
const DEKLARIERT = [...KLASSEN].flatMap(([klasse, worte]) =>
  worte.map((wort) => ({ klasse, wort })),
);

function ref(statement: string): KnowledgeRef {
  return {
    id: "fachfremd",
    title: "Hinweis der Verwaltung",
    statement,
    status: "validiert",
    trust: 80,
  };
}

// Frage und fachfremde Quelle teilen GENAU die beiden grammatischen Wörter und sonst nichts.
function paarProbe(a: string, b: string): string[] {
  const frage = `Gilt das ${a} oder ${b}?`;
  const quelle = ref(`Hinweis zu ${b} und ${a} im Vorgang.`);
  return [
    ...(rankCandidates(frage, [quelle]).length > 0 ? [`rankCandidates: ${a} + ${b}`] : []),
    ...(keywordSelect(frage, [quelle]).length > 0 ? [`keywordSelect: ${a} + ${b}`] : []),
  ];
}

// ================================================================================================
// C0 — DIE ERHEBUNG GREIFT ÜBERHAUPT.
// ================================================================================================
describe("AUFTRAG-mega56 C0 — die Klassen kommen aus dem Produktcode", () => {
  it("die Klassen sind benannt und gefüllt, nicht eine namenlose Halde", () => {
    expect(KLASSEN.size).toBeGreaterThanOrEqual(10);
    for (const [klasse, worte] of KLASSEN) {
      expect(worte.length, `Klasse ohne Einträge: ${klasse}`).toBeGreaterThan(0);
    }
    const namen = [...KLASSEN.keys()].join(" | ");
    for (const erwartet of [
      "Personal- und Reflexivpronomen",
      "Possessivpronomen",
      "Demonstrativ- und Relativpronomen",
      "Indefinitpronomen",
      "Präpositionen",
      "Konjunktionen und Subjunktionen",
      "Hilfs- und Modalverben",
      "Unregelmäßige Hilfs-/Modalpartizipien",
      "Pronominaladverbien",
      "Partikeln und Frageadverbien",
    ]) {
      expect(namen, `deklarierte Klasse fehlt: ${erwartet}`).toContain(erwartet);
    }
  });

  it("die Erhebung ist breit genug, um eine Eigenschaft zu tragen", () => {
    expect(DEKLARIERT.length).toBeGreaterThan(280);
  });
});

// ================================================================================================
// C1 — KLASSENPROBE: KEIN PAAR AUS ZWEI DEKLARIERTEN EINTRÄGEN TRÄGT EINE ANTWORT.
// ================================================================================================
describe("AUFTRAG-mega56 C1 — Paare aus den deklarierten Klassen", () => {
  it("kein Paar erzeugt einen Kandidaten — in BEIDEN Auswahlwegen", () => {
    const durchgerutscht: string[] = [];
    for (let i = 0; i < DEKLARIERT.length; i++) {
      for (let j = i + 1; j < DEKLARIERT.length; j++) {
        const a = DEKLARIERT[i];
        const b = DEKLARIERT[j];
        if (a && b) {
          durchgerutscht.push(...paarProbe(a.wort, b.wort));
        }
      }
    }
    expect(
      { durchgerutschtePaare: durchgerutscht.length, beispiele: durchgerutscht.slice(0, 8) },
      `${durchgerutscht.length} Paare deklarierter Grammatikwörter erreichten die Mindestsubstanz`,
    ).toEqual({ durchgerutschtePaare: 0, beispiele: [] });
  });

  it("kein deklarierter Eintrag verlässt die Zerlegung als Inhaltstoken", () => {
    const durchgerutscht = DEKLARIERT.flatMap(({ klasse, wort }) =>
      queryTokens(wort).map((token) => ({ klasse, wort, token })),
    );
    expect(durchgerutscht).toEqual([]);
  });
});

// ================================================================================================
// C2 — PARADIGMENPROBE: DAS VOLLSTÄNDIGE FLEXIONSPARADIGMA JEDER GESCHLOSSENEN KLASSE.
// ================================================================================================
//
// Die Formen werden ERZEUGT — Stamm plus die Endungen, die die jeweilige Wortklasse im Deutschen
// trägt. Nicht abgeschrieben, und ausdrücklich nicht die Liste der zuletzt gemessenen Fälle: die
// Tabelle enthält jedes Paradigma vollständig, auch die Formen, die heute niemand gemeldet hat.
// Die Endungen sind die des DEUTSCHEN, nicht die des Produktcodes — sonst prüfte der Sammler den
// Abtrag gegen sich selbst. Was hier NICHT steht, steht bewusst nicht da:
//   · der blanke Stamm bei der Determinativflexion („jed", „eur", „jen" sind keine Wörter; die
//     Wörter sind „jede"/„jeder", „eure"/„euer", „jene"/„jener" und stehen alle in der Tabelle);
//   · die Endung „-st" am Verbstamm — die 2. Person ist bei diesen Verben unregelmäßig
//     („magst", nicht „mögst"), deshalb steht sie unten als eigene Zeile;
//   · die attributive Endung „-er" am Partizip („ein gewordener Zustand"). Sie ist die EINE
//     Paradigmenlücke, die dieser Sammler offenlässt, und sie ist strukturell: „-er" fehlt
//     absichtlich in `GRUNDFORM_ENDUNGEN` (mega54), also fällt keine „-er"-Form je auf ihren
//     Stamm. Die übrigen attributiven Formen („gewordene/-em/-en/-es") sind gedeckt und stehen da.
const DETERMINATIV = ["e", "em", "en", "er", "es"] as const;
const VERBSTAMM = ["e", "en", "t", "te", "ten", "test", "tet"] as const;
const PARTIZIP = ["", "e", "em", "en", "es"] as const;

const PARADIGMEN: Array<{ klasse: string; lemma: string; formen: string[] }> = [
  // Possessiv-, Demonstrativ-, Relativ- und Indefinitpronomen: Determinativflexion am Stamm.
  ...(
    [
      ["Possessivpronomen", ["mein", "dein", "sein", "ihr", "unser", "eur"]],
      ["Demonstrativ-/Relativpronomen", ["dies", "jen", "solch", "welch"]],
      [
        "Indefinitpronomen",
        ["jed", "manch", "einig", "mehrer", "wenig", "beid", "ander", "sämtlich", "kein", "all"],
      ],
    ] as Array<[string, string[]]>
  ).flatMap(([klasse, staemme]) =>
    staemme.map((lemma) => ({ klasse, lemma, formen: DETERMINATIV.map((e) => `${lemma}${e}`) })),
  ),
  // Hilfs- und Modalverben: Präsens-, Präteritum- und Konjunktivstämme mit Verbflexion.
  ...(
    [
      ["Modalverb können", ["könn", "konn"]],
      ["Modalverb müssen", ["müss", "muss"]],
      ["Modalverb sollen", ["soll"]],
      ["Modalverb dürfen", ["dürf", "durf"]],
      ["Modalverb mögen", ["mög", "möch", "moch"]],
      ["Hilfsverb haben", ["hab", "hatt", "hätt"]],
      ["Hilfsverb werden", ["werd", "wurd"]],
    ] as Array<[string, string[]]>
  ).flatMap(([klasse, staemme]) =>
    staemme.map((lemma) => ({ klasse, lemma, formen: VERBSTAMM.map((e) => `${lemma}${e}`) })),
  ),
  // Unregelmäßige Partizipien: keine Regel leitet sie her, deshalb ausdrücklich mit ihrer
  // attributiven Flexion („die geworden-e Lage") — genau der Weg, auf dem die A3-Rücknahme aus
  // mega55 sie ohne die mega56-Erweiterung wieder als Inhaltstoken ausgegeben hätte.
  ...[
    "gewesen",
    "geworden",
    "worden",
    "gehabt",
    "gekonnt",
    "gemusst",
    "gesollt",
    "gedurft",
    "gemocht",
  ].map((lemma) => ({
    klasse: "Unregelmäßiges Partizip",
    lemma,
    formen: PARTIZIP.map((e) => `${lemma}${e}`),
  })),
  // Die unregelmäßigen 2.-Person-Formen der Hilfs- und Modalverben: keine Endungsregel erzeugt sie
  // aus dem Stamm, deshalb stehen sie als eigenes Paradigma da statt in der Verbflexion oben.
  {
    klasse: "Hilfs-/Modalverb, unregelmäßige 2. Person",
    lemma: "du-Formen",
    formen: ["bist", "hast", "magst", "kannst", "musst", "darfst", "sollst", "wirst", "seid"],
  },
];

const PARADIGMENFORMEN = [...new Set(PARADIGMEN.flatMap((p) => p.formen))];

describe("AUFTRAG-mega56 C2 — das vollständige Paradigma je geschlossener Klasse", () => {
  it("die Tabelle ist wirklich generativ und deckt die gemeldeten Formen ab", () => {
    expect(PARADIGMEN.length).toBeGreaterThanOrEqual(30);
    expect(PARADIGMENFORMEN.length).toBeGreaterThan(200);
    // Die Formen aus bens Befund entstehen aus der Erzeugung, nicht aus einer Fallliste.
    expect(PARADIGMENFORMEN).toEqual(
      expect.arrayContaining([
        "könnte",
        "könnten",
        "dürfte",
        "dürften",
        "unserem",
        "euren",
        "diesem",
        "jenen",
        "ihrem",
        "ihrer",
      ]),
    );
  });

  it("KEINE erzeugte Form verlässt die Zerlegung als Inhaltstoken", () => {
    const durchgerutscht = PARADIGMEN.flatMap(({ klasse, lemma, formen }) =>
      formen.flatMap((form) => queryTokens(form).map((token) => ({ klasse, lemma, form, token }))),
    );
    expect(
      { anzahl: durchgerutscht.length, beispiele: durchgerutscht.slice(0, 12) },
      `${durchgerutscht.length} Paradigmenformen blieben Inhaltstoken`,
    ).toEqual({ anzahl: 0, beispiele: [] });
  });

  it("das gilt auch mit Großschreibung und im Satz — die Zerlegung faltet beides", () => {
    // Gemessen wird, was die FORM beisteuert — die Träger des Rahmens („Hinweis", „Vorgang") sind
    // echte Inhaltswörter und gehören hier weggerechnet, sonst misst die Probe den Rahmen.
    const rahmen = new Set(queryTokens("Hinweis zu im Vorgang."));
    const durchgerutscht = PARADIGMENFORMEN.flatMap((form) => {
      const satz = `Hinweis zu ${form[0]?.toUpperCase()}${form.slice(1)} im Vorgang.`;
      return queryTokens(satz)
        .filter((token) => !rahmen.has(token))
        .map((token) => ({ satz, token }));
    });
    expect(durchgerutscht).toEqual([]);
    // Gegenprobe zur Vakuität: der Rahmen trägt wirklich Token, und ein echtes Wort an derselben
    // Stelle käme sehr wohl durch.
    expect(rahmen.size).toBe(2);
    expect(queryTokens("Hinweis zu Ventil im Vorgang.")).toContain("ventil");
  });

  it("KEIN Paar aus zwei Paradigmenformen erzeugt einen Kandidaten — in BEIDEN Auswahlwegen", () => {
    // Das ist die Zusicherung selbst: zwei rein grammatische Wörter, egal aus welchen zwei
    // Paradigmen und in welcher Beugung, tragen zusammen keine Antwort.
    const durchgerutscht: string[] = [];
    for (let i = 0; i < PARADIGMENFORMEN.length; i++) {
      for (let j = i + 1; j < PARADIGMENFORMEN.length; j++) {
        const a = PARADIGMENFORMEN[i];
        const b = PARADIGMENFORMEN[j];
        if (a && b) {
          durchgerutscht.push(...paarProbe(a, b));
        }
      }
    }
    expect(
      { durchgerutschtePaare: durchgerutscht.length, beispiele: durchgerutscht.slice(0, 8) },
      `${durchgerutscht.length} Paare rein grammatischer Formen erreichten die Mindestsubstanz`,
    ).toEqual({ durchgerutschtePaare: 0, beispiele: [] });
  });

  it("der Sammler ist nicht leer grün — zwei Fachwörter tragen im selben Rahmen sehr wohl", () => {
    // Ohne diese Gegenprobe wäre alles oben auch dann grün, wenn `rankCandidates` nie etwas
    // zurückgäbe oder die Zerlegung gar nichts mehr lieferte. Derselbe Rahmen, echte Wörter.
    // `paarProbe` MELDET hier absichtlich beide Wege: zwei Fachwörter im selben Rahmen tragen.
    expect(paarProbe("Ventil", "Überdruck")).toEqual([
      "rankCandidates: Ventil + Überdruck",
      "keywordSelect: Ventil + Überdruck",
    ]);
    const frage = "Gilt das Ventil oder Überdruck?";
    const quelle = ref("Hinweis zu Überdruck und Ventil im Vorgang.");
    expect(rankCandidates(frage, [quelle]).length).toBe(1);
    expect(keywordSelect(frage, [quelle]).length).toBe(1);
  });
});

// ================================================================================================
// E3 — DIE VON ben GEMESSENEN OFFENEN FÄLLE, JEDER EINZELN BELEGT.
// ================================================================================================
describe("AUFTRAG-mega56 E3 — die gemeldeten Fälle sind zu", () => {
  const FAELLE: Array<[string, string, string]> = [
    [
      "unserem/euren",
      "Was ist mit unserem Vorgang und euren Unterlagen?",
      "unseren Akten und eure",
    ],
    [
      "diesem/jenen",
      "Was gilt bei diesem Bauteil und jenen Terminen?",
      "diesen Hinweisen und jene",
    ],
    ["ihrem/ihrer", "Was ist mit ihrem Termin und ihrer Akte?", "ihrem Vorgang und ihrer Liste"],
    ["könnte/könnten", "Was könnte und dürfte hier gelten?", "könnten und dürften die Fristen"],
    ["dürfte/dürften", "Wer dürfte das und wer müsste es?", "dürften und müssten die Stellen"],
  ];
  for (const [name, frage, fragment] of FAELLE) {
    it(`${name} erreicht keinen Kandidaten — in beiden Auswahlwegen`, () => {
      const quelle = ref(`Hinweis der Verwaltung zu ${fragment}.`);
      expect(rankCandidates(frage, [quelle])).toEqual([]);
      expect(keywordSelect(frage, [quelle])).toEqual([]);
    });
  }

  it("die Formen fielen wirklich auf denselben Stamm — sonst misst der Fall nichts", () => {
    // Die Fixtures wären wertlos, wenn die Formen gar nicht zusammenfielen. Vor mega56 ergaben
    // „könnte"/„könnten" beide „könn" und „dürfte"/„dürften" beide „dürf" — genau die zwei
    // gemeinsamen Stämme, die Score 2 trugen. Heute gibt die Zerlegung sie gar nicht mehr aus.
    for (const form of ["könnte", "könnten", "dürfte", "dürften", "unserem", "euren", "jenen"]) {
      expect(queryTokens(form), `${form} ist wieder ein Inhaltstoken`).toEqual([]);
    }
  });

  it("die unregelmäßigen Partizipien treten auch über die A3-Rücknahme nicht wieder aus", () => {
    // Die Rücknahme aus mega55 gibt den Zwischenstand VOR dem „ge"-Abtrag zurück, sobald erst
    // dieser Abtrag eine Stoppform erzeugt. Ohne die mega56-Erweiterung der Normalformenmenge
    // wäre „geworden" darüber als „geword" wieder ein Inhaltstoken geworden.
    for (const form of ["geworden", "gewordene", "gewesen", "gekonnt", "gedurft", "gemocht"]) {
      expect(queryTokens(form), `${form} ist ein Inhaltstoken`).toEqual([]);
    }
    // Die Rücknahme selbst bleibt wirksam — „Gesicht" ist kein Stoppwort und überlebt.
    expect(queryTokens("Gesicht")).toEqual(["gesich"]);
  });
});

// ================================================================================================
// C3 — DIE VORHANDENEN REGRESSIONEN BLEIBEN GRÜN.
// ================================================================================================
describe("AUFTRAG-mega56 C3 — mega53, mega54 und mega55 halten", () => {
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
    ];
    expect(rankCandidates(frage, einwort)).toEqual([]);
    expect(keywordSelect(frage, einwort)).toEqual([]);
  });

  it("mega54 C3: ein Begriff in zwei Beugungen zählt einmal", () => {
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

  it("mega54 A: Kennungen und echte Fachwörter überleben die neue Liste unverändert", () => {
    expect(queryTokens("Der Filter F3 wird geprüft")).toEqual(["filter", "f3", "prüf"]);
    expect(queryTokens("Wartung")).toEqual(["wart"]);
    expect(queryTokens("prüfen")).toEqual(["prüf"]);
  });
});
