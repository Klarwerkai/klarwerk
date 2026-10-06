// ================================================================================================
// R-0116 / R-0143 — IMPORTKANDIDATEN GENAU EINMAL: DER ZWEITE UPLOAD SIEHT DIE OFFENE WARTESCHLANGE.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT (HEAD bf9fcf1c, `createImportCandidates`): der
// Vergleichsbestand des Textwegs bestand aus dem KO-Bestand und den Kandidaten DESSELBEN Laufs.
// Wurde dieselbe Datei zweimal hochgeladen, bevor jemand geprüft hatte, standen zwei Kandidaten
// mit `keine` in der Warteschlange — und zwei `accept` legten zwei Wissensobjekte an.
//
// AM DRAHT GEBAUT (wie `kandidatenweg.test.ts`): die Dublettenregel reist als Port aus der
// Kompositionswurzel in den Dienst; nur die echte Route misst die Naht.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KandidatDublettenbefund } from "../../services/library-analytics";

const ZUGANG = { name: "Admin", email: "offene-warteschlange@x.de", password: "secret123" };

interface KandidatDto {
  id: string;
  duplicate: boolean;
  koId: string | null;
  status: string;
  dublettenbefund?: KandidatDublettenbefund;
}

const EINTRAG = {
  title: "Filter tauschen",
  statement: "Den Ansaugfilter alle 500 Betriebsstunden tauschen",
  type: "best_practice",
  category: "Wartung",
};

async function angemeldeteApp() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  return { app, headers };
}

type App = Awaited<ReturnType<typeof angemeldeteApp>>["app"];
type Headers = Record<string, string>;

async function reiheEin(app: App, headers: Headers, items: unknown[]): Promise<KandidatDto[]> {
  const res = await app.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers,
    payload: { items },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as KandidatDto[];
}

async function entscheide(
  app: App,
  headers: Headers,
  id: string,
  action: "accept" | "reject" | "info",
): Promise<KandidatDto> {
  const res = await app.inject({
    method: "PUT",
    url: `/api/library/import/candidates/${id}`,
    headers,
    payload: { action },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as KandidatDto;
}

async function koTitel(app: App, headers: Headers): Promise<string[]> {
  const liste = await app.inject({ method: "GET", url: "/api/kos", headers });
  expect(liste.statusCode, liste.body).toBe(200);
  return (liste.json() as { title: string }[]).map((ko) => ko.title);
}

describe("R-0116 · der zweite Upload derselben Datei trifft den noch offenen Kandidaten", () => {
  it("O1 · wörtlich gleich: `identisch` mit Kandidatenkennung — zwei Annahmen, EIN Wissensobjekt", async () => {
    const { app, headers } = await angemeldeteApp();
    const [erster] = await reiheEin(app, headers, [EINTRAG]);
    expect(erster?.duplicate).toBe(false);

    const [zweiter] = await reiheEin(app, headers, [EINTRAG]);
    expect(zweiter?.duplicate, "Der zweite Upload darf keine zweite Karteikarte vorbereiten.").toBe(
      true,
    );
    expect(zweiter?.dublettenbefund).toEqual({
      ergebnis: "identisch",
      treffer: { art: "kandidat", kandidatId: erster?.id },
    });

    // Die Nutzenkette bis zum Ende: beide werden angenommen, genau ein Objekt entsteht.
    const eins = await entscheide(app, headers, erster?.id ?? "", "accept");
    expect(eins.koId).toBeTruthy();
    const zwei = await entscheide(app, headers, zweiter?.id ?? "", "accept");
    expect(zwei.koId, "Die Dublette legt kein zweites Wissensobjekt an.").toBeNull();
    expect(await koTitel(app, headers)).toEqual([EINTRAG.title]);
  });

  it("O2 · leicht verändert (Satzpunkt, Schreibweise): `aehnlich` auf den offenen Kandidaten", async () => {
    const { app, headers } = await angemeldeteApp();
    const [erster] = await reiheEin(app, headers, [EINTRAG]);
    const [zweiter] = await reiheEin(app, headers, [
      { ...EINTRAG, title: EINTRAG.title.toUpperCase(), statement: `${EINTRAG.statement}.` },
    ]);
    const befund = zweiter?.dublettenbefund;
    if (befund?.ergebnis !== "aehnlich") {
      throw new Error(`Erwartet 'aehnlich', erhalten: ${JSON.stringify(befund)}`);
    }
    expect(befund.treffer).toEqual({ art: "kandidat", kandidatId: erster?.id });
    expect(zweiter?.duplicate).toBe(true);
  });

  it("O3 · ein abgelehnter Kandidat blockiert nichts: der neue Upload ist wieder aufnahmefähig", async () => {
    const { app, headers } = await angemeldeteApp();
    const [erster] = await reiheEin(app, headers, [EINTRAG]);
    await entscheide(app, headers, erster?.id ?? "", "reject");

    const [zweiter] = await reiheEin(app, headers, [EINTRAG]);
    expect(zweiter?.duplicate).toBe(false);
    expect(zweiter?.dublettenbefund).toEqual({ ergebnis: "keine" });
  });

  it("O4 · ein Kandidat mit angeforderter Nachinformation blockiert ebenfalls nichts", async () => {
    const { app, headers } = await angemeldeteApp();
    const [erster] = await reiheEin(app, headers, [EINTRAG]);
    await entscheide(app, headers, erster?.id ?? "", "info");

    const [zweiter] = await reiheEin(app, headers, [EINTRAG]);
    expect(zweiter?.duplicate).toBe(false);
  });

  it("O5 · nach der Annahme nennt der Befund das Wissensobjekt, nicht mehr den Kandidaten", async () => {
    const { app, headers } = await angemeldeteApp();
    const [erster] = await reiheEin(app, headers, [EINTRAG]);
    const angenommen = await entscheide(app, headers, erster?.id ?? "", "accept");

    const [zweiter] = await reiheEin(app, headers, [EINTRAG]);
    expect(zweiter?.dublettenbefund).toEqual({
      ergebnis: "identisch",
      treffer: { art: "wissensobjekt", koId: angenommen.koId },
    });
  });

  it("O6 · ein als Dublette erkannter offener Kandidat wird nicht zum Treffer weiterer Uploads", async () => {
    const { app, headers } = await angemeldeteApp();
    const [erster] = await reiheEin(app, headers, [EINTRAG]);
    await reiheEin(app, headers, [EINTRAG]);
    const [dritter] = await reiheEin(app, headers, [EINTRAG]);
    // Der Treffer ist der ERSTE (aufnahmefähige) Kandidat, nie die Dublette dazwischen.
    expect(dritter?.dublettenbefund).toEqual({
      ergebnis: "identisch",
      treffer: { art: "kandidat", kandidatId: erster?.id },
    });
  });
});
