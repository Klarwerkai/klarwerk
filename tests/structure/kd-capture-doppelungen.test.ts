// ================================================================================================
// JOB 2445 · D1 — DIE KLASSE HINTER DEM EINZELFALL: gedoppelte Bloecke in den zwei grossen Seiten.
// JOB 2454 · D1 — und die geduldete Abweichung bekommt einen NAMEN, einen GRUND und einen WORTLAUT.
// JOB 2467 · D1 — EIN Vokabular fuer Erhebung und Meldung; jedes Paar mit einem Satz; die Grenze
//                 als geprueftes Verhalten (K3) statt als Behauptung.
// ================================================================================================
//
// HERKUNFT. `apps/web/src/pages/KnowledgeDetail.tsx` und `apps/web/src/pages/Capture.tsx` sind
// heute VIERMAL als Paar aufgefallen: PRO6 musste in JOB 2419 und 2426 in beiden dieselbe
// TV1-Einbindung nachziehen, PRO3 in 2428 und 2433 dieselbe Zuordnung. Vier Durchgaenge, zwei
// Bahnen, dieselben zwei Dateien — das ist keine Haeufung mehr, sondern eine Struktur.
//
// JOB 2433 hat den EINZELFALL gesichert (das Anhaengen-Tor). Dieser Fall sichert die KLASSE.
//
// ------------------------------------------------------------------------------------------------
// WIE GEMESSEN WIRD — ueber den Syntaxbaum, nicht ueber Text
// ------------------------------------------------------------------------------------------------
//
// BASIC4 hat in JOB 2423 belegt, dass eine Textsuche zu viel findet. Deshalb bekommt jeder Knoten
// ZWEI Fingerabdruecke, beide von unten nach oben gebaut:
//
//   SKELETT  nur die Knotenarten            — „gleich gebaut"
//   INHALT   Knotenarten PLUS Zeichenketten, JSX-Attributnamen, Eigenschaftsnamen
//                                            — „gleich gebaut UND gleich gefuellt"
//
// LOKALE BEZEICHNERNAMEN STEHEN IN KEINEM VON BEIDEN, und das ist der Kern. In JOB 2433 war der
// einzige Unterschied zwischen den zwei Flaechen, dass die eine `extAttachAllowed` schreibt und
// die andere `canAttachExternalResult(stage)` — verschieden geschrieben, gleich entschieden. Ein
// Fingerabdruck, der Namen mitzaehlt, haette dieses Paar nicht gefunden; ein Textvergleich haette
// es als Abweichung gemeldet, wo keine ist.
//
// ------------------------------------------------------------------------------------------------
// WAS DIESER FALL HAELT — und warum eine Zahl hier die richtige Zusicherung ist
// ------------------------------------------------------------------------------------------------
//
//   Aendert jemand EINE Seite eines gedoppelten Blocks  -> das Paar zerfaellt, die Zahl SINKT  -> rot
//   Aendert jemand BEIDE Seiten gleich                  -> das Paar bleibt, die Zahl haelt     -> gruen
//   Kommt eine NEUE Doppelung dazu                      -> die Zahl STEIGT                     -> rot
//
// Die dritte Zeile ist kein Nebeneffekt, sondern gewollt: Eine neue Doppelung soll eingetragen
// werden, bevor sie lebt — sonst waechst die Klasse still weiter, und genau das ist viermal
// passiert, ohne dass es jemand gemeldet haette.
//
// Warum keine Liste einzelner Anker: Von den dreizehn Paaren tragen fuenf ueberhaupt keine
// sprechende Zeichenkette (`ArrowFunction`, `JsxSelfClosingElement` ohne Text). Ein Register aus
// Ankern waere fuer sie geraten. Die Zahl ist ehrlicher — und die Fehlermeldung druckt die
// vollstaendige aktuelle Liste, damit ein roter Lauf sofort sagt, WELCHES Paar fehlt.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const LINKS = "apps/web/src/pages/KnowledgeDetail.tsx";
const RECHTS = "apps/web/src/pages/Capture.tsx";

/** Untergrenze in Knoten. Darunter ist ein Treffer Trivia — `<p>{x}</p>` hat rund zehn. */
const MIN_KNOTEN = 25;

/**
 * DIE GEDULDETEN ABWEICHUNGEN — namentlich, mit Grund, und mit dem WORTLAUT ihrer Unterschiede.
 *
 * JOB 2454 hat hier eine blinde Stelle geschlossen. Bis dahin stand an dieser Stelle die blosse
 * Zahl `ERWARTET_ABWEICHEND = 1`. Die Probe hat sie widerlegt:
 *
 *   Aendert jemand das GEDULDETE Paar auf EINER Seite weiter — im Versuch war es
 *   `text-[12.5px]` -> `text-[13px]` allein in `Capture` —, dann bleibt das Paar abweichend,
 *   die Zahl bleibt 1, das Paar taucht in keiner GLEICH-Liste auf, und G1 wie G2 blieben GRUEN.
 *   Gemessen am 26.08. im Klon `kw-pro3-job2454-d1`: `Tests 4 passed (4)` MIT der Mutation.
 *
 * Eine geduldete Ausnahme, die nur gezaehlt wird, ist also eine offene Tuer: Genau in dem einen
 * Block, von dem alle wissen, dass er abweichen DARF, darf er ab dann beliebig weiter abweichen.
 *
 * Deshalb wird nicht die Zahl gepinnt, sondern WORIN abgewichen werden darf: die Zeichenketten,
 * die nur auf einer Seite vorkommen. Kommt eine dritte Abweichung dazu, passt der Wortlaut nicht
 * mehr und der Fall wird rot — mit der Angabe, welche Zeichenkette neu ist.
 *
 * WARUM DIESE AUSNAHME BERECHTIGT IST — belegt, nicht gelesen (JOB 2454 §5.1):
 *   `git show ef69607 -- <beide Dateien>` zeigt den Geburts-Commit des Blocks (SCRUM-344,
 *   30.06. 08:28). Er hat BEIDE Seiten im selben Zug angelegt, je 21 Zeilen, und BEIDE
 *   Unterschiede standen schon in diesem ersten Stand:
 *       + const conf = studioSaveConfidence("revision");   (KnowledgeDetail)
 *       + const conf = studioSaveConfidence("capture");    (Capture)
 *       + <div className="rounded-card border …">          (KnowledgeDetail)
 *       + <div className="mb-2 rounded-card border …">     (Capture)
 *   Es ist also KEINE Drift: keine Seite ist die neuere, keiner Seite fehlt ein Nachzug. Der
 *   Block wurde von Anfang an unterschiedlich geschrieben — der Modus MUSS sich unterscheiden,
 *   das `mb-2` ist Abstand an einer Stelle, wo darunter noch der Beitragswert-Absatz folgt.
 */
interface Ausnahme {
  /** Woran das Paar zu erkennen ist — nur fuer die Fehlermeldung, nicht fuer die Zuordnung. */
  readonly name: string;
  /** Warum es abweichen DARF. Ohne Grund keine Ausnahme. */
  readonly grund: string;
  /** Zeichenketten, die es nur in `KnowledgeDetail.tsx` gibt. */
  readonly nurLinks: readonly string[];
  /** Zeichenketten, die es nur in `Capture.tsx` gibt. */
  readonly nurRechts: readonly string[];
}

const AUSNAHMEN: readonly Ausnahme[] = [
  {
    name: "SCRUM-344 · Save-Confidence nach Studio-Apply",
    grund:
      "Von Geburt an unterschiedlich (Commit ef69607, 30.06.), beide Seiten im selben Zug " +
      "angelegt. Der Modus MUSS sich unterscheiden; das `mb-2` ist Abstand zum Absatz darunter.",
    // JOB 2467: im Vokabular von `merkmal()` notiert. Gemessen, nicht abgeschrieben — mit dem
    // vollen Vokabular sind es HEUTE dieselben zwei Unterschiede wie mit dem engen. Der Waechter
    // gewinnt also Empfindlichkeit, ohne lauter zu werden.
    nurLinks: [
      '"revision"',
      '"rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-2.5"',
    ],
    nurRechts: [
      '"capture"',
      '"mb-2 rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-2.5"',
    ],
  },
];

/**
 * Nicht die ZAHL der Paare, sondern ihre GROESSEN — und warum das der Unterschied ist.
 *
 * Die erste Fassung dieses Falls pinnte die blosse Zahl 13. Die Gegenprobe hat sie widerlegt:
 * Aendert man EINE Seite des 42-Knoten-Paars bei `KnowledgeDetail:1193`, zerfaellt es — aber ein
 * KIND davon (28 Knoten, `:1194`) rueckt als neuer maximaler Treffer nach, und die Zahl bleibt
 * 13. Ein Waechter, der nur zaehlt, haette geschwiegen.
 *
 * Die Groessenliste faengt genau das: aus `42` wird `28`, die Liste aendert sich, der Fall wird
 * rot und druckt die vollstaendige Tabelle.
 *
 * DIE GRENZE, offen gesagt: Aendert jemand BEIDE Seiten gleich UND aendert sich dabei die Zahl
 * der Knoten, wird dieser Fall ebenfalls rot, obwohl die Doppelung im Gleichlauf geblieben ist.
 * Dann ist die Liste nachzufuehren — wie beim Klara-Inventar. Das ist der Preis dafuer, den
 * Fall gegen den Kind-rueckt-nach-Effekt dicht zu bekommen, und er ist mir das wert: ein
 * uebersehener einseitiger Eingriff kostet mehr als ein Nachtrag.
 */
interface Blockpaar {
  /** Knotenzahl der linken Seite — die Groesse, nach der sortiert wird. */
  readonly knoten: number;
  /** Die Knotenart. Aendert sich nur, wenn der Block ein anderer wird. */
  readonly art: string;
  /** WAS dieser Block ist — ein Satz, damit ein roter Lauf ohne Nachschlagen lesbar ist. */
  readonly was: string;
}

/**
 * DIE ZWOELF GEDOPPELTEN BLOECKE — was der Waechter bewacht, Paar fuer Paar (JOB 2467 §5.1).
 *
 * ES WAREN DREIZEHN, UND DAS WAR FALSCH. Bis JOB 2467 kannte der Fingerabdruck den festen Text
 * einer Vorlage mit Platzhalter nicht (`ktype.${k}` gegen `conf.level.${lvl}` gegen
 * `con.type.${ct}` waren fuer ihn dasselbe). Das hatte drei Folgen, alle gemessen:
 *   - `KnowledgeDetail:1129` (Vertraulichkeitsstufen) hing an `Capture:4750` (Wissensarten),
 *   - `KnowledgeDetail:1568` (Konflikttypen) hing ebenfalls dort, obwohl `Capture` gar keine
 *     Konflikttyp-Auswahl hat — ein PHANTOMPAAR,
 *   - `KnowledgeDetail:1324` (Wissensarten) war das einzige der drei mit dem richtigen Partner.
 * Mit dem vollen Vokabular loesen sich die drei richtig auf: 1129 -> 4824, 1324 -> 4750, und
 * 1568 faellt heraus, weil es sein Gegenstueck nie gab.
 *
 * Gepinnt werden Groesse UND Knotenart, nicht die Zeilennummern: Zeilen verschieben sich bei
 * jeder Einfuegung darueber, und ein Waechter, der bei fremder Arbeit rot wird, stirbt (I44).
 * Die Zeilen stehen in der Fehlermeldung, wo sie hingehoeren.
 */
const PAARE: readonly Blockpaar[] = [
  {
    knoten: 91,
    art: "JsxElement",
    was: "Die Trefferzeile der externen Recherche: Titel der Quelle und die Knopfreihe daneben.",
  },
  {
    knoten: 42,
    art: "JsxElement",
    was: "Das Titelfeld des Formulars — `Field` mit `capture.fTitle` und dem `TextInput` darin.",
  },
  {
    knoten: 36,
    art: "JsxSelfClosingElement",
    was: "Das Aussagefeld: die mehrzeilige `textarea` an `statement`.",
  },
  {
    knoten: 35,
    art: "JsxElement",
    was: "Der Suchknopf der externen Recherche (`ext.search`), gesperrt bei leerem Feld oder laufender Suche.",
  },
  {
    knoten: 30,
    art: "JsxElement",
    was: "Der Hinweis am Quellen-Tor: `output` mit Grund und Weg aus `SOURCE_ATTACH_HINT_KEYS`.",
  },
  {
    knoten: 29,
    art: "ArrowFunction",
    was: "Die Auswahlliste der Vertraulichkeitsstufen (`CONFIDENTIALITY_LEVELS` -> `conf.level.*`).",
  },
  {
    knoten: 29,
    art: "JsxSelfClosingElement",
    was: "Der Listeneditor fuer Bedingungen (`capture.fConditions`).",
  },
  {
    knoten: 29,
    art: "JsxSelfClosingElement",
    was: "Der Listeneditor fuer Massnahmen (`capture.fMeasures`).",
  },
  {
    knoten: 29,
    art: "ArrowFunction",
    was: "Die Auswahlliste der Wissensarten (`KNOWLEDGE_TYPES` -> `ktype.*`).",
  },
  {
    knoten: 27,
    art: "FirstStatement",
    was: "Der Zustand der Bildbeschreibungs-Bitte: `captionRequest` mit Bild, Stelle und Zaehler.",
  },
  {
    knoten: 25,
    art: "ArrowFunction",
    was: "Der Ausloeser derselben Bitte — setzt den Zustand und zaehlt den Zaehler hoch.",
  },
  {
    knoten: 25,
    art: "ArrowFunction",
    was: "Das Absenden der externen Suche: `onSubmit` prueft auf leer und ruft `extSearch.mutate`.",
  },
];

interface Erhebung {
  datei: string;
  quelle: ts.SourceFile;
  skel: Map<ts.Node, string>;
  inh: Map<ts.Node, string>;
  groesse: Map<ts.Node, number>;
  eltern: Map<ts.Node, ts.Node | null>;
  knoten: ts.Node[];
}

function kurz(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 16);
}

/**
 * DAS VOKABULAR — die einzige Stelle, an der steht, WAS an einem Knoten inhaltlich zaehlt.
 *
 * JOB 2467 hat sie geschaffen, weil vorher ZWEI Vokabulare nebeneinander liefen: der
 * Fingerabdruck kannte vier Merkmale, die Differenzmeldung nur eines (Zeichenketten). Beide
 * Luecken sind gemessen, nicht vermutet:
 *
 *   (a) `conf.titleKey` -> `conf.hintKey` allein in `Capture`, mitten im geduldeten Paar:
 *       Der Fingerabdruck sah es, die gepinnte Differenzmenge nicht — G1 und G2 blieben GRUEN,
 *       obwohl die Capture-Flaeche den Hinweistext an der Titelstelle gezeigt haette.
 *
 *   (b) `conf.level.${lvl}` -> `conf.levelGEAENDERT.${lvl}` allein in `KnowledgeDetail`:
 *       Der feste Text einer Vorlage MIT Platzhalter stand in gar keinem Vokabular. Die
 *       Groessenliste blieb zeichengleich, alles gruen — ein einseitig geaenderter
 *       Uebersetzungsschluessel war vollstaendig unsichtbar.
 *
 * (b) ist dieselbe Fehlerklasse, die `OFFEN.md` unter I44 am Rechtsseiten-Waechter benennt: nur
 * `ts.isStringLiteral` statt `isStringLiteralLike`. Hier eine Stufe weiter — ohne Platzhalter
 * (`NoSubstitutionTemplateLiteral`) war gedeckt, mit Platzhalter (`TemplateHead/Middle/Tail`)
 * nicht.
 *
 * Der Preis dafuer, es zu schliessen, ist gemessen und in `PAARE` dokumentiert: Aus dreizehn
 * Paaren werden ZWOELF. Eines war ein Phantom, zwei hingen am falschen Partner.
 *
 * Lokale Bezeichnernamen stehen weiterhin in KEINEM Vokabular — das ist keine Luecke, sondern
 * der Kern (siehe Kopf dieser Datei, `edit` gegen `draft`).
 */
function merkmal(n: ts.Node): string | null {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
    return `"${n.text}"`;
  }
  if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
    return `\`${n.text}\``;
  }
  if (ts.isJsxAttribute(n)) {
    return `@${n.name.getText()}`;
  }
  if (ts.isPropertyAccessExpression(n)) {
    return `.${n.name.getText()}`;
  }
  if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
    return `<${n.tagName.getText()}`;
  }
  return null;
}

/** Dieselben Merkmale, aber als lesbare Menge — fuer die Differenzmeldung von G2. */
function merkmale(n: ts.Node): Set<string> {
  const menge = new Set<string>();
  const gehe = (k: ts.Node): void => {
    const m = merkmal(k);
    if (m !== null && m.trim().length > 3) {
      menge.add(m);
    }
    ts.forEachChild(k, gehe);
  };
  gehe(n);
  return menge;
}

/** Die Arten, die als eigenstaendiger Block gelten — nicht jeder Ausdruck ist eine Doppelung. */
function istBlock(k: ts.Node): boolean {
  return (
    ts.isJsxElement(k) ||
    ts.isJsxSelfClosingElement(k) ||
    ts.isJsxFragment(k) ||
    ts.isBlock(k) ||
    ts.isVariableStatement(k) ||
    ts.isIfStatement(k) ||
    ts.isFunctionDeclaration(k) ||
    ts.isArrowFunction(k)
  );
}

function erhebe(datei: string): Erhebung {
  const pfad = join(WURZEL, datei);
  return erhebeQuelle(datei, readFileSync(pfad, "utf8"));
}

/**
 * Der Kern der Erhebung, losgeloest von der Datei — damit K3 die GRENZE an gebauten Quellen
 * messen kann, statt sie zu behaupten (JOB 2467 §5.3).
 */
function erhebeQuelle(datei: string, text: string): Erhebung {
  const quelle = ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true);
  const skel = new Map<ts.Node, string>();
  const inh = new Map<ts.Node, string>();
  const groesse = new Map<ts.Node, number>();
  const eltern = new Map<ts.Node, ts.Node | null>();
  const knoten: ts.Node[] = [];

  const gehe = (n: ts.Node, elter: ts.Node | null): void => {
    eltern.set(n, elter);
    const kinder: ts.Node[] = [];
    ts.forEachChild(n, (c) => {
      kinder.push(c);
      gehe(c, n);
    });

    const art = ts.SyntaxKind[n.kind];
    const eigenes = merkmal(n);
    const inhaltMarke = eigenes === null ? art : `${art}${eigenes}`;

    skel.set(n, kurz(`${art}(${kinder.map((k) => skel.get(k)).join(",")})`));
    inh.set(n, kurz(`${inhaltMarke}(${kinder.map((k) => inh.get(k)).join(",")})`));
    groesse.set(n, 1 + kinder.reduce((a, k) => a + (groesse.get(k) ?? 0), 0));
    knoten.push(n);
  };
  gehe(quelle, null);

  return { datei, quelle, skel, inh, groesse, eltern, knoten };
}

/** Alle nennenswerten Zeichenketten unterhalb eines Knotens. */
function zeichenketten(n: ts.Node): Set<string> {
  const menge = new Set<string>();
  const gehe = (k: ts.Node): void => {
    if (
      (ts.isStringLiteral(k) || ts.isNoSubstitutionTemplateLiteral(k)) &&
      k.text.trim().length > 2
    ) {
      menge.add(k.text);
    }
    ts.forEachChild(k, gehe);
  };
  gehe(n);
  return menge;
}

function zeile(e: Erhebung, n: ts.Node): number {
  return e.quelle.getLineAndCharacterOfPosition(n.getStart(e.quelle)).line + 1;
}

interface Paar {
  links: ts.Node;
  rechts: ts.Node;
  gemeinsam?: string[];
  /** Nur bei abweichenden Paaren: die Zeichenketten, die es nur auf EINER Seite gibt (JOB 2454). */
  nurLinks?: string[];
  nurRechts?: string[];
}

/** Nur maximale Treffer — liegt ein Elter schon im Treffersatz, ist das Kind kein eigener Fund. */
function maximal(paare: Paar[], e: Erhebung): Paar[] {
  const menge = new Set(paare.map((p) => p.links));
  return paare.filter((p) => {
    let lauf = e.eltern.get(p.links) ?? null;
    while (lauf) {
      if (menge.has(lauf)) {
        return false;
      }
      lauf = e.eltern.get(lauf) ?? null;
    }
    return true;
  });
}

function messe(): { a: Erhebung; b: Erhebung; gleich: Paar[]; abweichend: Paar[] } {
  const a = erhebe(LINKS);
  const b = erhebe(RECHTS);
  return { a, b, ...paare(a, b) };
}

/** Die Paarbildung selbst — von `messe` (echte Dateien) und von K3 (gebaute Quellen) benutzt. */
function paare(a: Erhebung, b: Erhebung): { gleich: Paar[]; abweichend: Paar[] } {
  const kandidaten = (e: Erhebung): ts.Node[] =>
    e.knoten.filter((n) => istBlock(n) && (e.groesse.get(n) ?? 0) >= MIN_KNOTEN);
  const ka = kandidaten(a);
  const kb = kandidaten(b);

  const inhB = new Map<string, ts.Node[]>();
  for (const n of kb) {
    const h = b.inh.get(n) as string;
    if (!inhB.has(h)) {
      inhB.set(h, []);
    }
    (inhB.get(h) as ts.Node[]).push(n);
  }

  const gleichRoh: Paar[] = [];
  for (const n of ka) {
    const partner = inhB.get(a.inh.get(n) as string);
    if (partner && partner.length > 0) {
      gleichRoh.push({ links: n, rechts: partner[0] as ts.Node });
    }
  }
  const gleich = maximal(gleichRoh, a).sort(
    (x, y) => (a.groesse.get(y.links) ?? 0) - (a.groesse.get(x.links) ?? 0),
  );

  const skelB = new Map<string, ts.Node[]>();
  for (const n of kb) {
    const h = b.skel.get(n) as string;
    if (!skelB.has(h)) {
      skelB.set(h, []);
    }
    (skelB.get(h) as ts.Node[]).push(n);
  }

  const gleichLinks = new Set(gleich.map((p) => p.links));
  const abweichendRoh: Paar[] = [];
  for (const n of ka) {
    if (gleichLinks.has(n)) {
      continue;
    }
    const partner = skelB.get(a.skel.get(n) as string);
    if (!partner) {
      continue;
    }
    const litsA = zeichenketten(n);
    if (litsA.size === 0) {
      continue;
    }
    for (const m of partner) {
      if (a.inh.get(n) === b.inh.get(m)) {
        continue;
      }
      const litsB = zeichenketten(m);
      const gemeinsam = [...litsA].filter((s) => litsB.has(s));
      if (gemeinsam.length === 0) {
        continue;
      }
      // JOB 2454: WORIN sie abweichen, nicht nur DASS sie abweichen.
      // JOB 2467: und zwar im VOLLEN Vokabular des Fingerabdrucks, nicht nur in Zeichenketten.
      const merkA = merkmale(n);
      const merkB = merkmale(m);
      abweichendRoh.push({
        links: n,
        rechts: m,
        gemeinsam,
        nurLinks: [...merkA].filter((s) => !merkB.has(s)).sort(),
        nurRechts: [...merkB].filter((s) => !merkA.has(s)).sort(),
      });
      break;
    }
  }
  const abweichend = maximal(abweichendRoh, a).sort(
    (x, y) => (a.groesse.get(y.links) ?? 0) - (a.groesse.get(x.links) ?? 0),
  );

  return { gleich, abweichend };
}

function liste(a: Erhebung, b: Erhebung, gefunden: Paar[]): string {
  return gefunden
    .map(
      (p) =>
        `${String(a.groesse.get(p.links)).padStart(4)} Knoten · KnowledgeDetail:${zeile(a, p.links)} · Capture:${zeile(b, p.rechts)} · ${ts.SyntaxKind[p.links.kind]}`,
    )
    .join("\n");
}

describe("JOB 2445 · gedoppelte Bloecke in KnowledgeDetail und Capture", () => {
  it("K1 · KALIBRIERUNG: die Erhebung liest beide Dateien wirklich", () => {
    // Ohne diesen Fall waeren G1 und G2 auch dann gruen, wenn die Erhebung nichts faende — dann
    // waeren beide Zahlen null und die Zusicherung eine Behauptung ueber ein leeres Blatt.
    const a = erhebe(LINKS);
    const b = erhebe(RECHTS);
    expect(a.knoten.length, `${LINKS} wurde nicht gelesen`).toBeGreaterThan(5000);
    expect(b.knoten.length, `${RECHTS} wurde nicht gelesen`).toBeGreaterThan(5000);
  });

  it("K2 · KALIBRIERUNG: die Fingerabdruecke unterscheiden Bau und Inhalt wirklich", () => {
    // Zwei Bloecke mit gleichem Bau und verschiedenem Text muessen im SKELETT gleich und im
    // INHALT verschieden sein. Faellt das zusammen, misst die ganze Trennung nichts.
    const machen = (text: string): ts.SourceFile =>
      ts.createSourceFile("x.tsx", text, ts.ScriptTarget.Latest, true);
    const eins = machen('const a = <p className="x">{t("eins")}</p>;');
    const zwei = machen('const a = <p className="x">{t("zwei")}</p>;');
    const fa = erhebeAus(eins);
    const fb = erhebeAus(zwei);
    expect(fa.skel, "gleicher Bau wird als verschieden gelesen").toBe(fb.skel);
    expect(fa.inh, "verschiedener Text wird als gleich gelesen").not.toBe(fb.inh);
  });

  it("K3 · DIE GRENZE: was dieser Waechter NICHT faengt, faengt er nachweislich nicht", () => {
    // JOB 2467 §5.3. Wer die Grenze kennt, verlaesst sich richtig — deshalb steht sie hier als
    // geprueftes Verhalten und nicht als Kommentar, den niemand nachrechnet. Verschiebt jemand
    // die Grenze (breiteres Vokabular, andere Untergrenze, mehr Knotenarten), wird dieser Fall
    // rot und zwingt dazu, die Beschreibung mitzufuehren.
    const block = (schluessel: string): string => `
      const x = (
        <div className="wrap">
          <Field label={t("${schluessel}")}>
            <TextInput value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          </Field>
          <p className="hint">{t("${schluessel}.hint")}</p>
        </div>
      );`;

    // (0) KALIBRIERUNG: zwei zeichengleiche Bloecke MUESSEN gefunden werden. Ohne diese Zeile
    //     waeren die drei Null-Erwartungen unten auch dann gruen, wenn die Messung nichts kann.
    const eins = erhebeQuelle("l.tsx", block("a.title"));
    const zwei = erhebeQuelle("r.tsx", block("a.title"));
    expect(paare(eins, zwei).gleich.length, "Die Messung findet nicht einmal eine Kopie").toBe(1);

    // (1) UMFORMULIERT STATT KOPIERT wird NICHT gefunden. Derselbe Zweck, anderer Bau —
    //     dieser Waechter sucht gedoppelte STRUKTUR, nicht gedoppelte Absicht.
    const umformuliert = erhebeQuelle(
      "r.tsx",
      `
      const x = (
        <div className="wrap">
          {renderFeld({ label: t("a.title"), wert: edit.title, setzen: (v) => setEdit({ ...edit, title: v }) })}
          <p className="hint">{t("a.title.hint")}</p>
        </div>
      );`,
    );
    expect(
      paare(eins, umformuliert).gleich.length,
      "Umformulierte Bloecke werden jetzt gefunden — die Grenze hat sich verschoben, `PAARE` pruefen",
    ).toBe(0);

    // (2) UNTER DER UNTERGRENZE wird NICHT gefunden. `MIN_KNOTEN` ist eine Wahl, keine Wahrheit:
    //     Sie haelt Trivia wie `<p>{x}</p>` heraus und uebersieht dafuer kleine Doppelungen.
    const klein = "const x = <p className=\"hint\">{t('a.title')}</p>;";
    const kleinA = erhebeQuelle("l.tsx", klein);
    const kleinB = erhebeQuelle("r.tsx", klein);
    expect(
      paare(kleinA, kleinB).gleich.length,
      `Ein Block unter ${MIN_KNOTEN} Knoten wird jetzt gefunden — die Untergrenze wirkt nicht mehr`,
    ).toBe(0);

    // (3) NUR DIESE ZWEI DATEIEN. Eine Doppelung zwischen `Capture.tsx` und einer DRITTEN Datei
    //     ist fuer diesen Waechter unsichtbar — er liest genau zwei Wege und sonst keinen.
    expect([LINKS, RECHTS], "Die Grundmenge ist nicht mehr genau diese zwei Dateien").toEqual([
      "apps/web/src/pages/KnowledgeDetail.tsx",
      "apps/web/src/pages/Capture.tsx",
    ]);
  });

  it("G1 · DIE KLASSE: die zwoelf gedoppelten Bloecke stehen unveraendert", () => {
    const { a, b, gleich } = messe();
    const gemessen = gleich.map((p) => ({
      knoten: a.groesse.get(p.links) ?? 0,
      art: ts.SyntaxKind[p.links.kind],
    }));
    const erwartet = PAARE.map((p) => ({ knoten: p.knoten, art: p.art }));

    // Schrumpft ein Eintrag, wurde EINE Seite geaendert und die andere vergessen — dann traegt
    // nur noch ein kleinerer Teilblock die Doppelung. Faellt einer weg oder kommt einer dazu,
    // hat sich die Klasse selbst veraendert und gehoert eingetragen, bevor sie lebt.
    const meldung = [
      "Die gedoppelten Bloecke haben sich veraendert.",
      "",
      "ERWARTET (Register `PAARE` in dieser Datei):",
      ...PAARE.map((p) => `  ${String(p.knoten).padStart(3)} ${p.art.padEnd(23)} ${p.was}`),
      "",
      `GEMESSEN (${gleich.length} Paare):`,
      liste(a, b, gleich),
      "",
      "Fehlt ein Paar, wurde eine Seite geaendert und die andere vergessen — nachziehen.",
      "Kam eines dazu, gehoert es mit einem Satz in `PAARE`, bevor es lebt.",
    ].join("\n");
    expect(gemessen, meldung).toEqual(erwartet);
  });

  it("G2 · DIE AUSNAHME: das abweichende Paar weicht GENAU so ab wie geprueft", () => {
    const { a, b, abweichend } = messe();

    // Nicht die ZAHL der abweichenden Paare, sondern der WORTLAUT ihrer Unterschiede (JOB 2454).
    //
    // Ein ZWEITES abweichendes Paar ist der Fund, den JOB 2454 §5 sucht: gleicher Bau, anderer
    // Inhalt, gemeinsame Textbausteine — also EINE Seite geaendert. Es hat keinen Eintrag im
    // Register und wird rot.
    //
    // Ebenso rot wird eine DRITTE Abweichung im geduldeten Paar. Genau die ging der Zahlfassung
    // durch — siehe die Begruendung an `AUSNAHMEN` oben.
    const gemessen = abweichend.map((p) => ({
      nurLinks: p.nurLinks ?? [],
      nurRechts: p.nurRechts ?? [],
    }));
    const erwartet = AUSNAHMEN.map((x) => ({
      nurLinks: [...x.nurLinks].sort(),
      nurRechts: [...x.nurRechts].sort(),
    }));

    const meldung = [
      "Die Abweichungen zwischen den beiden Seiten sind nicht mehr die geprueften.",
      "",
      "GEDULDET (Register `AUSNAHMEN` in dieser Datei):",
      ...AUSNAHMEN.map((x) => `  ${x.name}\n    Grund: ${x.grund}`),
      "",
      `GEMESSEN (${abweichend.length} abweichende Paare):`,
      liste(a, b, abweichend),
      ...abweichend.map(
        (p) =>
          `  KnowledgeDetail:${zeile(a, p.links)} · Capture:${zeile(b, p.rechts)}\n` +
          `    nur links:  ${JSON.stringify(p.nurLinks)}\n` +
          `    nur rechts: ${JSON.stringify(p.nurRechts)}`,
      ),
      "",
      "Kam eine Abweichung DAZU: eine Seite wurde geaendert und die andere vergessen — nachziehen.",
      "Ist sie GEWOLLT: einen Eintrag in `AUSNAHMEN` aufnehmen, MIT Grund. Ohne Grund keine Ausnahme.",
    ].join("\n");

    expect(gemessen, meldung).toEqual(erwartet);
  });
});

/** Fingerabdruecke fuer einen einzelnen, frisch gebauten Baum — nur fuer die Kalibrierung K2. */
function erhebeAus(sf: ts.SourceFile): { skel: string; inh: string } {
  const skel = new Map<ts.Node, string>();
  const inh = new Map<ts.Node, string>();
  const gehe = (n: ts.Node): void => {
    const kinder: ts.Node[] = [];
    ts.forEachChild(n, (c) => {
      kinder.push(c);
      gehe(c);
    });
    const art = ts.SyntaxKind[n.kind];
    let marke: string = art;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      marke += `"${n.text}"`;
    }
    skel.set(n, kurz(`${art}(${kinder.map((k) => skel.get(k)).join(",")})`));
    inh.set(n, kurz(`${marke}(${kinder.map((k) => inh.get(k)).join(",")})`));
  };
  gehe(sf);
  return { skel: skel.get(sf) as string, inh: inh.get(sf) as string };
}
