// ================================================================================================
// AUFTRAG-mega77 BLOCK A — DER UNGEPRÜFT-ZÄHLER IST WEG, UND ZWAR AM DRAHT.
// ================================================================================================
//
// WAS ENTFERNT WURDE UND WARUM. mega74 Teil 2b gab über den Antwortkörper von POST /api/ask eine
// Zahl aus: wie viele UNGEPRÜFTE (nicht validierte) Kandidaten die `validatedOnly`-Einschränkung
// unterdrückt hat. Zwei unabhängige Gründe, von denen jeder allein reicht:
//
//   1. SIE VERRIET. Gebildet wurde sie im AskService, der an dieser Stelle keinen Nutzer mit
//      Sichtbarkeitsvertrag kennt — also OHNE Betrachterfilter. Wer `validatedOnly` bekommt (der
//      Add-on-Principal mit `ask.validated`), hat gerade KEIN allgemeines Leserecht auf
//      unvalidierte Objekte, bekam aber ihre Anzahl. Eine gezielte Frage mit dem Ergebnis `1`
//      bestätigt die Existenz eines passenden unvalidierten Objekts; eng variierte Wiederholungen
//      machen daraus ein Abfrageorakel. Leckwirkung ab n = 1 — dieselbe Grenze wie mega76 Block D.
//
//   2. SIE STIMMTE NICHT. Gezählt wurde die bereits gedeckelte Vorauswahl, nicht der Bestand.
//
// WARUM DIESER TEST AN DER ROUTE STEHT UND NICHT AM MODUL. Das Feld war ein CLIENTVERTRAG: es reiste
// über den Antwortkörper. Ein Modultest könnte grün sein, während die Route das Feld aus einer
// zweiten Quelle wieder anhängt. Geprüft wird deshalb, was WIRKLICH über den Draht geht — und zwar
// gegen einen Bestand, in dem die Zahl nachweislich NICHT null gewesen wäre.
//
// ROT-ZUERST-KALIBRIERUNG: gegen die Fassung vor mega77 (mega74 Teil 2b) fällt dieser Test, weil
// der Körper `"ungeprueftUnterdrueckt": 1` trägt. Die Ausgabe steht wörtlich im Bericht.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

// Das Wort, das NUR im unvalidierten Objekt steht — es macht die Zahl beweisbar von null
// verschieden. Ohne diesen Treffer prüfte der Test nur, dass 0 nicht ausgegeben wird.
const SELTENES_WORT = "Zetaventilklemmring";

async function setup(): Promise<{ app: App; autor: { authorization: string } }> {
  // JOB 1591 D2: Der Add-on-Zugang wird scharfgeschaltet, damit mega77 A den UNBERECHTIGTEN
  // Betrachter ueberhaupt fahren kann. Ohne das Flag antwortet die Route mit 401, und der Fall
  // waere gruen, ohne je etwas gemessen zu haben.
  process.env.KLARWERK_ADDON_API = "1";
  process.env.KLARWERK_ADDON_API_KEY = "s3cr3t-addon-key-mega77";
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@mega77a.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@mega77a.test", password: "geheim12345" },
  });
  expect(login.statusCode, login.body).toBe(200);
  const autor = { authorization: `Bearer ${login.json().token}` };

  // Ein UNVALIDIERTES (Status „offen") Objekt, das zur Frage passt. Genau der Bestand, über den die
  // entfernte Zahl Auskunft gegeben hätte.
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: `Wartung ${SELTENES_WORT}`,
      statement: `Der ${SELTENES_WORT} wird vor jeder Wartung entlastet.`,
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(ko.statusCode, ko.body).toBe(201);
  expect(ko.json().status, "Der Testbestand muss UNVALIDIERT sein").toBe("offen");
  return { app, autor };
}

// ================================================================================================
// JOB 1591 · D2 — DER TEST WIRD PRAEZISIERT, NICHT ENTSCHAERFT.
// ================================================================================================
//
// ENTSCHEIDUNG `00_CONTROL/ENTSCHEIDUNGEN/JOB-1591.md` (21.08.2026, Aufsicht in Vollmacht Pedis):
// „mega77 verbietet das Wort ‚ungeprueft' im Body schlechthin; W5 zeigt es nur Berechtigten …
//  DER TEST IST ZU BREIT, NICHT W5 ZU KUEHN." Und: „Ein Schutz, der eine berechtigte Anzeige
//  verhindert, ist ungenau — aber er wird GESCHAERFT, NIE AUFGEWEICHT."
//
// WAS SICH AENDERT UND WAS AUSDRUECKLICH NICHT:
//   · Die Zusage `not.toContain("ungeprueft")` bleibt WOERTLICH stehen. Sie wird nicht gelockert,
//     nicht umformuliert, nicht verschoben.
//   · Was sich aendert, ist der FRAGENDE: bis D2 fragte hier ein angemeldeter Nutzer mit
//     `ko.read` — also ein BERECHTIGTER. Der Fall behauptete im Titel „ueber FREMDEN Bestand",
//     legte das Objekt aber mit DEMSELBEN Konto an, das danach fragte. Fremd war daran nichts.
//   · Ab D2 fragt hier der ADD-ON-PRINCIPAL. Das ist der Betrachter, den der Grabstein in
//     `services/ask/src/service.ts` beim Namen nennt: er besitzt `ask.validated` und gerade KEIN
//     allgemeines Leserecht auf unvalidierte Objekte. Fuer ihn — und nur fuer ihn — war die
//     entfernte Zahl ein Abfrageorakel.
//
// DAMIT MISST DIESER FALL AB JETZT DAS, WAS SEIN TITEL SEIT JE BEHAUPTET. Er ist strenger
// geworden, nicht milder: vorher konnte er von einem Betrachterfilter gar nichts wissen, weil er
// keinen unberechtigten Betrachter kannte.
//
// Der berechtigte Gegenfall steht direkt darunter (mega77 B). BEIDE muessen gruen sein.
const ADDON_KEY_HEADER = "x-klarwerk-addon-key";
const ADDON_KEY = "s3cr3t-addon-key-mega77";

describe("mega77 A · POST /api/ask trägt keine Zahl über fremden ungeprüften Bestand", () => {
  it("der Antwortkörper enthält weder das Feld noch seinen Namen — retrieval-only (validatedOnly)", async () => {
    const { app, autor } = await setup();

    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      // JOB 1591 D2: DER UNBERECHTIGTE. Kein Sitzungscookie, kein `ko.read` — der Add-on-Key.
      headers: { [ADDON_KEY_HEADER]: ADDON_KEY },
      // Genau der Modus des Word-Add-ins: validatedOnly + retrievalOnly. NUR in diesem Modus war
      // die entfernte Zahl überhaupt von null verschieden.
      payload: { question: `Was gilt für den ${SELTENES_WORT}?`, mode: "retrieval-only" },
    });
    expect(res.statusCode, res.body).toBe(200);

    const body = res.json() as Record<string, unknown>;
    // (a) Der Schlüssel existiert nicht — auch nicht mit dem Wert 0.
    expect(Object.keys(body), `Antwortschlüssel: ${Object.keys(body).join(", ")}`).not.toContain(
      "ungeprueftUnterdrueckt",
    );
    // (b) Und der Name kommt im ganzen Körper nicht vor (kein verschachteltes Wiederauftauchen).
    expect(res.body, `Antwortkörper: ${res.body}`).not.toContain("ungeprueft");

    // (c) DIE GEGENPROBE, ohne die dieser Test nichts bewiese: die Frage trifft wirklich ein
    // unvalidiertes Objekt — die entfernte Zahl wäre hier 1 gewesen, nicht 0.
    expect(
      body.result,
      "Ohne Wissenslücke hätte der Zähler auch vorher nichts zu melden gehabt",
    ).toMatchObject({ answered: false });
    const bestand = await app.inject({
      method: "GET",
      url: `/api/kos?q=${encodeURIComponent(SELTENES_WORT)}`,
      headers: autor,
    });
    expect(bestand.statusCode, bestand.body).toBe(200);
    const treffer = (bestand.json() as { status: string }[]).filter(
      (k) => k.status !== "validiert",
    );
    expect(
      treffer.length,
      "Der Bestand muss einen unvalidierten Treffer enthalten — sonst ist die Gegenprobe leer",
    ).toBeGreaterThan(0);
  });

  it("auch der normale Sitzungsweg trägt das Feld nicht", async () => {
    const { app, autor } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: autor,
      payload: { question: `Was gilt für den ${SELTENES_WORT}?` },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.body, `Antwortkörper: ${res.body}`).not.toContain("ungeprueftUnterdrueckt");
  });
});

// ================================================================================================
// JOB 1591 · D2 · AUFLAGE 2 — DER GEGENFALL. OHNE IHN IST mega77 A NUR EINE HALBE MESSUNG.
// ================================================================================================
//
// „Dazu kommt der Gegenfall: berechtigter Nutzer → der Hinweis erscheint. BEIDE FAELLE GRUEN,
//  sonst gilt W5 als nicht gebaut." (Entscheidung JOB-1591, Auflage 2)
//
// WARUM DIESES PAAR ZUSAMMENGEHOERT: Ein Verbot allein beweist nicht, dass es das Richtige
// verbietet. `not.toContain("ungeprueft")` waere auch dann gruen, wenn W5 gar nicht existierte,
// wenn es kaputt waere oder wenn es NIEMANDEM etwas anzeigte. Erst der Gegenfall zeigt, dass die
// Enge in mega77 A eine ENTSCHEIDUNG des Betrachterfilters ist und nicht seine Abwesenheit.
//
// DIE BEIDEN FAELLE UNTERSCHEIDEN SICH IN GENAU EINER SACHE: wer fragt.
// Gleicher Bestand, gleiche Frage, gleicher Modus.
describe("mega77 B · derselbe Bestand, dieselbe Frage — der BERECHTIGTE bekommt den Hinweis", () => {
  it("Sitzungsnutzer mit ko.read: der ungeprüfte Bestand wird gemeldet — mit Zustand, ohne Inhalt", async () => {
    const { app, autor } = await setup();

    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      // DER BERECHTIGTE: Sitzungscookie, `ko.read` — genau der Weg, den das Word-Panel faehrt.
      headers: autor,
      payload: { question: `Was gilt für den ${SELTENES_WORT}?`, mode: "retrieval-only" },
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json() as {
      ungeprueft?: Array<{ id: string; title: string; status: string }>;
    };

    // (a) Der Hinweis ERSCHEINT — und er ist eine Liste, kein `null`.
    expect(
      Array.isArray(body.ungeprueft),
      `Der Berechtigte muss den vorhandenen ungeprüften Bestand sehen. Antwortkörper: ${res.body}`,
    ).toBe(true);
    const treffer = (body.ungeprueft ?? []).find((h) => h.title.includes(SELTENES_WORT));
    expect(
      treffer,
      "Genau das Objekt, das mega77 A dem Unberechtigten verschweigt, muss hier erscheinen",
    ).toBeDefined();
    expect(treffer?.status).toBe("offen");

    // (b) DIE GRENZE BLEIBT: gemeldet wird die Existenz, nie der ungeprüfte INHALT.
    expect(
      res.body.includes(`Der ${SELTENES_WORT} wird vor jeder Wartung entlastet.`),
      "Ein ungeprüftes Objekt darf GEMELDET werden, nie BEHAUPTET — bens Fix 1 (P0)",
    ).toBe(false);

    // (c) UND DIE ENGE IST UNVERAENDERT: es wurde weiterhin NICHT aus ihm geantwortet.
    expect((res.json() as { result: { answered: boolean } }).result.answered).toBe(false);
  });
});
