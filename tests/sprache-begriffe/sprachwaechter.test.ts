// ================================================================================================
// AUFNAHME gesamt-sprache-begriffe · K15 (R-1169) / K7 (R-0983) — DER SPRACHWÄCHTER IM BAU.
// ================================================================================================
//
// R-1169: „Ein Wächter im Bauprozess schlägt an, wenn ein Text nicht in allen drei Sprachen vorliegt
// oder eine unbekannte Sprache auftaucht. Er meldet auch, wenn ein Text hart im Code steht statt in
// der Übersetzungsdatei."
//
// Die erste Hälfte (fehlende Sprache, Doppelschlüssel) belegt seit JOB 4367
// `tests/i18n-textmodule/modulvertrag.test.ts`. Diese Datei belegt die beiden Teile, die bis
// hierher fehlten, und zwar an DERSELBEN Stelle, die den Produktbuild stoppt (Plugin
// `textmodul-vertrag`):
//
//   U  unbekannte Sprache — im Textmodul (`fr: {…}`) und im Grundbestand (`woerterbuch/fr.ts`)
//   H  hart codierter Anzeigetext in TSX — als Sperrklinke gegen den gemessenen Bestand
//   P  das Plugin bricht an beidem ab und läuft am echten Baum durch
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { pruefeTextmodule } from "../../apps/web/src/texte/intern/pruefung";
import { textmodulVertrag } from "../../apps/web/src/texte/intern/sammeln";
import {
  BEKANNTE_STELLEN,
  hartkodierteFunde,
  hartkodierteZeilen,
  pruefeHartkodierteTexte,
  pruefeSprachdateien,
} from "../../apps/web/src/texte/intern/sprachwaechter";
import { repoPfad } from "../support/repoPfad";

const SRC = repoPfad("apps/web/src");

const buehnen: string[] = [];
afterAll(() => {
  for (const ordner of buehnen) {
    rmSync(ordner, { recursive: true, force: true });
  }
});

/** Eine Wegwerfbühne in Gestalt von `apps/web` — nie am Produktbaum schrauben. */
function buehne(dateien: Record<string, string>): string {
  const wurzel = mkdtempSync(join(tmpdir(), "kw-sprachwaechter-"));
  buehnen.push(wurzel);
  mkdirSync(join(wurzel, "src", "texte"), { recursive: true });
  writeFileSync(join(wurzel, "src", "i18n.ts"), 'const de = {\n  "basis.da": "A",\n};\n', "utf8");
  for (const [pfad, inhalt] of Object.entries(dateien)) {
    const ziel = join(wurzel, "src", pfad);
    mkdirSync(join(ziel, ".."), { recursive: true });
    writeFileSync(ziel, inhalt, "utf8");
  }
  return wurzel;
}

function fahrePlugin(wurzel: string): void {
  const plugin = textmodulVertrag();
  plugin.configResolved({ root: wurzel });
  plugin.buildStart();
}

const modul = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  "./texte/probe.ts": {
    praefix: "probe.",
    legacySchluessel: [],
    de: { "probe.titel": "DE" },
    en: { "probe.titel": "EN" },
    nl: { "probe.titel": "NL" },
    ...extra,
  },
});

describe("K15 · U — eine unbekannte Sprache fällt nicht mehr still durch", () => {
  it("U-1: ein Textmodul mit `fr` wird gemeldet — mit Modul und Sprache", () => {
    const fehler = pruefeTextmodule(modul({ fr: { "probe.titel": "FR" } }), new Set<string>());
    expect(fehler.join("\n")).toContain('./texte/probe.ts: unbekannter Eintrag "fr"');
  });

  it("U-2: Gegenprobe — dasselbe Modul ohne `fr` ist sauber", () => {
    expect(pruefeTextmodule(modul(), new Set<string>())).toEqual([]);
  });

  it("U-3: eine Sprachdatei ausserhalb de/en/nl im Grundbestand wird gemeldet", () => {
    const wurzel = buehne({
      "woerterbuch/de.ts": "export const de = {};\n",
      "woerterbuch/fr.ts": "export const fr = {};\n",
    });
    const fehler = pruefeSprachdateien(join(wurzel, "src"));
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain("woerterbuch/fr.ts: unbekannte Sprache");
  });

  it("U-4: der echte Grundbestand führt genau de, en und nl", () => {
    expect(pruefeSprachdateien(SRC)).toEqual([]);
  });
});

describe("K15 · H — hart codierte Anzeigetexte", () => {
  it("H-1: der echte Baum hält die Sperrklinke", () => {
    expect(pruefeHartkodierteTexte(SRC)).toEqual([]);
  });

  it("H-2: der Bestand ist genau der gemessene — jede bekannte Stelle mit Grund", () => {
    // Exakt, nicht nur „höchstens": ist eine Stelle behoben, gehört ihr Eintrag herabgesetzt,
    // sonst dürfte dort still ein neuer harter Text nachwachsen.
    const ist: Record<string, number> = {};
    for (const fund of hartkodierteFunde(SRC)) {
      ist[fund.datei] = (ist[fund.datei] ?? 0) + 1;
    }
    const soll = Object.fromEntries(
      Object.entries(BEKANNTE_STELLEN).map(([datei, stelle]) => [datei, stelle.anzahl]),
    );
    expect(ist).toEqual(soll);
    for (const [datei, stelle] of Object.entries(BEKANNTE_STELLEN)) {
      expect(stelle.grund.length, `${datei} ohne Grund`).toBeGreaterThan(20);
    }
  });

  it("H-3: die in dieser Aufnahme behobenen Stellen sind wirklich weg", () => {
    const dateien = new Set(hartkodierteFunde(SRC).map((f) => f.datei));
    for (const datei of [
      "components/RichTextEditor.tsx",
      "shell/ZahnradMenue.tsx",
      "pages/UiKit.tsx",
    ]) {
      expect(dateien.has(datei), `${datei} trägt wieder einen harten Text`).toBe(false);
    }
  });

  it("H-4: Rotnachweis — Text zwischen Tags und ein Textattribut werden gefunden", () => {
    const quelle = [
      "export function Probe() {",
      "  return (",
      '    <div title="App-Version (Beta-Phase)">',
      '      <span className="x">Bildgröße</span>',
      '      <input placeholder="Deine Antwort" />',
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    expect(hartkodierteZeilen(quelle)).toEqual([3, 4, 5]);
  });

  it("H-5: keine Fehltreffer an Pfeilfunktionen, Typargumenten, Kommentaren und t()", () => {
    const quelle = [
      "  onSave: () => Promise<boolean>;",
      "  laden: (koId: string) => Promise<KoVersionSnapshot[]>;",
      "  const [a, b] = useState<ReadonlySet<string>>(() => new Set<string>());",
      "function f(a: Map<string, Foo>, b: Set<string>) {}",
      "  // <b>Kommentar mit Tag</b>",
      "  {/* <span>auch das</span> */}",
      '  <span className="x">{t("beschriftung.editor.bildgroesse")}</span>',
      '  <span title={t("beschriftung.zahnrad.version")}>v1</span>',
    ].join("\n");
    expect(hartkodierteZeilen(quelle)).toEqual([]);
  });

  it("H-6: ein neuer harter Text in einer Bühne bricht die Sperrklinke — mit Datei und Zeile", () => {
    const wurzel = buehne({
      "pages/Neu.tsx": [
        "export function Neu() {",
        '  return <span className="x">Speichern</span>;',
        "}",
        "",
      ].join("\n"),
    });
    const fehler = pruefeHartkodierteTexte(join(wurzel, "src"));
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain("pages/Neu.tsx:2");
    expect(fehler[0]).toContain("Speichern");
    expect(fehler[0]).toContain("erlaubt 0");
  });
});

describe("K15 · P — dieselbe Prüfung stoppt den Produktbuild", () => {
  it("P-1: am echten Produktbaum läuft das Plugin durch", () => {
    expect(() => fahrePlugin(repoPfad("apps/web"))).not.toThrow();
  });

  it("P-2: ein harter Text bricht den Build ab — benannt als Sprachwächter", () => {
    const wurzel = buehne({
      "pages/Neu.tsx": 'export const Neu = () => <p className="x">Hallo Welt</p>;\n',
    });
    expect(() => fahrePlugin(wurzel)).toThrow(/Sprachwächter[\s\S]*pages\/Neu\.tsx:1/);
  });

  it("P-3: eine unbekannte Sprache im Grundbestand bricht den Build ab", () => {
    const wurzel = buehne({ "woerterbuch/fr.ts": "export const fr = {};\n" });
    expect(() => fahrePlugin(wurzel)).toThrow(/Sprachwächter[\s\S]*woerterbuch\/fr\.ts/);
  });

  it("P-4: ein Textmodul mit unbekannter Sprache bricht den Build ab", () => {
    const wurzel = buehne({
      "texte/probe.ts": [
        "export default {",
        '  praefix: "probe.",',
        "  legacySchluessel: [],",
        '  de: { "probe.titel": "DE" },',
        '  en: { "probe.titel": "EN" },',
        '  nl: { "probe.titel": "NL" },',
        '  fr: { "probe.titel": "FR" },',
        "};",
        "",
      ].join("\n"),
    });
    expect(() => fahrePlugin(wurzel)).toThrow(/unbekannter Eintrag "fr"/);
  });
});
