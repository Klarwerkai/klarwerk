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
// werden — die Vorauswahl ist ein ODER über genau diese Wörter. JOB 3881 hat diese Zeile
// berichtigt: sie stützte sich auf den Test der ADAPTERmethode (repo-candidates.test.ts), die das
// Produkt seit G27 nicht mehr ruft. Der Beleg ist jetzt Fall S1 unten, gemessen an der wirklich
// laufenden Kette — samt der einen Ausnahme, die es doch gibt (`expandSearchTerms`).
//
// GEMESSEN WIRD AN DER ECHTEN KETTE (s. messstand.ts): echter KoService auf InMemoryKoRepo mit
// freigegebener Suchprojektion, echter ConflictService, `checkKnowledge` aus dem Produktpfad. Der
// Lauscher schreibt die Wortliste mit, die wirklich übergeben wurde — die Auswahlregel wird
// nirgends nachgebaut.

// ================================================================================================
// JOB 3854 · DER PREIS DER ZWÖLF PLÄTZE WIRD GEMESSEN — NICHT BEHOBEN.
// ================================================================================================
//
// L3 unten hält einen VERLUST fest: hängt ein Bestandsgegenstand ausschließlich an einem KURZEN
// Wort eines langwortreichen Entwurfs, fällt dieses Wort aus den zwölf Suchwörtern, der Gegenstand
// wird nicht mehr gefunden — und der Live-Check meldet trotzdem „done", also denselben Befund wie
// bei einem echten „nichts gefunden".
//
// DAS IST DER BEKANNTE, HINGENOMMENE PREIS DER ZWÖLF PLÄTZE, vom Produktcode selbst zugegeben
// (services/app/src/knowledge-check.ts:337-348: „Ein Verlust bleibt möglich, wenn ein Gegenstand
// ausschließlich an einem der kürzesten Wörter eines langwortreichen Entwurfs hängt; das wird hier
// nicht wegbehauptet."). Dieser Auftrag MISST ihn, er BEHEBT ihn NICHT: die Lücke bleibt offen.
// Eine Behebung wäre eine Änderung der zwölf Plätze, also eine Schwellenänderung — und die liegt
// bei Pedi und Codex (archiv/3574/runde-2/RUECKGABE.md:49-50), nicht bei einem Test.
//
// Was sich durch diese Fälle ändert: die Auswahlregel kann nicht mehr unbemerkt strenger oder
// schwächer werden, und der Zielkonflikt steht als Messwert da statt nur als Absatz im Kommentar.

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

// ------------------------------------------------------------------------------------------------
// JOB 3854 · DIE TEXTE DER DREI NEUEN FÄLLE.
// ------------------------------------------------------------------------------------------------
// L1: vierzehn verschiedene Wörter über drei Zeichen, darunter mehrere Paare GLEICHER Länge
// (17, 16, 15 und 9 Zeichen), die alle in die Zwölf gehören. Die Reihung wird als Ganzes gemessen.
const L1_ENTWURF =
  "Binnenentwaesserung Regenrueckhaltung Kanalnetzbetrieb Schlammbehandlung Pumpwerkstoerung " +
  "Belebungsbecken Rechengutpresse Nachklaerung Zulaufwert Sandfang9 Faulturm Gasmotor Abwasser Probelauf";

// L2: GENAU dreizehn verschiedene Wörter über drei Zeichen — ein Platz zu wenig. Die elf mittleren
// haben paarweise verschiedene Längen (16…6); die zwei KÜRZESTEN sind gleich lang (je fünf Zeichen)
// und stehen bewusst am Anfang und am Ende des Textes. Über sie entscheidet der Gleichstand-Zweig.
const L2_ENTWURF =
  "Myzel Sauerstoffzufuhr Nachklaerbecken Betriebsstunde Schlammwasser Rechenanlage Pumpensumpf " +
  "Ablaufwert Probelauf Faulturm Klaerer Zulauf Algen";

// ------------------------------------------------------------------------------------------------
// L3 · RUNDE 2, KORREKTURPFLICHT 1 (BEN): EIN Fachtext für BEIDE Hälften, nur Metadaten wandern.
// ------------------------------------------------------------------------------------------------
// Runde 1 verglich zwei VERSCHIEDENE Fachtexte („… Gully" gegen „Gully bei Frost pruefen.") und
// schleppte damit „frost" und „pruefen" als zusätzliche Trefferwörter in die Gegenkontrolle: sie
// blieb grün, auch wenn man „Gully" aus dem Bestand nahm — sie bewies also nicht, was sie behauptete
// (ben.md Runde 1, Prüfpunkte 1/2/4). Deshalb steht der Fachtext jetzt GENAU EINMAL da; die beiden
// Hälften unterscheiden sich ausschließlich durch die vorangestellten Metadaten.
//
// DER FACHTEXT ist so gebaut, dass sein EINZIGES Suchwort „gully" ist: jedes andere Wort hat
// höchstens drei Zeichen und fällt schon an `TERM_MIN_LAENGE` (knowledge-check.ts:350, `w.length > 3`).
// Damit hängt der Bestandsgegenstand nachweislich an genau diesem einen kurzen Wort — die
// Gegenprobe „Gully aus dem Bestand entfernen" rötet die Gegenkontrolle (gemessen, s. Rückgabe).
// Er ist mit 30 Zeichen zugleich lang genug für die Textmindestlänge (knowledge-check.ts:377,
// `clean.length < 12` → „pending"), sonst käme der Live-Check gar nicht bis zur Vorauswahl.
const L3_FACHTEXT = "Gully bei Eis zu, bei Tau auf.";

// Der Bestandsgegenstand trägt denselben Sachverhalt. Kein Metadatenwort des Entwurfs kommt in
// seinem Kandidatentext vor — auch nicht als Teilzeichenkette und auch nicht in der Kategorie
// „Anlage 1", die `koCandidateText` mitliest (services/knowledge-object/src/repo.ts:270-274).
const GULLY_BESTAND = [{ title: "Gully", statement: L3_FACHTEXT }];

// Zwölf Metadatenwörter, JEDES länger als „Gully", in STRENG ABSTEIGENDER Länge (20, 16, 15, 14,
// 13, 12, 11, 10, 9, 8, 7, 6). Mit dem Fachtext sind es dreizehn verschiedene Wörter über drei
// Zeichen auf zwölf Plätze — „gully" ist das kürzeste und fällt.
const L3_METADATEN =
  "Verteilerinformation Ursprungsvermerk Bereichsleitung Dokumentenpfad Freigabestufe Datumsangabe " +
  "Redaktionen Verteilung Erfassung Intranet Montags Quelle";
const L3_OHNE_METADATEN = L3_FACHTEXT;
const L3_MIT_METADATEN = `${L3_METADATEN} ${L3_FACHTEXT}`;

// ------------------------------------------------------------------------------------------------
// JOB 3881 · TRIFFT DIE PRODUKTIONSVORAUSWAHL AUF TEILZEICHENKETTEN? GEFRAGT, NICHT GERATEN.
// ------------------------------------------------------------------------------------------------
// Die Begründung der Auswahlregel stützte sich bis zu diesem Auftrag auf `koCandidateScore`
// (services/knowledge-object/src/repo.ts) — eine Funktion ohne Produktaufrufer. Ob die WIRKLICH
// laufende Kette (`deps.ko.findCandidates` → `KoService.findCandidates` → `findSearchHits` →
// `KoSearchProjectionRepo.findActive`) dieselbe Teilzeichenketten-Regel hat, war damit unbelegt.
// Dieser Fall fragt sie — mit demselben Messstand, ohne zweiten Aufbau.
const TEIL_BESTAND = [
  { title: "Ueberdrucksicherheitsventil", statement: "Bei 20 bar schliesst es selbsttaetig." },
];
// Das längste Wort ist eine echte TEILZEICHENKETTE des Bestandsworts („ueber|drucksicherheit|sventil").
// Kein anderes Wort des Entwurfs kommt im Kandidatentext vor — der Treffer hängt an diesem einen.
const TEIL_ENTWURF = "Die drucksicherheit am Kessel taeglich pruefen.";
// Die Gegenrichtung: dasselbe Satzgerüst mit dem VOLLEN Wort.
const VOLL_ENTWURF = "Das Ueberdrucksicherheitsventil am Kessel taeglich pruefen.";
// Die dritte Richtung (§9): kein Wort trifft, auch nicht als Teilzeichenkette.
const NICHTS_ENTWURF = "Der Rechengutkorb wird woechentlich entnommen.";

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
    // JOB 3854 · BENs Prüflücke 6 wörtlich (archiv/3574/runde-2/ben.md:28): „V2 assertiert weiterhin
    // weder Status noch Konflikte oder Judge-Zahl … diese ergänzen." Jede einzeln, gemessen:
    expect(c.status).toBe("done");
    expect(c.conflicts).toEqual([]);
    expect(c.judgeAufrufe).toBe(1);
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

  // ==============================================================================================
  // JOB 3854 · L1/L2/L3 — DIE DREI VON BEN BENANNTEN PRÜFLÜCKEN (archiv/3574/runde-2/ben.md:28).
  // ==============================================================================================

  it("L1 · über zwölf Wörter: die Reihung der zwölf, vollständig festgenagelt", async () => {
    // Vierzehn verschiedene Wörter, darunter vier Paare gleicher Länge (17, 16, 15, 9 Zeichen).
    // Geprüft wird die VOLLE Liste in gelieferter Reihenfolge, nicht ihre Länge und nicht einzelne
    // Wörter: die im Kommentar knowledge-check.ts:257-260 zugesagte Ordnung „nach Wortlänge
    // absteigend, bei gleicher Länge nach erstem Vorkommen" war bisher als Ganzes unbewacht.
    // Die Liste steht literal da — sie wird nicht aus der Regel nachgerechnet.
    const m = await miss(await bestand(BESTAND), L1_ENTWURF);
    console.log(`\n${bericht("L1", m)}`);
    expect(m.terme).toEqual([
      "binnenentwaesserung", // 19
      "regenrueckhaltung", // 17, früher im Text
      "schlammbehandlung", // 17, später im Text
      "kanalnetzbetrieb", // 16, früher
      "pumpwerkstoerung", // 16, später
      "belebungsbecken", // 15, früher
      "rechengutpresse", // 15, später
      "nachklaerung", // 12
      "zulaufwert", // 10
      "sandfang9", // 9, früher
      "probelauf", // 9, später
      "faulturm", // 8 — der letzte Platz; „gasmotor" und „abwasser" (auch 8) fallen
    ]);
  });

  it("L2 · gleich lange Wörter an der Auswahlgrenze: das früher vorkommende überlebt", async () => {
    // GENAU dreizehn Wörter auf zwölf Plätze — ein Platz zu wenig, und die beiden kürzesten sind
    // gleich lang (je fünf Zeichen). Über sie entscheidet allein der zweite Sortierschlüssel
    // `|| a.fundstelle - b.fundstelle` (knowledge-check.ts:367). `fundstelle` ist der Rang des
    // ERSTEN Vorkommens, weil `worte` aus einem `Set` in Einfügereihenfolge kommt (:354-361) —
    // das ist eine ausgeschriebene Regel, KEINE geerbte Sortierstabilität.
    const m = await miss(await bestand(BESTAND), L2_ENTWURF);
    console.log(`\n${bericht("L2", m)}`);
    expect(m.terme).toEqual([
      "sauerstoffzufuhr", // 16
      "nachklaerbecken", // 15
      "betriebsstunde", // 14
      "schlammwasser", // 13
      "rechenanlage", // 12
      "pumpensumpf", // 11
      "ablaufwert", // 10
      "probelauf", // 9
      "faulturm", // 8
      "klaerer", // 7
      "zulauf", // 6
      "myzel", // 5 — erstes Wort des Textes, überlebt den Gleichstand
    ]);
    expect(m.terme).toContain("myzel");
    expect(m.terme).not.toContain("algen"); // 5 Zeichen, letztes Wort des Textes — fällt
  });

  it("L3 · ein kurzes Fachwort gegen lange Metadaten: der Treffer geht verloren, und niemand sieht es", async () => {
    // DERSELBE Bestand UND DERSELBE FACHTEXT für beide Hälften (Korrekturpflicht 1 aus Runde 1) —
    // die beiden Entwürfe unterscheiden sich in nichts als den vorangestellten Metadaten. Nur so
    // ist belegt, dass die Metadaten den Verlust verursachen und nicht ein untauglicher
    // Bestandseintrag oder ein zweites, nur in einer Hälfte vorhandenes Trefferwort.
    const dienst = await bestand(GULLY_BESTAND);
    const a = await miss(dienst, L3_MIT_METADATEN);
    const b = await miss(dienst, L3_OHNE_METADATEN);
    console.log(`\n${bericht("L3(a) mit Metadaten", a)}\n${bericht("L3(b) ohne Metadaten", b)}`);

    // (a) DER VERLUST. „gully" ist kürzer als jedes der zwölf Metadatenwörter und fällt.
    expect(a.terme).not.toContain("gully");
    expect(a.terme).toEqual([
      "verteilerinformation", // 20
      "ursprungsvermerk", // 16
      "bereichsleitung", // 15
      "dokumentenpfad", // 14
      "freigabestufe", // 13
      "datumsangabe", // 12
      "redaktionen", // 11
      "verteilung", // 10
      "erfassung", // 9
      "intranet", // 8
      "montags", // 7
      "quelle", // 6
    ]);
    expect(a.kandidaten).toBe(0);
    expect(a.similar).toEqual([]);
    expect(a.conflicts).toEqual([]);
    // UND NIEMAND SIEHT ES: kein „failed", kein Hinweis — derselbe Befund, den die Oberfläche bei
    // einem echten „nichts gefunden" bekommt (Z1 unten). Genau das ist der gemessene Mangel.
    expect(a.status).toBe("done");
    expect(a.judgeAufrufe).toBe(0);

    // (b) DIE GEGENKONTROLLE: derselbe Bestand, DERSELBE Fachtext, nur OHNE die Metadaten. Die
    // Wortliste besteht aus GENAU EINEM Wort — daran und an nichts anderem hängt der Treffer. Nimmt
    // man „Gully" aus dem Bestand, fällt diese Gegenkontrolle auf 0 Kandidaten / 0 Treffer
    // (gemessen, Runde 2; genau das war in Runde 1 nicht der Fall).
    expect(b.terme).toEqual(["gully"]);
    expect(b.kandidaten).toBe(1);
    expect(b.similar).toHaveLength(1);
  });

  // ==============================================================================================
  // JOB 3881 · S1 — DIE MESSUNG, AUF DER DIE NEUE BEGRÜNDUNG STEHT.
  // ==============================================================================================
  it("S1 · die echte Kette trifft auf Teilzeichenketten: 1 Kandidat, aber 0 Ähnlichkeitstreffer", async () => {
    // GEMESSEN, NICHT VORWEGGENOMMEN. Derselbe Bestand für alle drei Läufe (der Live-Check
    // persistiert nichts), derselbe Messstand wie oben — kein zweiter Aufbau.
    const dienst = await bestand(TEIL_BESTAND);
    const teil = await miss(dienst, TEIL_ENTWURF);
    const voll = await miss(dienst, VOLL_ENTWURF);
    const nichts = await miss(dienst, NICHTS_ENTWURF);
    console.log(
      `\n${bericht("S1(teil) längstes Wort ist Teilzeichenkette", teil)}\n${bericht("S1(voll) volles Wort", voll)}\n${bericht("S1(nichts) kein Wort trifft", nichts)}`,
    );

    // (a) DIE ANTWORT AUF DIE FRAGE DES AUFTRAGS: ja, die Produktionsvorauswahl trifft auf
    //     TEILZEICHENKETTEN. „drucksicherheit" steht in keinem Feld des Bestandsobjekts als Wort —
    //     nur als Teil von „Ueberdrucksicherheitsventil" — und liefert trotzdem 1 Kandidaten.
    expect(teil.terme).toEqual(["drucksicherheit", "kessel", "taeglich", "pruefen"]);
    expect(teil.kandidaten).toBe(1);
    // (b) UND DIE GRENZE DESSELBEN BEFUNDS: der Kandidat wird kein Treffer. Die Trigramm-Nähe des
    //     Entwurfs zum Bestandstext bleibt unter SIMILAR_MIN_SCORE, also keine Ähnlichkeit, kein
    //     Judge-Aufruf — was auf dem Bildschirm ankommt, ist dasselbe wie bei „nichts gefunden".
    //     (Codex' Promptverbesserung zu JOB 3854: Kandidatenverlust und Schwellenverlust sind zwei
    //     verschiedene Dinge.)
    expect(teil.similar).toEqual([]);
    expect(teil.judgeAufrufe).toBe(0);
    expect(teil.status).toBe("done");

    // (c) DIE GEGENRICHTUNG mit dem VOLLEN Wort — dasselbe Satzgerüst, ein Wort getauscht: derselbe
    //     eine Kandidat, aber jetzt auch 1 Ähnlichkeitstreffer und 1 Judge-Aufruf. Das lange Wort
    //     gewinnt zweimal: in der Vorauswahl und an der Textnähe.
    expect(voll.terme).toEqual(["ueberdrucksicherheitsventil", "kessel", "taeglich", "pruefen"]);
    expect(voll.kandidaten).toBe(1);
    expect(voll.similar).toHaveLength(1);
    expect(voll.judgeAufrufe).toBe(1);
    expect(voll.kandidatenIds).toEqual(teil.kandidatenIds);

    // (d) §9 ZUSTANDSMODELL, festgenagelt und NICHT behoben: findet die Vorauswahl nichts, meldet
    //     der Live-Check „done" mit leerer Trefferliste — denselben Befund wie ein geprüftes
    //     „nichts gefunden". Das ist die bekannte Krankheit dieser Zeile; dieser Fall hält sie
    //     fest und benennt sie als offen.
    expect(nichts.terme).toEqual(["rechengutkorb", "wird", "woechentlich", "entnommen"]);
    expect(nichts.kandidaten).toBe(0);
    expect(nichts.similar).toEqual([]);
    expect(nichts.conflicts).toEqual([]);
    expect(nichts.status).toBe("done");
    expect(nichts.judgeAufrufe).toBe(0);
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
