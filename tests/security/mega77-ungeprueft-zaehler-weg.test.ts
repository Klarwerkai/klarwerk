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

describe("mega77 A · POST /api/ask trägt keine Zahl über fremden ungeprüften Bestand", () => {
  it("der Antwortkörper enthält weder das Feld noch seinen Namen — retrieval-only (validatedOnly)", async () => {
    const { app, autor } = await setup();

    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: autor,
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
