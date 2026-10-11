// ==================================================================================================
// BILDSCHIRMABLÄUFE · IMPORT UND BEARBEITUNG — die reine Logik (`apps/web/src/lib/ablaufImport.ts`).
// ==================================================================================================
//
// Originalkriterien (AUFTRAG-B1): K1 Reihenfolge/Bilder/Texte/Herkunft, K2 ändern/verschieben/
// löschen, K4 Schwärzen ohne auslesbare Kopie (Text), K5 unvollständiger/nicht unterstützter Import
// → verständlicher Fehler statt scheinbar vollständiger Anleitung, K6 stabiler Übernahmeschlüssel,
// K7 externe Herkunft erkennbar. Beispieldaten: neutral, getrennt, aus `docs/aufnahme/beispiele/`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Ablauf } from "../../apps/web/src/api/types";
import {
  ABLAUF_GRENZEN,
  type AblaufFormulierung,
  FORMAT_CHROME,
  FORMAT_KLARWERK,
  SCHWAERZUNG,
  ablaufZuRumpf,
  einreichSchluessel,
  leseAblaufDatei,
  pruefeSchritte,
  schrittBildSetzen,
  schrittEntfernen,
  schrittTextAendern,
  schrittVerschieben,
  schwaerzeInSchritten,
  uebernahmeSchluessel,
} from "../../apps/web/src/lib/ablaufImport";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const BEISPIEL = readFileSync(
  join(__dirname, "../../docs/aufnahme/beispiele/angebot-anlegen.klarwerk-ablauf.json"),
  "utf8",
);

const FORMULIERUNG: AblaufFormulierung = {
  oeffnen: (a) => `Öffne ${a}`,
  klicken: (z) => `Klicke auf „${z}“`,
  eingeben: (w, z) => `Gib „${w}“ in „${z}“ ein`,
  taste: (k) => `Drücke ${k}`,
};

function lies(inhalt: string, datei = "ablauf.json") {
  return leseAblaufDatei(inhalt, datei, FORMULIERUNG);
}

function ok(inhalt: string, datei?: string): { ablauf: Ablauf; titel: string } {
  const e = lies(inhalt, datei);
  if (!e.ok) {
    throw new Error(`erwartet ok, bekam ${JSON.stringify(e.fehler)}`);
  }
  return e;
}

describe("K1/K7 · der dokumentierte Beispielablauf wird vollständig übernommen", () => {
  it("Reihenfolge, Handlungstexte, Bilder und externe Herkunft bleiben erhalten", () => {
    const roh = JSON.parse(BEISPIEL) as { schritte: { text: string; bild: string }[] };
    const { ablauf, titel } = ok(BEISPIEL, "angebot-anlegen.klarwerk-ablauf.json");

    expect(titel).toBe("Angebot in der Testanwendung anlegen, prüfen und speichern");
    expect(ablauf.schritte.map((s) => s.text)).toEqual(roh.schritte.map((s) => s.text));
    expect(ablauf.schritte.map((s) => s.bild)).toEqual(roh.schritte.map((s) => s.bild));
    expect(ablauf.schritte.map((s) => s.id)).toEqual(["s1", "s2", "s3", "s4", "s5"]);
    expect(ablauf.quelle).toEqual({
      art: "import",
      format: FORMAT_KLARWERK,
      werkzeug: "Beispiel-Aufzeichnung (Platzhalterbilder)",
      datei: "angebot-anlegen.klarwerk-ablauf.json",
      aufgezeichnetAm: "2026-10-05T09:12:00Z",
      anwendung: "Testanwendung Angebote",
    });
  });

  it("der Rumpf nennt die externe Herkunft, den Prüfhinweis und jeden Schritt in Reihenfolge mit Bild", () => {
    const { ablauf } = ok(BEISPIEL);
    const html = ablaufZuRumpf(ablauf, {
      schritt: (n) => `Schritt ${n}`,
      herkunft: "Herkunft: außerhalb Klarwerks aufgezeichnet mit X",
      hinweis: "Beobachteter Ablauf: Prüfung bestätigt die Richtigkeit",
    });
    const kopf = "<p><em>Herkunft: außerhalb Klarwerks aufgezeichnet mit X</em></p>";
    expect(html.startsWith(kopf)).toBe(true);
    expect(html).toContain("Beobachteter Ablauf");
    const positionen = ablauf.schritte.map((s) => html.indexOf(s.text));
    expect(positionen.every((p) => p > 0)).toBe(true);
    expect([...positionen].sort((a, b) => a - b)).toEqual(positionen);
    expect(html.match(/<figure>/g)?.length).toBe(5);
    expect(html.match(/<h3>Schritt \d<\/h3>/g)?.length).toBe(5);
  });

  it("ein Chrome-DevTools-Recorder-Export wird zu lesbaren Schritten; technische Typen entfallen", () => {
    const recorder = JSON.stringify({
      title: "Angebot speichern",
      steps: [
        { type: "setViewport", width: 1280, height: 800 },
        { type: "navigate", url: "https://test.example/angebote" },
        { type: "click", selectors: [['aria/Neues Angebot[role="button"]'], ["#neu"]] },
        { type: "change", value: "Beratung", selectors: [["aria/Position"], ["#pos"]] },
        { type: "keyDown", key: "Enter" },
        { type: "keyUp", key: "Enter" },
        { type: "click", selectors: [["text/Speichern"]] },
      ],
    });
    const { ablauf, titel } = ok(recorder, "recording.json");
    expect(titel).toBe("Angebot speichern");
    expect(ablauf.quelle.format).toBe(FORMAT_CHROME);
    expect(ablauf.quelle.werkzeug).toBe("Chrome DevTools Recorder");
    expect(ablauf.schritte.map((s) => s.text)).toEqual([
      "Öffne https://test.example/angebote",
      "Klicke auf „Neues Angebot“",
      "Gib „Beratung“ in „Position“ ein",
      "Drücke Enter",
      "Klicke auf „Speichern“",
    ]);
    expect(ablauf.schritte.every((s) => s.bild === undefined)).toBe(true);
  });
});

describe("K2 · ändern, verschieben, löschen", () => {
  it("jede Operation liefert einen neuen, konsistenten Ablauf", () => {
    const { ablauf } = ok(BEISPIEL);
    const geaendert = schrittTextAendern(ablauf, "s2", "Kunde „Testkunde A“ auswählen.");
    expect(geaendert.schritte[1]?.text).toBe("Kunde „Testkunde A“ auswählen.");
    expect(ablauf.schritte[1]?.text).not.toBe(geaendert.schritte[1]?.text);

    const verschoben = schrittVerschieben(geaendert, "s4", -1);
    expect(verschoben.schritte.map((s) => s.id)).toEqual(["s1", "s2", "s4", "s3", "s5"]);
    expect(schrittVerschieben(verschoben, "s1", -1)).toBe(verschoben);
    expect(schrittVerschieben(verschoben, "s5", 1)).toBe(verschoben);

    const geloescht = schrittEntfernen(verschoben, "s3");
    expect(geloescht.schritte.map((s) => s.id)).toEqual(["s1", "s2", "s4", "s5"]);
    expect(pruefeSchritte(geloescht.schritte)).toBeNull();

    const ohneBild = schrittBildSetzen(geloescht, "s1", undefined);
    expect("bild" in (ohneBild.schritte[0] ?? {})).toBe(false);
    expect(ohneBild.quelle).toEqual(ablauf.quelle);
  });
});

describe("K4 · Schwärzen in Texten hinterlässt keine Kopie", () => {
  it("jede Fundstelle wird ersetzt — im Ablauf und im erzeugten Rumpf steht die Angabe nicht mehr", () => {
    const { ablauf } = ok(BEISPIEL);
    const { ablauf: neu, treffer } = schwaerzeInSchritten(ablauf, "musterfirma beispiel gmbh");
    expect(treffer).toBe(1);
    expect(neu.schritte[1]?.text).toBe(`Kunde „${SCHWAERZUNG}“ auswählen.`);
    const html = ablaufZuRumpf(neu, { schritt: (n) => `S${n}`, herkunft: "h", hinweis: "x" });
    expect(JSON.stringify(neu)).not.toMatch(/Musterfirma/i);
    expect(html).not.toMatch(/Musterfirma/i);
  });

  it("Nacharbeit 4: derselbe Begriff in Schritt UND Herkunft wird überall geschwärzt; die externe Kennzeichnung bleibt", () => {
    const roh = JSON.parse(BEISPIEL) as Record<string, unknown>;
    const datei = JSON.stringify({
      ...roh,
      werkzeug: "Musterfirma Rekorder",
      anwendung: "Musterfirma Angebotsportal",
    });
    const { ablauf } = ok(datei, "Musterfirma-Angebot.json");
    expect(JSON.stringify(ablauf.quelle)).toMatch(/Musterfirma/);

    const { ablauf: neu, treffer } = schwaerzeInSchritten(ablauf, "Musterfirma");
    // 1× Schritt 2, 1× Werkzeug, 1× Datei, 1× Anwendung.
    expect(treffer).toBe(4);
    expect(neu.quelle).toEqual({
      art: "import",
      format: FORMAT_KLARWERK,
      werkzeug: `${SCHWAERZUNG} Rekorder`,
      datei: `${SCHWAERZUNG}-Angebot.json`,
      aufgezeichnetAm: "2026-10-05T09:12:00Z",
      anwendung: `${SCHWAERZUNG} Angebotsportal`,
    });
    // Der Rumpf wird wie auf der Seite aus der (geschwärzten) Herkunft gebildet.
    const html = ablaufZuRumpf(neu, {
      schritt: (n) => `S${n}`,
      herkunft: `Außerhalb Klarwerks aufgezeichnet mit ${neu.quelle.werkzeug}, Datei: ${neu.quelle.datei}, Anwendung: ${neu.quelle.anwendung}`,
      hinweis: "x",
    });
    expect(JSON.stringify(neu)).not.toMatch(/Musterfirma/i);
    expect(html).not.toMatch(/Musterfirma/i);
    expect(html).toContain("Außerhalb Klarwerks aufgezeichnet mit");
  });
});

describe("K5 · unvollständiger oder nicht unterstützter Import → benannter Fehler, keine Anleitung", () => {
  const basis = JSON.parse(BEISPIEL) as Record<string, unknown> & {
    schritte: Record<string, unknown>[];
  };
  const mit = (aenderung: (b: typeof basis) => unknown) =>
    lies(JSON.stringify(aenderung(JSON.parse(JSON.stringify(basis)) as typeof basis)));
  const recorder = (steps: Record<string, unknown>[]) =>
    lies(JSON.stringify({ title: "Test", steps }));

  it.each([
    ["kein JSON", () => lies("{ kaputt"), { code: "kein_json" }],
    [
      "fremdes Format",
      () => lies(JSON.stringify({ format: "tango/2" })),
      { code: "format_unbekannt", detail: "tango/2" },
    ],
    ["Werkzeug fehlt", () => mit((b) => ({ ...b, werkzeug: " " })), { code: "werkzeug_fehlt" }],
    ["keine Schritte", () => mit((b) => ({ ...b, schritte: [] })), { code: "keine_schritte" }],
    [
      "Schritt 3 ohne Text",
      () =>
        mit((b) => {
          (b.schritte[2] as Record<string, unknown>).text = "";
          return b;
        }),
      { code: "schritt_ohne_text", schritt: 3 },
    ],
    [
      "SVG statt Rasterbild",
      () =>
        mit((b) => {
          (b.schritte[1] as Record<string, unknown>).bild = "data:image/svg+xml;base64,PHN2Zz4=";
          return b;
        }),
      { code: "bild_ungueltig", schritt: 2 },
    ],
    [
      "Bild als Fremdadresse",
      () =>
        mit((b) => {
          (b.schritte[0] as Record<string, unknown>).bild = "https://fremd.example/bild.png";
          return b;
        }),
      { code: "bild_ungueltig", schritt: 1 },
    ],
    [
      "zu viele Schritte",
      () => mit((b) => ({ ...b, schritte: Array.from({ length: 101 }, () => ({ text: "x" })) })),
      { code: "zu_viele_schritte", detail: String(ABLAUF_GRENZEN.schritte) },
    ],
    [
      "unbekannter Recorder-Schritt",
      () =>
        lies(
          JSON.stringify({
            title: "t",
            steps: [
              { type: "navigate", url: "https://a" },
              { type: "customStep", name: "x" },
            ],
          }),
        ),
      { code: "schritttyp_unbekannt", schritt: 2, detail: "customStep" },
    ],
    // Nacharbeit 4 (Ben, K5): bekannte Recorder-Typen ohne ihre Pflichtangabe. Vorher entstand aus
    // `{"type":"navigate"}` der gültig aussehende Schritt „Öffne ".
    [
      "Recorder: navigate ohne Adresse",
      () => recorder([{ type: "navigate" }]),
      { code: "schritt_unvollstaendig", schritt: 1, detail: "url" },
    ],
    [
      "Recorder: navigate mit leerer Adresse",
      () => recorder([{ type: "navigate", url: "  " }]),
      { code: "schritt_unvollstaendig", schritt: 1, detail: "url" },
    ],
    [
      "Recorder: click ohne Ziel (Position zählt technische Schritte mit)",
      () => recorder([{ type: "setViewport" }, { type: "click" }]),
      { code: "schritt_unvollstaendig", schritt: 2, detail: "selectors" },
    ],
    [
      "Recorder: doubleClick mit leeren Selektoren",
      () => recorder([{ type: "doubleClick", selectors: [[]] }]),
      { code: "schritt_unvollstaendig", schritt: 1, detail: "selectors" },
    ],
    [
      "Recorder: change ohne Ziel",
      () => recorder([{ type: "change", value: "Beratung" }]),
      { code: "schritt_unvollstaendig", schritt: 1, detail: "selectors" },
    ],
    [
      "Recorder: change ohne Wert",
      () => recorder([{ type: "change", selectors: [["aria/Position"]] }]),
      { code: "schritt_unvollstaendig", schritt: 1, detail: "value" },
    ],
    [
      "Recorder: keyDown ohne Taste",
      () => recorder([{ type: "navigate", url: "https://a" }, { type: "keyDown" }]),
      { code: "schritt_unvollstaendig", schritt: 2, detail: "key" },
    ],
    [
      "Recorder: zu langer Handlungstext wird abgewiesen, nicht gekürzt",
      () => recorder([{ type: "navigate", url: `https://a.example/${"x".repeat(2100)}` }]),
      { code: "schritt_zu_lang", schritt: 1 },
    ],
    [
      "klarwerk-ablauf/1: zu langer Handlungstext",
      () =>
        mit((b) => {
          (b.schritte[3] as Record<string, unknown>).text = "y".repeat(ABLAUF_GRENZEN.text + 1);
          return b;
        }),
      { code: "schritt_zu_lang", schritt: 4 },
    ],
  ])("%s", (_name, aufruf, fehler) => {
    const e = aufruf();
    expect(e.ok).toBe(false);
    expect(e.ok ? null : e.fehler).toEqual(fehler);
    expect("ablauf" in e).toBe(false);
  });

  it("zu große Bilder in Summe werden auch nach einer Bearbeitung erkannt", () => {
    const { ablauf } = ok(BEISPIEL);
    const gross = `data:image/png;base64,${"A".repeat(1_100_000)}`;
    const a = schrittBildSetzen(schrittBildSetzen(ablauf, "s1", gross), "s2", gross);
    expect(pruefeSchritte(a.schritte)).toEqual({ code: "bilder_zu_gross" });
    expect(pruefeSchritte(schrittBildSetzen(ablauf, "s1", PNG).schritte)).toBeNull();
  });
});

describe("K6 · derselbe Übernahmevorgang ergibt denselben Schlüssel", () => {
  it("gleicher Inhalt + gleiches Konto → gleicher Schlüssel; anderes Konto oder anderer Inhalt → anderer", async () => {
    const a = await uebernahmeSchluessel(BEISPIEL, "konto-1");
    expect(a).toMatch(/^ablauf-[0-9a-f]{40}$/);
    expect(await uebernahmeSchluessel(BEISPIEL, "konto-1")).toBe(a);
    expect(await uebernahmeSchluessel(BEISPIEL, "konto-2")).not.toBe(a);
    expect(await uebernahmeSchluessel(`${BEISPIEL} `, "konto-1")).not.toBe(a);
    // Der Einreichschlüssel passt in das Muster der Vorgangskennung des Wissensobjekts.
    expect(einreichSchluessel(a)).toMatch(/^[A-Za-z0-9_:.-]{8,120}$/);
  });
});
