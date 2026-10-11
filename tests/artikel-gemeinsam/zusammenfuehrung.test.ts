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
//   Z6  Artikelinhalt als HTML-Rumpf (Nacharbeit 5): Klartext hin und zurück unverändert; reiche
//       Rümpfe werden in Blöcke zerlegt, bleiben vollständig und lassen sich zusammenführen (K2/K4)
//   Z7  Gegenprobe: ein „Zusammenführen", das blind die eigene Fassung nimmt, besteht Z1 nicht.
import { describe, expect, it } from "vitest";
import {
  artikelRumpf,
  bloecke,
  fuehreStaendeZusammen,
  fuehreWertZusammen,
  fuehreZusammen,
  normalisiereRumpf,
  rumpfAusText,
  textAusRumpf,
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
    const rumpf = rumpfAusText(BASIS.join("\n\n"));
    const stand = fuehreStaendeZusammen(
      { titel: "Ventil X", rumpf },
      { titel: "A", rumpf },
      { titel: "B", rumpf },
    );
    expect(stand.ok).toBe(false);
  });

  it("Nacharbeit 7: nur der Inhalt in Konflikt — der fremd geänderte Titel kommt als titelGeloest mit", () => {
    const basis = { titel: "Ventil X", rumpf: rumpfAusText(BASIS.join("\n\n")) };
    const meine = { titel: "Ventil X", rumpf: rumpfAusText([B0, "Meins.", B2].join("\n\n")) };
    const deren = {
      titel: "Ventil X — Anlage 1",
      rumpf: rumpfAusText([B0, "Deins.", B2].join("\n\n")),
    };
    const stand = fuehreStaendeZusammen(basis, meine, deren);
    expect(stand.ok).toBe(false);
    expect(stand).toMatchObject({ titel: null, titelGeloest: "Ventil X — Anlage 1" });
    // Steht auch der Titel in Konflikt, gibt es keinen zusammengeführten.
    const beide = fuehreStaendeZusammen(basis, { ...meine, titel: "A" }, deren);
    expect(beide).toMatchObject({ titelGeloest: null });
  });
});

describe("Z6 · Artikelinhalt als HTML-Rumpf (Nacharbeit 5: einheitlicher Editor)", () => {
  it("ohne Rumpf wird die Aussage zu Absätzen; der Klartext bleibt dabei gleich", () => {
    const rumpf = artikelRumpf({
      statement: "Erster Satz.\n\n\n  Zweiter Satz.  ",
      bodyHtml: null,
    });
    expect(bloecke(rumpf)).toHaveLength(2);
    expect(textAusRumpf(rumpf)).toBe("Erster Satz.\n\nZweiter Satz.");
  });

  it("Klartext mit Sonderzeichen und Umbruch geht über den Rumpf unverändert hin und zurück", () => {
    const text = 'Druck < 2 bar & „sicher“.\nZweite Zeile.\n\nNächster Absatz mit "Zitat".';
    const rumpf = rumpfAusText(text);
    expect(bloecke(rumpf)).toHaveLength(2);
    expect(textAusRumpf(rumpf)).toBe(text);
    // Derselbe Inhalt ergibt dieselben Zeichen — gleich, ob er schon kanonisch war oder nicht.
    expect(normalisiereRumpf(rumpf)).toBe(rumpf);
    expect(uebernahmeAenderung({ titel: "T", rumpf })).toEqual({
      title: "T",
      statement: text,
      bodyHtml: rumpf,
    });
  });

  it("ein reicher Rumpf (Überschrift, Liste, Tabelle, Formatierung) wird in Blöcke zerlegt und bleibt vollständig", () => {
    const roh = [
      "<h2>Kopf</h2>",
      "<p>Text mit <strong>fett</strong> und <em>kursiv</em>.</p>",
      "<ul><li>a</li><li>b</li></ul>",
      "<table><tbody><tr><td>x</td><td>y</td></tr></tbody></table>",
    ].join("\n");
    const rumpf = normalisiereRumpf(roh);
    const teile = bloecke(rumpf);
    expect(teile).toHaveLength(4);
    expect(teile[0]).toContain("Kopf");
    expect(teile[1]).toContain("<strong>fett</strong>");
    expect(teile[2]).toContain("<li>b</li>");
    expect(teile[3]).toContain("<td>y</td>");
    expect(teile.join("")).toBe(rumpf);
    expect(artikelRumpf({ statement: "Aussage", bodyHtml: roh })).toBe(rumpf);
  });

  it("verschachtelte Listen sind EIN Block; leere Elemente (Zeilenumbruch, Bild) zerlegen nichts", () => {
    const html = "<ul><li>a<ul><li>a1</li></ul></li><li>b</li></ul><p>x<br>y</p>";
    expect(bloecke(html)).toEqual([
      "<ul><li>a<ul><li>a1</li></ul></li><li>b</li></ul>",
      "<p>x<br>y</p>",
    ]);
  });

  it("Änderungen an Liste und Absatz eines reichen Rumpfs werden zusammengeführt", () => {
    const basis = ["<h2>Kopf</h2>", "<p>Text.</p>", "<ul><li>a</li></ul>"];
    const meine = ["<h2>Kopf</h2>", "<p>Text, ergänzt.</p>", "<ul><li>a</li></ul>"];
    const deren = ["<h2>Kopf</h2>", "<p>Text.</p>", "<ul><li>a</li><li>b</li></ul>"];
    expect(fuehreZusammen(basis, meine, deren).ergebnis).toEqual([
      "<h2>Kopf</h2>",
      "<p>Text, ergänzt.</p>",
      "<ul><li>a</li><li>b</li></ul>",
    ]);
  });
});

describe("Z7 · Gegenprobe", () => {
  it("ein Zusammenführen, das blind die eigene Fassung nimmt, besteht Z1 nicht", () => {
    const blind = (_basis: string[], meine: string[], _deren: string[]): string[] => meine;
    const ergebnis = blind(BASIS, [B0_ANNA, B1, B2], [B0, B1, B2_BERND]);
    expect(() => pruefeBeideAenderungen(ergebnis)).toThrow();
  });
});
