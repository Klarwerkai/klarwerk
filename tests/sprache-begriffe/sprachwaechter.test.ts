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
//   H  hart codierter Anzeigetext in TSX — anhand der JSX-Struktur, Ausnahmen an Datei UND Wortlaut
//   P  das Plugin bricht an beidem ab und läuft am echten Baum durch
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { pruefeTextmodule } from "../../apps/web/src/texte/intern/pruefung";
import { textmodulVertrag } from "../../apps/web/src/texte/intern/sammeln";
import {
  AUSNAHMEN,
  type Ausnahme,
  hartkodierteFunde,
  hartkodierteTexte,
  istAnzeigetext,
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

/** Kurzform: was der Wächter in einem Quelltext findet, als `zeile: text`. */
const fundeIn = (quelle: string): string[] =>
  hartkodierteTexte(quelle).map((f) => `${f.zeile}: ${f.text}`);

describe("K15 · U — eine unbekannte Sprache fällt nicht mehr still durch", () => {
  it("U-1: ein Textmodul mit `fr` wird gemeldet — mit Modul und Sprache", () => {
    const fehler = pruefeTextmodule(modul({ fr: { "probe.titel": "FR" } }), new Set<string>());
    expect(fehler.join("\n")).toContain('./texte/probe.ts: unbekannter Eintrag "fr"');
  });

  it("U-2: Gegenprobe — dasselbe Modul ohne `fr` ist sauber", () => {
    expect(pruefeTextmodule(modul(), new Set<string>())).toEqual([]);
  });

  // R-0997 (Nacharbeit 10): eine GEBUNDENE Datei (`const fr: typeof de = {`) meldet ihre Sprache an
  // — belegt in `tests/sprache-begriffe/neue-sprache-aus-ressourcen.test.ts` R-3. Diese hier ist
  // ungebunden und bleibt deshalb eine unbekannte Sprache.
  it("U-3: eine ungebundene Sprachdatei ausserhalb de/en/nl im Grundbestand wird gemeldet", () => {
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

describe("K15 · H — hart codierte Anzeigetexte, erkannt an der JSX-Struktur", () => {
  it("H-1: der echte Baum ist sauber — jeder Fund ist eine benannte Ausnahme", () => {
    expect(pruefeHartkodierteTexte(SRC)).toEqual([]);
  });

  it("H-2: die Funde sind GENAU die Ausnahmen — Datei und Wortlaut, jede mit Grund", () => {
    const ist = hartkodierteFunde(SRC).map((f) => `${f.datei} · ${f.text}`);
    const soll = AUSNAHMEN.map((a) => `${a.datei} · ${a.text}`);
    expect(ist.sort()).toEqual(soll.sort());
    for (const a of AUSNAHMEN) {
      expect(a.grund.length, `${a.datei} „${a.text}“ ohne Grund`).toBeGreaterThan(20);
    }
  });

  it("H-3: die in dieser Aufnahme behobenen Stellen tragen keinen harten Text mehr", () => {
    const dateien = new Set(hartkodierteFunde(SRC).map((f) => f.datei));
    for (const datei of [
      "components/RichTextEditor.tsx",
      "shell/ZahnradMenue.tsx",
      "pages/UiKit.tsx",
      "pages/PlaceholderPage.tsx",
      "pages/AdminKiDetails.tsx",
    ]) {
      expect(dateien.has(datei), `${datei} trägt wieder einen harten Text`).toBe(false);
    }
    const texte = hartkodierteFunde(SRC).map((f) => f.text);
    expect(texte).not.toContain("Reasoning System");
    expect(texte).not.toContain("Klarwerk - zur Startseite");
  });

  it("H-4: Rotnachweis — Komma, Doppelpunkt, Zeilenumbruch, Ausdrücke und Attribute", () => {
    const quelle = [
      "export function Probe({ ok, n }: { ok: boolean; n: number }) {",
      "  return (",
      '    <div title="App-Version (Beta-Phase)">',
      "      <span>Hallo, Welt</span>",
      "      <p>",
      "        Achtung: das ist",
      "        ein langer Satz",
      "      </p>",
      '      {"Gespeichert"}',
      '      {ok ? "OK" : "FAIL"}',
      "      {`${n} Einträge`}",
      '      <input aria-label={"Suchbegriff"} placeholder="Deine Antwort" />',
      '      {n > 0 && "Weitere vorhanden"}',
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    expect(fundeIn(quelle)).toEqual([
      "3: App-Version (Beta-Phase)",
      "4: Hallo, Welt",
      "6: Achtung: das ist ein langer Satz",
      "9: Gespeichert",
      "10: OK",
      "10: FAIL",
      "11: Einträge",
      "12: Suchbegriff",
      "12: Deine Antwort",
      "13: Weitere vorhanden",
    ]);
  });

  it("H-5: keine Fehltreffer an Code, Kommentaren, t(), Bezeichnern und Zeichen", () => {
    const quelle = [
      "type P = { onSave: () => Promise<boolean>; m: Map<string, Set<string>> };",
      "export function Probe({ t, n, a, b }: { t: (k: string) => string; n: number; a: number; b: number }) {",
      "  const x = a > b ? 1 : 2;",
      "  // <b>Kommentar mit Tag</b>",
      "  return (",
      '    <div className={x > 1 ? "font-bold" : ""}>',
      "      {/* <span>auch das, mit Komma: ja</span> */}",
      '      <span className="x">{t("beschriftung.editor.bildgroesse")}</span>',
      '      <span title={t("beschriftung.zahnrad.version")}>v{n}</span>',
      '      {n > 0 ? t("a.b") : t("c.d")}',
      "      <span>klarwerk.ai</span>",
      '      {"lib.facet.tag"}',
      '      {" "} · → {"—"} × %',
      "      <style>{`.blatt-text div { display: none; }`}</style>",
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    expect(fundeIn(quelle)).toEqual([]);
  });

  it("H-6: eine Ausnahme ist an den WORTLAUT gebunden — ein anderer Text übernimmt sie nicht", () => {
    // Bens Fall: in BrandPanel.tsx ersetzt ein unübersetzter Bedienhinweis die Wortmarke. Gleiche
    // Datei, gleiche Anzahl Funde — trotzdem rot, und die verwaiste Ausnahme wird ebenfalls gemeldet.
    const wurzel = buehne({
      "auth/BrandPanel.tsx": "export const B = () => <span>Jetzt anmelden</span>;\n",
    });
    const ausnahmen: Ausnahme[] = [
      { datei: "auth/BrandPanel.tsx", text: "KLARWERK", grund: "Wortmarke, kein Anzeigetext" },
    ];
    const fehler = pruefeHartkodierteTexte(join(wurzel, "src"), ausnahmen);
    expect(fehler).toHaveLength(2);
    expect(fehler[0]).toContain("auth/BrandPanel.tsx:1: hart codierter Anzeigetext");
    expect(fehler[0]).toContain("„Jetzt anmelden“");
    expect(fehler[1]).toContain("Ausnahme „KLARWERK“ hat keinen Fund mehr");
  });

  it("H-7: Gegenprobe — der Text der Ausnahme selbst bleibt zulässig", () => {
    const wurzel = buehne({
      "auth/BrandPanel.tsx": "export const B = () => <span>KLARWERK</span>;\n",
    });
    const ausnahmen: Ausnahme[] = [
      { datei: "auth/BrandPanel.tsx", text: "KLARWERK", grund: "Wortmarke, kein Anzeigetext" },
    ];
    expect(pruefeHartkodierteTexte(join(wurzel, "src"), ausnahmen)).toEqual([]);
  });

  it("H-8: Bezeichner und Anzeigetext werden getrennt", () => {
    for (const text of ["Hallo, Welt", "Hinweis:", "OK", "KLARWERK", "Stufe 2", "Design: §"]) {
      expect(istAnzeigetext(text), text).toBe(true);
    }
    for (const text of ["klarwerk.ai", "lib.facet.tag", "bilder/x-1.png", "v", "·", "%"]) {
      expect(istAnzeigetext(text), text).toBe(false);
    }
  });

  it("H-9: ein neuer harter Text in einer Bühne bricht die Prüfung — mit Datei und Zeile", () => {
    const wurzel = buehne({
      "pages/Neu.tsx": [
        "export function Neu() {",
        '  return <span className="x">Speichern, bitte</span>;',
        "}",
        "",
      ].join("\n"),
    });
    const fehler = pruefeHartkodierteTexte(join(wurzel, "src"), []);
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain("pages/Neu.tsx:2");
    expect(fehler[0]).toContain("Speichern, bitte");
  });
});

describe("K15 · P — dieselbe Prüfung stoppt den Produktbuild", () => {
  it("P-1: am echten Produktbaum läuft das Plugin durch", () => {
    expect(() => fahrePlugin(repoPfad("apps/web"))).not.toThrow();
  });

  it("P-2: ein harter Text bricht den Build ab — benannt als Sprachwächter", () => {
    const wurzel = buehne({
      "pages/Neu.tsx": 'export const Neu = () => <p className="x">Hallo, Welt</p>;\n',
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
