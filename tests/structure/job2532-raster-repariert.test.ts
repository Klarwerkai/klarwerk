/**
 * JOB 2532 D1 — das reparierte Raster, am Verhalten geprüft.
 *
 * Der Auftrag verlangt in §5.2 einen Prüffall, der die Reparatur trägt. Weil die Formulierung
 * („grün mit dem alten Raster, rot mit dem neuen") in zwei Richtungen gelesen werden kann, sind
 * hier BEIDE Richtungen ausgeschrieben und einzeln benannt:
 *
 *   RICHTUNG A — der Prüffall selbst: `urteilVon` muss das Sachurteil eines Berichts erkennen,
 *     der nur in seiner `NICHT GEPRÜFT:`-Prosa ein Sperrwort trägt. Mit dem alten Raster lieferte
 *     `urteilVon` dort `sachurteil: false` — der Fall ist also die Reparatur.
 *
 *   RICHTUNG B — die Gegenmutation (§Verbindlich 3): Setzt man in `tools/urteilslage.ts` das `i`
 *     zurück, wird FALL 1 rot. Das ist im Rückgabetext mit Lauf und Hash belegt und lässt sich
 *     hier nicht als Test schreiben, ohne den Produktcode zu mutieren.
 *
 * Alle Vorlagen sind WÖRTLICH aus Berichten in `_relay/kopf/outbox/`; der Dateiname steht dabei.
 * Erfundene Vorlagen würden hier nichts belegen — der Fehler bestand ja gerade darin, dass die
 * erdachte Form (`NICHT BEURTEILT` als Feldwert) anders aussieht als die gewachsene.
 */

import { describe, expect, it } from "vitest";
import { istTeilurteil, urteilVon } from "../../tools/schon-eingebaut";
import { hatZustellsperre, sperrzeilen } from "../../tools/urteilslage";

/** Das Raster, das bis JOB 2532 in `tools/schon-eingebaut.ts` stand — als Vergleichsmaß. */
const RASTER_ALT =
  /NICHT BEURTEILT|ZUSTELLUNG UNVOLLST|KEIN SACHURTEIL|NICHT ERTEILT|NICHT ABGEGEBEN/i;

/** BEN-PRUEFUNG-JOB-1174-D1.md — durchweg grün, Sperrwort nur in Zeile 16. */
const PROSA_GRUEN = [
  "GESAMTURTEIL: GRÜN",
  "PRODUKT: GRÜN — Der Test sichert die tatsächlich gefährliche Matrixkopplung von `restore`",
  "und `trash-delete` an volle Sicht.",
  "FORM: GRÜN — Das vollständige Prüfpaket ist eindeutig an JOB 1174, BASIC, D1 und BEN gebunden.",
  "",
  "NICHT GEPRÜFT: Nicht beurteilt sind das reale Draht-/Antwortverhalten der drei Routen bei",
  "einer künftig geänderten Matrix.",
].join("\n");

/** BEN-PRUEFUNG-JOB-880-D5.md — ein hartes fachliches ROT, ebenfalls kein Sperrfall. */
const PROSA_ROT = [
  "GESAMTURTEIL: ROT",
  "PRODUKT: ROT — Trotz CODE-URTEIL GRÜN schließt D5 den fachlichen Kernmangel nicht:",
  "`freigabe.autorisiertHash` und Freigabe-ID sind frei setzbar.",
  "FORM: GRÜN — Das Paket ist vollständig auf JOB 880 · PRO5 · D5 · BEN gebunden.",
  "",
  "NICHT GEPRÜFT: Keine eigene Repo-, Clone-, Datei-, Test-, Hash-, Lease- oder CI-Messung",
  "außerhalb des zugestellten Prüfpakets. Nicht beurteilt sind spätere Durchgänge.",
].join("\n");

/**
 * BEN-PRUEFUNG-JOB-1086-D3.md — der Fall, an dem ALLEIN die Großschreibung entscheidet.
 *
 * Das Sperrwort steht hier klein („nicht erteilt"), mitten in einem echten Substanzurteil, auf
 * einer `PRODUKT:`-Zeile und außerhalb jedes Schutzabschnitts. Weder der Abschnittsschutz noch
 * die Zeilenbindung greifen — nur die Großschreibung. Deshalb ist genau diese Vorlage der
 * tragfähige Prüffall, und nicht eine, die von zwei Regeln gleichzeitig gerettet wird.
 */
const NUR_GROSSSCHREIBUNG = [
  "GESAMTURTEIL: ROT",
  "PRODUKT: ROT — Die verlangte vollständige unabhängige Zweitmeinung ist erneut nicht erteilt.",
  "Die Rückgabe stützt sich weiter auf dieselbe Quelle.",
  "FORM: GRÜN — Das Prüfpaket ist an JOB 1086 · PRO6 · D3 · BEN gebunden.",
].join("\n");

/** BEN-PRUEFUNG-JOB-1115-D1.md — eine ECHTE Sperre, die das Substanzfeld selbst trifft. */
const ECHTE_SPERRE = [
  "GESAMTURTEIL: ROT",
  "PRODUKT: ROT — KEIN SACHURTEIL: Die Substanz von JOB 1115 D1 wurde mangels prüffähigem",
  "D1-Prüfpaket nicht bewertet.",
  "FORM: ROT — ZUSTELLUNG UNVOLLSTÄNDIG; Pflichtteil 2 fehlt.",
].join("\n");

/** BEN-PRUEFUNG-JOB-2008-D2.md — Sperre nur auf der FORM-Zeile. */
const SPERRE_NUR_FORM = [
  "GESAMTURTEIL: ROT",
  "PRODUKT: ROT — Der Stand trägt die geforderte Änderung nicht.",
  "FORM: ROT — ZUSTELLUNG UNVOLLSTÄNDIG; Pflichtteil 2 des D2-Prüfpakets fehlt.",
].join("\n");

describe("JOB 2532 · RICHTUNG A — der Prüffall, der die Reparatur trägt", () => {
  it("FALL 1 — ein durchweg grüner Bericht mit Sperrwort in der Prosa trägt ein Sachurteil", () => {
    // Der Nachweis, dass das ALTE Raster hier zuschlug: es matcht, das neue nicht.
    expect(RASTER_ALT.test(PROSA_GRUEN)).toBe(true);
    expect(hatZustellsperre(PROSA_GRUEN)).toBe(false);
    expect(sperrzeilen(PROSA_GRUEN)).toEqual([]);

    // Und die Wirkung dort, wo sie gezählt wird:
    const u = urteilVon("BEN-PRUEFUNG-JOB-1174-D1.md", PROSA_GRUEN);
    expect(u.sachurteil).toBe(true);
    expect(u.spruch).toBe("GRÜN");
    expect(u.produkt).toBe("GRÜN");
  });

  it("FALL 2 — dasselbe für ein fachliches ROT: rot ist beurteilt, nicht unbeurteilt", () => {
    // Diese Verwechslung ist die teurere: Ein ROT, das als 'unbeurteilt' gilt, verschwindet aus
    // der Mängelliste, statt oben zu stehen.
    expect(RASTER_ALT.test(PROSA_ROT)).toBe(true);
    const u = urteilVon("BEN-PRUEFUNG-JOB-880-D5.md", PROSA_ROT);
    expect(u.sachurteil).toBe(true);
    expect(u.spruch).toBe("ROT");
    expect(u.produkt).toBe("ROT");
  });

  it("FALL 3 — eine echte Sperre im Substanzfeld bleibt eine Sperre", () => {
    // Die Gegenrichtung: Die Reparatur darf nicht zur Entwarnungsmaschine werden.
    expect(hatZustellsperre(ECHTE_SPERRE)).toBe(true);
    expect(urteilVon("BEN-PRUEFUNG-JOB-1115-D1.md", ECHTE_SPERRE).sachurteil).toBe(false);
  });

  it("FALL 4 — eine Sperre allein auf der FORM-Zeile sperrt ebenfalls", () => {
    expect(sperrzeilen(SPERRE_NUR_FORM)).toHaveLength(1);
    expect(urteilVon("BEN-PRUEFUNG-JOB-2008-D2.md", SPERRE_NUR_FORM).sachurteil).toBe(false);
  });

  it("FALL 5 — ein -CODE-Bericht bleibt ein Teilurteil, auch wenn die Prosa sauber ist", () => {
    expect(istTeilurteil("BEN-PRUEFUNG-JOB-1174-D1-CODE.md")).toBe(true);
    expect(urteilVon("BEN-PRUEFUNG-JOB-1174-D1-CODE.md", PROSA_GRUEN).sachurteil).toBe(false);
  });

  it("FALL 6 — KALIBRIERUNG: die beiden Raster sind an diesen Vorlagen nicht gleich", () => {
    // Ohne diesen Fall könnte die ganze Datei grün sein, weil beide Raster dasselbe tun.
    // Er misst den Unterschied selbst, statt ihn vorauszusetzen.
    const vorlagen = [PROSA_GRUEN, PROSA_ROT, NUR_GROSSSCHREIBUNG, ECHTE_SPERRE, SPERRE_NUR_FORM];
    const alt = vorlagen.map((v) => RASTER_ALT.test(v));
    const neu = vorlagen.map((v) => hatZustellsperre(v));
    expect(alt).toEqual([true, true, true, true, true]);
    expect(neu).toEqual([false, false, false, true, true]);
  });

  it("FALL 7 — die tragende Hälfte: klein geschriebenes Sperrwort auf einer Urteilszeile", () => {
    // Hier greift WEDER der Abschnittsschutz (die Zeile beginnt mit `PRODUKT:`) NOCH die
    // Zeilenbindung (das Wort steht auf einem Urteilsfeld). Allein die Großschreibung trennt.
    // Am Bestand gemessen hängen an dieser einen Hälfte 87 Berichte.
    expect(NUR_GROSSSCHREIBUNG).toContain("nicht erteilt");
    expect(NUR_GROSSSCHREIBUNG).not.toContain("NICHT ERTEILT");
    expect(sperrzeilen(NUR_GROSSSCHREIBUNG)).toEqual([]);
    const u = urteilVon("BEN-PRUEFUNG-JOB-1086-D3.md", NUR_GROSSSCHREIBUNG);
    expect(u.sachurteil).toBe(true);
    expect(u.produkt).toBe("ROT");
  });
});
