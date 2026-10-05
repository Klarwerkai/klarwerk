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
//
// Lauf gesamt-import-adoption (Bens B3, R-0143): `importJson()` ist entfallen; `POST
// /api/library/import` reiht Kandidaten ein, erst die Annahme legt an. Jeder Fall misst darum
// den GANZEN Weg: den Befund je Kandidat beim Einreihen, die Annahme ALLER Kandidaten (kein Objekt
// fuer eine Dublette) und danach den Bestand.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KandidatDublettenbefund } from "../../services/library-analytics";

const ZUGANG = { name: "Admin", email: "reimport@x.de", password: "secret123" };

// RUNDE 2 (bens Befund 3): die Aussagen tragen BEWUSST KEIN Schlusszeichen. Runde 1 liess sie auf
// einen Punkt enden und die „veraenderte" Sicherung entfernte ihn und haengte ihn sofort wieder an
// — das Satzzeichen war danach dasselbe, der Pflichtfall pruefte ihn also gar nicht. Jetzt ist der
// Punkt in der Sicherung wirklich neu.
// JOB 3429 (Q3 c): der Schreibweg verlangt die Stufe. Diese Einträge messen die Dublettenerkennung,
// nicht die Einstufung — sie tragen deshalb die neutrale Stufe „intern".
const BESTAND = [
  {
    title: "Ventil entlueften",
    statement: "Bei Ueberdruck das Ventil X langsam entlueften",
    type: "best_practice" as const,
    category: "Wartung",
    confidentiality: "intern" as const,
  },
  {
    title: "Pumpe schmieren",
    statement: "Die Pumpe alle 200 Betriebsstunden schmieren",
    type: "technik" as const,
    category: "Wartung",
    confidentiality: "intern" as const,
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
  // JOB 3429 (Q3 c): Pflichtfeld des Schreibwegs; dieser Fall misst die Dublettenerkennung.
  confidentiality: "intern" as const,
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

interface KandidatDto {
  id: string;
  koId: string | null;
  dublettenbefund?: KandidatDublettenbefund;
}

type App = ReturnType<typeof buildApp>;

/** Treffer-Kennung eines Befunds, wenn er auf ein Wissensobjekt zeigt — sonst `undefined`. */
function getroffenesKo(befund: KandidatDublettenbefund | undefined): string | undefined {
  return befund && "treffer" in befund && befund.treffer.art === "wissensobjekt"
    ? befund.treffer.koId
    : undefined;
}

/**
 * Der ganze Importweg: einreihen, dann JEDEN Kandidaten annehmen.
 *
 * Hauptstand-Integration (R-0143, Auftrag pruef-warteschlange): der Eingang antwortet mit 200 und
 * `direktimportAntwort`; er legt selbst nichts an (`imported: 0`), die eingereihten Kandidaten
 * stehen unter `kandidaten`.
 */
async function spieleEin(app: App, headers: Record<string, string>, items: unknown[]) {
  const res = await app.inject({
    method: "POST",
    url: "/api/library/import",
    headers,
    payload: { items },
  });
  expect(res.statusCode, res.body).toBe(200);
  const antwort = res.json() as { imported: number; kandidaten: KandidatDto[] };
  expect(antwort.imported, "Der Eingang legt selbst nichts an.").toBe(0);
  const kandidaten = antwort.kandidaten;
  const angenommen: KandidatDto[] = [];
  for (const kandidat of kandidaten) {
    const entscheidung = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${kandidat.id}`,
      headers,
      payload: { action: "accept" },
    });
    expect(entscheidung.statusCode, entscheidung.body).toBe(200);
    angenommen.push(entscheidung.json() as KandidatDto);
  }
  return { kandidaten, angenommen };
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

    const { kandidaten, angenommen } = await spieleEin(app, headers, leichtVeraenderteSicherung());

    expect(
      angenommen.map((k) => k.koId),
      "Eine wieder eingespielte Sicherung darf keinen einzigen neuen Eintrag erzeugen.",
    ).toEqual([null, null]);
    expect(kandidaten).toHaveLength(2);
    for (const kandidat of kandidaten) {
      const befund = kandidat.dublettenbefund;
      expect(befund?.ergebnis).toBe("aehnlich");
      expect(
        koIds,
        "Die Antwort muss sagen, AUF WELCHES Wissensobjekt der Eintrag getroffen ist.",
      ).toContain(getroffenesKo(befund));
      const aehnlichkeit = befund?.ergebnis === "aehnlich" ? befund.aehnlichkeit : undefined;
      expect(aehnlichkeit).toBeGreaterThanOrEqual(0.85);
      expect(aehnlichkeit).toBeLessThanOrEqual(1);
    }
    // Jeder Bestandseintrag wurde genau einmal getroffen — nicht zweimal derselbe.
    expect(new Set(kandidaten.map((k) => getroffenesKo(k.dublettenbefund))).size).toBe(2);

    const liste = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(liste.statusCode, liste.body).toBe(200);
    expect(
      (liste.json() as unknown[]).length,
      "Nach der Wiedereinspielung steht der Bestand unveraendert bei zwei Objekten.",
    ).toBe(2);
  });

  it("A2 · die woertlich gleiche Sicherung heisst weiterhin `identisch` und nennt das Objekt", async () => {
    const { app, headers, koIds } = await bestueckteApp();

    const { kandidaten, angenommen } = await spieleEin(app, headers, BESTAND);

    expect(angenommen.map((k) => k.koId)).toEqual([null, null]);
    expect(kandidaten.map((k) => k.dublettenbefund?.ergebnis)).toEqual(["identisch", "identisch"]);
    expect(kandidaten.map((k) => getroffenesKo(k.dublettenbefund)).sort()).toEqual(
      [...koIds].sort(),
    );
    const liste = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect((liste.json() as unknown[]).length).toBe(2);
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
    const { kandidaten, angenommen } = await spieleEin(app, headers, [
      {
        title: REICHES_KO.title.toUpperCase(),
        statement: `${REICHES_KO.statement}.`,
        type: REICHES_KO.type,
        category: REICHES_KO.category,
      },
    ]);

    expect(
      angenommen.map((k) => k.koId),
      "Ein gepflegtes Objekt darf durch seine eigene Sicherung nicht verdoppelt werden.",
    ).toEqual([null]);
    expect(kandidaten).toHaveLength(1);
    const befund = kandidaten[0]?.dublettenbefund;
    expect(befund?.ergebnis).toBe("aehnlich");
    expect(getroffenesKo(befund), "Die Antwort nennt das getroffene Objekt.").toBe(koId);
    expect(
      befund?.ergebnis === "aehnlich" ? befund.aehnlichkeit : undefined,
    ).toBeGreaterThanOrEqual(0.85);

    const liste = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(
      (liste.json() as unknown[]).length,
      "Der Bestand steht unveraendert bei einem Objekt.",
    ).toBe(1);
  });
});
