import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// ================================================================================================
// JOB 3881 · DIE BEGRÜNDUNG DER SUCHWORTREGEL WIRD AN DIE GEBAUTE AUFRUFKETTE GEBUNDEN.
// ================================================================================================
//
// DER BEFUND, DER DIESEN WÄCHTER NÖTIG MACHTE. `services/app/src/knowledge-check.ts` begründete die
// Auswahl seiner zwölf Suchwörter mit `koCandidateScore` — einer Funktion, die das Produkt seit G27
// nicht mehr ruft (`services/knowledge-object/src/repo.ts:233-239`: „KEIN PRODUKTAUFRUFER — JOB
// 3607"). Drei Aufträge (3574, 3583, 3601) haben an genau diesem toten Zweig gearbeitet, bis JOB
// 3607 nachgemessen hat, dass er keinen Aufrufer hat. Wer der Begründung folgte, lief hinterher.
//
// WAS HIER GEMESSEN WIRD, IST KEIN TEXTVERGLEICH. Der Wächter BAUT die Aufrufkette aus dem
// Quelltext (TypeScript-AST, empfängertypbewusst) und vergleicht die im Begründungsblock genannten
// Funktionsnamen gegen diese Kette. Ein Name, den die Kette nicht kennt, ist rot — gleichgültig,
// wie plausibel der Satz klingt.
//
// DIE EINE VORRICHTUNG. Es gibt genau einen Baumgang (`gebauteKette`) und genau einen Leser des
// Begründungsblocks (`begruendung`). Alle Fälle unten benutzen sie; es entsteht kein zweiter
// Prüfweg neben `messstand.ts` (Lehren 3836 R1, 3830 R1, 3809 R1) — der Messstand misst VERHALTEN,
// dieser Wächter misst die AUSSAGE über das Verhalten.
//
// DIE GRENZE, AUSDRÜCKLICH. Der Baumgang folgt der Schnittstelle `KoSearchProjectionRepo` in ihre
// Umsetzung `InMemoryKoSearchProjectionRepo` — das ist der Zweig, den `messstand.ts` wirklich fährt.
// Der PostgreSQL-Adapter (`search-projection-repo-pg.ts`) wird NICHT gelesen; was nur dort steht,
// gilt hier nicht als belegt. Das ist dieselbe Grenze wie beim Messstand (`messstand.ts:43`) und
// bleibt als REST benannt.
//
// ================================================================================================
// JOB 3911 · WAS DIESER WÄCHTER LIEST — UND WAS ER WEITERHIN NICHT LIEST.
// ================================================================================================
//
// BEN fand an JOB 3881 zwei offene Türen (Prüfpunkt 6 seines Urteils). Beide sind zu, und die Fälle
// H1/H2 unten halten sie zu:
//   · EINE NENNUNG BRAUCHT KEINE RÜCKSTRICHE MEHR. Gelesen wird jeder Rückstrich-Ausdruck UND jeder
//     Name in Aufrufform (`name(`) — siehe `NENNUNG`. Wer „entscheidend ist koCandidateScore(x)"
//     schreibt, wird geprüft wie der, der Rückstriche setzt.
//   · EINE FUNDSTELLE MUSS AUF CODE ZEIGEN. Ein `· AUFRUF …`-Verweis gilt nur, wenn der Name im
//     ausführbaren Teil der Zeile steht — siehe `nurCode`. Angehängter Kommentar, Zeichenkettenwert
//     und Blockkommentar-Innenzeile sind kein Aufruf mehr.
//
// WAS ER NICHT PRÜFT, ausdrücklich und ohne Beschönigung:
//   · POSTGRESQL-PARITÄT. Ob der PostgreSQL-Adapter dieselbe Teilzeichenketten-Regel hat, ist hier
//     nicht gemessen (s. „DIE GRENZE" oben). Das braucht einen eigenen Integrationstest.
//   · DEN TATSÄCHLICHEN EDITORSTATUS. Was der Nutzer im Editor sieht, misst dieser Wächter nicht;
//     er liest Quelltext, keine Oberfläche. Ebenfalls eigener Schnitt.
//   · OB DER AUFRUF DER RICHTIGE IST. Ein `· AUFRUF`-Verweis belegt, dass im Zeilenbereich ein
//     Aufruf dieses NAMENS in Code steht — nicht, dass es derjenige ist, den die Kette meint.
//   · DEN `· RUMPF`-ZWEIG AM AUSFÜHRBAREN TEIL. Er prüft die Rohzeilen auf eine Deklarationsform,
//     wie seit JOB 3881; eine Deklaration in einem Kommentar bliebe dort unentdeckt.

const WURZEL = resolve(__dirname, "../..");
const KC = "services/app/src/knowledge-check.ts";
const SVC = "services/knowledge-object/src/service.ts";
const REPO = "services/knowledge-object/src/repo.ts";
const PROJ = "services/knowledge-object/src/search-projection-repo.ts";

/** Die Dateien, aus denen die Kette gebaut wird. `repo.ts` ist ABSICHTLICH dabei: nur so ist der */
/** Befund „`koCandidateScore` liegt nicht auf der Kette" gemessen und nicht bloss nicht gefunden. */
const QUELLDATEIEN = [KC, SVC, REPO, PROJ] as const;

function lesen(pfad: string): string {
  try {
    return readFileSync(resolve(WURZEL, pfad), "utf8");
  } catch {
    throw new Error(`${pfad}: Quelle nicht lesbar; gelesener Ausschnitt: <keiner>`);
  }
}

function ast(text: string, pfad: string): ts.SourceFile {
  return ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function genauEins<T>(werte: readonly T[], meldung: string): T {
  const wert = werte[0];
  if (werte.length !== 1 || wert === undefined) {
    throw new Error(`${meldung}; gefunden: ${werte.length}`);
  }
  return wert;
}

/** `<pfad>:<zeile>` der ersten ROHZEILE, die `fragment` trägt — der Ort, den jede Meldung nennt. */
function zeileVon(text: string, pfad: string, fragment: string): string {
  const nr = text.split("\n").findIndex((z) => z.includes(fragment));
  return nr < 0 ? `${pfad}:?` : `${pfad}:${nr + 1}`;
}

// ------------------------------------------------------------------------------------------------
// DAS VERZEICHNIS: welche Namen in den gelesenen Dateien überhaupt einen Rumpf haben.
// ------------------------------------------------------------------------------------------------

interface Verzeichnis {
  funktionen: Map<string, ts.FunctionDeclaration>;
  klassen: Map<string, ts.ClassDeclaration>;
  schnittstellen: Map<string, ts.InterfaceDeclaration>;
  /** Schnittstellenname → die Klassen, die sie `implements`. */
  umsetzer: Map<string, string[]>;
}

function verzeichnis(dateien: readonly ts.SourceFile[]): Verzeichnis {
  const v: Verzeichnis = {
    funktionen: new Map(),
    klassen: new Map(),
    schnittstellen: new Map(),
    umsetzer: new Map(),
  };
  for (const datei of dateien) {
    for (const knoten of datei.statements) {
      if (ts.isFunctionDeclaration(knoten) && knoten.name && knoten.body) {
        v.funktionen.set(knoten.name.text, knoten);
      } else if (ts.isClassDeclaration(knoten) && knoten.name) {
        const name = knoten.name.text;
        v.klassen.set(name, knoten);
        for (const erbe of knoten.heritageClauses ?? []) {
          if (erbe.token !== ts.SyntaxKind.ImplementsKeyword) {
            continue;
          }
          for (const typ of erbe.types) {
            if (!ts.isIdentifier(typ.expression)) {
              continue;
            }
            const liste = v.umsetzer.get(typ.expression.text) ?? [];
            liste.push(name);
            v.umsetzer.set(typ.expression.text, liste);
          }
        }
      } else if (ts.isInterfaceDeclaration(knoten)) {
        v.schnittstellen.set(knoten.name.text, knoten);
      }
    }
  }
  return v;
}

/** Der ANGESCHRIEBENE Typname einer Deklaration — keine Inferenz, nur was dasteht. */
function typName(typ: ts.TypeNode | undefined): string | undefined {
  if (!typ) {
    return undefined;
  }
  if (ts.isTypeReferenceNode(typ) && ts.isIdentifier(typ.typeName)) {
    return typ.typeName.text;
  }
  if (ts.isUnionTypeNode(typ)) {
    for (const glied of typ.types) {
      const name = typName(glied);
      if (name !== undefined) {
        return name;
      }
    }
  }
  return undefined;
}

/** Der Typ eines Feldes an einer Klasse (auch als Konstruktor-Parameter) oder Schnittstelle. */
function feldTyp(v: Verzeichnis, traeger: string, feld: string): string | undefined {
  const klasse = v.klassen.get(traeger);
  if (klasse) {
    for (const glied of klasse.members) {
      if (
        ts.isPropertyDeclaration(glied) &&
        ts.isIdentifier(glied.name) &&
        glied.name.text === feld
      ) {
        return typName(glied.type);
      }
      if (ts.isConstructorDeclaration(glied)) {
        for (const p of glied.parameters) {
          if (ts.isIdentifier(p.name) && p.name.text === feld && (p.modifiers?.length ?? 0) > 0) {
            return typName(p.type);
          }
        }
      }
    }
    return undefined;
  }
  const schnittstelle = v.schnittstellen.get(traeger);
  for (const glied of schnittstelle?.members ?? []) {
    if (ts.isPropertySignature(glied) && ts.isIdentifier(glied.name) && glied.name.text === feld) {
      return typName(glied.type);
    }
  }
  return undefined;
}

interface Ziel {
  klasse: string;
  knoten: ts.MethodDeclaration;
}

/** Alle Methodenrümpfe dieses Namens an der Klasse — oder an jeder Umsetzung der Schnittstelle. */
function methoden(v: Verzeichnis, traeger: string, name: string): Ziel[] {
  const traeger_klassen = v.klassen.has(traeger) ? [traeger] : (v.umsetzer.get(traeger) ?? []);
  const gefunden: Ziel[] = [];
  for (const klassenName of traeger_klassen) {
    for (const glied of v.klassen.get(klassenName)?.members ?? []) {
      if (
        ts.isMethodDeclaration(glied) &&
        ts.isIdentifier(glied.name) &&
        glied.name.text === name &&
        glied.body
      ) {
        gefunden.push({ klasse: klassenName, knoten: glied });
      }
    }
  }
  return gefunden;
}

interface Umfeld {
  /** Die Klasse, in deren Methode wir gerade stehen — der Typ von `this`. */
  klasse: string | undefined;
  /** Angeschriebene Typen der Parameter und lokalen Bindungen. */
  lokale: Map<string, string>;
}

function lokale(knoten: ts.FunctionDeclaration | ts.MethodDeclaration): Map<string, string> {
  const raus = new Map<string, string>();
  for (const p of knoten.parameters) {
    const typ = typName(p.type);
    if (ts.isIdentifier(p.name) && typ !== undefined) {
      raus.set(p.name.text, typ);
    }
  }
  const gehe = (k: ts.Node): void => {
    if (ts.isVariableDeclaration(k) && ts.isIdentifier(k.name)) {
      const angeschrieben = typName(k.type);
      const gebaut =
        k.initializer &&
        ts.isNewExpression(k.initializer) &&
        ts.isIdentifier(k.initializer.expression)
          ? k.initializer.expression.text
          : undefined;
      const typ = angeschrieben ?? gebaut;
      if (typ !== undefined) {
        raus.set(k.name.text, typ);
      }
    }
    ts.forEachChild(k, gehe);
  };
  if (knoten.body) {
    ts.forEachChild(knoten.body, gehe);
  }
  return raus;
}

/** Der Typ des Empfängers eines Methodenaufrufs, so weit die Anschriften im Quelltext reichen. */
function empfaengerTyp(
  v: Verzeichnis,
  ausdruck: ts.Expression,
  umfeld: Umfeld,
): string | undefined {
  if (ausdruck.kind === ts.SyntaxKind.ThisKeyword) {
    return umfeld.klasse;
  }
  if (ts.isIdentifier(ausdruck)) {
    return (
      umfeld.lokale.get(ausdruck.text) ?? (v.klassen.has(ausdruck.text) ? ausdruck.text : undefined)
    );
  }
  if (ts.isPropertyAccessExpression(ausdruck)) {
    const basis = empfaengerTyp(v, ausdruck.expression, umfeld);
    return basis === undefined ? undefined : feldTyp(v, basis, ausdruck.name.text);
  }
  if (ts.isAwaitExpression(ausdruck) || ts.isParenthesizedExpression(ausdruck)) {
    return empfaengerTyp(v, ausdruck.expression, umfeld);
  }
  return undefined;
}

interface Kette {
  /** Jeder Name, der auf dem Weg von `checkKnowledge` aus WIRKLICH aufgerufen wird. */
  namen: Set<string>;
  /** Die tragenden Kanten in Aufrufreihenfolge — der Beleg, den jede rote Meldung trägt. */
  rueckgrat: string[];
  /** Die betretenen Rümpfe, für die Diagnose. */
  ruempfe: string[];
}

/**
 * DER EINE BAUMGANG. Startet bei `checkKnowledge` und folgt jedem Aufruf, dessen Ziel sich aus den
 * ANGESCHRIEBENEN Typen des Quelltextes auflösen lässt: freie Funktionen der gelesenen Dateien,
 * `this.…` in der umgebenden Klasse, Felder mit Typangabe und Schnittstellen über ihre `implements`.
 *
 * Kommentare, Zeichenketten und Falltitel haben hier keinen Ort: der Gang liest ausschliesslich
 * `CallExpression`-Knoten (Lehren 3570 R3, 3579 R1). Unauflösbare Aufrufe werden als NAME vermerkt
 * (sie werden ja wirklich gerufen), ihr Rumpf aber nicht betreten — die Kette ist damit eine
 * Obermenge der Namen und eine Untermenge der Rümpfe. Beides ist die sichere Richtung: ein Name,
 * der hier fehlt, wird SICHER nicht gerufen.
 */
function gebauteKette(quellen: ReadonlyMap<string, string>): Kette {
  const dateien = [...quellen].map(([pfad, text]) => ast(text, pfad));
  const v = verzeichnis(dateien);
  const start = v.funktionen.get("checkKnowledge");
  if (!start?.body) {
    throw new Error(
      `KETTE: ${KC}: checkKnowledge nicht gefunden — ohne Startpunkt gibt es keine Kette; gelesene Dateien: ${[...quellen.keys()].join(", ")}`,
    );
  }
  const namen = new Set<string>();
  const rueckgrat: string[] = [];
  const ruempfe: string[] = [];
  const besucht = new Set<string>();
  const warteschlange: {
    knoten: ts.FunctionDeclaration | ts.MethodDeclaration;
    umfeld: Umfeld;
    ort: string;
  }[] = [];
  const einreihen = (
    knoten: ts.FunctionDeclaration | ts.MethodDeclaration,
    klasse: string | undefined,
    ort: string,
  ): void => {
    if (besucht.has(ort)) {
      return;
    }
    besucht.add(ort);
    ruempfe.push(ort);
    warteschlange.push({ knoten, umfeld: { klasse, lokale: lokale(knoten) }, ort });
  };
  einreihen(start, undefined, "checkKnowledge");
  while (warteschlange.length > 0) {
    const auftrag = warteschlange.pop();
    if (!auftrag?.knoten.body) {
      continue;
    }
    const gehe = (k: ts.Node): void => {
      if (ts.isCallExpression(k)) {
        const aus = k.expression;
        if (ts.isIdentifier(aus)) {
          namen.add(aus.text);
          const funktion = v.funktionen.get(aus.text);
          if (funktion) {
            rueckgrat.push(`${auftrag.ort} → ${aus.text}`);
            einreihen(funktion, undefined, aus.text);
          }
        } else if (ts.isPropertyAccessExpression(aus)) {
          namen.add(aus.name.text);
          const traeger = empfaengerTyp(v, aus.expression, auftrag.umfeld);
          for (const ziel of traeger === undefined ? [] : methoden(v, traeger, aus.name.text)) {
            rueckgrat.push(`${auftrag.ort} → ${ziel.klasse}.${aus.name.text}`);
            einreihen(ziel.knoten, ziel.klasse, `${ziel.klasse}.${aus.name.text}`);
          }
        }
      }
      ts.forEachChild(k, gehe);
    };
    ts.forEachChild(auftrag.knoten.body, gehe);
  }
  return { namen, rueckgrat, ruempfe };
}

function quellenAus(kcText: string): ReadonlyMap<string, string> {
  return new Map<string, string>(
    QUELLDATEIEN.map((pfad) => [pfad, pfad === KC ? kcText : lesen(pfad)]),
  );
}

// Derselbe Quellstand ergibt dieselbe Kette — der Baumgang ist eine reine Funktion des Textes.
// Der Speicher hängt deshalb am TEXT, nicht am Dateinamen: eine Arbeitskopie bekommt ihre eigene
// Kette, ein zweiter Aufruf mit demselben Text spart nur das erneute Parsen der vier Dateien.
const KETTEN = new Map<string, Kette>();

function ketteZu(kcText: string): Kette {
  const bekannt = KETTEN.get(kcText);
  if (bekannt) {
    return bekannt;
  }
  const frisch = gebauteKette(quellenAus(kcText));
  KETTEN.set(kcText, frisch);
  return frisch;
}

// ------------------------------------------------------------------------------------------------
// DER BEGRÜNDUNGSBLOCK: nur die echten führenden Kommentare AM ANKER, keine Volltextsuche.
// ------------------------------------------------------------------------------------------------

const ANKER = "TERM_PLAETZE";

function begruendung(text: string): string {
  const datei = ast(text, KC);
  const knoten = genauEins(
    datei.statements.filter(
      (n) =>
        ts.isVariableStatement(n) &&
        n.declarationList.declarations.some(
          (d) => ts.isIdentifier(d.name) && d.name.text === ANKER,
        ),
    ),
    `${KC}: Begründungsanker ${ANKER} fehlt/mehrdeutig`,
  );
  const bereiche = ts.getLeadingCommentRanges(text, knoten.getFullStart()) ?? [];
  const roh = bereiche.map((r) => text.slice(r.pos, r.end)).join("\n");
  if (roh.trim().length === 0) {
    throw new Error(`${KC}: der Anker ${ANKER} trägt keinen Begründungsblock`);
  }
  return roh.replace(/^\s*(?:\/\/ ?|\/\*\*?|\*\/|\* ?)/gm, "");
}

/** Die Namen, die knowledge-check.ts SELBST erklärt — sie brauchen keine fremde Kette. */
function eigeneNamen(text: string): Set<string> {
  const datei = ast(text, KC);
  const raus = new Set<string>();
  for (const knoten of datei.statements) {
    if (ts.isFunctionDeclaration(knoten) && knoten.name) {
      raus.add(knoten.name.text);
    }
    if (ts.isVariableStatement(knoten)) {
      for (const d of knoten.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) {
          raus.add(d.name.text);
        }
      }
    }
  }
  return raus;
}

/**
 * WAS ALS „NENNUNG EINER FUNKTION" GILT — fail-closed, und das ist Absicht.
 *
 * Gelesen wird in EINEM Durchgang (`NENNUNG`) zweierlei, und beides geht danach durch dieselben
 * Filter — es gibt keine zweite Sammelstelle:
 *   (a) jeder Rückstrich-Ausdruck des Blocks (`foo`, `foo()`, `Klasse.foo`);
 *   (b) jede UNFORMATIERTE Nennung in Aufrufform, also ein Name, dem unmittelbar `(` folgt
 *       („entscheidend ist koCandidateScore(kandidat)"). Bis JOB 3911 wurde (b) gar nicht erst
 *       angesehen: wer die Rückstriche wegliess, wurde nicht geprüft, und B2 blieb still. Die
 *       Schreibweise entscheidet nicht mehr, ob eine Behauptung nachgemessen wird.
 * Ein Leerzeichen vor der Klammer zählt NICHT als Aufrufform — sonst wäre jedes Wort vor einer
 * Klammerbemerkung („der Fall (V2)") eine Nennung. Ebenso wenig zählt ein führender Punkt
 * (`.slice(0, 12)`): das ist keine Namensform, genau wie in (a).
 *
 * Beginnt das letzte Glied klein, ist es eine Funktions-/Methodennennung und muss auf der Kette
 * liegen. Grossbuchstabe am Anfang (Klassen, Typen) und VERSALIEN (Konstanten) sind keine Nennung.
 * Alles mit Leerzeichen, Klammerinhalt oder Operatoren (`w.length > 3`) fällt schon an der
 * Namensform heraus.
 *
 * Wer einen anderen Kleinbuchstaben-Ausdruck in Rückstriche setzt, bekommt Rot. Das ist die bewusst
 * enge Seite dieses Wächters: lieber ein Rot zu viel als eine Behauptung, die niemand nachprüft.
 *
 * WER ÜBER FRÜHER REDET, SAGT ES. Ein Satz mit Vergangenheitsmarke („bis JOB 3881", „stand hier",
 * „nicht mehr" …) ist keine Aussage über HEUTE — der widerlegte Name darf dort stehen, sonst könnte
 * dieser Block seinen eigenen Irrtum nicht benennen. Ohne Marke ist derselbe Satz eine Aussage über
 * die laufende Kette und wird geprüft. Dieselbe Grenze zieht der Nachbarwächter
 * `tests/ask-rangfolge-kommentar/erklaerung-und-abfrage-stimmen-ueberein.test.ts` (dort `VERGANGENHEIT`);
 * sie ist bewusst und wird von Fall K4 unten in beide Richtungen gemessen.
 */
const NAMENSFORM = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\(\))?$/;
/** Gruppe 1: der Rückstrich-Ausdruck. Gruppe 2: die unformatierte Nennung in Aufrufform. */
const NENNUNG = /`([^`\n]+)`|(?<![\w$.])([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\(/g;
const VERGANGENHEIT =
  /bis JOB \d+|bis heute|bis zu diesem Auftrag|früher|damals|historisch|seinerzeit|nicht mehr|stand hier|falsch stand|ist deshalb ERSETZT/i;

function saetze(block: string): string[] {
  return block
    .replace(/\s+/g, " ")
    .split(/(?<=\.)\s/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function genannteFunktionen(block: string): string[] {
  const raus = new Set<string>();
  for (const satz of saetze(block)) {
    if (VERGANGENHEIT.test(satz)) {
      continue;
    }
    for (const treffer of satz.matchAll(NENNUNG)) {
      const roh = (treffer[1] ?? treffer[2] ?? "").trim();
      if (!NAMENSFORM.test(roh)) {
        continue;
      }
      const letztes = roh.replace(/\(\)$/, "").split(".").pop() ?? "";
      if (!/^[a-z]/.test(letztes)) {
        continue;
      }
      raus.add(letztes);
    }
  }
  return [...raus];
}

// ------------------------------------------------------------------------------------------------
// DIE FUNDSTELLENLISTE — maschinenlesbar, damit kein Verweis ungeprüft bleibt.
// ------------------------------------------------------------------------------------------------
//
// Eine Zeile je Verweis, im Block:  `· RUMPF <name> — <pfad>:<von>-<bis>`  bzw. `· AUFRUF …`.
// RUMPF verlangt eine DEKLARATION dieses Namens im Zeilenbereich, AUFRUF einen echten AUFRUF
// (keine Kommentarzeile). Zusätzlich darf im Block KEIN weiterer `<datei>.ts:<zahl>` stehen — jeder
// Verweis geht durch diese Liste, sonst gäbe es eine zweite, ungeprüfte Wahrheit.

const FUNDSTELLE = /^·\s+(AUFRUF|RUMPF)\s+([A-Za-z_$][\w$]*)\s+—\s+(\S+\.ts):(\d+)(?:-(\d+))?$/;
const VERWEIS_IRGENDWO = /\S+\.ts:\d+/g;

interface Verweis {
  art: "AUFRUF" | "RUMPF";
  name: string;
  pfad: string;
  von: number;
  bis: number;
  zeile: string;
}

function fundstellen(block: string): Verweis[] {
  const raus: Verweis[] = [];
  for (const roh of block.split("\n")) {
    const zeile = roh.trim();
    const t = FUNDSTELLE.exec(zeile);
    if (!t) {
      continue;
    }
    const von = Number(t[4]);
    raus.push({
      art: t[1] as "AUFRUF" | "RUMPF",
      name: t[2] ?? "",
      pfad: t[3] ?? "",
      von,
      bis: t[5] === undefined ? von : Number(t[5]),
      zeile,
    });
  }
  return raus;
}

function bereich(text: string, von: number, bis: number): string[] {
  return text.split("\n").slice(Math.max(0, von - 1), bis);
}

/**
 * DERSELBE QUELLTEXT, ABER NUR SEIN AUSFÜHRBARER TEIL — die eine Stelle, an der „ist das Code?"
 * entschieden wird.
 *
 * Jedes Zeichen eines Kommentars und jedes Zeichen eines Zeichenketten-, Vorlagen- oder
 * Musterliterals wird zu einem Leerzeichen; Zeilenumbrüche bleiben stehen. Länge, Zeilennummern und
 * Spalten sind damit unverändert — ein Treffer in diesem Text ist ein Treffer in ausführbarem Code,
 * und nur dort. Gelesen wird derselbe TypeScript-Baum wie beim Baumgang, Token für Token samt
 * führender Kommentare.
 *
 * WAS DAS ABLÖST: bis JOB 3911 fragte `belegt` mit `/^\s*(?:\/\/|\*|\/\*)/`, ob eine Zeile mit einem
 * Kommentarzeichen BEGINNT. Diese Zeilenmusterprüfung sah drei Scheinbelege als Aufruf an (BEN zu
 * JOB 3881, Prüfpunkt 6): den an eine Codezeile angehängten Kommentar, den Zeichenkettenwert und die
 * Innenzeile eines Blockkommentars ohne führendes Sternchen. Sie ist ERSETZT, nicht ergänzt — es
 * gibt daneben keinen zweiten Weg, einen Aufruf zu belegen.
 */
const AUSGEBLENDET: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.RegularExpressionLiteral,
]);

/** Der Baumgang je Datei ist teuer und rein — einmal je Pfad genügt. */
const NUR_CODE = new Map<string, string>();

function nurCode(pfad: string): string {
  const bekannt = NUR_CODE.get(pfad);
  if (bekannt !== undefined) {
    return bekannt;
  }
  const text = lesen(pfad);
  const datei = ast(text, pfad);
  const zeichen = text.split("");
  const ausblenden = (von: number, bis: number): void => {
    for (let i = von; i < bis && i < zeichen.length; i += 1) {
      if (zeichen[i] !== "\n") {
        zeichen[i] = " ";
      }
    }
  };
  const gehe = (k: ts.Node): void => {
    // BEIDE Richtungen: `getLeadingCommentRanges` sammelt erst ab dem ersten Zeilenumbruch und
    // übergeht damit genau den ANGEHÄNGTEN Kommentar (`const x = 1; // foo(y)`) — der ist nachlaufende
    // Trivia des vorangehenden Tokens. Gemessen: ohne die zweite Schleife blieb H2 (angehängter
    // Kommentar) grün, mit ihr wird er abgewiesen.
    for (const r of ts.getLeadingCommentRanges(text, k.getFullStart()) ?? []) {
      ausblenden(r.pos, r.end);
    }
    for (const r of ts.getTrailingCommentRanges(text, k.getEnd()) ?? []) {
      ausblenden(r.pos, r.end);
    }
    if (AUSGEBLENDET.has(k.kind)) {
      ausblenden(k.getStart(datei), k.getEnd());
    }
    for (const kind of k.getChildren(datei)) {
      gehe(kind);
    }
  };
  gehe(datei);
  const raus = zeichen.join("");
  NUR_CODE.set(pfad, raus);
  return raus;
}

function belegt(verweis: Verweis): string | undefined {
  const roh = bereich(lesen(verweis.pfad), verweis.von, verweis.bis);
  if (roh.length === 0) {
    return "der Zeilenbereich liegt ausserhalb der Datei";
  }
  const name = verweis.name.replace(/[$]/g, "\\$");
  const muster =
    verweis.art === "RUMPF"
      ? new RegExp(`^\\s*(?:export\\s+)?(?:async\\s+)?(?:function\\s+)?${name}\\s*[(<]`)
      : new RegExp(`[.\\s(]${name}\\s*\\(`);
  // RUMPF behält seine Bedeutung und liest die Rohzeilen; AUFRUF misst am ausführbaren Teil.
  const gemessen =
    verweis.art === "RUMPF" ? roh : bereich(nurCode(verweis.pfad), verweis.von, verweis.bis);
  if (gemessen.some((z) => muster.test(z))) {
    return undefined;
  }
  // Steht der Name im Rohtext, im Code aber nicht, sagt die Meldung WARUM sie ihn verwirft.
  const schein =
    verweis.art === "AUFRUF" && roh.some((z) => muster.test(z))
      ? " (der Name steht dort nur in einem Kommentar oder in einer Zeichenkette, nicht in Code)"
      : "";
  return `${verweis.pfad}:${verweis.von}-${verweis.bis} trägt ${verweis.art === "RUMPF" ? "keine Deklaration" : "keinen ausführbaren Aufruf"}${schein} von „${verweis.name}"; gelesener Bereich: ${roh.join(" ⏎ ").slice(0, 240)}`;
}

// ------------------------------------------------------------------------------------------------
// DIE ZWEI PRÜFUNGEN.
// ------------------------------------------------------------------------------------------------

/** B2 — jede genannte fremde Funktion liegt auf der gebauten Kette. */
function pruefeKettentreue(kcText: string): void {
  const kette = ketteZu(kcText);
  const block = begruendung(kcText);
  const eigene = eigeneNamen(kcText);
  const fremd = genannteFunktionen(block).filter((n) => !eigene.has(n));
  const daneben = fremd.filter((n) => !kette.namen.has(n));
  const spur = kette.rueckgrat.filter((k) => /findCandidates|findSearchHits|findActive/.test(k));
  expect(
    daneben,
    `B2 Kettentreue: ${KC}: der Begründungsblock am Anker ${ANKER} nennt ${daneben
      .map((n) => `„${n}" (${zeileVon(kcText, KC, n)})`)
      .join(
        ", ",
      )} als entscheidend — diese Funktion wird von checkKnowledge aus nie gerufen. Gebaute Kette: ${spur.join(" | ")}`,
  ).toEqual([]);
}

/** B3 — jede genannte Kettenfunktion hat einen Verweis, und jeder Verweis stimmt. */
function pruefeFundstellen(kcText: string): void {
  const kette = ketteZu(kcText);
  const block = begruendung(kcText);
  const eigene = eigeneNamen(kcText);
  const verweise = fundstellen(block);
  const aufKette = genannteFunktionen(block).filter((n) => !eigene.has(n) && kette.namen.has(n));
  const ohneVerweis = aufKette.filter((n) => !verweise.some((v) => v.name === n));
  expect(
    ohneVerweis,
    `B3 Fundstellen: ${KC}: der Begründungsblock nennt ${ohneVerweis.join(", ")} ohne Fundstellenzeile („· RUMPF <name> — <pfad>:<von>-<bis>")`,
  ).toEqual([]);
  const falsch = verweise.map(belegt).filter((m): m is string => m !== undefined);
  expect(falsch, `B3 Fundstellen: ${KC}: ${falsch.join(" · ")}`).toEqual([]);
  // Kein Verweis an der Liste vorbei: sonst stünde daneben eine zweite, ungeprüfte Wahrheit.
  const inListe = new Set(
    verweise.flatMap((v) => [...v.zeile.matchAll(VERWEIS_IRGENDWO)].map((m) => m[0])),
  );
  const frei = [...block.matchAll(VERWEIS_IRGENDWO)]
    .map((m) => m[0])
    .filter((s) => !inListe.has(s));
  expect(
    frei,
    `B3 Fundstellen: ${KC}: Verweis ausserhalb der Fundstellenliste — ${frei.join(", ")}`,
  ).toEqual([]);
}

const kc = lesen(KC);

function ersetzen(text: string, alt: string, neu: string): string {
  if (!text.includes(alt)) {
    throw new Error(`Kalibrierung erreicht die Quelle nicht: ${alt}`);
  }
  return text.replace(alt, neu);
}

/** Nimmt eine Prüfung entgegen, die ROT sein MUSS, und gibt ihre Meldung zum Weiterprüfen zurück. */
function abgewiesen(pruefung: () => void): string {
  try {
    pruefung();
  } catch (fehler) {
    return fehler instanceof Error ? fehler.message : String(fehler);
  }
  throw new Error("die Prüfung blieb GRÜN, obwohl dieser Fall sie rot machen muss");
}

/**
 * Das Urteil einer Prüfung als Zeichenkette: „GRÜN" oder ihre wörtliche Meldung.
 *
 * WARUM DIE KALIBRIERUNG RELATIV MISST und nicht „bleibt grün": ihre Aussage ist „blinder Text
 * ändert NICHTS". Absolut geprüft wäre sie an den Bestand gekoppelt und würde bei JEDER
 * Pflichtverstellung mitrot — dann röte eine Verstellung nicht mehr genau ihren einen Fall, und
 * niemand sähe, welcher Fall die Verstellung wirklich erkannt hat.
 */
function befund(pruefung: (text: string) => void, text: string): string {
  try {
    pruefung(text);
    return "GRÜN";
  } catch (fehler) {
    return fehler instanceof Error ? fehler.message : String(fehler);
  }
}

// Derselbe Name in drei blinden Formen. Er darf den Wächter WEDER rot NOCH grün machen
// (Lehren 3570 R3, 3579 R1): ein Kommentar ausserhalb des Blocks, ein Zeichenkettenwert und ein
// Falltitel sind kein Aufruf und keine Begründung.
const BLIND = "koCandidateScore";
const FREMDTEXT = [
  ["Kommentar ausserhalb des Blocks", (s: string) => `\n// ${s} — nur ein Kommentar.\n`],
  ["Zeichenkette", (s: string) => `\nexport const scheinbeleg = ${JSON.stringify(s)};\n`],
  ["Falltitel", (s: string) => `\nit(${JSON.stringify(`… ${s} …`)}, () => {});\n`],
] as const;

// ------------------------------------------------------------------------------------------------
// DIE DREI SCHEINBELEG-ZEILEN (Fall H2) — sie stehen HIER, in dieser Datei.
// ------------------------------------------------------------------------------------------------
//
// `belegt` schlägt eine ECHTE Datei an einer ECHTEN Zeile auf; eine Attrappe im Speicher würde den
// Leser gar nicht messen. Also liefert dieser Wächter die Zeilen selbst. Jede der drei trägt
// `findSearchHits` in Aufrufform, und keine davon ist ein Aufruf: die erste in einem ANGEHÄNGTEN
// Kommentar, die zweite in einem ZEICHENKETTENWERT, die dritte als INNENZEILE eines
// Blockkommentars, die nicht mit einem Sternchen beginnt. Ihre Zeilennummern werden zur Laufzeit
// über die Marke gesucht (`zeileVon`), damit sie beim Umbauen dieser Datei nicht veralten.

const SELBST = "tests/live-check-suchwoerter/begruendung-nennt-die-gebaute-kette.test.ts";
const SCHEIN_ENDKOMMENTAR = "H2a"; // findSearchHits(entwurf) — angehängter Kommentar, kein Aufruf
const SCHEIN_ZEICHENKETTE = "H2b — findSearchHits(entwurf) als blosser Zeichenkettenwert";
/*
H2c — findSearchHits(entwurf): Innenzeile eines Blockkommentars ohne führendes Sternchen.
*/
const SCHEIN_BLOCKKOMMENTAR = "H2c";

/** Die Fundstellenzeile, hinter die Fall H2 seinen Scheinbeleg-Verweis hängt. */
const LISTENANKER = "//   · AUFRUF findCandidates — services/app/src/knowledge-check.ts:389";

describe("JOB 3881: die Begründung der Suchwortregel nennt die gebaute Kette", () => {
  it("B1 · die Kette wird aus dem Quelltext gebaut: findCandidates → findSearchHits → findActive", () => {
    const kette = gebauteKette(quellenAus(kc));
    expect(kette.namen.size, "leere Kette").toBeGreaterThan(0);
    for (const glied of ["findCandidates", "findSearchHits", "findActive"]) {
      expect(
        kette.namen.has(glied),
        `Kettenglied ${glied} fehlt; Rümpfe: ${kette.ruempfe.join(", ")}`,
      ).toBe(true);
    }
    // Die Rümpfe belegen, dass der Gang wirklich durch KoService und die Suchprojektion ging.
    expect(kette.ruempfe).toContain("KoService.findCandidates");
    expect(kette.ruempfe).toContain("KoService.findSearchHits");
    expect(kette.ruempfe).toContain("InMemoryKoSearchProjectionRepo.findActive");
    // UND der Gegenbefund, der diesen Auftrag ausgelöst hat: der Adapterweg liegt NICHT darauf,
    // obwohl repo.ts mitgelesen wird. `InMemoryKoRepo.findCandidates` hat keinen Aufrufer.
    expect(kette.ruempfe).not.toContain("InMemoryKoRepo.findCandidates");
    expect(kette.namen.has("koCandidateScore")).toBe(false);
    expect(kette.namen.has("koCandidateText")).toBe(false);
    // Und die drei Glieder, mit denen der Begründungsblock die Teilzeichenketten-Regel erklärt:
    // sie stehen im Rumpf von `findActive` und sind damit belegt, nicht behauptet.
    for (const glied of [
      "normalizeSearchTerms",
      "expandSearchTerms",
      "matchEffectiveSearchDocument",
    ]) {
      expect(kette.namen.has(glied), `Kettenglied ${glied} fehlt`).toBe(true);
    }
  });

  it("B2 · jede im Begründungsblock genannte Funktion liegt auf der gebauten Kette", () => {
    pruefeKettentreue(kc);
  });

  it("B3 · jeder Verweis des Begründungsblocks trifft die genannte Stelle", () => {
    pruefeFundstellen(kc);
  });

  // ==============================================================================================
  // KALIBRIERUNG (Lieferung 5) — derselbe Name als blosser Text bewegt nichts, in beide Richtungen.
  // ==============================================================================================
  for (const [form, einbetten] of FREMDTEXT) {
    it(`K1 · ${BLIND} als ${form} ändert das Urteil des Wächters in KEINE Richtung`, () => {
      // (a) NICHT ROT: blinder Text ist kein Aufruf und keine Begründung — das Urteil ist Wort für
      //     Wort dasselbe wie ohne ihn (relativ gemessen, s. `befund`).
      const heil = kc + einbetten(BLIND);
      expect(befund(pruefeKettentreue, heil)).toBe(befund(pruefeKettentreue, kc));
      expect(befund(pruefeFundstellen, heil)).toBe(befund(pruefeFundstellen, kc));
      // (b) NICHT GRÜN: derselbe blinde Text neben einer WIRKLICH falschen Begründung deckt sie
      //     nicht zu. Ein Wächter, der hier grün würde, wäre ein Wörterbuch (Lehren 3570 R3, 3579 R1).
      const kaputt =
        ersetzen(
          kc,
          "WAS HIER FALSCH STAND. Bis JOB 3881 begründete",
          "WAS HIER STEHT. Heute begründet",
        ) + einbetten(BLIND);
      expect(abgewiesen(() => pruefeKettentreue(kaputt))).toContain("B2 Kettentreue");
    });
  }

  it("K2 · der Wächter liest die ÜBERGEBENE Fassung — falsche Datei und fehlender Anker sind rot", () => {
    // (a) Eine FREMDE Datei an derselben Stelle: der Baumgang findet seinen Startpunkt nicht und
    //     sagt das mit Datei und gelesenen Quellen — kein stilles Grün.
    const fremd = abgewiesen(() => pruefeKettentreue(lesen(SVC)));
    expect(fremd).toContain(`KETTE: ${KC}: checkKnowledge nicht gefunden`);
    // (b) Dieselbe Datei OHNE den Anker: der Blockleser arbeitet nachweislich am übergebenen Text.
    const ohneAnker = abgewiesen(() =>
      pruefeKettentreue(ersetzen(kc, `const ${ANKER} = 12;`, `const ${ANKER}_UMBENANNT = 12;`)),
    );
    expect(ohneAnker).toContain(`${KC}: Begründungsanker ${ANKER} fehlt/mehrdeutig`);
  });

  it("K3 · ein leerer Begründungsblock ist rot, nicht still grün", () => {
    const datei = ast(kc, KC);
    const anker = genauEins(
      datei.statements.filter(
        (n) =>
          ts.isVariableStatement(n) &&
          n.declarationList.declarations.some(
            (d) => ts.isIdentifier(d.name) && d.name.text === ANKER,
          ),
      ),
      "Anker fehlt",
    );
    const bereiche = ts.getLeadingCommentRanges(kc, anker.getFullStart()) ?? [];
    const erster = bereiche[0];
    const letzter = bereiche[bereiche.length - 1];
    expect(erster && letzter, "kein führender Kommentar am Anker").toBeTruthy();
    if (!erster || !letzter) {
      return;
    }
    const ohne = kc.slice(0, erster.pos) + kc.slice(letzter.end);
    const fehler = abgewiesen(() => pruefeKettentreue(ohne));
    expect(fehler).toContain(`${KC}: der Anker ${ANKER} trägt keinen Begründungsblock`);
  });

  it("K4 · derselbe widerlegte Name OHNE Vergangenheitsmarke ist eine Aussage über HEUTE — rot", () => {
    // Die Gegenrichtung zur Ausnahme oben: der Block darf seinen eigenen Irrtum benennen, solange
    // er ihn als vergangen kennzeichnet. Fällt die Marke weg, steht derselbe Satz als Behauptung
    // über die laufende Kette da — und genau dann muss der Wächter rot werden, sonst wäre die
    // Ausnahme ein Schlupfloch.
    const ohneMarke = ersetzen(
      kc,
      "WAS HIER FALSCH STAND. Bis JOB 3881 begründete",
      "WAS HIER STEHT. Heute begründet",
    );
    const fehler = abgewiesen(() => pruefeKettentreue(ohneMarke));
    expect(fehler).toContain("B2 Kettentreue");
    expect(fehler).toContain(`„${BLIND}"`);
    // Die Fundstellen bleiben davon unberührt — jede Verstellung rötet ihren EIGENEN Fall.
    expect(befund(pruefeFundstellen, ohneMarke)).toBe(befund(pruefeFundstellen, kc));
  });

  // ==============================================================================================
  // JOB 3911 — DIE ZWEI TÜREN, DIE BEN AN JOB 3881 OFFEN FAND (Prüfpunkt 6 seines Urteils).
  // ==============================================================================================

  it("H1 · eine UNFORMATIERTE Nennung einer kettenfremden Funktion ist rot wie eine formatierte", () => {
    // Derselbe Name, dieselbe Aussage über HEUTE — nur ohne Rückstriche. Vor JOB 3911 las
    // `genannteFunktionen` ausschliesslich Rückstrich-Ausdrücke; dieser Satz erzeugte keinen
    // einzigen Treffer, `daneben` blieb leer und B2 schwieg zu einer Funktion, die das Produkt
    // nicht ruft. Die Schreibweise darf nicht entscheiden, ob eine Behauptung geprüft wird.
    const unformatiert = ersetzen(
      kc,
      "WARUM DETERMINISTISCH: eine reine Funktion.",
      `Entscheidend ist ${BLIND}(kandidat). WARUM DETERMINISTISCH: eine reine Funktion.`,
    );
    const fehler = abgewiesen(() => pruefeKettentreue(unformatiert));
    expect(fehler).toContain("B2 Kettentreue");
    expect(fehler).toContain(`„${BLIND}"`);
    // Trennschärfe wie bei K4: die Fundstellen bleiben Wort für Wort beim alten Urteil.
    expect(befund(pruefeFundstellen, unformatiert)).toBe(befund(pruefeFundstellen, kc));
  });

  for (const [form, marke] of [
    ["angehängter Kommentar", SCHEIN_ENDKOMMENTAR],
    ["Zeichenkette", SCHEIN_ZEICHENKETTE],
    ["Innenzeile eines Blockkommentars", SCHEIN_BLOCKKOMMENTAR],
  ] as const) {
    it(`H2 · eine Fundstelle auf einen Scheinbeleg (${form}) gilt NICHT als Aufruf`, () => {
      // Vor JOB 3911 prüfte `belegt` nur, ob die Zeile mit einem Kommentarzeichen BEGINNT. Alle drei
      // Formen tun das nicht — sie kamen als „ausführbarer Aufruf" durch, und ein Verweis auf sie war
      // damit „belegt". Wer der Fundstelle folgte, landete auf Text statt auf Code.
      const selbst = lesen(SELBST).split("\n");
      const nr = selbst.findIndex((z) => z.includes(marke));
      // Die Marke muss ZUERST auf ihrer eigenen Scheinbeleg-Zeile stehen. Schreibt jemand sie
      // weiter oben in einen Kommentar, zeigte der Verweis auf eine harmlose Zeile und der Fall
      // wäre aus dem falschen Grund rot — dann lieber hier abbrechen.
      expect(
        nr >= 0 && (selbst[nr] ?? "").includes("findSearchHits("),
        `Scheinbeleg-Zeile „${marke}" nicht gefunden oder ohne Aufrufform: ${selbst[nr] ?? "<keine>"}`,
      ).toBe(true);
      const ort = `${SELBST}:${nr + 1}`;
      const verstellt = ersetzen(
        kc,
        LISTENANKER,
        `${LISTENANKER}\n//   · AUFRUF findSearchHits — ${ort}`,
      );
      const fehler = abgewiesen(() => pruefeFundstellen(verstellt));
      expect(fehler).toContain("B3 Fundstellen");
      expect(fehler).toContain(ort);
      expect(fehler).toContain("nur in einem Kommentar oder in einer Zeichenkette, nicht in Code");
      // Trennschärfe: die Kettentreue bleibt Wort für Wort beim alten Urteil.
      expect(befund(pruefeKettentreue, verstellt)).toBe(befund(pruefeKettentreue, kc));
    });
  }
});
