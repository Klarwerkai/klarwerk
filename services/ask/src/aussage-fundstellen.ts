// ================================================================================================
// produkt:20261009:referenzki-quellenbelege (REF-01) — AUSSAGE → QUELLENVERSION → PASSAGE.
// ================================================================================================
//
// WAS FEHLTE. Der Bestand bindet eine Antwort an ihre TRAGENDEN Quellen (`citedSources`), je Absatz
// an deren Kennungen (`absatz-belege.ts`), an die gelesene Fassung (`quellenStand`) und im Beleg an
// KO-Kennung und -Version (`AnswerEvidenceSnapshot`). Was nirgends stand: WELCHE konkrete Aussage
// sich auf WELCHE Stelle WELCHER Fassung stützt — der Snapshot schreibt `locator: null` mit dem
// Grund `no_locator_from_import`. Eine unabhängige Prüf-KI braucht genau diese Bindung, und zwar
// mit dem tatsächlich aufgelösten Inhalt, nicht mit einer Kennung, die sie selbst nachschlagen soll.
//
// WAS HIER ENTSTEHT, rein rechnend und ohne Egress:
//   1. `bindeAussagen` — je Satz einer beantworteten Antwort eine stabile Aussagekennung, je
//      Teilaussage die Fundstellen (Objekt, Fassung, Feld, Zeichenbereich, Auszug, Fingerabdruck)
//      und eine ausdrücklich benannte Deckungslücke, wo keine Fundstelle gefunden wurde.
//   2. `loeseFundstelleAuf` — die erneute, serverseitige Auflösung einer Fundstelle mit den
//      AKTUELLEN Rechten des Lesers: aktuell, nachträglich geändert, gelöscht, nicht zugänglich.
//   3. `pruefPaket` — die Eingabe einer Referenz-Prüfung: nur aufgelöste Auszüge mit Kontext, nie
//      bloße Links oder Titel; ohne Freigabe für externe Verarbeitung „nicht prüfbar" statt Versand.
//
// WAS HIER AUSDRÜCKLICH NICHT ENTSTEHT: kein Urteil, ob eine Passage die Aussage STÜTZT. Ein
// gemeinsames Wort ist kein Beleg — es findet nur die Stelle, die geprüft werden soll. Jede
// Fundstelle trägt deshalb `unterstuetzung: "nicht_bewertet"`; die Prüfung selbst ist Sache der
// Referenz-KI (eigener Auftrag). Kein Schreiben in den Wissensbestand, keine neue Ablage.
// (Bewusst nicht das Wort „ungeprueft": es ist im Add-on-Antwortkörper verboten, mega77.)
import { createHash } from "node:crypto";

/** Fassung dieses Vertrags — geht in den Belegfingerabdruck ein, damit ein Formatwechsel sichtbar ist. */
export const AUSSAGEN_BELEG_SCHEMA = 1;

/** Höchstzahl der Fundstellen, die eine Auflösungsanfrage tragen darf. */
export const FUNDSTELLEN_AUFLOESEN_MAX = 20;

/** Die Textfelder eines Wissensobjekts, aus denen eine interne Passage stammen kann. */
export type FundstellenFeld = "statement" | "bodyText";

/**
 * WIE eine Aussage an ihre Quelle kam. Nie aus Lage oder Nachbarschaft:
 *   · `marke`          — der Satz trägt selbst die Fußnotenmarke `[n]` der Quelle.
 *   · `absatzmarke`    — der Absatz trägt die Marke, der Satz nicht; dann zählt NUR ein Wortbezug.
 *   · `tragende_quelle`— keine Marke (deterministischer Weg: die Antwort IST die Aussage); dann
 *                        zählt ebenfalls NUR ein Wortbezug in einer tragenden Quelle.
 */
export type FundstellenZuordnung = "marke" | "absatzmarke" | "tragende_quelle";

interface FundstelleBasis {
  readonly fundstelleId: string;
  readonly koId: string;
  readonly koVersion: number;
  readonly start: number;
  readonly ende: number;
  /** Der tatsächlich aufgelöste Text `[start, ende)` — genau das, was eine Prüfung sehen muss. */
  readonly auszug: string;
  /** `sha256:<hex>` über `auszug` (UTF-8). Eine spätere Änderung der Stelle ändert ihn. */
  readonly fingerabdruck: string;
  readonly kontextVor: string;
  readonly kontextNach: string;
  readonly zuordnung: FundstellenZuordnung;
  /**
   * `true`: die Passage wurde über gemeinsame Begriffe (samt aller Zahlen der Teilaussage) gefunden.
   * `false`: nur die eigene Marke bindet — etwa bei einer Übersetzung. Dann ist die Passage die
   * gesamte Kernaussage der Quelle, nachvollziehbar, aber ausdrücklich ohne Wortbezug.
   */
  readonly wortbezug: boolean;
  /** Die Stütze ist NICHT geprüft — das ist der Auftrag der Referenz-Prüfung, nicht dieser Bindung. */
  readonly unterstuetzung: "nicht_bewertet";
}

export interface InterneFundstelle extends FundstelleBasis {
  readonly art: "intern";
  readonly feld: FundstellenFeld;
  /**
   * Herkunft bleibt erhalten: der ursprüngliche Autor des Objekts (Bestandsfeld `originalAuthor`).
   * `null` nur im engen Zuschnitt des Add-on-Wegs — der erfährt keine Personenkennungen.
   */
  readonly originalAutor: string | null;
  /** Der bestehende direkte Quellenweg der Oberfläche (`/wissen/:id`). */
  readonly link: string;
}

export interface ExterneFundstelle extends FundstelleBasis {
  readonly art: "extern";
  /** Die Belegstelle am Wissensobjekt (`KoSource.id`), deren gespeicherter Auszug gelesen wurde. */
  readonly quelleId: string;
  /** Herkunftsadresse der externen Quelle — `null`, wenn die Belegstelle keine Adresse trägt. */
  readonly herkunft: string | null;
  readonly anbieter: string | null;
  /** Wann die Belegstelle mit ihrem Auszug am Objekt gespeichert wurde (`KoSource.at`). */
  readonly abgerufenAm: string;
}

export type Fundstelle = InterneFundstelle | ExterneFundstelle;

/** Eine Angabe des Modells, die KEIN Beleg ist: ein Link oder eine Marke ohne aufgelösten Inhalt. */
export interface ModellAngabe {
  readonly art: "link" | "marke";
  readonly wert: string;
  readonly zustand: "nicht_aufgeloest";
}

export interface Teilaussage {
  readonly teilId: string;
  readonly text: string;
  readonly fundstellen: readonly Fundstelle[];
  /** `keine_fundstelle` ist die ausdrücklich ausgewiesene Deckungslücke dieser Teilaussage. */
  readonly deckung: "fundstelle" | "keine_fundstelle";
}

export interface Aussage {
  readonly aussageId: string;
  readonly text: string;
  readonly teile: readonly Teilaussage[];
  readonly deckung: "belegt" | "teilweise" | "unbelegt";
  readonly modellangaben: readonly ModellAngabe[];
}

export interface AussagenBeleg {
  readonly schema: number;
  // Bewusst KEINE `answerId`: sie ist je Lauf frisch und steht schon oben im Antwortkörper. Der Beleg
  // bindet die Antwort über ihren INHALT — dieselbe Antwort ergibt denselben Beleg (KA5-R2).
  /** `sha256:` über den Antworttext, auf dem die Aussagen gebildet wurden. */
  readonly antwortFingerabdruck: string;
  readonly aussagen: readonly Aussage[];
  /** Aussagekennungen ohne vollständige Deckung — nie stillschweigend weggelassen. */
  readonly fehlendeDeckung: readonly string[];
  /** `sha256:` über Antwort, Aussagen, Teilaussagen und Fundstellen samt Fassung und Fingerabdruck. */
  readonly belegFingerabdruck: string;
}

/** Die schmale Sicht auf eine Belegstelle am Wissensobjekt (`KoSource`). */
export interface QuelleBelegstelle {
  readonly id: string;
  readonly url: string | null;
  readonly excerpt: string | null;
  readonly provider?: string | null | undefined;
  readonly at: string;
}

/** Die schmale Sicht auf ein Quellobjekt, so wie DIESE Antwort es gelesen hat. */
export interface BindungsQuelle {
  readonly id: string;
  readonly version: number;
  readonly originalAuthor: string;
  readonly statement: string;
  readonly bodyText?: string | undefined;
  readonly sources?: readonly QuelleBelegstelle[] | undefined;
}

export interface BindeAussagenEingabe {
  readonly antwort: string;
  readonly sources: readonly string[];
  readonly citedSources: readonly string[];
  /** Die Objekte, aus denen die Antwort entstand — nach Sichtbarkeits- und Freigabefilter. */
  readonly quellen: ReadonlyMap<string, BindungsQuelle>;
}

// ------------------------------------------------------------------------------------------------
// Grundrechnung
// ------------------------------------------------------------------------------------------------

export function fingerabdruck(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function kurzHash(material: string, laenge: number): string {
  return createHash("sha256").update(material, "utf8").digest("hex").slice(0, laenge);
}

export function quellenLink(koId: string): string {
  return `/wissen/${encodeURIComponent(koId)}`;
}

const MARKE = /\[([0-9\s,]+)\]/g;
const LINK = /https?:\/\/[^\s)\]>"']+/g;

// Füllwörter tragen keine Aussage; ohne sie misst die Überschneidung Inhalt statt Grammatik.
const FUELLWORTLISTE =
  "der die das den dem des ein eine einen einem einer und oder ist sind wird werden wurde mit von vor nach bei für auf aus als auch nicht kein keine sich zum zur dass wie nur noch soll muss darf kann the and are this that with het een zijn met voor van";
const FUELLWOERTER = new Set(FUELLWORTLISTE.split(" "));

function begriffe(text: string): string[] {
  return (
    text
      .normalize("NFKC")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).filter((w) => /^\p{N}+$/u.test(w) || (w.length >= 3 && !FUELLWOERTER.has(w)));
}

function zahlen(text: string): string[] {
  return text.normalize("NFKC").match(/\p{N}+(?:[.,]\p{N}+)?/gu) ?? [];
}

function normal(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

interface Abschnitt {
  readonly start: number;
  readonly ende: number;
}

/** Die Sätze eines Quelltextes mit ihren Zeichenbereichen (führender Leerraum ausgenommen). */
function saetzeMitBereich(text: string): Abschnitt[] {
  const bereiche: Abschnitt[] = [];
  // Ein Punkt OHNE folgenden Leerraum („1.5 bar", „z.B.") beendet keinen Satz.
  for (const m of text.matchAll(/(?:[^.!?\n]|[.!?](?=\S))+[.!?]*/g)) {
    const roh = m[0];
    const vorn = roh.length - roh.trimStart().length;
    const inhalt = roh.trim();
    if (inhalt.length === 0) {
      continue;
    }
    const start = (m.index ?? 0) + vorn;
    bereiche.push({ start, ende: start + inhalt.length });
  }
  return bereiche;
}

/**
 * Die beste Passage für eine Teilaussage in einem Quelltext — oder `undefined`.
 *
 * Gefunden heisst: mindestens zwei (bei sehr kurzen Teilen alle) inhaltstragenden Begriffe UND die
 * Hälfte der Begriffe der Teilaussage stehen im Satz, und JEDE Zahl der Teilaussage steht dort auch.
 * Die Zahlregel ist Absicht: „90 °C" darf nicht an einer Stelle mit „80 °C" festgemacht werden —
 * auch dann nicht, wenn sonst jedes Wort passt.
 */
function bestePassage(teil: string, quelltext: string): Abschnitt | undefined {
  const eigene = [...new Set(begriffe(teil))];
  if (eigene.length === 0) {
    return undefined;
  }
  const noetigeZahlen = zahlen(teil);
  let beste: { bereich: Abschnitt; treffer: number } | undefined;
  for (const bereich of saetzeMitBereich(quelltext)) {
    const satz = quelltext.slice(bereich.start, bereich.ende);
    const vorhanden = new Set(begriffe(satz));
    const satzZahlen = new Set(zahlen(satz));
    if (!noetigeZahlen.every((z) => satzZahlen.has(z))) {
      continue;
    }
    const treffer = eigene.filter((w) => vorhanden.has(w)).length;
    const mindestens = Math.min(2, eigene.length);
    if (treffer < mindestens || treffer / eigene.length < 0.5) {
      continue;
    }
    if (!beste || treffer > beste.treffer) {
      beste = { bereich, treffer };
    }
  }
  return beste?.bereich;
}

function kontextUm(quelltext: string, bereich: Abschnitt): { vor: string; nach: string } {
  const saetze = saetzeMitBereich(quelltext);
  const i = saetze.findIndex((s) => s.start === bereich.start && s.ende === bereich.ende);
  const vor = i > 0 ? saetze[i - 1] : undefined;
  const nach = i >= 0 ? saetze[i + 1] : undefined;
  return {
    vor: vor ? quelltext.slice(vor.start, vor.ende) : "",
    nach: nach ? quelltext.slice(nach.start, nach.ende) : "",
  };
}

function interneFundstelle(
  quelle: BindungsQuelle,
  feld: FundstellenFeld,
  quelltext: string,
  bereich: Abschnitt,
  zuordnung: FundstellenZuordnung,
  wortbezug: boolean,
): InterneFundstelle {
  const auszug = quelltext.slice(bereich.start, bereich.ende);
  const fp = fingerabdruck(auszug);
  const kontext = kontextUm(quelltext, bereich);
  const material = [
    "intern",
    quelle.id,
    quelle.version,
    feld,
    bereich.start,
    bereich.ende,
    fp,
  ].join("|");
  return {
    art: "intern",
    fundstelleId: `fs_${kurzHash(material, 20)}`,
    koId: quelle.id,
    koVersion: quelle.version,
    feld,
    start: bereich.start,
    ende: bereich.ende,
    auszug,
    fingerabdruck: fp,
    kontextVor: kontext.vor,
    kontextNach: kontext.nach,
    zuordnung,
    wortbezug,
    unterstuetzung: "nicht_bewertet",
    originalAutor: quelle.originalAuthor,
    link: quellenLink(quelle.id),
  };
}

function externeFundstellen(
  quelle: BindungsQuelle,
  teil: string,
  zuordnung: FundstellenZuordnung,
): ExterneFundstelle[] {
  return (Array.isArray(quelle.sources) ? quelle.sources : []).flatMap((s) => {
    // Nur ein GESPEICHERTER Auszug ist ein geprüfter Stand. Eine Adresse allein ist kein Inhalt.
    if (typeof s.excerpt !== "string" || s.excerpt.trim() === "") {
      return [];
    }
    const bereich = bestePassage(teil, s.excerpt);
    if (!bereich) {
      return [];
    }
    const auszug = s.excerpt.slice(bereich.start, bereich.ende);
    const fp = fingerabdruck(auszug);
    const kontext = kontextUm(s.excerpt, bereich);
    const material = [
      "extern",
      quelle.id,
      quelle.version,
      s.id,
      bereich.start,
      bereich.ende,
      fp,
    ].join("|");
    return [
      {
        art: "extern" as const,
        fundstelleId: `fs_${kurzHash(material, 20)}`,
        koId: quelle.id,
        koVersion: quelle.version,
        quelleId: s.id,
        herkunft: s.url,
        anbieter: s.provider ?? null,
        abgerufenAm: s.at,
        start: bereich.start,
        ende: bereich.ende,
        auszug,
        fingerabdruck: fp,
        kontextVor: kontext.vor,
        kontextNach: kontext.nach,
        zuordnung,
        wortbezug: true,
        unterstuetzung: "nicht_bewertet" as const,
      },
    ];
  });
}

// ------------------------------------------------------------------------------------------------
// Antwort → Aussagen → Teilaussagen
// ------------------------------------------------------------------------------------------------

interface Satz {
  readonly text: string;
  readonly marken: readonly string[];
}

function markenVon(text: string): string[] {
  const marken: string[] = [];
  for (const m of text.matchAll(MARKE)) {
    for (const teil of (m[1] ?? "").split(",")) {
      const n = teil.trim();
      if (n !== "") {
        marken.push(n);
      }
    }
  }
  return marken;
}

/** Die Sätze eines Absatzes; ein Satz, der nur aus Marken besteht, gehört zum Satz davor. */
function saetzeVon(absatz: string): Satz[] {
  const roh = absatz.split(/(?<=[.!?])\s+/).filter((s) => s.trim() !== "");
  const saetze: { text: string; marken: string[] }[] = [];
  for (const stueck of roh) {
    const marken = markenVon(stueck);
    // „80 °C [1]." wird „80 °C." — die entfernte Marke hinterlässt keinen Leerraum vor dem Satzzeichen.
    const ohneMarken = normal(stueck.replace(MARKE, " ")).replace(/\s+([.,;:!?])/g, "$1");
    const vorher = saetze.at(-1);
    if (/^[\s.,;:!?]*$/.test(ohneMarken) && vorher) {
      vorher.marken.push(...marken);
      continue;
    }
    saetze.push({ text: ohneMarken, marken });
  }
  return saetze;
}

/**
 * Eine zusammengesetzte Aussage in Teile — an Semikolon und an „und/sowie/and/en", aber nur, wenn
 * jede Seite selbst Inhalt trägt (mindestens zwei Begriffe). „Druck und Temperatur prüfen" bleibt
 * EIN Teil; „Die Dichtung entlasten und das Ventil F3 schließen" sind zwei.
 */
function teileVon(satz: string): string[] {
  const stuecke = satz.split(/;\s+|,?\s+(?:und|sowie|and|en)\s+/i);
  if (stuecke.length < 2 || stuecke.some((s) => begriffe(s).length < 2)) {
    return [satz];
  }
  return stuecke.map((s) => s.trim());
}

/** Ist der Satz eine Tatsachenbehauptung? Fragen und reine Überleitungen sind es nicht. */
function behauptet(satz: string): boolean {
  return !satz.trim().endsWith("?") && begriffe(satz.replace(LINK, " ")).length >= 2;
}

function absaetzeVon(antwort: string): string[] {
  return antwort
    .split(/\n[ \t]*\n/)
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

function quelltexte(quelle: BindungsQuelle): { feld: FundstellenFeld; text: string }[] {
  const texte: { feld: FundstellenFeld; text: string }[] = [];
  if (typeof quelle.statement === "string") {
    texte.push({ feld: "statement", text: quelle.statement });
  }
  if (typeof quelle.bodyText === "string" && quelle.bodyText.trim() !== "") {
    texte.push({ feld: "bodyText", text: quelle.bodyText });
  }
  return texte;
}

function fundstellenFuer(
  teil: string,
  kandidaten: readonly string[],
  quellen: ReadonlyMap<string, BindungsQuelle>,
  zuordnung: FundstellenZuordnung,
  nurMarkeErlaubt: boolean,
): Fundstelle[] {
  const gefunden: Fundstelle[] = [];
  for (const koId of kandidaten) {
    const quelle = quellen.get(koId);
    if (!quelle) {
      continue;
    }
    let intern: InterneFundstelle | undefined;
    for (const { feld, text } of quelltexte(quelle)) {
      const bereich = bestePassage(teil, text);
      if (bereich) {
        intern = interneFundstelle(quelle, feld, text, bereich, zuordnung, true);
        break;
      }
    }
    // Übersetzung/Umformulierung: die eigene Marke bindet die Quelle nachvollziehbar, auch ohne
    // Wortbezug — dann ist die Passage die gesamte Kernaussage, und `wortbezug: false` sagt es.
    if (
      !intern &&
      nurMarkeErlaubt &&
      typeof quelle.statement === "string" &&
      quelle.statement.trim() !== ""
    ) {
      const roh = quelle.statement;
      const start = roh.length - roh.trimStart().length;
      intern = interneFundstelle(
        quelle,
        "statement",
        roh,
        { start, ende: roh.trimEnd().length },
        zuordnung,
        false,
      );
    }
    if (intern) {
      gefunden.push(intern);
    }
    gefunden.push(...externeFundstellen(quelle, teil, zuordnung));
  }
  return gefunden;
}

function belegFingerabdruckVon(antwortFp: string, aussagen: readonly Aussage[]): string {
  const material: string[] = [`schema=${AUSSAGEN_BELEG_SCHEMA}`, `antwort=${antwortFp}`];
  for (const a of aussagen) {
    material.push(`aussage=${a.aussageId}|${a.deckung}`);
    for (const t of a.teile) {
      material.push(`teil=${t.teilId}|${fingerabdruck(t.text)}|${t.deckung}`);
      for (const f of t.fundstellen) {
        material.push(
          `fundstelle=${f.fundstelleId}|${f.art}|${f.koId}|${f.koVersion}|${f.start}|${f.ende}|${f.fingerabdruck}`,
        );
      }
    }
  }
  return fingerabdruck(material.join("\n"));
}

function deckungVon(teile: readonly Teilaussage[]): Aussage["deckung"] {
  const belegt = teile.filter((t) => t.deckung === "fundstelle").length;
  return belegt === teile.length ? "belegt" : belegt === 0 ? "unbelegt" : "teilweise";
}

function belegAus(antwortFp: string, aussagen: readonly Aussage[]): AussagenBeleg {
  return {
    schema: AUSSAGEN_BELEG_SCHEMA,
    antwortFingerabdruck: antwortFp,
    aussagen,
    fehlendeDeckung: aussagen.filter((a) => a.deckung !== "belegt").map((a) => a.aussageId),
    belegFingerabdruck: belegFingerabdruckVon(antwortFp, aussagen),
  };
}

/**
 * Bindet jede Tatsachenbehauptung der Antwort an konkrete Fundstellen.
 *
 * Die Aussagekennung ist STABIL: sie hängt am normalisierten Aussagetext (und bei Wiederholung am
 * Vorkommen), nicht an der Lage. Dieselbe Antwort ergibt dieselben Kennungen; ein anderer Text eine
 * andere — eine Bestätigung kann deshalb nie auf geänderten Inhalt übergehen.
 */
export function bindeAussagen(eingabe: BindeAussagenEingabe): AussagenBeleg {
  const { antwort, quellen } = eingabe;
  // Doppelgänger und Altaufrufer liefern die Listen nicht immer — fehlend heisst leer, nie ein Wurf.
  const sources = Array.isArray(eingabe.sources) ? eingabe.sources : [];
  const genannt = Array.isArray(eingabe.citedSources) ? eingabe.citedSources : [];
  const tragend = genannt.filter((id) => sources.includes(id));
  const vorkommen = new Map<string, number>();
  const aussagen: Aussage[] = [];
  for (const absatz of absaetzeVon(antwort)) {
    const saetze = saetzeVon(absatz);
    const absatzMarken = saetze.flatMap((s) => s.marken);
    const aufloesen = (marken: readonly string[]) => {
      const ids: string[] = [];
      const ungueltig: string[] = [];
      for (const m of marken) {
        const n = Number.parseInt(m, 10);
        const id = Number.isInteger(n) && n >= 1 ? sources[n - 1] : undefined;
        if (id !== undefined && tragend.includes(id)) {
          if (!ids.includes(id)) {
            ids.push(id);
          }
        } else {
          ungueltig.push(m);
        }
      }
      return { ids, ungueltig };
    };
    const absatzQuellen = aufloesen(absatzMarken).ids;
    for (const satz of saetze) {
      if (!behauptet(satz.text)) {
        continue;
      }
      const eigene = aufloesen(satz.marken);
      const modellangaben: ModellAngabe[] = [
        ...eigene.ungueltig.map((m) => ({
          art: "marke" as const,
          wert: `[${m}]`,
          zustand: "nicht_aufgeloest" as const,
        })),
        ...(satz.text.match(LINK) ?? []).map((wert) => ({
          art: "link" as const,
          wert,
          zustand: "nicht_aufgeloest" as const,
        })),
      ];
      const text = normal(satz.text.replace(LINK, " "));
      const schluessel = text.toLowerCase();
      const n = (vorkommen.get(schluessel) ?? 0) + 1;
      vorkommen.set(schluessel, n);
      const wiederholung = n > 1 ? `_${n}` : "";
      const aussageId = `aus_${kurzHash(schluessel, 16)}${wiederholung}`;
      const [kandidaten, zuordnung]: [readonly string[], FundstellenZuordnung] =
        eigene.ids.length > 0
          ? [eigene.ids, "marke"]
          : absatzQuellen.length > 0
            ? [absatzQuellen, "absatzmarke"]
            : [tragend, "tragende_quelle"];
      const teilTexte = teileVon(text);
      // Eine Marke ohne Wortbezug bindet nur eine UNGETEILTE Aussage. Bei einer zusammengesetzten
      // braucht jeder Teil seine eigene Passage — sonst belegte die Stelle des einen den anderen.
      const nurMarke = zuordnung === "marke" && teilTexte.length === 1;
      const teile = teilTexte.map((teil, k): Teilaussage => {
        const fundstellen = fundstellenFuer(teil, kandidaten, quellen, zuordnung, nurMarke);
        return {
          teilId: `${aussageId}.t${k + 1}`,
          text: teil,
          fundstellen,
          deckung: fundstellen.length > 0 ? "fundstelle" : "keine_fundstelle",
        };
      });
      aussagen.push({ aussageId, text, teile, deckung: deckungVon(teile), modellangaben });
    }
  }
  return belegAus(fingerabdruck(antwort), aussagen);
}

/**
 * Der enge Zuschnitt für Wege ohne allgemeines Leserecht (Add-on-Schlüssel): nur Passagen aus der
 * Kernaussage (`statement`) — die Teile, die dieser Weg ohnehin als Antwort bekommt. Volltext- und
 * Belegstellenauszüge fallen weg, ebenso die Autorkennung (derselbe Grundsatz wie bei den
 * Personennamen der Belastbarkeit); die Deckung wird danach ehrlich neu gerechnet.
 */
export function aufKernaussagenBeschraenkt(beleg: AussagenBeleg): AussagenBeleg {
  const aussagen = beleg.aussagen.map((a) => {
    const teile = a.teile.map((t) => {
      const fundstellen = t.fundstellen.flatMap((f): InterneFundstelle[] =>
        f.art === "intern" && f.feld === "statement" ? [{ ...f, originalAutor: null }] : [],
      );
      return {
        ...t,
        fundstellen,
        deckung: fundstellen.length > 0 ? ("fundstelle" as const) : ("keine_fundstelle" as const),
      };
    });
    return { ...a, teile, deckung: deckungVon(teile) };
  });
  return belegAus(beleg.antwortFingerabdruck, aussagen);
}

// ------------------------------------------------------------------------------------------------
// Auflösen mit aktuellen Rechten
// ------------------------------------------------------------------------------------------------

/** Was ein Client zur Auflösung vorlegt — nur Kennungen und Bereich, nie Inhalt. */
export type FundstellenVerweis =
  | {
      readonly art: "intern";
      readonly koId: string;
      readonly koVersion: number;
      readonly feld: FundstellenFeld;
      readonly start: number;
      readonly ende: number;
      readonly fingerabdruck: string;
    }
  | {
      readonly art: "extern";
      readonly koId: string;
      readonly koVersion: number;
      readonly quelleId: string;
      readonly start: number;
      readonly ende: number;
      readonly fingerabdruck: string;
    };

const KENNUNG_MAX = 200;
const BEREICH_MAX = 1_000_000;

function kennung(wert: unknown): wert is string {
  return typeof wert === "string" && wert.length > 0 && wert.length <= KENNUNG_MAX;
}

function ganzzahl(wert: unknown): wert is number {
  return typeof wert === "number" && Number.isInteger(wert) && wert >= 0 && wert <= BEREICH_MAX;
}

/** Prüft einen vorgelegten Verweis strukturell — `undefined` heisst ungültig. */
export function leseFundstellenVerweis(roh: unknown): FundstellenVerweis | undefined {
  if (typeof roh !== "object" || roh === null) {
    return undefined;
  }
  const r = roh as Record<string, unknown>;
  if (
    !kennung(r.koId) ||
    !ganzzahl(r.koVersion) ||
    !ganzzahl(r.start) ||
    !ganzzahl(r.ende) ||
    r.start >= r.ende ||
    typeof r.fingerabdruck !== "string" ||
    !/^sha256:[0-9a-f]{64}$/.test(r.fingerabdruck)
  ) {
    return undefined;
  }
  const basis = {
    koId: r.koId,
    koVersion: r.koVersion,
    start: r.start,
    ende: r.ende,
    fingerabdruck: r.fingerabdruck,
  };
  if (r.art === "intern" && (r.feld === "statement" || r.feld === "bodyText")) {
    return { art: "intern", ...basis, feld: r.feld };
  }
  if (r.art === "extern" && kennung(r.quelleId)) {
    return { art: "extern", ...basis, quelleId: r.quelleId };
  }
  return undefined;
}

/**
 * Der Rumpf einer Auflösungsanfrage: `{ fundstellen: [...] }` mit 1 bis
 * `FUNDSTELLEN_AUFLOESEN_MAX` gültigen Verweisen. Ein einziger ungültiger Verweis macht die ganze
 * Anfrage ungültig (`undefined`) — es wird nichts still übersprungen.
 */
export function leseFundstellenAnfrage(roh: unknown): FundstellenVerweis[] | undefined {
  if (typeof roh !== "object" || roh === null) {
    return undefined;
  }
  const liste = (roh as { fundstellen?: unknown }).fundstellen;
  if (!Array.isArray(liste) || liste.length === 0 || liste.length > FUNDSTELLEN_AUFLOESEN_MAX) {
    return undefined;
  }
  const verweise = liste.map(leseFundstellenVerweis);
  return verweise.every((v): v is FundstellenVerweis => v !== undefined) ? verweise : undefined;
}

/** Ein Wissensobjekt, wie es der Auflöser braucht — Sichtbarkeitsfakten inklusive. */
export interface AufloesbaresObjekt {
  readonly id: string;
  readonly version: number;
  readonly originalAuthor: string;
  readonly author?: string | undefined;
  readonly confidentiality?: unknown;
  readonly spaceId?: unknown;
  readonly statement: string;
  readonly sources?: readonly (QuelleBelegstelle & { sourceRemovedAt?: string | undefined })[];
}

/** Die Fassung eines Objekts: Kernaussage, Volltext (falls projiziert) und Belegstellen. */
export interface ObjektFassung {
  readonly statement: string;
  readonly bodyText?: string | undefined;
  readonly sources?: readonly QuelleBelegstelle[] | undefined;
}

export interface FundstellenLeser<T extends AufloesbaresObjekt = AufloesbaresObjekt> {
  /** Das aktuelle, nicht gelöschte Objekt — oder `undefined`. */
  aktuell(koId: string): Promise<T | undefined>;
  /** Das Objekt, wenn es im Papierkorb liegt — oder `undefined`. */
  imPapierkorb(koId: string): Promise<T | undefined>;
  /** Eine bestimmte Fassung — oder `undefined`, wenn sie nicht mehr lesbar ist. */
  fassung(koId: string, version: number): Promise<ObjektFassung | undefined>;
}

export type FundstellenZustand =
  | "aktuell"
  | "geaendert"
  | "stand_nicht_verfuegbar"
  | "beschaedigt"
  | "geloescht"
  | "nicht_zugaenglich";

/** Verständliche Zustände — ohne Inhalt oder Metadaten, die der Leser nicht sehen darf. */
export const FUNDSTELLEN_HINWEIS: Readonly<Record<FundstellenZustand, string>> = {
  aktuell: "Die Fundstelle steht unverändert in der aktuellen Fassung der Quelle.",
  geaendert:
    "Die Quelle wurde seit der Antwort geändert. Gezeigt wird der damals verwendete Stand; die aktuelle Fassung ist getrennt verlinkt.",
  stand_nicht_verfuegbar:
    "Der damals verwendete Stand der Quelle ist nicht mehr lesbar. Die aktuelle Fassung ist verlinkt, belegt die Aussage aber nicht automatisch.",
  beschaedigt:
    "Die Fundstelle passt nicht zum gespeicherten Stand der Quelle und gilt nicht als Beleg.",
  geloescht: "Die Quelle wurde gelöscht. Die Fundstelle ist nicht mehr abrufbar.",
  nicht_zugaenglich: "Diese Quelle ist für Sie nicht zugänglich oder existiert nicht.",
};

export type FundstellenAufloesung =
  | {
      readonly zustand: "aktuell";
      readonly hinweis: string;
      readonly koId: string;
      readonly koVersion: number;
      readonly auszug: string;
      readonly fingerabdruck: string;
      readonly originalAutor: string;
      readonly link: string;
      readonly herkunft?: string | null;
      readonly abgerufenAm?: string;
    }
  | {
      readonly zustand: "geaendert";
      readonly hinweis: string;
      readonly koId: string;
      /** Der historisch verwendete Stand — die Fassung, auf die sich die Antwort stützte. */
      readonly gebunden: { readonly version: number; readonly auszug: string };
      /** Die aktuelle Quelle — getrennt, und mit der Auskunft, ob die Stelle wörtlich noch steht. */
      readonly aktuell: { readonly version: number; readonly passageUnveraendert: boolean };
      readonly originalAutor: string;
      readonly link: string;
    }
  | {
      readonly zustand: "stand_nicht_verfuegbar";
      readonly hinweis: string;
      readonly koId: string;
      readonly aktuell: { readonly version: number };
      readonly link: string;
    }
  | {
      readonly zustand: "beschaedigt" | "geloescht" | "nicht_zugaenglich";
      readonly hinweis: string;
      readonly koId: string;
    };

function ohneInhalt(
  zustand: "beschaedigt" | "geloescht" | "nicht_zugaenglich",
  koId: string,
): FundstellenAufloesung {
  return { zustand, hinweis: FUNDSTELLEN_HINWEIS[zustand], koId };
}

function textDerFassung(
  verweis: FundstellenVerweis,
  fassung: ObjektFassung,
): { text: string; herkunft?: string | null; abgerufenAm?: string } | undefined {
  if (verweis.art === "intern") {
    const text = verweis.feld === "statement" ? fassung.statement : fassung.bodyText;
    return typeof text === "string" ? { text } : undefined;
  }
  const quelle = (fassung.sources ?? []).find((s) => s.id === verweis.quelleId);
  return typeof quelle?.excerpt === "string"
    ? { text: quelle.excerpt, herkunft: quelle.url, abgerufenAm: quelle.at }
    : undefined;
}

/**
 * Löst EINE Fundstelle mit den AKTUELLEN Rechten des Lesers auf.
 *
 * DIE REIHENFOLGE IST DIE REGEL:
 *   1. Recht vor allem: ein Objekt, das der Leser nicht sehen darf, und ein Objekt, das es nicht
 *      gibt, sehen GLEICH aus (`nicht_zugaenglich`, nur die vorgelegte Kennung kommt zurück). Sonst
 *      wäre die Auflösung ein Orakel über fremde Berechtigungsräume.
 *   2. Gelöscht heisst nur der, der das Objekt sehen DURFTE — und auch er bekommt keinen Inhalt.
 *   3. Der gebundene Stand wird aus der gebundenen FASSUNG gelesen, nicht aus der aktuellen; passt
 *      der Fingerabdruck dort nicht, ist der Verweis kein Beleg (`beschaedigt`).
 *   4. Aktuell vs. geändert: historischer Stand und aktuelle Quelle bleiben unterscheidbar.
 */
export async function loeseFundstelleAuf<T extends AufloesbaresObjekt>(
  verweis: FundstellenVerweis,
  leser: FundstellenLeser<T>,
  darfSehen: (ko: T) => boolean,
): Promise<FundstellenAufloesung> {
  const ko = await leser.aktuell(verweis.koId);
  if (!ko) {
    const geloescht = await leser.imPapierkorb(verweis.koId);
    return geloescht && darfSehen(geloescht)
      ? ohneInhalt("geloescht", verweis.koId)
      : ohneInhalt("nicht_zugaenglich", verweis.koId);
  }
  if (!darfSehen(ko)) {
    return ohneInhalt("nicht_zugaenglich", verweis.koId);
  }
  const link = quellenLink(ko.id);
  if (verweis.koVersion > ko.version) {
    return ohneInhalt("beschaedigt", verweis.koId);
  }
  const fassung = await leser.fassung(ko.id, verweis.koVersion);
  const gebunden = fassung ? textDerFassung(verweis, fassung) : undefined;
  if (!gebunden) {
    return {
      zustand: "stand_nicht_verfuegbar",
      hinweis: FUNDSTELLEN_HINWEIS.stand_nicht_verfuegbar,
      koId: ko.id,
      aktuell: { version: ko.version },
      link,
    };
  }
  const auszug = gebunden.text.slice(verweis.start, verweis.ende);
  if (verweis.ende > gebunden.text.length || fingerabdruck(auszug) !== verweis.fingerabdruck) {
    return ohneInhalt("beschaedigt", verweis.koId);
  }
  if (verweis.koVersion === ko.version) {
    return {
      zustand: "aktuell",
      hinweis: FUNDSTELLEN_HINWEIS.aktuell,
      koId: ko.id,
      koVersion: ko.version,
      auszug,
      fingerabdruck: verweis.fingerabdruck,
      originalAutor: ko.originalAuthor,
      link,
      ...(verweis.art === "extern"
        ? { herkunft: gebunden.herkunft ?? null, abgerufenAm: gebunden.abgerufenAm ?? "" }
        : {}),
    };
  }
  const jetzt = await leser.fassung(ko.id, ko.version);
  const jetztText = jetzt ? textDerFassung(verweis, jetzt)?.text : undefined;
  return {
    zustand: "geaendert",
    hinweis: FUNDSTELLEN_HINWEIS.geaendert,
    koId: ko.id,
    gebunden: { version: verweis.koVersion, auszug },
    aktuell: {
      version: ko.version,
      passageUnveraendert: typeof jetztText === "string" && jetztText.includes(auszug),
    },
    originalAutor: ko.originalAuthor,
    link,
  };
}

// ------------------------------------------------------------------------------------------------
// Prüfpaket für die Referenz-Prüfung
// ------------------------------------------------------------------------------------------------

export interface PrueferAngabe {
  /** Das TATSÄCHLICHE Prüfmodell — geht in den Paketfingerabdruck ein. */
  readonly modell: string;
  /** `true`: öffentliche/externe KI. Interne Inhalte nur mit bestehender Freigabe. */
  readonly oeffentlich: boolean;
}

export interface PruefPostenFundstelle {
  readonly fundstelleId: string;
  readonly art: Fundstelle["art"];
  readonly koId: string;
  readonly koVersion: number;
  readonly auszug: string;
  readonly kontextVor: string;
  readonly kontextNach: string;
  readonly fingerabdruck: string;
  readonly wortbezug: boolean;
  readonly herkunft?: string | null;
  readonly abgerufenAm?: string;
}

export interface PruefPosten {
  readonly aussageId: string;
  readonly teilId: string;
  readonly aussage: string;
  readonly teil: string;
  readonly zustand: "pruefbar" | "unbelegt" | "nicht_pruefbar";
  readonly grund?: "keine_fundstelle" | "keine_freigabe_externe_verarbeitung";
  readonly fundstellen: readonly PruefPostenFundstelle[];
}

export interface PruefPaket {
  readonly antwortFingerabdruck: string;
  readonly belegFingerabdruck: string;
  readonly pruefer: PrueferAngabe;
  readonly posten: readonly PruefPosten[];
  /** Bindet Antwort, Aussagen, Quellenversionen, Auszüge UND Prüfmodell. */
  readonly paketFingerabdruck: string;
}

function postenZeile(p: PruefPosten): string {
  const stellen = p.fundstellen.map((f) => `${f.fundstelleId}@${f.koVersion}:${f.fingerabdruck}`);
  return `${p.teilId}|${p.zustand}|${stellen.join(",")}`;
}

/**
 * Baut die Eingabe der Referenz-Prüfung — und versendet NICHTS.
 *
 * Nur aufgelöste Auszüge gehen hinein; Modellangaben (Links, unauflösbare Marken) nie. Für eine
 * öffentliche Prüf-KI zählt bei jeder internen Fundstelle die bestehende Freigabe für externe
 * Verarbeitung (`externeVerarbeitungErlaubt`, vom Aufrufer aus der geltenden Regel); fehlt sie,
 * wird der Posten sichtbar `nicht_pruefbar` und trägt KEINEN Inhalt dieser Quelle.
 */
export function pruefPaket(
  beleg: AussagenBeleg,
  pruefer: PrueferAngabe,
  externeVerarbeitungErlaubt: (koId: string) => boolean,
): PruefPaket {
  const posten: PruefPosten[] = [];
  for (const a of beleg.aussagen) {
    for (const t of a.teile) {
      const basis = { aussageId: a.aussageId, teilId: t.teilId, aussage: a.text, teil: t.text };
      if (t.fundstellen.length === 0) {
        posten.push({ ...basis, zustand: "unbelegt", grund: "keine_fundstelle", fundstellen: [] });
        continue;
      }
      const erlaubt = t.fundstellen.filter(
        (f) => !pruefer.oeffentlich || externeVerarbeitungErlaubt(f.koId),
      );
      if (erlaubt.length === 0) {
        posten.push({
          ...basis,
          zustand: "nicht_pruefbar",
          grund: "keine_freigabe_externe_verarbeitung",
          fundstellen: [],
        });
        continue;
      }
      posten.push({
        ...basis,
        zustand: "pruefbar",
        fundstellen: erlaubt.map((f) => ({
          fundstelleId: f.fundstelleId,
          art: f.art,
          koId: f.koId,
          koVersion: f.koVersion,
          auszug: f.auszug,
          kontextVor: f.kontextVor,
          kontextNach: f.kontextNach,
          fingerabdruck: f.fingerabdruck,
          wortbezug: f.wortbezug,
          ...(f.art === "extern" ? { herkunft: f.herkunft, abgerufenAm: f.abgerufenAm } : {}),
        })),
      });
    }
  }
  const material = [
    `beleg=${beleg.belegFingerabdruck}`,
    `antwort=${beleg.antwortFingerabdruck}`,
    `modell=${pruefer.modell}`,
    `oeffentlich=${pruefer.oeffentlich}`,
    ...posten.map(postenZeile),
  ];
  return {
    antwortFingerabdruck: beleg.antwortFingerabdruck,
    belegFingerabdruck: beleg.belegFingerabdruck,
    pruefer,
    posten,
    paketFingerabdruck: fingerabdruck(material.join("\n")),
  };
}

/**
 * Gilt eine frühere Bestätigung für DIESES Paket? Nur bei identischem Paketfingerabdruck und
 * identischem Prüfmodell. Ein anderer Antworttext, eine geänderte Quelle oder ein anderes Modell
 * erben nichts.
 */
export function bestaetigungGilt(
  bestaetigung: { readonly paketFingerabdruck: string; readonly modell: string },
  paket: PruefPaket,
): boolean {
  return (
    bestaetigung.paketFingerabdruck === paket.paketFingerabdruck &&
    bestaetigung.modell === paket.pruefer.modell
  );
}
