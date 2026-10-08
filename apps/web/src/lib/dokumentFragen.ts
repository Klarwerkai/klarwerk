// ================================================================================================
// R-0347 · FRAGEN AN EIN HOCHGELADENES DOKUMENT — DER DOM-FREIE KERN.
// ================================================================================================
//
// DER ZIELZUSTAND (R-0347, Originalwortlaut): „Man lädt ein Dokument hoch und stellt Fragen dazu;
// die Antwort verknüpft die Inhalte und verweist auf die Fundstelle im Dokument."
//
// WIE DIESE DATEI ES ERFÜLLT, in drei Schritten:
//   1. `gliedere` zerlegt das gelesene Dokument in nummerierte FUNDSTELLEN — Seite (PDF), Abschnitt
//      (nächste Überschrift) und Absatznummer. Die Fundstelle ist das, worauf eine Antwort zeigt.
//   2. `beantworte` sucht zu einer Frage die tragenden Stellen und VERKNÜPFT sie: mehrere Stellen,
//      die zusammen die Begriffe der Frage abdecken, in Dokumentreihenfolge, jede mit ihrer Marke.
//   3. Was keine Stelle trägt, wird ausdrücklich als nicht gefunden genannt.
//
// DIE EHRLICHKEITSREGELN aus dem Beraterkonzept EF-6 (`docs/team2-austausch/berater-konzept-
// erfassung-vordertuer.md:93-98`) sind hier BAUART, nicht Hinweistext:
//   · Belegstellen statt Behauptung — jede Aussage der Antwort ist ein WÖRTLICHER Satz aus genau der
//     Fundstelle, auf die ihre Marke zeigt. Es gibt keinen Text, den dieser Kern selbst formuliert.
//   · Ehrliche Lücke — trägt keine Stelle die Frage, ist die Antwort leer (`beantwortet: false`).
//     Kein Auffüllen aus Weltwissen; ein Modell wird nicht gerufen.
//   · Grenze zum Bestand — das Dokument ist Arbeitsmaterial. Der Kern speichert nichts und kennt
//     weder Server noch Wissensobjekte.
//
// WARUM KEIN MODELL: der Dokumenttext ist eine eigene Nutzlastklasse mit eigenem Riegel (F-0295 /
// R-0639, `services/reasoner/src/klara-policy.ts:326`). Ein hochgeladenes Dokument an ein Modell zu
// geben, wäre eine Datenschutzentscheidung, die dieser Auftrag nicht trifft. Hier verlässt der Text
// den Browser nicht.

/** Ein Baustein des gelesenen Dokuments, bevor er nummeriert ist. */
export interface DokumentBaustein {
  readonly art: "ueberschrift" | "absatz";
  readonly text: string;
  /** Seitenzahl (1-basiert), wo die Quelle Seiten kennt (PDF). Sonst fehlt sie. */
  readonly seite?: number;
}

/** Eine nummerierte Fundstelle — das Ziel jeder Marke in einer Antwort. */
export interface Fundstelle {
  /** Laufende Nummer im ganzen Dokument, 1-basiert. Sie ist die Kennung der Stelle. */
  readonly nummer: number;
  readonly seite: number | null;
  /** Die nächstliegende Überschrift davor — `null`, wenn keine vorausgeht. */
  readonly abschnitt: string | null;
  /** Absatznummer innerhalb der Seite (PDF) bzw. des Abschnitts (sonst), 1-basiert. */
  readonly absatz: number;
  readonly text: string;
}

/** Größte Zahl Stellen, die eine Antwort verknüpft — mehr ist keine Antwort, sondern eine Liste. */
const MAX_ANTWORT_STELLEN = 4;
/** Höchstens so viele Sätze je Stelle werden als Aussage zitiert. */
const MAX_SAETZE_JE_STELLE = 2;
/** Ab dieser Länge wird ein Zitat gekürzt; die volle Stelle bleibt an der Fundstelle. */
const MAX_ZITAT_ZEICHEN = 420;

// ------------------------------------------------------------------------------------------------
// 1 · GLIEDERN
// ------------------------------------------------------------------------------------------------

function glaetten(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Klartext (txt/md/csv …) in Bausteine: Leerzeilen trennen Absätze, `#`-Zeilen sind Überschriften.
 * Eine Markdown-Überschrift direkt über einem Absatz (ohne Leerzeile) bleibt eine Überschrift.
 * Listenpunkte und Tabellenzeilen sind je eine eigene Stelle, wie im Word-Weg.
 */
export function bausteineAusText(text: string, seite?: number): DokumentBaustein[] {
  const raus: DokumentBaustein[] = [];
  let absatz: string[] = [];
  const baustein = (art: DokumentBaustein["art"], inhalt: string): DokumentBaustein =>
    seite === undefined ? { art, text: inhalt } : { art, text: inhalt, seite };
  const absatzAbschliessen = (): void => {
    const inhalt = glaetten(absatz.join(" "));
    if (inhalt.length > 0) {
      raus.push(baustein("absatz", inhalt));
    }
    absatz = [];
  };
  for (const zeile of text.replace(/\r\n?/g, "\n").split("\n")) {
    const kopf = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(zeile);
    if (kopf?.[1] !== undefined) {
      absatzAbschliessen();
      raus.push(baustein("ueberschrift", glaetten(kopf[1])));
      continue;
    }
    if (zeile.trim().length === 0) {
      absatzAbschliessen();
      continue;
    }
    if (/^\s*\|/.test(zeile)) {
      absatzAbschliessen();
      // Die Trennzeile unter dem Tabellenkopf (`| --- | :-: |`) trägt keinen Inhalt.
      if (!/^[\s|:-]+$/.test(zeile)) {
        const zellen = zeile
          .trim()
          .replace(/^\||\|$/g, "")
          .split(/(?<!\\)\|/)
          .map((zelle) => glaetten(zelle.replace(/\\\|/g, "|")));
        raus.push(baustein("absatz", zellen.join(" | ")));
      }
      continue;
    }
    const punkt = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(zeile);
    if (punkt?.[1] !== undefined) {
      absatzAbschliessen();
      absatz.push(punkt[1]);
      continue;
    }
    absatz.push(zeile);
  }
  absatzAbschliessen();
  return raus;
}

function zeichen(code: number): string {
  return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
}

function entitaeten(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => zeichen(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dez: string) => zeichen(Number.parseInt(dez, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const HTML_BLOCK = new Set([
  "p",
  "li",
  "ul",
  "ol",
  "table",
  "blockquote",
  "div",
  "figure",
  "figcaption",
  "section",
]);

/**
 * Das HTML des Word-Lesers (`extractDocxRich`, mammoth) in Bausteine: `h1`–`h6` sind Überschriften,
 * jeder Absatz und jeder Listenpunkt ein Absatz, und eine TABELLENZEILE ein Absatz mit ihren Zellen
 * („Prüfschritt | Ergebnis") — eine Zelle allein wäre als Fundstelle ohne ihre Zeile nicht lesbar.
 * Bewusst ohne DOM: der Kern läuft im Browser und im Node-Test gleich.
 */
export function bausteineAusHtml(html: string): DokumentBaustein[] {
  const raus: DokumentBaustein[] = [];
  let puffer = "";
  let kopf = false;
  let zeile = 0;
  const abschliessen = (): void => {
    const inhalt = glaetten(entitaeten(puffer));
    if (inhalt.length > 0) {
      raus.push({ art: kopf ? "ueberschrift" : "absatz", text: inhalt });
    }
    puffer = "";
  };
  for (const teil of html.split(/(<[^>]*>)/)) {
    const tag = /^<\s*(\/?)\s*([a-z][a-z0-9]*)/i.exec(teil);
    if (!tag) {
      puffer += teil;
      continue;
    }
    const schliessend = tag[1] === "/";
    const name = (tag[2] ?? "").toLowerCase();
    if (name === "tr") {
      abschliessen();
      zeile = schliessend ? Math.max(0, zeile - 1) : zeile + 1;
    } else if (name === "td" || name === "th") {
      if (!schliessend && puffer.trim().length > 0) {
        puffer += " | ";
      }
    } else if (zeile > 0) {
      puffer += " ";
    } else if (/^h[1-6]$/.test(name)) {
      abschliessen();
      kopf = !schliessend;
    } else if (HTML_BLOCK.has(name)) {
      abschliessen();
    } else if (name === "br") {
      puffer += " ";
    }
  }
  abschliessen();
  return raus;
}

/** PDF-Seiten (je Seite der rekonstruierte Klartext) in Bausteine mit Seitenzahl. */
export function bausteineAusSeiten(seiten: readonly string[]): DokumentBaustein[] {
  return seiten.flatMap((seite, i) => bausteineAusText(seite, i + 1));
}

/**
 * Nummeriert die Bausteine zu Fundstellen. Überschriften werden keine eigene Fundstelle, sondern der
 * Abschnitt der folgenden Absätze. Die Absatzzählung beginnt je Seite neu, wo es Seiten gibt, sonst
 * je Abschnitt — so lässt sich „Seite 2, Absatz 3" im Original wirklich abzählen.
 */
export function gliedere(bausteine: readonly DokumentBaustein[]): Fundstelle[] {
  const raus: Fundstelle[] = [];
  let abschnitt: string | null = null;
  let seite: number | null = null;
  let absatz = 0;
  for (const b of bausteine) {
    const bSeite = b.seite ?? null;
    if (bSeite !== seite) {
      seite = bSeite;
      absatz = 0;
    }
    if (b.art === "ueberschrift") {
      abschnitt = b.text;
      if (seite === null) {
        absatz = 0;
      }
      continue;
    }
    absatz += 1;
    raus.push({ nummer: raus.length + 1, seite, abschnitt, absatz, text: b.text });
  }
  return raus;
}

// ------------------------------------------------------------------------------------------------
// 2 · BEGRIFFE
// ------------------------------------------------------------------------------------------------

// Füllwörter in den drei Oberflächensprachen. Sie tragen keine Frage; zählten sie mit, wäre jede
// Stelle mit „der" und „ist" ein Treffer.
const FUELL_DE =
  "aber auch auf aus bei bin bis bitte dann darin das dass dazu dem den der des die dies diese dieser dieses doch dort durch ein eine einem einen einer eines fuer gibt hat hatte haben ich ihr ist jede jeder kann koennen man mit muss nach nicht noch nur oder ohne sagt sich sie sind soll sollte steht thema tun ueber und uns von vor wann war warum was welche welcher welches wenn wer werden wie wird wir wo wozu zu zum zur";
const FUELL_EN =
  "about and are can could does for from has have how into is its not of on or should that the their them then there these this those was what when where which who why will with would you your";
const FUELL_NL =
  "aan als bij dan dat de deze die dit een en hebben het hoe in is kan met moet niet of om op te van voor waar wanneer wat welke wie zijn";
const FUELLWOERTER = new Set(`${FUELL_DE} ${FUELL_EN} ${FUELL_NL}`.split(" "));

/** Kleinbuchstaben, Umlaute als Umschrift — „Prüfung" und „Pruefung" sind dasselbe Wort. */
function normalisiere(wort: string): string {
  return wort
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
}

function woerter(text: string): string[] {
  return normalisiere(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0);
}

/**
 * Ein Wortstamm, grob: gängige Endungen ab. Gewollt grob — „Wartung", „Wartungen" und das
 * „wartungs-" eines Kompositums sollen sich finden, ohne eine Sprachbibliothek mitzubringen.
 */
function stamm(wort: string): string {
  if (/^\d+$/.test(wort) || wort.length <= 4) {
    return wort;
  }
  for (const endung of ["ungen", "ungs", "ung", "en", "er", "es", "e", "n", "s"]) {
    if (wort.endsWith(endung) && wort.length - endung.length >= 4) {
      return wort.slice(0, -endung.length);
    }
  }
  return wort;
}

/** Ein tragender Begriff der Frage: normalisiertes Wort, sein Stamm und die Schreibung der Frage. */
interface FrageBegriff {
  readonly wort: string;
  readonly stamm: string;
  readonly anzeige: string;
}

/** Die tragenden Begriffe einer Frage — ohne Füllwörter, ohne Doppelungen (gleicher Stamm). */
function frageBegriffe(frage: string): FrageBegriff[] {
  const raus: FrageBegriff[] = [];
  for (const roh of frage.split(/[^\p{L}\p{N}]+/u)) {
    for (const w of woerter(roh)) {
      if (FUELLWOERTER.has(w) || (w.length < 3 && !/^\d+$/.test(w))) {
        continue;
      }
      const s = stamm(w);
      if (!raus.some((b) => b.stamm === s)) {
        raus.push({ wort: w, stamm: s, anzeige: roh });
      }
    }
  }
  return raus;
}

/**
 * Trägt der Text den Begriff? Gleicher Stamm genügt immer. Ab fünf Zeichen auch als Wortteil — so
 * findet „Schalter" den „Hauptschalter" und „Wartung" das „Wartungsintervall". Kürzere Begriffe nur
 * als ganzer Stamm, sonst träfe „Tor" jede „Faktoren".
 */
function traegt(textWoerter: readonly string[], begriff: FrageBegriff): boolean {
  return textWoerter.some(
    (w) =>
      stamm(w) === begriff.stamm ||
      (begriff.wort.length >= 5 && w.includes(begriff.wort)) ||
      (begriff.stamm.length >= 5 && w.includes(begriff.stamm)),
  );
}

// ------------------------------------------------------------------------------------------------
// 3 · ANTWORTEN
// ------------------------------------------------------------------------------------------------

/** Eine Aussage der Antwort: ein wörtlicher Auszug aus genau einer Fundstelle. */
export interface AntwortAussage {
  readonly fundstelle: Fundstelle;
  /** Wörtlicher Auszug — die Sätze der Stelle, die Begriffe der Frage tragen. */
  readonly zitat: string;
  /** Ob das Zitat gekürzt wurde (die volle Stelle steht an der Fundstelle). */
  readonly gekuerzt: boolean;
  /** Die Begriffe der Frage, die DIESE Stelle trägt — in der Schreibung der Frage. */
  readonly begriffe: readonly string[];
}

export interface DokumentAntwort {
  readonly beantwortet: boolean;
  /** Warum unbeantwortet: die Frage hat keine tragenden Begriffe, oder keine Stelle trägt sie. */
  readonly grund: "frage-ohne-begriffe" | "nichts-gefunden" | null;
  /** Die verknüpften Aussagen, in Dokumentreihenfolge. */
  readonly aussagen: readonly AntwortAussage[];
  /** Begriffe der Frage, die KEINE Stelle des Dokuments trägt — in der Schreibung der Frage. */
  readonly nichtGefunden: readonly string[];
}

interface Kandidat {
  readonly stelle: Fundstelle;
  readonly begriffe: ReadonlySet<FrageBegriff>;
  readonly punkte: number;
}

function saetze(text: string): string[] {
  const teile = text.match(/[^.!?;]+(?:[.!?;]+|$)/g) ?? [text];
  return teile.map((s) => s.trim()).filter((s) => s.length > 0);
}

// Satzanfänge, die auf den VORIGEN Satz verweisen („Danach …", „Dies …"). Ein solcher Satz sagt
// allein nichts — „Danach wird das Protokoll unterschrieben" verschweigt, wonach.
const BEZUG_DE =
  "anschliessend ausserdem dabei daher damit danach dann darauf dadurch davor deshalb dies diese dieser dieses dort ebenso er es hierbei hierzu sie somit zudem";
const BEZUG_EN = "afterwards also it then therefore these they this those";
const BEZUG_NL = "daarna dan daarom dit deze hierbij";
const BEZUGSWOERTER = new Set(`${BEZUG_DE} ${BEZUG_EN} ${BEZUG_NL}`.split(" "));

function brauchtVorsatz(satz: string): boolean {
  const erstes = woerter(satz)[0];
  return erstes !== undefined && BEZUGSWOERTER.has(erstes);
}

/**
 * Das Zitat einer Stelle — wörtlich und so, dass es für sich verständlich bleibt.
 *
 * BEN, Nacharbeit 2: Auf „Wann wird das Protokoll unterschrieben?" stand allein „Danach wird das
 * Protokoll unterschrieben." — der Satz mit den 500 Betriebsstunden, auf den „Danach" zeigt, fehlte.
 * Deshalb zwei Regeln:
 *   1. Ein kurzer Absatz (bis `MAX_ZITAT_ZEICHEN`) wird VOLLSTÄNDIG zitiert. Er ist die kleinste
 *      Einheit, in der der Zusammenhang sicher steht.
 *   2. Ist der Absatz länger, werden die tragenden Sätze gewählt, und jeder, der mit einem
 *      Bezugswort beginnt, nimmt seinen Vorgängersatz mit.
 */
function zitatAus(
  stelle: Fundstelle,
  begriffe: readonly FrageBegriff[],
): { zitat: string; gekuerzt: boolean } {
  if (stelle.text.length <= MAX_ZITAT_ZEICHEN) {
    return { zitat: stelle.text, gekuerzt: false };
  }
  const alle = saetze(stelle.text);
  const gewertet = alle.map((satz, i) => ({
    i,
    satz,
    treffer: begriffe.filter((b) => traegt(woerter(satz), b)).length,
  }));
  const tragend = gewertet
    .filter((s) => s.treffer > 0)
    .sort((a, b) => b.treffer - a.treffer || a.i - b.i)
    .slice(0, MAX_SAETZE_JE_STELLE);
  const nummern = new Set(tragend.map((s) => s.i));
  for (const s of tragend) {
    if (s.i > 0 && brauchtVorsatz(s.satz)) {
      nummern.add(s.i - 1);
    }
  }
  const gewaehlt = gewertet.filter((s) => nummern.has(s.i));
  const quelle = gewaehlt.length > 0 ? gewaehlt : gewertet.slice(0, 1);
  // Benachbarte Sätze stehen wie im Original nebeneinander; „…" markiert nur echte Auslassungen.
  let zitat = quelle
    .map((s, n) => (n > 0 && quelle[n - 1]?.i !== s.i - 1 ? ` … ${s.satz}` : ` ${s.satz}`))
    .join("")
    .trim();
  let gekuerzt = quelle.length < alle.length;
  if (zitat.length > MAX_ZITAT_ZEICHEN) {
    zitat = `${zitat.slice(0, MAX_ZITAT_ZEICHEN).replace(/\s+\S*$/, "")} …`;
    gekuerzt = true;
  }
  return { zitat, gekuerzt };
}

/**
 * Beantwortet eine Frage aus den Fundstellen eines Dokuments.
 *
 * GEWICHTUNG: ein Begriff, der in wenigen Stellen steht, sagt mehr als einer, der überall steht
 * (inverse Stellenhäufigkeit). AUSWAHL in zwei Zügen — erst die stärkste Stelle, dann jede weitere,
 * die einen noch NICHT abgedeckten Begriff beiträgt oder fast so stark trägt wie die erste. Der
 * erste Zug macht die Antwort belastbar, der zweite VERKNÜPFT: eine Frage nach „Wartung und
 * Prüfintervall" bekommt die Stelle zur Wartung UND die zum Intervall, auch wenn beide weit
 * auseinander stehen.
 *
 * TRAGFÄHIGKEIT: beantwortet ist eine Frage erst, wenn die gewählten Stellen mindestens die Hälfte
 * ihrer Begriffe tragen. Trifft von „Ventil Kaffeemaschine Lieferant" nur „Ventil", wäre eine
 * Antwort eine Behauptung über etwas anderes — dann ist es eine Lücke, mit den fehlenden Begriffen.
 */
export function beantworte(frage: string, stellen: readonly Fundstelle[]): DokumentAntwort {
  const begriffe = frageBegriffe(frage);
  if (begriffe.length === 0) {
    return { beantwortet: false, grund: "frage-ohne-begriffe", aussagen: [], nichtGefunden: [] };
  }

  const textWoerter = stellen.map((s) => woerter(s.text));
  const haeufigkeit = new Map<FrageBegriff, number>();
  for (const b of begriffe) {
    haeufigkeit.set(b, textWoerter.filter((w) => traegt(w, b)).length);
  }
  const gewicht = (b: FrageBegriff): number =>
    Math.log(1 + stellen.length / Math.max(1, haeufigkeit.get(b) ?? 0));

  const kandidaten: Kandidat[] = [];
  stellen.forEach((stelle, i) => {
    // Ein Begriff zählt im Text voll, in der Überschrift des Abschnitts halb: die Überschrift ordnet
    // ein, belegt aber nichts — zitiert wird nur der Text der Stelle.
    const imText = begriffe.filter((b) => traegt(textWoerter[i] ?? [], b));
    if (imText.length === 0) {
      return;
    }
    const imKopf = begriffe.filter(
      (b) => !imText.includes(b) && traegt(woerter(stelle.abschnitt ?? ""), b),
    );
    const punkte =
      imText.reduce((summe, b) => summe + gewicht(b), 0) +
      imKopf.reduce((summe, b) => summe + gewicht(b) / 2, 0);
    kandidaten.push({ stelle, begriffe: new Set(imText), punkte });
  });

  const nichtGefunden = begriffe
    .filter((b) => (haeufigkeit.get(b) ?? 0) === 0)
    .map((b) => b.anzeige);
  const luecke: DokumentAntwort = {
    beantwortet: false,
    grund: "nichts-gefunden",
    aussagen: [],
    nichtGefunden,
  };

  kandidaten.sort((a, b) => b.punkte - a.punkte || a.stelle.nummer - b.stelle.nummer);
  const [erste, ...rest] = kandidaten;
  if (erste === undefined) {
    return luecke;
  }
  const gewaehlt: Kandidat[] = [erste];
  const abgedeckt = new Set(erste.begriffe);
  for (const k of rest) {
    if (gewaehlt.length >= MAX_ANTWORT_STELLEN) {
      break;
    }
    const neu = [...k.begriffe].some((b) => !abgedeckt.has(b));
    if (neu || k.punkte >= erste.punkte * 0.8) {
      gewaehlt.push(k);
      for (const b of k.begriffe) {
        abgedeckt.add(b);
      }
    }
  }

  if (abgedeckt.size * 2 < begriffe.length) {
    return luecke;
  }

  const aussagen = gewaehlt
    .sort((a, b) => a.stelle.nummer - b.stelle.nummer)
    .map((k): AntwortAussage => {
      const eigene = begriffe.filter((b) => k.begriffe.has(b));
      return {
        fundstelle: k.stelle,
        ...zitatAus(k.stelle, eigene),
        begriffe: eigene.map((b) => b.anzeige),
      };
    });
  return { beantwortet: true, grund: null, aussagen, nichtGefunden };
}
