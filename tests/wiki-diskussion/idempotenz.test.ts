// ================================================================================================
// JOB 4146 · VERTRAG FALL 5 (aus HINWEIS.md, Runde 1) — WIEDERHOLEN ERZEUGT KEINEN ZWEITEN BEITRAG
// ================================================================================================
//
// DER VERTRAG: „Speichern unterbrochen, anschließend wiederholt: Eingabe erhalten und Ergebnis
// eindeutig; keine still verlorene bestätigte Arbeit. … Wiederholung nach unklarer Übertragung darf
// keinen unbeabsichtigten Doppelbeitrag erzeugen; Idempotenzumfang im Produktpaket festlegen."
//
// DER FESTGELEGTE UMFANG, und er steht hier, weil der Vertrag ihn verlangt: ein vom Client gebildeter
// BEITRAGSSCHLÜSSEL (`clientKey`), den die Route je Wissensobjekt und Verfasser genau EINMAL annimmt.
// Bauform wie die Vorgangskennung der Dokumentübernahme (`KoAppendOp`, types.ts:246): reiner
// Deduplizierungsschlüssel OHNE Autorität — er entscheidet nichts, er verhindert nur das zweite
// Anfügen desselben Vorgangs.
//
// WAS ER NICHT IST: eine Sperre gegen zwei ABSICHTLICH gleiche Beiträge. Ohne Schlüssel bleibt das
// Verhalten unverändert (H3) — zweimal dasselbe schreiben darf ein Mensch.
import { describe, expect, it } from "vitest";
import { anlegen, beitraege, flaeche, konto, lesen, put } from "./huelle";

const SCHLUESSEL = "beitrag-4146-abc";

describe("JOB 4146 · Fall 5 — Idempotenz des Beitrags", () => {
  it("derselbe Beitragsschlüssel zweimal gesendet ergibt genau EINEN Beitrag", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegen(app, admin);

    const erst = await put(app, admin, ko.id, {
      action: "comment",
      text: "Gilt das auch für Linie 3?",
      clientKey: SCHLUESSEL,
    });
    const nochmal = await put(app, admin, ko.id, {
      action: "comment",
      text: "Gilt das auch für Linie 3?",
      clientKey: SCHLUESSEL,
    });

    expect(erst.statusCode).toBe(200);
    // Die Wiederholung ist KEIN Fehler: der Aufrufer weiss nicht, ob der erste Versuch ankam, und
    // bekommt dieselbe eindeutige Antwort.
    expect(nochmal.statusCode).toBe(200);
    expect(beitraege(nochmal.json())).toHaveLength(1);
    expect(beitraege(await lesen(app, admin, ko.id))).toHaveLength(1);
  });

  it("die Antwort der Wiederholung trägt denselben Beitrag — gleiche Kennung, gleicher Zeitpunkt", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegen(app, admin);
    const erst = await put(app, admin, ko.id, {
      action: "comment",
      text: "Frage.",
      clientKey: SCHLUESSEL,
    });
    const nochmal = await put(app, admin, ko.id, {
      action: "comment",
      text: "Frage.",
      clientKey: SCHLUESSEL,
    });

    expect(beitraege(nochmal.json())[0]).toEqual(beitraege(erst.json())[0]);
  });

  it("ohne Schlüssel bleibt alles wie bisher: zweimal senden ergibt zwei Beiträge", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegen(app, admin);

    await put(app, admin, ko.id, { action: "comment", text: "Frage." });
    await put(app, admin, ko.id, { action: "comment", text: "Frage." });

    expect(beitraege(await lesen(app, admin, ko.id))).toHaveLength(2);
  });

  it("ein zweiter Mensch mit demselben Schlüssel wird nicht verschluckt — der Schlüssel gehört dem Verfasser", async () => {
    const { app, admin } = await flaeche();
    const eva = await konto(app, admin, "experte", "eva@klarwerk.test");
    const ko = await anlegen(app, admin);

    await put(app, admin, ko.id, {
      action: "comment",
      text: "Frage von Pedi.",
      clientKey: SCHLUESSEL,
    });
    await put(app, eva, ko.id, {
      action: "comment",
      text: "Frage von Eva.",
      clientKey: SCHLUESSEL,
    });

    const liste = beitraege(await lesen(app, admin, ko.id));
    expect(liste.map((c) => c.text)).toEqual(["Frage von Pedi.", "Frage von Eva."]);
  });

  it("ein leerer Schlüssel ist ein Formfehler, kein stilles Weglassen des Schutzes", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegen(app, admin);

    const res = await put(app, admin, ko.id, {
      action: "comment",
      text: "Frage.",
      clientKey: "  ",
    });

    expect(res.statusCode).toBe(400);
    expect(beitraege(await lesen(app, admin, ko.id))).toEqual([]);
  });
});
