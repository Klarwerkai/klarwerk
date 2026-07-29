// ================================================================================================
// AUFTRAG-mega51 BLÖCKE F, G, H — SPRACHE, ROHWERTE UND DER KOSTENHINWEIS.
// ================================================================================================
// Drei Zusagen, und zwei davon sind SAMMLER über die Bauform, keine Liste der heutigen Fälle:
//
//  (1) VOLLSTÄNDIGKEIT (Rahmen): jeder in dieser Runde neue oder geänderte Anzeigeschlüssel liegt
//      in DE, EN UND NL vor. Erhoben wird nicht „diese acht Schlüssel", sondern: JEDER Schlüssel,
//      den mindestens eine Sprache kennt, muss von allen dreien gekannt werden. Ein neunter
//      Schlüssel morgen ist ohne Zutun Gegenstand dieser Datei.
//
//  (2) KEINE ROHWERTE MEHR (F): keine Anzeigefläche setzt eine Zahl und ein Wort per Hand
//      zusammen (das erzeugte „1 Experten"), und keine fällt auf eine rohe Kennung zurück
//      (das erzeugte die UUID als Autorenname). Beides wird über ein MUSTER im Quellbaum gesucht,
//      nicht an den zwei heute bekannten Stellen.
//
//  (3) TRUST IST UNBERÜHRT (G2): die Umbenennung von „Trust" ist ausdrücklich NICHT Gegenstand
//      dieser Runde — halb übersetzt wäre schlechter als gar nicht. Der Test hält die Zahl der
//      „Trust"-Vorkommen je Sprache fest. Wer sie anfasst, wird rot und muss es begründen.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WEB_SRC = join(__dirname, "../../apps/web/src");
const I18N = readFileSync(join(WEB_SRC, "i18n.ts"), "utf8");

// Die drei Sprachblöcke — an ihren Wörterbuch-Deklarationen erhoben, nicht an Zeilennummern.
function sprachbloecke(): { name: string; text: string }[] {
  const marken = [...I18N.matchAll(/^const (de|en|nl)\b[^\n]*$/gm)];
  expect(marken.length, "drei Sprachblöcke erwartet").toBe(3);
  return marken.map((m, i) => ({
    name: m[1] as string,
    text: I18N.slice(
      m.index ?? 0,
      i + 1 < marken.length ? (marken[i + 1]?.index ?? I18N.length) : I18N.length,
    ),
  }));
}

function schluesselIn(text: string): Set<string> {
  return new Set([...text.matchAll(/^ {2}"([a-zA-Z0-9._-]+)":/gm)].map((m) => m[1] as string));
}

const BLOECKE = sprachbloecke();

// Quelldateien des Web-Produktbaums (ohne Tests) — für die Muster-Suchen unten.
function quelldateien(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const voll = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...quelldateien(voll));
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      out.push(voll);
    }
  }
  return out;
}
const QUELLEN = quelldateien(WEB_SRC).filter((f) => !f.endsWith("i18n.ts"));

// Kommentare raus, sonst zählt die ERWÄHNUNG eines Musters als Vorkommen. Genau daran ist diese
// Erhebung beim ersten Lauf hängengeblieben: die Kommentare, die den behobenen Fehler ZITIEREN
// („hier stand `{b.authorCount} {t(...)}`"), sahen für sie aus wie der Fehler selbst.
function ohneKommentare(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("mega51 · jeder Anzeigeschlüssel liegt in DE, EN und NL vor", () => {
  it("die Erhebung greift wirklich (drei Blöcke, jeder mit vielen Schlüsseln)", () => {
    for (const b of BLOECKE) {
      expect(schluesselIn(b.text).size, `Sprachblock ${b.name}`).toBeGreaterThan(500);
    }
  });

  it("kein Schlüssel fehlt in einer der drei Sprachen", () => {
    const mengen = BLOECKE.map((b) => ({ name: b.name, keys: schluesselIn(b.text) }));
    const alle = new Set(mengen.flatMap((m) => [...m.keys]));
    const luecken: string[] = [];
    for (const key of alle) {
      const fehlt = mengen.filter((m) => !m.keys.has(key)).map((m) => m.name);
      if (fehlt.length > 0) {
        luecken.push(`${key} fehlt in: ${fehlt.join(",")}`);
      }
    }
    expect(luecken).toEqual([]);
  });
});

describe("mega51 F · keine Rohwerte mehr in der Oberfläche", () => {
  it("F1: keine Anzeigefläche setzt eine Zahl und ein Wort per Hand zusammen", () => {
    // Das Muster von „1 Experten": `{zahl} {t("…")}` direkt nebeneinander im JSX. Pluralisierung
    // gehört über `count` (i18next), nicht über Aneinanderreihung.
    const funde: string[] = [];
    for (const datei of QUELLEN) {
      const src = ohneKommentare(readFileSync(datei, "utf8"));
      for (const m of src.matchAll(/\{[a-zA-Z][\w.?]*Count\}\s*\{t\(/g)) {
        funde.push(`${datei.replace(WEB_SRC, "")}: ${m[0]}`);
      }
    }
    expect(funde).toEqual([]);
  });

  it("F2: keine Anzeigefläche fällt auf die rohe Autoren-Kennung zurück", () => {
    // Das Muster war `…?.name || uid` — die Kennung als Ersatz für einen Namen.
    const funde: string[] = [];
    for (const datei of QUELLEN) {
      const src = ohneKommentare(readFileSync(datei, "utf8"));
      for (const m of src.matchAll(/\?\.name \|\| (?:uid|u\.id|d\.id)\b/g)) {
        funde.push(`${datei.replace(WEB_SRC, "")}: ${m[0]}`);
      }
    }
    expect(funde).toEqual([]);
  });

  it("F2: die ehrliche Auskunft kommt aus EINER Quelle und unterscheidet zwei Unbekannte", () => {
    expect(I18N).toContain('"ko.authorUnknown"');
    // Ohne Unterscheidungsmerkmal sähen zwei fremde Kennungen wie eine Person aus.
    expect(I18N).toContain("{{ref}}");
  });
});

describe("mega51 G2 · Trust bleibt unberührt — es ist eine eigene Scheibe", () => {
  it("die Zahl der Trust-Vorkommen im ANZEIGETEXT je Sprachblock ist unverändert", () => {
    // Kommentarzeilen zählen NICHT mit: gemessen wird, was Natascha liest, nicht was wir uns
    // im Wörterbuch dazu notieren. (Genau daran wäre diese Messung sonst schon gescheitert —
    // der mega51-Kommentar an `lib.confidenceNone` erwähnt „Trust", ohne es anzuzeigen.)
    const zaehlung = BLOECKE.map((b) => {
      const nurText = b.text.replace(/^\s*\/\/.*$/gm, "");
      return `${b.name}: ${(nurText.match(/Trust|trust/g) ?? []).length}`;
    });
    // Diese Zahlen sind am Stand VOR mega51 (Commit 3805c49) GEMESSEN und sind der Beleg dafür,
    // dass diese Runde die Trust-Scheibe nicht angefasst hat. Sie zu ändern ist erlaubt — aber
    // nur bewusst, mit Begründung, und nicht nebenbei.
    expect(zaehlung).toEqual(["de: 77", "en: 93", "nl: 77"]);
  });
});

describe("mega51 H · der Beispielklick sagt vorher, dass er eine echte Anfrage startet", () => {
  it("der Hinweis steht an der Beschriftung UND an jedem Chip", () => {
    const ask = readFileSync(join(WEB_SRC, "pages/Ask.tsx"), "utf8");
    expect(ask).toContain('{t("ask.examplesSendHint")}');
    expect(ask).toContain('title={t("ask.examplesSendHint")}');
    // Kein Bestätigungsdialog — der Klick bleibt EIN Klick.
    expect(ask).toContain("onClick={() => askExample(question)}");
    expect(ask).not.toContain("window.confirm");
  });
});
