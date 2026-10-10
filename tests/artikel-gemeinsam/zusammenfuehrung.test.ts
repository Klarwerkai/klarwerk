// ================================================================================================
// ARTIKEL-GEMEINSAM · DIE DREI-WEGE-ZUSAMMENFÜHRUNG UND DER ARTIKELTEXT (K2, K4).
// ================================================================================================
//
// Gemessen an den reinen Funktionen aus `services/app/src/gemeinsamer-entwurf.ts`:
//   Z1  verschiedene Abschnitte → beide Änderungen im Ergebnis (K2)
//   Z2  derselbe Abschnitt verschieden → Konflikt mit Basis/meine/deren, kein Ergebnis (K2)
//   Z3  derselbe Abschnitt gleich geändert → einmal, kein Konflikt (K2)
//   Z4  Einfügen und Löschen an verschiedenen Stellen → beides (K2)
//   Z5  Titel: eine Seite ändert → übernommen; beide verschieden → Konflikt (K2)
//   Z6  Artikeltext ↔ Rumpf: einfacher Rumpf hin und zurück unverändert; reicher Rumpf wird
//       erkannt und nicht zerlegt (K4, kein stilles Entfernen)
//   Z7  Gegenprobe: ein „Zusammenführen", das blind die eigene Fassung nimmt, besteht Z1 nicht.
import { describe, expect, it } from "vitest";
import {
  abschnitte,
  artikelText,
  fuehreStaendeZusammen,
  fuehreWertZusammen,
  fuehreZusammen,
  rumpfAusText,
  uebernahmeAenderung,
} from "../../services/app/src/gemeinsamer-entwurf";

const B0 = "Einleitung zum Ventil.";
const B1 = "Schritt 1: Druck ablassen.";
const B2 = "Schritt 2: Ventil schließen.";
const BASIS = [B0, B1, B2];
const B0_ANNA = "Einleitung zum Ventil — Anlage 1.";
const B2_BERND = "Schritt 2: Ventil langsam schließen.";

/** Die Zusage von Z1 als Funktion — Z7 sieht sie an einem blinden Zusammenführen scheitern. */
function pruefeBeideAenderungen(ergebnis: string[] | null): void {
  expect(ergebnis).toEqual([B0_ANNA, B1, B2_BERND]);
}

describe("Z1 · verschiedene Abschnitte", () => {
  it("die Änderung von Anna (oben) und Bernd (unten) stehen beide im Ergebnis", () => {
    const anna = [B0_ANNA, B1, B2];
    const bernd = [B0, B1, B2_BERND];
    const z = fuehreZusammen(BASIS, anna, bernd);
    expect(z.konflikte).toBe(0);
    pruefeBeideAenderungen(z.ergebnis);
    // Die Reihenfolge der Seiten ist egal.
    pruefeBeideAenderungen(fuehreZusammen(BASIS, bernd, anna).ergebnis);
  });
});

describe("Z2 · derselbe Abschnitt verschieden", () => {
  it("ergibt einen Konflikt mit allen drei Fassungen — und kein Ergebnis", () => {
    const annas = "Schritt 1: Druck VOLLSTÄNDIG ablassen.";
    const bernds = "Schritt 1: Druck über Ventil Y ablassen.";
    const z = fuehreZusammen(BASIS, [B0, annas, B2], [B0, bernds, B2]);
    expect(z.ergebnis).toBeNull();
    expect(z.konflikte).toBe(1);
    expect(z.teile).toEqual([
      { art: "geloest", abschnitte: [B0] },
      { art: "konflikt", basis: [B1], meine: [annas], deren: [bernds] },
      { art: "geloest", abschnitte: [B2] },
    ]);
  });

  it("Löschen gegen Ändern desselben Abschnitts ist ebenfalls ein Konflikt", () => {
    const bernds = "Schritt 1: Druck langsam ablassen.";
    const z = fuehreZusammen(BASIS, [B0, B2], [B0, bernds, B2]);
    expect(z.konflikte).toBe(1);
    expect(z.teile[1]).toEqual({ art: "konflikt", basis: [B1], meine: [], deren: [bernds] });
  });
});

describe("Z3 · dieselbe Änderung auf beiden Seiten", () => {
  it("zählt einmal", () => {
    const gleich = [B0, "Schritt 1: Druck sicher ablassen.", B2];
    const z = fuehreZusammen(BASIS, gleich, [...gleich]);
    expect(z.konflikte).toBe(0);
    expect(z.ergebnis).toEqual(gleich);
  });
});

describe("Z4 · Einfügen und Löschen an verschiedenen Stellen", () => {
  it("ein neuer Abschnitt am Ende und ein gelöschter Abschnitt vorn ergeben beides", () => {
    const neu = "Schritt 3: Dichtheit prüfen.";
    const z = fuehreZusammen(BASIS, [...BASIS, neu], [B1, B2]);
    expect(z.konflikte).toBe(0);
    expect(z.ergebnis).toEqual([B1, B2, neu]);
  });
});

describe("Z4b · benachbarte Abschnitte ohne gemeinsamen Anker (Nacharbeit 2, Befund S5)", () => {
  it("die eine Seite ändert Abschnitt 1 und 2, die andere Abschnitt 3 → zusammengeführt", () => {
    const b0Neu = "Einleitung — neu.";
    const b1Neu = "Schritt 1: Druck sofort ablassen.";
    const deren = [b0Neu, b1Neu, B2];
    const meine = [B0, B1, B2_BERND];
    const z = fuehreZusammen(BASIS, meine, deren);
    expect(z.konflikte).toBe(0);
    expect(z.ergebnis).toEqual([b0Neu, b1Neu, B2_BERND]);
    // Und andersherum.
    expect(fuehreZusammen(BASIS, deren, meine).ergebnis).toEqual(z.ergebnis);
  });

  it("zwei verschiedene Einfügungen an derselben Stelle bleiben ein Konflikt", () => {
    const z = fuehreZusammen(BASIS, [B0, "A neu.", B1, B2], [B0, "B neu.", B1, B2]);
    expect(z.ergebnis).toBeNull();
    expect(z.teile).toEqual([
      { art: "geloest", abschnitte: [B0] },
      { art: "konflikt", basis: [], meine: ["A neu."], deren: ["B neu."] },
      { art: "geloest", abschnitte: [B1, B2] },
    ]);
  });
});

describe("Z5 · der Titel", () => {
  it("eine Seite ändert ihn → übernommen; beide verschieden → Konflikt", () => {
    expect(fuehreWertZusammen("Ventil X", "Ventil X (Anlage 1)", "Ventil X")).toEqual({
      wert: "Ventil X (Anlage 1)",
    });
    expect(fuehreWertZusammen("Ventil X", "Ventil X", "Ventil X neu")).toEqual({
      wert: "Ventil X neu",
    });
    expect(fuehreWertZusammen("Ventil X", "A", "B")).toEqual({
      konflikt: { basis: "Ventil X", meine: "A", deren: "B" },
    });
    const text = BASIS.join("\n\n");
    const stand = fuehreStaendeZusammen(
      { titel: "Ventil X", text },
      { titel: "A", text },
      { titel: "B", text },
    );
    expect(stand.ok).toBe(false);
  });
});

describe("Z6 · Artikeltext und Rumpf", () => {
  it("ohne Rumpf ist die Aussage der Text; Abschnitte werden normalisiert", () => {
    const t = artikelText({ statement: "Erster Satz.\n\n\n  Zweiter Satz.  ", bodyHtml: null });
    expect(t).toEqual({ text: "Erster Satz.\n\nZweiter Satz.", rumpf: "keiner" });
    expect(abschnitte(t.text)).toHaveLength(2);
  });

  it("ein einfacher Rumpf geht hin und zurück unverändert — mit Sonderzeichen und Umbruch", () => {
    const text = 'Druck < 2 bar & „sicher“.\nZweite Zeile.\n\nNächster Absatz mit "Zitat".';
    const rumpf = rumpfAusText(text);
    expect(rumpf).toBe(
      [
        "<p>Druck &lt; 2 bar &amp; „sicher“.<br>Zweite Zeile.</p>",
        "<p>Nächster Absatz mit &quot;Zitat&quot;.</p>",
      ].join(""),
    );
    expect(artikelText({ statement: "egal", bodyHtml: rumpf })).toEqual({ text, rumpf: "einfach" });
    // Auch die Schreibweise `<br />` und numerische Entitäten werden gelesen.
    const anders = artikelText({ statement: "", bodyHtml: "<p>a<br />b &#39;c&#x27;</p>" });
    expect(anders.text).toBe("a\nb 'c'");
    expect(uebernahmeAenderung({ titel: "T", text }, "einfach")).toEqual({
      title: "T",
      statement: text,
      bodyHtml: rumpf,
    });
    expect(uebernahmeAenderung({ titel: "T", text }, "keiner")).toEqual({
      title: "T",
      statement: text,
    });
  });

  it("ein reicher Rumpf (Bild, Liste, Überschrift) wird erkannt und nicht zerlegt", () => {
    for (const rumpf of [
      '<p>Text</p><img src="/api/objects/x/raw">',
      "<ul><li>a</li></ul>",
      "<h2>Kopf</h2><p>Text</p>",
      "<p><strong>fett</strong></p>",
    ]) {
      expect(artikelText({ statement: "Aussage", bodyHtml: rumpf }).rumpf).toBe("reich");
    }
  });
});

describe("Z7 · Gegenprobe", () => {
  it("ein Zusammenführen, das blind die eigene Fassung nimmt, besteht Z1 nicht", () => {
    const blind = (_basis: string[], meine: string[], _deren: string[]): string[] => meine;
    const ergebnis = blind(BASIS, [B0_ANNA, B1, B2], [B0, B1, B2_BERND]);
    expect(() => pruefeBeideAenderungen(ergebnis)).toThrow();
  });
});
