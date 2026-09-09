// AUFTRAG-mega7 Block A (bens Ship-Blocker): EINE Quelle für die Leerwert-Semantik des Bodys.
//
// Der Server merged ein PUT auf einen Entwurf PARTIELL (mergeDraftPayload, services/capture/src/
// service.ts) — und das muss so bleiben: fünf von sieben Aufrufern (Mobil ×2, Vordertür ×2,
// Offline-Queue) senden bewusst nur einen Ausschnitt und hängen daran, dass die übrigen Felder
// überleben. Der Vertrag dazu lautet:
//
//   Schlüssel NICHT mitgeschickt ⇒ Altwert bleibt.
//   Schlüssel mitgeschickt mit LEERWERT ⇒ Altwert geht.
//
// Genau diese Unterscheidung fehlte dem bodyHtml: es wurde nur mitgeschickt, wenn es Inhalt trug.
// Wer einen fortgesetzten Entwurf im Studio BEWUSST leerte, sendete damit kein `bodyHtml: ""`,
// sondern gar nichts — der Merge holte den alten Body zurück, und toKoInput trug ihn beim Promote
// ins Wissensobjekt. Das bringt bewusst entfernten Inhalt zurück (Datenminimierung, Nutzerabsicht).
//
// Diese Funktion macht daraus dieselbe eindeutige Semantik, die mega6 bereits für reviewerIds,
// pendingSources, sourceForm, extQuery und interview eingeführt hat. „Leer" ist hier bewusst
// dasselbe `trim()`-Kriterium, das die Aufrufer schon vorher benutzt haben — die Änderung betrifft
// NUR den leeren Fall beim Aktualisieren, nicht was als „Inhalt" zählt.
import { decodeHtmlEntities } from "./htmlEntities";
import { FLAT_BODY_TAGS } from "./richText";

export const CLEARED_DRAFT_BODY_HTML = "";

export function draftBodyPatch(bodyHtml: string, isDraftUpdate: boolean): { bodyHtml?: string } {
  if (bodyHtml.trim()) {
    return { bodyHtml };
  }
  // Beim ANLEGEN gibt es keinen Altwert zu löschen — dort bleibt das Feld wie bisher ganz aus der
  // Payload (die Mobil-/Vordertür-Pfade, die nur Titel und Aussage senden, ändern sich dadurch nicht).
  return isDraftUpdate ? { bodyHtml: CLEARED_DRAFT_BODY_HTML } : {};
}

// ================================================================================================
// JOB 3377 — EIN TEXT, ZWEI FLÄCHEN: der Entwurfstext, zerlegt in bearbeitbar und fest.
// ================================================================================================
//
// DER BEFUND (A08): Pedi ergänzt einen Entwurf am Handy, öffnet ihn am Desktop — und sieht dort den
// ALTEN Text. Grund: das Handy schrieb `statement`, der Desktop-Editor zeigt `bodyHtml` (Capture.tsx,
// `setBodyHtml(p.bodyHtml ?? "")` — z. Zt. :2146). Zwei Felder, zwei Wahrheiten; der partielle Merge
// oben liess den alten Body pflichtgemäss stehen.
//
// DIE ENTSCHEIDUNG. Das Handy bearbeitet ab jetzt DENSELBEN Text — die Textfassung des `bodyHtml` —,
// sobald der Entwurf einen hat. Die Sichtbarkeit am Desktop ist damit kein Hinweis mehr, sondern
// eine Folge; am Desktop muss dafür nichts geändert werden.
//
// DER PREIS, DEN NIEMAND ZAHLEN DARF, ist Inhaltsverlust. Ein `bodyHtml` trägt Bilder, Tabellen,
// Überschriften, Listen und Inline-Auszeichnung; eine Textfassung trägt das alles NICHT. Ein naives
// „Text rein, Text raus" hätte beim ersten mobilen Speichern jedes Bild gelöscht.
//
// DESHALB WIRD NICHT DER GANZE BODY BEARBEITET, SONDERN JEDER BLOCK EINZELN. Die vier Arten:
//
//   `text`   Block aus AUSSCHLIESSLICH `p`/`br`/Text. Textfassung verlustfrei hin und zurück
//            (`<br>` ⇄ Zeilenumbruch, Entities ⇄ Klartext).
//   `format` Ein `<p>`, das ausser `p`/`br` nur Inline-Auszeichnung trägt (fett, kursiv, Verweis …).
//            Sichtbar und bearbeitbar; unberührt byteweise erhalten, geändert zu einfachem Text.
//   `fest`   Alles andere: Bild, Tabelle, Überschrift, Liste, Zitat, Panel. NIE bearbeitbar, immer
//            byteweise erhalten, im Text als nummerierter Platzhalter an seiner Stelle.
//   `leer`   Absatz ohne sichtbaren Text — flach (`<p></p>`) ODER ausgezeichnet
//            (`<p><strong></strong></p>`, `<p><em><br></em></p>`). Byteweise erhalten, aber ohne
//            Platzhalter: er hat dem Menschen nichts zu sagen. Die Auszeichnung entscheidet hier
//            NICHT — sichtbar leer ist sichtbar leer (Runde 3, s. `splitDraftBody`).
//
// UND EIN PLATZHALTER LÖSCHT NIE ETWAS. Fehlt er beim Zurückschreiben (versehentlich mitgelöscht,
// ein Textfeld ist nun einmal ein Textfeld), kehrt sein Block an seine Stelle zurück. Lieber ein
// Block, den jemand nicht loswird, als ein Bild, das still verschwindet.
//
// WOHER DAS KRITERIUM KOMMT — keine zweite Liste: `FLAT_BODY_TAGS` (richText.ts) ist der
// autoritative Tag-Vertrag, aus dem auch `shouldPreserveRichBody` seine Entscheidung zieht. Direkt
// importiert wird die MENGE und nicht jene Funktion, weil `bodyAiAssist.ts` über `captureFrontDoor.ts`
// auf diese Datei zurückzeigt — ein Import von dort wäre ein Modulkreis. `INLINE_TAGS` daneben ist
// eine NEUE Unterscheidung (was ist Auszeichnung, was ist Inhalt) und schreibt keine vorhandene
// Liste ab — ein `<img>` steht bewusst NICHT darin.

/** Was für ein fester Block das ist — für einen Platzhalter, den ein Mensch lesen kann. */
export type DraftBodyMarke = "bild" | "tabelle" | "ueberschrift" | "liste" | "zitat" | "block";

/** Ein Stück des Entwurfstexts. `art` sagt, was mit ihm geschehen darf. */
export interface DraftBodySegment {
  /** Siehe „DIE VIER ARTEN" im Abschnittskopf. */
  readonly art: "text" | "format" | "fest" | "leer";
  /** Der Block, wörtlich wie er im gespeicherten `bodyHtml` steht. */
  readonly html: string;
  /**
   * Bei `text`/`format` die bearbeitbare Textfassung; bei `fest` eine kurze LESBARE Vorschau für
   * den Platzhalter; bei `leer` leer.
   */
  readonly text: string;
  /** Nur bei `fest`: was für ein Block das ist. Sonst `null`. */
  readonly marke: DraftBodyMarke | null;
  /** Nur bei `fest`: die 1-basierte Nummer, unter der sein Platzhalter im Text steht. Sonst 0. */
  readonly nummer: number;
}

/**
 * Tags ohne Ende-Tag. Ohne sie zählte `<img …>` als offener Block und schluckte alles Folgende bis
 * zum nächsten `</…>` — der Body zerfiele in falsche Blöcke.
 */
const LEERE_TAGS: ReadonlySet<string> = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * Der Body in seine BLÖCKE DER OBERSTEN EBENE, wörtlich und LÜCKENLOS: aneinandergehängt ergeben
 * sie wieder GENAU die Eingabe.
 *
 * RUNDE 2 (BEN Korrekturpflicht 3): „bis auf reinen Zwischenraum zwischen zwei Blöcken" stand hier,
 * und dieses „bis auf" war ein Inhaltsverlust. Ein gespeichertes `<p>A</p>\n<p>B</p>` kam nach dem
 * mobilen Speichern als `<p>A</p><p>B</p>` zurück — der Zeilenumbruch verschwand, OHNE dass jemand
 * etwas geändert hätte. Reiner Zwischenraum wird deshalb nicht mehr weggeworfen, sondern reist als
 * VORLAUF am nächsten Block mit (Zwischenraum am Ende hängt sich an den letzten Block). Er ist für
 * `blockZuText` folgenlos (das trimmt), aber die Aneinanderreihung ist jetzt byte-gleich.
 *
 * Zeichenkettenbasiert wie der übrige Rich-Text-Werkzeugkasten (richText.ts) — kein DOM, damit diese
 * Datei DOM-frei bleibt und in jedem Testlauf ohne jsdom trägt.
 */
function bloeckeDerOberstenEbene(html: string): string[] {
  const bloecke: string[] = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>/g;
  let tiefe = 0;
  let start = 0;
  // Reiner Zwischenraum, der noch keinem Block gehört — er gehört dem NÄCHSTEN.
  let vorlauf = "";
  const lege = (stueck: string): void => {
    bloecke.push(vorlauf + stueck);
    vorlauf = "";
  };
  let m: RegExpExecArray | null = tagRe.exec(html);
  while (m !== null) {
    const voll = m[0];
    const tag = (m[1] ?? "").toLowerCase();
    const schliessend = voll.startsWith("</");
    const ohneEnde = LEERE_TAGS.has(tag) || voll.endsWith("/>");
    if (tiefe === 0 && !schliessend) {
      const davor = html.slice(start, m.index);
      if (davor.trim()) {
        lege(davor);
      } else {
        vorlauf += davor;
      }
      if (ohneEnde) {
        lege(voll);
        start = tagRe.lastIndex;
      } else {
        start = m.index;
        tiefe = 1;
      }
    } else if (schliessend) {
      // Ein Ende-Tag ohne offenen Anfang (unausgewogenes HTML) wird bewusst ignoriert, statt die
      // Tiefe negativ werden zu lassen — der Rest landet dann als EIN fester Block und bleibt heil.
      if (tiefe > 0) {
        tiefe -= 1;
        if (tiefe === 0) {
          lege(html.slice(start, tagRe.lastIndex));
          start = tagRe.lastIndex;
        }
      }
    } else if (!ohneEnde) {
      tiefe += 1;
    }
    m = tagRe.exec(html);
  }
  const rest = vorlauf + html.slice(start);
  if (rest.trim()) {
    vorlauf = "";
    bloecke.push(rest);
  } else if (rest.length > 0) {
    // Reiner Zwischenraum am Ende: er bekommt keinen eigenen Block (er hätte dem Menschen nichts zu
    // sagen), geht aber auch nicht verloren — er hängt sich hinten an den letzten Block.
    const letzter = bloecke.pop();
    if (letzter !== undefined) {
      bloecke.push(letzter + rest);
    }
  }
  return bloecke;
}

/**
 * REINE AUSZEICHNUNG — Tags, die sagen, WIE etwas aussieht, nicht WAS dort steht.
 *
 * `img` steht bewusst NICHT darin: ein Bild ist Inhalt und darf nie an einer Textänderung hängen.
 * `span` ebenso wenig — der Sanitizer verwirft es ohnehin (richText.ts), und was er verwirft, soll
 * hier nicht als harmlos gelten.
 */
const INLINE_TAGS: ReadonlySet<string> = new Set([
  "a",
  "b",
  "code",
  "em",
  "i",
  "mark",
  "s",
  "small",
  "strong",
  "sub",
  "sup",
  "u",
]);

/** Alle Tags eines Blocks, kleingeschrieben, in Vorkommensreihenfolge. */
function tagsIn(block: string): string[] {
  const raus: string[] = [];
  const re = /<\/?([a-zA-Z][\w-]*)/g;
  let m: RegExpExecArray | null = re.exec(block);
  while (m !== null) {
    raus.push((m[1] ?? "").toLowerCase());
    m = re.exec(block);
  }
  return raus;
}

/** Trägt dieser Block ausschliesslich `p`/`br`/Text? Dann ist seine Textfassung verlustfrei. */
function istFlach(block: string): boolean {
  return tagsIn(block).every((tag) => FLAT_BODY_TAGS.has(tag));
}

/**
 * Ein ABSATZ MIT AUSZEICHNUNG: `p`/`br` plus reine Inline-Tags, nichts sonst. Er ist bearbeitbar —
 * ein ausgezeichneter Absatz darf am Handy nicht stumm verschwinden —, verliert seine Auszeichnung
 * aber, sobald sein Text sich ändert.
 */
function istAusgezeichneterAbsatz(block: string): boolean {
  const tags = tagsIn(block);
  return (
    tags[0] === "p" &&
    tags.every((tag) => FLAT_BODY_TAGS.has(tag) || INLINE_TAGS.has(tag)) &&
    tags.some((tag) => INLINE_TAGS.has(tag))
  );
}

/** Was für ein fester Block ist das? Entschieden am ERSTEN Tag — dem, der den Block aufmacht. */
function markeVon(block: string): DraftBodyMarke {
  const tags = tagsIn(block);
  if (tags.includes("img")) {
    return "bild";
  }
  const erstes = tags[0] ?? "";
  if (erstes === "table") {
    return "tabelle";
  }
  if (/^h[1-6]$/.test(erstes)) {
    return "ueberschrift";
  }
  if (erstes === "ul" || erstes === "ol") {
    return "liste";
  }
  if (erstes === "blockquote") {
    return "zitat";
  }
  return "block";
}

/** Höchstlänge der lesbaren Vorschau im Platzhalter — genug zum Wiedererkennen, kein zweiter Text. */
const VORSCHAU_MAX = 40;

/** Eine kurze, lesbare Vorschau des festen Blocks (Bildbeschriftung, Überschrift, erste Zelle …). */
function vorschauVon(block: string): string {
  const alt = /<img\b[^>]*\balt\s*=\s*"([^"]*)"/i.exec(block)?.[1] ?? "";
  const roh = decodeHtmlEntities(
    (alt || block.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " "),
  ).trim();
  return roh.length > VORSCHAU_MAX ? `${roh.slice(0, VORSCHAU_MAX).trimEnd()}…` : roh;
}

/** Textfassung eines flachen Blocks: `<br>` wird Zeilenumbruch, Entities werden Klartext. */
function blockZuText(block: string): string {
  return decodeHtmlEntities(block.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")).trim();
}

/** Klartext zurück in einen sicheren `<p>`-Block: escapt, Zeilenumbruch wird wieder `<br>`. */
function textZuBlock(text: string): string {
  const sicher = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p>${sicher.split("\n").join("<br>")}</p>`;
}

/** Der gespeicherte Body als Segmentfolge. Leerer Body ⇒ leere Folge. */
export function splitDraftBody(bodyHtml: string | null | undefined): DraftBodySegment[] {
  const html = bodyHtml ?? "";
  if (!html.trim()) {
    return [];
  }
  let feste = 0;
  return bloeckeDerOberstenEbene(html).map((block) => {
    const flach = istFlach(block);
    if (flach || istAusgezeichneterAbsatz(block)) {
      const text = blockZuText(block);
      // RUNDE 3 (BEN Korrekturpflicht 1): OHNE SICHTBAREN TEXT IST EIN ABSATZ `leer` — auch wenn er
      // eine Auszeichnung trägt. Vorher stand diese Prüfung nur im flachen Zweig; `<p><strong></strong></p>`
      // wurde deshalb `format` mit leerer Textfassung. Ein bearbeitbares Segment hängt aber am
      // Klartext, und ein Absatz, der im Textfeld gar nicht erscheint, findet dort keinen Anker:
      // Regel 5 überging ihn als „bearbeitbar", und er fiel beim Speichern heraus — gemessen im
      // echten CaptureService, OHNE jede Nutzerhandlung (`<p><strong></strong></p><p>A</p>` → `<p>A</p>`).
      // Als `leer` gilt für ihn dieselbe Zusage wie für `<p></p>`: byteweise erhalten, kein
      // Platzhalter, denn er hat dem Menschen nichts zu sagen.
      if (text.length === 0) {
        return { art: "leer" as const, html: block, text: "", marke: null, nummer: 0 };
      }
      return flach
        ? { art: "text" as const, html: block, text, marke: null, nummer: 0 }
        : { art: "format" as const, html: block, text, marke: null, nummer: 0 };
    }
    feste += 1;
    return {
      art: "fest" as const,
      html: block,
      text: vorschauVon(block),
      marke: markeVon(block),
      nummer: feste,
    };
  });
}

/** Ist dieses Segment ein Absatz, den der Mensch am Handy anfassen darf? */
function istBearbeitbar(seg: DraftBodySegment): boolean {
  return seg.art === "text" || seg.art === "format";
}

/** Die sechs Marken, wörtlich — sie sind der maschinelle Teil des Platzhalters (s. `PLATZHALTER`). */
const MARKEN: readonly DraftBodyMarke[] = [
  "bild",
  "tabelle",
  "ueberschrift",
  "liste",
  "zitat",
  "block",
];

/**
 * Der Platzhalter eines festen Blocks.
 *
 * RUNDE 2 (BEN Korrekturpflicht 2): hier stand `^\[\[\s*(\d+)\s*(?::[\s\S]*)?\]\]$` — „erkannt wird
 * nur die Nummer". Das war zu weit. Ein Mensch, der in seinem Entwurf einen Absatz `[[1]]` stehen
 * hat (Fussnotenzeichen, Vorlagenmarke, Quelltextschnipsel), bekam ihn beim mobilen Speichern als
 * STEUERZEICHEN gelesen: sein Text verschwand, und das Bild sprang an dessen Stelle — gemessen, ohne
 * jede Eingabe.
 *
 * Verlangt wird deshalb ab jetzt die VOLLE erzeugte Form `[[n: marke: …]]` mit einer der sechs
 * Marken. Die Marke ist der maschinelle Teil und bleibt unübersetzt (`draftBodyText`); alles hinter
 * ihr ist Menschenauskunft und darf überschrieben werden. Damit kann ein Platzhalter nicht mehr
 * versehentlich getippt werden — und wer die Vorschau umschreibt, verliert trotzdem keine Stellung.
 *
 * Die zweite Hälfte der Absicherung liegt in `draftBodyFromText`: dort werden UNBERÜHRTE Absätze
 * ZUERST gebunden. Ein Absatz, der wirklich `[[1: bild: Pumpe]]` lautet, gehört sich damit selbst,
 * bevor überhaupt jemand nach Platzhaltern sucht.
 */
const PLATZHALTER = /^\[\[\s*(\d+)\s*:\s*([a-zA-Z]+)\s*(?::[\s\S]*)?\]\]$/;

/** Trägt dieser Absatz die VOLLE erzeugte Platzhalterform? Dann Nummer und Marke, sonst `null`. */
function platzhalterVon(absatz: string): { nummer: number; marke: DraftBodyMarke } | null {
  const treffer = PLATZHALTER.exec(absatz);
  if (!treffer) {
    return null;
  }
  const marke = (treffer[2] ?? "").toLowerCase() as DraftBodyMarke;
  // Eine erfundene Marke ist kein Platzhalter, sondern Text. Ohne diese Prüfung wäre `[[1: foo]]`
  // wieder ein Steuerzeichen — und der Sinn der Verschärfung dahin.
  return MARKEN.includes(marke) ? { nummer: Number(treffer[1]), marke } : null;
}

/**
 * Was auf dem Handy im Textfeld steht: JEDER Absatz, den der Mensch anfassen darf, UND für jeden
 * festen Block ein lesbarer Platzhalter an seiner Stelle — durch Leerzeile getrennt.
 *
 * BENANNTE GRENZE: das Etikett ist die unübersetzte Marke plus Vorschau (`[[1: bild: Pumpe]]`). Eine
 * übersetzte Fassung bräuchte neue Texte in `apps/web/src/i18n.ts` — die Datei ist Zielpfad dreier
 * laufender Jobs und für diesen Auftrag gesperrt. Übersetzt werden dürfte später die VORSCHAU hinter
 * der Marke; die Marke selbst ist maschinell und muss es bleiben (s. `PLATZHALTER`).
 */
export function draftBodyText(segments: readonly DraftBodySegment[]): string {
  return segments
    .filter((s) => istBearbeitbar(s) || s.art === "fest")
    .map((s) => (s.art === "fest" ? `[[${s.nummer}: ${s.marke}: ${s.text}]]` : s.text))
    .join("\n\n");
}

/** Ein Stück des zurückgeschriebenen Textes zwischen zwei Leerzeilen, mit seiner Lage im Text. */
interface Rohteil {
  readonly von: number;
  readonly bis: number;
}

/**
 * Der Text an seinen Leerzeilen, ALS LAGEN statt als Zeichenketten.
 *
 * WARUM LAGEN UND NICHT `text.split(…)`: ein zusammenhängender Absatz kann selbst eine Leerzeile
 * tragen (`<p>Hand<br><br>buch</p>` liest sich als „Hand\n\nbuch"). Wer hier gleich in Zeichenketten
 * zerlegt, hat ihn zerrissen, bevor die Ankererkennung ihn suchen konnte — GENAU DARAN ist JOB 3289
 * gescheitert. Mit Lagen lässt sich ein LAUF mehrerer Rohteile wieder wörtlich aus dem Text
 * schneiden, samt seiner inneren Zeilenumbrüche, und mit dem Segmenttext vergleichen.
 */
function rohteile(text: string): Rohteil[] {
  const raus: Rohteil[] = [];
  const re = /\n{2,}/g;
  let start = 0;
  let m: RegExpExecArray | null = re.exec(text);
  while (m !== null) {
    raus.push({ von: start, bis: m.index });
    start = re.lastIndex;
    m = re.exec(text);
  }
  raus.push({ von: start, bis: text.length });
  return raus.filter((r) => text.slice(r.von, r.bis).trim().length > 0);
}

/** Ein Textteil, wie er am Ende in den Body geht: sein Wortlaut und sein Ursprungssegment. */
interface Teil {
  readonly text: string;
  segment: number | null;
}

/**
 * Der bearbeitete Text zurück in den Body — DIE REIHENFOLGE IM TEXT IST DIE WAHRHEIT.
 *
 * DIE REGELN, in genau dieser Reihenfolge:
 *   1. UNBERÜHRTE ABSÄTZE ZUERST, UND ALS GANZE, UND IN DER REIHENFOLGE DES ORIGINALS. Ein LAUF von
 *      Rohteilen, dessen wörtlicher Textausschnitt einem Segmenttext gleicht, nimmt dieses Segment —
 *      sein HTML bleibt byteweise erhalten, samt Auszeichnung, `href` und `<img>`.
 *   2. Ein Platzhalter `[[n: marke: …]]` gibt den festen Block Nummer n an genau dieser Stelle
 *      zurück, wörtlich — aber erst, NACHDEM Regel 1 durch ist (s. `PLATZHALTER`).
 *   3. NACHSCHLAG: ein Absatz, der wörtlich einem Segment gleicht, es der Reihenfolge wegen aber
 *      nicht bekommen hat, darf es ordnungsfrei nehmen. Sonst verlöre ein bloss VERSCHOBENER
 *      ausgezeichneter Absatz seine Auszeichnung.
 *   4. ERST DANACH DIE ÄNDERUNGEN, UND NUR IN IHRER LÜCKE. Ein Absatz ohne wörtlichen Treffer ist
 *      die Änderung eines Segments NUR DANN, wenn zwischen seinen beiden Nachbarankern überhaupt
 *      ein freies bearbeitbares Segment liegt. Sonst ist er NEU. Einen einstufigen Rückfall
 *      („kein Treffer ⇒ nächstes freies Segment") gibt es NICHT — er war der Fehler in 3289 R3:
 *      ein eingefügter Absatz verbrauchte damit das Segment seines Nachbarn, und beide verloren
 *      ihre Auszeichnung, obwohl sie niemand angefasst hatte.
 *   5. NICHTS GEHT VERLOREN, WAS NICHT BEARBEITBAR WAR. Fehlende feste/leere Blöcke werden nach dem
 *      Durchgang wieder eingesetzt, und zwar hinter dem letzten Eintrag, der im Original vor ihnen
 *      stand — und stand dort keiner, VOR ihrem ersten Nachbarn dahinter. Ein versehentlich
 *      gelöschter Platzhalter kostet damit kein Bild, und ein leerer Absatz keine Stellung.
 *
 * RUNDE 2 — WARUM REGEL 1 NICHT MEHR GIERIG SUCHT (BEN Korrekturpflicht 1). Vorher lief sie
 * vorwärts und nahm an jeder Stelle den LÄNGSTEN Lauf, der irgendein freies Segment traf. Bei
 * mehrdeutigem Klartext griff sie damit daneben: `<p><strong>A</strong></p><p><em>B</em></p><p>A<br><br>B</p>`
 * liest sich als „A / B / A / B", der erste Lauf „A\n\nB" traf das DRITTE Segment, und ohne jede
 * Eingabe kam `<p>A<br><br>B</p><p><strong>A</strong></p><p><em>B</em></p>` zurück — die Absätze
 * umgeordnet, Fettung und Kursiv an der falschen Stelle.
 *
 * Gierig war der Fehler, nicht die Länge. Regel 1 wählt jetzt die ordnungserhaltende Zuordnung mit
 * der GRÖSSTEN Gesamtdeckung (Dynamische Programmierung über Textteile × Segmente, bewertet nach
 * gedeckter Zeichenzahl). Für den Fall oben findet sie „A→1, B→2, A\n\nB→3" (Deckung 9) statt
 * „A\n\nB→3" (Deckung 5); für einen gelöschten ersten Absatz findet sie weiterhin den langen Lauf.
 * Beides ist gemessen, nicht behauptet.
 *
 * BENANNTE GRENZE, gemessen und ohne Inhaltsverlust: ändert der Mensch einen `format`-Absatz
 * wirklich, wird er zu schlichtem Text — ein Textfeld kann keine Auszeichnung tragen. Erhalten
 * bleibt, was UNBERÜHRT ist; und das ist der ganze Unterschied zu 3289.
 */
export function draftBodyFromText(segments: readonly DraftBodySegment[], text: string): string {
  const roh = rohteile(text);
  // Der wörtliche Textausschnitt über einen LAUF von Rohteilen — samt seiner inneren Leerzeilen.
  // Genau darauf beruht Regel 1: `<p>Hand<br><br>buch</p>` findet sich so als EINER wieder.
  const schnitt = (von: number, bis: number): string =>
    text.slice(roh[von]?.von ?? 0, roh[bis]?.bis ?? 0).trim();
  const vergeben = new Set<number>();
  // Welche Rohteile schon zu einem Anker gehören — ein Lauf darf keinen davon überspannen.
  const belegt = new Array<boolean>(roh.length).fill(false);
  const anker = new Map<number, { bis: number; seg: number }>();

  // Wie viele Rohteile ein einzelnes Segment höchstens überspannen kann. Ohne diese Schranke
  // müsste Regel 1 jeden denkbaren Lauf probieren; mit ihr genau so viele, wie es sie geben kann.
  const maxSpanne = segments.reduce(
    (n, s) => (istBearbeitbar(s) ? Math.max(n, s.text.split(/\n{2,}/).length) : n),
    1,
  );
  // Alle in Frage kommenden Läufe einmal geschnitten: `spannen[e][laenge - 1]`. Die DP unten fragt
  // sie oft; sie jedes Mal neu zu schneiden wäre die einzige teure Stelle des Verfahrens.
  const spannen: string[][] = roh.map((_r, e) =>
    Array.from({ length: Math.min(maxSpanne, roh.length - e) }, (_x, i) => schnitt(e, e + i)),
  );

  // ── DURCHGANG 1 — DIE UNBERÜHRTEN ABSÄTZE, ordnungserhaltend und grösstmöglich ────────────────
  //
  // `punkte[e][k]` = die grösste erreichbare Deckung, wenn nur noch die Textteile ab `e` und die
  // Segmente ab `k` übrig sind. Drei Züge je Feld: den Textteil überspringen (er ist neu oder
  // geändert), das Segment überspringen (es steht nicht mehr im Text), oder beide binden, wenn ein
  // Lauf ab `e` wörtlich dem Segmenttext gleicht. Bewertet wird mit `text.length + 1`: das `+1`
  // macht zwei kurze Treffer wertvoller als einen gleich langen, und genau daran hängt der Fall
  // oben.
  const n = roh.length;
  const m = segments.length;
  const punkte: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  // Wie lang der bindende Lauf an dieser Stelle wäre (0 = kein Treffer). Spart den zweiten Vergleich
  // beim Zurücklesen und macht die Rekonstruktion eindeutig.
  const bindung: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let e = n - 1; e >= 0; e--) {
    for (let k = m - 1; k >= 0; k--) {
      let best = Math.max(punkte[e + 1]?.[k] ?? 0, punkte[e]?.[k + 1] ?? 0);
      let beste = 0;
      const seg = segments[k];
      if (seg && istBearbeitbar(seg)) {
        const moeglich = spannen[e]?.length ?? 0;
        for (let laenge = 1; laenge <= moeglich; laenge++) {
          if (spannen[e]?.[laenge - 1] !== seg.text) {
            continue;
          }
          const wert = seg.text.length + 1 + (punkte[e + laenge]?.[k + 1] ?? 0);
          // `>=`, nicht `>`: BEI GLEICHSTAND WIRD GEBUNDEN. Sonst gewinnt das Überspringen, und ein
          // Absatz, dessen Wortlaut zweimal vorkommt, wandert an die zweite Fundstelle — gemessen an
          // `<p>[[1: bild: Pumpe]]</p><p><img …></p>`, wo der Text hinter das Bild rutschte. Unter
          // gleichwertigen Läufen gewinnt zudem der längste (der Schleifenlauf überschreibt).
          if (wert >= best) {
            best = wert;
            beste = laenge;
          }
        }
      }
      const zeile = punkte[e];
      const bzeile = bindung[e];
      if (zeile) {
        zeile[k] = best;
      }
      if (bzeile) {
        bzeile[k] = beste;
      }
    }
  }
  // Die gefundene Zuordnung zurücklesen — bei Gleichstand gewinnt das Binden, nicht das Überspringen.
  for (let e = 0, k = 0; e < n && k < m; ) {
    const laenge = bindung[e]?.[k] ?? 0;
    if (laenge > 0) {
      vergeben.add(k);
      for (let j = e; j < e + laenge; j++) {
        belegt[j] = true;
      }
      anker.set(e, { bis: e + laenge, seg: k });
      e += laenge;
      k += 1;
      continue;
    }
    if ((punkte[e]?.[k] ?? 0) === (punkte[e + 1]?.[k] ?? 0)) {
      e += 1;
      continue;
    }
    k += 1;
  }

  // ── DURCHGANG 2 — DIE PLATZHALTER (Regel 2) ───────────────────────────────────────────────────
  //
  // ERST HIER, nicht davor: ein Absatz, der wirklich `[[1: bild: Pumpe]]` LAUTET, hat sich in
  // Durchgang 1 schon selbst gebunden und wird deshalb nicht mehr als Steuerzeichen gelesen. Das ist
  // die zweite Hälfte von BENs Korrekturpflicht 2 (die erste ist die verschärfte Form in
  // `PLATZHALTER`).
  roh.forEach((_r, e) => {
    if (belegt[e]) {
      return;
    }
    const treffer = platzhalterVon(spannen[e]?.[0] ?? "");
    if (!treffer) {
      return;
    }
    // Nummer UND Marke müssen zum festen Block passen. Passt eines von beiden nicht, bleibt der
    // Absatz liegen und wird unten wie gewöhnlicher Text behandelt — sein Block kehrt über Regel 5
    // an seine Stelle zurück, der getippte Text bleibt getippter Text. Nichts geht verloren.
    const i = segments.findIndex(
      (s, k) =>
        s.art === "fest" &&
        s.nummer === treffer.nummer &&
        s.marke === treffer.marke &&
        !vergeben.has(k),
    );
    if (i >= 0) {
      vergeben.add(i);
      belegt[e] = true;
      anker.set(e, { bis: e + 1, seg: i });
    }
  });

  // ── DURCHGANG 3 — DER NACHSCHLAG (Regel 3), ordnungsfrei ──────────────────────────────────────
  //
  // Was Durchgang 1 der Reihenfolge wegen liegen lassen musste, darf sich hier seinen wörtlichen
  // Treffer holen. Ohne ihn verlöre ein bloss VERSCHOBENER ausgezeichneter Absatz seine Auszeichnung.
  for (let e = 0; e < roh.length; ) {
    if (belegt[e]) {
      e += 1;
      continue;
    }
    let getroffen = 0;
    for (
      let laenge = Math.min(maxSpanne, roh.length - e);
      laenge >= 1 && getroffen === 0;
      laenge--
    ) {
      let frei = true;
      for (let j = e; j < e + laenge && frei; j++) {
        frei = !belegt[j];
      }
      if (!frei) {
        continue;
      }
      const spanne = spannen[e]?.[laenge - 1];
      const i = segments.findIndex(
        (s, k) => istBearbeitbar(s) && !vergeben.has(k) && s.text === spanne,
      );
      if (i >= 0) {
        vergeben.add(i);
        for (let j = e; j < e + laenge; j++) {
          belegt[j] = true;
        }
        anker.set(e, { bis: e + laenge, seg: i });
        getroffen = laenge;
      }
    }
    e += Math.max(1, getroffen);
  }

  // Der Text als Folge von Teilen: jeder Anker EIN Teil, jeder übrige Rohteil einer für sich.
  const teile: Teil[] = [];
  for (let e = 0; e < roh.length; ) {
    const vorhanden = anker.get(e);
    if (vorhanden) {
      teile.push({ text: schnitt(e, vorhanden.bis - 1), segment: vorhanden.seg });
      e = vorhanden.bis;
      continue;
    }
    teile.push({ text: schnitt(e, e), segment: null });
    e += 1;
  }

  // ── DURCHGANG 4 — DIE ÄNDERUNGEN (Regel 4), jede nur in ihrer eigenen Lücke ───────────────────
  teile.forEach((teil, e) => {
    if (teil.segment !== null) {
      return;
    }
    // Die Nachbarn: das nächste zugeordnete Segment davor und dahinter. Zwischen ihnen — und nur
    // dort — darf dieser Absatz sein Ursprungssegment haben.
    let unten = -1;
    for (let k = e - 1; k >= 0; k--) {
      const z = teile[k]?.segment ?? null;
      if (z !== null) {
        unten = z;
        break;
      }
    }
    let oben = segments.length;
    for (let k = e + 1; k < teile.length; k++) {
      const z = teile[k]?.segment ?? null;
      if (z !== null) {
        oben = z;
        break;
      }
    }
    const i = segments.findIndex(
      (s, k) => istBearbeitbar(s) && !vergeben.has(k) && k > unten && k < oben,
    );
    if (i >= 0) {
      vergeben.add(i);
      teil.segment = i;
    }
  });

  // `herkunft` = Index des Ursprungssegments (für das Wiedereinsetzen nach Regel 5); `null` = neu.
  const raus: { herkunft: number | null; html: string }[] = teile.map((teil) => {
    const i = teil.segment;
    const seg = i === null ? undefined : segments[i];
    if (i === null || !seg) {
      return { herkunft: null, html: textZuBlock(teil.text) };
    }
    if (seg.art === "fest") {
      return { herkunft: i, html: seg.html };
    }
    return { herkunft: i, html: seg.text === teil.text ? seg.html : textZuBlock(teil.text) };
  });

  // Regel 5: kein fester oder leerer Block geht verloren, auch wenn sein Platzhalter fehlt.
  segments.forEach((seg, i) => {
    if (istBearbeitbar(seg) || vergeben.has(i)) {
      return;
    }
    // Die Stelle: hinter dem letzten Eintrag, der im Original VOR ihm stand.
    let stelle = -1;
    raus.forEach((eintrag, k) => {
      if (eintrag.herkunft !== null && eintrag.herkunft < i) {
        stelle = k + 1;
      }
    });
    if (stelle < 0) {
      // RUNDE 3: stand im Original NICHTS vor ihm, gehört er VOR seinen ersten Nachbarn dahinter —
      // nicht stumpf an den Anfang. Sonst rutschte ein Block, der im Original ganz oben stand, vor
      // einen NEU eingefügten Absatz, und der Einschub landete an zweiter Stelle statt an erster.
      // Gibt es auch dahinter keinen Nachbarn, bleibt es beim Anfang (bisheriges Verhalten).
      const nachbar = raus.findIndex((e) => e.herkunft !== null && e.herkunft > i);
      stelle = nachbar >= 0 ? nachbar : 0;
    }
    raus.splice(stelle, 0, { herkunft: i, html: seg.html });
  });

  return raus.map((e) => e.html).join("");
}
