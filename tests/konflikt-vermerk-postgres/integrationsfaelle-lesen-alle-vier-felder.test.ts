// ================================================================================================
// JOB 3940 — JEDER RÜCKLESEFALL DER INTEGRATIONSDATEI PRÜFT ALLE VIER FELDER
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT. JOB 3914 hat zwei echte Postgres-Fälle gebaut, die eine
// menschliche Entscheidung nach einem NEUEN Verbindungsaufbau zurücklesen
// (`services/conflicts/src/repo-pg.integration.test.ts`). Der zweite prüfte drei der vier Felder
// und liess `status` in BEIDEN Zweigen aus (BEN zu JOB 3914, `archiv/3914/runde-1/ben.md:27`:
// „Im zweiten Integrationsfall fehlen Statuszusicherungen (`repo-pg.integration.test.ts:346`)").
// Fiele im Postgres-Adapter der Status weg, blieb dieser Fall grün: der Konflikt stünde nach dem
// Neustart wieder auf „offen", die Entscheidung wäre sichtbar getroffen und trotzdem unwirksam.
// Zwei `expect`-Zeilen nachzutragen genügt dafür nicht — sie können morgen wieder herausfallen,
// ohne dass ein Torlauf rot wird. Diese Datei hält die Zusage fest, und zwar OHNE Datenbank: sie
// liest den QUELLTEXT der Integrationsdatei und verlangt für jeden zurückgelesenen Bezeichner alle
// vier Felder `status`, `decidedBy`, `decision`, `resolutionReason`.
//
// DIE LÜCKE IST GEMESSEN, NICHT BEHAUPTET. Gegen den Stand vor der Ergänzung (main `be4e00f`)
// meldete L3.2 genau zwei Befunde: `repo-pg.integration.test.ts:346` (`gelesen.ohne`) und `:349`
// (`gelesen.mit`), beide mit fehlendem Feld `status`, beide mit dem Fallnamen. Erst danach wurden
// die zwei `expect`-Zeilen ergänzt; seither ist L3.2 grün.
//
// ------------------------------------------------------------------------------------------------
// DIE GRENZEN, GETRENNT UND WÖRTLICH (BENs Promptverbesserung, `archiv/3914/runde-1/ben.md:34`)
// ------------------------------------------------------------------------------------------------
//
// (i) WAS ALS TEST VORHANDEN IST. In `services/conflicts/src/repo-pg.integration.test.ts` stehen
//     neun Fälle gegen echtes Postgres, davon zwei mit Rücklesen über einen NEUEN Pool:
//     „die Entscheidung mit Freitext ist nach NEUEM Verbindungsaufbau vollständig lesbar" (ein
//     Bezeichner: `zurueck`) und „«Fehlalarm ohne Notiz» bleibt null, «entschieden» trägt den
//     Freitext" (zwei Bezeichner: `gelesen.ohne`, `gelesen.mit`). Drei Rücklesungen also — mehr
//     nicht, und genau diese Zahl misst der Fall L3.1 unten mit, damit die Erhebung nicht still
//     auf null fällt.
//
// (ii) WOFÜR ES KEINEN AUSGEFÜHRTEN DATENBANKBELEG GIBT. Diese neun Fälle LAUFEN NICHT, solange
//     weder ein Docker-Daemon noch `KLARWERK_PG_TEST_URL` da ist: `vitest.config.ts` schliesst
//     `**/*.integration.test.ts` aus, und unter `vitest.integration.config.ts` überspringen sie
//     sich sauber (`repo-pg.integration.test.ts:69-117`). BENs eigener Lauf zu JOB 3914 endete mit
//     `Tests 9 skipped (9)` — ein übersprungener Test ist kein Beleg. Diese Datei misst deshalb
//     ausdrücklich NICHT, dass Postgres den Vermerk hält, sondern NUR, dass der Test, der das
//     messen würde, vollständig fragt. Die inhaltliche Hälfte im Tor trägt der Paritätsbeleg
//     `vermerk-ueberlebt-die-postgres-ablage.test.ts` (Doppelgänger, keine echte Instanz).
//
// (iii) WAS AUCH MIT DATENBANK WEITERHIN AUSGESCHLOSSEN BLEIBT. Selbst ein grüner
//     Infrastruktur-Lauf sagt nichts über: Planner- und Indexnutzung, echte Nebenläufigkeit
//     zweier menschlicher Entscheidungen, den HTTP-Weg, die Oberfläche (ob der Konflikt nach dem
//     Neustart wirklich aus der Liste der offenen Fälle verschwindet) und die Sprachen EN/NL.
//     Nichts davon wird hier behauptet.
//
// ------------------------------------------------------------------------------------------------
// WIE GEMESSEN WIRD — AM SYNTAXBAUM, MIT DER VORHANDENEN BAUFORM
// ------------------------------------------------------------------------------------------------
// Kein dritter, eigener Parser: die Quelle kommt über `ladeQuelle`/`quelleAus` aus
// `tools/modalgrenze.ts` (dieselbe Vorrichtung, die `tests/q9-oidc-literalquelle` und
// `tests/live-check-postgres-prefilter` tragen, Lehre JOB 3895 R2), der Empfänger eines Aufrufs
// über deren `aufrufName`, die Zeilennummer über deren `zeileVon`. Eine Zeichenkettensuche wäre
// hier falsch: `repo-pg.integration.test.ts` NENNT alle vier Feldnamen auch in Prosa — in EINER
// Kommentarzeile alle vier (`:297`), dazu `decision`/`decidedBy` in `:265` —, und ein Kommentar
// ist keine Zusicherung. Der Fall L4g hält genau diese Falle als Kalibrierung fest.
//
// Die Datei wird EINMAL je Lauf gelesen (`gemesseneQuelle`, memoisiert) — der Torlauf ist der
// Engpass der Maschine.
//
// WAS RUNDE 2 GESCHÄRFT HAT (BEN zu Runde 1). Der Wächter aus Runde 1 hätte zwei Formen still
// durchgelassen, in denen die vier Felder gar nicht geprüft sind:
//   (1) die lokale Zwischenvariable — `const d = await repo.findById("x"); return d;` galt als
//       „keine Rücklesung", ein solcher Fall wäre unbemerkt geblieben. Jetzt werden Bindungen im
//       Rückruf verfolgt (`aufgeloest`), Kurzschreibweise `{ d }` eingeschlossen.
//   (2) `expect(zurueck?.status);` OHNE aufgerufenen Matcher zählte als Zusicherung, obwohl es
//       nichts prüft. Jetzt muss eine Matcher-Kette daran hängen (`matcherAufgerufen`).
// Dazu der Grundsatz dahinter: was der Wächter nicht bis zu einem prüfbaren Bezeichner verfolgen
// kann, gilt NICHT als vollständig, sondern als Befund (`unverfolgt`) — sonst wäre jede neue
// Rückleseform ein Freifahrtschein. Die Kalibrierung dazu steht in L4h–L4l; gemessen wurde die
// Lücke, nicht behauptet: gegen die Fassung aus Runde 1 waren diese fünf Fälle rot.
//
// WAS RUNDE 3 GESCHÄRFT HAT (BEN zu Runde 2, Korrekturpflicht 1). Runde 2 hielt einen Rückgabewert
// schon dann für gedeckt, wenn IRGENDWO in ihm ein `findById`-Aufruf stand. Damit ging
// `return zusammengefasst(await repo.findById("ohne"));` still durch: die vier Zusicherungen
// betrafen das Ergebnis einer unbekannten Umformung, und dass dieses der gelesene Datensatz ist,
// war unbelegt. Mit Zwischenvariable fiel dieselbe Form korrekt auf (L4k) — nur eben direkt
// eingebettet nicht. Jetzt zählt allein der Wert SELBST: der herausgegebene Ausdruck muss, nach
// Abtragen von `await`/Klammern/`as` und nach dem Verfolgen von Zwischenvariablen, DER Leseaufruf
// sein (`nimm`). Ein enthaltener Leseaufruf beweist nicht, dass der zurückgegebene Wert dieser
// Datensatz ist. Kalibriert in L4m (direkt eingebettet) und L4n (eingebettet in einem Zweig des
// Objektliterals, der andere Zweig bleibt gedeckt); die positiven Kontrollen — direkte Rückgabe
// (L4a, die Form der echten Datei) und gewöhnliche Zwischenvariable (L4h) — bleiben grün. Auch das
// ist gemessen, nicht behauptet: gegen die Fassung aus Runde 2 waren L4m und L4n rot.
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  type Quelle,
  WURZEL,
  aufrufName,
  ladeQuelle,
  quelleAus,
  zeileVon,
} from "../../tools/modalgrenze";

/** Die gemessene Datei, relativ zur Wurzel — der einzige Pfad, den diese Datei von Platte liest. */
const GEMESSENE_DATEI = "services/conflicts/src/repo-pg.integration.test.ts";

/**
 * Die vier Felder einer menschlichen Entscheidung. Wörtlich dieselbe Liste wie `FELDER` in
 * `vermerk-ueberlebt-die-postgres-ablage.test.ts:197` — dort für den Paritätsvergleich, hier für
 * die Vollständigkeit der Integrationsfälle.
 */
const FELDER = ["status", "decidedBy", "decision", "resolutionReason"] as const;
type Feld = (typeof FELDER)[number];

interface Befund {
  datei: string;
  /** 1-basiert: die erste `expect`-Zeile dieses Bezeichners, sonst die Zeile des Rücklesens. */
  zeile: number;
  fall: string;
  bezeichner: string;
  fehlend: readonly Feld[];
  art: "felder-fehlen" | "nicht-gebunden" | "unverfolgt";
}

interface Ruecklesung {
  fall: string;
  bezeichner: string;
  zeile: number;
}

interface Erhebung {
  faelle: number;
  ruecklesungen: Ruecklesung[];
  befunde: Befund[];
}

/** Datei, Zeile, Fallname und das fehlende Feld — nicht bloss „ungleich". */
function meldung(b: Befund): string {
  const kopf = `${b.datei}:${b.zeile} · Fall „${b.fall}"`;
  if (b.art === "nicht-gebunden") {
    return `${kopf} · liest über mitNeuemPool zurück, bindet das Ergebnis aber an keinen Bezeichner — keines der vier Felder ist prüfbar (${b.fehlend.join(", ")})`;
  }
  if (b.art === "unverfolgt") {
    return `${kopf} · ${b.bezeichner} — der Lesewert erreicht keinen prüfbaren Bezeichner; der Wächter kann diese Form nicht verfolgen und lässt sie NICHT still als vollständig gelten (${b.fehlend.join(", ")})`;
  }
  return `${kopf} · ${b.bezeichner} — fehlende Felder: ${b.fehlend.join(", ")}`;
}

function alleKnoten(wurzel: ts.Node): ts.Node[] {
  const raus: ts.Node[] = [wurzel];
  const gehe = (n: ts.Node): void => {
    raus.push(n);
    n.forEachChild(gehe);
  };
  wurzel.forEachChild(gehe);
  return raus;
}

/**
 * Ein Aufruf DIESES Namens — `it(…)` ebenso wie `it.skip(…)`, `expect(…)` ebenso wie
 * `expect.soft(…)`. Eine längere Kette zählt bewusst nicht: bei `expect(x).toBe(y)` ist der
 * äussere Aufruf `toBe`, und nur der innere trägt das geprüfte Argument.
 */
function istAufruf(call: ts.CallExpression, name: string): boolean {
  const c = call.expression;
  if (ts.isIdentifier(c)) {
    return c.text === name;
  }
  return (
    ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) && c.expression.text === name
  );
}

function aufrufeIn(wurzel: ts.Node, name: string): ts.CallExpression[] {
  return alleKnoten(wurzel).filter(
    (n): n is ts.CallExpression => ts.isCallExpression(n) && istAufruf(n, name),
  );
}

function findByIdAufrufe(knoten: ts.Node): ts.CallExpression[] {
  return alleKnoten(knoten).filter(
    (n): n is ts.CallExpression => ts.isCallExpression(n) && aufrufName(n) === "findById",
  );
}

function istFunktion(n: ts.Node): boolean {
  return ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n);
}

/** `await (x as T)` → `x`: Hüllen, die den Wert nicht ändern, werden abgetragen. */
function ausgepackt(e: ts.Expression): ts.Expression {
  let k = e;
  while (
    ts.isParenthesizedExpression(k) ||
    ts.isAwaitExpression(k) ||
    ts.isAsExpression(k) ||
    ts.isNonNullExpression(k)
  ) {
    k = k.expression;
  }
  return k;
}

function fallname(call: ts.CallExpression, sf: ts.SourceFile): string {
  const erstes = call.arguments[0];
  if (erstes === undefined) {
    return "(ohne Namen)";
  }
  return ts.isStringLiteralLike(erstes) ? erstes.text : erstes.getText(sf);
}

/** Der Bezeichner, an den ein Rücklesewert gebunden wird — oder `undefined`, wenn keiner dasteht. */
function gebundenerName(call: ts.CallExpression): string | undefined {
  let k: ts.Node = call;
  while (
    k.parent !== undefined &&
    (ts.isAwaitExpression(k.parent) ||
      ts.isParenthesizedExpression(k.parent) ||
      ts.isAsExpression(k.parent) ||
      ts.isNonNullExpression(k.parent))
  ) {
    k = k.parent;
  }
  const eltern = k.parent;
  return eltern !== undefined && ts.isVariableDeclaration(eltern) && ts.isIdentifier(eltern.name)
    ? eltern.name.text
    : undefined;
}

/** Was DIESER Rückruf herausgibt: der Ausdruck eines Kurzrumpfs oder jedes `return …` seines Rumpfs. */
function rueckgaben(fn: ts.Node): ts.Expression[] {
  if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && !ts.isBlock(fn.body)) {
    return [fn.body];
  }
  const raus: ts.Expression[] = [];
  const gehe = (n: ts.Node): void => {
    // Ein `return` in einer verschachtelten Funktion gehört dieser, nicht dem Rückruf.
    if (n !== fn && istFunktion(n)) {
      return;
    }
    if (ts.isReturnStatement(n) && n.expression !== undefined) {
      raus.push(n.expression);
    }
    n.forEachChild(gehe);
  };
  gehe(fn);
  return raus;
}

/**
 * Die `const`/`let`-Bindungen im Rückruf: Name → Initialisierer. Ein zweimal vergebener Name wird
 * `mehrdeutig` — dann rät der Wächter NICHT, sondern behandelt den Wert als unverfolgt.
 */
function bindungen(fn: ts.Node): Map<string, ts.Expression | "mehrdeutig"> {
  const raus = new Map<string, ts.Expression | "mehrdeutig">();
  for (const n of alleKnoten(fn)) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer !== undefined) {
      raus.set(n.name.text, raus.has(n.name.text) ? "mehrdeutig" : n.initializer);
    }
  }
  return raus;
}

/**
 * Löst einen Ausdruck bis zu der Form auf, die den Wert wirklich trägt: eine lokale
 * Zwischenvariable wird über ihre Bindung verfolgt — `const d = await repo.findById("x");
 * return d;` (BEN zu Runde 1, Korrekturpflicht 1; Runde 1 sah in dieser Form gar keine Rücklesung).
 * `undefined` heisst NICHT auflösbar; der Aufrufer beanstandet das, statt es durchgehen zu lassen.
 */
function aufgeloest(
  ausdruck: ts.Expression,
  binde: Map<string, ts.Expression | "mehrdeutig">,
  tiefe = 0,
): ts.Expression | undefined {
  const kern = ausgepackt(ausdruck);
  if (!ts.isIdentifier(kern)) {
    return kern;
  }
  const gebunden = binde.get(kern.text);
  // Zu lange oder zyklische Ketten (`const a = b; const b = a;`) enden hier als „nicht auflösbar".
  if (gebunden === undefined || gebunden === "mehrdeutig" || tiefe >= 8) {
    return undefined;
  }
  return aufgeloest(gebunden, binde, tiefe + 1);
}

/** Eine Stelle, an der ein zurückgelesener Datensatz beim Aufrufer ankommt und prüfbar wird. */
interface Stelle {
  /** Eigenschaft eines zurückgegebenen Objektliterals, oder `undefined`: der Wert selbst. */
  unterpfad: string | undefined;
  /** Der `findById`-Aufruf, der über diese Stelle prüfbar wird — der Wert SELBST, nicht ein enthaltener. */
  gedeckt: ts.CallExpression;
}

interface Rueckleseerhebung {
  stellen: Stelle[];
  /**
   * `findById`-Aufrufe im Rückruf, deren Wert KEINE prüfbare Stelle erreicht: eine fremde
   * Hilfsfunktion, ein weggeworfener Lesewert, eine mehrdeutige Bindung. Sie gelten NICHT still als
   * vollständig (BENs Promptverbesserung zu Runde 1) — „unbekannte Form" ist ein Befund, kein
   * Freispruch.
   */
  unverfolgt: ts.CallExpression[];
}

/**
 * Was ein `mitNeuemPool(…)`-Aufruf zurückgibt, aufgeschlüsselt nach prüfbaren Stellen und dem, was
 * der Wächter nicht verfolgen kann. Die Zuordnung ist lückenlos: jeder `findById`-Aufruf des
 * Rückrufs landet in genau einem der beiden Töpfe.
 */
function ruecklesungenIn(call: ts.CallExpression): Rueckleseerhebung {
  const letztes = call.arguments[call.arguments.length - 1];
  if (letztes === undefined || !istFunktion(letztes)) {
    return { stellen: [], unverfolgt: [] };
  }
  const alle = findByIdAufrufe(letztes);
  if (alle.length === 0) {
    // Ein reiner Schreibfall: es gibt nichts zurückzulesen, also auch nichts zu beanstanden.
    return { stellen: [], unverfolgt: [] };
  }
  const binde = bindungen(letztes);
  const stellen: Stelle[] = [];
  /**
   * Eine Stelle entsteht NUR, wenn der herausgegebene Wert der Leseaufruf SELBST ist (Hüllen wie
   * `await`/Klammern/`as` abgetragen, Zwischenvariablen über `aufgeloest` verfolgt). Ein bloss
   * ENTHALTENER `findById`-Aufruf genügt nicht: bei `return zusammengefasst(await repo.findById(…))`
   * prüfen die vier Zusicherungen das Ergebnis einer unbekannten Umformung, nicht den gelesenen
   * Datensatz — dass beide gleich sind, ist unbelegt (BEN zu Runde 2, Korrekturpflicht 1). Was hier
   * nicht ankommt, fällt unten als `unverfolgt` auf, also als Befund, nicht als Freispruch.
   */
  const nimm = (unterpfad: string | undefined, wert: ts.Expression): void => {
    const kern = ausgepackt(wert);
    if (ts.isCallExpression(kern) && aufrufName(kern) === "findById") {
      stellen.push({ unterpfad, gedeckt: kern });
    }
  };
  for (const ausdruck of rueckgaben(letztes)) {
    const kern = aufgeloest(ausdruck, binde);
    if (kern === undefined) {
      continue; // nicht auflösbar — fällt unten als „unverfolgt" auf
    }
    if (ts.isObjectLiteralExpression(kern)) {
      for (const eig of kern.properties) {
        // `{ ohne }` — die Kurzschreibweise trägt den Wert über die gleichnamige Bindung.
        if (ts.isShorthandPropertyAssignment(eig)) {
          const wert = aufgeloest(eig.name, binde);
          if (wert !== undefined) {
            nimm(eig.name.text, wert);
          }
          continue;
        }
        if (
          ts.isPropertyAssignment(eig) &&
          (ts.isIdentifier(eig.name) || ts.isStringLiteralLike(eig.name))
        ) {
          const wert = aufgeloest(eig.initializer, binde);
          if (wert !== undefined) {
            nimm(eig.name.text, wert);
          }
        }
        // Alles andere (`...spread`, berechnete Namen) bleibt unzugeordnet und fällt unten auf.
      }
      continue;
    }
    nimm(undefined, kern);
  }
  const gedeckt = new Set<ts.Node>(stellen.map((s) => s.gedeckt));
  return { stellen, unverfolgt: alle.filter((n) => !gedeckt.has(n)) };
}

/** Leerraum, `!` und Klammern weg: `(zurueck)!` und `zurueck` sind derselbe Bezeichner. */
function normalisiert(text: string): string {
  return text.replace(/[\s!()]/g, "");
}

/**
 * Hängt an diesem `expect(…)` ein AUFGERUFENER Matcher? `expect(x).toBe(y)`,
 * `expect(x).not.toBeNull()`, `expect.soft(x).toBe(y)` — ja. Das blosse `expect(zurueck?.status);`
 * prüft dagegen nichts und zählt deshalb nicht (BEN zu Runde 1, Korrekturpflicht 2): sonst genügte
 * es, ein Feld zu NENNEN, um den Wächter zufriedenzustellen.
 */
function matcherAufgerufen(zusicherung: ts.CallExpression): boolean {
  let k: ts.Node = zusicherung;
  while (
    k.parent !== undefined &&
    ts.isPropertyAccessExpression(k.parent) &&
    k.parent.expression === k
  ) {
    k = k.parent;
    const eltern = k.parent;
    if (eltern !== undefined && ts.isCallExpression(eltern) && eltern.expression === k) {
      return true;
    }
  }
  return false;
}

/** Je Bezeichnerpfad: welche der vier Felder in einer `expect(…)`-Zusicherung stehen, und ab welcher Zeile. */
function zugesichert(
  fall: ts.CallExpression,
  sf: ts.SourceFile,
): Map<string, { felder: Set<string>; zeile: number }> {
  const raus = new Map<string, { felder: Set<string>; zeile: number }>();
  for (const zusicherung of aufrufeIn(fall, "expect")) {
    const geprueft = zusicherung.arguments[0];
    if (geprueft === undefined || !matcherAufgerufen(zusicherung)) {
      continue;
    }
    const zeile = zeileVon(sf, zusicherung);
    for (const n of alleKnoten(geprueft)) {
      let basis: string | undefined;
      let feld: string | undefined;
      if (ts.isPropertyAccessExpression(n)) {
        basis = normalisiert(n.expression.getText(sf));
        feld = n.name.text;
      } else if (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression)) {
        // `gelesen.ohne?.["status"]` ist dieselbe Zusicherung in anderer Schreibweise.
        basis = normalisiert(n.expression.getText(sf));
        feld = n.argumentExpression.text;
      }
      if (
        basis === undefined ||
        feld === undefined ||
        !(FELDER as readonly string[]).includes(feld)
      ) {
        continue;
      }
      const eintrag = raus.get(basis);
      if (eintrag === undefined) {
        raus.set(basis, { felder: new Set([feld]), zeile });
      } else {
        eintrag.felder.add(feld);
      }
    }
  }
  return raus;
}

/**
 * Die Erhebung über EINE Quelle.
 *
 * ZUSTANDSMODELL (Auftrag §9): eine leere, unlesbare oder syntaktisch kaputte Quelle und eine
 * Quelle ohne `it(…)`-Block sind ein FEHLER mit Pfad — niemals „keine Befunde". Ein Wächter, der
 * schweigt, weil er nichts gelesen hat, ist eine Falschaussage.
 */
function erhebe(quelle: Quelle): Erhebung {
  if (quelle.text.trim() === "") {
    throw new Error(
      `${quelle.datei}: leer — der Wächter hat nichts gelesen und sagt deshalb NICHT „keine Befunde".`,
    );
  }
  if (quelle.leseFehler.length > 0) {
    throw new Error(
      `${quelle.datei}: nicht auswertbar — ${quelle.leseFehler.join(" · ")}. Keine Entwarnung ohne Lesung.`,
    );
  }
  const sf = quelle.ast;
  const faelle = aufrufeIn(sf, "it");
  if (faelle.length === 0) {
    throw new Error(
      `${quelle.datei}: kein it(…)-Block gefunden — entweder ist die Datei umgebaut oder die Erhebung greift daneben. Keine Entwarnung ohne Lesung.`,
    );
  }
  const ruecklesungen: Ruecklesung[] = [];
  const befunde: Befund[] = [];
  for (const fall of faelle) {
    const name = fallname(fall, sf);
    const zusicherungen = zugesichert(fall, sf);
    const gesehen = new Set<string>();
    for (const aufruf of aufrufeIn(fall, "mitNeuemPool")) {
      const zeileDesLesens = zeileVon(sf, aufruf);
      const basis = gebundenerName(aufruf);
      const { stellen, unverfolgt } = ruecklesungenIn(aufruf);
      // Zuerst das, was der Wächter NICHT versteht: lieber ein Befund zu viel als eine stille
      // Entwarnung über eine Rückleseform, die niemand geprüft hat.
      for (const offen of unverfolgt) {
        befunde.push({
          datei: quelle.datei,
          zeile: zeileVon(sf, offen),
          fall: name,
          bezeichner: offen.getText(sf),
          fehlend: FELDER,
          art: "unverfolgt",
        });
      }
      for (const stelle of stellen) {
        const unterpfad = stelle.unterpfad;
        if (basis === undefined) {
          befunde.push({
            datei: quelle.datei,
            zeile: zeileDesLesens,
            fall: name,
            bezeichner: "(ungebunden)",
            fehlend: FELDER,
            art: "nicht-gebunden",
          });
          continue;
        }
        const pfad = unterpfad === undefined ? basis : `${basis}.${unterpfad}`;
        if (gesehen.has(pfad)) {
          continue;
        }
        gesehen.add(pfad);
        ruecklesungen.push({ fall: name, bezeichner: pfad, zeile: zeileDesLesens });
        const eintrag = zusicherungen.get(pfad);
        const fehlend = FELDER.filter((feld) => eintrag?.felder.has(feld) !== true);
        if (fehlend.length > 0) {
          befunde.push({
            datei: quelle.datei,
            zeile: eintrag?.zeile ?? zeileDesLesens,
            fall: name,
            bezeichner: pfad,
            fehlend,
            art: "felder-fehlen",
          });
        }
      }
    }
  }
  return { faelle: faelle.length, ruecklesungen, befunde };
}

/** Eine Quelle von Platte — mit Pfad im Fehlerfall statt stiller Entwarnung. */
function geladen(datei: string): Quelle {
  try {
    return ladeQuelle(datei);
  } catch (fehler) {
    throw new Error(
      `${datei} (Wurzel ${WURZEL}): nicht lesbar — ${(fehler as Error).message}. Keine Entwarnung ohne Lesung.`,
    );
  }
}

let gemessen: Quelle | undefined;

/** Die echte Datei, EINMAL je Lauf gelesen — der Torlauf ist der Engpass der Maschine. */
function gemesseneQuelle(): Quelle {
  gemessen ??= geladen(GEMESSENE_DATEI);
  return gemessen;
}

function attrappe(name: string, text: string): Quelle {
  return quelleAus(name, text);
}

/** 1-basierte Zeile eines Textstücks in einer Attrappe — gerechnet, nicht abgeschrieben. */
function zeileMit(text: string, stueck: string): number {
  const zeilen = text.split("\n");
  const index = zeilen.findIndex((z) => z.includes(stueck));
  if (index < 0) {
    throw new Error(`Attrappe enthält „${stueck}" nicht — der Fall würde ins Leere prüfen.`);
  }
  return index + 1;
}

// ================================================================================================
// L3 — DIE ECHTE DATEI
// ================================================================================================
describe("JOB 3940 · L3: jeder Rücklesefall der Integrationsdatei prüft alle vier Felder", () => {
  it("L3.1: die Erhebung fällt nicht still auf null — drei Rücklesungen in neun Fällen", () => {
    const { faelle, ruecklesungen } = erhebe(gemesseneQuelle());
    // Gemessen am Basisstand be4e00f: 9 `it(…)`-Blöcke, davon drei Rücklesungen über einen neuen
    // Pool. Untergrenzen, nicht Pins: ein VIERTER Rücklesefall darf dazukommen — er muss dann nur
    // (L3.2) alle vier Felder prüfen. Fällt die Zahl darunter, ist ein Beleg verschwunden.
    expect(faelle).toBeGreaterThanOrEqual(9);
    expect(ruecklesungen.length).toBeGreaterThanOrEqual(3);
    expect(ruecklesungen.map((r) => r.bezeichner)).toEqual(
      expect.arrayContaining(["zurueck", "gelesen.ohne", "gelesen.mit"]),
    );
  });

  it("L3.2: kein zurückgelesener Bezeichner lässt eines der vier Felder aus", () => {
    const { befunde } = erhebe(gemesseneQuelle());
    // Die Meldungen selbst sind die Zusicherung: sie nennen Datei, Zeile, Fallname und Feld, also
    // genau das, was ein Mensch braucht, um die Stelle zu öffnen.
    expect(befunde.map(meldung)).toEqual([]);
  });
});

// ================================================================================================
// L4 — DIE KALIBRIERUNG: GEGEN ATTRAPPEN, NICHT GEGEN DIE ECHTE DATEI
// ================================================================================================
// Ein Wächter, der pauschal beanstandet, ist nach kurzer Zeit abgeschaltet. Die Fälle hier messen
// deshalb BEIDE Richtungen an gestellten Quelltexten: was grün bleiben MUSS, und was rot werden
// muss — samt der Frage, ob die Meldung das fehlende Feld überhaupt nennt.
const VOLLSTAENDIG = `import { describe, expect, it } from "vitest";

describe("Attrappe", () => {
  it("A: die Entscheidung ist nach neuem Verbindungsaufbau vollständig lesbar", async (ctx) => {
    const p = requirePool(ctx);
    await mitNeuemPool(p, (_repo, dienst) => dienst.resolve("a1", "controller-1", "Grund"));
    const zurueck = await mitNeuemPool(p, (repo) => repo.findById("a1"));
    expect(zurueck?.status).toBe("geloest");
    expect(zurueck?.decidedBy).toBe("controller-1");
    expect(zurueck?.decision).toBe("Grund");
    expect(zurueck?.resolutionReason).toBe("decided");
  });
});
`;

const DREI_VON_VIER = `import { describe, expect, it } from "vitest";

describe("Attrappe", () => {
  it("B: drei von vier Feldern", async (ctx) => {
    const p = requirePool(ctx);
    const zurueck = await mitNeuemPool(p, (repo) => repo.findById("b1"));
    expect(zurueck?.status).toBe("geloest");
    expect(zurueck?.decision).toBe("Grund");
    expect(zurueck?.resolutionReason).toBe("decided");
  });
});
`;

const NUR_SCHREIBEND = `import { describe, expect, it } from "vitest";

describe("Attrappe", () => {
  it("C: schreibt nur, liest nichts zurück", async (ctx) => {
    const p = requirePool(ctx);
    await mitNeuemPool(p, (_repo, dienst) => dienst.dismiss("c1", "controller-1"));
    const rows = await p.query("SELECT data FROM conflicts WHERE id='c1'");
    expect(rows.rowCount).toBe(1);
  });
});
`;

const UNGEBUNDEN = `import { describe, expect, it } from "vitest";

describe("Attrappe", () => {
  it("D: liest zurück, ohne den Wert zu binden", async (ctx) => {
    const p = requirePool(ctx);
    await mitNeuemPool(p, (repo) => repo.findById("d1"));
    expect(true).toBe(true);
  });
});
`;

const ZWEIG_VOLLSTAENDIG = `import { describe, expect, it } from "vitest";

describe("Attrappe", () => {
  it("E: zwei Zweige, beide vollständig", async (ctx) => {
    const p = requirePool(ctx);
    const gelesen = await mitNeuemPool(p, async (repo) => ({
      ohne: await repo.findById("ohne"),
      mit: await repo.findById("mit"),
    }));
    expect(gelesen.ohne?.status).toBe("geloest");
    expect(gelesen.ohne?.decidedBy).toBe("controller-1");
    expect(gelesen.ohne?.decision).toBeNull();
    expect(gelesen.ohne?.resolutionReason).toBe("dismissed");
    expect(gelesen.mit?.status).toBe("geloest");
    expect(gelesen.mit?.decidedBy).toBe("controller-1");
    expect(gelesen.mit?.decision).toBe("Grund");
    expect(gelesen.mit?.resolutionReason).toBe("decided");
  });
});
`;

const ZWEIG_UNVOLLSTAENDIG = ZWEIG_VOLLSTAENDIG.replace(
  '    expect(gelesen.mit?.status).toBe("geloest");\n',
  "",
);

// ------------------------------------------------------------------------------------------------
// BEN zu Runde 1, Korrekturpflicht 1: die lokale Zwischenvariable. Die Rückgabe des Rückrufs ist
// hier nicht der `findById`-Aufruf selbst, sondern ein Bezeichner, der ihn trägt. Runde 1 sah in
// dieser Form GAR KEINE Rücklesung — ein solcher Fall hätte alle vier Felder auslassen können, ohne
// dass der Wächter etwas gemeldet hätte.
// ------------------------------------------------------------------------------------------------
const ZWISCHENVARIABLE = `import { describe, expect, it } from "vitest";

describe("Attrappe", () => {
  it("H: Rücklesen über eine lokale Zwischenvariable", async (ctx) => {
    const p = requirePool(ctx);
    const weiterer = await mitNeuemPool(p, async (repo) => {
      const datensatz = await repo.findById("ohne");
      return datensatz;
    });
    expect(weiterer?.status).toBe("geloest");
    expect(weiterer?.decidedBy).toBe("controller-1");
    expect(weiterer?.decision).toBeNull();
    expect(weiterer?.resolutionReason).toBe("dismissed");
  });
});
`;

const ZWISCHENVARIABLE_OHNE_STATUS = ZWISCHENVARIABLE.replace(
  '    expect(weiterer?.status).toBe("geloest");\n',
  "",
);

// BEN zu Runde 1, Korrekturpflicht 2: `expect(x)` OHNE aufgerufenen Matcher prüft nichts. Runde 1
// zählte das Feld trotzdem als zugesichert — damit hätte das blosse NENNEN eines Feldes genügt.
const OHNE_MATCHER = VOLLSTAENDIG.replace(
  'expect(zurueck?.status).toBe("geloest");',
  "expect(zurueck?.status);",
);

// Die Gegenrichtung zu OHNE_MATCHER: echte, nur ungewöhnlich geschriebene Ketten MÜSSEN zählen,
// sonst beanstandet der Wächter gültige Zusicherungen.
const MATCHER_KETTEN = `import { describe, expect, it } from "vitest";

describe("Attrappe", () => {
  it("J2: ungewöhnliche, aber echte Matcher-Ketten zählen", async (ctx) => {
    const p = requirePool(ctx);
    const zurueck = await mitNeuemPool(p, (repo) => repo.findById("j1"));
    expect(zurueck?.status).not.toBe("offen");
    expect.soft(zurueck?.decidedBy).toBe("controller-1");
    expect(zurueck?.decision).toBeNull();
    expect(zurueck?.resolutionReason).toBe("decided");
  });
});
`;

// Die dritte Form, die nicht still durchgehen darf: der Lesewert verschwindet in einer fremden
// Hilfsfunktion. Alle vier Felder werden hier zugesichert — aber an einem Wert, von dem der Wächter
// nicht weiss, ob er der zurückgelesene Datensatz ist. „Unbekannt" ist nicht „vollständig".
const UNVERFOLGBAR = `import { describe, expect, it } from "vitest";

describe("Attrappe", () => {
  it("K: der Lesewert verschwindet in einer fremden Hilfsfunktion", async (ctx) => {
    const p = requirePool(ctx);
    const gefaltet = await mitNeuemPool(p, async (repo) => {
      const datensatz = await repo.findById("ohne");
      return zusammengefasst(datensatz);
    });
    expect(gefaltet?.status).toBe("geloest");
    expect(gefaltet?.decidedBy).toBe("controller-1");
    expect(gefaltet?.decision).toBeNull();
    expect(gefaltet?.resolutionReason).toBe("dismissed");
  });
});
`;

// Dieselbe unbekannte Umformung, nur OHNE Zwischenvariable — BENs Gegenprobe zu Runde 2, wörtlich:
// der Leseaufruf steht jetzt IM Argument der fremden Funktion. Runde 2 gab hier `befunde: []`, weil
// ein syntaktisch enthaltener `findById`-Aufruf als gedeckt galt. Ein enthaltener Leseaufruf beweist
// aber nicht, dass der zurückgegebene Wert dieser Datensatz ist.
const UNVERFOLGBAR_EINGEBETTET = UNVERFOLGBAR.replace(
  '      const datensatz = await repo.findById("ohne");\n      return zusammengefasst(datensatz);\n',
  '      return zusammengefasst(await repo.findById("ohne"));\n',
);

// Und dieselbe Falle im Objektliteral: der Zweig trägt nicht den Datensatz, sondern das Ergebnis
// einer unbekannten Umformung über ihm.
const ZWEIG_EINGEBETTET = ZWEIG_VOLLSTAENDIG.replace(
  '      ohne: await repo.findById("ohne"),',
  '      ohne: zusammengefasst(await repo.findById("ohne")),',
);

// Und die vierte: gelesen, aber nie herausgegeben. Es kommt nichts an, also ist auch nichts geprüft.
const WEGGEWORFEN = `import { describe, expect, it } from "vitest";

describe("Attrappe", () => {
  it("L: liest zurück und wirft den Wert weg", async (ctx) => {
    const p = requirePool(ctx);
    await mitNeuemPool(p, async (repo) => {
      await repo.findById("ohne");
    });
    expect(true).toBe(true);
  });
});
`;

describe("JOB 3940 · L4: der Wächter ist kalibriert, nicht pauschal", () => {
  it("L4a: ein vollständiger Fall gibt KEINEN Befund", () => {
    const { ruecklesungen, befunde } = erhebe(attrappe("a-vollstaendig.ts", VOLLSTAENDIG));
    expect(ruecklesungen.map((r) => r.bezeichner)).toEqual(["zurueck"]);
    expect(befunde.map(meldung)).toEqual([]);
  });

  it("L4b: drei von vier Feldern geben GENAU EINEN Befund, der das fehlende Feld nennt", () => {
    const { befunde } = erhebe(attrappe("b-drei-von-vier.ts", DREI_VON_VIER));
    expect(befunde).toHaveLength(1);
    const eins = befunde[0] as Befund;
    expect(eins.fehlend).toEqual(["decidedBy"]);
    expect(eins.bezeichner).toBe("zurueck");
    expect(eins.fall).toBe("B: drei von vier Feldern");
    // Die Zeile ist die erste Zusicherung dieses Bezeichners — dort schlägt ein Mensch nach.
    expect(eins.zeile).toBe(zeileMit(DREI_VON_VIER, "expect(zurueck?.status)"));
    expect(meldung(eins)).toBe(
      `b-drei-von-vier.ts:${zeileMit(DREI_VON_VIER, "expect(zurueck?.status)")} · Fall „B: drei von vier Feldern" · zurueck — fehlende Felder: decidedBy`,
    );
  });

  it("L4c: ein Fall, der gar nichts zurückliest, gibt KEINEN Befund", () => {
    const { ruecklesungen, befunde } = erhebe(attrappe("c-nur-schreibend.ts", NUR_SCHREIBEND));
    expect(ruecklesungen).toEqual([]);
    expect(befunde.map(meldung)).toEqual([]);
  });

  it("L4d: ein Rücklesewert ohne Bezeichner wird beanstandet, nicht überlesen", () => {
    const { befunde } = erhebe(attrappe("d-ungebunden.ts", UNGEBUNDEN));
    expect(befunde).toHaveLength(1);
    const eins = befunde[0] as Befund;
    expect(eins.art).toBe("nicht-gebunden");
    expect(meldung(eins)).toContain("bindet das Ergebnis aber an keinen Bezeichner");
    expect(meldung(eins)).toContain(
      `d-ungebunden.ts:${zeileMit(UNGEBUNDEN, 'repo.findById("d1")')}`,
    );
  });

  it("L4e: zwei Zweige aus EINEM Objektliteral werden getrennt geprüft — vollständig ist grün", () => {
    const { ruecklesungen, befunde } = erhebe(attrappe("e-zweige.ts", ZWEIG_VOLLSTAENDIG));
    expect(ruecklesungen.map((r) => r.bezeichner)).toEqual(["gelesen.ohne", "gelesen.mit"]);
    expect(befunde.map(meldung)).toEqual([]);
  });

  it("L4f: fehlt der Status in EINEM Zweig, trifft der Befund genau diesen Zweig", () => {
    const { befunde } = erhebe(attrappe("f-zweige-unvollstaendig.ts", ZWEIG_UNVOLLSTAENDIG));
    expect(befunde.map(meldung)).toEqual([
      `f-zweige-unvollstaendig.ts:${zeileMit(ZWEIG_UNVOLLSTAENDIG, "expect(gelesen.mit?.decidedBy)")} · Fall „E: zwei Zweige, beide vollständig" · gelesen.mit — fehlende Felder: status`,
    ]);
  });

  it("L4h: eine lokale Zwischenvariable wird verfolgt — vollständig ist grün", () => {
    const { ruecklesungen, befunde } = erhebe(attrappe("h-zwischen.ts", ZWISCHENVARIABLE));
    // Die Positivkontrolle zu L4i: dieselbe Form, nur vollständig — hier darf NICHTS kommen.
    expect(ruecklesungen.map((r) => r.bezeichner)).toEqual(["weiterer"]);
    expect(befunde.map(meldung)).toEqual([]);
  });

  it("L4i: fehlt der Status hinter einer Zwischenvariable, wird er benannt — nicht überlesen", () => {
    const { ruecklesungen, befunde } = erhebe(
      attrappe("i-zwischen-ohne-status.ts", ZWISCHENVARIABLE_OHNE_STATUS),
    );
    expect(ruecklesungen.map((r) => r.bezeichner)).toEqual(["weiterer"]);
    expect(befunde.map(meldung)).toEqual([
      `i-zwischen-ohne-status.ts:${zeileMit(ZWISCHENVARIABLE_OHNE_STATUS, "expect(weiterer?.decidedBy)")} · Fall „H: Rücklesen über eine lokale Zwischenvariable" · weiterer — fehlende Felder: status`,
    ]);
  });

  it("L4j: expect(feld) OHNE aufgerufenen Matcher ist keine Zusicherung", () => {
    const { befunde } = erhebe(attrappe("j-ohne-matcher.ts", OHNE_MATCHER));
    expect(befunde).toHaveLength(1);
    expect((befunde[0] as Befund).fehlend).toEqual(["status"]);
    // Gegenrichtung, damit die Schärfe nicht in Pauschalität kippt: mit Matcher ist derselbe Text
    // grün (L4a, `VOLLSTAENDIG`) — und echte Ketten zählen ebenfalls.
    expect(erhebe(attrappe("j2-ketten.ts", MATCHER_KETTEN)).befunde.map(meldung)).toEqual([]);
  });

  it("L4k: ein Lesewert, den der Wächter nicht verfolgen kann, gilt NICHT als vollständig", () => {
    const { befunde } = erhebe(attrappe("k-unverfolgbar.ts", UNVERFOLGBAR));
    expect(befunde).toHaveLength(1);
    const eins = befunde[0] as Befund;
    expect(eins.art).toBe("unverfolgt");
    expect(eins.zeile).toBe(zeileMit(UNVERFOLGBAR, 'repo.findById("ohne")'));
    expect(meldung(eins)).toContain("erreicht keinen prüfbaren Bezeichner");
  });

  it("L4m: eine unbekannte Umformung DIREKT um den Leseaufruf gilt ebenfalls nicht als vollständig", () => {
    // BEN zu Runde 2, Korrekturpflicht 1: L4k prüfte diese Form nur MIT Zwischenvariable. Ohne sie
    // gab Runde 2 `befunde: []` — der enthaltene Leseaufruf allein begründete die Deckung.
    const { ruecklesungen, befunde } = erhebe(
      attrappe("m-unverfolgbar-eingebettet.ts", UNVERFOLGBAR_EINGEBETTET),
    );
    expect(ruecklesungen).toEqual([]);
    expect(befunde).toHaveLength(1);
    const eins = befunde[0] as Befund;
    expect(eins.art).toBe("unverfolgt");
    expect(eins.fall).toBe("K: der Lesewert verschwindet in einer fremden Hilfsfunktion");
    expect(eins.zeile).toBe(
      zeileMit(UNVERFOLGBAR_EINGEBETTET, 'zusammengefasst(await repo.findById("ohne"))'),
    );
    expect(meldung(eins)).toContain(
      `m-unverfolgbar-eingebettet.ts:${eins.zeile} · Fall „K: der Lesewert verschwindet in einer fremden Hilfsfunktion"`,
    );
    expect(meldung(eins)).toContain("erreicht keinen prüfbaren Bezeichner");
    // Die beiden positiven Kontrollen dazu, damit die Schärfe nicht in Pauschalität kippt: die
    // direkte Rückgabe (VOLLSTAENDIG, wie in der echten Datei) und die gewöhnliche
    // Zwischenvariable bleiben ohne Befund.
    expect(erhebe(attrappe("m2-direkt.ts", VOLLSTAENDIG)).befunde.map(meldung)).toEqual([]);
    expect(erhebe(attrappe("m3-zwischen.ts", ZWISCHENVARIABLE)).befunde.map(meldung)).toEqual([]);
  });

  it("L4n: dieselbe Umformung IM Objektliteral trifft genau diesen Zweig — der andere bleibt gedeckt", () => {
    const { ruecklesungen, befunde } = erhebe(
      attrappe("n-zweig-eingebettet.ts", ZWEIG_EINGEBETTET),
    );
    // Nur `ohne` verschwindet in der Umformung; `mit` wird weiterhin direkt herausgegeben und ist
    // vollständig zugesichert — also genau ein Befund, nicht zwei.
    expect(ruecklesungen.map((r) => r.bezeichner)).toEqual(["gelesen.mit"]);
    expect(befunde).toHaveLength(1);
    const eins = befunde[0] as Befund;
    expect(eins.art).toBe("unverfolgt");
    expect(eins.zeile).toBe(
      zeileMit(ZWEIG_EINGEBETTET, 'zusammengefasst(await repo.findById("ohne"))'),
    );
  });

  it("L4l: ein gelesener, aber weggeworfener Wert wird beanstandet, nicht überlesen", () => {
    const { ruecklesungen, befunde } = erhebe(attrappe("l-weggeworfen.ts", WEGGEWORFEN));
    expect(ruecklesungen).toEqual([]);
    expect(befunde).toHaveLength(1);
    expect((befunde[0] as Befund).art).toBe("unverfolgt");
  });

  it("L4g: ein Feldname in PROSA ist keine Zusicherung", () => {
    const mitKommentar = DREI_VON_VIER.replace(
      "    const zurueck =",
      "    // der decidedBy des Menschen steht in expect(zurueck?.decidedBy) — aber nur als Prosa\n    const zurueck =",
    );
    const { befunde } = erhebe(attrappe("g-prosa.ts", mitKommentar));
    expect(befunde).toHaveLength(1);
    expect((befunde[0] as Befund).fehlend).toEqual(["decidedBy"]);
  });
});

describe("JOB 3940 · L4/§9: keine Entwarnung ohne Lesung", () => {
  it("eine leere Quelle ist ein Fehler MIT PFAD, keine stille Entwarnung", () => {
    expect(() => erhebe(attrappe("leer.ts", "   \n"))).toThrow(/leer\.ts: leer/);
  });

  it("eine Quelle ohne it(…)-Block ist ein Fehler MIT PFAD", () => {
    expect(() => erhebe(attrappe("ohne-fall.ts", "export const x = 1;\n"))).toThrow(
      /ohne-fall\.ts: kein it\(…\)-Block/,
    );
  });

  it("eine syntaktisch kaputte Quelle ist ein Fehler MIT PFAD UND ZEILE", () => {
    expect(() => erhebe(attrappe("kaputt.ts", 'it("x", () => { const a = ;\n'))).toThrow(
      /kaputt\.ts: nicht auswertbar — kaputt\.ts:1/,
    );
  });

  it("eine fehlende Datei ist ein Fehler MIT PFAD, keine stille Entwarnung", () => {
    expect(() => geladen("services/conflicts/src/gibt-es-nicht.integration.test.ts")).toThrow(
      /gibt-es-nicht\.integration\.test\.ts .*: nicht lesbar — .*Keine Entwarnung ohne Lesung/,
    );
  });
});
