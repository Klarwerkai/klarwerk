// ================================================================================================
// DIE ERHEBUNG GEDOPPELTER BLOECKE — gemeinsam benutzt von den Gleichlauf-Waechtern.
// ================================================================================================
//
// HERKUNFT. Gewachsen in JOB 2433 (Einzelfall), 2445 (Klasse), 2454 (Driftpruefung), 2467
// (Vokabular, Grenze). Bis dahin lag sie in `kd-capture-doppelungen.test.ts`.
//
// WARUM SIE JETZT HIER LIEGT (JOB 2476). Dieser Durchgang stellt einen ZWEITEN Waechter daneben:
// die zwei grossen Seiten gegen DRITTE Dateien. Beide brauchen dieselbe Messung. Sie zweimal zu
// schreiben waere ausgerechnet an dieser Stelle absurd — ein Waechter gegen gedoppelte Bloecke,
// dessen eigene Erhebung gedoppelt ist. Und es waere gefaehrlich: driften die zwei Fassungen
// auseinander, messen die zwei Waechter Verschiedenes und niemand merkt es.
//
// ------------------------------------------------------------------------------------------------
// WIE GEMESSEN WIRD — ueber den Syntaxbaum, nicht ueber Text
// ------------------------------------------------------------------------------------------------
//
// BASIC4 hat in JOB 2423 belegt, dass eine Textsuche zu viel findet. Deshalb bekommt jeder Knoten
// einen Fingerabdruck, von unten nach oben gebaut, aus Knotenart PLUS den Merkmalen aus
// `merkmal()`. LOKALE BEZEICHNERNAMEN STEHEN NICHT DARIN, und das ist der Kern: In JOB 2433 war
// der einzige Unterschied zwischen zwei Flaechen, dass die eine `extAttachAllowed` schreibt und
// die andere `canAttachExternalResult(stage)` — verschieden geschrieben, gleich entschieden.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";

/** Untergrenze in Knoten. Darunter ist ein Treffer Trivia — `<p>{x}</p>` hat rund zehn. */
export const MIN_KNOTEN = 25;

export interface Erhebung {
  datei: string;
  quelle: ts.SourceFile;
  skel: Map<ts.Node, string>;
  inh: Map<ts.Node, string>;
  groesse: Map<ts.Node, number>;
  eltern: Map<ts.Node, ts.Node | null>;
  knoten: ts.Node[];
}

export interface Paar {
  links: ts.Node;
  rechts: ts.Node;
  gemeinsam?: string[];
  /** Nur bei abweichenden Paaren: die Merkmale, die es nur auf EINER Seite gibt. */
  nurLinks?: string[];
  nurRechts?: string[];
}

function kurz(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 16);
}

/**
 * DAS VOKABULAR — die einzige Stelle, an der steht, WAS an einem Knoten inhaltlich zaehlt.
 *
 * JOB 2467 hat sie geschaffen, weil vorher ZWEI Vokabulare nebeneinander liefen: der
 * Fingerabdruck kannte vier Merkmale, die Differenzmeldung nur eines (Zeichenketten). Beide
 * Luecken waren gemessen, nicht vermutet — und die zweite war die schwerere: der feste Text
 * einer Vorlage MIT Platzhalter stand in gar keinem Vokabular, sodass `conf.level.${lvl}` und
 * `ktype.${k}` fuer dasselbe gehalten wurden. Ein einseitig geaenderter Uebersetzungsschluessel
 * war dadurch vollstaendig unsichtbar.
 *
 * Dieselbe Fehlerklasse benennt `OFFEN.md` unter I44 am Rechtsseiten-Waechter: nur
 * `ts.isStringLiteral` statt `isStringLiteralLike`.
 */
export function merkmal(n: ts.Node): string | null {
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

/** Dieselben Merkmale, aber als lesbare Menge — fuer die Differenzmeldung. */
export function merkmale(n: ts.Node): Set<string> {
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
export function istBlock(k: ts.Node): boolean {
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

/**
 * Der Kern der Erhebung, losgeloest von der Datei — damit Grenzfaelle an gebauten Quellen messen.
 *
 * `mitSkelett` steuert den ZWEITEN Fingerabdruck. Er wird nur fuer die ABWEICHEND-Klasse
 * gebraucht (gleicher Bau, anderer Inhalt). Wer bloss GLEICH sucht, spart damit eine
 * Streuwertbildung je Knoten — beim Fremddoppelungs-Waechter sind das 660 Dateien, und der
 * Unterschied ist im Tor messbar.
 */
export function erhebeQuelle(datei: string, text: string, mitSkelett = true): Erhebung {
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

    if (mitSkelett) {
      skel.set(n, kurz(`${art}(${kinder.map((k) => skel.get(k)).join(",")})`));
    }
    inh.set(n, kurz(`${inhaltMarke}(${kinder.map((k) => inh.get(k)).join(",")})`));
    groesse.set(n, 1 + kinder.reduce((a, k) => a + (groesse.get(k) ?? 0), 0));
    knoten.push(n);
  };
  gehe(quelle, null);

  return { datei, quelle, skel, inh, groesse, eltern, knoten };
}

/** Erhebung einer Datei unterhalb der Klonwurzel. */
export function erhebeDatei(wurzel: string, datei: string, mitSkelett = true): Erhebung {
  return erhebeQuelle(datei, readFileSync(`${wurzel}/${datei}`, "utf8"), mitSkelett);
}

/** Alle nennenswerten Zeichenketten unterhalb eines Knotens. */
export function zeichenketten(n: ts.Node): Set<string> {
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

export function zeile(e: Erhebung, n: ts.Node): number {
  return e.quelle.getLineAndCharacterOfPosition(n.getStart(e.quelle)).line + 1;
}

export function kandidaten(e: Erhebung): ts.Node[] {
  return e.knoten.filter((n) => istBlock(n) && (e.groesse.get(n) ?? 0) >= MIN_KNOTEN);
}

/** Nur maximale Treffer — liegt ein Elter schon im Treffersatz, ist das Kind kein eigener Fund. */
export function maximal(gefunden: Paar[], e: Erhebung): Paar[] {
  const menge = new Set(gefunden.map((p) => p.links));
  return gefunden.filter((p) => {
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

/**
 * Die Paarbildung.
 *
 *   GLEICH      derselbe Fingerabdruck in beiden Dateien  -> eine echte Doppelung
 *   ABWEICHEND  dasselbe SKELETT, anderer Fingerabdruck, UND mindestens eine gemeinsame
 *               Zeichenkette -> hier hat jemand EINE Seite geaendert.
 *
 * Die gemeinsame Zeichenkette ist der Filter gegen BASIC4s Befund aus 2423: ohne sie waere jedes
 * `<div><p/></div>` ein Paar. Sie bleibt bewusst bei Zeichenketten — sie zu weiten wuerde die
 * Grundmenge LOCKERN statt schaerfen (I44: „ohne Grundmenge oder Schutzwirkung zu schwaechen").
 */
export function gleichPaare(a: Erhebung, b: Erhebung): Paar[] {
  const inhB = new Map<string, ts.Node[]>();
  for (const n of kandidaten(b)) {
    const h = b.inh.get(n) as string;
    if (!inhB.has(h)) {
      inhB.set(h, []);
    }
    (inhB.get(h) as ts.Node[]).push(n);
  }

  const roh: Paar[] = [];
  for (const n of kandidaten(a)) {
    const partner = inhB.get(a.inh.get(n) as string);
    if (partner && partner.length > 0) {
      roh.push({ links: n, rechts: partner[0] as ts.Node });
    }
  }
  return maximal(roh, a).sort(
    (x, y) => (a.groesse.get(y.links) ?? 0) - (a.groesse.get(x.links) ?? 0),
  );
}

export function paare(a: Erhebung, b: Erhebung): { gleich: Paar[]; abweichend: Paar[] } {
  const ka = kandidaten(a);
  const kb = kandidaten(b);
  const gleich = gleichPaare(a, b);

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
