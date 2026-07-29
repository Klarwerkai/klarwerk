// AUFTRAG-mega57 BLOCK B/C — DER SAMMLER ERHEBT DIE EIGENSCHAFT, NICHT DIE LISTE.
//
// DIE ZUSICHERUNG, und sie ist ab dieser Runde deckungsgleich mit ihrer Reichweite:
// ZWEI FORMEN AUS DEN GESCHLOSSENEN WORTKLASSEN DES DEUTSCHEN ERREICHEN ZUSAMMEN NIE
// `MIN_ANSWER_SUBSTANCE` — gleich ob sie eindeutig grammatisch sind (dann verschwinden sie) oder
// mehrdeutig (dann bleiben sie suchbar und zählen nur nicht).
//
// mega56 hat dieselbe Überschrift getragen und sie nicht eingelöst: die bewusst zurückgehaltenen
// Formen („wollen", „würde", „wart", „falls" …) waren aus der Zusicherung HERAUSDEFINIERT, und
// genau dort lag der Durchlass, den ben gemessen hat. Diese Runde definiert nichts mehr heraus.
//
// DER SAMMLER STEHT AUF VIER BEINEN, weil kein einzelnes die Eigenschaft trägt:
//
//   S1 BELEGPROBE — jede mehrdeutige Form behauptet, welches ECHTE Wort ein Stoppworteintrag
//      gekostet hätte. Der Sammler rechnet die Behauptung nach, statt sie zu glauben (B2).
//   S2 KLASSENPROBE — beide Mengen werden aus den Marken in `provider.ts` GELESEN. Jedes Paar aus
//      zwei deklarierten Einträgen muss die leere Kandidatenmenge ergeben, und JEDER Eintrag muss
//      nachweislich geprüft worden sein — keine Größenbremse, keine Zahl (mega57 C2).
//   S3 PARADIGMENPROBE — je Lemma das vollständige Flexionsparadigma. Die GRUPPEN kommen aus den
//      Marken, jedes Paradigma muss sich an einem deklarierten Eintrag VERANKERN (mega57 C1); die
//      Endungen sind deutsche Grammatik, nicht Produktcode, sonst prüfte der Sammler den Abtrag
//      gegen sich selbst. Die attributiven „-er"-Formen sind ab jetzt drin (mega57 C3).
//   S4 INVENTARPROBE — die nicht flektierenden geschlossenen Klassen in ihrem deutschen Umfang.
//      Dieses Bein ist ABSICHTLICH nicht aus dem Produktcode gelesen: es ist die ANFORDERUNG. Wer
//      einen Eintrag aus `provider.ts` streicht, verkleinert damit nicht mehr den Prüfumfang —
//      genau die Lücke, die ben an mega56 mit „nimm `eigentlich` heraus, alles bleibt grün"
//      gezeigt hat. Was heute noch trägt, steht namentlich in `BEWUSST_OFFEN` und nirgends sonst.
//
// WAS DER SAMMLER WEITERHIN NICHT KANN, unverändert ehrlich: er prüft die geschlossenen Klassen.
// Inhaltswörter sind die offene Klasse und nicht sein Gegenstand; Dialekt, Umgangssprache und
// fremdsprachige Funktionswörter jenseits der kurzen englischen Liste ebenso wenig.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { KnowledgeRef } from "../../services/reasoner";
import { keywordSelect, queryTokens, rankCandidates } from "../../services/reasoner";

const PROVIDER = readFileSync(
  fileURLToPath(new URL("../../services/reasoner/src/provider.ts", import.meta.url)),
  "utf8",
);

// Ein deklarierter Block reicht von seinem Kopf bis zur ERSTEN schließenden Klammer am Zeilenanfang
// — beide Schreibweisen, `]);` für das Set und `];` für die Liste. Ein zu weit gefasster Ausschnitt
// zöge die nächste Deklaration mit herein und machte die Erhebung still falsch.
function block(start: string): string {
  const von = PROVIDER.indexOf(start);
  if (von < 0) {
    throw new Error(`Block nicht gefunden: ${start}`);
  }
  const enden = ["\n]);", "\n];"].map((e) => PROVIDER.indexOf(e, von)).filter((i) => i > 0);
  const bis = Math.min(...enden);
  if (!Number.isFinite(bis)) {
    throw new Error(`Blockende nicht gefunden: ${start}`);
  }
  return PROVIDER.slice(von, bis);
}

// Die DEKLARIERTEN Klassen der Stoppwortliste: jede Marke eröffnet eine Klasse, jedes folgende
// Zeichenkettenliteral gehört zu ihr, bis die nächste Marke kommt.
function deklarierteKlassen(): Map<string, string[]> {
  const klassen = new Map<string, string[]>();
  let aktuell: string[] | null = null;
  for (const zeile of block("const STOPWORDS = new Set<string>([").split("\n")) {
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

// Die MEHRDEUTIGEN Formen mitsamt ihrem Beleg — dieselbe Erhebung, dieselbe Quelle.
function deklarierteMehrdeutige(): Array<{ klasse: string; form: string; kostet: string }> {
  const out: Array<{ klasse: string; form: string; kostet: string }> = [];
  let klasse = "";
  for (const zeile of block(
    "const MEHRDEUTIGE_FUNKTIONSFORMEN: ReadonlyArray<readonly [string, string]> = [",
  ).split("\n")) {
    const marke = zeile.match(/^\s*\/\/ --- MEHRDEUTIG (.+?) ---\s*$/);
    if (marke?.[1]) {
      klasse = marke[1];
      continue;
    }
    const paar = zeile.match(/^\s*\["([^"]+)",\s*"([^"]+)"\],?\s*$/);
    if (paar?.[1] && paar[2]) {
      out.push({ klasse, form: paar[1], kostet: paar[2] });
    }
  }
  return out;
}

const KLASSEN = deklarierteKlassen();
const STOPPFORMEN = [...KLASSEN].flatMap(([klasse, worte]) =>
  worte.map((wort) => ({ klasse, wort })),
);
const MEHRDEUTIGE = deklarierteMehrdeutige();
const DEKLARIERT = [
  ...STOPPFORMEN,
  ...MEHRDEUTIGE.map(({ klasse, form }) => ({ klasse: `MEHRDEUTIG ${klasse}`, wort: form })),
];

// Die nicht substanztragenden NORMALFORMEN, aus der gelesenen Deklaration über die Zerlegung des
// Produkts selbst gebildet — kein zweiter Abtrag, keine Nachbildung. Leert jemand die Menge im
// Produktcode, schrumpft sie hier mit, und alles darunter wird rot.
const NICHT_TRAGEND = new Set(MEHRDEUTIGE.flatMap(({ form }) => queryTokens(form)));

// Was eine Form zur Mindestsubstanz beisteuert: ihre Inhaltstoken ohne die nicht substanztragenden.
function substanzToken(text: string): string[] {
  return queryTokens(text).filter((t) => !NICHT_TRAGEND.has(t));
}

function ref(statement: string): KnowledgeRef {
  return {
    id: "fachfremd",
    title: "Hinweis der Verwaltung",
    statement,
    status: "validiert",
    trust: 80,
  };
}

// Frage und fachfremde Quelle teilen GENAU die beiden Formen und sonst nichts. Der Rahmen ist
// derselbe wie in mega56, damit die Zahlen vergleichbar bleiben.
function paarProbe(a: string, b: string): string[] {
  const frage = `Gilt das ${a} oder ${b}?`;
  const quelle = ref(`Hinweis zu ${b} und ${a} im Vorgang.`);
  return [
    ...(rankCandidates(frage, [quelle]).length > 0 ? [`rankCandidates: ${a} + ${b}`] : []),
    ...(keywordSelect(frage, [quelle]).length > 0 ? [`keywordSelect: ${a} + ${b}`] : []),
  ];
}

// Alle Paare einer Formenliste durch BEIDE Auswahlwege. `geprueft` sammelt mit, WELCHE Formen der
// Sammler tatsächlich angefasst hat — das ist die Grundlage für die Vollständigkeitsprobe (C2).
function allePaare(formen: readonly string[], geprueft?: Set<string>): string[] {
  const durchgerutscht: string[] = [];
  for (let i = 0; i < formen.length; i++) {
    const a = formen[i];
    if (!a) {
      continue;
    }
    geprueft?.add(a);
    for (let j = i + 1; j < formen.length; j++) {
      const b = formen[j];
      if (b) {
        durchgerutscht.push(...paarProbe(a, b));
      }
    }
  }
  return durchgerutscht;
}

// ================================================================================================
// S1 — BELEGPROBE: JEDE BEHAUPTETE KOLLISION WIRD NACHGERECHNET (mega57 B2).
// ================================================================================================
describe("AUFTRAG-mega57 S1 — der Preis jeder mehrdeutigen Form ist belegt, nicht behauptet", () => {
  it("beide Mengen kommen aus dem Produktcode und sind gefüllt", () => {
    // Die Erhebung selbst muss greifen, sonst wäre alles darunter leer-grün: eine zu weit gefasste
    // Blockgrenze zöge die zweite Deklaration in die erste und mischte beide Mengen.
    expect(STOPPFORMEN.length, "Stoppwortliste nicht erhoben").toBeGreaterThan(300);
    expect(
      STOPPFORMEN.map((x) => x.wort).filter((w) => MEHRDEUTIGE.some((m) => m.form === w)),
      "die Erhebung hat beide Blöcke vermischt",
    ).toEqual([]);
    expect(KLASSEN.size).toBeGreaterThanOrEqual(10);
    for (const [klasse, worte] of KLASSEN) {
      expect(worte.length, `Klasse ohne Einträge: ${klasse}`).toBeGreaterThan(0);
    }
    expect(MEHRDEUTIGE.length, "die mehrdeutige Menge ist leer").toBeGreaterThan(0);
    for (const { form, klasse } of MEHRDEUTIGE) {
      expect(klasse, `mehrdeutige Form ohne Klassenmarke: ${form}`).not.toBe("");
    }
  });

  it("jede mehrdeutige Form fällt WIRKLICH auf dieselbe Normalform wie ihr Beleg", () => {
    // Ohne diese Probe wäre das zweite Feld eine Behauptung. Steht dort ein Wort, das gar nicht
    // kollidiert („wart" kostet „Warnung"), war die Aufnahme in DIESE Menge unbegründet — dann
    // gehört die Form in `STOPWORDS` und verschwindet ganz.
    const unbelegt = MEHRDEUTIGE.filter(({ form, kostet }) => {
      const a = queryTokens(form);
      const b = queryTokens(kostet);
      return a.length !== 1 || b.length !== 1 || a[0] !== b[0];
    }).map(
      ({ form, kostet }) =>
        `${form} → [${queryTokens(form)}] ≠ ${kostet} → [${queryTokens(kostet)}]`,
    );
    expect(unbelegt, "behauptete Kollision existiert nicht").toEqual([]);
  });

  it("das echte Wort bleibt SUCHBAR — das ist der ganze Grund für die zweite Menge", () => {
    // Der Unterschied zur Stoppwortliste in einer Zeile: ein Stoppworteintrag hätte den Beleg aus
    // jeder Suche geworfen. Hier behält er seinen Term, er trägt nur keine Mindestsubstanz mehr.
    const verschwunden = MEHRDEUTIGE.filter(({ kostet }) => queryTokens(kostet).length === 0).map(
      ({ form, kostet }) => `${kostet} (wegen ${form})`,
    );
    expect(verschwunden, "ein Beleg hat seinen Term verloren").toEqual([]);
  });

  it("keine Form steht in BEIDEN Mengen — das wäre ein Widerspruch, kein Kompromiss", () => {
    const stopp = new Set(STOPPFORMEN.map((x) => x.wort));
    const doppelt = MEHRDEUTIGE.filter(({ form }) => stopp.has(form)).map((x) => x.form);
    expect(doppelt).toEqual([]);
  });
});

// ================================================================================================
// S2 — KLASSENPROBE: KEIN PAAR AUS ZWEI DEKLARIERTEN EINTRÄGEN TRÄGT EINE ANTWORT.
// ================================================================================================
describe("AUFTRAG-mega57 S2 — Paare aus beiden deklarierten Mengen", () => {
  const geprueft = new Set<string>();
  const durchgerutscht = allePaare(
    DEKLARIERT.map((x) => x.wort),
    geprueft,
  );

  it("kein Paar erzeugt einen Kandidaten — in BEIDEN Auswahlwegen", () => {
    expect(
      { durchgerutschtePaare: durchgerutscht.length, beispiele: durchgerutscht.slice(0, 8) },
      `${durchgerutscht.length} Paare deklarierter Funktionsformen erreichten die Mindestsubstanz`,
    ).toEqual({ durchgerutschtePaare: 0, beispiele: [] });
  });

  it("JEDER deklarierte Eintrag wurde geprüft — keine Zahl, eine Eigenschaft (mega57 C2)", () => {
    // Die Größenbremse aus mega56 („mehr als 280 Einträge") hätte einen entfernten Eintrag nicht
    // bemerkt. Diese Probe misst nicht die Länge der Liste, sondern die Deckung der Prüfung: was
    // deklariert ist, ist angefasst worden. Wächst die Liste, wächst der Prüfumfang automatisch mit.
    const ungeprueft = DEKLARIERT.filter(({ wort }) => !geprueft.has(wort)).map(
      ({ klasse, wort }) => `${klasse}/${wort}`,
    );
    expect(ungeprueft, "deklarierte Einträge ohne Prüfung").toEqual([]);
    expect(geprueft.size).toBe(new Set(DEKLARIERT.map((x) => x.wort)).size);
  });

  it("kein eindeutig grammatischer Eintrag verlässt die Zerlegung als Inhaltstoken", () => {
    const durch = STOPPFORMEN.flatMap(({ klasse, wort }) =>
      queryTokens(wort).map((token) => ({ klasse, wort, token })),
    );
    expect(durch).toEqual([]);
  });

  it("keine mehrdeutige Form trägt Substanz — und jede bleibt trotzdem im Strom", () => {
    const traegt = MEHRDEUTIGE.filter(({ form }) => substanzToken(form).length > 0).map(
      (x) => x.form,
    );
    expect(traegt, "mehrdeutige Form zahlt auf die Mindestsubstanz ein").toEqual([]);
    const verstummt = MEHRDEUTIGE.filter(({ form }) => queryTokens(form).length === 0).map(
      (x) => x.form,
    );
    expect(verstummt, "mehrdeutige Form ist aus dem Strom verschwunden").toEqual([]);
  });
});

// ================================================================================================
// S3 — PARADIGMENPROBE: DAS VOLLSTÄNDIGE FLEXIONSPARADIGMA JE GESCHLOSSENEM LEMMA.
// ================================================================================================
//
// AUFTRAG-mega57 C1 — WOHER DIE GRUPPEN KOMMEN UND WOHER DIE STÄMME. ben hat an mega56 zu Recht
// bemängelt, dass C1 quellgekoppelt war und C2 nicht: Stämme UND Gruppen standen handkuratiert im
// Test, der Sammler prüfte also teilweise seine eigene Meinung. Diese Runde koppelt beides, so weit
// es TRAGFÄHIG ist, und sagt genau, wo die Grenze liegt:
//
//   · Die GRUPPEN sind gekoppelt: jede `klasse` unten muss sich in einer im Produktcode deklarierten
//     Marke wiederfinden (`klassenMarkeExistiert`). Eine erfundene Klasse wird rot.
//   · Jedes Paradigma muss sich VERANKERN: mindestens eine erzeugte Form oder der Stamm selbst muss
//     ein deklarierter Eintrag sein. Streicht jemand „können" aus dem Produktcode, verliert das
//     Paradigma „könn" seinen Anker und wird rot — die Rückbau-Lücke, die ben gezeigt hat.
//   · Die STÄMME bleiben hier, und das ist eine MESSUNG, keine Bequemlichkeit: eine automatische
//     Ableitung aus den Marken ist NICHT tragfähig, weil die Produktliste bewusst minimal ist. Der
//     längste Endungsabtrag erzeugt aus „dies" den Stamm „di" (→ „diem", „dier"), aus „unser" das
//     „unse" (→ „unsem", „unses"), aus „hätte" das „hät" (→ „häte") — gemessen, nicht vermutet
//     (`_relay/messung/mega57-sonde.ts`). Der kürzeste Abtrag verliert dafür genau die Stämme, um
//     die es geht: „könn" lässt sich aus „können" allein nicht als Paradigmenstamm bestätigen, weil
//     „könnte" bewusst NICHT in der Liste steht. Die Endungen sind deutsche Grammatik, die Stämme
//     sind deutsche Lemmata — beides ist die ANFORDERUNG, gegen die der Produktcode geprüft wird,
//     nicht seine Kopie.
const DETERMINATIV = ["e", "em", "en", "er", "es"] as const;
const VERBSTAMM = ["e", "en", "t", "te", "ten", "test", "tet"] as const;
// mega57 C3: die attributive „-er"-Form steht jetzt DRIN. mega56 hat sie als „strukturell
// unerreichbar" ausgelassen; sie war erreichbar („gewordener" → „wordener") und trug ein
// Inhaltstoken. Dass „-er" in `GRUNDFORM_ENDUNGEN` fehlt, ist der GRUND dafür, nicht die Entwarnung.
const PARTIZIP = ["", "e", "em", "en", "er", "es"] as const;
const SELBFORM = ["e", "en"] as const;
const NOMENFORM = ["", "em", "en", "es"] as const;

const PARADIGMEN: Array<{ klasse: string; lemma: string; formen: string[] }> = [
  // Determinativflexion am Stamm (Possessiv-, Demonstrativ-, Relativ-, Indefinitpronomen).
  ...(
    [
      ["Possessivpronomen", ["mein", "dein", "sein", "ihr", "unser", "eur"]],
      ["Demonstrativ- und Relativpronomen", ["dies", "jen", "solch", "welch"]],
      [
        "Indefinitpronomen",
        [
          "jed",
          "manch",
          "einig",
          "mehrer",
          "wenig",
          "beid",
          "ander",
          "sämtlich",
          "kein",
          "all",
          "irgendein",
        ],
      ],
    ] as Array<[string, string[]]>
  ).flatMap(([klasse, staemme]) =>
    staemme.map((lemma) => ({ klasse, lemma, formen: DETERMINATIV.map((e) => `${lemma}${e}`) })),
  ),
  // Verbflexion an Präsens-, Präteritum- und Konjunktivstämmen.
  ...(
    [
      ["Hilfs- und Modalverben", ["könn", "konn", "müss", "muss", "soll"]],
      ["Hilfs- und Modalverben", ["dürf", "durf", "mög", "möch", "moch"]],
      ["Hilfs- und Modalverben", ["hab", "hatt", "hätt", "werd", "wurd"]],
      // Die bis mega56 zurückgehaltenen Paradigmen — genau die, in denen bens Durchlass lag.
      // „wollt" fehlt hier absichtlich: die Verbflexion erzeugt es bereits aus „woll", und als
      // eigener Stamm hätte es keinen Anker in den Marken — der Wächter darüber sagt das auch.
      ["Modalverb wollen", ["woll", "will"]],
      ["Konjunktiv von werden", ["würd"]],
      ["Präteritum von sein", ["war", "wär"]],
    ] as Array<[string, string[]]>
  ).flatMap(([klasse, staemme]) =>
    staemme.map((lemma) => ({ klasse, lemma, formen: VERBSTAMM.map((e) => `${lemma}${e}`) })),
  ),
  // Unregelmäßige Partizipien, jetzt mitsamt attributiver Flexion inklusive „-er" (C3).
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
    klasse: "Unregelmäßige Hilfs-/Modalpartizipien",
    lemma,
    formen: PARTIZIP.map((e) => `${lemma}${e}`),
  })),
  // Die „-selb-"-Reihe dekliniert an BEIDEN Teilen — eine eigene Regel, kein Sonderfall.
  ...["der", "die", "das", "den", "dem", "des"].map((praefix) => ({
    klasse: "Demonstrativ- und Relativpronomen",
    lemma: `${praefix}selb`,
    formen: SELBFORM.map((e) => `${praefix}selb${e}`),
  })),
  // Substantivisch flektierende Indefinitpronomen.
  ...["jemand", "niemand"].map((lemma) => ({
    klasse: "Indefinitpronomen",
    lemma,
    formen: NOMENFORM.map((e) => `${lemma}${e}`),
  })),
  // Die unregelmäßigen 2.-Person-Formen: keine Endungsregel erzeugt sie aus dem Stamm.
  {
    klasse: "Hilfs- und Modalverben",
    lemma: "du-Formen",
    formen: ["bist", "hast", "magst", "kannst", "musst", "darfst", "sollst", "wirst", "seid"],
  },
];

const PARADIGMENFORMEN = [...new Set(PARADIGMEN.flatMap((p) => p.formen))];
const ALLE_MARKEN = [...KLASSEN.keys(), ...MEHRDEUTIGE.map((m) => `MEHRDEUTIG ${m.klasse}`)];
const DEKLARIERTE_WOERTER = new Set(DEKLARIERT.map((x) => x.wort));

describe("AUFTRAG-mega57 S3 — das vollständige Paradigma je geschlossenem Lemma", () => {
  it("die Gruppen sind an die Marken des Produktcodes gekoppelt (mega57 C1)", () => {
    const ohneMarke = [...new Set(PARADIGMEN.map((p) => p.klasse))].filter(
      (klasse) => !ALLE_MARKEN.some((marke) => marke.includes(klasse)),
    );
    expect(ohneMarke, "Paradigmenklasse ohne deklarierte Marke im Produktcode").toEqual([]);
  });

  it("jedes Paradigma ist in einem deklarierten Eintrag VERANKERT (mega57 C1)", () => {
    // Das ist die Rückbau-Sicherung: wer einen Eintrag streicht, auf dem ein Paradigma steht,
    // verliert nicht still den Prüfumfang, sondern wird hier rot.
    const ohneAnker = PARADIGMEN.filter(
      (p) => !DEKLARIERTE_WOERTER.has(p.lemma) && !p.formen.some((f) => DEKLARIERTE_WOERTER.has(f)),
    ).map((p) => `${p.klasse}/${p.lemma}`);
    expect(ohneAnker, "Paradigma ohne Anker in den Marken").toEqual([]);
  });

  it("die Tabelle ist wirklich generativ und enthält bens gemeldete Formen", () => {
    expect(PARADIGMEN.length).toBeGreaterThanOrEqual(40);
    expect(PARADIGMENFORMEN.length).toBeGreaterThan(200);
    expect(PARADIGMENFORMEN).toEqual(
      expect.arrayContaining([
        // mega55/mega56
        "könnte",
        "könnten",
        "dürfte",
        "dürften",
        "unserem",
        "euren",
        "diesem",
        "jenen",
        // mega57 — der Durchlass aus bens sammel54-Befund, erzeugt statt aufgezählt
        "wollte",
        "wollten",
        "würde",
        "würden",
        "waren",
        "wart",
        // mega57 C3 — die attributive „-er"-Form
        "gewordener",
        "gewesener",
      ]),
    );
  });

  it("KEINE erzeugte Form trägt Substanz — auch die mehrdeutigen nicht", () => {
    const durchgerutscht = PARADIGMEN.flatMap(({ klasse, lemma, formen }) =>
      formen.flatMap((form) =>
        substanzToken(form).map((token) => ({ klasse, lemma, form, token })),
      ),
    );
    expect(
      { anzahl: durchgerutscht.length, beispiele: durchgerutscht.slice(0, 12) },
      `${durchgerutscht.length} Paradigmenformen zahlen auf die Mindestsubstanz ein`,
    ).toEqual({ anzahl: 0, beispiele: [] });
  });

  it("das gilt auch mit Großschreibung und im Satz — die Zerlegung faltet beides", () => {
    const rahmen = new Set(queryTokens("Hinweis zu im Vorgang."));
    const durchgerutscht = PARADIGMENFORMEN.flatMap((form) => {
      const satz = `Hinweis zu ${form[0]?.toUpperCase()}${form.slice(1)} im Vorgang.`;
      return substanzToken(satz)
        .filter((token) => !rahmen.has(token))
        .map((token) => ({ satz, token }));
    });
    expect(durchgerutscht).toEqual([]);
    // Gegenprobe zur Vakuität: der Rahmen trägt wirklich Token, ein echtes Wort käme durch.
    expect(rahmen.size).toBe(2);
    expect(queryTokens("Hinweis zu Ventil im Vorgang.")).toContain("ventil");
  });

  it("KEIN Paar aus zwei Paradigmenformen erzeugt einen Kandidaten — in BEIDEN Auswahlwegen", () => {
    const durchgerutscht = allePaare(PARADIGMENFORMEN);
    expect(
      { durchgerutschtePaare: durchgerutscht.length, beispiele: durchgerutscht.slice(0, 8) },
      `${durchgerutscht.length} Paare grammatischer Formen erreichten die Mindestsubstanz`,
    ).toEqual({ durchgerutschtePaare: 0, beispiele: [] });
  });
});

// ================================================================================================
// S4 — INVENTARPROBE: DIE NICHT FLEKTIERENDEN KLASSEN IN IHREM DEUTSCHEN UMFANG.
// ================================================================================================
//
// DIESES BEIN LIEST NICHT AUS DEM PRODUKTCODE, und das ist der Punkt. bens dritter Befund an
// mega56: „Wer die Liste zusammenstreicht, wird rot" stimmte nicht — nimmt jemand `eigentlich` aus
// `STOPWORDS`, prüft C1 das entfernte Wort danach einfach nicht mehr, und die Größenbremse sinkt
// von 342 auf 341 und bleibt grün. Der Prüfumfang hing an dem, was geprüft werden sollte.
//
// Hier steht deshalb die ANFORDERUNG: die geschlossenen Klassen des Deutschen, so wie die Grammatik
// sie führt. Sie schrumpft nicht mit, wenn jemand den Produktcode kürzt — sie wird rot.
//
// Die Pronominaladverbien stehen NICHT als Liste da, sondern als Regel: {da|wo} vor Konsonant,
// {dar|wor} vor Vokal, „hier" vor beidem. Das ist echte deutsche Wortbildung, und sie hat in dieser
// Runde `hieran`, `hierum`, `dahin`, `hierher`, `hierhin`, `hiervon`, `hiervor`, `hierunter`,
// `hiergegen`, `hierneben`, `wogegen` und `woneben` gefunden — Formen, die mega56 nicht hatte.
const PA_KONSONANT = [
  "bei",
  "durch",
  "für",
  "gegen",
  "her",
  "hin",
  "mit",
  "nach",
  "neben",
  "von",
  "vor",
  "zu",
];
const PA_VOKAL = ["an", "auf", "aus", "in", "um", "unter", "über"];
const PRONOMINALADVERBIEN = [
  ...PA_KONSONANT.flatMap((s) => [`da${s}`, `wo${s}`, `hier${s}`]),
  ...PA_VOKAL.flatMap((s) => [`dar${s}`, `wor${s}`, `hier${s}`]),
];

const INVENTAR: Array<[string, string[]]> = [
  [
    "Präpositionen",
    [
      "ab",
      "an",
      "auf",
      "aus",
      "bei",
      "bis",
      "durch",
      "für",
      "gegen",
      "gegenüber",
      "hinter",
      "in",
      "mit",
      "nach",
      "neben",
      "ohne",
      "seit",
      "über",
      "um",
      "unter",
      "von",
      "vor",
      "während",
      "wegen",
      "zu",
      "zwischen",
      "entlang",
      "außer",
      "innerhalb",
      "außerhalb",
      "statt",
      "anstatt",
      "trotz",
      "gemäß",
      "binnen",
      "bezüglich",
      "laut",
      "mittels",
      "zwecks",
      "samt",
      "nebst",
      "kraft",
      "dank",
      "wider",
      "halber",
      "je",
      "per",
      "pro",
      "via",
      "zufolge",
      "angesichts",
      "hinsichtlich",
      "aufgrund",
      "infolge",
      "mangels",
      "seitens",
      "namens",
      "anhand",
      "mithilfe",
      "zugunsten",
      "entgegen",
      "unweit",
      "oberhalb",
      "unterhalb",
      "diesseits",
      "jenseits",
      "längs",
      "betreffs",
      "ungeachtet",
      "zuzüglich",
      "abzüglich",
      "einschließlich",
      "ausschließlich",
      "nahe",
      "entsprechend",
    ],
  ],
  [
    "Konjunktionen und Subjunktionen",
    [
      "und",
      "oder",
      "aber",
      "denn",
      "sondern",
      "sowie",
      "sowohl",
      "weder",
      "noch",
      "als",
      "wie",
      "dass",
      "ob",
      "weil",
      "damit",
      "obwohl",
      "obgleich",
      "wenngleich",
      "bevor",
      "nachdem",
      "seitdem",
      "sobald",
      "solange",
      "indem",
      "sofern",
      "falls",
      "zumal",
      "jedoch",
      "wobei",
      "während",
      "ehe",
      "bis",
      "wenn",
      "soweit",
      "soviel",
      "insofern",
      "insoweit",
      "desto",
      "umso",
      "allein",
      "doch",
      "beziehungsweise",
      "respektive",
    ],
  ],
  [
    "Partikeln und Frageadverbien",
    [
      "schon",
      "mal",
      "nein",
      "ja",
      "etwa",
      "ganz",
      "gar",
      "zwar",
      "eigentlich",
      "überhaupt",
      "allerdings",
      "immer",
      "wieder",
      "dann",
      "sonst",
      "bereits",
      "jetzt",
      "oben",
      "unten",
      "nie",
      "niemals",
      "sogar",
      "durchaus",
      "vielleicht",
      "womöglich",
      "insbesondere",
      "ebenfalls",
      "ebenso",
      "hingegen",
      "halt",
      "eben",
      "wohl",
      "freilich",
      "gewiss",
      "sicherlich",
      "natürlich",
      "selbstverständlich",
      "keineswegs",
      "keinesfalls",
      "jedenfalls",
      "allenfalls",
      "höchstens",
      "mindestens",
      "zumindest",
      "lediglich",
      "bloß",
      "nur",
      "auch",
      "erst",
      "fast",
      "beinahe",
      "kaum",
      "sehr",
      "allzu",
      "recht",
      "ziemlich",
      "meist",
      "meistens",
      "oft",
      "häufig",
      "selten",
      "stets",
      "nochmals",
      "abermals",
      "erneut",
    ],
  ],
  [
    "Frage- und Relativwörter",
    [
      "wer",
      "wen",
      "wem",
      "wessen",
      "was",
      "wo",
      "wohin",
      "woher",
      "wann",
      "wie",
      "warum",
      "weshalb",
      "wieso",
      "weswegen",
      "wieviel",
      "welche",
      "welcher",
      "welches",
      "welchem",
      "welchen",
      "wozu",
      "womit",
    ],
  ],
  [
    "Personal- und Reflexivpronomen",
    [
      "ich",
      "du",
      "er",
      "sie",
      "es",
      "wir",
      "ihr",
      "mich",
      "dich",
      "sich",
      "uns",
      "euch",
      "mir",
      "dir",
      "ihm",
      "ihn",
      "ihnen",
      "man",
      "einander",
      "meiner",
      "deiner",
      "seiner",
      "unser",
      "euer",
    ],
  ],
  ["Pronominaladverbien", PRONOMINALADVERBIEN],
];

// BEWUSST OFFEN — namentlich, mit Grund, und der Sammler hält die Liste auf genau diesem Stand.
// Wird eine dieser Formen geschlossen, wird der Test rot und die Zeile muss weg; kommt eine NEUE
// offene Form dazu, wird er ebenso rot. Eine stille Vergrößerung der Lücke gibt es nicht mehr.
const BEWUSST_OFFEN: Array<[string, string]> = [
  [
    "nahe",
    `überwiegend ADJEKTIV (die nahe Wartung), nur am Rand Präposition. Beide Wege schaden: als
     Stoppwort verschwände das Adjektiv aus jeder Suche, als mehrdeutige Form verlöre es seine
     Substanz — und anders als bei wart/Wartung gibt es kein zweites Wort, das den Preis belegen
     könnte, weil die Form mit sich selbst kollidiert. Gemeldet, nicht stillschweigend einsortiert
     (mega57 B3).`,
  ],
];

const INVENTARFORMEN = [...new Set(INVENTAR.flatMap(([, worte]) => worte))].filter(
  (w) => w.length > 2,
);

describe("AUFTRAG-mega57 S4 — die geschlossenen Klassen in ihrem deutschen Umfang", () => {
  it("das Inventar ist breit und deckt die Produktmarken ab, statt sie zu spiegeln", () => {
    expect(INVENTARFORMEN.length).toBeGreaterThan(220);
    // Die generative Regel muss wirklich erzeugen — sonst wäre die Klasse leer-grün.
    expect(PRONOMINALADVERBIEN).toEqual(
      expect.arrayContaining(["darauf", "woran", "hiermit", "dahin", "wogegen", "hieran"]),
    );
  });

  it("KEINE Form der geschlossenen Klassen trägt Substanz — außer den benannten offenen", () => {
    const traegt = INVENTARFORMEN.filter((w) => substanzToken(w).length > 0).sort();
    const offen = BEWUSST_OFFEN.map(([w]) => w).sort();
    expect(
      traegt,
      "das Inventar trägt anders als deklariert — entweder ist eine Lücke neu (dann schließen) " +
        "oder eine benannte Lücke ist zu (dann die Zeile in BEWUSST_OFFEN streichen)",
    ).toEqual(offen);
  });

  it("jede benannte offene Form hat einen Grund, keine bloße Nennung", () => {
    for (const [wort, grund] of BEWUSST_OFFEN) {
      expect(grund.length, `${wort} ohne Begründung`).toBeGreaterThan(80);
    }
  });

  it("KEIN Paar aus dem Inventar erzeugt einen Kandidaten — außer über die offenen Formen", () => {
    const ohneOffene = INVENTARFORMEN.filter((w) => !BEWUSST_OFFEN.some(([o]) => o === w));
    const durchgerutscht = allePaare(ohneOffene);
    expect(
      { durchgerutschtePaare: durchgerutscht.length, beispiele: durchgerutscht.slice(0, 8) },
      `${durchgerutscht.length} Inventarpaare erreichten die Mindestsubstanz`,
    ).toEqual({ durchgerutschtePaare: 0, beispiele: [] });
  });

  it("der Sammler ist nicht leer grün — zwei Fachwörter tragen im selben Rahmen sehr wohl", () => {
    // Ohne diese Gegenprobe wäre alles oben auch dann grün, wenn `rankCandidates` nie etwas
    // zurückgäbe oder die Zerlegung gar nichts mehr lieferte. Derselbe Rahmen, echte Wörter.
    expect(paarProbe("Ventil", "Überdruck")).toEqual([
      "rankCandidates: Ventil + Überdruck",
      "keywordSelect: Ventil + Überdruck",
    ]);
    // Und die Gegenprobe zur Gegenprobe: EIN Fachwort plus EINE mehrdeutige Form reicht NICHT.
    expect(paarProbe("Ventil", "würde")).toEqual([]);
  });
});
