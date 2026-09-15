// ================================================================================================
// JOB 3627 · DER VERSIONSVERMERK — WAS ÜBERSETZT WIRD UND WAS AUSDRÜCKLICH NICHT.
// ================================================================================================
//
// Der Befund, der diese Datei auslöst, ist am Chromium gemessen (F20 in
// `tests/design/h4-funktionsinventar.test.ts`): die englische Bibliothek las unter „Mehr"
//     History › v1 · 9/11/2026 erstellt
//     Snapshots › … Initial version — no previous diff. erstellt Open version · …
// — das deutsche Wort mitten im englischen Text.
//
// F20 BLEIBT DIE ABNAHME DIESES AUFTRAGS: er misst am echten Browser, dass dort jetzt „created"
// steht. Diese Datei misst die andere Hälfte, die ein Browserfall gar nicht zeigen kann: dass
// FREMDER Text unangetastet bleibt und dass jeder Schlüssel wirklich in allen drei Sprachen liegt.
//
// ------------------------------------------------------------------------------------------------
// JOB 3843 · DER WÄCHTER BEKOMMT ZÄHNE — DIE TEXTE SELBST WERDEN FESTGENAGELT.
// ------------------------------------------------------------------------------------------------
//
// WAS BIS HIERHER FEHLTE, und der Prüfer hat es in JOB 3627 R1 wörtlich bestellt („Ergänze für
// beide Vermerkanzeigen einen positiven englischen Solltext; das bloße Fehlen des deutschen Wortes
// genügt als dauerhafter Wächter nicht."): geprüft wurde nur, dass der englische Text NICHT der
// deutsche ist. Ein falscher, aber echt englischer Text — „revised" statt „created", ein Tippfehler,
// ein in den englischen Block gerutschter niederländischer Satz — erfüllte jede Zusicherung dieser
// Datei und stand dem Leser trotzdem falsch auf dem Schirm.
//
// (i) DIESE DATEI NAGELT JETZT DIE TEXTE FEST, in allen drei Sprachen, zeichengenau. Wer einen der
//     fünf Katalogtexte umbaut, macht sie deshalb ABSICHTLICH rot. Die Antwort darauf ist, den
//     gemessenen Wert in `DIENST_VERMERKE` nachzuziehen — NICHT die Zusicherung wieder auf
//     „irgendwas, nur nicht deutsch" aufzuweichen. Genau diese Aufweichung ist der Zustand, den
//     JOB 3843 beendet.
//
// (ii) DIE SOLLTEXTE SIND GEMESSEN, NICHT ABGESCHRIEBEN: sie stammen aus `alleSprachbestaende()`
//     am Stand 172001e (13.09.2026) und stehen hier als Literale. Ein Literal, das nicht dem
//     gemessenen Wert entspricht, macht diese Datei sofort rot — ein erfundener oder aus einer
//     Auftragsdatei abgeschriebener Wert ist damit ausgeschlossen.
//
// (iii) F20 in `tests/design/h4-funktionsinventar.test.ts` BLEIBT die Browserhälfte der Kette und
//     wird von JOB 3843 nicht angefasst. Diese Datei misst am KATALOG und am DIENSTWEG, nicht am
//     Bildschirm; eine Browserwirkung behauptet sie nicht.
//
// (iv) ZWEI FEHLER, ZWEI GETRENNTE FÄLLE — und deshalb ist das keine Verdopplung: `not.toBe(de)`
//     meldet, dass der englische Eintrag FEHLT und über `fallbackLng: "de"` das deutsche Wort
//     durchreicht. `toBe(v.en)` meldet, dass der englische Eintrag DA und FALSCH ist. Das sind zwei
//     verschiedene Schäden mit zwei verschiedenen Ursachen; sie stehen bewusst in getrennten
//     Fällen, damit an der Farbe ablesbar ist, welcher von beiden vorliegt.
//
// (v) DER DIENSTWEG WIRD SEPARAT GEMESSEN, weil er nicht dasselbe ist wie der Katalog: der Weg
//     Vermerk → Schlüssel liegt in `koHistoryNote.ts`, der Weg Schlüssel → Text im Katalog. Eine
//     falsche Zuordnung in der ersten Hälfte liefert einen tadellosen Katalogtext an der falschen
//     Stelle. `MehrAbschnitte.tsx` zeichnet den Vermerk an GENAU ZWEI Stellen (`:1244` Historie,
//     `:1604` Schnappschuss) und beide über diese eine Funktion — gemessen mit
//     `grep -n "koHistoryNote" MehrAbschnitte.tsx`, das ausser dem Import nur diese zwei Zeilen
//     nennt. Die Zusage des Dienstwegfalls gilt damit für beide Anzeigen; das ist der Grund, warum
//     ein einziger Fall die Bestellung „für beide Vermerkanzeigen" erfüllt, und nicht bloss eine
//     Behauptung.
//
// (vi) WAS DIE ERKENNUNG DER FESTEN VERMERKE FÄNGT (`gefunden()`), gemessen in den Abschnitten (e)
//     und (f): `note:"x"` ohne Leerzeichen, `note:   "x"` mit mehreren, `note: 'x'` mit einfachen
//     und ``note: `x` `` mit umgekehrten Anführungszeichen, `this.snapshot(tx, idOf(ko), "x")` mit
//     Klammern im Argument und denselben Aufruf über mehrere Zeilen. Kommentare und fremde Felder
//     (`titel: "x"`) meldet sie NICHT. Von diesen sechs waren fünf wirklich blind; der mehrzeilige
//     Aufruf war es NICHT, denn das alte Muster lief schon über Zeilenumbrüche — das steht bei den
//     Fällen und wird hier nicht zu einer sechsten geschlossenen Lücke aufgerundet.
//
// (vii) WAS SIE ALS VERMERK ZÄHLT, ist SYNTAKTISCH begrenzt, und das ist die Korrektur aus
//     JOB 3843 R2/R3 (BEN: „Der Leser muss den syntaktischen Vermerk erkennen, nicht beliebige
//     passende Zeichenfolgen."). Eine Weitung, die in die andere Richtung überschiesst, ist kein
//     schärferer Wächter, sondern ein lauter: sie meldet Vermerke, die der Dienst nie schreibt, und
//     rötet den Bestandsfall grundlos. Drei Grenzen halten das:
//       · ein `note:`-Feld zählt nur AUSSERHALB von Zeichenketten — `{ titel: 'note: "x"' }` ist der
//         Text eines Menschen und kein Schreibweg (Fall (D) in (e));
//       · ein `this.snapshot(`-AUFRUFANFANG zählt ebenso nur ausserhalb von Zeichenketten. Bis R2
//         galt das nur für den `note:`-Zweig; der Aufrufleser suchte seine Marke im rohen Code und
//         nahm deshalb jeden ZITIERTEN Aufruf für einen echten — als blosser Titeltext (Fall (E))
//         und als Nachbarargument eines echten Aufrufs (Fall (H)). Beides hat BEN an R2 gemessen,
//         beides steht jetzt als dauerhafter Fall in (e);
//       · aus `this.snapshot(…)` zählt AUSSCHLIESSLICH das dritte Argument, weil genau dort die
//         Unterschrift des Dienstes den Vermerk führt (`service.ts:760` `snapshot(ko, author, note,
//         tx?)`). Ein Literal in einem Nachbarargument ist der Mandant, der Titel, die Transaktion —
//         nicht der Vermerk (Fälle (F)/(G) in (e); beide wurden an R1 fälschlich gemeldet).
//
// (viii) WAS SIE AUSDRÜCKLICH NICHT FÄNGT, und das ist die Grenze eines Textlesers, keine
//     Nachlässigkeit: einen Vermerk, der nicht als Literal dasteht (`note: derVermerk`,
//     `this.snapshot(ko, author, derVermerk)`), und jeden Weg in die Historie, der weder `note:`
//     heisst noch `this.snapshot(…)` ist. Bei einem zur Laufzeit ZUSAMMENGESETZTEN Vermerk meldet
//     sie nur das Literalstück und damit einen Wortlaut, den es so nie gibt. Unbemerkt bleibt ein
//     solcher Vermerk trotzdem nicht: der Fall „KEIN Schreibweg reicht einen MENSCHLICH eingegebenen
//     Vermerk durch" liest dasselbe dritte Argument und wird rot, sobald dort etwas anderes steht
//     als ein Literal oder das eine bekannte Feld. Diese Grenzen sind in (f) als Fälle festgehalten
//     statt hier behauptet: wer die Erkennung weitet, sieht dort rot und zieht diesen Kopf mit nach.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { koHistoryNote } from "../../apps/web/src/lib/koHistoryNote";
import { alleSprachbestaende } from "../support/i18nBestand";

const SPRACHEN = ["de", "en", "nl"] as const;
const BESTAND = alleSprachbestaende();

/** Die `t` einer Sprache, ohne die Fläche zu bewegen — dieselbe Quelle wie die Oberfläche. */
const uebersetzer = (lng: string): ((key: string) => string) => i18n.getFixedT(lng);

/**
 * DIE GEMESSENE LISTE (Lieferung 1) — jede Stelle, an der der Dienst einen FEST IM CODE stehenden
 * Vermerk in `history[].note` oder in einen Schnappschuss schreibt. Zeile und Wortlaut stammen aus
 * `services/knowledge-object/src/service.ts` am Basisstand 96b0e92 und werden unten gegen den
 * heutigen Quelltext gehalten, damit diese Liste nicht vergammeln kann.
 *
 * JOB 3667 RUNDE 7 (14.09.2026) · DIE ZEILENNUMMERN SIND NEU GEMESSEN, nicht geschätzt: der
 * Word-Rückweg hat oberhalb und innerhalb des Dienstes eingefügt, und alle acht Fundstellen sind
 * verrutscht. Die Wortlaute sind unverändert — es sind weiterhin dieselben FÜNF Vermerke.
 *
 * JOB 3843 · `en` und `nl` sind die am Katalog GEMESSENEN Solltexte (Stand 172001e, 13.09.2026,
 * gelesen über `alleSprachbestaende()`); `wort` ist zugleich der deutsche Solltext, weil der Dienst
 * sein Literal schreibt und der deutsche Katalogblock genau dieses Literal trägt. DIESELBE TABELLE
 * trägt beide Zusagen — kein zweites Verzeichnis, keine zweite Schleife (Lehre JOB 3793 R1 /
 * JOB 3830 R1).
 *
 * KEINE AUSNAHME NÖTIG, und das ist gemessen, nicht angenommen: bei keinem der fünf Schlüssel
 * stimmen `en` und `nl` überein. Käme je ein Schlüssel dazu, bei dem beide Sprachen mit ABSICHT
 * denselben Wortlaut tragen, gehört das als benanntes Feld mit Begründung in diese Tabelle — der
 * Fall „en ≠ nl" wird dann für diesen Eintrag begründet ausgenommen, nicht stillschweigend
 * weggelassen.
 */
const DIENST_VERMERKE = [
  {
    wort: "erstellt",
    schluessel: "ko.historyNote.created",
    en: "created",
    nl: "aangemaakt",
    fundstellen: [1860, 1979],
  },
  {
    wort: "erstellt (Dokumentinhalt übernommen)",
    schluessel: "ko.historyNote.createdFromDocument",
    en: "created (document content adopted)",
    nl: "aangemaakt (documentinhoud overgenomen)",
    fundstellen: [2201],
  },
  {
    wort: "erstellt (nachgezogen)",
    schluessel: "ko.historyNote.createdBackfilled",
    en: "created (backfilled)",
    nl: "aangemaakt (nagetrokken)",
    fundstellen: [2629],
  },
  {
    wort: "überarbeitet",
    schluessel: "ko.historyNote.revised",
    en: "revised",
    nl: "herzien",
    // JOB 3667 RUNDE 7 · VIER Fundstellen statt zwei, und das ist die ganze Spur dieses Auftrags in
    // dieser Tabelle: der Rückweg aus Word hat zwei weitere Schreibwege eröffnet, die eine neue
    // INHALTSFASSUNG erzeugen — „überarbeiten und gleich freigeben" (:3807) und „einen gebundenen
    // Änderungsvorschlag übernehmen" (:3996). Beide schreiben DENSELBEN Vermerk wie jede andere
    // Überarbeitung. Dass dabei zugleich freigegeben wurde, steht nicht im Vermerk, sondern im
    // Datensatz (`status`, `ownership.validators`) und in zwei Audit-Belegen; die Begründung dafür
    // steht bei `naechsteFassung` im Dienst.
    fundstellen: [3650, 3734, 3807, 3996],
  },
  {
    wort: "überarbeitet (Dokumentinhalt übernommen)",
    schluessel: "ko.historyNote.revisedFromDocument",
    en: "revised (document content adopted)",
    nl: "herzien (documentinhoud overgenomen)",
    fundstellen: [4210, 4228],
  },
] as const;

/** Der Solltext eines Eintrags in einer der beiden Fremdsprachen — eine Quelle, kein zweiter Zweig. */
const soll = (v: (typeof DIENST_VERMERKE)[number], lng: "de" | "en" | "nl"): string =>
  lng === "de" ? v.wort : lng === "en" ? v.en : v.nl;

// ------------------------------------------------------------------------------------------------
// DER EINE LESER DES DIENST-QUELLTEXTES (JOB 3843 · Lieferung 5).
// ------------------------------------------------------------------------------------------------
//
// `gefunden()` nahm den Quelltext bisher aus dem Umschluss. Damit war die Erkennung selbst nicht
// prüfbar: ihre einzige Probe wäre gewesen, den echten Dienst zu verstellen. Sie nimmt den
// Quelltext jetzt als Parameter — der Aufruf über den echten Dienst bleibt Zeichen für Zeichen
// derselbe, und die Schreibweisen lassen sich an kleinen Ausschnitten messen, ohne eine Produktdatei
// anzufassen.

/**
 * Kommentare raus, Zeichenketten heil.
 *
 * OHNE DIESEN SCHRITT WÄRE JEDE WEITUNG DER ERKENNUNG EIN EIGENTOR: ein Beispiel in einem Kommentar
 * (`// note: "erstellt"`) zählte als Fundstelle des Dienstes, und der Wächter meldete einen Vermerk,
 * den niemand schreibt. Der Durchlauf ist zeichenweise und kennt den Zustand „in einer Zeichenkette",
 * damit ein `//` in einem Text (`"https://…"`) nicht als Kommentaranfang gilt.
 */
const ohneKommentare = (text: string): string => {
  let raus = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i] as string;
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") {
        raus += " ";
        i += 1;
      }
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        raus += text[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      raus += i < text.length ? "  " : "";
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      raus += c;
      i += 1;
      while (i < text.length && text[i] !== c) {
        if (text[i] === "\\") {
          raus += text[i];
          i += 1;
        }
        if (i < text.length) {
          raus += text[i];
          i += 1;
        }
      }
      if (i < text.length) {
        raus += c;
        i += 1;
      }
      continue;
    }
    raus += c;
    i += 1;
  }
  return raus;
};

/**
 * Zeichenketten-INHALTE ausgeblendet, Länge und Anführungszeichen erhalten.
 *
 * JOB 3843 R2 · DIE ZWEITE HÄLFTE VON „KOMMENTARE RAUS": ein Vermerkfeld, das nur IN EINER
 * ZEICHENKETTE steht (`{ titel: 'note: "erstellt"' }`), ist Inhalt eines Menschen und kein
 * Schreibweg des Dienstes. Das Muster unten läuft deshalb über diese Maske statt über den Code:
 * dort sind Textinhalte Leerzeichen, ein `note:` darin ist verschwunden, und Anführungszeichen
 * kommen nur noch als echte Begrenzer vor. Weil die Maske ZEICHENGLEICH LANG ist, zeigt jeder
 * Treffer auf dieselbe Stelle im Code — der Wortlaut wird von dort geholt, nicht aus der Maske.
 *
 * GRENZE, gemessen in (f): ein `${…}` in einer umgekehrt angeführten Zeichenkette gilt als Inhalt,
 * nicht als Code. Ein Vermerk, der dort eingesetzt wird, meldet seinen Rohtext samt Platzhalter.
 */
const ohneTextinhalte = (code: string): string => {
  let raus = "";
  let i = 0;
  while (i < code.length) {
    const c = code[i] as string;
    if (c !== '"' && c !== "'" && c !== "`") {
      raus += c;
      i += 1;
      continue;
    }
    raus += c;
    i += 1;
    while (i < code.length && code[i] !== c) {
      if (code[i] === "\\" && i + 1 < code.length) {
        raus += "  ";
        i += 2;
        continue;
      }
      raus += code[i] === "\n" ? "\n" : " ";
      i += 1;
    }
    if (i < code.length) {
      raus += c;
      i += 1;
    }
  }
  return raus;
};

/**
 * Ein Vermerkfeld in JEDER Schreibweise: beliebiger Abstand, alle drei Anführungsarten.
 * Läuft über die Maske aus `ohneTextinhalte`, wo der Inhalt nur noch aus Leerzeichen besteht.
 */
const VERMERK_FELD = /\bnote\s*:\s*(["'`])([ \n]*)\1/g;

/** Ein Argument, das GANZ aus einer einzigen Zeichenkette besteht — und sonst nichts. */
const NUR_LITERAL = /^(["'`])((?:\\.|(?!\1)[^\\])*)\1$/;

/** Der Inhalt eines Arguments, wenn es ein reines Literal ist; sonst `null` (Variable, Ausdruck). */
const alsLiteral = (argument: string): string | null => {
  const m = NUR_LITERAL.exec(argument.trim());
  return m === null ? null : (m[2] as string);
};

/**
 * Die Argumente aller Aufrufe eines Namens, EINZELN — mit gezählten Klammern.
 *
 * Das alte Muster `this\.snapshot\([^)]*?"…"` konnte keine schliessende Klammer überspringen und las
 * an `this.snapshot(tx, idOf(ko), "erstellt")` und an jedem mehrzeiligen Aufruf vorbei. Genau dieses
 * Vorbeilesen sähe aus wie Entwarnung. Der Zähler kennt zusätzlich den Zustand „in einer
 * Zeichenkette", damit eine Klammer IM Text (`"f(x)"`) die Tiefe nicht verstellt.
 *
 * JOB 3843 R2 · GETRENNT WIRD AM KOMMA DER OBERSTEN EBENE, und erst das macht die Argumente
 * unterscheidbar: geschweifte und eckige Klammern zählen mit, sonst zerfiele
 * `this.snapshot({ ...ko, titel: "x" }, author, "y")` mitten im Objekt und das dritte Argument wäre
 * nicht mehr das dritte.
 *
 * JOB 3843 R3 · WO EIN AUFRUF ANFÄNGT, ENTSCHEIDET DIE MASKE — NICHT DER CODE (BEN an R2, zwei
 * gemessene Gegenbeispiele, jetzt Fall (E) und (H) in (e)). Gesucht wurde die Marke bisher im Code
 * und damit auch mitten in einer Zeichenkette: `{ titel: 'this.snapshot(ko, author, "x")' }` galt
 * als Schreibweg des Dienstes. Das war dieselbe Verwechslung von Inhalt und Code, die der
 * `note:`-Zweig über `ohneTextinhalte` längst vermied — nur eben in der Hälfte, die sie nicht
 * benutzte. Gesucht wird jetzt in der Maske, GESCHNITTEN weiterhin aus dem Code: die Maske ist
 * zeichengleich lang, also zeigt jede Fundstelle auf dieselbe Stelle, und der Wortlaut kommt aus
 * dem echten Text. Diese Längengleichheit ist die ganze Voraussetzung des Verfahrens und wird
 * deshalb geprüft statt vorausgesetzt.
 */
const argumenteVon = (code: string, maske: string, aufruf: string): string[][] => {
  if (maske.length !== code.length) {
    throw new Error(
      `argumenteVon: Maske und Code müssen zeichengleich lang sein (Maske ${maske.length}, Code ${code.length}) — sonst zeigen die Fundstellen der Maske ins Leere`,
    );
  }
  const raus: string[][] = [];
  const marke = `${aufruf}(`;
  let von = maske.indexOf(marke);
  while (von !== -1) {
    const start = von + marke.length;
    let tiefe = 1;
    let anfuehrung: string | null = null;
    let i = start;
    let letztes = start;
    const args: string[] = [];
    while (i < code.length && tiefe > 0) {
      const c = code[i] as string;
      if (anfuehrung !== null) {
        if (c === "\\") {
          i += 1;
        } else if (c === anfuehrung) {
          anfuehrung = null;
        }
      } else if (c === '"' || c === "'" || c === "`") {
        anfuehrung = c;
      } else if (c === "(" || c === "[" || c === "{") {
        tiefe += 1;
      } else if (c === ")" || c === "]" || c === "}") {
        tiefe -= 1;
        if (tiefe === 0) {
          args.push(code.slice(letztes, i));
        }
      } else if (c === "," && tiefe === 1) {
        args.push(code.slice(letztes, i));
        letztes = i + 1;
      }
      i += 1;
    }
    if (tiefe === 0) {
      const sauber = args.map((a) => a.trim());
      // Ein abschliessendes Komma (`…, tx,)`) hinterlässt ein leeres letztes Stück — das ist kein
      // Argument und darf die Zählung der übrigen nicht verschieben.
      if (sauber[sauber.length - 1] === "") {
        sauber.pop();
      }
      raus.push(sauber);
    }
    von = maske.indexOf(marke, start);
  }
  return raus;
};

/** Das Argument, das der Dienst als Vermerk führt: `snapshot(ko, author, note, tx?)`, service.ts:760. */
const VERMERK_ARGUMENT = 2;

/**
 * Jeder feste Vermerk eines Quelltextes: als `note: "…"`-Feld ODER als DRITTES Argument von
 * `this.snapshot(…)`.
 *
 * DER EINZIGE ORT DIESER DATEI, DER QUELLTEXT NACH FESTEN VERMERKEN ABSUCHT. Der Aufruf unten
 * übergibt den echten Dienst; die Fälle in (e) und (f) übergeben kleine Ausschnitte.
 *
 * JOB 3843 R2 · WARUM NICHT „JEDES LITERAL IM AUFRUF": weil dann jede Nachbarangabe als Vermerk
 * gälte. `this.snapshot({ ...ko, titel: "erstellt" }, author, "überarbeitet")` meldete zwei Vermerke
 * statt einem, `this.snapshot(ko, author, "erstellt", txFor("mandant-a"))` meldete den Mandanten als
 * Vermerk — beides gemessen (BEN, JOB 3843 R1), beides steht jetzt als Fall in (e). Die Stelle des
 * Vermerks ist keine Annahme, sondern die Unterschrift des Dienstes: `snapshot(ko, author, note,
 * tx?)`. Wandert sie, wird der Bestandsfall oben rot, weil die fünf Wortlaute nicht mehr auftauchen.
 */
const gefunden = (quelle: string): string[] => {
  const code = ohneKommentare(quelle);
  const maske = ohneTextinhalte(code);
  const raus = new Set<string>();
  for (const m of maske.matchAll(VERMERK_FELD)) {
    const ende = (m.index ?? 0) + m[0].length - 1;
    raus.add(code.slice(ende - (m[2] as string).length, ende));
  }
  for (const args of argumenteVon(code, maske, "this.snapshot")) {
    const vermerk = alsLiteral(args[VERMERK_ARGUMENT] ?? "");
    if (vermerk !== null) {
      raus.add(vermerk);
    }
  }
  return [...raus].sort();
};

describe("JOB 3627 · die Liste der festen Dienst-Vermerke ist gemessen, nicht behauptet", () => {
  // KEINE ZWEITE ABSCHRIFT (Lehre JOB 3578 R1): gelesen wird der Quelltext des Dienstes selbst.
  // Führt jemand dort einen neuen festen Vermerk ein, ohne ihn in `koHistoryNote.ts` und in den
  // Katalog nachzutragen, wird dieser Fall rot — und zwar mit dem Wortlaut, der fehlt.
  const quelle = readFileSync("services/knowledge-object/src/service.ts", "utf8");

  it("der Dienst schreibt GENAU die fünf Vermerke, die die Tabelle kennt", () => {
    expect(gefunden(quelle)).toEqual([...DIENST_VERMERKE.map((v) => v.wort)].sort());
  });

  it("jede genannte Fundstelle trägt ihren Wortlaut wirklich", () => {
    const zeilen = quelle.split("\n");
    const daneben = DIENST_VERMERKE.flatMap((v) =>
      v.fundstellen
        .filter((nr) => !(zeilen[nr - 1] ?? "").includes(`"${v.wort}"`))
        .map((nr) => `service.ts:${nr} trägt nicht „${v.wort}“, sondern: ${zeilen[nr - 1] ?? "—"}`),
    );
    expect(daneben, "Fundstellen, die nicht mehr stimmen").toEqual([]);
  });

  it("KEIN Schreibweg reicht heute einen MENSCHLICH eingegebenen Vermerk durch", () => {
    // DIE GEGENPROBE ZU LIEFERUNG 1, und sie ist der Grund, warum die offene Grenze in
    // `koHistoryNote.ts` heute nicht erreichbar ist: jeder `this.snapshot(…)`-Aufruf übergibt
    // entweder ein LITERAL oder das `snapshot.note` aus `mutateKoTx` — und dessen EINZIGER
    // Erzeuger (`snapshot: { author, note: … }`) trägt seinerseits ein Literal. Käme dort je ein
    // Wert von aussen an, wäre die Grenze echt, und dieser Fall meldet es.
    //
    // JOB 3843: die Aufrufe kommen aus DEMSELBEN Leser wie oben (`argumenteVon`) statt aus einem
    // eigenen `[^)]*`-Muster. Sonst hätte dieser Fall die alte blinde Stelle behalten und wäre an
    // einem `this.snapshot(tx, idOf(ko), fremd)` schweigend vorbeigelaufen.
    //
    // JOB 3843 R2: geprüft wird jetzt GENAU DAS VERMERKARGUMENT, nicht mehr die ganze Argumentliste
    // auf ein Anführungszeichen hin. Der alte Satz liess einen Aufruf durchgehen, der irgendwo ein
    // Literal trug (etwa in einem Objekt oder im Transaktionsargument) — der Vermerk selbst konnte
    // dabei eine Variable von aussen sein, und der Fall schwieg.
    // JOB 3843 R3: derselbe Aufrufleser wie oben, samt Maske — sonst zählte dieser Fall auch die
    // Argumente eines Aufrufs, den nur jemand in einem Text ZITIERT hat, und meldete dessen
    // Vermerkstelle als offene Grenze des Dienstes.
    const code = ohneKommentare(quelle);
    const vermerkargumente = argumenteVon(code, ohneTextinhalte(code), "this.snapshot").map(
      (args) => args[VERMERK_ARGUMENT] ?? "—",
    );
    expect(
      vermerkargumente.filter((a) => alsLiteral(a) === null && a !== "snapshot.note"),
      "this.snapshot(…) mit einem Vermerk, der weder Literal noch das mutateKoTx-Feld ist",
    ).toEqual([]);
    const erzeuger = [...quelle.matchAll(/snapshot: \{[^}]*note: ([^,}]+)/g)].map((m) =>
      (m[1] as string).trim(),
    );
    // JOB 3667 RUNDE 7 · DREI ERZEUGER STATT EINEM — die Zusage dieses Falls ist unverändert und
    // wird hier NICHT gelockert: jeder Erzeuger muss ein LITERAL sein, und die Liste steht weiterhin
    // wörtlich da. Dass sie gewachsen ist, ist die Nachführpflicht dieses Auftrags: `revise`
    // (service.ts:3650), `reviseUndFreigeben` (:3807) und `decideProposal` (:3996) schreiben je eine
    // neue Inhaltsfassung und damit je einen Schnappschuss. Alle drei tragen DASSELBE Literal — käme
    // hier je ein Wert von aussen an, wäre die offene Grenze in `koHistoryNote.ts` erreichbar, und
    // genau das meldete dieser Fall dann.
    expect(erzeuger, "die Erzeuger des mutateKoTx-Vermerks — jeder muss ein Literal sein").toEqual([
      '"überarbeitet"',
      '"überarbeitet"',
      '"überarbeitet"',
    ]);
  });
});

describe("JOB 3627 · (a) ein bekannter Vermerk wird zum Katalogtext", () => {
  for (const v of DIENST_VERMERKE) {
    it(`„${v.wort}“ liest sich in de und en verschieden`, () => {
      const de = koHistoryNote(v.wort, uebersetzer("de"));
      const en = koHistoryNote(v.wort, uebersetzer("en"));
      // Die deutsche Lesung bleibt Zeichen für Zeichen das Wort des Dienstes — daran hängen die
      // zwei deutschen Sollwerte in `h4-funktionsinventar.test.ts:825`/`:826-832`.
      expect(de).toBe(v.wort);
      expect(en).not.toBe(de);
      expect(en).not.toBe(v.schluessel);
    });

    // JOB 3843 · Lieferung 3 — DER DIENSTWEG, ZEICHENGENAU, UND FÜR BEIDE ANZEIGEN.
    // Eigener Fall, nicht in den obigen hineingeschrieben: nur so ist an der Farbe ablesbar, dass
    // der Fall darüber bei einem falschen ENGLISCHEN Ersatztext grün bleibt — das ist die Lücke,
    // gegen die JOB 3843 steht. Und nur so trennt sich ein Fehler im Katalog von einem Fehler in
    // der Zuordnung `koHistoryNote.ts`: dieser Fall misst die GANZE Kette Vermerk → Schlüssel →
    // Text, wie sie `MehrAbschnitte.tsx:1244` und `:1604` durchlaufen.
    it(`„${v.wort}“ wird in en und nl zeichengenau zum Katalogtext`, () => {
      for (const lng of ["en", "nl"] as const) {
        const ist = koHistoryNote(v.wort, uebersetzer(lng));
        expect(
          ist,
          `koHistoryNote("${v.wort}") über ${v.schluessel} in ${lng} — erwartet „${soll(v, lng)}“, vorgefunden „${String(ist)}“`,
        ).toBe(soll(v, lng));
      }
    });
  }
});

describe("JOB 3627 · (b) fremder Text kommt WÖRTLICH zurück — auch wenn er ähnlich aussieht", () => {
  // DIE VERGLEICHSREGEL IST ZEICHENGENAUE GLEICHHEIT über den ganzen Wert. Kein Trimmen, keine
  // Kleinschreibung, kein Präfix: der Dienst schreibt genau seine Literale, alles andere ist
  // Inhalt eines Menschen und wird nicht angefasst.
  const FREMD = [
    "erstellt am Montag",
    "Erstellt",
    " erstellt ",
    "erstellt.",
    "neu erstellt",
    "überarbeitet nach Rücksprache mit der Konstruktion",
    "Fassung von Pedi geprüft",
    "created",
  ];
  for (const text of FREMD) {
    for (const lng of SPRACHEN) {
      it(`${lng} · „${text}“ bleibt unverändert`, () => {
        expect(koHistoryNote(text, uebersetzer(lng))).toBe(text);
      });
    }
  }
});

describe("JOB 3627 · (c) leer und fehlend kommen leer und fehlend zurück", () => {
  // Die Entscheidung, was dann dasteht, bleibt beim Aufrufer — `MehrAbschnitte.tsx:1238` hat
  // dafür `|| nameOf(h.author)`, und dieses Verhalten hängt an der Falschheit des Rückgabewerts.
  it("der leere Vermerk bleibt leer und bleibt falsch", () => {
    expect(koHistoryNote("", uebersetzer("en"))).toBe("");
    expect(koHistoryNote("", uebersetzer("en")) || "Autor").toBe("Autor");
  });

  it("null und undefined kommen unverändert zurück", () => {
    expect(koHistoryNote(null, uebersetzer("en"))).toBeNull();
    expect(koHistoryNote(undefined, uebersetzer("en"))).toBeUndefined();
  });
});

describe("JOB 3627 · (d) jeder Katalogschlüssel liegt wirklich in de, en und nl", () => {
  for (const v of DIENST_VERMERKE) {
    it(`${v.schluessel} steht in allen drei Blöcken`, () => {
      const fehlend = SPRACHEN.filter((lng) => typeof BESTAND[lng]?.[v.schluessel] !== "string");
      expect(fehlend, `Sprachen ohne Eintrag für ${v.schluessel}`).toEqual([]);
    });

    it(`${v.schluessel} lautet in en NICHT wie in de`, () => {
      // Ein fehlender englischer Eintrag fiele über `fallbackLng: "de"` auf das deutsche Wort
      // zurück — genau der Rückfall, den dieser Auftrag behebt. Er sähe ohne diesen Satz aus wie
      // eine Übersetzung.
      const de = BESTAND.de?.[v.schluessel] as string;
      const en = BESTAND.en?.[v.schluessel] as string;
      const nl = BESTAND.nl?.[v.schluessel] as string;
      expect(de).toBe(v.wort);
      expect(en).not.toBe(de);
      expect(nl).not.toBe(de);
      expect(en.length, `${v.schluessel} ist in en leer`).toBeGreaterThan(0);
      expect(nl.length, `${v.schluessel} ist in nl leer`).toBeGreaterThan(0);
    });

    // JOB 3843 · Lieferung 2 — DER KATALOG, ZEICHENGENAU, IN ALLEN DREI SPRACHEN.
    // Kein `toContain`, kein Trimmen, keine Kleinschreibung: derselbe Vergleichsmassstab wie in (b).
    it(`${v.schluessel} lautet in de, en und nl genau so und nicht anders`, () => {
      for (const lng of SPRACHEN) {
        const ist = BESTAND[lng]?.[v.schluessel];
        expect(
          ist,
          `${v.schluessel} in ${lng} — erwartet „${soll(v, lng)}“, vorgefunden „${String(ist)}“`,
        ).toBe(soll(v, lng));
      }
    });

    // JOB 3843 · Lieferung 4 — DREI SPRACHEN, KEINE VERWECHSLUNG.
    // Der Bestand prüfte `en ≠ de` und `nl ≠ de`, aber nie `en ≠ nl`. Ein in den englischen Block
    // gerutschter niederländischer Satz — der wahrscheinlichste reale Verwechslungsfehler — blieb
    // damit grün.
    it(`${v.schluessel} steht in de, en und nl paarweise verschieden`, () => {
      const PAARE = [
        ["de", "en"],
        ["de", "nl"],
        ["en", "nl"],
      ] as const;
      const gleich = PAARE.filter(
        ([a, b]) => BESTAND[a]?.[v.schluessel] === BESTAND[b]?.[v.schluessel],
      ).map(([a, b]) => `${a} und ${b} tragen beide „${String(BESTAND[a]?.[v.schluessel])}“`);
      expect(gleich, `Sprachpaare mit demselben Wortlaut für ${v.schluessel}`).toEqual([]);
    });
  }
});

describe("JOB 3843 · (e) die Erkennung liest an keiner Schreibweise vorbei", () => {
  // OHNE JEDE VERSTELLUNG AN EINER PRODUKTDATEI: `gefunden()` bekommt hier kleine Ausschnitte statt
  // des echten Dienstes. Was hier grün ist, ist die Zusage, dass ein NEU eingeführter fester Vermerk
  // oben auffliegt — schweigt die Erkennung, sieht das aus wie Entwarnung, und genau das hat der
  // Prüfer in JOB 3627 R1 als Prüflücke benannt.
  //
  // WELCHE DAVON WIRKLICH BLINDE FLECKEN WAREN, gemessen durch Rücknahme der Weitung auf die alten
  // Muster: (i)–(iv) und (v) — sie werden vom alten `\bnote: "…"` beziehungsweise vom alten
  // `this\.snapshot\([^)]*?"…"` nicht gefunden. (vi) NICHT: das alte Snapshot-Muster läuft auch über
  // Zeilenumbrüche und fand den mehrzeiligen Aufruf schon. Der Fall bleibt trotzdem stehen, aber als
  // das, was er ist — ein Rückschrittwächter für den Klammerzähler, keine geschlossene Lücke.
  const SCHREIBWEISEN = [
    { kennung: "(i) note ohne Leerzeichen", quelle: `{ version: 1, note:"erstellt" }` },
    { kennung: "(ii) note mit mehreren Leerzeichen", quelle: `{ note:   "erstellt" }` },
    { kennung: "(iii) note mit einfachen Anführungszeichen", quelle: `{ note: 'erstellt' }` },
    { kennung: "(iv) note mit umgekehrten Anführungszeichen", quelle: "{ note: `erstellt` }" },
    {
      kennung: "(v) snapshot mit Klammer im Argument",
      quelle: `this.snapshot(tx, idOf(ko), "erstellt");`,
    },
    {
      kennung: "(vi) snapshot über mehrere Zeilen",
      quelle: `await this.snapshot(\n  committed,\n  author,\n  "erstellt",\n  tx,\n);`,
    },
  ] as const;

  for (const s of SCHREIBWEISEN) {
    it(`${s.kennung} wird als fester Vermerk erkannt`, () => {
      const treffer = gefunden(s.quelle);
      expect(
        treffer,
        `Ausschnitt ${JSON.stringify(s.quelle)} — erwartet ["erstellt"], vorgefunden ${JSON.stringify(treffer)}`,
      ).toEqual(["erstellt"]);
    });
  }

  // DIE GEGENRICHTUNG, ohne die die Weitung wertlos wäre: eine Erkennung, die alles findet, findet
  // nichts. Wer die Muster weitet, bis auch ein Kommentar oder ein fremdes Feld zählt, hat den
  // Wächter nicht geschärft, sondern in einen Dauerlärm verwandelt.
  const VORBEILESER = [
    { kennung: "(A) nur im Zeilenkommentar", quelle: `// Beispiel: note: "erstellt" — nicht echt` },
    {
      kennung: "(B) nur im Blockkommentar",
      quelle: `/* frueher stand hier this.snapshot(ko, author, "erstellt"); */`,
    },
    { kennung: "(C) fremdes Feld", quelle: `{ titel: "erstellt", untertitel: "erstellt" }` },
    // (D) JOB 3843 R2, von BEN gemessen: Vermerk-SYNTAX, aber innerhalb einer gewöhnlichen
    // Zeichenkette. Ein Mensch, der `note: "erstellt"` in einen Text schreibt, legt keinen
    // Schreibweg an; wer das meldet, meldet Inhalt als Code.
    { kennung: "(D) Vermerksyntax in einer Zeichenkette", quelle: `{ titel: 'note: "erstellt"' }` },
    // (E) JOB 3843 R3, von BEN an R2 gemessen — DIE ANDERE HÄLFTE VON (D): (D) deckte nur den
    // `note:`-Zweig ab, weil der über der Maske läuft. Der Snapshot-Zweig suchte seinen
    // Aufrufanfang weiterhin im Code und fand ihn deshalb auch mitten in einem Titel. Ein Mensch,
    // der einen Aufruf ZITIERT, legt keinen Schreibweg an; wer das meldet, rötet den
    // Bestandsfall oben ohne dass jemand einen Vermerk angefasst hat.
    {
      kennung: "(E) Aufrufsyntax in einer Zeichenkette",
      quelle: `{ titel: 'this.snapshot(ko, author, "scheinvermerk")' }`,
    },
  ] as const;

  for (const s of VORBEILESER) {
    it(`${s.kennung} wird NICHT als fester Vermerk gemeldet`, () => {
      const treffer = gefunden(s.quelle);
      expect(
        treffer,
        `Ausschnitt ${JSON.stringify(s.quelle)} — erwartet [], fälschlich gefunden ${JSON.stringify(treffer)}`,
      ).toEqual([]);
    });
  }

  // DIE ZWEITE GEGENRICHTUNG (JOB 3843 R2/R3, alle drei von BEN gemessen): der Aufruf ist ECHT und
  // trägt einen Vermerk UND Nachbarn. Eine Erkennung, die jedes Literal des Aufrufs einsammelt, meldet die
  // Nachbarn mit — und damit Vermerke, die der Dienst nie schreibt. Das ist kein Schönheitsfehler:
  // der Bestandsfall oben („GENAU die fünf Vermerke") wird davon rot, ohne dass jemand einen Vermerk
  // angefasst hat, und eine Fehlmeldung, die man wegerklären muss, entwertet den ganzen Wächter.
  const NACHBARN = [
    {
      kennung: "(F) fremdes Feld in einem anderen Snapshot-Argument",
      quelle: `this.snapshot({ ...ko, titel: "erstellt" }, author, "überarbeitet");`,
      erwartet: ["überarbeitet"] as readonly string[],
    },
    {
      kennung: "(G) Literal in einem Argument NACH dem Vermerk",
      quelle: `this.snapshot(ko, author, "erstellt", txFor("mandant-a"));`,
      erwartet: ["erstellt"] as readonly string[],
    },
    // (H) JOB 3843 R3, von BEN an R2 gemessen — DER SCHWERERE VON BEIDEN: hier ist der Aufruf
    // ECHT, und in einem seiner Argumente steht ein zitierter Scheinaufruf. Wer Aufrufanfänge im
    // Code sucht, findet zwei und meldet zwei Vermerke, obwohl der Dienst einen schreibt. (E)
    // allein hätte das nicht gefangen: dort war gar kein echter Aufruf da, an dem sich das Zählen
    // der Argumente hätte verschieben können.
    {
      kennung: "(H) Scheinaufruf im Text eines Nachbararguments",
      quelle: `this.snapshot({ ...ko, titel: 'this.snapshot(ko, author, "scheinvermerk")' }, author, "erstellt");`,
      erwartet: ["erstellt"] as readonly string[],
    },
  ] as const;

  for (const s of NACHBARN) {
    it(`${s.kennung} meldet den Vermerk und sonst nichts`, () => {
      const treffer = gefunden(s.quelle);
      expect(
        treffer,
        `Ausschnitt ${JSON.stringify(s.quelle)} — erwartet ${JSON.stringify(s.erwartet)}, vorgefunden ${JSON.stringify(treffer)}`,
      ).toEqual([...s.erwartet]);
    });
  }
});

describe("JOB 3843 · (f) die benannten Grenzen der Erkennung — gemessen, nicht behauptet", () => {
  // WOZU DIESER ABSCHNITT: der Dateikopf (vi) sagt, was die Erkennung NICHT kann. Eine solche
  // Aussage ist nur so viel wert wie ihre Messung. Diese Fälle halten das heutige Verhalten fest;
  // wer die Erkennung weitet, sieht hier rot — das ist kein Verbot der Weitung, sondern die
  // Aufforderung, den Dateikopf mitzuziehen, damit er nie mehr verspricht, als gemessen ist.
  const GRENZEN = [
    {
      kennung: "ein Vermerk aus einer Variablen wird gar nicht gesehen",
      quelle: "{ note: derVermerk }",
      erwartet: [] as readonly string[],
    },
    {
      kennung: "ein Weg mit anderem Namen wird gar nicht gesehen",
      quelle: `await this.merken(ko, author, "erstellt");`,
      erwartet: [] as readonly string[],
    },
    {
      // JOB 3843 R2 · DIE KEHRSEITE DER SCHÄRFUNG, und sie wird nicht verschwiegen: steht im
      // Vermerkargument eine Variable, meldet die Erkennung nichts. Blind ist sie deshalb nicht —
      // der Fall „KEIN Schreibweg reicht einen menschlichen Vermerk durch" oben schlägt genau dann
      // an, weil dieses Argument dann weder Literal noch `snapshot.note` ist.
      kennung: "ein Vermerk aus einer Variablen wird auch im Snapshot nicht gesehen",
      quelle: "await this.snapshot(ko, author, derVermerk);",
      erwartet: [] as readonly string[],
    },
    {
      kennung: "ein zusammengesetzter Vermerk meldet nur sein Literalstück",
      quelle: `{ note: "erstellt " + zusatz }`,
      erwartet: ["erstellt "] as readonly string[],
    },
    {
      kennung: "ein eingesetzter Wert meldet den Rohtext samt Platzhalter",
      quelle: "{ note: `erstellt (${grund})` }",
      erwartet: ["erstellt (${grund})"] as readonly string[],
    },
  ] as const;

  for (const g of GRENZEN) {
    it(g.kennung, () => {
      const treffer = gefunden(g.quelle);
      expect(
        treffer,
        `Ausschnitt ${JSON.stringify(g.quelle)} — festgehalten ${JSON.stringify(g.erwartet)}, vorgefunden ${JSON.stringify(treffer)}`,
      ).toEqual([...g.erwartet]);
    });
  }
});
