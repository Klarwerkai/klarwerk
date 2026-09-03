// ================================================================================================
// JOB 3023 — EINE WIEDER EINGESPIELTE SICHERUNG DARF DEN BESTAND NICHT VERDOPPELN.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT (HEAD 7cf92ce, `service.ts:1390-1402`): `importJson()`
// entschied „Dublette" ueber ZEICHENGLEICHHEIT eines zusammengesetzten Strings
// (`` `${ko.title}|${ko.statement}` ``). Ein angehaengter Satzpunkt oder eine geaenderte
// Gross-/Kleinschreibung genuegte, damit derselbe Eintrag als neu durchging — genau das, was eine
// Sicherung aus einem anderen Werkzeug typischerweise mitbringt.
//
// WARUM DIESER TEST DIE GANZE APP MONTIERT UND KEINEN DIENST: die Regel reist seit diesem Auftrag
// als PORT in den Dienst und wird in der Kompositionswurzel (`library-routes.ts`) aus `coreText` +
// `trigramSimilarity` gebaut. Ein Diensttest mit selbstgebauter Pruefung wuerde genau die Naht
// ueberspringen, um die es geht — er waere gruen, waehrend die Route weiter Zeichen vergleicht.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ZUGANG = { name: "Admin", email: "reimport@x.de", password: "secret123" };

// RUNDE 2 (bens Befund 3): die Aussagen tragen BEWUSST KEIN Schlusszeichen. Runde 1 liess sie auf
// einen Punkt enden und die „veraenderte" Sicherung entfernte ihn und haengte ihn sofort wieder an
// — das Satzzeichen war danach dasselbe, der Pflichtfall pruefte ihn also gar nicht. Jetzt ist der
// Punkt in der Sicherung wirklich neu.
const BESTAND = [
  {
    title: "Ventil entlueften",
    statement: "Bei Ueberdruck das Ventil X langsam entlueften",
    type: "best_practice" as const,
    category: "Wartung",
  },
  {
    title: "Pumpe schmieren",
    statement: "Die Pumpe alle 200 Betriebsstunden schmieren",
    type: "technik" as const,
    category: "Wartung",
  },
];

/**
 * Ein VOLLSTAENDIG gepflegtes Wissensobjekt — mit Bedingungen und Massnahmen.
 *
 * RUNDE 2 (bens Befund 1): genau dieser Fall fehlte und war der Produktfehler. Runde 1 verglich
 * den Import-Eintrag (ohne Bedingungen/Massnahmen, die traegt eine Sicherung nicht) gegen den
 * Kerntext des Bestandsobjekts EINSCHLIESSLICH seiner Bedingungen und Massnahmen. Je gepflegter
 * das Objekt, desto mehr Text stand nur auf einer Seite: ben hat 0,12 gemessen, und der Eintrag
 * wurde ein zweites Mal angelegt. Der Schutz versagte also ausgerechnet beim wertvollsten Bestand.
 */
const REICHES_KO = {
  title: "Rueckschlagklappe pruefen",
  statement: "Die Rueckschlagklappe vor jedem Anlauf auf Dichtheit pruefen",
  type: "best_practice" as const,
  category: "Wartung",
  conditions: [
    "Anlage steht still und ist drucklos",
    "Absperrschieber vor der Klappe ist geschlossen",
    "Freigabe des Schichtleiters liegt vor",
  ],
  measures: [
    "Klappe ausbauen und Sitzflaeche sichtpruefen",
    "Dichtung bei Riefen ersetzen",
    "Befund im Betriebsbuch vermerken",
  ],
};

interface Uebersprungen {
  titel: string;
  grund: string;
  koId: string | null;
  aehnlichkeit?: number;
}

async function bestueckteApp() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  const koIds: string[] = [];
  for (const eintrag of BESTAND) {
    const res = await app.inject({ method: "POST", url: "/api/kos", headers, payload: eintrag });
    expect(res.statusCode, res.body).toBe(201);
    koIds.push(res.json().id as string);
  }
  return { app, headers, koIds };
}

/**
 * Die Sicherung, wie ein zweites Werkzeug sie schreibt: Satzpunkt NEU dran, Grossschreibung anders.
 *
 * Der Punkt kommt wirklich hinzu — die Bestandsaussagen enden ohne Schlusszeichen (siehe oben).
 * Die Zusicherung dazu steht in A0: der Test misst seine eigene Voraussetzung, statt sie zu
 * behaupten.
 */
function leichtVeraenderteSicherung() {
  return BESTAND.map((eintrag) => ({
    ...eintrag,
    title: eintrag.title.toUpperCase(),
    statement: `${eintrag.statement}.`.replace("Bei", "bei"),
  }));
}

describe("JOB 3023 · A — die eingespielte Sicherung erzeugt keine Dubletten", () => {
  it("A0 · die Voraussetzung von A1: die Sicherung aendert Schlusszeichen UND Schreibweise wirklich", () => {
    // RUNDE 2 (bens Befund 3): A1 behauptete eine Satzzeichenaenderung, die keine war. Diese
    // Zusicherung misst die Voraussetzung, statt sie zu glauben — wer die Bestandsaussagen wieder
    // mit Punkt enden laesst, wird HIER rot und nicht still wirkungslos.
    const veraendert = leichtVeraenderteSicherung();
    for (const [i, eintrag] of veraendert.entries()) {
      const original = BESTAND[i];
      expect(
        original?.statement.endsWith("."),
        "Die Bestandsaussage endet OHNE Schlusszeichen.",
      ).toBe(false);
      expect(eintrag.statement.endsWith("."), "Die Sicherung haengt einen Punkt NEU an.").toBe(
        true,
      );
      expect(eintrag.statement).not.toBe(original?.statement);
      expect(eintrag.title).not.toBe(original?.title);
    }
    // Und die Aenderung ist wirklich nur Schreibweise/Satzzeichen — kein anderer Wortlaut.
    const ohneZierrat = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    for (const [i, eintrag] of veraendert.entries()) {
      expect(ohneZierrat(eintrag.statement)).toBe(ohneZierrat(BESTAND[i]?.statement ?? ""));
      expect(ohneZierrat(eintrag.title)).toBe(ohneZierrat(BESTAND[i]?.title ?? ""));
    }
  });

  it("A1 · Satzpunkt und Gross-/Kleinschreibung erzeugen keinen zweiten Eintrag", async () => {
    const { app, headers, koIds } = await bestueckteApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/library/import",
      headers,
      payload: { items: leichtVeraenderteSicherung() },
    });

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json() as {
      imported: number;
      skipped: number;
      uebersprungen: Uebersprungen[];
    };
    expect(
      body.imported,
      "Eine wieder eingespielte Sicherung darf keinen einzigen neuen Eintrag erzeugen.",
    ).toBe(0);
    expect(body.skipped).toBe(2);
    expect(body.uebersprungen).toHaveLength(2);
    for (const eintrag of body.uebersprungen) {
      expect(eintrag.grund).toBe("aehnlich");
      expect(
        koIds,
        "Die Antwort muss sagen, AUF WELCHES Wissensobjekt der Eintrag getroffen ist.",
      ).toContain(eintrag.koId);
      expect(eintrag.aehnlichkeit).toBeGreaterThanOrEqual(0.85);
      expect(eintrag.aehnlichkeit).toBeLessThanOrEqual(1);
    }
    // Jeder Bestandseintrag wurde genau einmal getroffen — nicht zweimal derselbe.
    expect(new Set(body.uebersprungen.map((e) => e.koId)).size).toBe(2);

    const liste = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(liste.statusCode, liste.body).toBe(200);
    expect(
      (liste.json() as unknown[]).length,
      "Nach der Wiedereinspielung steht der Bestand unveraendert bei zwei Objekten.",
    ).toBe(2);
  });

  it("A2 · die woertlich gleiche Sicherung heisst weiterhin `identisch` und nennt das Objekt", async () => {
    const { app, headers, koIds } = await bestueckteApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/library/import",
      headers,
      payload: { items: BESTAND },
    });

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json() as {
      imported: number;
      skipped: number;
      uebersprungen: Uebersprungen[];
    };
    expect(body.imported).toBe(0);
    expect(body.uebersprungen.map((e) => e.grund)).toEqual(["identisch", "identisch"]);
    expect(body.uebersprungen.map((e) => e.koId).sort()).toEqual([...koIds].sort());
  });

  // ==============================================================================================
  // A3 — DER FALL, AN DEM RUNDE 1 GESCHEITERT IST (bens Befund 1).
  // ==============================================================================================
  //
  // Ein VOLLSTAENDIG gepflegtes Wissensobjekt: drei Bedingungen, drei Massnahmen. Seine Sicherung
  // traegt davon nichts — ein `ImportItem` hat diese Felder nicht. Runde 1 verglich trotzdem den
  // mageren Import-Text gegen den vollen Bestands-Kerntext und kam auf 0,12; das Objekt wurde ein
  // zweites Mal angelegt. Wer die Feldbasis wieder auseinanderlaufen laesst, wird HIER rot.
  it("A3 · ein Bestandsobjekt MIT Bedingungen und Massnahmen erzeugt bei geaenderter Schreibweise keine Dublette", async () => {
    const app = buildApp(buildServices());
    await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: ZUGANG.email, password: ZUGANG.password },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };

    const angelegt = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: REICHES_KO,
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const koId = angelegt.json().id as string;
    // Die Voraussetzung wird gemessen: das Objekt traegt seine Bedingungen und Massnahmen wirklich.
    // Ohne diese Zeilen pruefte A3 den reichen Fall nur dem Namen nach.
    expect(angelegt.json().conditions, "Der Bestand traegt drei Bedingungen.").toHaveLength(3);
    expect(angelegt.json().measures, "Der Bestand traegt drei Massnahmen.").toHaveLength(3);

    // Die Sicherung: nur Titel und Aussage, Schreibweise und Schlusszeichen geaendert.
    const res = await app.inject({
      method: "POST",
      url: "/api/library/import",
      headers,
      payload: {
        items: [
          {
            title: REICHES_KO.title.toUpperCase(),
            statement: `${REICHES_KO.statement}.`,
            type: REICHES_KO.type,
            category: REICHES_KO.category,
          },
        ],
      },
    });

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json() as {
      imported: number;
      skipped: number;
      uebersprungen: Uebersprungen[];
    };
    expect(
      body.imported,
      "Ein gepflegtes Objekt darf durch seine eigene Sicherung nicht verdoppelt werden.",
    ).toBe(0);
    expect(body.uebersprungen).toHaveLength(1);
    expect(body.uebersprungen[0]?.grund).toBe("aehnlich");
    expect(body.uebersprungen[0]?.koId, "Die Antwort nennt das getroffene Objekt.").toBe(koId);
    expect(body.uebersprungen[0]?.aehnlichkeit).toBeGreaterThanOrEqual(0.85);

    const liste = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(
      (liste.json() as unknown[]).length,
      "Der Bestand steht unveraendert bei einem Objekt.",
    ).toBe(1);
  });
});
