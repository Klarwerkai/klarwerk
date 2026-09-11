// ================================================================================================
// JOB 3575 · DER WÄCHTER GEGEN DEN RÜCKFALL — eine Quelle, ein Budget, eine sprechende Meldung.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Am 10.09. hat der Torlauf von JOB 3488 rot gemeldet, obwohl an der
// geprüften Arbeit nichts falsch war: EINE Datei dieses Ordners lief in ihre 30-s-Grenze
// (`page.waitForFunction: Timeout 30000ms exceeded`), 1634 andere Testdateien waren grün. Eine rote
// Runde kostet den fremden Job Zeit, Kontingent und eine Rundenzählung für etwas, das nicht in
// seinem Diff steht.
//
// Repariert wurde nicht „die Zahl", sondern die Bauart (`ux19-buehne.ts`, Abschnitt WARTEBUDGET).
// Diese Datei hält die Reparatur fest — und zwar an der Stelle, an der sie zurückfallen könnte:
//
//   W1  Im ganzen Ordnerbaum steht keine unmittelbare Zahlenfrist mehr ausser in der EINEN Quelle.
//   W1b Der Wächter sieht dabei wirklich in Unterordner — auf einem Wegwerfbaum kalibriert.
//   W2  Das Budget hängt am Fallrahmen, wächst mit dem Lastschalter und bleibt unter dem Rahmen.
//   W3  Läuft ein Warteschritt ab, nennt die Meldung Schritt, erwarteten Zustand, den zuletzt
//       gesehenen Flächentext und die Zähler der Entwurfsweiche.
//   W4  Der Fehlerabbruch greift bei JEDEM Fehlerausgang dieses Versuchs — auch bei einem, der
//       schneller da war als der Wartehelfer, und auch beim ZWEITEN mit identischem Wortlaut — und
//       bei keinem alten, keinem noch rechnenden und keinem gelungenen.
//   W5  „Geklickt" heisst betätigt: ein gesperrter Knopf wird nicht als geklickt gemeldet.
//   W6  Auch der Schritt, dessen Frist Playwright gehört (`neuLaden` → `goto`), meldet den Zustand.
//
// W4, W5 und W6 stehen über die drei im Auftrag (§6) geforderten Fälle hinaus: Pflichtlieferung 4
// (der Fehlerabbruch) wäre sonst ohne eigenen Beleg, Prüfpunkt 6 verlangt ausdrücklich die
// Gegenprobe „der Abbruch darf nur bei einem wirklich gezeigten Fehlerzustand greifen", und
// Pflichtlieferung 3 nennt `neuLaden` ausdrücklich mit.
//
// W1b, W4(d) und W6 sind die drei Korrekturpflichten aus Codex' Urteil zu Runde 1 — jede als
// eigener, für sich rot/grün entscheidbarer Fall. W4(f)–(h) sind die Korrekturpflicht aus Runde 2:
// die Fehlerfrische bei IDENTISCHEM Fehlertext, und die zwei Bedingungen, die sie tragen.
//
// WAS DIESE DATEI AUSDRÜCKLICH NICHT ERSETZT: den Nachweis am echten Chromium. Die drei Folgen
// (Fehler → Erfolg, Fehler A → Fehler B, Fehler A → Fehler A) fährt `F10` in
// `ganzdokument-am-echten-server.test.ts` gegen das echte Produkt und den echten Server.
//
// ================================================================================================
// DIE PROBEBÜHNE VON W3/W4 — was sie ist und was sie ausdrücklich NICHT belegt.
// ================================================================================================
// W3 und W4 fahren echte Bedienschritte (`aufFlaechensatzWarten`, `aufErfolgskastenWarten`) gegen
// eine HANDGEMACHTE Seite statt gegen Chromium. Das ist Absicht und hat eine Grenze:
//
//   · Gemessen wird der Warteweg der Bühne selbst — sein Takt, sein Budget, sein Abbruch und der
//     Wortlaut seiner Meldung. Dafür braucht es keinen Browser, und ein zweiter Chromium-Start in
//     der seriellen Browsergruppe kostete das Tor bei jedem Lauf Zeit.
//   · NICHT gemessen wird, ob das Produkt diese Zustände erzeugt. Das tun F1–F9 und V1–V6 am echten
//     Server; sie bleiben die Messung, diese Datei ist der Wächter über ihr Werkzeug.
//
// Die Entwurfsweiche der Probebühne ist dagegen die ECHTE (`entwurfsWeicheLegen`): W3 und W4
// schieben einen POST durch ihren wirklichen Routenumgang und lesen danach ihre wirklichen Zähler.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import { fn } from "../design/h3-blatt-buehne";
import {
  DECKEL_MS,
  ENTWURFS_PFAD,
  FALL_RAHMEN_MS,
  KLICK_KNOPF,
  LAST_SCHALTER,
  LAST_WERT,
  type SeiteMitDatei,
  WARTEBUDGET,
  WEICHE_FEHLERSATZ,
  type Warteschritt,
  type Weiche,
  aufErfolgskastenWarten,
  aufFlaechensatzWarten,
  entwurfsWeicheLegen,
  flaechensatz,
  lastfaktor,
  neuLaden,
  speicherversuchBeginnen,
  wartebudget,
} from "./ux19-buehne";

const ORDNER = dirname(fileURLToPath(import.meta.url));
const QUELLE = "ux19-buehne.ts";
/** Der Name der EINEN Deklaration, in deren Initialisierer eine unmittelbare Zahl stehen darf. */
const QUELLNAME = "WARTEBUDGET";

/**
 * Alle TypeScript-Dateien eines Baums — der Wächter sucht sich seine Menge selbst, und zwar
 * REKURSIV.
 *
 * WARUM REKURSIV (Codex' Korrekturpflicht 3). Runde 1 las nur die unmittelbaren Dateien des
 * Ordners. Die Zusage der Pflichtlieferung 6 lautet aber `tests/ux19-speichern-oeffnen-reload/**` —
 * mit Stern-Stern. Codex hat die Lücke aufgemacht: dieselbe harte Frist machte W1 direkt im Ordner
 * rot und in einem Unterordner NICHT. Ein Wächter, den ein `mkdir` aushebelt, ist keiner.
 *
 * Zurück kommen Pfade RELATIV zur Wurzel (`unter/tief.ts`), damit die Meldung den Fundort nennt und
 * die Ausnahme für die eine Quelle weiterhin nur für die Datei im Wurzelverzeichnis gilt.
 */
function baumdateien(wurzel: string, unterpfad = ""): readonly string[] {
  const hier = join(wurzel, unterpfad);
  const funde: string[] = [];
  for (const eintrag of readdirSync(hier, { withFileTypes: true })) {
    const pfad = unterpfad === "" ? eintrag.name : `${unterpfad}/${eintrag.name}`;
    if (eintrag.isDirectory()) {
      funde.push(...baumdateien(wurzel, pfad));
    } else if (eintrag.name.endsWith(".ts") || eintrag.name.endsWith(".tsx")) {
      funde.push(pfad);
    }
  }
  return funde.sort();
}

// ------------------------------------------------------------------------------------------------
// W1 — die Zahlensuche über den Syntaxbaum.
// ------------------------------------------------------------------------------------------------
//
// WARUM ÜBER DEN AST UND NICHT ÜBER ZEICHENKETTEN (dieselbe Lehre wie in
// `tests/tor-inventar/browser-gruppe.ts`): eine Textsuche nach `30_000` träfe die Begründungstexte
// in `ux19-buehne.ts` mit, die genau diese Zahlen ZITIEREN, und sie fände keinen einzigen der
// Umwege. Kommentare kommen im Syntaxbaum gar nicht vor.
//
// WELCHE UMWEGE DER WÄCHTER KENNT (Lehre JOB 3564 R2: ein Wächter, der nur die offensichtliche Form
// kennt, ist kein Wächter):
//   a) die unmittelbare Zahl — `30_000`, `1e4`, `0x7530`;
//   b) die Zeichenkette, die eine Zahl ist — `Number("30000")`, `+"30000"`;
//   c) die Rechnung aus Zahlen — `30 * 1000`, `60 * 500`, `90_000 / 3`;
//   d) der Typalias mit Literaltyp — `type Frist = 30000`;
//   e) die kleine Zahl an einer Frist-Stelle — `{ timeout: 900 }`, `const kurzeFrist = 12`.
// (a)–(d) fallen über die Grösse, (e) über den NAMEN der Stelle. Wer eine Frist verstecken will,
// muss beide Siebe zugleich umgehen.

/**
 * Die Schwelle kommt aus der EINEN Quelle — und sie wird erst beim Lauf gelesen, nicht beim Laden
 * der Datei. Grund: fällt die Quelle weg (Rücknahme-Gegenprobe, Rückfall auf den alten Stand),
 * soll JEDER Fall dieser Datei mit seinem eigenen Befund rot werden statt die ganze Datei beim
 * Import zu verlieren — „Test Files 1 failed · Tests no tests" sagt niemandem, was fehlt.
 */
function schwelle(): number {
  const wert = WARTEBUDGET?.waechterSchwelle;
  if (typeof wert !== "number") {
    throw new Error(
      "die eine Quelle `WARTEBUDGET` (samt `waechterSchwelle`) fehlt in ux19-buehne.ts — W1 hat keinen Maßstab",
    );
  }
  return wert;
}

/** Namen, an denen eine Zahl eine Frist IST, egal wie klein sie ist. */
const FRISTNAME = /frist|timeout|budget|delay|wartezeit/i;

interface Fund {
  datei: string;
  zeile: number;
  text: string;
  grund: string;
}

/** Faltet eine Konstantenrechnung zusammen — `null`, wenn sie keine reine Zahlenrechnung ist. */
function falteZahl(knoten: ts.Node): number | null {
  if (ts.isNumericLiteral(knoten)) {
    return Number(knoten.text.replace(/_/g, ""));
  }
  if (ts.isPrefixUnaryExpression(knoten)) {
    const innen = falteZahl(knoten.operand);
    if (innen === null) {
      return null;
    }
    if (knoten.operator === ts.SyntaxKind.MinusToken) {
      return -innen;
    }
    return knoten.operator === ts.SyntaxKind.PlusToken ? innen : null;
  }
  if (ts.isParenthesizedExpression(knoten)) {
    return falteZahl(knoten.expression);
  }
  if (ts.isBinaryExpression(knoten)) {
    const links = falteZahl(knoten.left);
    const rechts = falteZahl(knoten.right);
    if (links === null || rechts === null) {
      return null;
    }
    switch (knoten.operatorToken.kind) {
      case ts.SyntaxKind.AsteriskToken:
        return links * rechts;
      case ts.SyntaxKind.SlashToken:
        return rechts === 0 ? null : links / rechts;
      case ts.SyntaxKind.PlusToken:
        return links + rechts;
      case ts.SyntaxKind.MinusToken:
        return links - rechts;
      default:
        return null;
    }
  }
  return null;
}

/** Die Zeichenkette, die in Wahrheit eine Zahl ist. */
function zahlAusText(knoten: ts.Node): number | null {
  if (!ts.isStringLiteral(knoten) && !ts.isNoSubstitutionTemplateLiteral(knoten)) {
    return null;
  }
  const roh = knoten.text.trim();
  if (roh.length === 0) {
    return null;
  }
  const wert = Number(roh);
  return Number.isFinite(wert) ? wert : null;
}

/** Der Name der Stelle, an der ein Knoten hängt — Eigenschaft, Variable, Parameter. */
function stellenname(knoten: ts.Node): string | null {
  const eltern = knoten.parent;
  if (eltern === undefined) {
    return null;
  }
  if (ts.isPropertyAssignment(eltern) && eltern.initializer === knoten) {
    return eltern.name.getText();
  }
  if (
    (ts.isVariableDeclaration(eltern) || ts.isParameter(eltern)) &&
    eltern.initializer === knoten
  ) {
    return eltern.name.getText();
  }
  return null;
}

function zahlenfunde(wurzel: string, datei: string): readonly Fund[] {
  const SCHWELLE = schwelle();
  const pfad = join(wurzel, datei);
  const quelle = ts.createSourceFile(
    pfad,
    readFileSync(pfad, "utf8"),
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  // Der erlaubte Bereich: der Initialisierer der EINEN Quelle, und nur in ihrer Datei.
  let erlaubtVon = -1;
  let erlaubtBis = -1;
  const sucheQuelle = (n: ts.Node): void => {
    if (
      datei === QUELLE &&
      ts.isVariableDeclaration(n) &&
      n.name.getText() === QUELLNAME &&
      n.initializer !== undefined
    ) {
      erlaubtVon = n.initializer.getStart();
      erlaubtBis = n.initializer.getEnd();
    }
    ts.forEachChild(n, sucheQuelle);
  };
  sucheQuelle(quelle);

  const funde: Fund[] = [];
  const melde = (n: ts.Node, grund: string): void => {
    const start = n.getStart();
    if (start >= erlaubtVon && start < erlaubtBis) {
      return;
    }
    funde.push({
      datei,
      zeile: quelle.getLineAndCharacterOfPosition(start).line + 1,
      text: n.getText().replace(/\s+/g, " ").slice(0, 80),
      grund,
    });
  };
  const gehe = (n: ts.Node): void => {
    // (c)/(a): die Rechnung wird ALS GANZES gewertet; ihre Teile zählt der Wächter nicht doppelt.
    const gefaltet = falteZahl(n);
    if (gefaltet !== null) {
      const istTeilEinerRechnung =
        n.parent !== undefined &&
        falteZahl(n.parent) !== null &&
        !ts.isVariableDeclaration(n.parent);
      if (!istTeilEinerRechnung) {
        if (Math.abs(gefaltet) >= SCHWELLE) {
          melde(n, `unmittelbare Zahl ${gefaltet} ≥ ${SCHWELLE}`);
        } else {
          // (e): klein, aber an einer Frist-Stelle.
          const name = stellenname(n);
          if (name !== null && FRISTNAME.test(name)) {
            melde(n, `Zahl an der Frist-Stelle «${name}»`);
          }
        }
      }
      ts.forEachChild(n, gehe);
      return;
    }
    // (b): die Zeichenkette, die eine Zahl ist.
    const ausText = zahlAusText(n);
    if (ausText !== null && Math.abs(ausText) >= SCHWELLE) {
      melde(n, `Zeichenkette mit Zahlwert ${ausText} ≥ ${SCHWELLE}`);
    }
    ts.forEachChild(n, gehe);
  };
  gehe(quelle);
  return funde;
}

// ------------------------------------------------------------------------------------------------
// Die Probebühne für W3/W4.
// ------------------------------------------------------------------------------------------------

interface Probe {
  seite: SeiteMitDatei;
  /** Schiebt einen echten POST durch die gelegte Weiche — die Zähler steigen wirklich. */
  post: () => Promise<void>;
  /** Was die Ableser der Bühne als Flächentext sehen. */
  setzeText: (text: string) => void;
}

/**
 * Wie sich `goto` auf dieser Probebühne verhält. `null` = wird in diesem Fall nicht bedient (jeder
 * Aufruf ist dann ein Fehler und sagt das auch). W6 stellt hier den Wurf, den Playwright bei einer
 * abgelaufenen Navigationsfrist wirklich wirft.
 */
type GotoVerhalten = ((adresse: string) => Promise<void>) | null;

function probebuehne(starttext: string, gotoVerhalten: GotoVerhalten = null): Probe {
  let flaeche = starttext;
  let umgang: ((route: unknown) => Promise<void>) | null = null;
  const nichtGebraucht = (was: string) => (): never => {
    throw new Error(`Probebühne: «${was}» wird in diesem Fall nicht bedient`);
  };
  const seite = {
    route: async (_url: string, handler: (route: never) => Promise<void>): Promise<void> => {
      umgang = handler as unknown as (route: unknown) => Promise<void>;
    },
    // Die Bühne fragt die Fläche auf genau zwei Arten: OHNE Argument den ganzen Flächentext
    // (`SEITENTEXT`), MIT Argument den Zustandsableser.
    //
    // JOB 3575 R3 — WARUM DER ABLESER JETZT WIRKLICH LIEST. Bis hierher gab er stur `false` zurück,
    // „er soll hier nie erfüllt sein". Damit war der ERFOLGSAUSGANG auf dieser Probebühne nicht
    // darstellbar: `aufErfolgskastenWarten` konnte nie durchkommen, und genau der Fall, in dem ein
    // alter Fehlersatz neben dem Erfolgskasten steht (`Capture.tsx:1435-1438`, Toast nach
    // `ToastContext.tsx:28`), war nicht prüfbar. Der Ableser der Bühne ist `SATZ_STEHT` — ein
    // `includes` auf dem Flächentext; genau das tut diese Zeile. Die Fälle, die einen NIE erfüllten
    // Ableser brauchen (W3), bekommen ihn weiterhin: ihr Satz steht nicht auf ihrer Fläche.
    evaluate: async <T>(_f: unknown, arg?: unknown): Promise<T> =>
      (arg === undefined ? flaeche : flaeche.includes(String(arg))) as T,
    addInitScript: async (): Promise<void> => undefined,
    on: (): void => undefined,
    goto: gotoVerhalten ?? nichtGebraucht("goto"),
    waitForFunction: nichtGebraucht("waitForFunction"),
    keyboard: { press: nichtGebraucht("keyboard.press") },
    setInputFiles: nichtGebraucht("setInputFiles"),
    click: nichtGebraucht("click"),
  } as unknown as SeiteMitDatei;
  const route: Weiche = {
    request: () => ({ method: () => "POST", url: () => `${ENTWURFS_PFAD}` }),
    fulfill: async (): Promise<void> => undefined,
    abort: async (): Promise<void> => undefined,
    fallback: async (): Promise<void> => undefined,
  };
  return {
    seite,
    post: async (): Promise<void> => {
      if (umgang === null) {
        throw new Error("Probebühne: es liegt keine Weiche");
      }
      await umgang(route);
    },
    setzeText: (text: string): void => {
      flaeche = text;
    },
  };
}

/** Ein Budget, das kurz genug für einen Testlauf ist — aus der Quelle, nicht aus einer Zahl. */
function kurzesBudget(): number {
  return schwelle() / WARTEBUDGET.teiler.zwischen;
}

describe("JOB 3575 · das Wartebudget dieser Bühne hat eine Quelle und eine Stimme", () => {
  it("W1 · im ganzen Ordnerbaum steht keine unmittelbare Zahlenfrist mehr ausser in der EINEN Quelle", () => {
    const dateien = baumdateien(ORDNER);
    expect(dateien, "der Ordner hat keine Quelldateien mehr").not.toEqual([]);
    expect(dateien).toContain(QUELLE);

    const funde = dateien.flatMap((d) => zahlenfunde(ORDNER, d));
    expect(
      funde.map((f) => `${f.datei}:${f.zeile} ${f.grund} → ${f.text}`),
      "unmittelbare Zahlenfristen ausserhalb der einen Quelle",
    ).toEqual([]);

    // Gegenprobe im selben Fall: der Wächter findet in der Quelle sehr wohl Zahlen — er ist also
    // nicht deshalb still, weil er nichts sieht.
    const quelltext = readFileSync(join(ORDNER, QUELLE), "utf8");
    expect(quelltext, "die eine Quelle trägt keine Zahl mehr — dann misst W1 nichts").toMatch(
      /rahmenMs:\s*180_000/,
    );
  });

  it("W1b · der Wächter sieht auch in Unterordner — die Gegenprobe von Hand, fest verdrahtet", () => {
    // ============================================================================================
    // WARUM DIESER FALL EINEN EIGENEN BAUM BAUT UND NICHT DEN ECHTEN ORDNER BENUTZT.
    // ============================================================================================
    // Codex' Korrekturpflicht 3 verlangt den Nachweis, dass DIESELBE harte Frist direkt im Ordner
    // UND in einem Unterordner rot macht. Von Hand nachgestellt heisst: eine Datei in den echten
    // Ordner legen, messen, wieder wegnehmen — ein Vorgang, den niemand nachfährt und der bei einem
    // abgebrochenen Lauf eine Leiche im Produktbaum zurücklässt.
    //
    // Hier steht er deshalb als Testfall, und zwar auf einem WEGWERFBAUM in `os.tmpdir()`. Der
    // Produktbaum wird dabei nicht angefasst; der Wächter misst trotzdem mit genau demselben Code
    // wie in W1 (`baumdateien` + `zahlenfunde`). Fällt die Rekursion je zurück auf „nur die
    // unmittelbaren Dateien", wird (b) rot.
    const baum = mkdtempSync(join(tmpdir(), "ux19-w1-kalibrierung-"));
    try {
      const harteFrist = "export const wartezeit = 30 * 1000;\n";

      // (a) unmittelbar im Wurzelverzeichnis — das fand schon Runde 1.
      writeFileSync(join(baum, "flach.ts"), harteFrist, "utf8");
      const flach = baumdateien(baum).flatMap((d) => zahlenfunde(baum, d));
      expect(
        flach.map((f) => `${f.datei} ${f.grund}`),
        "flach nicht gefunden",
      ).toEqual([`flach.ts unmittelbare Zahl 30000 ≥ ${schwelle()}`]);

      // (b) DIESELBE Zeile, zwei Ebenen tiefer — genau die Lücke aus Codex' Befund.
      mkdirSync(join(baum, "unter", "noch-tiefer"), { recursive: true });
      writeFileSync(join(baum, "unter", "noch-tiefer", "tief.ts"), harteFrist, "utf8");
      const tief = baumdateien(baum).flatMap((d) => zahlenfunde(baum, d));
      expect(
        tief.map((f) => `${f.datei} ${f.grund}`).sort(),
        "die harte Frist im Unterordner blieb unentdeckt",
      ).toEqual(
        [
          `flach.ts unmittelbare Zahl 30000 ≥ ${schwelle()}`,
          `unter/noch-tiefer/tief.ts unmittelbare Zahl 30000 ≥ ${schwelle()}`,
        ].sort(),
      );

      // (c) Rücknahme: ohne die Dateien ist der Baum wieder still. Der Wächter ist also nicht
      //     grundsätzlich laut.
      rmSync(join(baum, "flach.ts"));
      rmSync(join(baum, "unter"), { recursive: true });
      expect(baumdateien(baum).flatMap((d) => zahlenfunde(baum, d))).toEqual([]);
    } finally {
      rmSync(baum, { recursive: true, force: true });
    }
  });

  it("W2 · das Budget hängt am Fallrahmen, wächst mit dem Lastschalter und bleibt unter dem Rahmen", () => {
    const schritte: readonly Warteschritt[] = [
      "dateiwegOeffnen",
      "ganzdokumentWaehlen",
      "dateiWaehlen",
      "speichernDruecken",
      "aufErfolgskastenWarten",
      "aufRuhestandWarten",
      "aufFlaechensatzWarten",
      "warteAufAbschluss",
      "neuLadenAdresse",
      "neuLadenBlatt",
      "zeigerklick",
      "deckelGegenprobe",
    ];
    const ohne = { [LAST_SCHALTER]: undefined };
    const mit = { [LAST_SCHALTER]: LAST_WERT };

    expect(lastfaktor(ohne)).toBe(1);
    expect(lastfaktor(mit)).toBeGreaterThan(lastfaktor(ohne));

    for (const s of schritte) {
      const a = wartebudget(s, ohne);
      const b = wartebudget(s, mit);
      expect(a, `${s}: Budget ohne Last ist nicht positiv`).toBeGreaterThan(0);
      expect(b, `${s}: der Lastschalter vergrössert das Budget nicht`).toBeGreaterThan(a);
      // Die wichtige Zusage: JEDES Budget bleibt unter dem Rahmen des Falls. Sonst stirbt der Fall
      // wieder am Rahmen — also ohne Zustand, genau wie bei JOB 3488.
      expect(b, `${s}: Budget unter Last erreicht den Fallrahmen`).toBeLessThan(FALL_RAHMEN_MS);
      expect(b, `${s}: Budget unter Last über dem Deckel`).toBeLessThanOrEqual(DECKEL_MS);
    }
    expect(DECKEL_MS).toBeLessThan(FALL_RAHMEN_MS);

    // Der Lastschalter ist keiner, den niemand setzt: `tools/test` fährt die serielle
    // Browsergruppe — die Gruppe, in der der Torlauf von JOB 3488 gerissen ist — mit genau diesem
    // Namen und diesem Wert. Ohne diese Zeile wäre der Schalter Zierde.
    const werkzeug = readFileSync(join(ORDNER, "..", "..", "tools", "test"), "utf8");
    expect(werkzeug, "tools/test setzt den Lastschalter nicht mehr").toContain(
      `${LAST_SCHALTER}=${LAST_WERT}`,
    );
  });

  it("W3 · läuft ein Warteschritt ab, nennt die Meldung Schritt, Zustand, Fläche und Weichenzähler", async () => {
    await i18n.changeLanguage("de");
    const probe = probebuehne("Auf dieser Fläche steht der gesuchte Zustand nie.");
    await entwurfsWeicheLegen(probe.seite);
    await probe.post();

    const nieErfuellbar = "diesen Satz schreibt niemand auf diese Fläche";
    let meldung = "";
    try {
      await aufFlaechensatzWarten(probe.seite, nieErfuellbar, kurzesBudget());
    } catch (e) {
      meldung = String(e);
    }

    expect(meldung, "der Warteschritt ist gar nicht abgelaufen").not.toBe("");
    // 1 · welcher Schritt
    expect(meldung).toContain("aufFlaechensatzWarten");
    // 2 · welcher Zustand erwartet war
    expect(meldung).toContain(nieErfuellbar);
    // 3 · was zuletzt auf der Fläche stand
    expect(meldung).toContain("Auf dieser Fläche steht der gesuchte Zustand nie.");
    // 4 · die Zähler der Entwurfsweiche
    expect(meldung).toContain("angekommen=1");
    expect(meldung).toContain("beendet=1");
    // … und die Einordnung der Umgebung, ohne eine feste Eigenschaft zu behaupten.
    expect(meldung).toMatch(/lastabhängig|keine Last erkennbar/);
    expect(meldung).toContain("1-Minuten-Last");
    // Was Playwrights nackter Wurf sagte, sagt hier niemand mehr allein.
    expect(meldung).not.toMatch(/^Error: Timeout \d+ms exceeded$/);
  });

  it("W4 · der Fehlerabbruch greift bei jedem Fehlerausgang DIESES Versuchs — und nur dann", async () => {
    await i18n.changeLanguage("de");

    // (a) Der alte Fehlersatz eines VORIGEN Versuchs bricht NICHT ab. Genau so speichern F6, F7
    //     und F9 nach einem Fehlschlag ein zweites Mal; ein Abbruch hier wäre ein falsches Rot.
    const alt = probebuehne(`Frühere Meldung: ${WEICHE_FEHLERSATZ}`);
    const weicheAlt = await entwurfsWeicheLegen(alt.seite);
    // WICHTIG IST DIE REIHENFOLGE, und sie war in Runde 2 falsch herum: der POST des VORIGEN
    // Versuchs läuft, DANN beginnt der neue Versuch. Erst dadurch liegt die Marke über dem
    // Zählerstand des alten Aufrufs — und nur so stellt dieser Fall die Lage von F6/F7/F9 dar.
    // Runde 2 nahm die Marke VOR dem POST und schrieb damit dem neuen Versuch den Fehlschlag des
    // alten zu; grün war der Fall dort nur wegen des Textvergleichs, den es nicht mehr gibt.
    await alt.post();
    const versuchAlt = speicherversuchBeginnen(weicheAlt);
    let meldungAlt = "";
    try {
      await aufErfolgskastenWarten(alt.seite, versuchAlt, kurzesBudget());
    } catch (e) {
      meldungAlt = String(e);
    }
    expect(meldungAlt, "der alte Fehlersatz hat den Warteschritt abgebrochen").toContain(
      "Wartebudget erschöpft",
    );

    // (b) Ein WÄHREND des Wartens erscheinender Fehlersatz bricht sofort ab — mit dem Grund, nicht
    //     mit einer abgelaufenen Frist.
    const neu = probebuehne("Noch keine Meldung.");
    const weicheNeu = await entwurfsWeicheLegen(neu.seite);
    const versuchNeu = speicherversuchBeginnen(weicheNeu);
    const lauf = aufErfolgskastenWarten(neu.seite, versuchNeu, kurzesBudget());
    neu.setzeText(`Jetzt steht da: ${WEICHE_FEHLERSATZ}`);
    await neu.post();
    let meldungNeu = "";
    try {
      await lauf;
    } catch (e) {
      meldungNeu = String(e);
    }
    expect(meldungNeu, "der frische Fehlerzustand hat nicht abgebrochen").toContain(
      "endet im Fehlerzustand des Speicherwegs",
    );
    expect(meldungNeu).toContain(WEICHE_FEHLERSATZ);
    expect(meldungNeu, "der Abbruch kam erst über das Budget").not.toContain(
      "Wartebudget erschöpft",
    );

    // ============================================================================================
    // (d) DER SCHNELLE FEHLER — die Lücke, die Codex in Runde 1 am echten Chromium aufgemacht hat.
    // ============================================================================================
    // Der Unterschied zu (b) ist NUR die Reihenfolge: hier steht der Fehlersatz schon da, BEVOR der
    // Wartehelfer überhaupt beginnt. Genau so verläuft es am echten Server mit der gestellten
    // 500-Antwort: der Klick, der sofort beantwortete POST, der gerenderte Fehlersatz — und erst
    // danach ruft der Fall `aufErfolgskastenWarten`. Runde 1 hielt diesen Satz für einen alten,
    // weil sie „vorher" erst beim Eintritt in den Helfer ablas; der Schritt lief in sein volles
    // Budget. Gemessen wird jetzt der AUSGANG des Versuchs, nicht der Zeitpunkt des Ablesens.
    const schnell = probebuehne("Noch keine Meldung.");
    const weicheSchnell = await entwurfsWeicheLegen(schnell.seite);
    const versuchSchnell = speicherversuchBeginnen(weicheSchnell);
    await schnell.post();
    schnell.setzeText(`Sofort da: ${WEICHE_FEHLERSATZ}`);
    let meldungSchnell = "";
    try {
      await aufErfolgskastenWarten(schnell.seite, versuchSchnell, kurzesBudget());
    } catch (e) {
      meldungSchnell = String(e);
    }
    expect(
      meldungSchnell,
      "der schon sichtbare Fehler DIESES Versuchs hat nicht abgebrochen",
    ).toContain("endet im Fehlerzustand des Speicherwegs");
    expect(meldungSchnell).toContain(WEICHE_FEHLERSATZ);
    expect(meldungSchnell, "der Abbruch kam erst über das Budget").not.toContain(
      "Wartebudget erschöpft",
    );

    // (e) Ohne beendeten Anlege-Aufruf greift der Abbruch nicht, auch wenn ein Fehlersatz dasteht:
    //     „der Speicherweg ist gescheitert" darf nur stehen, wenn wirklich einer lief.
    const ohnePost = probebuehne("Noch keine Meldung.");
    const weicheOhne = await entwurfsWeicheLegen(ohnePost.seite);
    const versuchOhne = speicherversuchBeginnen(weicheOhne);
    ohnePost.setzeText(`Jetzt steht da: ${WEICHE_FEHLERSATZ}`);
    let meldungOhne = "";
    try {
      await aufErfolgskastenWarten(ohnePost.seite, versuchOhne, kurzesBudget());
    } catch (e) {
      meldungOhne = String(e);
    }
    expect(meldungOhne, "abgebrochen, ohne dass ein Anlege-Aufruf lief").toContain(
      "Wartebudget erschöpft",
    );

    // ============================================================================================
    // (f) DERSELBE FEHLERTEXT ZWEIMAL — Codex' Korrekturpflicht 1 aus Runde 2.
    // ============================================================================================
    // Zwei Versuche, beide mit demselben gestellten Serverfehler, und die Fläche ändert sich dabei
    // NICHT: `Capture.tsx:1065` ruft `setErr(e.message)` mit zeichengleich demselben Wert, React
    // bricht bei identischem Zustand ab (`Object.is`) und rendert nicht neu. Genau deshalb steht
    // hier zwischen den beiden Versuchen kein `setzeText` — der unveränderte Text IST der Fall.
    // Runde 2 hielt den zweiten Fehler für den alten und lief in ihr Budget (Codex: „Wartebudget
    // erschöpft, nach 142 ms bei 120 ms Probebudget, trotz angekommen=2 beendet=2").
    const zweimal = probebuehne("Noch keine Meldung.");
    const weicheZweimal = await entwurfsWeicheLegen(zweimal.seite);
    const gruende: string[] = [];
    for (const runde of [1, 2]) {
      const versuch = speicherversuchBeginnen(weicheZweimal);
      await zweimal.post();
      zweimal.setzeText(`Sofort da: ${WEICHE_FEHLERSATZ}`);
      let meldung = "";
      try {
        await aufErfolgskastenWarten(zweimal.seite, versuch, kurzesBudget());
      } catch (e) {
        meldung = String(e);
      }
      expect(meldung, `Versuch ${runde} hat nicht mit Grund abgebrochen`).toContain(
        "endet im Fehlerzustand des Speicherwegs",
      );
      expect(meldung, `Versuch ${runde} kam erst über das Budget`).not.toContain(
        "Wartebudget erschöpft",
      );
      gruende.push(meldung);
    }
    // Und der Beleg, dass es wirklich ZWEI Versuche mit DEMSELBEN Wortlaut waren.
    expect(weicheZweimal.zaehler.beendet, "es liefen keine zwei Anlege-Aufrufe").toBe(2);
    for (const grund of gruende) {
      expect(grund).toContain(WEICHE_FEHLERSATZ);
    }

    // ============================================================================================
    // (g) DER WARTEZUSTAND HÄLT DEN ABBRUCH ZURÜCK — die Zeile, die den Erfolgsfall schützt.
    // ============================================================================================
    // Die Weiche zählt schon im Routenumgang hoch, also BEVOR die Antwort im Browser ankommt. In
    // diesem Fenster steht der alte Fehlersatz noch, der Knopf trägt aber `wholeSaving`
    // (`Capture.tsx:5333-5340`, gehalten bis `onError`/`onSuccess` durch sind —
    // `@tanstack/query-core` `src/mutation.ts:246-251` vor `:271`). Ein Abbruch hier schriebe dem
    // neuen Versuch den Ausgang des alten zu.
    const warten = flaechensatz(CAPTURE_FILE_TEXT.wholeSaving);
    const rechnet = probebuehne(`${warten} — daneben noch: ${WEICHE_FEHLERSATZ}`);
    const weicheRechnet = await entwurfsWeicheLegen(rechnet.seite);
    const versuchRechnet = speicherversuchBeginnen(weicheRechnet);
    await rechnet.post();
    let meldungRechnet = "";
    try {
      await aufErfolgskastenWarten(rechnet.seite, versuchRechnet, kurzesBudget());
    } catch (e) {
      meldungRechnet = String(e);
    }
    expect(meldungRechnet, "abgebrochen, obwohl der Client noch am Wartezustand stand").toContain(
      "Wartebudget erschöpft",
    );
    // Gegenprobe im selben Fall: OHNE den Wartezustand bricht dieselbe Lage sofort ab. Die Zeile
    // ist also eine Bedingung und keine Abschaltung.
    rechnet.setzeText(`Jetzt fertig: ${WEICHE_FEHLERSATZ}`);
    let meldungFertig = "";
    try {
      await aufErfolgskastenWarten(rechnet.seite, versuchRechnet, kurzesBudget());
    } catch (e) {
      meldungFertig = String(e);
    }
    expect(meldungFertig, "ohne Wartezustand kam kein Abbruch mit Grund").toContain(
      "endet im Fehlerzustand des Speicherwegs",
    );

    // ============================================================================================
    // (h) DER ERFOLGSKASTEN HÄLT DEN ABBRUCH ZURÜCK — ein Erfolg mit Hinweis ist kein Fehlschlag.
    // ============================================================================================
    // Diesen Zustand erzeugt das Produkt wirklich: `Capture.tsx:1435-1438` setzt bei einem
    // angelegten, aber kennungslosen Entwurf `wholeOpenMissing` NEBEN den Erfolgskasten, und ein
    // Fehler-Toast bleibt nach `ToastContext.tsx:28` volle 4 000 ms stehen. Der Warteschritt muss
    // hier DURCHKOMMEN (sein Ziel steht ja da) und darf nicht werfen.
    const erfolg = flaechensatz(CAPTURE_FILE_TEXT.wholeSavedTitle);
    const mitHinweis = probebuehne(
      `${erfolg} — dazu der Hinweis: ${flaechensatz(CAPTURE_FILE_TEXT.wholeOpenMissing)}`,
    );
    const weicheHinweis = await entwurfsWeicheLegen(mitHinweis.seite);
    const versuchHinweis = speicherversuchBeginnen(weicheHinweis);
    await mitHinweis.post();
    await expect(
      aufErfolgskastenWarten(mitHinweis.seite, versuchHinweis, kurzesBudget()),
      "der Erfolgskasten stand da und der Warteschritt hat trotzdem abgebrochen",
    ).resolves.toBeUndefined();
    // Gegenprobe: OHNE den Erfolgskasten ist derselbe Hinweis ein Abbruchgrund.
    mitHinweis.setzeText(`Nur der Hinweis: ${flaechensatz(CAPTURE_FILE_TEXT.wholeOpenMissing)}`);
    let meldungOhneErfolg = "";
    try {
      await aufErfolgskastenWarten(mitHinweis.seite, versuchHinweis, kurzesBudget());
    } catch (e) {
      meldungOhneErfolg = String(e);
    }
    expect(meldungOhneErfolg, "ohne Erfolgskasten kam kein Abbruch mit Grund").toContain(
      "endet im Fehlerzustand des Speicherwegs",
    );
  });

  it("W6 · auch der Navigationsablauf von `neuLaden` nennt Schritt, Zustand, Fläche und Zähler", async () => {
    // ============================================================================================
    // Codex' Korrekturpflicht 2: bis Runde 1 reichte `neuLaden` Playwrights nackte Frist durch.
    // Gestellt wird hier GENAU der Wortlaut, den Playwright bei einer abgelaufenen Navigationsfrist
    // wirft (`page.goto: Timeout … exceeded.`) — die alte Fläche steht dabei noch, und genau ihr
    // Text gehört in die Meldung.
    // ============================================================================================
    await i18n.changeLanguage("de");
    const flaechentext = "Die alte Fläche steht noch, während das Laden scheitert.";
    const probe = probebuehne(flaechentext, async (adresse: string): Promise<void> => {
      throw new Error(`page.goto: Timeout 1ms exceeded.\nCall log:\n  navigating to "${adresse}"`);
    });
    await entwurfsWeicheLegen(probe.seite);
    await probe.post();

    let meldung = "";
    try {
      await neuLaden(probe.seite, "/erfassen", kurzesBudget());
    } catch (e) {
      meldung = String(e);
    }

    expect(meldung, "der Navigationsablauf ist gar nicht durchgereicht worden").not.toBe("");
    // 1 · welcher Schritt
    expect(meldung).toContain("neuLadenAdresse");
    // 2 · welcher Zielzustand erwartet war
    expect(meldung).toContain("/erfassen");
    expect(meldung).toContain("waitUntil=load");
    // 3 · was zuletzt auf der Fläche stand
    expect(meldung).toContain(flaechentext);
    // 4 · die Zähler der Entwurfsweiche
    expect(meldung).toContain("angekommen=1");
    expect(meldung).toContain("beendet=1");
    // 5 · Playwrights eigener Wortlaut geht nicht verloren — er steht daneben, nicht allein.
    expect(meldung).toContain("page.goto: Timeout 1ms exceeded.");
    expect(meldung).toContain("Wartebudget erschöpft");
    expect(meldung).toMatch(/lastabhängig|keine Last erkennbar/);

    // Und die Ehrlichkeit der Überschrift: ein Navigationsfehler, der KEINE Frist ist, heisst auch
    // nicht so. Sonst behauptete die Meldung ein erschöpftes Budget, wo keines erschöpft war.
    const kaputt = probebuehne(flaechentext, async (): Promise<void> => {
      throw new Error("net::ERR_CONNECTION_REFUSED");
    });
    await entwurfsWeicheLegen(kaputt.seite);
    let andere = "";
    try {
      await neuLaden(kaputt.seite, "/erfassen", kurzesBudget());
    } catch (e) {
      andere = String(e);
    }
    expect(andere).toContain("Warteschritt gescheitert");
    expect(andere).toContain("net::ERR_CONNECTION_REFUSED");
    expect(andere, "ein Verbindungsfehler wird als erschöpftes Budget ausgegeben").not.toContain(
      "Wartebudget erschöpft",
    );
  });

  it("W5 · „geklickt“ heisst betätigt — ein gesperrter Knopf wird nicht als geklickt gemeldet", () => {
    // ============================================================================================
    // WARUM DIESER FALL MIT EINER HANDGEMACHTEN FLÄCHE ARBEITET.
    // ============================================================================================
    // Gemessen wird der ABLESER, der in der Seite läuft — reiner Quelltext, keine React-Fläche.
    // Genau seine Logik war der Fehler: er nahm den ersten Treffer und meldete `true`, auch wenn
    // `click()` auf einem gesperrten Knopf nichts tat. Am echten Chromium ist der Zustand
    // „gesperrt, weil die Datei noch eingelesen wird" ein Wettlauf, der auf schnellen Rechnern nie
    // eintritt (fünf Läufe hier: nie) und auf dem Cloud-Prüfrechner zuschlug. Ein Wächter, der nur
    // dort greift, wo der Wettlauf zufällig eintritt, ist keiner. Hier ist er entscheidbar.
    const knopf = (
      text: string,
      sperre: "frei" | "disabled" | "aria-disabled",
    ): { textContent: string; disabled: boolean; getAttribute: (n: string) => string | null } & {
      readonly geklickt: number;
    } => {
      let mal = 0;
      return {
        textContent: text,
        disabled: sperre === "disabled",
        getAttribute: (n: string): string | null =>
          n === "aria-disabled" && sperre === "aria-disabled" ? "true" : null,
        click: (): void => {
          mal += 1;
        },
        get geklickt(): number {
          return mal;
        },
      } as never;
    };
    const mitFlaeche = <T>(knoepfe: readonly unknown[], tun: () => T): T => {
      const welt = globalThis as { document?: unknown };
      const vorher = welt.document;
      welt.document = { querySelectorAll: (): readonly unknown[] => knoepfe };
      try {
        return tun();
      } finally {
        welt.document = vorher;
      }
    };
    const klick = (knoepfe: readonly unknown[], text: string): boolean =>
      mitFlaeche(knoepfe, () => fn(KLICK_KNOPF)(text) as boolean);

    const cta = "Ganzes Dokument als Entwurf speichern";

    // (a) NUR ein gesperrter Knopf: nicht geklickt, und das wird auch so gemeldet.
    for (const sperre of ["disabled", "aria-disabled"] as const) {
      const gesperrt = knopf(cta, sperre);
      expect(klick([gesperrt], cta), `«${sperre}» wurde als geklickt gemeldet`).toBe(false);
      expect(gesperrt.geklickt, `«${sperre}» wurde wirklich geklickt`).toBe(0);
    }

    // (b) Gesperrt VOR frei: der freie bekommt den Klick, nicht der erste Treffer.
    const gesperrt = knopf(cta, "disabled");
    const frei = knopf(cta, "frei");
    expect(klick([gesperrt, frei], cta)).toBe(true);
    expect(gesperrt.geklickt, "der gesperrte Knopf wurde geklickt").toBe(0);
    expect(frei.geklickt, "der freie Knopf wurde nicht geklickt").toBe(1);

    // (c) Der Ableser ist nicht deshalb still, weil er nichts findet.
    const anderer = knopf("Ein ganz anderer Knopf", "frei");
    expect(klick([anderer], cta)).toBe(false);
    expect(anderer.geklickt).toBe(0);
  });
});
