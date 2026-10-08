// @vitest-environment jsdom
// ================================================================================================
// P-WIKI-STELLENBEZUG · D2 — NACH EINER ÄNDERUNG: EINDEUTIG ZUGEORDNET ODER SICHTBAR UNKLAR
// ================================================================================================
//
// GEMESSEN wird die reine Zuordnung (`apps/web/src/lib/stellenbezug.ts`) — die Stelle, an der sich
// entscheidet, ob eine Rückfrage nach einer Änderung noch an ihrem Absatz hängt. Die Zusage der
// Anforderung: eindeutige Zuordnung ODER „nicht eindeutig — Zuordnung prüfen"; NIE still an einen
// ähnlichen Text umhängen.
//
// Z1  die Stellen einer Fassung: Absatz, Tabelle, Bild — je mit ihrem Abschnitt
// Z2  dieselbe Fassung → „in dieser Fassung"
// Z3  an anderer Stelle geändert → in der neuen Fassung eindeutig wiedergefunden
// Z4  der Absatz selbst ist geändert (ein Wort) → unklar, KEIN Treffer am ähnlichen Text
// Z5  der Absatz steht danach zweimal → unklar
// Z6  der Abschnitt wurde umbenannt → unklar (die Abschnittskennung ist Teil des Ankers)
// Z7  das Bild hängt an seinem Anker, nicht an der Beschriftung
// Z8  DIENST UND FLÄCHE SPRECHEN DIESELBE NORMALFORM: jede Stelle, die die Fläche anbietet, nimmt
//     die Prüfung des Dienstes an (auch mit Auszeichnung, Entitäten und Tabelle)
// NACHARBEIT 3 (BEN):
// Z9  ein langer Absatz, ersetzt durch einen mit denselben ersten 300 Zeichen → unklar
// Z10 zwei Absätze mit gleichem Anfang sind zwei Stellen
// Z11 der Dienst weist falsche Art-/Abschnittskombinationen und Teilzitate zurück
// Z12 Dienst und Fläche zerlegen denselben Inhalt in dieselben Blöcke
// Z13 der selbstgerechnete SHA-256 der Fläche gleicht `node:crypto`
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256Hex, stellenFingerabdruck } from "../../apps/web/src/lib/stellenabdruck";
import {
  type Stellenblock,
  stelleAus,
  stelleZuordnen,
  stellenbloecke,
} from "../../apps/web/src/lib/stellenbezug";
import {
  stelleImInhalt,
  stellenbloeckeAusHtml,
} from "../../services/knowledge-object/src/stellen-anker";
import { stellenFingerabdruck as dienstFingerabdruck } from "../../services/knowledge-object/src/stellen-fingerabdruck";

const ABSATZ = "Erst das <strong>Ventil X</strong> schließen, dann den Druck ablassen.";

function inhalt(over: { absatz?: string; titel?: string; zusatz?: string } = {}): string {
  return [
    "<p>Gilt für alle Linien.</p>",
    `<h2>${over.titel ?? "Ablauf"}</h2>`,
    `<p>${over.absatz ?? ABSATZ}</p>`,
    "<ul><li>Leitung spülen</li><li>Druck prüfen</li></ul>",
    over.zusatz ?? "",
    "<h2>Grenzwerte</h2>",
    "<table><tbody><tr><th>Druck</th><td>6&nbsp;bar</td></tr></tbody></table>",
    '<figure data-image-id="bild-1"><img src="/api/objects/o1/raw" alt="Schema" data-image-id="bild-1"><figcaption data-image-id="bild-1">Schaltschema Ventil X</figcaption></figure>',
  ].join("");
}

const erster = (bloecke: Stellenblock[]): Stellenblock => {
  const b = bloecke.find((x) => x.abschnitt === "Ablauf" && x.art === "absatz");
  if (!b) {
    throw new Error("Der Absatz im Abschnitt „Ablauf“ fehlt");
  }
  return b;
};

describe("P-WIKI-STELLENBEZUG · D2 — Zuordnung nach einer Änderung", () => {
  it("Z1 · Absätze, Listenpunkte, Tabelle und Bild — je mit ihrem Abschnitt", () => {
    const bloecke = stellenbloecke(inhalt());
    expect(bloecke.map((b) => [b.art, b.abschnitt, b.text])).toEqual([
      ["absatz", "", "Gilt für alle Linien."],
      ["absatz", "Ablauf", "Erst das Ventil X schließen, dann den Druck ablassen."],
      ["absatz", "Ablauf", "Leitung spülen"],
      ["absatz", "Ablauf", "Druck prüfen"],
      ["tabelle", "Grenzwerte", "Druck 6 bar"],
      ["bild", "Grenzwerte", "bild-1"],
    ]);
    expect(bloecke.at(-1)?.anzeige).toBe("Schaltschema Ventil X");
  });

  it("Z2 · in derselben Fassung steht die Stelle „in dieser Fassung“", () => {
    const bloecke = stellenbloecke(inhalt());
    const stelle = stelleAus(erster(bloecke), 3);
    expect(stelleZuordnen(stelle, bloecke, 3).lage).toBe("dieseFassung");
  });

  it("Z3 · anderswo geändert: in der neuen Fassung eindeutig wiedergefunden", () => {
    const stelle = stelleAus(erster(stellenbloecke(inhalt())), 3);
    const neu = stellenbloecke(inhalt({ zusatz: "<p>Ein neuer Hinweis.</p>" }));

    const lage = stelleZuordnen(stelle, neu, 4);
    expect(lage.lage).toBe("eindeutig");
    expect(lage.lage === "eindeutig" ? lage.block.text : null).toBe(stelle.text);
  });

  it("Z4 · der Absatz selbst ist geändert: unklar — nie an den ähnlichen Text gehängt", () => {
    const stelle = stelleAus(erster(stellenbloecke(inhalt())), 3);
    const neu = stellenbloecke(
      inhalt({ absatz: "Erst das Ventil Y schließen, dann den Druck ablassen." }),
    );

    expect(stelleZuordnen(stelle, neu, 4)).toEqual({ lage: "unklar" });
  });

  it("Z5 · der Absatz steht danach zweimal: unklar", () => {
    const stelle = stelleAus(erster(stellenbloecke(inhalt())), 3);
    const neu = stellenbloecke(inhalt({ zusatz: `<p>${ABSATZ}</p>` }));

    expect(stelleZuordnen(stelle, neu, 4)).toEqual({ lage: "unklar" });
  });

  it("Z6 · der Abschnitt wurde umbenannt: unklar", () => {
    const stelle = stelleAus(erster(stellenbloecke(inhalt())), 3);
    const neu = stellenbloecke(inhalt({ titel: "Vorgehen" }));

    expect(stelleZuordnen(stelle, neu, 4)).toEqual({ lage: "unklar" });
  });

  it("Z7 · das Bild hängt an seinem Anker, nicht an der Beschriftung", () => {
    const vorher = stellenbloecke(inhalt());
    const bild = vorher.find((b) => b.art === "bild") as Stellenblock;
    const stelle = stelleAus(bild, 3);

    const neu = stellenbloecke(inhalt().replace("Schaltschema Ventil X", "Schema, überarbeitet"));
    expect(stelleZuordnen(stelle, neu, 4).lage).toBe("eindeutig");

    const ohneBild = stellenbloecke(inhalt().replace(/<figure[\s\S]*<\/figure>/, ""));
    expect(stelleZuordnen(stelle, ohneBild, 4)).toEqual({ lage: "unklar" });
  });

  it("Z8 · jede angebotene Stelle besteht die Prüfung des Dienstes", () => {
    const html = `${inhalt()}<p>Mit &uuml;bersetzter &amp; <em>kursiver</em> Zeile.</p>`;
    const bloecke = stellenbloecke(html);
    expect(bloecke.length).toBeGreaterThan(5);
    for (const b of bloecke) {
      expect(stelleImInhalt(html, stelleAus(b, 1)), `${b.art}: ${b.text}`).toBe(true);
    }
    // GEGENPROBE: eine Stelle, die nicht im Inhalt steht, besteht sie nicht.
    expect(
      stelleImInhalt(html, {
        koVersion: 1,
        art: "absatz",
        abschnitt: "",
        text: "Gibt es nicht.",
        fingerabdruck: stellenFingerabdruck("absatz", "", "Gibt es nicht."),
      }),
    ).toBe(false);
  });

  // ==============================================================================================
  // NACHARBEIT 3 (BEN) — IDENTITÄT ÜBER DEN VOLLSTÄNDIGEN INHALT, PRÜFUNG GEGEN ECHTE BLÖCKE
  // ==============================================================================================

  it("Z9 · langer Absatz durch einen anderen mit denselben ersten 300 Zeichen ersetzt: unklar", () => {
    const anfang = "Vor dem Öffnen der Leitung den Druck vollständig ablassen. ".repeat(6).trim();
    expect(anfang.length).toBeGreaterThan(300);
    const alt = stellenbloecke(inhalt({ absatz: `${anfang} Danach Ventil X schließen.` }));
    const stelle = stelleAus(erster(alt), 3);
    expect(stelle.text.length).toBeLessThanOrEqual(300);

    const neu = stellenbloecke(inhalt({ absatz: `${anfang} Danach Ventil Y öffnen.` }));
    // Das gekürzte Anzeigezitat ist in beiden Fassungen gleich — der Fall, den BEN beschreibt.
    expect(erster(neu).text).toBe(stelle.text);
    expect(stelleZuordnen(stelle, neu, 4)).toEqual({ lage: "unklar" });

    // KALIBRIERUNG: ist der lange Absatz wirklich unverändert, wird er wiedergefunden.
    const gleich = stellenbloecke(
      inhalt({ absatz: `${anfang} Danach Ventil X schließen.`, zusatz: "<p>Neu.</p>" }),
    );
    expect(stelleZuordnen(stelle, gleich, 4).lage).toBe("eindeutig");
  });

  it("Z10 · zwei Absätze mit gleichem Anfang sind zwei wählbare, verschiedene Stellen", () => {
    const anfang = "Ein langer gemeinsamer Anfang. ".repeat(12).trim();
    const bloecke = stellenbloecke(
      inhalt({ absatz: `${anfang} Ende A.`, zusatz: `<p>${anfang} Ende B.</p>` }),
    );
    const zwei = bloecke.filter((b) => b.abschnitt === "Ablauf" && b.text.startsWith("Ein langer"));
    expect(zwei).toHaveLength(2);
    expect(zwei[0]?.text).toBe(zwei[1]?.text);
    expect(zwei[0]?.fingerabdruck).not.toBe(zwei[1]?.fingerabdruck);
    const stelleB = stelleAus(zwei[1] as Stellenblock, 3);
    const lage = stelleZuordnen(stelleB, bloecke, 3);
    expect(lage.lage === "dieseFassung" ? lage.block.anzeige : null).toContain("Ende B.");
  });

  it("Z11 · der Dienst weist falsche Art- und Abschnittskombinationen zurück (BENs Beispiel)", () => {
    const html = "<h2>A</h2><p>Hallo</p>";
    const echt = stellenbloecke(html)[0] as Stellenblock;
    expect(stelleImInhalt(html, stelleAus(echt, 1))).toBe(true);

    // Tabelle im Abschnitt „B" — es gibt weder Tabelle noch Abschnitt B.
    expect(
      stelleImInhalt(html, {
        koVersion: 1,
        art: "tabelle",
        abschnitt: "B",
        text: "Hallo",
        fingerabdruck: stellenFingerabdruck("tabelle", "B", "Hallo"),
      }),
    ).toBe(false);
    // Nur die Art falsch, nur der Abschnitt falsch, nur der Abdruck falsch: jeweils abgewiesen.
    expect(stelleImInhalt(html, { ...stelleAus(echt, 1), art: "tabelle" })).toBe(false);
    expect(stelleImInhalt(html, { ...stelleAus(echt, 1), abschnitt: "B" })).toBe(false);
    expect(
      stelleImInhalt(html, {
        ...stelleAus(echt, 1),
        fingerabdruck: stellenFingerabdruck("absatz", "A", "Hallo Welt"),
      }),
    ).toBe(false);
    // Ein Zitat, das nur als TEIL eines Absatzes vorkommt, ist kein Block.
    expect(
      stelleImInhalt("<h2>A</h2><p>Hallo Welt</p>", {
        ...stelleAus(echt, 1),
        fingerabdruck: stellenFingerabdruck("absatz", "A", "Hallo"),
      }),
    ).toBe(false);
  });

  it("Z12 · Dienst und Fläche zerlegen denselben Inhalt in dieselben Blöcke", () => {
    const lang = "Sehr lange Zeile mit Inhalt. ".repeat(15).trim();
    const faelle = [
      inhalt(),
      inhalt({ zusatz: `<p>${ABSATZ}</p><h2>Ablauf</h2><p>Zweiter Ablauf.</p>` }),
      `<p>${lang}</p><ul><li><p>Im Punkt</p></li><li>Leicht <b>fett</b></li></ul>`,
      '<p>Bild im Absatz <img src="/api/objects/o2/raw" alt="x" data-image-id="b-2"> mit Text</p>',
      "<h3>Gleich</h3><p>a</p><h3>Gleich</h3><p>a</p><pre>Code  zeile</pre><blockquote><p>Zitat</p></blockquote>",
    ];
    for (const html of faelle) {
      const flaeche = stellenbloecke(html).map(({ anzeige: _a, ...rest }) => rest);
      expect(stellenbloeckeAusHtml(html), html).toEqual(flaeche);
    }
  });

  it("Z13 · der Abdruck der Fläche ist SHA-256 wie im Dienst (node:crypto)", () => {
    for (const probe of ["", "abc", "Grüße · „Zitat“ — 😀", "x".repeat(1000)]) {
      expect(sha256Hex(probe), probe.slice(0, 20)).toBe(
        createHash("sha256").update(probe, "utf8").digest("hex"),
      );
    }
    expect(stellenFingerabdruck("absatz", "A", "Hallo")).toBe(
      dienstFingerabdruck("absatz", "A", "Hallo"),
    );
  });
});
