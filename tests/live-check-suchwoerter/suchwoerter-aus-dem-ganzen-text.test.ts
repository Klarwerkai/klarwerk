import { describe, expect, it } from "vitest";
import { queryTokens } from "../../services/reasoner";
import { type Messung, bestand, miss } from "./messstand";

// ================================================================================================
// JOB 3574 · DIE ZWÖLF SUCHWÖRTER DES LIVE-CHECKS KOMMEN AUS DEM GANZEN TEXT.
// ================================================================================================
//
// DER FALL. Wer im Editor einen Text prüfen lässt, der oben eine Kopfzeile trägt (Herkunft, Datum,
// Status, Kategorie — so setzt sie die Browser-Erweiterung vor den Fachinhalt), bekam bis heute
// eine ANDERE Prüfung als jemand, der denselben Fachinhalt ohne Kopfzeile eintippt: `terms()`
// (knowledge-check.ts) nahm die zwölf ERSTEN Wörter über drei Zeichen, und die Kopfzeile lieferte
// zwölf davon. Was hier nicht als Wort ankommt, kann später weder ähnlich noch widersprüchlich
// werden — die Vorauswahl des Repos ist ein ODER über genau diese Wörter, ohne Ersatzweg
// (services/knowledge-object/src/repo-candidates.test.ts:72-77).
//
// GEMESSEN WIRD AN DER ECHTEN KETTE (s. messstand.ts): echter KoService auf InMemoryKoRepo mit
// freigegebener Suchprojektion, echter ConflictService, `checkKnowledge` aus dem Produktpfad. Der
// Lauscher schreibt die Wortliste mit, die wirklich übergeben wurde — die Auswahlregel wird
// nirgends nachgebaut.

// Der Fachinhalt. Sieben Wörter über drei Zeichen; das Bestandsobjekt trägt denselben Sachverhalt.
const FACHINHALT =
  "Rueckhaltebecken bei Frostgefahr vollstaendig entleeren, sonst friert die Leitung ein.";

// Die Kopfzeile: dreizehn Wörter über drei Zeichen, von denen KEINES im Bestand vorkommt — auch
// nicht als Teilzeichenkette (die Vorauswahl vergleicht mit `includes`). Sie ist damit genau das,
// was sie im Betrieb ist: Beiwerk, das über den Inhalt nichts sagt.
const KOPFZEILE =
  "Quelle Intranet Portal Wiki Redaktion Datum Montag Status Freigabe Kategorie Anweisung Bereich Werk";

const MIT_KOPF = `${KOPFZEILE}\n${FACHINHALT}`;
const KOPF_HINTEN = `${FACHINHALT}\n${KOPFZEILE}`;

const BESTAND = [
  {
    title: "Rueckhaltebecken bei Frostgefahr",
    statement: "Rueckhaltebecken bei Frostgefahr vollstaendig entleeren.",
  },
];

// ------------------------------------------------------------------------------------------------
// RUNDE 2 · DER VON BEN GEMESSENE TREFFERVERLUST (Korrekturpflicht 1).
// ------------------------------------------------------------------------------------------------
// Der harte Fall, an dem die Stützstellen-Auswahl der Runde 1 zerbrach: der Bestandsgegenstand hängt
// an GENAU EINEM Wort des Entwurfs, und dieses Wort steht auf Wortplatz zwei — also weder am Anfang
// noch am Ende noch auf einer der zwölf gleichmäßig verteilten Stellen. Gemessen von BEN:
// alte Auswahl 1 Kandidat / 1 similar, Stützstellen-Auswahl 0 / 0.
const EIN_WORT_BESTAND = [{ title: "Überdrucksicherheitsventil", statement: "Bei 20 bar zu." }];
const EIN_WORT_ENTWURF =
  "Bitte Überdrucksicherheitsventil bei 20 bar zu. Quelle Intranet Portal Wiki Redaktion Datum " +
  "Montag Status Freigabe Kategorie Anweisung Bereich Werk Erfassung Ursprung Dokument Hinweis Stand";

/** Berichtszeile für die Rückgabe — wörtlich das, was gemessen wurde. */
function bericht(name: string, m: Messung): string {
  return [
    `${name}:`,
    `  terme(${m.terme.length}) = ${JSON.stringify(m.terme)}`,
    `  kandidaten = ${m.kandidaten}`,
    `  similar = ${JSON.stringify(m.similar)}`,
    `  conflicts = ${JSON.stringify(m.conflicts)}`,
    `  status = ${m.status}`,
    `  judgeAufrufe = ${m.judgeAufrufe}`,
  ].join("\n");
}

describe("JOB 3574: die Suchwörter des Live-Checks", () => {
  // ==============================================================================================
  // LIEFERUNG 1 · ZUERST MESSEN. Die Zahlen dieses Falls stehen wörtlich in der Rückgabe.
  // ==============================================================================================
  it("MESSUNG · derselbe Fachinhalt, einmal ohne und einmal mit Kopfzeile", async () => {
    const a = await miss(await bestand(BESTAND), FACHINHALT);
    const b = await miss(await bestand(BESTAND), MIT_KOPF);
    const c = await miss(await bestand(BESTAND), KOPF_HINTEN);
    console.log(
      `\n${bericht("FALL A (ohne Kopfzeile)", a)}\n${bericht("FALL B (Kopfzeile VORNE)", b)}\n${bericht("FALL V2 (Kopfzeile HINTEN)", c)}`,
    );
    expect(a.terme.length).toBeGreaterThan(0);
  });

  // ==============================================================================================
  // RED-FIRST-VERTRAG (§6): Fall A ist die Kontrolle, Fall B war der rote Fall.
  // ==============================================================================================
  it("FALL A · KONTROLLE: ohne Kopfzeile ist das Bestandsobjekt Kandidat und Ähnlichkeitstreffer", async () => {
    const a = await miss(await bestand(BESTAND), FACHINHALT);
    expect(a.terme).toEqual([
      "rueckhaltebecken",
      "frostgefahr",
      "vollstaendig",
      "entleeren",
      "sonst",
      "friert",
      "leitung",
    ]);
    expect(a.kandidaten).toBe(1);
    expect(a.similar).toHaveLength(1);
    // BENs Prüflücke 6: status, conflicts und Judge-Zahl werden nicht nur protokolliert, sondern
    // festgehalten. Der Spy-Judge verneint jeden Verdacht → conflicts leer, aber er LIEF (1 Aufruf).
    expect(a.status).toBe("done");
    expect(a.conflicts).toEqual([]);
    expect(a.judgeAufrufe).toBe(1);
  });

  it("FALL B · derselbe Fachinhalt MIT Kopfzeile findet dasselbe Bestandsobjekt", async () => {
    // DERSELBE Bestand für beide Läufe — nur dann sind die Treffer-IDs vergleichbar (jeder
    // `bestand()`-Aufbau vergibt neue UUIDs). Der Live-Check persistiert nichts, die Läufe sind
    // deshalb unabhängig voneinander.
    const dienst = await bestand(BESTAND);
    const b = await miss(dienst, MIT_KOPF);
    const a = await miss(dienst, FACHINHALT);
    // Vor diesem Auftrag: zwölf Kopfzeilenwörter, 0 Kandidaten, 0 Treffer — und trotzdem „done".
    expect(b.terme).toHaveLength(12);
    // Die Fachwörter sind wieder dabei: die Vorauswahl hat etwas zu vergleichen.
    expect(b.terme.filter((w) => FACHINHALT.toLowerCase().includes(w)).length).toBeGreaterThan(0);
    expect(b.kandidaten).toBe(1);
    expect(b.similar).toHaveLength(1);
    // Das Versprechen des Auftrags wörtlich: DIESELBE Prüfung wie ohne Kopfzeile — nicht nur ein
    // Treffer, sondern derselbe Treffer, derselbe Status, derselbe Egress.
    expect(b.similar).toEqual(a.similar);
    expect(b.status).toBe(a.status);
    expect(b.conflicts).toEqual(a.conflicts);
    expect(b.judgeAufrufe).toBe(a.judgeAufrufe);
  });

  // ==============================================================================================
  // LIEFERUNG 3 · VERTRÄGLICHKEIT, GEMESSEN STATT BEHAUPTET.
  // ==============================================================================================
  it("V1 · höchstens zwölf verschiedene Wörter: die Liste ist Wort für Wort die alte", async () => {
    // Sieben verschiedene Wörter über drei Zeichen — die Auswahl greift gar nicht. Erwartet wird
    // die Textreihenfolge, wie sie `.slice(0, 12)` bis heute lieferte (die Liste steht literal da,
    // sie wird nicht aus der Regel nachgerechnet).
    const a = await miss(await bestand(BESTAND), FACHINHALT);
    expect(a.terme).toEqual([
      "rueckhaltebecken",
      "frostgefahr",
      "vollstaendig",
      "entleeren",
      "sonst",
      "friert",
      "leitung",
    ]);
    expect(a.terme.length).toBeLessThanOrEqual(12);
  });

  it("V2 · Fachinhalt VORNE: der heute gefundene Kandidat bleibt gefunden", async () => {
    // Zwanzig verschiedene Wörter, die Fachwörter auf den Plätzen 1–7. Heute (Textreihenfolge)
    // stehen sie alle in der Liste; die neue Auswahl darf den Kandidaten nicht verlieren.
    const c = await miss(await bestand(BESTAND), KOPF_HINTEN);
    expect(c.terme).toHaveLength(12);
    expect(c.kandidaten).toBe(1);
    expect(c.similar).toHaveLength(1);
  });

  // ==============================================================================================
  // V3 · RUNDE 2, KORREKTURPFLICHT 1 (BENs gemessener Trefferverlust).
  // ==============================================================================================
  // Der Fall, der die Stützstellen-Auswahl der Runde 1 gekippt hat: der einzige Anknüpfungspunkt
  // des Bestandsgegenstands ist EIN Wort auf Wortplatz zwei. Die Auswahl muss es halten — sonst
  // verschwindet ein heute sichtbarer Ähnlichkeitstreffer.
  it("V3 · ein Kandidat, der an EINEM Wort auf Platz zwei hängt, bleibt gefunden", async () => {
    const m = await miss(await bestand(EIN_WORT_BESTAND), EIN_WORT_ENTWURF);
    expect(m.terme).toHaveLength(12);
    expect(m.terme).toContain("überdrucksicherheitsventil");
    expect(m.kandidaten).toBe(1);
    expect(m.similar).toHaveLength(1);
  });

  // ==============================================================================================
  // G1/G2 · DIE GRENZE DER ZWÖLF (BENs Prüflücke: genau zwölf und dreizehn Wörter).
  // ==============================================================================================
  it("G1 · genau zwölf verschiedene Wörter: die Auswahl greift nicht, Textreihenfolge bleibt", async () => {
    const zwoelf = "alpha beta1 gamma delta epsilon zeta1 eta12 theta iota1 kappa lambda myzel";
    const m = await miss(await bestand(BESTAND), zwoelf);
    expect(m.terme).toEqual([
      "alpha",
      "beta1",
      "gamma",
      "delta",
      "epsilon",
      "zeta1",
      "eta12",
      "theta",
      "iota1",
      "kappa",
      "lambda",
      "myzel",
    ]);
  });

  it("G2 · dreizehn verschiedene Wörter: zwölf Plätze, das dreizehnte Wort fällt nach der Regel", async () => {
    // Ein Wort mehr als Plätze — ab hier wählt die Regel. Sie wählt nach Wortlänge: das kürzeste
    // Wort fällt, nicht das letzte. `myzel` (5) fliegt, `epsilonwort` (11) bleibt.
    const dreizehn =
      "alphawort betawort1 gammawort deltawort epsilonwort zetawort1 etawort12 thetawort iotawort1 kappawort lambdawort omegawort myzel";
    const m = await miss(await bestand(BESTAND), dreizehn);
    expect(m.terme).toHaveLength(12);
    expect(m.terme).not.toContain("myzel");
    expect(m.terme).toContain("epsilonwort");
  });

  // ==============================================================================================
  // §9 ZUSTANDSMODELL · die neue Auswahl wirft keine neue Ausnahme.
  // ==============================================================================================
  it("Z1 · nur Wörter mit höchstens drei Zeichen: leere Wortliste, kein Fehlerstatus", async () => {
    const z = await miss(await bestand(BESTAND), "wir tun das nur ab und zu mal so hin und her");
    expect(z.terme).toEqual([]);
    expect(z.kandidaten).toBe(0);
    // Ehrlich wie heute: kein „failed", kein erfundener Treffer.
    expect(z.status).not.toBe("failed");
    expect(z.similar).toEqual([]);
  });

  // ==============================================================================================
  // LIEFERUNG 4 · EINE TOKENISIERUNG ODER ZWEI — GEMESSEN.
  // ==============================================================================================
  // `queryTokens` (services/reasoner) ist laut services/reasoner/index.ts:51-52 „die Tokenisierung
  // der Frage für den Repo-Prefilter". Die Frage des Auftrags ist, ob sie AN DIESER STELLE die
  // eigene Zerlegung ablösen kann. Dieser Fall misst den Unterschied an genau den Texten oben; die
  // Entscheidung und ihre Begründung stehen am Code (knowledge-check.ts, bei `terms`).
  it("T1 · der Unterschied zwischen queryTokens und der Zerlegung des Live-Checks, gemessen", async () => {
    const a = await miss(await bestand(BESTAND), FACHINHALT);
    const qt = queryTokens(FACHINHALT);
    const nurQt = qt.filter((w) => !a.terme.includes(w));
    const nurHier = a.terme.filter((w) => !qt.includes(w));
    console.log(
      `\nT1 · queryTokens(FACHINHALT) = ${JSON.stringify(qt)}\n     live-check terms       = ${JSON.stringify(a.terme)}\n     nur queryTokens        = ${JSON.stringify(nurQt)}\n     nur live-check         = ${JSON.stringify(nurHier)}`,
    );
    // Die beiden Listen sind NICHT dieselben: queryTokens stammt und schneidet anders.
    expect(qt).not.toEqual(a.terme);
    expect(nurHier.length + nurQt.length).toBeGreaterThan(0);
  });

  it("T1b · queryTokens senkt die Mindestlänge — genau die Schwelle, die dieser Auftrag nicht anfasst", () => {
    // Der Live-Check nimmt Wörter ÜBER drei Zeichen. `queryTokens` nimmt sie ab drei Zeichen
    // (provider.ts:1183, `w.length > 2`). „Gas" ist der kürzeste Beleg: für den Live-Check kein
    // Suchwort, für queryTokens eines. Ein Wechsel wäre damit eine Schwellenänderung, und §10 des
    // Auftrags verbietet sie wörtlich.
    expect(queryTokens("Gas am Ventil ablassen")).toContain("gas");
    expect("Gas".length).toBe(3);
  });
});
