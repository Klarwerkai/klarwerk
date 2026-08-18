import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ================================================================================================
// JOB 755 / D3 — DIE 15/16-MATRIX, MASCHINELL STATT ERZÄHLT
// ================================================================================================
//
// Gebunden an `_relay/kopf/outbox/BEN3-PRUEFUNG-JOB-755-D2.md` (SHA-256
// `4175edf0164bb9f6623384a2698bd5cb88f3953214ef81282e3a23705fd9127a`), Prüflücke 1:
//
//   „15/16-Matrix: jeden aktuellen Testfall eindeutig einem der 15 Freeze-Fälle oder einem
//    ausdrücklich zusätzlichen Fall zuordnen; erwartet ist keine doppelte, fehlende oder
//    unbenannte Vertragskante."
//
// DIE OFFENE DIFFERENZ, die D1 und D2 nicht aufgelöst haben: Der Vertrag aus Freeze 93 nennt
// **15** Fälle, gelaufen sind **16**. PRO5 hat die Differenz in D2 §3.2 ehrlich offengelegt und
// ausdrücklich NICHT geglättet.
//
// DIE AUFLÖSUNG, quellenbelegt: `BEN-PRUEFUNG-JOB-755-D1.md:18` nennt den Überhang beim Namen —
// „Der vorgeschlagene **zusätzliche Prototypfall** ist sinnvoll, ersetzt diese Reproduktion aber
// nicht." Das ist der Fall `ben103GeerbterMarker`, den die Vertragsdatei selbst als
// „Der FUENFTE Unknown-Fall" führt und auf AUFTRAG-105 / Korrekturvertrag BEN 103 zurückführt.
//
//     16 gelaufene Fälle  =  15 Freeze-93-Vertragsfälle  +  1 benannter Zusatzfall
//
// WARUM DIESER WÄCHTER IN EINER EIGENEN DATEI STEHT und nicht in der Vertragsdatei: Die
// Vertragsdatei ist eingefroren, und ihr Ist-Hash weicht bereits vom Freeze-93-Pin ab — genau das
// ist Gegenstand der offenen Prüflücke. Ein Wächter, der die Matrix prüft, indem er die geprüfte
// Datei selbst verändert, verschöbe den Pin ein weiteres Mal. Er liest sie deshalb als Text, so wie
// `services/app/src/db.migrate.test.ts` die Migrationsliste aus `db.ts` liest.
//
// BENANNTE GRENZE: Die Freeze-93-Akte selbst ist in diesem Bestand nicht auffindbar (gesucht in
// `00_CONTROL/`), und die Vertragsdatei trägt in diesem Clone nur einen einzigen Commit — die
// 15 Fallnamen sind also aus keiner Quelle wörtlich abrufbar. Diese Matrix bindet deshalb die
// **Struktur** des Vertrags (Anzahl, Gruppen, Eindeutigkeit, der eine benannte Zusatzfall) an den
// Quelltext. Sie behauptet NICHT, die 15 Namen mit der Freeze-Akte verglichen zu haben.

const VERTRAGSDATEI = join(__dirname, "w2-i18n-schluessel-aufloesbar-81.test.ts");
const quelle = readFileSync(VERTRAGSDATEI, "utf8");

/** Die Sprachen und Fremdschlüssel, wie die Vertragsdatei sie führt — aus ihrem Quelltext gelesen. */
const SPRACHEN = ["de", "en", "nl"] as const;
const FREMD = ["xx", "toString", "constructor", "__proto__"] as const;
const ZUSATZ_MARKER = "ben103GeerbterMarker";

/** Die 15 Fälle des Freeze-93-Vertrags, in den fünf Gruppen, die die Datei bildet. */
const FREEZE93: readonly string[] = [
  "die Erhebung selbst traegt: Schluessel, Praefixe und Zustaende sind gefunden",
  ...SPRACHEN.map((s) => `${s}: kein verwendeter Schluessel fehlt`),
  ...SPRACHEN.map((s) => `${s}: kein verwendeter Schluessel traegt einen leeren oder rohen Wert`),
  ...FREMD.map(
    (f) => `unbekannter Sprachschluessel „${f}" meldet vollstaendig und mit Fallidentitaet`,
  ),
  ...SPRACHEN.map((s) => `die echte Sprache „${s}" geht positiv durch`),
  "die zwei Schluessel aus Preflight 78 sind namentlich abgedeckt",
];

/** Der eine Fall, den D1 `:18` als „zusätzlichen Prototypfall" führt. */
const ZUSATZFALL = `unbekannter Sprachschluessel „${ZUSATZ_MARKER}" wird auch als GEERBTER Marker abgewiesen`;

/**
 * Die Falltitel, wie sie im Quelltext stehen — mit den Schleifenvariablen noch als Platzhalter.
 * Es wird bewusst der ROHE Titel erfasst und danach aufgelöst: so fällt eine umbenannte oder
 * gelöschte Schleife auf, statt still zu verschwinden.
 */
function rohTitel(): string[] {
  return [...quelle.matchAll(/^\s*it\(\s*(?:`([^`]*)`|"((?:[^"\\]|\\.)*)")/gm)].map(
    (m) => (m[1] ?? m[2]) as string,
  );
}

/** Löst die Schleifenplatzhalter genau so auf, wie die Vertragsdatei sie zur Laufzeit bildet. */
function aufgeloesteTitel(): string[] {
  const out: string[] = [];
  for (const roh of rohTitel()) {
    if (roh.includes("${sprache}")) {
      out.push(...SPRACHEN.map((s) => roh.replaceAll("${sprache}", s)));
    } else if (roh.includes("${fremd}")) {
      out.push(...FREMD.map((f) => roh.replaceAll("${fremd}", f)));
    } else if (roh.includes("${GEERBTER_MARKER}")) {
      out.push(roh.replaceAll("${GEERBTER_MARKER}", ZUSATZ_MARKER));
    } else {
      out.push(roh);
    }
  }
  return out;
}

describe("JOB 755 · Prüflücke 1 — die 15/16-Matrix ist aufgelöst und maschinell gebunden", () => {
  it("die Erhebung selbst traegt: die Vertragsdatei ist lesbar und enthaelt Faelle", () => {
    // Ohne diese Kontrolle faerbte ein leerer Auszug die ganze Matrix still gruen — derselbe
    // Fehler, den die Vertragsdatei anderen Tests vorhaelt.
    expect(quelle.length, "die Vertragsdatei ist leer oder nicht lesbar").toBeGreaterThan(1000);
    expect(rohTitel().length, "kein einziger it()-Titel gefunden").toBeGreaterThan(5);
  });

  it("der Freeze-93-Vertrag zaehlt genau 15 Faelle, keiner doppelt", () => {
    expect(FREEZE93).toHaveLength(15);
    expect(new Set(FREEZE93).size, "ein Freeze-Fall steht doppelt in der Matrix").toBe(15);
  });

  it("der Zusatzfall ist genau einer und gehoert NICHT zu den 15", () => {
    // D1 `:18` nennt ihn „der vorgeschlagene zusaetzliche Prototypfall"; die Vertragsdatei fuehrt
    // ihn als „Der FUENFTE Unknown-Fall" unter AUFTRAG-105 / BEN 103.
    expect(FREEZE93).not.toContain(ZUSATZFALL);
    expect([...FREEZE93, ZUSATZFALL]).toHaveLength(16);
  });

  it("15 + 1 = 16: die Matrix deckt die gelaufene Fallmenge vollstaendig und ohne Rest", () => {
    const ist = aufgeloesteTitel();
    const soll = [...FREEZE93, ZUSATZFALL];

    const fehlend = soll.filter((t) => !ist.includes(t));
    expect(
      fehlend,
      `Vertragsfaelle ohne Entsprechung im Quelltext: ${fehlend.join(" | ")}`,
    ).toEqual([]);

    const unbenannt = ist.filter((t) => !soll.includes(t));
    expect(
      unbenannt,
      `Faelle im Quelltext ohne Zuordnung zu Freeze 93 oder zum benannten Zusatzfall: ${unbenannt.join(" | ")}`,
    ).toEqual([]);

    expect(ist).toHaveLength(16);
    expect(new Set(ist).size, "ein Fall traegt denselben Titel zweimal").toBe(16);
  });

  it("die drei Fremdschluessel-Gruppen stehen namentlich — die Zahl 3 aus Mutant C haengt daran", () => {
    // Mutant C erwartet EXAKT drei rote Fremdschluesselfaelle. Diese Zahl ist nur dann aussagekraeftig,
    // wenn feststeht, welche der vier Fremdschluessel ueber die Prototypenkette kommen: `xx` existiert
    // nirgends und faellt korrekt durch den `undefined`-Zweig; `toString`, `constructor` und
    // `__proto__` erben einen WERT und brauchen `Object.hasOwn`. Drei, nicht vier.
    const geerbt = FREMD.filter((f) => f !== "xx");
    expect(geerbt).toHaveLength(3);
    for (const name of geerbt) {
      expect(
        Object.hasOwn(Object.prototype, name),
        `${name} wird nicht von Object.prototype geerbt`,
      ).toBe(true);
    }
    expect(Object.hasOwn(Object.prototype, "xx"), `„xx" darf gerade NICHT geerbt sein`).toBe(false);
  });

  it("der Meldungsvertrag schliesst die generische Aussage aus — im Quelltext gebunden", () => {
    // Prüflücke 2 verlangt den ausdruecklichen Ausschluss von `nicht auffindbar`. Die Vertragsdatei
    // erfuellt ihn durch VOLLSTAENDIGE Stringgleichheit gegen `unbekanntMeldung` — und diese
    // Sollmeldung enthaelt die generische Wendung nicht. Beides wird hier am Quelltext gepinnt,
    // damit die Zusage nicht still auf Teilbedingungen zurueckfaellt.
    expect(quelle).toContain("expect(fehlermeldung(fremd)).toBe(unbekanntMeldung(fremd));");
    const soll = /function unbekanntMeldung\([\s\S]*?\n}/.exec(quelle)?.[0] ?? "";
    expect(soll, "unbekanntMeldung ist nicht auffindbar").not.toBe("");
    expect(soll).not.toContain("nicht auffindbar");
    expect(soll).toContain("unbekannter Sprachschluessel");
  });
});
