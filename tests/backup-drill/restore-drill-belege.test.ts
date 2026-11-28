import { describe, expect, it } from "vitest";
import { KO, OBJ, run } from "./drill-probe";

describe("Restore-Drill: Belege und Anhangszuordnung", () => {
  // ================================================================================================
  // JOB 4097 · GLIED 7b — DER NUTZENNACHWEIS UND SEINE SAUBERE TRENNUNG
  // ================================================================================================
  //
  // Dieselbe Linie wie 60/61 gegen 70/71/72, eine Stufe weiter: Ein AUFBAUFEHLER (62) darf nie wie
  // ein BEFUND am Bestand (73) aussehen. Und der Fall „der Bestand führt gar kein Objekt mit Beleg"
  // ist WEDER das eine NOCH das andere — er wird als nicht gemessen ausgewiesen.
  it("ohne Beleg im Bestand ist der Punkt NICHT gemessen — kein Fehlschlag und kein Erfolg", () => {
    const r = run("kein-beleg");
    expect(r.code, r.output).toBe(0);
    expect(r.output).toContain("kein Wissensobjekt mit Beleg im Bestand");
    expect(r.output).toContain("NICHT gemessen");
    expect(r.output).toContain("Wissensnachweis: kein Wissensobjekt mit Beleg im Bestand");
    // Die starke Aussage darf hier NICHT dastehen.
    expect(r.output).not.toContain("Anhangsinhalt zurueckgelesen");
  }, 120_000);
  it.each([
    ["ko-weg", 73],
    ["beleg-weg", 73],
    ["anhang-weg", 73],
    ["anhang-leer", 73],
  ] as const)(
    "Befund am Bestand (%s) endet mit %i",
    (mode, code) => {
      const r = run(mode);
      expect(r.code, r.output).toBe(code);
      expect(r.output).toContain("ABBRUCH (73)");
      expect(r.output).not.toContain("DRILL BESTANDEN");
    },
    120_000,
  );
  // ================================================================================================
  // JOB 4097 · RUNDE 2 · RED-FIRST E — EIN TEXTVORKOMMEN IST KEINE ANHANGSZUORDNUNG.
  // ================================================================================================
  //
  // DIE LÜCKE, GEMESSEN (BENs Gegenproben zu Runde 1): Glied 7b prüfte die Belegantwort mit
  // `grep -qF "$OBJEKT_ID"` — ein Textvorkommen IRGENDWO in der Antwort. Alle drei Antworten unten
  // enthalten die Kennung als Text und tragen trotzdem KEINE Zuordnung; vor dieser Runde endete
  // jede von ihnen mit **Exit 0 und „DRILL BESTANDEN"**. Der Betreiber hätte gelesen, sein Beleg
  // sei zurück, während die Zuordnung Datei→Wissensobjekt fehlte.
  //
  // Gemessen wird jetzt der Datensatz, den die Datenbank genannt hat: dieselbe `id`, und an ihr
  // dieselbe `objectId`.
  it.each([
    // Die Kennung als TEIL einer anderen: `obj-4097-zwei` enthält `obj-4097`.
    ["beleg-teiltreffer", "zeigt in der Antwort NICHT auf"],
    // Die Kennung nur im `label`, der Beleg selbst ohne jede `objectId`.
    ["beleg-nur-label", "zeigt in der Antwort NICHT auf"],
    // Die Kennung an einem FREMDEN Belegdatensatz; der genannte Beleg fehlt.
    ["beleg-fremder-satz", "fuehrt den Beleg"],
  ] as const)(
    "E(4097 R2) %s ist ein BEFUND (73), kein bestandener Drill",
    (mode, satz) => {
      const r = run(mode);
      expect(r.code, r.output).toBe(73);
      expect(r.output).toContain("ABBRUCH (73)");
      expect(r.output).toContain(satz);
      expect(r.output).not.toContain("DRILL BESTANDEN");
      expect(r.output).not.toContain("Anhangsinhalt zurueckgelesen");
    },
    120_000,
  );

  // ================================================================================================
  // JOB 4097 · RUNDE 2 · RED-FIRST F — EIN BELEG OHNE SEINEN ANHANG IST EIN BEFUND, KEINE LEERE.
  // ================================================================================================
  //
  // DIE LÜCKE, GEMESSEN: Runde 1 filterte die Kandidaten über einen `JOIN objects` — eine
  // Belegzeile, deren Anhang nach dem Restore fehlt, fiel damit aus der Auswahl. Gab es nur sie,
  // meldete der Drill „kein Wissensobjekt mit Beleg im Bestand — NICHT gemessen" und endete mit 0:
  // der schlimmste Fall sah aus wie der harmloseste. Jetzt scannt Glied 7b zuerst den ganzen
  // Bestand und nennt Zahl und Beispiel.
  it("F(4097 R2) eine verwaiste Belegzeile endet mit 73 — und nie mit „nicht gemessen“", () => {
    const r = run("waise");
    expect(r.code, r.output).toBe(73);
    expect(r.output).toMatch(/ABBRUCH \(73\): 1 Belegzeile\(n\)/);
    expect(r.output).toContain(`${KO} ${OBJ}`);
    // Die harmlose Lesart darf hier NICHT stehen.
    expect(r.output).not.toContain("kein Wissensobjekt mit Beleg im Bestand");
    expect(r.output).not.toContain("NICHT gemessen");
    expect(r.output).not.toContain("DRILL BESTANDEN");
  }, 120_000);
});
