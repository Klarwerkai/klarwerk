// ================================================================================================
// JOB 619 / D5 — EIN TESTVERWEIS IM QUELLTEXT MUSS AUF EINE EXISTIERENDE DATEI ZEIGEN.
// ================================================================================================
//
// DER BEFUND, der diese Datei ausgelöst hat (BEN8 zu JOB 619 D4, Abschnitt „NICHT GEPRÜFT"):
// „die noch nicht umgesetzte Korrektur des veralteten Testverweises". Konkret zeigte
// `services/ask/src/answer-evidence.ts:27` auf `tests/app/mega34-answer-grade-parity.test.ts` —
// den Paritätswächter, der die serverseitige Regel und ihren Spiegel in der Oberfläche
// aneinanderhält. Die Datei existierte nicht.
//
// WARUM DAS MEHR IST ALS EIN SCHÖNHEITSFEHLER: Ein Kommentar wie „der Wächter dazu ist X" ist eine
// BEHAUPTUNG über die Prüfabdeckung. Zeigt X ins Leere, liest sich der Produktcode so, als sei
// etwas gesichert, das niemand prüft. Genau diese Klasse — „steht geschrieben, läuft aber nicht" —
// hat schon `tools/check` (ui-smoke, mega24) und `vitest.config.ts` (mega59 Block G) getroffen.
//
// WAS DIESER WÄCHTER TUT: Er erhebt jeden Verweis auf eine Test-/Spec-Datei, der in einer
// KOMMENTARZEILE steht, und prüft, ob die Datei da ist.
//
// WARUM NUR KOMMENTARZEILEN — und das ist kein Ausweichen, sondern die Trennlinie zwischen
// Behauptung und Testdatum: In Code kommen dieselben Zeichenketten als EINGABE vor, ohne je ein
// Verweis zu sein. Belegte Fundstelle in diesem Repo: `tests/app/theme-deckungsregister.test.ts`
// reicht in seinem Kalibrierungsfall (R7) einen erfundenen Testdateinamen an einen regulären
// Ausdruck — ein Prüfstring, keine Aussage über eine Datei. Ein Wächter, der ihn anmahnt, erzeugt
// Fehlalarme und wird abgeschaltet. Der Kommentarfilter schliesst diese Klasse BAULICH aus, statt
// sie in eine Ausnahmeliste zu schreiben.
//
// DER NAME JENES PRÜFSTRINGS STEHT HIER ABSICHTLICH NICHT. `theme-deckungsregister.test.ts` (R5)
// verbietet jeder Testdatei, sich per Name ODER Text als Deckung eines bestimmten, nicht
// freigegebenen Design-Ziels auszugeben — und liest dafür den ganzen Dateitext. Ihn hier zu
// zitieren, hätte genau diesen Nachbarn rot gemacht; gemessen im Gesamtgate dieses Durchgangs,
// nicht vermutet. Die Fundstelle genügt.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest läuft mit der Repo-Wurzel als Arbeitsverzeichnis (s. `vitest.config.ts`, dieselbe Annahme
// wie in `tests/app/mega34-word-einstufung.test.ts` beim Lesen des Taskpane).
const WURZEL = process.cwd();

const BEREICHE = ["tests", "tests-smoke", "services", "apps/web/src", "tools", "scripts"] as const;
const ENDUNGEN = [".ts", ".tsx", ".mts", ".mjs"] as const;

// ================================================================================================
// DER AUSDRUCK — UND DIE FALLE, DIE ER SELBST STELLT.
// ================================================================================================
//
// Die Endungs-Alternation steht ABSICHTLICH in der Reihenfolge `tsx|mts|mjs|ts`, also die längste
// zuerst. JavaScript-Alternation nimmt die ERSTE passende Variante, nicht die längste: mit
// `ts|tsx` matcht `…mounted.test.tsx` nur bis `…mounted.test.ts`, das übrige `x` bleibt liegen —
// und der Wächter meldet 53 tote Verweise, von denen 49 gar nicht tot sind.
//
// Das ist beim Bau dieser Datei tatsächlich passiert und wurde gemessen, nicht vermutet. Deshalb
// steht die Reihenfolge nicht nur hier, sondern wird unten von einem eigenen Fall gepinnt.
const VERWEIS =
  /(?:tests|tests-smoke|services|apps\/web\/src|apps\/web\/public)\/[A-Za-z0-9_./-]+\.(?:test|spec|setup)\.(?:tsx|mts|mjs|ts)/g;

const KOMMENTARZEILE = /^\s*(?:\/\/|\*|\/\*)/;

// ================================================================================================
// DER EINE AUSSCHLUSS: DIESE DATEI SELBST.
// ================================================================================================
//
// Der Wächter muss die toten Verweise BENENNEN können — in der Quarantäne-Begründung, im
// Anlass-Kommentar oben, im Kalibrierungsfall. Zählte er seine eigenen Erwähnungen mit, meldete er
// sich selbst an und wäre nie grün zu bekommen, ohne die Dokumentation zu verstümmeln.
//
// Der Ausschluss ist deshalb auf GENAU EINEN Pfad begrenzt und wird unten gepinnt: hier stehen
// Datenpunkte über tote Verweise, nirgends eine Behauptung „das prüft schon jemand".
const SELBST = "tests/structure/testverweise-aufloesbar.test.ts";

interface Verweis {
  quelle: string; // Datei, in der der Kommentar steht (repo-relativ)
  zeile: number; // 1-basiert
  ziel: string; // der genannte Pfad (repo-relativ)
}

function dateienUnter(pfad: string, raus: string[] = []): string[] {
  for (const eintrag of readdirSync(pfad)) {
    // `node_modules` ist im Clone ein Symlink in den echten Produktbaum — dort wird nicht gesucht.
    if (eintrag === "node_modules" || eintrag === "dist" || eintrag.startsWith(".")) {
      continue;
    }
    const voll = join(pfad, eintrag);
    if (statSync(voll).isDirectory()) {
      dateienUnter(voll, raus);
    } else if (ENDUNGEN.some((e) => eintrag.endsWith(e))) {
      raus.push(voll);
    }
  }
  return raus;
}

function alleVerweise(): Verweis[] {
  const treffer: Verweis[] = [];
  for (const bereich of BEREICHE) {
    const abs = resolve(WURZEL, bereich);
    if (!existsSync(abs)) {
      continue;
    }
    for (const datei of dateienUnter(abs)) {
      if (datei.slice(WURZEL.length + 1) === SELBST) {
        continue;
      }
      const zeilen = readFileSync(datei, "utf8").split("\n");
      zeilen.forEach((zeile, i) => {
        if (!KOMMENTARZEILE.test(zeile)) {
          return;
        }
        for (const m of zeile.matchAll(VERWEIS)) {
          treffer.push({
            quelle: datei.slice(WURZEL.length + 1),
            zeile: i + 1,
            ziel: m[0],
          });
        }
      });
    }
  }
  return treffer;
}

const istDa = (ziel: string): boolean => existsSync(resolve(WURZEL, ziel));

// ================================================================================================
// DIE QUARANTÄNE — DREI BENANNTE ALTLASTEN, KEINE EINZIGE STILL.
// ================================================================================================
//
// Diese drei Verweise waren beim Bau dieser Datei bereits tot und liegen AUSSERHALB der
// Productwrite-Lease dieses Durchgangs (JOB 619 D5 schreibt nur die drei Testdateien seiner Lease).
// Sie werden deshalb hier benannt statt geheilt — mit Fundstelle, Ist-Ziel und dem, was vermutlich
// gemeint war. Ein späterer Auftrag kann sie an genau diesen Stellen schliessen.
//
// KEIN DECKEL OHNE WACHE: Wird ein Eintrag auflösbar (weil jemand ihn repariert hat), wird der Fall
// „die Quarantäne verrottet nicht" ROT und zwingt zum Streichen des Eintrags. Eine Ausnahmeliste,
// die nur wachsen kann, ist keine Ausnahmeliste, sondern eine Abschaltung.
const QUARANTAENE: readonly { quelle: string; ziel: string; gemeint: string }[] = [
  {
    quelle: "tests/app/pro337-galerieweg-sammler.test.ts",
    ziel: "tests/capture/pro337-capture-galerieweg-mounted.test.tsx",
    gemeint: "tests/capture/pro337-bildbeschreibung-endtoend.test.tsx (umbenannt)",
  },
  {
    quelle: "apps/web/src/app/ImageDescribeContext.tsx",
    ziel: "tests/app/mega50-bildbeschreibung-sammler.test.tsx",
    gemeint: "tests/app/mega50-bildbeschreibung-sammler.test.ts (Endung .ts, nicht .tsx)",
  },
  {
    quelle: "apps/web/src/i18n.ts",
    ziel: "tests/legal/mega61-rechtsseiten.test.ts",
    gemeint: "tests/legal/mega61-rechtsseiten.test.tsx (Endung .tsx, nicht .ts)",
  },
];

const inQuarantaene = (v: Verweis): boolean =>
  QUARANTAENE.some((q) => q.quelle === v.quelle && q.ziel === v.ziel);

describe("JOB 619 D5 · jeder Testverweis im Quelltext löst auf", () => {
  it("erhebt überhaupt etwas — sonst wäre jedes Grün wertlos", () => {
    const verweise = alleVerweise();
    // Kalibrierung: fände der Ausdruck nichts (falscher Arbeitsordner, Bereiche umbenannt), wären
    // alle folgenden Fälle trivial grün. Beim Bau waren es 248 Verweise; die Untergrenze ist
    // bewusst grob, sie soll den Totalausfall fangen, nicht die Zahl einfrieren.
    expect(verweise.length).toBeGreaterThan(100);
    // Und der Paritätsverweis aus dem Produktcode ist wirklich dabei — er ist der Anlass.
    expect(
      verweise.some(
        (v) =>
          v.quelle === "services/ask/src/answer-evidence.ts" &&
          v.ziel === "tests/app/mega34-answer-grade-parity.test.ts",
      ),
    ).toBe(true);
  });

  it("die Endungs-Alternation matcht `.tsx` VOLLSTÄNDIG (die Falle aus dem Bau)", () => {
    // Ohne diese Zusicherung kippt der Wächter bei einer harmlos aussehenden Umsortierung der
    // Alternation von „prüft echte Verweise" auf „meldet jede .tsx-Datei als tot".
    const probe = "// siehe tests/capture/pro337-bildbeschreibung-endtoend.test.tsx";
    const treffer = [...probe.matchAll(VERWEIS)].map((m) => m[0]);
    expect(treffer).toEqual(["tests/capture/pro337-bildbeschreibung-endtoend.test.tsx"]);
  });

  it("ausgeschlossen ist GENAU eine Datei — dieser Wächter selbst", () => {
    // Der Ausschluss darf nicht zur Sammelstelle werden. Er ist ein einzelner Pfad, und dieser
    // Pfad existiert wirklich (ein Tippfehler darin würde den Ausschluss still wirkungslos machen
    // und die Datei doch wieder mitzählen).
    expect(existsSync(resolve(WURZEL, SELBST))).toBe(true);
    expect(alleVerweise().some((v) => v.quelle === SELBST)).toBe(false);
  });

  it("Code ist kein Kommentar — eine Regex-Eingabe wird NICHT als Verweis gewertet", () => {
    // Die belegte Fundstelle ist der Kalibrierungsfall R7 in
    // `tests/app/theme-deckungsregister.test.ts`: er reicht einen erfundenen Testdateinamen als
    // Prüfstring an einen regulären Ausdruck. Die Datei existiert nicht und soll es auch nicht —
    // sie darf hier trotzdem nie als toter Verweis auftauchen. Erkannt wird sie am Wortbestandteil
    // „werkbank", damit dieser Fall den Nachbarn nicht selbst auslöst (s. Kopf der Datei).
    const verweise = alleVerweise();
    expect(verweise.some((v) => v.ziel.includes("werkbank"))).toBe(false);
  });

  it("kein toter Verweis ausserhalb der benannten Quarantäne", () => {
    const tot = alleVerweise().filter((v) => !istDa(v.ziel));
    const offen = tot.filter((v) => !inQuarantaene(v));
    expect(
      offen.map((v) => `${v.quelle}:${v.zeile} -> ${v.ziel}`),
      "Ein Kommentar behauptet eine Prüfabdeckung, die es nicht gibt. Entweder den Verweis auf die " +
        "richtige Datei ziehen oder die Datei bauen — nicht den Wächter erweitern.",
    ).toEqual([]);
  });

  it("die Quarantäne verrottet nicht — ein geheilter Eintrag muss raus", () => {
    const geheilt = QUARANTAENE.filter((q) => istDa(q.ziel));
    expect(
      geheilt.map((q) => `${q.quelle} -> ${q.ziel}`),
      "Dieser Verweis löst inzwischen auf. Den Eintrag aus QUARANTAENE streichen, damit die Liste " +
        "die Wahrheit sagt.",
    ).toEqual([]);
  });

  it("jeder Quarantäne-Eintrag steht wirklich so im Quelltext", () => {
    // Ein Eintrag, den niemand mehr erzeugt (Datei gelöscht, Kommentar umformuliert), verdeckt
    // sonst dauerhaft nichts und täuscht Restschuld vor, die es nicht gibt.
    const verweise = alleVerweise();
    const verwaist = QUARANTAENE.filter(
      (q) => !verweise.some((v) => v.quelle === q.quelle && v.ziel === q.ziel),
    );
    expect(
      verwaist.map((q) => `${q.quelle} -> ${q.ziel}`),
      "Dieser Quarantäne-Eintrag kommt im Quelltext nicht mehr vor — streichen.",
    ).toEqual([]);
  });
});
