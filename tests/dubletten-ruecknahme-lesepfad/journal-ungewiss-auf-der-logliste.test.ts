// ================================================================================================
// AUFTRAG gesamt-dubletten-rueckzug · LAUF 5 (BEN-R5-4) — DER UNGEWISSE AUSGANG STEHT AUF DER
// LOGLISTE. GEPRÜFT AN DER KLASSE, NICHT AN EINER ZEICHENKETTE.
// ================================================================================================
//
// DER BEFUND (Ben, Lauf 5 Runde 3, Prüfauftrag pa-1790771019-5c5b1fe8): `JOURNAL_AUSGANG_UNGEWISS`
// (dev-persist.ts, `JournalAusgangUngewiss`) fehlte in `ERLAUBTE_FEHLERCODES`. Der Bestandswächter
// (`services/app/src/build-app.test.ts`, „jeder Domänen-Fehlercode aus services/** steht auf der
// Codeliste") hat ihn gemeldet; `erlaubterCode` bildete den Code deshalb auf `UNBEKANNT` ab — und
// die Protokollzeile zu genau der Lage, die ein Betreiber erkennen muss (der Speicher ist gerade
// weder lesbar noch beschreibbar), sagte über den Vorfall nichts.
//
// WARUM DIESE DATEI TROTZDEM NÖTIG IST: der Bestandswächter erhebt den Code aus dem QUELLTEXT
// (Setzform `code = "…"`). Er belegt „das Wort steht auf der Liste", nicht „der Fehler, den die
// Klammer wirklich wirft, geht durch den Serializer als er selbst". Dieser Fall bindet die Liste
// an die KLASSE: er baut den Fehler so, wie `mitBestaetigung` ihn wirft, und hält ihn gegen
// `erlaubterCode` und `erlaubterTyp` — die zwei Funktionen, die der `err`-Serializer aufruft.
//
// ZUM TYP: die Klasse heisst `JournalAusgangUngewiss` und endet NICHT auf `Error`; der Typ-Wächter
// (`class …Error extends`) erhebt sie deshalb nicht. Ohne Eintrag in `ERLAUBTE_FEHLERTYPEN` stünde
// `type: UNBEKANNT` neben `code: JOURNAL_AUSGANG_UNGEWISS`. Der Eintrag ist hier mitgeprüft.
import { describe, expect, it } from "vitest";
import {
  ERLAUBTE_FEHLERCODES,
  ERLAUBTE_FEHLERTYPEN,
  ERR_UNBEKANNT,
  erlaubterCode,
  erlaubterTyp,
} from "../../services/app/src/build-app";
import { JournalAusgangUngewiss } from "../../services/app/src/dev-persist";

const VORGANG = "11111111-2222-4333-8444-555555555555";

describe("Lauf 5 (BEN-R5-4) · JOURNAL_AUSGANG_UNGEWISS steht auf der Logliste", () => {
  const fehler = new JournalAusgangUngewiss(VORGANG, new Error("EIO: i/o error, write"));

  it("der Code der geworfenen Klasse steht auf `ERLAUBTE_FEHLERCODES`", () => {
    expect(fehler.code).toBe("JOURNAL_AUSGANG_UNGEWISS");
    expect(ERLAUBTE_FEHLERCODES.has(fehler.code)).toBe(true);
  });

  it("`erlaubterCode` lässt ihn durch — das ist die Zeile, die der Betreiber liest", () => {
    expect(erlaubterCode(fehler.code)).toBe("JOURNAL_AUSGANG_UNGEWISS");
    expect(erlaubterCode(fehler.code)).not.toBe(ERR_UNBEKANNT);
  });

  it("der Typname steht auf `ERLAUBTE_FEHLERTYPEN` — der Typ-Wächter erhebt die Klasse nicht", () => {
    expect(fehler.name).toBe("JournalAusgangUngewiss");
    expect(ERLAUBTE_FEHLERTYPEN.has(fehler.name)).toBe(true);
    expect(erlaubterTyp(fehler.name)).toBe("JournalAusgangUngewiss");
  });

  it("GEGENRICHTUNG: Erlaubnisliste, kein Muster — ein Nachbarname fällt durch", () => {
    // Sonst bewiese dieser Fall nur, dass `has` irgendetwas zurückgibt.
    expect(erlaubterCode("JOURNAL_AUSGANG_UNGEWISS_X")).toBe(ERR_UNBEKANNT);
    expect(erlaubterCode("JOURNAL_AUSGANG")).toBe(ERR_UNBEKANNT);
    expect(erlaubterTyp("JournalAusgangUngewissX")).toBe(ERR_UNBEKANNT);
  });

  it("erlaubt ist nur der Code — Ursache und Kennung bleiben Felder (BEN-R5-3)", () => {
    expect(fehler.message).not.toContain("EIO");
    expect(fehler.message).not.toContain(VORGANG);
    expect(fehler.vorgang).toBe(VORGANG);
    expect((fehler as { cause?: unknown }).cause).toBeInstanceOf(Error);
  });
});
