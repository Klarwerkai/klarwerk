// ================================================================================================
// JOB 4328 · DER ZEUGE — ER LAEUFT IM TOR, OHNE DATENBANK UND OHNE BROWSER.
// ================================================================================================
//
// WOZU ER GUT IST: Die Zusagen der Stationen (a)–(f) hängen an Eigenschaften ihres eigenen
// Prüfstands — daran, DASS der Stufe-2-Schalter bedient und nicht vorgesetzt wird, DASS Sichtbarkeit
// über `innerText` und nicht über `textContent` gelesen wird, DASS der Prozessneustart ein echter
// Betriebssystemprozess ist und keine zweite `buildApp`-Instanz. Diese Eigenschaften lassen sich
// nur dann dauerhaft zusichern, wenn ihre Prüfung NICHT dieselbe Infrastruktur braucht wie die
// Sache selbst: sonst fiele sie mit ihr aus. Dieselbe Begründung steht in
// `tests/wiki-gesamtanweisung-abnahme/laufzustand.ts:14-17`.
//
// Ein Test ist kein Aufrufer, und ein Quelltextzeuge ist keine Messung — er ist die Zusicherung,
// dass die Messung weiter DAS misst, was ihr Name sagt.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = resolve(import.meta.dirname, "../..");
const lies = (pfad: string): string => readFileSync(join(WURZEL, pfad), "utf8");

const STRECKE = "tests/wissensnetz-nutzerweg/strecke.ts";
const ABNAHME =
  "tests/wissensnetz-nutzerweg/beziehung-oeffnen-graph-widerruf-neustart-kuerzung.integration.test.ts";
const KATALOG = "apps/web/src/i18n.ts";
const FLAECHE = "apps/web/src/pages/Stufe2.tsx";

describe("JOB 4328 · Zeuge (i): der Lauf sagt selbst, ob er gelaufen ist", () => {
  it("die Abnahme ruft den Laufzustand und schreibt den Grund auf stderr", () => {
    const quelle = lies(ABNAHME);
    expect(quelle, "befundsatz wird nicht gerufen").toContain("befundsatz(");
    expect(quelle, "zaehltAlsBestanden wird nicht gerufen").toContain("zaehltAlsBestanden(");
    expect(quelle, "der Grund geht nicht auf stderr").toContain("process.stderr.write(");
    expect(quelle, "die Abnahme faehrt nicht die gemeinsame Strecke").toContain("fahreStrecke(");
  });
});

describe("JOB 4328 · Zeuge (ii): der Prozessneustart ist ein echter Betriebssystemprozess", () => {
  it("starteKlarwerk und prozessLebt kommen aus der Vorrichtung von 4275/4305", () => {
    const quelle = lies(STRECKE);
    expect(quelle, "die Vorrichtung wird nicht importiert").toContain(
      '../beziehungs-restore-nutzerweg/vorrichtung"',
    );
    for (const name of ["starteKlarwerk", "prozessLebt", "baueBestandAuf", "BEZIEHUNGEN"]) {
      expect(quelle, `${name} wird nicht aus der Vorrichtung geholt`).toContain(name);
    }
  });

  it("SIGTERM wird gefahren und der alte Socket muss WERFEN", () => {
    const quelle = lies(STRECKE);
    expect(quelle, "beende() wird nicht gerufen").toContain(".beende()");
    expect(quelle, "der alte Socket wird nicht befragt").toContain("/health");
    expect(quelle, "ein antwortender alter Socket wuerde nicht auffallen").toContain(
      "rejects.toThrow()",
    );
  });

  it("KEINE zweite Instanz im Testprozess — kein starteStrecke, kein buildApp, kein app.inject", () => {
    const quelle = lies(STRECKE);
    for (const verboten of ["starteStrecke", "buildApp", "app.inject", "mitFlaeche"]) {
      expect(
        quelle,
        `${verboten} wuerde den Prozessneustart zu einer Behauptung machen (vgl. neustart-und-restore.integration.test.ts:22-24)`,
      ).not.toContain(verboten);
    }
  });
});

describe("JOB 4328 · Zeuge (iii): der Stufe-2-Schalter wird BEDIENT, nicht vorgesetzt", () => {
  it("kw.stufe2.v1 kommt in keinem addInitScript vor", () => {
    const quelle = lies(STRECKE);
    expect(quelle, "die Ablage wird nicht gelesen").toContain(
      'localStorage.getItem("kw.stufe2.v1")',
    );
    expect(quelle, "der Schalter wird nicht bedient").toContain('data-testid="zeile-stufe2"');
    // Jeder AUFRUF von `addInitScript` darf den Schluessel NICHT enthalten. Geprueft wird je
    // Vorkommen und nicht global: ein `addInitScript` irgendwo und der Schluessel woanders wären
    // beides erlaubt, beides zusammen im selben Aufruf nicht.
    //
    // Gesucht wird `addInitScript(` — der Aufruf und nicht die Erwaehnung. Die Begruendungen im
    // Kopf der Strecke nennen das Werkzeug beim Namen (genau deshalb steht der Schluessel dort
    // daneben), und eine Suche nach dem blossen Wort machte diese Begruendung zum Verstoss.
    const teile = quelle.split("addInitScript(");
    expect(
      teile.length,
      "es gibt keinen addInitScript-Aufruf — dann ist die Regel leer",
    ).toBeGreaterThan(1);
    for (let i = 1; i < teile.length; i += 1) {
      const aufruf = (teile[i] ?? "").slice(0, 600);
      expect(
        aufruf,
        "ein addInitScript setzt kw.stufe2.v1 vor — dann belegt der Lauf den Schalter nicht, sondern die Ablage",
      ).not.toContain("kw.stufe2");
    }
  });
});

describe("JOB 4328 · Zeuge (iv): der Graph wird über das Menü erreicht", () => {
  it("die Strecke kennt /graph und geht über Zahnrad, Weitere Bereiche und den Bereichspunkt", () => {
    const quelle = lies(STRECKE);
    expect(quelle, "der Graph wird nicht angefahren").toContain('"/graph"');
    // Der Bereichspunkt wird GEBAUT (`[data-testid="bereich-${id}"]`) und steht deshalb nicht als
    // fertige Zeichenkette in der Datei. Geprueft wird beides: die Bauform und die Werte, mit
    // denen sie gerufen wird — eine Suche nach „bereich-graph" fand hier zu Recht nichts.
    expect(quelle, "die Bauform des Bereichspunkts fehlt").toContain('data-testid="bereich-');
    expect(quelle, "der Graph wird nicht über das Menue erreicht").toContain(
      'inDenBereich("graph", "/graph")',
    );
    expect(quelle, "das Wissensnetz wird nicht über das Menue erreicht").toContain(
      'inDenBereich("wissensnetz", "/wissensnetz")',
    );
    expect(quelle, "der Menueausloeser fehlt").toContain('data-testid="kopfband-zahnrad"');
    expect(quelle, "die Menuegruppe fehlt").toContain('data-testid="zahnrad-weitere-bereiche"');
  });
});

describe("JOB 4328 · Zeuge (v): Sichtbarkeit wird über innerText gelesen", () => {
  it("textContent steht AUSSCHLIESSLICH in der Metadatenlesung des SVG-title", () => {
    const quelle = lies(STRECKE);
    const anfang = quelle.indexOf("const KANTEN_METADATEN");
    const ende = quelle.indexOf("ENDE DER METADATENLESUNG");
    expect(anfang, "die Metadatenlesung fehlt").toBeGreaterThan(-1);
    expect(ende, "die Endmarke der Metadatenlesung fehlt").toBeGreaterThan(anfang);
    expect(
      quelle.slice(anfang, ende),
      "die Metadatenlesung heisst nicht kantenMetadaten — dann ist sie in der Rueckgabe nicht auszuweisen",
    ).toContain("kantenMetadaten(");

    // Gesucht wird der ZUGRIFF `.textContent` und nicht das Wort: die Begruendungen im Kopf der
    // Strecke und an der Metadatenlesung muessen es beim Namen nennen, ohne es zu benutzen.
    let ab = 0;
    let treffer = 0;
    for (;;) {
      const stelle = quelle.indexOf(".textContent", ab);
      if (stelle === -1) {
        break;
      }
      treffer += 1;
      expect(
        stelle > anfang && stelle < ende,
        `.textContent an Position ${stelle} steht ausserhalb der Metadatenlesung — eine Sichtbarkeitslesung darf es nicht benutzen (REGELN.md 9)`,
      ).toBe(true);
      ab = stelle + 1;
    }
    expect(treffer, "die Metadatenlesung liest den SVG-title nicht").toBeGreaterThan(0);
    expect(quelle, "es wird nicht ueber innerText gelesen").toContain("innerText");
    expect(quelle, "die Sichtbarkeit wird nicht berechnet").toContain("checkVisibility");
    expect(quelle, "der berechnete Stil wird nicht gelesen").toContain("getComputedStyle");
  });
});

describe("JOB 4328 · Zeuge (vi): der neue Katalogsatz nennt die Lieferzahl, nicht die Zeichnung", () => {
  it("die drei neuen Zeilen enthalten weder gezeichnet noch drawn noch getekend", () => {
    const quelle = lies(KATALOG);
    // Ueber den WERT und nicht ueber die Zeile: Biome bricht einen langen Satz hinter dem
    // Doppelpunkt um (`lineWidth: 100`), und eine zeilenweise Suche fand dann einen leeren Satz.
    const muster = /"graph\.kuratiertGeladen":\s*"((?:[^"\\]|\\.)*)"/g;
    const saetze = [...quelle.matchAll(muster)].map((t) => t[1] ?? "");
    expect(saetze.length, "der neue Schluessel steht nicht in genau drei Sprachbloecken").toBe(3);
    expect(new Set(saetze).size, "zwei Sprachbloecke tragen denselben Satz").toBe(3);
    for (const satz of saetze) {
      expect(satz, "die Lieferzahl fehlt").toContain("{{geladen}}");
      expect(satz, "die Gesamtzahl fehlt").toContain("{{gesamt}}");
      for (const wort of ["gezeichnet", "drawn", "getekend"]) {
        expect(
          satz.toLowerCase(),
          `„${wort}" behauptet eine Zeichenzahl, die der Satz nicht kennt — geliefert ist nicht gezeichnet (graphLayout.ts:573-575)`,
        ).not.toContain(wort);
      }
    }
  });

  it("die Fläche benutzt den Schlüssel über t( und trägt kein deutsches Literal", () => {
    const quelle = lies(FLAECHE);
    expect(quelle, "der neue Schluessel wird nicht benutzt").toContain(
      't("graph.kuratiertGeladen"',
    );
    expect(quelle, "das Testkennzeichen des Hinweises fehlt").toContain(
      'data-testid="graph-kuratiert-gekuerzt"',
    );
    // Q9: kein Anwendertext im Quelltext. Der Satz steht im Katalog, nicht hier.
    for (const wort of ["Fachbeziehungen wurden geladen", "begrenzten Ausschnitt"]) {
      expect(quelle, `„${wort}" gehoert in den Katalog und nicht in die Flaeche`).not.toContain(
        wort,
      );
    }
    // Die Lieferzahl, nicht die Zeichenzahl: `layout.kuratierteKanten` darf im Hinweis nicht
    // vorkommen. Geprueft wird der Ausdruck der neuen Zeile.
    const stelle = quelle.indexOf('t("graph.kuratiertGeladen"');
    const ausdruck = quelle.slice(Math.max(0, stelle - 200), stelle + 400);
    expect(ausdruck, "der Hinweis liest nicht die gelieferte Menge").toContain(
      "raw.kuratierteKanten",
    );
    expect(
      ausdruck,
      "der Hinweis liest die GEZEICHNETE Menge — das waere eine Zahl, die niemand zugesagt hat",
    ).not.toContain("layout.kuratierteKanten");
  });
});

describe("JOB 4328 · Zeuge (vii): jede Sollzahl der Kachel- und Kantenstationen ist hergeleitet", () => {
  it("die Strecke rechnet aus BEZIEHUNGEN und nennt keine nackte Kachel-/Kantenzahl", () => {
    const quelle = lies(STRECKE);
    expect(quelle, "SOLL fehlt — dann stehen die Zahlen irgendwo einzeln").toContain(
      "export const SOLL",
    );
    expect(quelle, "die Sollzahlen werden nicht aus BEZIEHUNGEN gerechnet").toContain(
      "haengtAn(BEZIEHUNGEN",
    );
    expect(quelle, "die Kantenzahl wird nicht aus BEZIEHUNGEN gerechnet").toContain(
      "graphVorher: BEZIEHUNGEN.length",
    );
    // Die Kachel- und Kantenzahlen dieser Strecke liegen alle zwischen 2 und 5. Eine nackte Zahl
    // dieser Groesse in einem `toBe` waere genau der Fehler, den Codex am Auftrag korrigiert hat
    // (17.09., Punkt 1: „Die Forderung 4 Kacheln auf /wissen/alpha ist falsch").
    for (const zahl of [2, 3, 4, 5]) {
      expect(
        quelle,
        `.toBe(${zahl}) ist eine getippte Kachel-/Kantenzahl — sie muss ein Ausdruck ueber SOLL bzw. BEZIEHUNGEN sein`,
      ).not.toContain(`.toBe(${zahl})`);
    }
  });

  it("die Abnahme prüft das Protokoll gegen SOLL und nicht gegen Text aus dem Auftrag", () => {
    const quelle = lies(ABNAHME);
    for (const name of [
      "SOLL.alphaVorher",
      "SOLL.alphaNachher",
      "SOLL.graphVorher",
      "SOLL.graphNachher",
      "SOLL.gesamtNachInsert",
      "SOLL.geliefert",
    ]) {
      expect(quelle, `${name} wird nicht geprueft`).toContain(name);
    }
  });
});
