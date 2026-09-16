// ================================================================================================
// JOB 4154 · F7 — GLEICHER HASH HEISST UNVERÄNDERT. NICHT RICHTIG.
// ================================================================================================
//
// Startvertrag, Abschnitt „Festgehaltener Prüfstand", wörtlich:
//   „Ein gleicher Hash bestaetigt Unveraendertheit, nicht Richtigkeit."
//   „Unbekannte Auswirkungen bleiben sichtbar und erfordern fachliche Klaerung; kein automatischer
//    Nachweis reduzierten Pruefumfangs."
//
// ZWEI GETRENNTE ZUSAGEN, und die zweite ist die, die im Alltag verloren geht:
//   1. Die VOKABEL. Das Ergebnis heisst `unveraendert`. Es heisst nicht `richtig`, nicht `geprueft`,
//      nicht `bestaetigt`, nicht `ok`. Wer das vierte Wort einführt, führt eine Behauptung ein.
//   2. `unbekannt` IST EIN EIGENER WERT und wird nie zu `unveraendert` zusammengefasst. Ein
//      Vergleich, der nicht bestimmbare Auswirkungen wegrundet, liefert „alles in Ordnung", wo
//      niemand etwas festgestellt hat — das ist der „automatische Nachweis reduzierten
//      Prüfumfangs", den der Vertrag ausdrücklich verbietet.
//
// GEGENPROBE: In `staendeVergleichen` die Gesamtableitung so ändern, dass `unbekannt` mitgezählt
// wird wie `unveraendert` (also `gesamt = befunde.some(geaendert) ? "geaendert" : "unveraendert"`).
// Dann werden die Fälle „unbekannt bleibt unbekannt" und „unbekannte werden gezählt" rot.
import { describe, expect, it } from "vitest";
import {
  inhaltAusFassung,
  staendeVergleichen,
} from "../../services/knowledge-object/src/gesamtanweisung-service";
import type { AnweisungStandAufnahme } from "../../services/knowledge-object/src/gesamtanweisung-types";
import { bauDienst, eintrag, sichtbarAls } from "./pruefstand";

const WER = sichtbarAls({ id: "anna", darfPruefen: true });

function aufnahme(
  version: number,
  bausteine: AnweisungStandAufnahme["bausteine"],
): AnweisungStandAufnahme {
  return {
    anweisungId: "a-1",
    version,
    aufgenommenAm: `2026-09-15T1${version}:00:00.000Z`,
    titel: "Wartung",
    zweck: "",
    geltungsbereich: "Werk 1",
    voraussetzungen: "",
    bausteine,
  };
}

describe("F7 · gleicher Hash ist kein Richtigkeitsnachweis", () => {
  it("identischer Nachweis ⇒ das Ergebnis heisst `unveraendert`", async () => {
    const eintraege = [
      eintrag({ id: "ko-1", version: 1 }, [{ version: 1, bodyHtml: "<p>Text</p>" }]),
    ];
    const { dienst } = bauDienst(eintraege);
    const a = await dienst.anlegen({ titel: "Wartung" }, "anna");
    const mit = await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-1", koVersion: 1, nachweisHash: "derselbe-hash" },
      WER,
    );
    // Ein Schreibvorgang ohne inhaltliche Änderung: dieselbe Folge noch einmal setzen.
    const nochmal = await dienst.reihenfolgeSetzen(
      a.id,
      mit.version,
      mit.bausteine.map((b) => b.id),
      WER,
    );
    const vergleich = await dienst.vergleichen(a.id, mit.version, nochmal.version, WER);

    expect(vergleich.gesamt).toBe("unveraendert");
    const draht = JSON.stringify(vergleich);
    expect(draht).not.toContain("richtig");
    expect(draht).not.toContain("geprüft");
    expect(draht).not.toContain("geprueft");
    expect(draht).not.toContain("bestätigt");
    expect(draht).not.toContain("bestaetigt");
  });

  it("der Hinweis sagt es ausdrücklich: unverändert ist keine Aussage über Richtigkeit", () => {
    const baustein = {
      id: "b-1",
      position: 0,
      koId: "ko-1",
      koVersion: 1,
      nachweisHash: "gleich",
      voraussetzung: null,
      // Bewusst UNBESTIMMTER Inhalt: der Nachweis allein trägt die Aussage.
      inhalt: { tabellenUeberschriften: null, abbildungen: null, geltung: null },
    } as const;
    const vergleich = staendeVergleichen(aufnahme(1, [baustein]), aufnahme(2, [baustein]));

    expect(vergleich.gesamt).toBe("unveraendert");
    expect(vergleich.unbekannte).toBe(0);
    const inhaltsbefund = vergleich.befunde.find((b) => b.feld === "abbildungen");
    expect(inhaltsbefund?.hinweis).toContain("keine Aussage über Richtigkeit");
  });

  it("OHNE Nachweis bleibt eine unbestimmbare Auswirkung `unbekannt`", () => {
    const ohneHash = {
      id: "b-1",
      position: 0,
      koId: "ko-1",
      koVersion: 1,
      nachweisHash: null,
      voraussetzung: null,
      inhalt: { tabellenUeberschriften: null, abbildungen: null, geltung: null },
    } as const;
    const vergleich = staendeVergleichen(aufnahme(1, [ohneHash]), aufnahme(2, [ohneHash]));

    expect(vergleich.gesamt).toBe("unbekannt");
    expect(vergleich.gesamt).not.toBe("unveraendert");
    expect(vergleich.unbekannte).toBe(3);
    expect(
      vergleich.befunde
        .filter((b) => b.auswirkung === "unbekannt")
        .map((b) => b.feld)
        .sort(),
    ).toEqual(["abbildungen", "geltung", "tabellenueberschriften"]);
  });

  it("`geaendert` schlägt `unbekannt` — die stärkere Warnung gewinnt, die Zahl bleibt", () => {
    const a = {
      id: "b-1",
      position: 0,
      koId: "ko-1",
      koVersion: 1,
      nachweisHash: null,
      voraussetzung: null,
      inhalt: { tabellenUeberschriften: null, abbildungen: ["bild-a"], geltung: null },
    } as const;
    const b = {
      ...a,
      inhalt: { tabellenUeberschriften: null, abbildungen: ["bild-b"], geltung: null },
    } as const;
    const vergleich = staendeVergleichen(aufnahme(1, [a]), aufnahme(2, [b]));

    expect(vergleich.gesamt).toBe("geaendert");
    // Die unbestimmbaren Befunde verschwinden dabei NICHT.
    expect(vergleich.unbekannte).toBe(2);
  });

  it("eine LEERE Menge ist etwas anderes als eine unbekannte", () => {
    // Der Anzeigevertrag: „unbekannter Prüfumfang bleibt ‚Umfang nicht belegt'" — null ≠ 0.
    const ohneRumpf = inhaltAusFassung({ category: "Werk 1" });
    expect(ohneRumpf.abbildungen).toBeNull();
    expect(ohneRumpf.tabellenUeberschriften).toBeNull();
    expect(ohneRumpf.geltung).toBe("Werk 1");

    const leererRumpf = inhaltAusFassung({ bodyHtml: "<p>Nur Text.</p>", category: "Werk 1" });
    expect(leererRumpf.abbildungen).toEqual([]);
    expect(leererRumpf.tabellenUeberschriften).toEqual([]);

    const ohneAlles = inhaltAusFassung(null);
    expect(ohneAlles.geltung).toBeNull();
  });

  it("Tabellenüberschriften, Abbildungen und Geltung zählen wirklich zum Vergleich", () => {
    const mitTabelle = inhaltAusFassung({
      bodyHtml: '<table><tr><th>Druck</th><th>Zeit</th></tr></table><img alt="Schema" src="x">',
      category: "Werk 1",
    });
    expect(mitTabelle.tabellenUeberschriften).toEqual(["Druck", "Zeit"]);
    expect(mitTabelle.abbildungen).toEqual(["Schema"]);

    const umbenannt = inhaltAusFassung({
      bodyHtml: '<table><tr><th>Druck</th><th>Dauer</th></tr></table><img alt="Schema" src="x">',
      category: "Werk 2",
    });

    const basis = {
      id: "b-1",
      position: 0,
      koId: "ko-1",
      koVersion: 1,
      nachweisHash: null,
      voraussetzung: null,
    } as const;
    const vergleich = staendeVergleichen(
      aufnahme(1, [{ ...basis, inhalt: mitTabelle }]),
      aufnahme(2, [{ ...basis, inhalt: umbenannt }]),
    );

    const felder = vergleich.befunde.filter((b) => b.auswirkung === "geaendert").map((b) => b.feld);
    expect(felder).toContain("tabellenueberschriften");
    expect(felder).toContain("geltung");
    expect(vergleich.befunde.find((b) => b.feld === "abbildungen")?.auswirkung).toBe(
      "unveraendert",
    );
  });
});
