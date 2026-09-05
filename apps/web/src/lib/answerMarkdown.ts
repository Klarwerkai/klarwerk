// WP-UX-WOW-1 U1 (Kopfs Live-Befund, P1): Modell-Antworten kommen als Markdown („## Antwort",
// „**fett**", Listen) — die Konsole zeigte die Zeichen roh. Dieser kleine, DOM-freie Parser zerlegt
// die Antwort in ein STRIKTES Subset von Segmenten (Überschrift h3/h4, Absatz, Liste; inline fett/
// kursiv). ALLES andere bleibt reiner Text: gerendert wird ausschließlich über React-Elemente
// (AnswerMarkdown.tsx) — kein dangerouslySetInnerHTML, kein neuer HTML-Sink; Script/HTML im
// Antworttext bleibt automatisch escaped, weil es nie als HTML interpretiert wird.
// Kopieren/Export bleiben unberührt — sie nutzen weiter den ROHEN Antworttext.

export interface AnswerInlinePart {
  kind: "text" | "bold" | "italic";
  text: string;
}

export type AnswerSegment =
  | { kind: "heading"; level: 3 | 4; parts: AnswerInlinePart[] }
  | { kind: "paragraph"; parts: AnswerInlinePart[] }
  | { kind: "list"; ordered: boolean; items: AnswerInlinePart[][] };

// Inline-Subset: **fett** und *kursiv* (nicht verschachtelt — konservativ; ein unpaariger Marker
// bleibt wörtlicher Text). Mehr Markdown (Links, Code, Bilder) wird BEWUSST nicht interpretiert.
const INLINE_RE = /\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;

export function parseAnswerInline(text: string): AnswerInlinePart[] {
  const parts: AnswerInlinePart[] = [];
  let last = 0;
  let m: RegExpExecArray | null = INLINE_RE.exec(text);
  while (m !== null) {
    if (m.index > last) {
      parts.push({ kind: "text", text: text.slice(last, m.index) });
    }
    if (m[1] !== undefined) {
      parts.push({ kind: "bold", text: m[1] });
    } else if (m[2] !== undefined) {
      parts.push({ kind: "italic", text: m[2] });
    }
    last = INLINE_RE.lastIndex;
    m = INLINE_RE.exec(text);
  }
  if (last < text.length) {
    parts.push({ kind: "text", text: text.slice(last) });
  }
  return parts;
}

// ================================================================================================
// DIE FUSSNOTENMARKE — DIESELBE GRAMMATIK WIE DER REASONER SIE ZURÜCKLIEST.
// ================================================================================================
//
// KORREKTURPFLICHT 1 (Ben, Runde 6). Die Fläche erkannte bis dahin nur `[n]` mit ein bis zwei
// Ziffern. Der Reasoner liest aber MEHR zurück, und zwar ausdrücklich
// (`services/reasoner/src/provider-model.ts`, `citedSourceIds`, Regel dort:
// `/\[([0-9\s,]+)\]/g` je Gruppe, danach je Komma-Teil eine Zahl):
//
//     [1]        eine Quelle
//     [1][3]     zwei Gruppen, zwei Quellen
//     [1, 2]     EINE Gruppe, ZWEI Quellen
//
// Eine Antwort mit `[1, 2]` band im Reasoner also zwei Quellen, und der Mensch las trotzdem die
// rohe Klammer im Fliesstext. Genau diese Vertragslücke schliesst diese Funktion: sie verwendet
// DIESELBE Gruppen-Regel und DIESELBE Bereichsprüfung. Der Beleg dafür, dass beide Seiten
// übereinstimmen, ist kein Kommentar, sondern eine Messung:
// `tests/ask/job3064-fussnoten-vertrag.test.tsx` schickt dieselben Beispiele durch
// `citedSourceIds` UND durch diese Funktion und vergleicht die Zahlen.
//
// WARUM DIE ZAHL DER QUELLEN HEREINGEREICHT WIRD: der Reasoner verwirft eine Nummer ausserhalb der
// Kandidatenliste („[9]" bei drei Quellen), statt sie auf einen gültigen Wert zu biegen. Die Fläche
// muss dasselbe tun — eine hochgestellte 9 ohne neunte Quelle wäre eine erfundene Bindung, und
// `tests/design/zielbild-h5-fragen.test.ts` V18 misst genau das („keine Marke ohne Chip").
//
// GEMISCHTE GRUPPEN — KORREKTURPFLICHT 1 (Ben, Runde 7).
//
// Runde 6/7 setzte eine Gruppe nur GANZ oder GAR NICHT um: stand in `[1, 9]` bei drei Quellen eine
// ungültige Zahl, blieb die ganze Gruppe roher Text. Der Reasoner entscheidet aber JE KOMMA-TEIL
// (`for (const part of match[1].split(","))`) und bindet dort sehr wohl Quelle 1. Damit band der
// Server eine Quelle, die der Mensch nicht ausgezeichnet sah — dieselbe Vertragslücke wie zuvor,
// nur eine Ebene tiefer. Bens Messung: `[1, 9]` → Reasoner bindet 1, Fläche erzeugt 0 Marken.
//
// DIE REGEL IST JETZT DIESELBE WIE DORT — je Teil entschieden, mit zwei Ausprägungen im Satzbild:
//  · SAUBERE GRUPPE (jeder Teil ist eine gültige Zahl; leere Teile wie in `[1,]`/`[1,,2]` tragen
//    keinen Inhalt und zählen nicht dagegen): die Klammer verschwindet, es bleiben die Marken —
//    `[1, 2]` wird ¹².
//  · GEMISCHTE GRUPPE (mindestens ein Teil ist eine Zahl ausserhalb der Quellenliste oder trägt
//    weiteren Inhalt): jede gültige Zahl wird AN IHRER STELLE zur Marke, ALLES übrige bleibt
//    wörtlich stehen — Klammern, Kommas und der ungültige Teil. `[1, 9]` wird also `[¹, 9]`.
// So gilt beides zugleich: keine vom Reasoner gebundene Quelle bleibt unmarkiert, und kein Zeichen
// des Antworttexts verschwindet still. Erfunden wird nie etwas — eine ungültige Zahl kann auf
// diesem Weg keine Marke werden (`tests/design/zielbild-h5-fragen.test.ts` V18: keine Marke ohne
// Chip), sie bleibt sichtbar, wie das Modell sie geschrieben hat.
const FUSSNOTEN_GRUPPE = /\[([0-9\s,]+)\]/g;

/** Ein Stück Inline-Text nach dem Herauslösen der Fussnotenmarken. */
export type FussnotenStueck = { art: "text"; text: string } | { art: "marke"; ziffer: number };

/**
 * Ein Komma-Teil einer Gruppe, so gelesen wie der Reasoner ihn liest.
 *
 * `von`/`bis` sind die absoluten Stellen der ZIFFERN im Ausgangstext — nur sie werden zur Marke,
 * damit in einer gemischten Gruppe der Rest wörtlich stehen bleiben kann.
 */
type GruppenTeil =
  | { art: "marke"; ziffer: number; von: number; bis: number; rein: boolean }
  | { art: "leer" }
  | { art: "fremd" };

function zerlegeGruppe(
  inhalt: string,
  beginn: number,
  gueltig: (n: number) => boolean,
): GruppenTeil[] {
  const teile: GruppenTeil[] = [];
  let stelle = beginn;
  for (const roh of inhalt.split(",")) {
    const start = stelle;
    stelle += roh.length + 1; // +1 für das Komma, das `split` entfernt hat
    const getrimmt = roh.trim();
    if (getrimmt.length === 0) {
      teile.push({ art: "leer" });
      continue;
    }
    // Dieselbe Lesart wie `Number.parseInt(teil.trim(), 10)` im Reasoner: die führende Ziffernfolge
    // zählt, ein Rest dahinter (`[1 2]`) macht den Teil nicht ungültig, aber auch nicht „rein".
    const treffer = /^\d+/.exec(getrimmt);
    const n = treffer === null ? Number.NaN : Number.parseInt(treffer[0], 10);
    if (!Number.isInteger(n) || !gueltig(n)) {
      teile.push({ art: "fremd" });
      continue;
    }
    const von = start + roh.indexOf(getrimmt);
    teile.push({
      art: "marke",
      ziffer: n,
      von,
      bis: von + (treffer as RegExpExecArray)[0].length,
      rein: getrimmt.length === (treffer as RegExpExecArray)[0].length,
    });
  }
  return teile;
}

// ================================================================================================
// ÜBER BLOCKGRENZEN HINWEG — KORREKTURPFLICHT 1 (Ben, Runde 8).
// ================================================================================================
//
// Das `\s` der Reasoner-Regel umfasst AUCH Tabulator und Zeilenumbruch. `[1,\n2]` ist für
// `citedSourceIds` also EINE Gruppe mit zwei Quellen — und über eine Leerzeile, eine Überschrift
// oder einen Listenpunkt hinweg gilt das genauso. Die Fläche zerlegte den Text bis Runde 8 aber
// ZUERST in Markdown-Blöcke (Absatz, Überschrift, Liste) und suchte die Gruppe erst INNERHALB eines
// Inline-Teils. Damit zerriss die Blockgrenze die Gruppe, bevor jemand sie lesen konnte: Bens
// Messung an `Das gilt [1,\n\n2].`, `## Hinweis [1,\n2].` und `- Hinweis [1,\n2].` — der Reasoner
// bindet 1 und 2, das DOM zeigte NULL Marken. Zwei gebundene Quellen ohne Beleg im Satz.
//
// DIE REIHENFOLGE IST JETZT UMGEDREHT: erst die Marken binden, dann die Blöcke bilden.
// `markiereFussnoten` läuft über den ROHEN Antworttext — denselben Text, den der Reasoner liest,
// mit denselben Gruppen — und ersetzt jede Marke durch einen PLATZHALTER, der ein einzelnes,
// im Text garantiert nicht vorkommendes Zeichen als Klammer trägt: `<z>1<z>`. Erst danach läuft
// `parseAnswerMarkdown`. Ein Platzhalter ist damit unteilbar: er enthält keinen Zeilenumbruch, kein
// `#`, kein `-`, kein `*` — keine Blockgrenze kann mehr zwischen Marke und Text geraten.
// `splitMarken` löst ihn am Ende dort auf, wo aus dem Inline-Teil React-Knoten werden.
//
// WAS DIE UMSTELLUNG AM SATZBILD ÄNDERT: bei einer sauberen Gruppe verschwindet der Zeilenumbruch
// INNERHALB der Klammer mit der Klammer — er gehörte zur Quellenangabe, nicht zum Satz. Bei einer
// gemischten Gruppe bleibt er stehen und wird von der Absatzbildung behandelt wie jeder andere
// Zeilenumbruch im Fliesstext (Zeilen eines Absatzes werden mit einem Leerzeichen verbunden).

/**
 * Ein Zeichen, das in `text` nicht vorkommt — die Klammer um eine Marke.
 *
 * Genommen werden Steuerzeichen, die in einer Modellantwort nichts zu suchen haben; `\n`, `\r` und
 * `\t` sind ausdrücklich NICHT dabei, weil sie den Blockparser steuern. Kommen wider Erwarten alle
 * Kandidaten im Text vor, gibt die Funktion `""` zurück: dann bleibt der Text unmarkiert, statt dass
 * eine Marke ein echtes Zeichen der Antwort überschreibt (kein stiller Textverlust).
 */
function freiesZeichen(text: string): string {
  for (const code of [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21]) {
    const zeichen = String.fromCharCode(code);
    if (!text.includes(zeichen)) {
      return zeichen;
    }
  }
  return "";
}

// ================================================================================================
// DER DECKUNGSRÜCKFALL — KORREKTURPFLICHT 1 (Ben, Runde 9).
// ================================================================================================
//
// Bis Runde 9 stand die Marke ausschliesslich dort, wo das MODELL sie geschrieben hatte. Das reicht
// nur für den Normalfall. `ModelProvider.answer` kennt einen zweiten Ausgang
// (`services/reasoner/src/provider-model.ts`, „EINE MARKE IST KEIN BELEG"): hält die markierte
// Aussage der Zitatprüfung nicht stand, geht NICHT der Modelltext hinaus, sondern der WORTLAUT der
// tragenden Quelle — `answered:true`, `citedSources:[jene Quelle]`, aber ein Antworttext, in dem
// keine einzige `[n]`-Klammer mehr steht. Bens Messung: „answered=true, citedSources=['ventil'],
// aber DOM enthält 0 statt 1 `<sup data-fussnote>`". Der Server band eine Quelle, und der Mensch
// sah nicht, welche — genau die Vertragslücke der Runden 6 bis 8, nur über den anderen Ausgang.
//
// DER VERTRAG HEISST DESHALB AB HIER NICHT MEHR „was im Text steht", SONDERN:
// bei `answered:true` ist die Menge der sichtbaren Fussnotennummern GLEICH der Menge der tragenden
// `citedSources` (als Stellen in `result.sources`). Das hat zwei Seiten, und beide sind nötig:
//  · Eine tragende Quelle, deren Nummer im Text nicht vorkommt, bekommt ihre Marke am ENDE des
//    Antworttexts — die ganze Antwort ist ihr Wortlaut, also trägt sie die ganze Antwort.
//  · Eine Zahl, die der Server NICHT gebunden hat, wird auch keine Marke, selbst wenn sie als
//    `[n]` im Text steht. Im Rückfall ist der Antworttext der Quellwortlaut; eine Klammer darin ist
//    Text der Quelle, keine Zitierung. Sie bleibt wörtlich stehen (wie jede fremde Zahl).
// `tragend` ist der Weg, auf dem diese Menge hereinkommt. Fehlt sie (die Zuordnung ist unbekannt,
// `citationState` „unbekannt"), gilt unverändert die alte Regel: Bereich 1..quellen, nichts
// angehängt — dann gibt es keine Zusage des Servers, gegen die man messen könnte.
// Gemessen: `tests/ask/job3064-deckungsrueckfall-fussnote.test.tsx` fährt den ECHTEN
// `ModelProvider` bis ins DOM.

/**
 * Bindet die Fussnotenmarken im ROHEN Antworttext — vor jeder Blockzerlegung.
 *
 * Ergebnis ist derselbe Text, in dem jede Marke als `<zeichen>ziffer<zeichen>` steht. `zeichen` ist
 * das dafür gewählte Zeichen; `splitMarken` braucht es, um die Marken wieder herauszulösen.
 *
 * `tragend` sind die Stellen der tragenden Quellen (1-basiert, wie die Chips). Ist sie angegeben,
 * ist sie MASSGEBLICH: nur diese Nummern werden zu Marken, und jede von ihnen, die im Text nicht
 * vorkommt, wird ans Ende angehängt (Deckungsrückfall, s. Block darüber).
 */
export function markiereFussnoten(
  text: string,
  quellen: number,
  tragend?: readonly number[],
): { text: string; zeichen: string } {
  const zeichen = freiesZeichen(text);
  if (zeichen === "") {
    return { text, zeichen };
  }
  const gueltig = (n: number): boolean =>
    n >= 1 && n <= quellen && (tragend === undefined || tragend.includes(n));
  const marke = (ziffer: number): string => `${zeichen}${ziffer}${zeichen}`;
  const gesetzt = new Set<number>();
  let raus = "";
  let zuletzt = 0;
  FUSSNOTEN_GRUPPE.lastIndex = 0;
  let m: RegExpExecArray | null = FUSSNOTEN_GRUPPE.exec(text);
  while (m !== null) {
    const ende = FUSSNOTEN_GRUPPE.lastIndex;
    const teile = zerlegeGruppe(m[1] ?? "", m.index + 1, gueltig);
    const marken = teile.filter(
      (t): t is Extract<GruppenTeil, { art: "marke" }> => t.art === "marke",
    );
    const sauber =
      marken.length > 0 && teile.every((t) => t.art === "leer" || (t.art === "marke" && t.rein));
    if (marken.length > 0) {
      raus += text.slice(zuletzt, m.index);
      if (sauber) {
        // Die ganze Gruppe wird zu ihren Marken — Klammern, Kommas und Leerraum darin gehören zur
        // Quellenangabe und nicht zum Satz.
        for (const t of marken) {
          raus += marke(t.ziffer);
        }
      } else {
        // Gemischt: die Klammer bleibt, jede gültige Zahl wird AN IHRER STELLE zur Marke.
        let stelle = m.index;
        for (const t of marken) {
          raus += text.slice(stelle, t.von) + marke(t.ziffer);
          stelle = t.bis;
        }
        raus += text.slice(stelle, ende);
      }
      for (const t of marken) {
        gesetzt.add(t.ziffer);
      }
      zuletzt = ende;
    }
    m = FUSSNOTEN_GRUPPE.exec(text);
  }
  raus += text.slice(zuletzt);
  // Der Rückfall: was der Server trägt, aber im Text nicht steht, steht am Ende — in der Reihenfolge
  // der Chips. Angehängt wird an die LETZTE Zeile mit Inhalt, damit die Marke im letzten Block
  // landet (Absatz, Listenpunkt, Überschrift) und nicht als eigener Absatz danebensteht.
  const fehlend = (tragend ?? []).filter((n) => gueltig(n) && !gesetzt.has(n));
  if (fehlend.length > 0) {
    const marken = fehlend.map(marke).join("");
    const schluss = raus.replace(/\s+$/, "").length;
    raus = raus.slice(0, schluss) + marken + raus.slice(schluss);
  }
  return { text: raus, zeichen };
}

/**
 * Löst die Platzhalter aus `markiereFussnoten` wieder auf: Klartext-Stücke und Marken.
 *
 * Der Platzhalter ist unteilbar — was hier ankommt, hat die Blockzerlegung heil überstanden.
 */
export function splitMarken(text: string, zeichen: string): FussnotenStueck[] {
  if (zeichen === "" || !text.includes(zeichen)) {
    return text.length > 0 ? [{ art: "text", text }] : [];
  }
  const raus: FussnotenStueck[] = [];
  // Gerade Stellen sind Text, ungerade sind die Ziffern zwischen zwei Klammerzeichen.
  text.split(zeichen).forEach((stueck, i) => {
    if (i % 2 === 1) {
      raus.push({ art: "marke", ziffer: Number.parseInt(stueck, 10) });
    } else if (stueck.length > 0) {
      raus.push({ art: "text", text: stueck });
    }
  });
  return raus;
}

// Ein `splitFussnoten(text, quellen)`, das beide Schritte in einem tat, gab es bis Runde 8. Es ist
// mit dieser Umstellung ERSATZLOS weg, nicht danebengelegt: zwischen die beiden Schritte gehört
// `parseAnswerMarkdown`, und ein zweiter Weg, der es überspringt, war genau die Falle, in der die
// Messung der Runde 8 grün war, während die Fläche Marken verlor (Ben: „ein Fuzztest nur gegen
// `splitFussnoten` erfasst die fehlerauslösende Blockzerlegung nicht"). Der Aufrufer-Wächter
// (`tests/capture/aufrufer-waechter.test.ts` A1) hat den Rest als toten Export gemeldet.

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const UL_ITEM_RE = /^[-*]\s+(.*)$/;
const OL_ITEM_RE = /^\d+[.)]\s+(.*)$/;

// Zeilenbasierter Block-Parser: Überschriften (#/## → h3, tiefer → h4 — die Antwort ist in eine
// Karte eingebettet, h1/h2 wären typografisch falsch), Listen (-/*/1.), Leerzeile = Absatzgrenze.
export function parseAnswerMarkdown(answer: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: AnswerInlinePart[][] } | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      segments.push({ kind: "paragraph", parts: parseAnswerInline(paragraph.join(" ")) });
      paragraph = [];
    }
  };
  const flushList = (): void => {
    if (list !== null && list.items.length > 0) {
      segments.push({ kind: "list", ordered: list.ordered, items: list.items });
    }
    list = null;
  };

  for (const rawLine of answer.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = HEADING_RE.exec(line);
    if (heading?.[1] !== undefined && heading[2] !== undefined) {
      flushParagraph();
      flushList();
      const level: 3 | 4 = heading[1].length <= 2 ? 3 : 4;
      const text = heading[2].trim();
      if (text.length > 0) {
        segments.push({ kind: "heading", level, parts: parseAnswerInline(text) });
      }
      continue;
    }
    const ul = UL_ITEM_RE.exec(line);
    const ol = ul ? null : OL_ITEM_RE.exec(line);
    const item = ul?.[1] ?? ol?.[1];
    if (item !== undefined) {
      flushParagraph();
      const ordered = ol !== null;
      if (list === null || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(parseAnswerInline(item));
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return segments;
}

// U1 (Word-Taskpane): dort wird KLARTEXT angezeigt/eingefügt — dieselbe Subset-Logik als STRIP:
// Markdown-Zeichen entfernen, Inhalt (inkl. Listenpunkte als eigene Zeilen) erhalten. Kein Rendern.
export function stripAnswerMarkdown(answer: string): string {
  const lines: string[] = [];
  for (const segment of parseAnswerMarkdown(answer)) {
    const flat = (parts: AnswerInlinePart[]): string => parts.map((p) => p.text).join("");
    if (segment.kind === "list") {
      segment.items.forEach((item, i) => {
        lines.push(segment.ordered ? `${i + 1}. ${flat(item)}` : `- ${flat(item)}`);
      });
    } else {
      lines.push(flat(segment.parts));
    }
  }
  return lines.join("\n");
}
