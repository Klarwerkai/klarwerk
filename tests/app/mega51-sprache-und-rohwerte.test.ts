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

// AUFTRAG-mega52 BLOCK E — DIE SCHEIBE IST GESCHNITTEN.
//
// mega51 hat „Trust" bewusst liegen gelassen und diesen Zähler als Beleg dafür gesetzt, dass die
// Runde die Scheibe NICHT angefasst hat. mega52 Block E hat sie geschnitten: der deutsche und der
// niederländische ANZEIGEWERT heißen jetzt „Vertrauen"/„vertrouwen"; Englisch bleibt ausdrücklich
// unberührt (E2 — dort ist „trust" ein normales Wort).
//
// WAS HIER NOCH ZÄHLT, ist genau das, was NICHT umbenannt werden durfte (E3): die SCHLÜSSELNAMEN
// (`lib.facet.trustBucket.t70`, `answerSource.trust`, …) und der i18next-Platzhalter `{{trust}}`.
// Beides sind Bezeichner, keine Anzeigetexte — sie umzubenennen bräche jeden Aufrufer, ohne dass
// ein Nutzer je etwas anderes sähe. Dass sie stehen geblieben sind, ist der Beleg, dass die
// Umbenennung wirklich nur den Wert getroffen hat.
//
// Der maßgebliche Wächter ist ab mega52 nicht mehr diese Zahl, sondern
// `tests/app/mega52-vertrauenswert-sammler.test.ts` — er misst je Sprachblock über die WERTE,
// nicht über einen Gesamtzähler, und sagt bei einem Rückfall, welcher Schlüssel es war.
describe("mega51 G2 · Trust — die Scheibe ist in mega52 geschnitten", () => {
  it("die Zahl der Trust-Vorkommen je Sprachblock ist bewusst gesenkt (nur noch Bezeichner)", () => {
    // Kommentarzeilen zählen NICHT mit: gemessen wird, was Natascha liest, nicht was wir uns
    // im Wörterbuch dazu notieren. (Genau daran wäre diese Messung sonst schon gescheitert —
    // der mega51-Kommentar an `lib.confidenceNone` erwähnt „Trust", ohne es anzuzeigen.)
    const zaehlung = BLOECKE.map((b) => {
      const nurText = b.text.replace(/^\s*\/\/.*$/gm, "");
      return `${b.name}: ${(nurText.match(/Trust|trust/g) ?? []).length}`;
    });
    // VORHER (Stand mega51, Commit 3805c49): de 77 · en 93 · nl 77.
    // NACH mega52 Block E: de 26 · en 88 · nl 27.
    // Deutsch und Niederländisch fallen stark, weil dort jeder ANZEIGEWERT übersetzt wurde; was
    // bleibt, sind Schlüsselnamen und `{{trust}}`. Englisch sinkt nur leicht — dort fielen allein
    // die beiden in mega51 verwaisten Schlüssel `lib.trustNone`/`lib.trustNoneHint` weg (E4).
    //
    // NACH mega53 B2: de 27 · en 91 · nl 28. Der Anstieg ist AUSSCHLIESSLICH der neue Schlüssel
    // `ask.trust.unattributed` — in DE und NL genau einmal als BEZEICHNER, sein Anzeigewert heißt
    // „Vertrauenswert nicht zuordenbar" bzw. „vertrouwenswaarde niet toewijsbaar". Im englischen
    // Block sind es drei, weil „trust" dort ein normales Wort und bewusst nicht übersetzt ist
    // (E2): einmal der Schlüssel, einmal sein Wert, einmal im Text von
    // `ask.checkCaveat.unattributed`. Die Scheibe bleibt damit geschnitten — kein deutscher oder
    // niederländischer Anzeigewert ist zurückgekommen. Den Beweis dafür führt weiterhin
    // `tests/app/mega52-vertrauenswert-sammler.test.ts` über die WERTE.
    expect(zaehlung).toEqual(["de: 27", "en: 91", "nl: 28"]);
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
