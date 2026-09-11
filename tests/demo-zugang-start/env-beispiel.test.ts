// ================================================================================================
// JOB 3655 · C — env.demo.beispiel UND DER STARTVERTRAG LAUFEN NICHT AUSEINANDER.
// ================================================================================================
//
// Auftrag §5(d): „`env.demo.beispiel` nennt jeden Namen aus dem Startvertrag; ein Test vergleicht
// beide Listen, damit sie nicht auseinanderlaufen."
//
// Der Vergleich geht ABSICHTLICH in BEIDE Richtungen. Nur „jeder Vertragsname steht in der Datei"
// zu prüfen, liesse eine Datei zu, die zusätzlich Namen nennt, die es gar nicht mehr gibt — und
// genau die schreibt ein Betreiber dann in seine Umgebung und wundert sich, dass nichts passiert.
//
// Und er prüft mehr als die Namen: dass in der Beispieldatei KEIN Wert steht. Eine Beispieldatei
// mit einem echten Wert ist der kürzeste Weg, ein Geheimnis in ein Git-Verzeichnis zu bekommen.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STARTVERTRAG } from "../../services/app/src/start-vertrag";

const DATEI = join(__dirname, "..", "..", "env.demo.beispiel");
const INHALT = readFileSync(DATEI, "utf8");

/**
 * Die Zuweisungszeilen der Datei — aktive (`NAME=`) und bewusst auskommentierte (`# NAME=`).
 * Erklärtext („#   Ohne ihn: …") ist keine Zuweisung und wird nicht mitgezählt.
 */
function zuweisungen(): { name: string; aktiv: boolean; wert: string }[] {
  const treffer: { name: string; aktiv: boolean; wert: string }[] = [];
  for (const zeile of INHALT.split("\n")) {
    const passt = /^(#\s?)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(zeile.trim());
    const name = passt?.[2];
    if (passt && name !== undefined) {
      treffer.push({ name, aktiv: passt[1] === undefined, wert: passt[3] ?? "" });
    }
  }
  return treffer;
}

describe("JOB 3655 C · die Beispieldatei für die Vorführ-Instanz", () => {
  it("C0 · die Erhebung greift überhaupt", () => {
    // Ein kaputter Datei-Lauf darf nicht still grün sein.
    expect(INHALT.length).toBeGreaterThan(1000);
    expect(zuweisungen().length).toBeGreaterThan(50);
    // Und das Muster unterscheidet Zuweisung von Erklärtext.
    expect(/^(#\s?)?([A-Z][A-Z0-9_]*)=(.*)$/.test("#   Ohne ihn: Es gilt 587.")).toBe(false);
  });

  it("C1 · jeder Name aus dem Startvertrag steht in der Datei", () => {
    const inDatei = new Set(zuweisungen().map((z) => z.name));
    const fehlend = STARTVERTRAG.map((w) => w.name).filter((name) => !inDatei.has(name));
    expect(fehlend).toEqual([]);
  });

  it("C2 · die Datei nennt keinen Namen, den der Startvertrag nicht kennt", () => {
    const imVertrag = new Set(STARTVERTRAG.map((w) => w.name));
    const ueberzaehlig = [...new Set(zuweisungen().map((z) => z.name))].filter(
      (name) => !imVertrag.has(name),
    );
    expect(ueberzaehlig).toEqual([]);
  });

  it("C3 · kein einziger Wert steht in der Datei — auch kein Platzhalter", () => {
    const mitWert = zuweisungen().filter((z) => z.wert.trim() !== "");
    expect(mitWert).toEqual([]);
  });

  it("C4 · genau die Pflichtwerte stehen als aktive Zeile da, alles andere auskommentiert", () => {
    // WARUM DAS ZÄHLT: Ein gesetzter LEERER Wert ist nicht dasselbe wie ein nicht gesetzter.
    // KLARWERK_ADDON_ORIGIN="" fällt fail-closed auf „gar kein CORS", während die nicht gesetzte
    // Variable ihren Vorgabewert nimmt. Wer die Datei kopiert, darf nicht ungewollt abschalten.
    const aktiv = zuweisungen()
      .filter((z) => z.aktiv)
      .map((z) => z.name)
      .sort();
    const pflicht = STARTVERTRAG.filter((w) => w.pflicht.art === "produktion")
      .map((w) => w.name)
      .sort();
    expect(aktiv).toEqual(pflicht);
  });

  it("C5 · zu jedem Namen steht da, wofür er gilt und was ohne ihn nicht geht", () => {
    // Eine Liste von Namen ist kein Paket. Der Satz „Ohne ihn: …" ist der, der beim Aufsetzen zählt.
    for (const wert of STARTVERTRAG) {
      expect(INHALT, `${wert.name} ohne Erklärung`).toContain(`# ${wert.name} — ${wert.wofuer}`);
      expect(INHALT, `${wert.name} ohne Folgesatz`).toContain(`#   Ohne ihn: ${wert.ohneIhn}`);
    }
  });

  it("C6 · die Datei warnt vor der gemessenen Falle der Vorführung", () => {
    expect(INHALT).toContain("KLARWERK_REASONER_POLICY NICHT setzen");
    expect(INHALT).toContain("EIGENE DATABASE_URL");
  });
});
