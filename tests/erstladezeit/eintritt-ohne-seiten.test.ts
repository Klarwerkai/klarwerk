// ================================================================================================
// JOB 3030 — DIE OBERFLÄCHE KOMMT IN STÜCKEN. GEMESSEN AM AUSGELIEFERTEN BÜNDEL.
// ================================================================================================
//
// WORUM ES GEHT. `routes.tsx` hat bis JOB 3030 alle 24 Seitenmodule STATISCH importiert. Damit lag
// der Code jeder Seite — Admin, UiKit, Wissensnetz, Stufe 2, die Vordertür, die Bibliothek — im
// Eintritts-Stück und musste geladen sein, bevor die erste Seite erscheinen konnte, obwohl ein
// Mensch beim ersten Blick genau eine Seite sieht.
//
// ------------------------------------------------------------------------------------------------
// JOB 3077 — DIE HERKUNFT DER BYTES IST JETZT GEMESSEN, NICHT BEHAUPTET. UND 3(c) IST ENTSCHIEDEN.
// ------------------------------------------------------------------------------------------------
// JOB 3030 ließ genau EINEN Rest offen (ben, R11, 2026-09-04T21:49:08, Prüfpunkt 2): „Die Gesamtsumme
// wächst um 34 818 B. Die vollständige Einordnung dieses Zuwachses als ‚reiner Verpackungsrahmen'
// bleibt eine UNBEWIESENE HYPOTHESE; c1/c2 messen Modulzuordnung und Durchschnittsbudget, keine
// Byte-Herkunft." Das stimmte: (c1) schließt die grobe Vervielfältigung aus (kein Modul liegt
// doppelt), (c2) teilt den Zuwachs durch die Stückzahl — ein Mittelwert, der auch dann grün bliebe,
// wenn der ganze Zuwachs echter Inhalt wäre, verteilt auf 96 Stücke.
//
// SEIT DIESEM AUFTRAG WIRD DIE HERKUNFT ERHOBEN, UND ZWAR AN DEN AUSGELIEFERTEN BYTES. Jedes Stück
// zerfällt in zwei Teile:
//     INHALT = die Bytes, die aus einer Quelldatei stammen
//     RAHMEN = alles Übrige (Import-Zeilen zwischen den Stücken, Nachlade-Helfer, Ausfuhrliste)
// Die Zuordnung liest die QUELLKARTE des fertigen, minimierten Stücks (`byteHerkunft()` weiter
// unten): jedes Segment sagt „ab Spalte X stammt das Folgende aus Quelle Q", und was kein Segment
// abdeckt, ist Rahmen. Gezählt wird in UTF-8-Bytes — derselben Einheit wie `summeJs` und wie das,
// was der Browser über die Leitung holt. Die Identität `Inhalt + Rahmen === ausgelieferte Bytes`
// gilt auf das Byte und wird vom Wächter (h) geprüft.
//
// EINE SUMMENIDENTITÄT BEWEIST ABER KEINE RICHTIGE KATEGORIE (ben, R2, Korrekturpflicht 1), und
// Runde 2 ist genau daran gescheitert: `Rahmen = Gesamtbytes − zugeordnete Bytes` geht IMMER auf,
// auch wenn die Zuordnung falsch ist. Sie war falsch. Die erzeugte Ausfuhrliste `export{…};` am
// Stückende trägt kein eigenes Kartensegment; wer das letzte Segment einer Zeile bis zum Zeilenende
// laufen lässt, schreibt sie dem zuletzt zugeordneten Modul zu. So bekam `main.tsx` 1 731 B und
// `externalAttachGate.ts` 692 B reinen Rahmen als „Inhalt" gutgeschrieben — und beide erschienen in
// Runde 2 fälschlich als wachsende Module. SEIT RUNDE 3 wird die Liste erkannt, abgeschnitten und
// als Rahmen gezählt; dass die Erkennung trifft, wird gegen ROLLUPS EIGENE `chunk.exports` geprüft
// (Wächter (h)), und der Zuordner selbst hat einen eigenen `describe`-Block mit von Hand
// abzählbaren Fällen (Z1–Z5), von denen Z1 die Fehlklassifikation aus Runde 2 rot macht.
//
// DIE KARTE KOSTET KEINEN BAULAUF UND VERÄNDERT DAS ERGEBNIS NICHT. `sourcemap: "hidden"` erzeugt
// die Karte, hängt aber KEINEN `//# sourceMappingURL=`-Kommentar an das Stück — der ausgelieferte
// Code bleibt Byte für Byte derselbe. Das ist nicht zugesagt, sondern gemessen: die KALIBRIERUNG
// stellt diesen Bau gegen `apps/web/dist`, das `tools/build` OHNE Karten erzeugt, und vergleicht
// Eintrittsname (mit Inhaltshash), Eintrittsgröße, Stückzahl und Summe.
//
// ── WARUM ES DANEBEN NOCH EINE ZWEITE, GRÖBERE SICHT GIBT (und warum sie nicht die erste ist) ────
// Rollup führt je Stück auch `modules[id].renderedLength` (`rollup.d.ts:963-969`, im Stück unter
// `RenderedChunk.modules`, ebenda `:988`): die Länge des Codes, den rollup für dieses Modul in das
// Stück gerendert hat. Diese Zahl steht VOR der Minimierung — rollup setzt sie, bevor die
// `renderChunk`-Haken laufen, und die Minimierung durch esbuild IST ein solcher Haken (Vite).
// Der naheliegende Ansatz `rahmen = Buffer.byteLength(code) − Σ renderedLength` ergibt deshalb eine
// NEGATIVE Zahl: am Stand `e8116ba` stehen 5 108 614 Zeichen Modulcode gegen 3 049 150 Zeichen
// ausgeliefertes Stück. Zwei Einheiten, eine Subtraktion.
// RUNDE 1 DIESES AUFTRAGS HAT DARAUS DEN FALSCHEN SCHLUSS GEZOGEN: sie zerlegte sauber die
// Rohzeichen und ließ die ausgelieferten Bytes daneben stehen, als wäre das Erste ein Beleg für das
// Zweite. Ben, R1, Korrekturpflicht 1: „Gleiche oder kleinere Rohmodullängen beweisen keine
// entsprechend gleichen oder kleineren minimierten Inhaltsanteile." Das stimmt, und es ist am
// eigenen Produkt sichtbar: VOR der Minimierung wächst GENAU EIN Modul, DANACH sind es DREI.
// Die Rohsicht bleibt trotzdem stehen, als (c3r) — als unabhängige ZWEITMESSUNG aus einer anderen
// Datenquelle (rollups eigene Buchführung statt der Quellkarte). Zwei Wege können nicht gemeinsam
// aus demselben Fehler grün werden. Bindend ist (c3), weil (c3) misst, was ausgeliefert wird.
//
// GEMESSEN AM 05.09.2026, Arbeitsstand `e8116ba`, zwei Bauläufe desselben Quellstands:
//     VORHER  (Seiten statisch):   6 Stücke · 3 025 986 B = Inhalt 3 018 338 + Rahmen  7 648
//     NACHHER (aufgeteilt):      102 Stücke · 3 063 530 B = Inhalt 3 016 626 + Rahmen 46 904
//     Zuwachs +37 544 B (+1,24 %) = RAHMEN +39 256 B (104,6 %) + INHALT −1 712 B (−4,6 %).
//     Eintritt daneben: −784 100 B (−37,89 %).
// DER AUSGELIEFERTE MODULINHALT WÄCHST ALSO NICHT — ER SCHRUMPFT. 31 von 854 Modulen wachsen
// (zusammen +3 167 B), 254 schrumpfen (zusammen −4 879 B); netto −1 712 B. Der einzige nennenswerte
// Zuwachs ist `routes.tsx` selbst mit +3 037 B (2 325 → 5 362) — die 27 `lazy(() => import(…))`
// stehen dort als Laufzeitcode, wo der Gegenbau nur `Promise.resolve({ default: … })` hat. Der
// ZWEITGRÖSSTE Zuwachs im ganzen Baum beträgt 32 B. Die Gegenseite schrumpft, weil rollup in 102
// kleinen Stücken weniger Namen entkollidieren muss (`Foo$1`, `Foo$2`) als in sechs großen:
// `Capture.tsx` −543 B, `RichTextEditor.tsx` −322 B, `Admin.tsx` −311 B, `Validation.tsx` −227 B.
// Kein einziges Modul wird vervielfältigt; das hält (c1) toleranzfrei fest.
//
// DAMIT IST 3(c) ENTSCHIEDEN, nicht mehr offen: Steuerung, 05.09.2026, Entscheidung 13
// (`UEBERGABE.md`), Zeile U4b in `PRIORITAETEN.md`. Lieferpunkt 3(c) („die Summe wächst nicht") wird
// NICHT als Nullwachstumsbedingung geführt, sondern als ausdrücklich angenommenes, GEMESSENES
// Verpackungsbudget: 37 544 B mehr Auslieferung gegen 784 100 B weniger Erstlast. BEDINGUNG dieser
// Annahme ist, dass der Zuwachs gemessen Rahmen ist und nicht Inhalt — und genau das prüft (c3) bei
// jedem Lauf neu, an den ausgelieferten Bytes, mit dem Budget NULL. Für den ausgelieferten Inhalt
// ist 3(c) damit sogar wörtlich erfüllt; die angenommene Verpackung ist der ganze Rest.
//
// ------------------------------------------------------------------------------------------------
// DAS MUTATIONSPROTOKOLL — wie man diese Datei von Hand rot bekommt (ben, R11, Promptverbesserung 1)
// ------------------------------------------------------------------------------------------------
// 1. Mutation setzen (z. B. in `routes.tsx` eine `lazy(() => import("./pages/X")…)`-Zeile durch einen
//    statischen `import { X } from "./pages/X"` ersetzen).
// 2. `./tools/build` fahren — sonst zeigt `apps/web/dist` den Stand VOR der Mutation.
// 3. `KLARWERK_SKIP_KEYCHAIN=1 npx vitest run tests/erstladezeit/`.
// Weil Schritt 2 `dist` MIT der Mutation neu baut, kippt die KALIBRIERUNG dabei NICHT mit: sie
// vergleicht den Bau dieses Tests gegen den ausgelieferten Bau, und beide tragen dieselbe Mutation.
// Genau deshalb stehen KALIBRIERUNG und MUTATIONSSUITE unten in ZWEI `describe`-Blöcken: der eine
// prüft, dass hier DAS Bündel gemessen wird, der andere, was an diesem Bündel wahr ist. Gemessen am
// 05.09.2026: der statische Rückbau von `Admin` macht GENAU (a) und (b) rot, alles andere bleibt grün.
// Die dritte Zeile ist nicht optional: ohne den Neubau meldet die KALIBRIERUNG vier abweichende
// Zahlen, und man sucht den Fehler in der Aufteilung statt im veralteten `dist`.
// BEWUSST KEINE ZWEITE TESTDATEI: `baue()` ruft `process.chdir`, und das ist prozessweit — zwei
// Dateien, die parallel bauen, würden sich das Arbeitsverzeichnis unter den Füßen wegziehen.
//
// ------------------------------------------------------------------------------------------------
// DER FEHLER, DEN DIESE DATEI IN RUNDE 2 HATTE — und warum er so teuer war (ben, JOB 3030 R2)
// ------------------------------------------------------------------------------------------------
// Vite setzt `process.env.NODE_ENV` beim Bauen NUR, wenn es noch nicht gesetzt ist. Unter vitest
// steht dort `test`. Dieser Test hat deshalb ein TESTMODUS-Bündel gemessen (React-Entwicklungsbau,
// keine Produktionsvereinfachungen) und dessen Zahlen als Bündelgrößen ausgegeben — 3 984 014 B,
// wo die Auslieferung 2 997 405 B hat. Alle Grenzwerte, alle Zahlen in der Rückgabe und der Satz
// „die Registerangabe 2,6 MB ist zu niedrig" standen damit auf der falschen Messung.
// SEITHER GILT HIER: `NODE_ENV=production` wird vor dem Bau AUSDRÜCKLICH gesetzt (und danach
// zurückgestellt), und der Fall „KALIBRIERUNG" belegt am echten `apps/web/dist`, dass dieser Bau
// bytegleich zu dem ist, den `tools/build` ausliefert. Ohne diese Kalibrierung misst der Test
// irgendein Bündel und nicht DAS Bündel.
//
// ------------------------------------------------------------------------------------------------
// DER FEHLER, DEN DIESE DATEI IN RUNDE 4 HATTE — eine Zahl, die von selbst rot wird (ben, R4, PP 2)
// ------------------------------------------------------------------------------------------------
// Runde 4 hielt die Byte-Summe als festen Pin: `SUMME_JS <= 2 997 405`, gemessen am Stand `5409a62`.
// Am 04.09.2026 wurde JOB 3030 auf `5409a62` gebaut und auf `9e1e573` eingebaut; dazwischen kamen
// fremde Frontend-Änderungen (u. a. JOB 3018) in den Baum, und der Fall wurde rot, OHNE dass an der
// Aufteilung etwas falsch war. LEHRE (dieselbe wie JOB 3007): ein Grenzwert, der eine HISTORISCHE
// Messung gegen einen WACHSENDEN Baum stellt, misst das Wachstum des Produkts, nicht die Wirkung
// dieses Auftrags. Deshalb baut diese Datei ZWEIMAL, denselben Quellstand, im selben Lauf.
//
// ------------------------------------------------------------------------------------------------
// DER FEHLER, DEN DIESE DATEI IN RUNDE 7 HATTE — ein falsches „vorher" (ben, R7, Korrekturpflicht 1+2)
// ------------------------------------------------------------------------------------------------
// Der zweite Baulauf hieß bis Runde 7 `inlineDynamicImports: true` und wurde als „exakt der Zustand
// vor JOB 3030" bezeichnet. DAS WAR FALSCH, und ben hat es nachgemessen: `inlineDynamicImports`
// schmilzt JEDES `import()` ein, also auch die FÜNF Stücke, die schon VOR diesem Auftrag getrennt
// ausgeliefert wurden (die zweite React-Insel, `browser`, `pdf`, ein weiteres `index` und
// `_commonjs-dynamic-modules`). Ergebnis: ein künstliches Ein-Stück-Bündel von 2 994 944 B, gegen
// das der Eintritt um „−58,07 %" fiel — während der ECHTE Vorstand `9e1e573` sechs Stücke und einen
// Eintritt von 2 026 850 B hat und der wahre Gewinn 38 % beträgt. Die Zahl war zu gut, weil das
// Vergleichsbündel zu groß war.
//
// SO WIRD DAS „VORHER" SEITHER GEBAUT (`statischeSeiten()` weiter unten): ein Vite-Plugin dreht in
// `routes.tsx` GENAU DAS ZURÜCK, was JOB 3030 dort eingeführt hat — jedes
// `lazy(() => import("./pages/X").then((m) => ({ default: m.Y })))` wird wieder ein statischer
// Import. Alles andere im Produkt bleibt unangetastet, insbesondere jeder schon vorher vorhandene
// dynamische Import. Der Gegenbau trifft den echten Vorstand damit auf 0,06 % genau:
//     ben, echter Produktionsbau von `9e1e573`:   6 Stücke · Eintritt 2 026 850 B · Summe 2 983 570 B
//     dieser Gegenbau am Arbeitsstand `b203c44`:  6 Stücke · Eintritt 2 028 116 B · Summe 2 984 836 B
// Die 1 266 B Unterschied sind der Rest des Gerüsts, das der Gegenbau stehen lässt (die 27
// `lazy(() => Promise.resolve({ default: … }))`-Hüllen) — er baut den heutigen Quellstand, nicht den
// alten Commit, und das ist der Zweck: beide Zahlen wachsen mit dem Produkt mit, ihr VERHÄLTNIS ist
// die Aussage und driftet nicht. Wie sehr sie mitwachsen, zeigt derselbe Gegenbau EINEN TAG später:
// am 05.09.2026, Stand `e8116ba`, steht er bei 6 Stücken · Eintritt 2 069 266 B · Summe 3 025 986 B —
// je 41 150 B mehr als am 04.09., ohne dass an der Aufteilung eine Zeile anders wäre. Ein Pin auf
// eine dieser Zahlen wäre über Nacht von selbst rot geworden; das Verhältnis ist es nicht.
//
// WARUM DIESER TEST BAUT, STATT QUELLTEXT ZU LESEN. Ein Pin auf `lazy(` oder `Suspense` in
// `routes.tsx` misst eine Schreibweise, nicht eine Wirkung: er bliebe grün, wenn dieselbe Datei die
// Seite an anderer Stelle wieder statisch zöge, und er bliebe grün, wenn rollup die Stücke wieder
// zusammenführte. Genau diese Klasse Urteil ist in JOB 3007 viermal durchgefallen (LEHREN.md, R2–R4:
// „am gebauten Bildschirm messen, nicht im Quelltext").
//
// WARUM DER BAU IN `os.tmpdir()` LANDET UND NICHT IN `apps/web/dist`. Vom 30.08. bis 02.09.2026 war
// das Tor drei Tage rot OHNE Produktfehler, weil ein Test ein ausgeliefertes Artefakt neu stempelte
// und damit den Smoke-Abbruch „dist ist AELTER" auslöste (`OFFEN.md:3`). Ein Test, der selbst baut,
// darf `apps/web/dist` deshalb nicht anfassen — lesen darf er es, und genau das tut die
// Kalibrierung. Dass er nichts schreibt, wird nicht zugesagt, sondern gemessen: der letzte Fall
// vergleicht den Fingerabdruck von `apps/web/dist` vor und nach BEIDEN Bauläufen.
//
// DIE SOLLMENGE WIRD ERHOBEN, NICHT ABGESCHRIEBEN. Welche Seiten es gibt, liest Fall (b) zur
// Laufzeit aus `apps/web/src/pages/`. Eine Handliste im Test würde genau die Seite nicht sehen, die
// morgen jemand hinzufügt und statisch einbindet — Lehre JOB 3010 R2: keine Vorfilterung, keine
// abgeschriebene Menge.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { type Plugin, build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const WURZEL = resolve(__dirname, "..", "..");
const WEB = join(WURZEL, "apps", "web");
const SEITEN_ORDNER = join(WEB, "src", "pages");
const DIST = join(WEB, "dist");

const posix = (pfad: string): string => pfad.split(sep).join("/");
const kurz = (pfad: string): string => posix(relative(WURZEL, pfad));

const ROUTES = posix(join(WEB, "src", "routes.tsx"));

// ── Die Sollmenge der Seitenmodule, aus dem Dateisystem erhoben ──────────────────────────────────
const SOLL_SEITEN: string[] = readdirSync(SEITEN_ORDNER)
  .filter((name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"))
  .map((name) => posix(join(SEITEN_ORDNER, name)))
  .sort();

// ── DER GEGENBAU: nur JOB 3030 zurückgedreht, sonst nichts (ben, R7, Korrekturpflicht 2) ─────────
// Das Muster trifft ausschließlich die Form, die dieser Auftrag in `routes.tsx` eingeführt hat.
// Es trifft KEINEN anderen dynamischen Import im Produkt — weder einen in einer anderen Datei (die
// Bedingung `id === ROUTES` schließt sie aus) noch einen in `routes.tsx`, der nicht auf `./pages/`
// zeigt. Genau das war Bens Auflage: der Gegenbau muss die fünf schon vorher getrennten Stücke
// getrennt lassen, sonst vergleicht er gegen ein Bündel, das es nie gab.
const LAZY_SEITE =
  /lazy\(\s*\(\)\s*=>\s*import\("(\.\/pages\/[^"]+)"\)\s*\.then\(\s*\(m\)\s*=>\s*\(\{\s*default:\s*m\.(\w+)\s*\}\)\s*\)\s*,?\s*\)/g;

// Was der Gegenbau wirklich getan hat — kein Zusagen, sondern eine Zahl, die Fall (v) prüft.
// Ein Plugin, dessen Muster ins Leere greift, würde sonst still denselben Bau ein zweites Mal
// erzeugen und ALLE Vergleiche unten grün machen, ohne irgendetwas zu vergleichen.
const GEGENBAU = { ersetzungen: 0, restImporte: -1, gelaufen: false };

function statischeSeiten(): Plugin {
  return {
    name: "job3030-gegenbau-statische-seiten",
    enforce: "pre",
    transform(code: string, id: string) {
      if (posix(id) !== ROUTES) {
        return null;
      }
      const kopf: string[] = [];
      let n = 0;
      const neu = code.replace(LAZY_SEITE, (_treffer, pfad: string, name: string) => {
        n += 1;
        kopf.push(`import { ${name} as __statisch${n} } from "${pfad}";`);
        // Die `lazy`-Hülle bleibt stehen, damit `routes.tsx` sonst unverändert bleibt (dieselben
        // Bezeichner, dasselbe JSX). Für rollup ist die Seite damit statisch am Eintritt — genau
        // der Zustand vor JOB 3030.
        return `lazy(() => Promise.resolve({ default: __statisch${n} }))`;
      });
      GEGENBAU.ersetzungen = n;
      GEGENBAU.restImporte = (neu.match(/import\("\.\/pages\//g) ?? []).length;
      GEGENBAU.gelaufen = true;
      return { code: `${kopf.join("\n")}\n${neu}`, map: null };
    },
  };
}

// ── Der Fingerabdruck eines Verzeichnisses: jeder Pfad mit seiner Änderungszeit ──────────────────
// Der Verzeichnis-Zeitstempel allein genügt nicht: er ändert sich nur, wenn Einträge dazukommen
// oder verschwinden. Ein neu geschriebener Inhalt bei gleicher Dateiliste bliebe unsichtbar — und
// genau das war der Fehler vom 30.08.
function fingerabdruck(verzeichnis: string): string {
  if (!existsSync(verzeichnis)) {
    return "nicht vorhanden";
  }
  const zeilen: string[] = [];
  const gehe = (ort: string): void => {
    for (const eintrag of readdirSync(ort).sort()) {
      const pfad = join(ort, eintrag);
      const stat = statSync(pfad);
      zeilen.push(`${kurz(pfad)}\t${stat.mtimeMs}`);
      if (stat.isDirectory()) {
        gehe(pfad);
      }
    }
  };
  gehe(verzeichnis);
  return `vorhanden\t${statSync(verzeichnis).mtimeMs}\n${zeilen.join("\n")}`;
}

// ── Was `tools/build` wirklich ausgeliefert hat — gelesen, nicht gebaut ──────────────────────────
interface DistBefund {
  eintrittDatei: string;
  eintrittBytes: number;
  jsDateien: number;
  summeJs: number;
}

function distBefund(): DistBefund | null {
  const index = join(DIST, "index.html");
  const assets = join(DIST, "assets");
  if (!existsSync(index) || !existsSync(assets)) {
    return null;
  }
  // Der Eintritt ist das Modul-Skript, das `index.html` einhängt — dieselbe Quelle, aus der der
  // Browser ihn holt. Kein Namensmuster, kein Raten.
  const treffer = readFileSync(index, "utf8").match(
    /<script[^>]+type="module"[^>]+src="\/assets\/([^"]+\.js)"/,
  );
  // Derselbe Name wie in der Rollup-Ausgabe: dort steht der Pfad RELATIV ZUM Bauziel, also mit
  // `assets/` davor. Ohne diese Angleichung verglichen wir zwei Schreibweisen desselben Namens.
  const eintrittDatei = treffer?.[1] ? `assets/${treffer[1]}` : "";
  const js = readdirSync(assets).filter((n) => n.endsWith(".js"));
  return {
    eintrittDatei,
    eintrittBytes: treffer?.[1] ? statSync(join(assets, treffer[1])).size : 0,
    jsDateien: js.length,
    summeJs: js.reduce((a, n) => a + statSync(join(assets, n)).size, 0),
  };
}

interface RollupStueck {
  type: "chunk" | "asset";
  fileName: string;
  isEntry?: boolean;
  moduleIds?: string[];
  imports?: string[];
  // Rollups eigene Angabe, was dieses Stück ausführt. Sie ist der unabhängige Maßstab, an dem (h)
  // die erkannte Ausfuhrliste misst (ben, R2, Korrekturpflicht 1).
  exports?: string[];
  code?: string;
  // JOB 3077: die Byte-Herkunft. `RenderedChunk.modules` (rollup.d.ts:988) führt je Modul die Länge
  // des Codes, den rollup FÜR DIESES MODUL in dieses Stück gerendert hat (`renderedLength`,
  // ebenda :963-969). Ohne dieses Feld lässt sich Inhalt nicht von Rahmen trennen.
  modules?: Record<string, { renderedLength?: number }>;
  // Der Name, den das Stück beim `renderChunk`-Haken trug (mit Hash-Platzhalter). Nur über ihn lässt
  // sich die dort erhobene Rohlänge dem fertigen Stück zuordnen — der endgültige `fileName` trägt
  // schon den Inhaltshash und existiert beim Haken noch nicht.
  preliminaryFileName?: string;
  // JOB 3077 R2: die Herkunft der AUSGELIEFERTEN Bytes. Die Karte bildet das minimierte Stück auf
  // seine Quellen ab; `sourcemapPathTransform` (in `baue()`) macht `sources` absolut, damit sie
  // ohne Raten gegen `moduleIds` stehen. Ohne Karte ist die Byte-Herkunft nicht zu haben — der
  // Wächter (h) wird dann rot, statt eine Zahl aus der falschen Einheit zu übernehmen.
  map?: { mappings?: string; sources?: (string | null)[] } | null;
}

// ── VLQ: DIE KARTE LESEN, OHNE EINE ABHÄNGIGKEIT ZU BORGEN (JOB 3077 R2) ────────────────────────
// `@jridgewell/sourcemap-codec` liegt zwar im Baum, aber nur als durchgereichte Abhängigkeit von
// rollup/vite — ein Test, der sich darauf stützt, bricht an dem Tag, an dem sie jemand hochzieht.
// Die Dekodierung ist zwanzig Zeilen; die Richtigkeit wird nicht zugesagt, sondern von (h) geprüft:
// jede aus der Karte gelesene Quelle MUSS in `moduleIds` desselben Stücks stehen, und die Zahl der
// Kartenzeilen muss zur Zahl der Codezeilen passen. Ein falsch gelesener Index fiele sofort auf.
const VLQ_ZEICHEN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const VLQ_WERT = new Map([...VLQ_ZEICHEN].map((zeichen, i) => [zeichen, i] as const));

function vlqSegmente(zeile: string): number[][] {
  const segmente: number[][] = [];
  for (const roh of zeile.split(",")) {
    if (roh === "") {
      continue;
    }
    const felder: number[] = [];
    let wert = 0;
    let schub = 0;
    for (const zeichen of roh) {
      const ziffer = VLQ_WERT.get(zeichen);
      if (ziffer === undefined) {
        throw new Error(`unbekanntes VLQ-Zeichen "${zeichen}" in der Quellkarte`);
      }
      wert += (ziffer & 31) << schub;
      if ((ziffer & 32) !== 0) {
        schub += 5;
        continue;
      }
      felder.push((wert & 1) === 1 ? -(wert >>> 1) : wert >>> 1);
      wert = 0;
      schub = 0;
    }
    segmente.push(felder);
  }
  return segmente;
}

interface KartenBefund {
  jeQuelle: Map<string, number>;
  zugeordnet: number;
  kartenZeilen: number;
  fremdeQuellen: string[];
  // Die erzeugte Ausfuhrliste: wie viele Bytes sie kostet und wie viele Einträge sie führt. Die
  // Eintragszahl wird von (h) gegen `chunk.exports.length` gestellt — der unabhängige Beleg dafür,
  // dass wirklich der erzeugte Block erkannt wurde und nicht irgendein `export{` im Modulcode.
  ausfuhrBytes: number;
  ausfuhrEintraege: number;
}

// ── DIE ERZEUGTE AUSFUHRLISTE AM STÜCKENDE (ben, R2, Korrekturpflicht 1) ────────────────────────
// Rollup hängt an jedes Stück, das etwas ausführt, eine Liste `export{a as b,c as d};`. Sie stammt
// aus KEINER Quelldatei — sie ist Rahmen. Die Quellkarte weiß das aber nicht: sie enthält für diesen
// Bereich schlicht KEIN Segment, und wer (wie Runde 2 dieses Auftrags) das letzte Segment einer
// Zeile bis zum Zeilenende laufen lässt, schreibt die ganze Liste dem zuletzt zugeordneten Modul zu.
// GEMESSEN, wie teuer dieser Fehler war: `main.tsx` bekam so `);export{…};` mit 1 731 B, und
// `externalAttachGate.ts` `};export{…};` mit 692 B — beide erschienen dadurch als „wachsender
// Modulinhalt", obwohl dort keine Zeile Modulcode steht.
//
// DIE ERKENNUNG IST NICHT GERATEN, SONDERN GEGEN ROLLUPS EIGENE ANGABE GEPRÜFT: der Block muss am
// Stückende stehen und vollständig bis zum Dateiende reichen, und die Zahl seiner Einträge muss mit
// `chunk.exports.length` übereinstimmen. Beides prüft der Wächter (h) für JEDES Stück beider Bauten.
// Ein Stück ohne Ausfuhren darf keinen Block haben, eines mit Ausfuhren muss einen haben.
interface AusfuhrBlock {
  start: number;
  eintraege: number;
}

function ausfuhrBlock(code: string): AusfuhrBlock | null {
  const start = code.lastIndexOf("export{");
  if (start < 0) {
    return null;
  }
  const rest = code.slice(start);
  // Bis zum Dateiende, und dazwischen keine geschweifte Klammer: dann ist es wirklich die erzeugte
  // Liste und nicht ein `export{` in einer Zeichenkette irgendwo im Modulcode.
  if (!/^export\{[^{}]*\};?\s*$/.test(rest)) {
    return null;
  }
  const liste = rest.slice("export{".length, rest.indexOf("}"));
  return { start, eintraege: liste === "" ? 0 : liste.split(",").length };
}

// ── DIE BYTE-HERKUNFT DES MINIMIERTEN STÜCKS ────────────────────────────────────────────────────
// Jedes Segment der Karte sagt: „ab Spalte X stammt das Folgende aus Quelle Q". Es reicht also bis
// zur Spalte des nächsten Segments. Was diese Bereiche abdecken, ist INHALT — Code, der aus einer
// Quelldatei stammt. Was übrig bleibt, ist RAHMEN:
//   · alles VOR dem ersten Segment (der erzeugte Kopf, z. B. `const __vite__mapDeps=…`),
//   · Segmente ohne Quellenangabe und alle nicht abgedeckten Spalten,
//   · die Zeilenumbrüche,
//   · und die erzeugte Ausfuhrliste am Stückende — sie wird ausdrücklich ABGESCHNITTEN, sonst
//     verlängert das letzte Segment sich über sie hinweg (siehe oben).
// Gezählt wird in UTF-8-BYTES des ausgelieferten Codes — derselben Einheit wie `summeJs` und wie
// das, was der Browser über die Leitung holt. Gerechnet wird in ABSOLUTEN Versätzen im ganzen Stück,
// damit die Grenze der Ausfuhrliste unabhängig von der Zeile gilt, in der sie steht.
function byteHerkunft(
  code: string,
  mappings: string,
  quellen: string[],
  ids: Set<string>,
): KartenBefund {
  const zeilen = code.split("\n");
  const kartenZeilen = mappings.split(";");
  const jeQuelle = new Map<string, number>();
  const fremdeQuellen = new Set<string>();
  const block = ausfuhrBlock(code);
  // Die obere Schranke der Zuordnung: ab hier beginnt die erzeugte Ausfuhrliste, und ab hier wird
  // KEIN Byte mehr einem Modul zugeschrieben.
  const grenze = block ? block.start : code.length;
  let zugeordnet = 0;
  let quelleIdx = 0;
  let zeilenAnfang = 0;
  for (let i = 0; i < kartenZeilen.length; i += 1) {
    const zeile = zeilen[i] ?? "";
    let spalte = 0;
    const aufgeloest: { spalte: number; quelle: string | null }[] = [];
    for (const felder of vlqSegmente(kartenZeilen[i] ?? "")) {
      spalte += felder[0] ?? 0;
      if (felder.length >= 4) {
        quelleIdx += felder[1] ?? 0;
        aufgeloest.push({ spalte, quelle: quellen[quelleIdx] ?? null });
      } else {
        // Ein Segment ohne Quellenangabe beendet den vorigen Bereich: ab hier ist es Rahmen.
        aufgeloest.push({ spalte, quelle: null });
      }
    }
    aufgeloest.sort((a, b) => a.spalte - b.spalte);
    for (let j = 0; j < aufgeloest.length; j += 1) {
      const eintrag = aufgeloest[j] as { spalte: number; quelle: string | null };
      const quelle = eintrag.quelle;
      if (quelle === null) {
        continue;
      }
      const von = zeilenAnfang + Math.min(Math.max(eintrag.spalte, 0), zeile.length);
      const bis = zeilenAnfang + Math.min(aufgeloest[j + 1]?.spalte ?? zeile.length, zeile.length);
      const bisGekappt = Math.min(bis, grenze);
      if (bisGekappt <= von) {
        continue;
      }
      if (!ids.has(quelle)) {
        fremdeQuellen.add(quelle);
      }
      const anzahl = Buffer.byteLength(code.slice(von, bisGekappt), "utf8");
      jeQuelle.set(quelle, (jeQuelle.get(quelle) ?? 0) + anzahl);
      zugeordnet += anzahl;
    }
    zeilenAnfang += zeile.length + 1;
  }
  return {
    jeQuelle,
    zugeordnet,
    kartenZeilen: kartenZeilen.length,
    fremdeQuellen: [...fremdeQuellen],
    ausfuhrBytes: block ? Buffer.byteLength(code.slice(block.start), "utf8") : 0,
    ausfuhrEintraege: block ? block.eintraege : -1,
  };
}

// ── DIE ROHLÄNGE: das Stück, BEVOR esbuild es minimiert (JOB 3077) ───────────────────────────────
// `renderedLength` ist vor der Minimierung erhoben. Die ausgelieferte Byte-Größe ist danach. Eine
// Differenz aus beiden wäre keine Zahl, sondern ein Kategorienfehler (sie wird negativ). Dieses
// Plugin holt die fehlende dritte Zahl in DERSELBEN Einheit wie `renderedLength`: `enforce: "pre"`
// stellt seinen `renderChunk`-Haken vor den des Minimierers, und `return null` sagt rollup, dass es
// nichts verändert hat — der ausgelieferte Bau bleibt Byte für Byte derselbe (die KALIBRIERUNG
// unten prüft genau das gegen `apps/web/dist`).
const ROHLAENGE = new Map<string, number>();

function rohLaenge(): Plugin {
  return {
    name: "job3077-rohlaenge",
    enforce: "pre",
    renderChunk(code: string, chunk: { fileName: string }) {
      ROHLAENGE.set(chunk.fileName, code.length);
      return null;
    },
  };
}

interface Stueck {
  fileName: string;
  isEntry: boolean;
  moduleIds: string[];
  // NUR die STATISCHEN Importe dieses Stücks. Genau sie muss der Browser mitladen, bevor der Code
  // des Stücks laufen darf; `dynamicImports` gehören ausdrücklich NICHT dazu — das sind die
  // nachgeladenen Seiten, und ihr Fehlen im Erstzugriff ist der ganze Gewinn dieses Auftrags.
  imports: string[];
  // Die AUSGELIEFERTE Größe: das minimierte Stück, so wie der Browser es holt.
  bytes: number;
  // ── ERSTE SICHT: die ausgelieferten BYTES, aus der Quellkarte zugeordnet (JOB 3077 R2) ────────
  // Dieselbe Einheit wie `bytes` und `summeJs`. `inhaltBytes + rahmenBytes === bytes`, exakt.
  inhaltBytes: number;
  rahmenBytes: number;
  inhaltBytesJeModul: Map<string, number>;
  ohneKarte: boolean;
  // Die erzeugte Ausfuhrliste am Stückende: ihre Bytes zählen als Rahmen, und `ausfuhrStimmt` sagt,
  // ob ihre Eintragszahl zu rollups `exports` passt (ben, R2, Korrekturpflicht 1).
  ausfuhrBytes: number;
  ausfuhrStimmt: boolean;
  ausfuhrBefund: string;
  kartenZeilen: number;
  codeZeilen: number;
  fremdeQuellen: string[];
  // ── ZWEITE SICHT: ZEICHEN vor der Minimierung, aus `renderedLength` (JOB 3077 R1) ─────────────
  // `roh` ist -1, wenn `rohLaenge()` dieses Stück nicht gesehen hat — dann wird der Wächter (h)
  // rot, statt dass `rahmen` still eine erfundene Zahl trägt.
  roh: number;
  inhalt: number;
  rahmen: number;
  // Je Modul die gerenderte Länge. `ohneLaengenangabe` zählt die Module, für die rollup GAR KEINE
  // Länge geliefert hat (ben, R1, Prüflücke 6): eine fehlende Angabe darf nicht als 0 durchgehen.
  jeModul: Map<string, number>;
  ohneLaengenangabe: number;
}

interface Bau {
  name: string;
  stuecke: Stueck[];
  jsStuecke: Stueck[];
  eintritt: Stueck | null;
  // Ausgeliefert, in Bytes: die Summe aller `.js`-Stücke nach der Minimierung.
  summeJs: number;
  // Herkunft DER AUSGELIEFERTEN BYTES: inhaltBytesJs + rahmenBytesJs === summeJs, exakt.
  inhaltBytesJs: number;
  rahmenBytesJs: number;
  inhaltBytesJeModul: Map<string, number>;
  ohneKarte: number;
  // Die Bytes aller erzeugten Ausfuhrlisten des Baus, und die Stücke, bei denen die Eintragszahl
  // NICHT zu rollups `exports` passt — bei denen die Erkennung also nicht belegt ist.
  ausfuhrBytesJs: number;
  ausfuhrFehlschlaege: string[];
  zeilenAbweichung: number;
  fremdeQuellen: string[];
  // Zweitsicht, in Zeichen vor der Minimierung: rohJs = inhaltJs + rahmenJs, exakt und ohne Toleranz.
  rohJs: number;
  inhaltJs: number;
  rahmenJs: number;
  ohneLaengenangabe: number;
  // Je Modul über ALLE `.js`-Stücke aufsummiert. Nach (c1) liegt jedes Modul in genau einem Stück,
  // die Summe ist also je Modul genau ein Summand — im Gegenbau wie im aufgeteilten Bau.
  inhaltJeModul: Map<string, number>;
  // Die beiden Zahlen, an denen der Wächter (h) merkt, dass eine Grundlage FEHLT statt null zu sein.
  ohneRohlaenge: number;
  ohneModulangabe: number;
}

const ZIELE: string[] = [];

async function baue(name: string, plugins: Plugin[]): Promise<Bau> {
  const ziel = mkdtempSync(join(tmpdir(), `klarwerk-erstladezeit-${name}-`));
  ZIELE.push(ziel);
  // `tools/build:48` fährt `(cd apps/web && npx vite build)`, und das `cd` ist nicht Bequemlichkeit:
  // `apps/web/tailwind.config.ts:16` führt seine Inhaltsquellen relativ (`./src/**/*.{ts,tsx}`), und
  // PostCSS löst sie gegen das ARBEITSVERZEICHNIS auf, nicht gegen die Vite-Wurzel. Ohne den Wechsel
  // findet Tailwind keine einzige Klasse und `@apply ring-brand/60` bricht den Bau ab — gemessen,
  // nicht vermutet.
  //
  // UND `NODE_ENV=production`, ausdrücklich (ben, R2): Vite setzt die Variable beim Bauen nur, wenn
  // sie leer ist; unter vitest steht dort `test`, und dann entsteht ein Entwicklungsbau. Beides wird
  // in `finally` zurückgestellt, damit ein Fehlschlag den restlichen Lauf nicht verstellt.
  const vorherigesVerzeichnis = process.cwd();
  const vorherigesEnv = process.env.NODE_ENV;
  let ergebnis: unknown;
  // Die Rohlängen gehören zu GENAU DIESEM Baulauf. Bliebe der vorige Inhalt stehen, trüge ein Stück,
  // das `rohLaenge()` diesmal nicht sah, still die Zahl des anderen Baus.
  ROHLAENGE.clear();
  try {
    process.chdir(WEB);
    process.env.NODE_ENV = "production";
    ergebnis = await build({
      root: WEB,
      configFile: join(WEB, "vite.config.ts"),
      mode: "production",
      logLevel: "silent",
      plugins: [...plugins, rohLaenge()],
      build: {
        outDir: ziel,
        sourcemap: "hidden",
        rollupOptions: {
          output: {
            sourcemapPathTransform: (relativ: string, kartePfad: string) =>
              posix(resolve(dirname(kartePfad), relativ)),
          },
        },
      },
    });
  } finally {
    process.env.NODE_ENV = vorherigesEnv;
    process.chdir(vorherigesVerzeichnis);
  }

  const roh = ergebnis as { output: RollupStueck[] } | { output: RollupStueck[] }[] | undefined;
  const ausgaben: RollupStueck[] = Array.isArray(roh)
    ? roh.flatMap((r) => r.output)
    : (roh?.output ?? []);
  const stuecke: Stueck[] = ausgaben
    .filter((a) => a.type === "chunk")
    .map((a) => {
      // Eine FEHLENDE Länge ist nicht die Länge 0 (ben, R1, Prüflücke 6). Sie wird gezählt und von
      // (h) rot gemacht; nur eine wirklich gelieferte Zahl geht in die Summen ein.
      const eintraege = Object.entries(a.modules ?? {});
      const geliefert = eintraege.filter(([, m]) => typeof m.renderedLength === "number");
      const jeModul = new Map(
        geliefert.map(([id, m]) => [posix(id), m.renderedLength as number] as const),
      );
      const inhalt = [...jeModul.values()].reduce((s, l) => s + l, 0);
      const rohStueck = ROHLAENGE.get(a.preliminaryFileName ?? "") ?? -1;
      const code = a.code ?? "";
      const bytes = Buffer.byteLength(code, "utf8");
      const ids = new Set((a.moduleIds ?? []).map(posix));
      const karte =
        a.map && typeof a.map.mappings === "string"
          ? byteHerkunft(
              code,
              a.map.mappings,
              (a.map.sources ?? []).map((q) => posix(q ?? "")),
              ids,
            )
          : null;
      return {
        fileName: a.fileName,
        isEntry: a.isEntry === true,
        moduleIds: [...ids],
        imports: a.imports ?? [],
        bytes,
        // Ohne Karte gibt es keine Byte-Herkunft — und NICHT den Inhalt 0. (h) sieht es an `ohneKarte`.
        inhaltBytes: karte ? karte.zugeordnet : -1,
        rahmenBytes: karte ? bytes - karte.zugeordnet : -1,
        inhaltBytesJeModul: karte ? karte.jeQuelle : new Map<string, number>(),
        ohneKarte: karte === null,
        // Der unabhängige Abgleich je Stück: die Zahl der Einträge in der erkannten Ausfuhrliste
        // gegen rollups `exports`. Stimmt sie nicht, ist der Block falsch (oder gar nicht) erkannt.
        ausfuhrBytes: karte ? karte.ausfuhrBytes : -1,
        ausfuhrStimmt: karte ? karte.ausfuhrEintraege === (a.exports ?? []).length : false,
        ausfuhrBefund: `${a.fileName}: Liste ${karte?.ausfuhrEintraege ?? "—"} Einträge, rollup meldet ${(a.exports ?? []).length}`,
        kartenZeilen: karte ? karte.kartenZeilen : -1,
        // Der Code endet auf `\n`; `split` liefert dafür ein leeres Schlussstück, das keine
        // Kartenzeile hat. Verglichen wird deshalb gegen die Zahl der ECHTEN Zeilen.
        codeZeilen: code.endsWith("\n") ? code.split("\n").length - 1 : code.split("\n").length,
        fremdeQuellen: karte ? karte.fremdeQuellen : [],
        roh: rohStueck,
        inhalt,
        // Fehlt die Rohlänge, gibt es keinen Rahmen — und NICHT den Rahmen 0. Der Wächter (h) sieht
        // das an `ohneRohlaenge` und wird rot; keine Zahl ohne ihre Grundlage.
        rahmen: rohStueck < 0 ? -1 : rohStueck - inhalt,
        jeModul,
        ohneLaengenangabe: eintraege.length - geliefert.length,
      };
    });
  const jsStuecke = stuecke.filter((s) => s.fileName.endsWith(".js"));
  const inhaltJeModul = new Map<string, number>();
  const inhaltBytesJeModul = new Map<string, number>();
  for (const s of jsStuecke) {
    for (const [id, laenge] of s.jeModul) {
      inhaltJeModul.set(id, (inhaltJeModul.get(id) ?? 0) + laenge);
    }
    for (const [id, anzahl] of s.inhaltBytesJeModul) {
      inhaltBytesJeModul.set(id, (inhaltBytesJeModul.get(id) ?? 0) + anzahl);
    }
  }
  return {
    name,
    stuecke,
    jsStuecke,
    eintritt: stuecke.find((s) => s.isEntry) ?? null,
    summeJs: jsStuecke.reduce((a, s) => a + s.bytes, 0),
    inhaltBytesJs: jsStuecke.reduce((a, s) => a + Math.max(s.inhaltBytes, 0), 0),
    rahmenBytesJs: jsStuecke.reduce((a, s) => a + Math.max(s.rahmenBytes, 0), 0),
    inhaltBytesJeModul,
    ohneKarte: jsStuecke.filter((s) => s.ohneKarte).length,
    ausfuhrBytesJs: jsStuecke.reduce((a, s) => a + Math.max(s.ausfuhrBytes, 0), 0),
    ausfuhrFehlschlaege: jsStuecke.filter((s) => !s.ausfuhrStimmt).map((s) => s.ausfuhrBefund),
    zeilenAbweichung: jsStuecke.filter((s) => s.kartenZeilen !== s.codeZeilen).length,
    fremdeQuellen: [...new Set(jsStuecke.flatMap((s) => s.fremdeQuellen))],
    rohJs: jsStuecke.reduce((a, s) => a + Math.max(s.roh, 0), 0),
    inhaltJs: jsStuecke.reduce((a, s) => a + s.inhalt, 0),
    rahmenJs: jsStuecke.reduce((a, s) => a + Math.max(s.rahmen, 0), 0),
    ohneLaengenangabe: jsStuecke.reduce((a, s) => a + s.ohneLaengenangabe, 0),
    inhaltJeModul,
    ohneRohlaenge: jsStuecke.filter((s) => s.roh < 0).length,
    // `moduleIds` leitet rollup aus denselben Schlüsseln ab wie `modules`. Weichen die Zahlen ab, ist
    // die Angabe unvollständig geliefert worden — und jede Inhalt/Rahmen-Aussage wäre wertlos.
    ohneModulangabe: jsStuecke.filter((s) => s.jeModul.size !== s.moduleIds.length).length,
  };
}

// ── Die HÜLLE eines Stücks: es selbst plus alles, was es STATISCH nachzieht ─────────────────────
// Das ist die Menge, die im Browser gemeinsam dasein muss. Für den Eintritt ist sie die Antwort auf
// „was lädt, bevor überhaupt etwas erscheint"; für ein Seitenstück die Antwort auf „was kommt beim
// Hinnavigieren dazu". Beides zusammen ist die ERSTLAST der jeweiligen Seite.
function huelle(bau: Bau, start: string[]): Set<string> {
  const nachName = new Map(bau.stuecke.map((s) => [s.fileName, s]));
  const gesehen = new Set<string>();
  const rand = [...start];
  while (rand.length > 0) {
    const datei = rand.pop() as string;
    if (gesehen.has(datei)) {
      continue;
    }
    gesehen.add(datei);
    for (const weiter of nachName.get(datei)?.imports ?? []) {
      rand.push(weiter);
    }
  }
  return gesehen;
}

function bytes(bau: Bau, dateien: Iterable<string>): number {
  const nachName = new Map(bau.stuecke.map((s) => [s.fileName, s]));
  let summe = 0;
  for (const datei of dateien) {
    summe += nachName.get(datei)?.bytes ?? 0;
  }
  return summe;
}

// Die Erstlast JE SEITE, in einem beliebigen Bau erhoben — damit derselbe Maßstab an den
// aufgeteilten UND an den Gegenbau gelegt werden kann. Zwei Rechenwege wären zwei Wahrheiten.
// Liegt die Seite im Eintritt (so im Gegenbau), fällt die Rechnung von selbst auf die
// Eintritts-Hülle zurück — `huelle(bau, [eintritt])` ist dann beides. Kein Sonderfall nötig.
function erstlast(bau: Bau): Map<string, number> {
  const eintrittHuelle = huelle(bau, bau.eintritt ? [bau.eintritt.fileName] : []);
  return new Map(
    SOLL_SEITEN.map((seite) => {
      const traeger = bau.stuecke.find((s) => s.moduleIds.includes(seite));
      if (!traeger) {
        return [seite, -1];
      }
      const gesamt = new Set([...eintrittHuelle, ...huelle(bau, [traeger.fileName])]);
      return [seite, bytes(bau, gesamt)];
    }),
  );
}

// ── DER BELEG ZU (c3): welches MODUL wächst, und um wie viel (JOB 3077) ─────────────────────────
// Eine Budgetzahl ohne diese Liste wäre ein Blankoscheck: sie sagt „so viel Inhalt darf wachsen",
// ohne zu sagen, WAS wächst. Verglichen wird je Modul die gerenderte Länge im aufgeteilten Bau gegen
// dieselbe im Gegenbau; absteigend nach Zuwachs, damit die Liste mit dem Verursacher anfängt.
interface ModulZuwachs {
  id: string;
  vorher: number;
  nachher: number;
  zuwachs: number;
}

function modulZuwaechse(nachher: Map<string, number>, vorher: Map<string, number>): ModulZuwachs[] {
  const alle = new Set([...nachher.keys(), ...vorher.keys()]);
  return [...alle]
    .map((id) => {
      const n = nachher.get(id) ?? 0;
      const v = vorher.get(id) ?? 0;
      return { id, vorher: v, nachher: n, zuwachs: n - v };
    })
    .filter((z) => z.zuwachs !== 0)
    .sort((a, b) => b.zuwachs - a.zuwachs);
}

const zuwachsZeile =
  (einheit: string) =>
  (z: ModulZuwachs): string =>
    `${z.zuwachs > 0 ? "+" : ""}${z.zuwachs} ${einheit}\t${kurz(z.id)}\t${z.vorher} → ${z.nachher}`;

let GETEILT: Bau | null = null;
let VORHER: Bau | null = null;
let DIST_VORHER = "";
let DIST_NACHHER = "";
let DIST_BEFUND: DistBefund | null = null;

beforeAll(async () => {
  DIST_VORHER = fingerabdruck(DIST);
  DIST_BEFUND = distBefund();
  GETEILT = await baue("geteilt", []);
  VORHER = await baue("vorher", [statischeSeiten()]);
  DIST_NACHHER = fingerabdruck(DIST);

  const g = GETEILT;
  const v = VORHER;
  const gHuelle = bytes(g, huelle(g, g.eintritt ? [g.eintritt.fileName] : []));
  const vHuelle = bytes(v, huelle(v, v.eintritt ? [v.eintritt.fileName] : []));
  console.log(
    [
      "[JOB 3030] NODE_ENV=production · zwei Bauläufe desselben Quellstands",
      `  VORHER (Seiten statisch): ${v.jsStuecke.length} .js-Stücke · Eintritt ${v.eintritt?.fileName ?? "—"} ${v.eintritt?.bytes ?? 0} B · Eintritts-Hülle ${vHuelle} B · Summe ${v.summeJs} B`,
      `  NACHHER (aufgeteilt):     ${g.jsStuecke.length} .js-Stücke · Eintritt ${g.eintritt?.fileName ?? "—"} ${g.eintritt?.bytes ?? 0} B · Eintritts-Hülle ${gHuelle} B · Summe ${g.summeJs} B`,
      `  Eintritt ${(g.eintritt?.bytes ?? 0) - (v.eintritt?.bytes ?? 0)} B · Summe +${g.summeJs - v.summeJs} B auf ${g.jsStuecke.length - v.jsStuecke.length} zusätzliche Stücke`,
      `  dist: ${DIST_BEFUND ? `${DIST_BEFUND.eintrittDatei} ${DIST_BEFUND.eintrittBytes} B, ${DIST_BEFUND.jsDateien} Dateien, ${DIST_BEFUND.summeJs} B` : "nicht gebaut"}`,
    ].join("\n"),
  );
}, 900_000);

afterAll(() => {
  for (const ziel of ZIELE) {
    rmSync(ziel, { recursive: true, force: true });
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// KALIBRIERUNG · gegen den ausgelieferten Bau
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EIN EIGENER BLOCK, seit JOB 3077 (ben, R11, Promptverbesserung 1: „Trenne die `dist`-Kalibrierung
// von der Mutationssuite, sodass ein statischer Seitenimport tatsächlich genau (a) und (b) kippt").
// Der Unterschied ist nicht Kosmetik, sondern eine andere FRAGE:
//   · Dieser Block fragt: MISST dieser Test überhaupt das Bündel, das ausgeliefert wird?
//   · Der Block darunter fragt: WAS ist an diesem Bündel wahr?
// Wer eine Mutation setzt und `./tools/build` fährt (Mutationsprotokoll im Kopf), ändert BEIDE
// Bündel gleichzeitig — dieser Block bleibt dann grün, und die Trefferliste der Mutation ist die
// Aussage. Bliebe er im selben Block, wäre bei jeder Mutation unklar, ob die Kalibrierung mit
// gekippt ist, weil die Aufteilung falsch wurde oder weil `dist` einfach älter ist.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// KALIBRIERUNG DES ZUORDNERS · an von Hand bekannten Fällen
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// (ben, R2, Prüflücke 6: „Der Zuordnungsalgorithmus braucht einen unabhängig bekannten
// Erwartungsfall mit Modulcode und anschließend erzeugtem Exportblock … Dieser muss die aktuelle
// Fehlklassifikation erkennen.")
//
// WARUM DAS NÖTIG IST, und warum die Summenidentität dafür NICHT reicht: `Rahmen = Gesamtbytes −
// zugeordnete Bytes` geht IMMER auf, egal wie falsch die Zuordnung ist. Sie bestätigt die Rechnung,
// nicht die Kategorie. Diese Fälle prüfen die Kategorie — an Eingaben, deren richtige Antwort man
// abzählen kann, ohne etwas zu bauen.
//
// DER ERSTE FALL IST GENAU DER FEHLER AUS RUNDE 2. Bei `const a=1;export{a as b};` steht ein
// einziges Segment an Spalte 0. Die Fassung von Runde 2 verlängerte es bis zum Zeilenende und
// zählte alle 25 Bytes als Modulinhalt; richtig sind 10 B Inhalt und 15 B Rahmen. Wer die Kappung
// in `byteHerkunft()` wieder entfernt, bekommt hier `25` statt `10` und damit einen roten Fall.
describe("KALIBRIERUNG DES ZUORDNERS · an von Hand bekannten Fällen", () => {
  const QUELLE = "/x/modul.ts";
  const IDS = new Set([QUELLE]);

  it("Z1 die erzeugte Ausfuhrliste zählt als Rahmen, nicht als Inhalt des letzten Moduls", () => {
    //  Spalte:            0123456789
    const code = "const a=1;export{a as b};";
    // Ein Segment: Spalte 0 → Quelle 0, Zeile 0, Spalte 0. VLQ „AAAA".
    const befund = byteHerkunft(code, "AAAA", [QUELLE], IDS);
    expect(befund.jeQuelle.get(QUELLE), "`const a=1;` sind zehn Bytes Modulinhalt").toBe(10);
    expect(
      befund.zugeordnet,
      "Runde 2 zählte hier 25 — das letzte Segment lief über die Ausfuhrliste hinweg.",
    ).toBe(10);
    expect(
      Buffer.byteLength(code) - befund.zugeordnet,
      "`export{a as b};` sind fünfzehn Bytes Rahmen",
    ).toBe(15);
    expect(befund.ausfuhrBytes, "genau diese fünfzehn Bytes sind die erkannte Liste").toBe(15);
    expect(befund.ausfuhrEintraege, "die Liste führt einen Eintrag (`a as b`)").toBe(1);
  });

  it("Z2 ein erzeugter Kopf vor dem ersten Segment ist ebenfalls Rahmen", () => {
    // 22 Bytes erzeugter Kopf, dann 12 Bytes Modulcode, dann 10 Bytes Ausfuhrliste.
    const kopf = 'import{x}from"./a.js";';
    const rumpf = "const b=x+1;";
    const code = `${kopf}${rumpf}export{b};`;
    expect(kopf.length, "Kopflänge, von Hand nachgezählt").toBe(22);
    // Ein Segment an Spalte 22 → Quelle 0. VLQ: 22 → „sB", dann Quelle/Zeile/Spalte 0 → „AAA".
    const befund = byteHerkunft(code, "sBAAA", [QUELLE], IDS);
    expect(befund.jeQuelle.get(QUELLE), "nur `const b=x+1;` ist Inhalt").toBe(rumpf.length);
    expect(Buffer.byteLength(code) - befund.zugeordnet, "Kopf plus Ausfuhrliste sind Rahmen").toBe(
      kopf.length + "export{b};".length,
    );
  });

  it("Z3 zwei Module auf einer Zeile werden an der Segmentgrenze getrennt", () => {
    const zweite = "/x/zweite.ts";
    const code = "const a=1;const b=2;export{a,b};";
    // Segmente bei Spalte 0 (Quelle 0) und Spalte 10 (Quelle +1). Die vier Felder stehen in der
    // Reihenfolge Spalte, Quelle, Zeile, Spalte-in-der-Quelle: „AAAA" dann „UCAA"
    // (Spaltendelta 10 → „U", Quellendelta +1 → „C", Zeilendelta 0 → „A", Spaltendelta 0 → „A").
    const befund = byteHerkunft(code, "AAAA,UCAA", [QUELLE, zweite], new Set([QUELLE, zweite]));
    expect(befund.jeQuelle.get(QUELLE), "`const a=1;`").toBe(10);
    expect(befund.jeQuelle.get(zweite), "`const b=2;` — NICHT auch die Ausfuhrliste").toBe(10);
    expect(befund.ausfuhrEintraege, "`a,b` sind zwei Einträge").toBe(2);
  });

  it("Z4 ein `export{` im Modulcode wird nicht für die erzeugte Liste gehalten", () => {
    // Die Zeichenkette endet nicht auf einer Ausfuhrliste — es darf nichts abgeschnitten werden.
    const code = 'const s="export{a}";const b=2;';
    const befund = byteHerkunft(code, "AAAA", [QUELLE], IDS);
    expect(befund.ausfuhrBytes, "kein erzeugter Block vorhanden").toBe(0);
    expect(befund.jeQuelle.get(QUELLE), "der ganze Code ist Modulinhalt").toBe(
      Buffer.byteLength(code),
    );
  });

  it("Z5 ein Segment ohne Quellenangabe beendet den Bereich des Moduls", () => {
    const code = "const a=1;GENERIERT;export{a};";
    // Segment bei 0 (Quelle 0), dann bei Spalte 10 ein EINFELDRIGES Segment (nur Spaltendelta).
    const befund = byteHerkunft(code, "AAAA,U", [QUELLE], IDS);
    expect(befund.jeQuelle.get(QUELLE), "nur bis zum quellenlosen Segment").toBe(10);
  });
});

describe("KALIBRIERUNG · gegen den ausgelieferten Bau", () => {
  // ── (ben, R2, Korrekturpflicht 1) ─────────────────────────────────────────────────────────────
  // Ohne sie misst dieser Test IRGENDEIN Bündel. Mit ihr misst er nachweislich DAS Bündel, das
  // `tools/build` nach `apps/web/dist` schreibt und das der Server ausliefert. Verglichen werden
  // Eintrittsdatei (Name samt Inhaltsstempel), Eintrittsgröße, Zahl der `.js`-Stücke und deren
  // Summe. Der Name enthält den Inhaltshash — stimmt er überein, ist der Eintritt bytegleich.
  //
  // SIE IST SEIT JOB 3077 AUCH DER BELEG, dass `rohLaenge()` nichts verändert: das Plugin hängt in
  // BEIDEN Bauläufen, und dieser Bau ist trotzdem bytegleich zu dem ohne Plugin gebauten `dist`.
  it("KALIBRIERUNG: dieser Bau ist derselbe, den `tools/build` ausliefert", () => {
    expect(
      DIST_BEFUND,
      "`apps/web/dist` fehlt — vorher `./tools/build` fahren (im Tor läuft es immer vor den Tests).",
    ).not.toBeNull();
    const d = DIST_BEFUND as DistBefund;
    const g = GETEILT as Bau;
    // Der HÄUFIGERE Fall ist nicht das fehlende `dist`, sondern das veraltete: wer eine Quelle
    // ändert und die Tests fährt, ohne neu zu bauen, sieht hier vier abweichende Zahlen und sucht
    // den Fehler in der Aufteilung. Deshalb steht der Handgriff an JEDER der vier Zusicherungen.
    const stand =
      "Weicht das ab, stammt `apps/web/dist` aus einem ANDEREN Quellstand als der Bau dieses Tests — `./tools/build` fahren. ";
    expect(d.eintrittDatei, `${stand}Eintrittsdatei laut dist/index.html`).toBe(
      g.eintritt?.fileName ?? "",
    );
    expect(d.eintrittBytes, `${stand}Eintrittsgröße`).toBe(g.eintritt?.bytes ?? 0);
    expect(d.jsDateien, `${stand}Zahl der .js-Stücke`).toBe(g.jsStuecke.length);
    expect(d.summeJs, `${stand}Summe aller .js-Bytes`).toBe(g.summeJs);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// MUTATIONSSUITE · das gebaute Bündel zerfällt in Stücke
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("MUTATIONSSUITE · das gebaute Bündel zerfällt in Stücke", () => {
  it("beide Bauläufe sind wirklich gelaufen (ein leeres Ergebnis wäre ein grüner Test)", () => {
    // Ohne diesen Fall könnten alle folgenden allein dadurch grün sein, dass gar nichts gebaut wurde.
    expect(GETEILT, "kein aufgeteilter Bau").not.toBeNull();
    expect(VORHER, "kein Gegenbau").not.toBeNull();
    expect((GETEILT as Bau).jsStuecke.length).toBeGreaterThan(1);
    expect((GETEILT as Bau).eintritt, "kein Eintritts-Stück in der Rollup-Ausgabe").not.toBeNull();
    expect((VORHER as Bau).summeJs).toBeGreaterThan(0);
    expect(
      SOLL_SEITEN.length,
      "keine Seitenmodule gefunden — läuft die Erhebung ins Leere?",
    ).toBeGreaterThan(15);
  });

  // ── (h) DIE HERKUNFTSANGABE IST WIRKLICH GELIEFERT (JOB 3077) ─────────────────────────────────
  // Derselbe Fehlerklasse-Wächter wie `GEGENBAU.gelaufen` weiter unten, nur für die zweite neue
  // Grundlage. Ohne ihn wäre (c3) STILL GRÜN, sobald rollup `modules` nicht mehr füllt oder der
  // `renderChunk`-Haken nicht mehr vor dem Minimierer läuft: dann stünde überall Inhalt 0 und
  // Rahmen 0, jede Differenz wäre 0, und der Fall meldete Erfolg, ohne etwas gemessen zu haben.
  //
  // GEPRÜFT WIRD DIE GRUNDLAGE, NICHT DAS ERGEBNIS:
  //   1. In BEIDEN Bauten ist Inhalt > 0 — es gibt überhaupt Modulangaben.
  //   2. In BEIDEN Bauten trägt JEDES `.js`-Stück eine Rohlänge; keine wurde ersatzweise gesetzt.
  //   3. In BEIDEN Bauten deckt sich die Zahl der Modulangaben mit `moduleIds` — die Angabe ist
  //      vollständig, nicht bloß nicht-leer.
  //   4. In BEIDEN Bauten ist Inhalt <= Rohlänge. Ein Stück kann nicht mehr Modulcode enthalten,
  //      als es lang ist; wäre es doch so, wären die beiden Zahlen in verschiedenen Einheiten
  //      erhoben (genau der Fehler, den `bytes − inhalt` gemacht hätte, siehe Kopf).
  it("(h) Inhalt und Rahmen stehen auf gelieferten Angaben, nicht auf Nullen", () => {
    for (const b of [GETEILT as Bau, VORHER as Bau]) {
      const zu = (satz: string): string => `Baulauf „${b.name}": ${satz}`;
      // ── Grundlage 1: die Quellkarte, aus der (c3) die ausgelieferten Bytes zuordnet ────────────
      expect(b.inhaltBytesJs, zu("kein einziges Byte einer Quelle zugeordnet")).toBeGreaterThan(0);
      expect(
        b.ohneKarte,
        zu(
          "so viele .js-Stücke haben keine Quellkarte — ohne sie ist die Byte-Herkunft nicht zu " +
            'haben. Steht `sourcemap: "hidden"` noch im Bauaufruf?',
        ),
      ).toBe(0);
      expect(
        b.zeilenAbweichung,
        zu(
          "bei so vielen .js-Stücken passt die Zahl der Kartenzeilen nicht zur Zahl der Codezeilen " +
            "— dann liest der VLQ-Leser die Karte falsch, und jede Byte-Zuordnung wäre verschoben.",
        ),
      ).toBe(0);
      expect(
        b.fremdeQuellen,
        zu(
          "diese Karten-Quellen stehen in keinem `moduleIds` ihres Stücks. Entweder ist der " +
            "Quellenindex falsch gelesen, oder `sourcemapPathTransform` löst nicht mehr absolut auf.",
        ),
      ).toEqual([]);
      // ── Die erzeugte Ausfuhrliste, gegen ROLLUPS EIGENE ANGABE geprüft (ben, R2, KP 1) ────────
      // Das ist der unabhängige Maßstab: die Liste, die dieser Test am Stückende erkennt, muss
      // genau so viele Einträge führen, wie rollup für dieses Stück Ausfuhren meldet. Erkennt er
      // sie nicht (oder die falsche Stelle), stimmt die Zahl nicht — und die Bytes der Liste
      // landeten wieder beim zuletzt zugeordneten Modul, so wie in Runde 2.
      expect(
        b.ausfuhrFehlschlaege,
        zu(
          "bei diesen Stücken passt die erkannte Ausfuhrliste nicht zu `chunk.exports`. Dann ist " +
            "nicht belegt, dass die erzeugte Liste als Rahmen gezählt wird.",
        ),
      ).toEqual([]);
      expect(
        b.ausfuhrBytesJs,
        zu("keine einzige erzeugte Ausfuhrliste erkannt — das kann bei ESM-Stücken nicht sein"),
      ).toBeGreaterThan(0);
      // Die Identität ist der eigentliche Beweis, dass nichts verlorengeht oder doppelt zählt:
      // JEDES ausgelieferte Byte ist entweder einer Quelle zugeordnet oder Rahmen.
      expect(
        b.inhaltBytesJs + b.rahmenBytesJs,
        zu("Inhalt + Rahmen muss AUF DAS BYTE die ausgelieferte Summe ergeben"),
      ).toBe(b.summeJs);
      // ── Grundlage 2: `renderedLength`, aus der (c3r) die Rohzeichen zerlegt ────────────────────
      expect(b.inhaltJs, zu("keine einzige `renderedLength` geliefert")).toBeGreaterThan(0);
      expect(
        b.ohneLaengenangabe,
        zu(
          "für so viele Module hat rollup KEINE `renderedLength` geliefert (ben, R1, Prüflücke 6). " +
            "Eine fehlende Angabe darf nicht als 0 in die Summe eingehen — sie macht diesen Fall rot.",
        ),
      ).toBe(0);
      expect(
        b.ohneRohlaenge,
        zu(
          "so viele .js-Stücke haben keine Rohlänge — der `renderChunk`-Haken von `rohLaenge()` " +
            "hat sie nicht gesehen (Zuordnung über `preliminaryFileName` gebrochen?).",
        ),
      ).toBe(0);
      expect(
        b.ohneModulangabe,
        zu(
          "so viele .js-Stücke führen weniger Modulangaben als `moduleIds` — " +
            "`RenderedChunk.modules` ist unvollständig, jede Inhalt/Rahmen-Zahl wäre zu klein.",
        ),
      ).toBe(0);
      expect(
        b.inhaltJs,
        zu(
          `Inhalt ${b.inhaltJs} Z über Rohlänge ${b.rohJs} Z — zwei Einheiten in einer Subtraktion. \`renderedLength\` ist VOR der Minimierung erhoben; die Rohlänge muss es auch sein, sonst wird der Rahmen negativ.`,
        ),
      ).toBeLessThanOrEqual(b.rohJs);
      expect(b.rahmenJs, zu("Rahmen = Rohlänge − Inhalt, exakt")).toBe(b.rohJs - b.inhaltJs);
    }
  });

  // ── (v) DER GEGENBAU IST WIRKLICH DER VORZUSTAND (ben, R7, Korrekturpflicht 2) ─────────────────
  // Jede Vorher/Nachher-Aussage unten steht und fällt mit diesem Fall. Er belegt dreierlei:
  //   1. Das Plugin hat gegriffen (Ersetzungen > 20, kein `import("./pages/` blieb übrig). Ein
  //      Muster, das ins Leere greift, würde sonst zweimal denselben Bau erzeugen und alles grün
  //      machen, ohne etwas zu vergleichen.
  //   2. Im Gegenbau liegt JEDE erhobene Seite im EINTRITT — das ist die Definition des Zustands
  //      vor JOB 3030, das Spiegelbild von Fall (a).
  //   3. Der Gegenbau lässt die schon vorher getrennten Stücke getrennt: er hat MEHR als ein Stück.
  //      Genau das war der Fehler von Runde 7 (`inlineDynamicImports` schmolz auch sie ein).
  it("(v) der Gegenbau dreht NUR JOB 3030 zurück und lässt fremde Nachladewege getrennt", () => {
    const v = VORHER as Bau;
    expect(GEGENBAU.gelaufen, "das Gegenbau-Plugin hat `routes.tsx` nie gesehen").toBe(true);
    expect(
      GEGENBAU.ersetzungen,
      'zu wenige `lazy(() => import("./pages/…"))` ersetzt — das Muster passt nicht mehr auf ' +
        "`routes.tsx`, und der Gegenbau wäre kein Vorzustand, sondern eine Kopie des Nachher-Baus.",
    ).toBeGreaterThan(20);
    expect(GEGENBAU.restImporte, "im Gegenbau blieb ein Seiten-`import()` stehen").toBe(0);
    const nichtImEintritt = SOLL_SEITEN.filter(
      (seite) => !(v.eintritt?.moduleIds ?? []).includes(seite),
    ).map(kurz);
    expect(
      nichtImEintritt,
      "Im Gegenbau muss JEDE Seite im Eintritt liegen — das ist der Zustand vor JOB 3030.",
    ).toEqual([]);
    expect(
      v.jsStuecke.length,
      "Der Gegenbau darf NUR die Seiten zurückstellen. Bleibt nur ein Stück übrig, hat er auch die " +
        "schon vorher getrennten Nachladewege eingeschmolzen und vergleicht gegen ein Bündel, das " +
        "es nie gab (ben, R7).",
    ).toBeGreaterThan(1);
    expect(v.jsStuecke.length, "der Gegenbau muss deutlich weniger Stücke haben").toBeLessThan(
      (GETEILT as Bau).jsStuecke.length,
    );
  });

  it("(a) der Eintritt trägt keine einzige Seite", () => {
    const seiten = ((GETEILT as Bau).eintritt?.moduleIds ?? []).filter((id) =>
      id.includes("/apps/web/src/pages/"),
    );
    expect(
      seiten.map((id) => kurz(id)),
      "Diese Seitenmodule liegen im Eintritts-Stück und werden damit vor der ersten sichtbaren " +
        "Seite geladen. Sie gehören über `lazy(() => import(…))` nachgeladen.",
    ).toEqual([]);
  });

  it("(b) jedes erhobene Seitenmodul liegt in genau einem Stück, und das ist nicht der Eintritt", () => {
    const g = GETEILT as Bau;
    const befunde = SOLL_SEITEN.map((seite) => {
      const traeger = g.stuecke.filter((s) => s.moduleIds.includes(seite));
      if (traeger.length !== 1) {
        return `${kurz(seite)} → in ${traeger.length} Stücken (${traeger
          .map((t) => t.fileName)
          .join(", ")})`;
      }
      const eines = traeger[0] as Stueck;
      return eines.isEntry ? `${kurz(seite)} → liegt im Eintritt ${eines.fileName}` : null;
    }).filter((z): z is string => z !== null);
    expect(
      befunde,
      "Die Sollmenge kommt aus `apps/web/src/pages/`, nicht aus einer Liste in diesem Test — eine " +
        "neue Seite, die jemand statisch einbindet, fällt hier automatisch auf.",
    ).toEqual([]);
  });

  // ── (c1) DER KERN VON „ES WÄCHST NICHTS", driftfrei geprüft ────────────────────────────────────
  // Der Auftrag will mit Fall (c) verhindern, dass die Aufteilung Code VERVIELFACHT. Genau das
  // lässt sich ohne jede Byte-Zahl und ohne jede Toleranz prüfen: KEIN Modul darf in mehr als einem
  // Stück liegen. Dieser Fall veraltet nicht und wandert nicht — er ist das eigentliche Versprechen.
  it("(c1) kein einziges Modul liegt doppelt — die Aufteilung vervielfältigt nichts", () => {
    const zaehler = new Map<string, string[]>();
    for (const s of (GETEILT as Bau).stuecke) {
      for (const m of s.moduleIds) {
        zaehler.set(m, [...(zaehler.get(m) ?? []), s.fileName]);
      }
    }
    const doppelt = [...zaehler.entries()]
      .filter(([, stuecke]) => stuecke.length > 1)
      .map(([m, stuecke]) => `${kurz(m)} → ${stuecke.join(", ")}`)
      .sort();
    expect(
      doppelt,
      "Diese Module liegen in mehreren Stücken. Dann trägt die Aufteilung denselben Code mehrfach " +
        "aus, und die Summe wächst um echten Inhalt statt um Rahmen.",
    ).toEqual([]);
  });

  // ── (c2) DER ZUWACHS JE ZUSÄTZLICHEM STÜCK — die gröbere ZWEITSICHT ────────────────────────────
  // GEMESSEN AM 05.09.2026 (Arbeitsstand `e8116ba`), derselbe Quellstand, zwei Bauläufe:
  //     VORHER  (Seiten statisch):   6 Stücke · 3 025 986 B
  //     NACHHER (aufgeteilt):      102 Stücke · 3 063 530 B
  //     Zuwachs 37 544 B (+1,24 %) auf 96 zusätzliche Stücke = 391,1 B je Stück.
  //
  // WAS DIESER FALL MISST UND WAS NICHT (ben, R11, Prüfpunkt 2 — und der ist berechtigt): er teilt
  // den Zuwachs durch die Zahl zusätzlicher Stücke. Das ist ein MITTELWERT. Er bliebe grün, wenn
  // der ganze Zuwachs echter, vervielfältigter Inhalt wäre, gleichmäßig auf 96 Stücke verteilt.
  // Dieser Fall BEHAUPTET deshalb nicht mehr, der Zuwachs sei Verpackung — das prüft (c3), und nur
  // (c3), an den ausgelieferten Bytes je Modul. Was (c2) daneben leistet, ist etwas anderes und
  // trotzdem nützlich: er merkt, wenn der SCHNITT zu fein wird. Zerfiele das Bündel morgen in 400
  // Stücke, wäre jedes einzelne Stück fast nur noch Rahmen — (c3) bliebe grün (kein Inhalt wächst),
  // (c4) vielleicht auch (die Summe wächst prozentual langsam), und genau diese Klasse fängt hier
  // die Zahl je Stück ab. Vier Sichten auf denselben Zuwachs, aus DENSELBEN zwei Bauten:
  //     (c2) je zusätzlichem Stück · (c3) Inhalt gegen Rahmen in ausgelieferten Bytes ·
  //     (c3r) dasselbe vor der Minimierung, aus anderer Quelle · (c4) Anteil an der Gesamtsumme.
  //
  // Die Schranke steht auf 700 B je zusätzlichem Stück, rund dem Doppelten des gemessenen Werts
  // (391 B) — Luft für die Schwankung der Verpackung zwischen zwei rollup-Ständen, zu wenig für
  // mitgewanderten Inhalt.
  const RAHMEN_JE_STUECK = 700;

  it("(c2) der Zuwachs je zusätzlichem Stück bleibt in der Größe eines Verpackungsrahmens", () => {
    const g = GETEILT as Bau;
    const v = VORHER as Bau;
    const zuwachs = g.summeJs - v.summeJs;
    const zusaetzlich = g.jsStuecke.length - v.jsStuecke.length;
    expect(
      zusaetzlich,
      "der aufgeteilte Bau muss mehr Stücke haben als der Gegenbau",
    ).toBeGreaterThan(0);
    const jeStueck = zuwachs / zusaetzlich;
    const messung = `${g.summeJs} B aufgeteilt (${g.jsStuecke.length} Stücke) gegen ${v.summeJs} B im Vorzustand (${v.jsStuecke.length}) → ${zuwachs} B auf ${zusaetzlich} zusätzliche Stücke = ${jeStueck.toFixed(1)} B je Stück.`;
    console.log(`[JOB 3030] (c2) ${messung}`);
    expect(
      jeStueck,
      `${messung} Über der Schranke bedeutet: je Stück wird mehr ausgetragen, als eine Verpackung groß ist — der Schnitt ist zu fein geworden, oder es wandert Inhalt mit (das entscheidet (c3), nicht dieser Fall).`,
    ).toBeLessThan(RAHMEN_JE_STUECK);
  });

  // ── (c3) DIE HERKUNFT DER AUSGELIEFERTEN BYTES — der Rest aus JOB 3030 (JOB 3077 R2) ───────────
  // DIE FRAGE, die (c1) und (c2) offenließen: der Zuwachs von 37 544 B — ist er Rahmen oder Inhalt?
  // (c1) schließt nur die grobe Form aus (kein Modul in zwei Stücken). Die feine bleibt möglich:
  // dieselbe Modulmenge kann in 102 Stücken MEHR Code ausgeben als in 6, weil rollup Exporte über
  // eine Stückgrenze hinweg nicht mehr wegoptimieren kann. Genau diese Klasse misst dieser Fall.
  //
  // WARUM DIESER FALL IN BYTES RECHNET UND NICHT IN ZEICHEN (ben, R1, Korrekturpflicht 1). Runde 1
  // zerlegte 66 252 ROHZEICHEN vor der Minimierung und ließ die 37 544 ausgelieferten Bytes
  // daneben stehen. Das war ein TEILBELEG: gleiche Rohlängen beweisen keine gleichen minimierten
  // Bytes, denn zwischen beiden liegt esbuild. Seit R2 wird die Herkunft deshalb AM AUSGELIEFERTEN
  // STÜCK erhoben, aus der Quellkarte (`byteHerkunft()` weiter oben) — in derselben Einheit wie
  // `summeJs`. Wie berechtigt der Einwand war, zeigt das Ergebnis: in Rohzeichen WÄCHST der
  // Modulinhalt um 2 253 Z, in ausgelieferten Bytes SCHRUMPFT er um 1 712 B. Die beiden Sichten
  // zeigen nicht dieselbe Zahl in anderer Einheit, sie zeigen ein anderes Vorzeichen.
  //
  // UND WARUM DIE ZAHLEN AUS RUNDE 2 TROTZDEM NOCH FALSCH WAREN (ben, R2, Korrekturpflicht 1):
  // die erzeugte Ausfuhrliste `export{…};` am Stückende trägt kein Kartensegment. Runde 2 ließ das
  // letzte Segment einer Zeile bis zum Zeilenende laufen und schrieb die Liste damit dem zuletzt
  // zugeordneten Modul zu — `main.tsx` bekam so 1 731 B, `externalAttachGate.ts` 692 B reinen
  // Rahmen als „Inhalt". Beide standen dadurch als wachsende Module in dieser Datei; nach der
  // Korrektur stehen sie GAR NICHT MEHR in der Liste. Die Summenidentität hatte das nicht gemerkt,
  // weil sie immer aufgeht (siehe Kopf); erkannt wird es jetzt vom Zuordner-Kalibrierungsblock
  // (Z1–Z5) und vom Abgleich gegen `chunk.exports` in (h).
  //
  // GEMESSEN AM 05.09.2026 (`e8116ba`), in ausgelieferten UTF-8-Bytes:
  //     VORHER  3 025 986 B = Inhalt 3 018 338 + Rahmen  7 648
  //     NACHHER 3 063 530 B = Inhalt 3 016 626 + Rahmen 46 904
  //     Zuwachs +37 544 B = RAHMEN +39 256 B (104,6 %) + INHALT −1 712 B (−4,6 %).
  //     Davon erzeugte Ausfuhrlisten: 1 844 B → 7 671 B.
  //
  // DER BELEG JE MODUL. 854 Module tragen überhaupt ausgelieferte Bytes (gegen 958 mit einer
  // `renderedLength` in (c3r) — die Lücke sind Module, von denen die Minimierung nichts übrig
  // lässt). 31 davon wachsen (zusammen +3 167 B), 254 schrumpfen (zusammen −4 879 B), netto
  // −1 712 B. Beide Summen werden getrennt gedruckt (ben, R2, Prüflücke 6), damit der Nettowert
  // nicht verdeckt, wie viele Module sich bewegen. Nennenswert wächst GENAU EINES:
  //     +3 037 B  apps/web/src/routes.tsx                  2 325 → 5 362
  // Der zweitgrößte Zuwachs im ganzen Baum beträgt 32 B (`components/erfassen/Blatt.tsx`), danach
  // geht es sofort auf einstellige Werte. Die Gegenseite schrumpft deutlich; die fünf stärksten:
  //     −543 B  apps/web/src/pages/Capture.tsx             77 590 → 77 047
  //     −322 B  apps/web/src/components/RichTextEditor.tsx 29 908 → 29 586
  //     −311 B  apps/web/src/pages/Admin.tsx               38 537 → 38 226
  //     −227 B  apps/web/src/pages/Validation.tsx          20 530 → 20 303
  //     −223 B  node_modules/react-dom/…/react-dom.production.min.js 129 819 → 129 596
  // Am 05.09.2026 wächst KEIN Modul aus `pages/`. Dieser Satz steht nicht als ewige Wahrheit hier:
  // der Fall erhebt die Liste der wachsenden Seitenmodule in jedem Lauf neu und druckt sie.
  //
  // WARUM `routes.tsx` WÄCHST, und warum das kein vervielfältigter Seitencode ist: dort stehen im
  // aufgeteilten Bau 27 Ausdrücke `lazy(() => import(…))` als LAUFZEITCODE samt der Vorlade-Helfer,
  // die Vite daran hängt; im Gegenbau steht dort `Promise.resolve({ default: … })`, und die
  // zugehörigen `import`-Zeilen verschwinden beim Bündeln, weil das Ziel im selben Stück liegt.
  // Dass die übrigen schrumpfen, hat einen eigenen Grund: in 102 kleinen Stücken muss rollup
  // weniger Namen entkollidieren (`Foo$1`, `Foo$2`) als in 6 großen — und das spart mehr, als der
  // Schnitt kostet.
  //
  // DAS BUDGET IST NULL, und das ist die Aussage. Der Auftrag verlangt: „Ist der Fall grün, bleibt
  // `INHALT_BUDGET` bei 0. Dann ist 3(c) im Inhalt sogar wörtlich erfüllt, und der Kommentar sagt
  // genau das." Er ist grün: der ausgelieferte Modulinhalt wächst durch die Aufteilung NICHT,
  // sondern schrumpft um 1 712 B. Es gibt hier also keine Toleranz zu begründen — dieser Fall
  // verlangt schlicht, dass die Aufteilung keinen Modulcode hinzufügt.
  // WAS DER SPIELRAUM IST, gemessen statt geschätzt: der Abstand zur Schranke sind eben jene
  // 1 712 B, und jede weitere nachgeladene Seite kostet in `routes.tsx` rund 100 ausgelieferte
  // Bytes. Mit 15 zusätzlichen `lazy`-Seiten steht der Wert bei −212 B (noch grün), mit 20 bei
  // +509 B (rot) — beides am 05.09.2026 gebaut und gemessen, siehe Rückgabe. Der Spielraum trägt
  // also rund 17 weitere Seiten. WIRD DIESER FALL ROT, ist die erste Frage nicht „Schranke heben?",
  // sondern die gedruckte Liste: wächst dort nur `routes.tsx`, ist es der Preis des Schnitts und
  // eine bewusste Entscheidung fällig; wächst ein anderes Modul, ist der Schnitt kaputt.
  const INHALT_BUDGET_BYTES = 0;

  it("(c3) der ausgelieferte Zuwachs ist Rahmen, nicht Inhalt — je Modul in Bytes nachgewiesen", () => {
    const g = GETEILT as Bau;
    const v = VORHER as Bau;
    const inhaltZuwachs = g.inhaltBytesJs - v.inhaltBytesJs;
    const rahmenZuwachs = g.rahmenBytesJs - v.rahmenBytesJs;
    const summeZuwachs = g.summeJs - v.summeJs;
    const anteil = (x: number): string =>
      summeZuwachs === 0 ? "—" : `${((x / summeZuwachs) * 100).toFixed(1)} %`;
    const zuwaechse = modulZuwaechse(g.inhaltBytesJeModul, v.inhaltBytesJeModul);
    const gewachsen = zuwaechse.filter((z) => z.zuwachs > 0);
    const plus = gewachsen.reduce((s, z) => s + z.zuwachs, 0);
    const minus = zuwaechse.filter((z) => z.zuwachs < 0).reduce((s, z) => s + z.zuwachs, 0);
    const gewachsenSeiten = gewachsen
      .filter((z) => z.id.includes("/apps/web/src/pages/"))
      .map((z) => `${kurz(z.id)} +${z.zuwachs} B`);

    // Die Aufschlüsselung gehört in JEDEN Lauf, nicht nur in die Fehlermeldung: eine Zahl, die nur
    // bei Rot erscheint, ist im grünen Lauf keine Messung. Genau das war Bens Einwand zu (c2).
    const messung = [
      "[JOB 3077] (c3) Herkunft des AUSGELIEFERTEN Zuwachses, in UTF-8-Bytes:",
      `  VORHER  ${v.summeJs} B = Inhalt ${v.inhaltBytesJs} + Rahmen ${v.rahmenBytesJs}`,
      `  NACHHER ${g.summeJs} B = Inhalt ${g.inhaltBytesJs} + Rahmen ${g.rahmenBytesJs}`,
      `  Zuwachs ${summeZuwachs} B = INHALT ${inhaltZuwachs} B (${anteil(inhaltZuwachs)}) + RAHMEN ${rahmenZuwachs} B (${anteil(rahmenZuwachs)}) · Budget für Inhalt ${INHALT_BUDGET_BYTES} B`,
      `  davon erzeugte Ausfuhrlisten (Rahmen): ${v.ausfuhrBytesJs} B → ${g.ausfuhrBytesJs} B`,
      // Getrennt ausgewiesen (ben, R2, Prüflücke 6): eine Nettozahl verdeckt sonst, wie viele
      // Module überhaupt wachsen — der Netto-Zuwachs ist die DIFFERENZ zweier viel größerer Summen.
      `  ${gewachsen.length} von ${g.inhaltBytesJeModul.size} Modulen wachsen (zusammen +${plus} B), ${zuwaechse.length - gewachsen.length} schrumpfen (zusammen ${minus} B) → netto ${inhaltZuwachs} B`,
      // Die Aussage „kein Seitenmodul wächst" steht in beiden Kommentaren — also wird sie in JEDEM
      // Lauf neu erhoben und gedruckt, statt als ewige Wahrheit dazustehen (ben, R2, KP 2).
      `  wachsende Seitenmodule (aus apps/web/src/pages/): ${gewachsenSeiten.length === 0 ? "keines" : gewachsenSeiten.join(", ")}`,
      "  Die zehn größten Zuwächse:",
      ...zuwaechse.slice(0, 10).map((z) => `    ${zuwachsZeile("B")(z)}`),
      "  Die fünf größten Rückgänge:",
      ...zuwaechse
        .slice(-5)
        .reverse()
        .map((z) => `    ${zuwachsZeile("B")(z)}`),
    ].join("\n");
    console.log(messung);

    expect(summeZuwachs, "beide Bauten sind gleich groß — wird überhaupt aufgeteilt?").not.toBe(0);
    expect(
      inhaltZuwachs,
      `${messung}\n\n${
        "Über dem Budget bedeutet: die Aufteilung liefert MEHR Modulcode aus als der Vorzustand. " +
        "Das ist die feine Vervielfältigung, die (c1) nicht sieht — rollup kann einen Export über " +
        "eine Stückgrenze hinweg nicht mehr wegoptimieren. ERST DIE LISTE OBEN LESEN, dann " +
        "entscheiden: wächst dort nur `routes.tsx`, ist es der Preis des Schnitts selbst (rund " +
        "100 B je nachgeladener Seite) und eine bewusste Entscheidung fällig. Wächst ein anderes " +
        "Modul — besonders eines aus `pages/` —, ist der Schnitt zu prüfen und nicht die Schranke " +
        "zu heben."
      }`,
    ).toBeLessThanOrEqual(INHALT_BUDGET_BYTES);
  });

  // ── (c3r) DIESELBE FRAGE VOR DER MINIMIERUNG — eine unabhängige Zweitmessung ───────────────────
  // Zwei Wege zur selben Aussage, aus zwei GETRENNTEN Datenquellen: (c3) liest die Quellkarte des
  // fertigen Stücks, dieser Fall liest rollups eigene Buchführung `renderedLength` VOR der
  // Minimierung. Sie können nicht gemeinsam aus demselben Fehler grün werden.
  // GEMESSEN AM 05.09.2026 (`e8116ba`), in Zeichen des gerenderten, noch nicht minimierten Codes:
  //     VORHER  roh 5 117 996 = Inhalt 5 106 361 + Rahmen 11 635
  //     NACHHER roh 5 184 248 = Inhalt 5 108 614 + Rahmen 75 634
  //     Zuwachs roh +66 252 Z = INHALT +2 253 Z (3,4 %) + RAHMEN +63 999 Z (96,6 %).
  // Hier wächst GENAU EIN Modul von 958: `routes.tsx` um 2 640 Z (5 240 → 7 880); die übrigen 56
  // veränderten schrumpfen zusammen um 387 Z. 2 640 − 387 = 2 253.
  // DER VERGLEICH DER BEIDEN SICHTEN IST SELBST EIN BEFUND, und zwar ein Vorzeichenwechsel: vor der
  // Minimierung WÄCHST der Modulinhalt um 2 253 Z, danach SCHRUMPFT er um 1 712 B. Der Grund ist
  // dieselbe Namensentkollision, die (c3) an der Gegenseite sieht: rollup rendert in 102 Stücken
  // mehr Zeichen, esbuild macht daraus weniger Bytes, weil die Namen kürzer bleiben. Genau deshalb
  // ist (c3) und nicht dieser Fall der bindende: er misst, was ausgeliefert wird.
  // `INHALT_BUDGET_ROH` steht auf 6 000 Z gegen gemessene 2 253 — 0,12 % der 5 108 614 Z Modulcode,
  // Luft für rund 30 weitere Seiten (je rund 98 Z in `routes.tsx`), zu wenig für den Rumpf einer
  // Seite (die kleinste in der Liste, `DuplicateCompare.tsx`, steht bei 12 626 Z).
  const INHALT_BUDGET_ROH = 6_000;

  it("(c3r) ZWEITMESSUNG vor der Minimierung: auch der Rohcode wächst nur um den Schnitt", () => {
    const g = GETEILT as Bau;
    const v = VORHER as Bau;
    const inhaltZuwachs = g.inhaltJs - v.inhaltJs;
    const rahmenZuwachs = g.rahmenJs - v.rahmenJs;
    const rohZuwachs = g.rohJs - v.rohJs;
    const anteil = (x: number): string =>
      rohZuwachs === 0 ? "—" : `${((x / rohZuwachs) * 100).toFixed(1)} %`;
    const zuwaechse = modulZuwaechse(g.inhaltJeModul, v.inhaltJeModul);
    const gewachsen = zuwaechse.filter((z) => z.zuwachs > 0);

    const messung = [
      "[JOB 3077] (c3r) Zweitmessung, in Zeichen VOR der Minimierung:",
      `  VORHER  roh ${v.rohJs} = Inhalt ${v.inhaltJs} + Rahmen ${v.rahmenJs}`,
      `  NACHHER roh ${g.rohJs} = Inhalt ${g.inhaltJs} + Rahmen ${g.rahmenJs}`,
      `  Zuwachs roh ${rohZuwachs} Z = INHALT ${inhaltZuwachs} Z (${anteil(inhaltZuwachs)}) + RAHMEN ${rahmenZuwachs} Z (${anteil(rahmenZuwachs)}) · Budget für Inhalt ${INHALT_BUDGET_ROH} Z`,
      `  Module mit Zuwachs: ${gewachsen.length} von ${g.inhaltJeModul.size} · mit Rückgang: ${zuwaechse.length - gewachsen.length}. Die fünf größten Zuwächse:`,
      ...zuwaechse.slice(0, 5).map((z) => `    ${zuwachsZeile("Z")(z)}`),
    ].join("\n");
    console.log(messung);

    expect(rohZuwachs, "beide Bauten sind gleich lang — wird überhaupt aufgeteilt?").not.toBe(0);
    expect(
      inhaltZuwachs,
      `${messung}\n\n${
        "Über dem Budget bedeutet: rollup rendert MEHR Modulcode als im Vorzustand. Weicht dieser " +
        "Fall von (c3) ab, ist zuerst zu klären, welche der beiden Messungen sich geändert hat — " +
        "sie lesen getrennte Quellen (Quellkarte gegen `renderedLength`)."
      }`,
    ).toBeLessThanOrEqual(INHALT_BUDGET_ROH);
  });

  // ── (c4) DAS ANGENOMMENE BUDGET, ABSOLUT GEFÜHRT (JOB 3077) ───────────────────────────────────
  // (c2) führt den Zuwachs je Stück und merkt deshalb nicht, wenn die Summe insgesamt davonläuft,
  // solange nur genug Stücke dazukommen (ben, R11, Prüfpunkt 2: „c1/c2 messen Modulzuordnung und
  // Durchschnittsbudget"). Dieser Fall führt ihn als ANTEIL an der Gesamtsumme — das ist die Zahl,
  // die in der Entscheidung zu 3(c) steht, und damit die, die eingehalten werden muss.
  // GEMESSEN AM 05.09.2026 (`e8116ba`): (3 063 530 − 3 025 986) / 3 025 986 = +1,24 %
  // (am 04.09., Stand `b203c44`, waren es +1,17 % — der Wert schwankt mit der Zahl der Seiten).
  // DIE SCHRANKE STEHT AUF 2,5 %, dem Doppelten des gemessenen Werts. Sie ist ein ANTEIL und keine
  // Byte-Zahl: eine Byte-Zahl war genau der Pin, der in Runde 4 von selbst rot wurde (siehe Kopf).
  // Beide Summen stammen aus demselben Lauf, der Quotient driftet also nicht mit dem Produkt.
  // Die Luft trägt rund eine VERDOPPELUNG der Stückzahl bei heutigem Rahmen je Stück; sie trägt
  // NICHT das Mitwandern eines der großen Seitenstücke (`Capture` allein liegt bei 142 428 B, also
  // 4,7 % der Summe — eine einzige doppelt ausgetragene Seite dieser Größe wäre sofort rot).
  const BUDGET_ANTEIL = 0.025;

  it("(c4) das angenommene Verpackungsbudget wird eingehalten — als Anteil an der Gesamtsumme", () => {
    const g = GETEILT as Bau;
    const v = VORHER as Bau;
    expect(v.summeJs, "keine Vorher-Summe gemessen").toBeGreaterThan(0);
    const anteil = (g.summeJs - v.summeJs) / v.summeJs;
    const messung = `Summe ${v.summeJs} B → ${g.summeJs} B = ${(anteil * 100).toFixed(2)} % Zuwachs (Schranke ${BUDGET_ANTEIL * 100} %), Gegenwert: Eintritt ${v.eintritt?.bytes ?? 0} B → ${g.eintritt?.bytes ?? 0} B.`;
    console.log(`[JOB 3077] (c4) ${messung}`);
    expect(
      anteil,
      `${messung} ${
        "Über der Schranke ist das Budget verbraucht, das die Steuerung am 05.09.2026 angenommen " +
        "hat (Entscheidung 13, `UEBERGABE.md`; Zeile U4b in `PRIORITAETEN.md`). Dann ist die " +
        "Annahme neu zu treffen, nicht die Schranke zu heben."
      }`,
    ).toBeLessThan(BUDGET_ANTEIL);
  });

  // ── (d) DER EINTRITT IST KLEINER GEWORDEN — gegen den gemessenen Vorzustand ────────────────────
  // Lieferpunkt 3(d) wörtlich: „Die Byte-Größe des Eintritts-Stücks liegt unter einem im Test
  // benannten Grenzwert; der Grenzwert wird aus der gemessenen Vorher-Größe abgeleitet."
  // GEMESSEN AM 05.09.2026 (`e8116ba`): Eintritt vorher 2 069 266 B → nachher 1 285 166 B,
  // also 62,1 % der Vorher-Größe (−784 100 B, −37,89 %).
  // DIE SCHRANKE STEHT AUF 75 % und ist bewusst ein ANTEIL, keine Byte-Zahl: eine Byte-Zahl war
  // genau der Pin, der in Runde 4 von selbst rot wurde, weil das Produkt daneben wuchs. Beide
  // Zahlen stammen aus DEMSELBEN Lauf, also driftet der Quotient nicht.
  const EINTRITT_ANTEIL = 0.75;

  it("(d) der Eintritt ist gegenüber dem Vorzustand deutlich kleiner", () => {
    const g = GETEILT as Bau;
    const v = VORHER as Bau;
    const vorher = v.eintritt?.bytes ?? 0;
    const nachher = g.eintritt?.bytes ?? 0;
    const grenze = vorher * EINTRITT_ANTEIL;
    const messung = `Eintritt vorher ${vorher} B → nachher ${nachher} B (${((nachher / vorher) * 100).toFixed(1)} %, Schranke ${EINTRITT_ANTEIL * 100} % = ${Math.round(grenze)} B).`;
    console.log(`[JOB 3030] (d) ${messung}`);
    expect(vorher, "kein Vorher-Eintritt gemessen").toBeGreaterThan(0);
    expect(nachher, messung).toBeLessThan(grenze);
  });

  // ── (d2) DIE ERSTLAST JE SEITE — was der Browser wirklich holt, bevor die Seite steht ──────────
  // Das ist die Zahl, um die es Natascha geht, und sie ist NICHT die Größe des Eintritts allein:
  // der Browser muss die STATISCHE Hülle des Eintritts mitladen (Fremdbibliotheken, Rahmen), und
  // für eine sichtbare Seite dazu noch das Stück dieser Seite samt deren statischer Hülle.
  // Verglichen wird JEDE Seite mit SICH SELBST im Vorzustand — dort ist ihre Erstlast die ganze
  // Eintritts-Hülle, weil sie im Eintritt liegt.
  // GEMESSEN AM 05.09.2026 (`e8116ba`), Vorher-Erstlast je Seite 2 069 266 B:
  //     Startseite (`/start`, die erste Fläche nach dem Anmelden):  1 328 532 B ≈ 64,2 %
  //     leichteste Seite (PlaceholderPage):                         1 286 063 B ≈ 62,2 %
  //     schwerste Seite (KnowledgeIntake):                          1 588 584 B ≈ 76,8 %
  // DIE SCHRANKE STEHT AUF 85 %: sie soll die Zusage halten („jede Seite lädt spürbar weniger als
  // vorher"), nicht den Tagesstand einfrieren. Die schwerste Seite liegt heute bei 90 % der
  // Schranke — Luft für gewöhnliches Wachstum, zu wenig für eine Seite, die zurück in den Eintritt
  // wandert.
  const ERSTLAST_ANTEIL = 0.85;

  it("(d2) für JEDE Seite ist die Erstlast kleiner als im Vorzustand", () => {
    const g = GETEILT as Bau;
    const v = VORHER as Bau;
    const nachher = erstlast(g);
    const vorher = erstlast(v);
    const zeilen = SOLL_SEITEN.map((seite) => {
      const n = nachher.get(seite) ?? -1;
      const alt = vorher.get(seite) ?? -1;
      return { seite: kurz(seite), n, alt, anteil: alt > 0 ? n / alt : -1 };
    }).sort((a, b) => b.anteil - a.anteil);
    const zuLaut = zeilen
      .filter((z) => z.n < 0 || z.alt <= 0 || z.anteil >= ERSTLAST_ANTEIL)
      .map((z) =>
        z.n < 0 || z.alt <= 0
          ? `${z.seite} → in keinem Stück gefunden (vorher ${z.alt} B, nachher ${z.n} B)`
          : `${z.seite} → ${z.n} B von vorher ${z.alt} B = ${(z.anteil * 100).toFixed(1)} %`,
      );
    // Die Erstlast gehört ins Protokoll, nicht nur in die Fehlermeldung: Lieferpunkt 5 verlangt
    // gemessene Zahlen, und eine Zahl, die nur bei Rot erscheint, ist im grünen Lauf keine Messung.
    const zeile = (z: (typeof zeilen)[number]): string =>
      `${z.seite}\t${z.n} B von ${z.alt} B = ${(z.anteil * 100).toFixed(1)} %`;
    const start = zeilen.find((z) => z.seite === "apps/web/src/pages/Start.tsx");
    console.log(
      `[JOB 3030] Erstlast je Seite, nachher gegen vorher (Schranke ${ERSTLAST_ANTEIL * 100} %) — schwerste fünf:\n  ${zeilen
        .slice(0, 5)
        .map(zeile)
        .join(
          "\n  ",
        )}\n  leichteste: ${zeile(zeilen[zeilen.length - 1] as (typeof zeilen)[number])}\n  Startseite (die erste Fläche nach dem Anmelden): ${start ? zeile(start) : "nicht gefunden"}`,
    );
    expect(
      zuLaut,
      `Erstlast = Eintritts-Hülle + Seiten-Hülle, je Seite gegen dieselbe Seite im Vorzustand (Schranke ${ERSTLAST_ANTEIL * 100} %).`,
    ).toEqual([]);
  });

  // ── (d3) KALIBRIERUNG DES RECHENWEGS VON (d2) ─────────────────────────────────────────────────
  // (d2) teilt zwei Zahlen; ist der NENNER falsch, ist der ganze Quotient wertlos. Dieser Fall
  // prüft genau den Nenner: im Gegenbau muss die Erstlast JEDER Seite exakt die Eintritts-Hülle
  // sein — kein Byte weniger. Wäre sie kleiner, hätte `erstlast()` für eine im Eintritt liegende
  // Seite zu wenig gezählt, und (d2) würde einen zu kleinen Vorher-Wert benutzen und damit einen
  // zu GUTEN Anteil ausweisen. Der Fall sagt ausdrücklich NICHT, dass (d2) rot werden kann —
  // das belegt die Handmutation aus Lieferpunkt 7 (ein Seitenimport zurück auf statisch), die in
  // der Rückgabe protokolliert ist.
  it("(d3) KALIBRIERUNG: im Vorzustand ist die Erstlast jeder Seite die volle Eintritts-Hülle", () => {
    const v = VORHER as Bau;
    const eintrittHuelle = bytes(v, huelle(v, v.eintritt ? [v.eintritt.fileName] : []));
    const last = erstlast(v);
    expect(eintrittHuelle, "keine Eintritts-Hülle im Gegenbau").toBeGreaterThan(0);
    const abweichend = SOLL_SEITEN.map((seite) => ({
      seite: kurz(seite),
      wert: last.get(seite) ?? -1,
    }))
      .filter((z) => z.wert !== eintrittHuelle)
      .map((z) => `${z.seite} → ${z.wert} B statt ${eintrittHuelle} B`);
    expect(
      abweichend,
      "Im Vorzustand liegt jede Seite im Eintritt, ihre Erstlast ist also die Eintritts-Hülle. " +
        "Weicht eine ab, zählt `erstlast()` falsch — und der Nenner von (d2) taugt nicht.",
    ).toEqual([]);
    expect(last.size, "die Kalibrierung muss über alle Seiten laufen").toBe(SOLL_SEITEN.length);
  });

  // ── Lieferpunkt 4: dieser Test verschmutzt den ausgelieferten Bau nicht ────────────────────────
  it('der Bau lässt `apps/web/dist` unberührt — sonst bricht der Smoke mit „dist ist AELTER"', () => {
    // `OFFEN.md:3`: genau diese Verschmutzung hat das Tor vom 30.08. bis 02.09.2026 rot gehalten,
    // ohne dass am Produkt etwas falsch war.
    expect(DIST_NACHHER).toBe(DIST_VORHER);
    for (const ziel of ZIELE) {
      expect(ziel.startsWith(tmpdir()), "jeder Bau muss außerhalb des Arbeitsbaums landen").toBe(
        true,
      );
    }
    expect(ZIELE.length, "beide Bauläufe brauchen ein eigenes Ziel").toBe(2);
  });
});
