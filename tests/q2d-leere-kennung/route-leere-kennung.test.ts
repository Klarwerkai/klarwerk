// ================================================================================================
// JOB 3424 (Q2d) — EIN WIEDERHOLTER IMPORT OHNE EXTERNE KENNUNG ANTWORTET EHRLICH.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT (Codex live, 05.09. 20:43, Fassungen 1.103 und 1.105):
// Zweimal dasselbe Item nach `POST /api/library/import/candidates`, beide Male mit
// `externalId: ""` — der erste Aufruf antwortete 201, der zweite INTERNAL 500.
//
// WAS DIESE DATEI MISST UND WAS SIE NICHT MESSEN KANN — die Grenze steht hier ausdrücklich, damit
// niemand sie später für eine Zusage hält:
//
//   · Diese Datei fährt die ECHTE Route über `buildApp(buildServices())`, also gegen die
//     IN-MEMORY-Warteschlange (`InMemoryCandidateRepo`). Dort gibt es keinen UNIQUE-Index; ein
//     `insert` kann dort gar nicht werfen. Der Live-Befund hing an Postgres. Auf DIESEM Weg ist
//     der 500 also nie herstellbar gewesen — gemessen, nicht angenommen (Fall L1).
//   · Der Postgres-Teil der Messung steht in `pg-leere-kennung.integration.test.ts` (echtes
//     Postgres, Lauf `test:integration`); die Deckung von Code-Regel und Index-Prädikat hält
//     `anker-vertrag.test.ts` im schnellen Tor fest.
//
// WARUM DER SCHALTER `confluenceImport` HIER AN IST: Ohne ihn ist `externalUpsert` aus, und dann
// nimmt JEDES Item den plain-insert-Weg — der Sonderfall der leeren Kennung wäre nicht mehr von
// einer gefüllten Kennung unterscheidbar. Der Fall U1 misst denselben Weg mit Schalter AUS.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ZUGANG = { name: "Admin", email: "q2d-leere-kennung@x.de", password: "secret123" };

const BASIS = {
  title: "Ventil entlueften",
  statement: "Bei Ueberdruck das Ventil X langsam entlueften",
  type: "best_practice" as const,
  category: "Wartung",
};

interface KandidatDto {
  id: string;
  duplicate: boolean;
  status: string;
  koId: string | null;
  dublettenbefund?: { ergebnis: string; treffer?: { art: string; koId?: string } };
}

async function angemeldeteApp() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  return { app, headers: { authorization: `Bearer ${login.json().token}` } };
}

type App = Awaited<ReturnType<typeof angemeldeteApp>>["app"];
type Headers = Record<string, string>;

/** Ein Import-Aufruf — OHNE Statuszusage, damit die Messung den Status wirklich mitteilen kann. */
async function importiere(app: App, headers: Headers, item: unknown) {
  return app.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers,
    payload: { items: [item] },
  });
}

/**
 * Der Kern jedes Falls: zweimal DASSELBE Item, die zwei Antworten roh zurück. Kein Fall darf sich
 * seine eigene Erwartung bauen — die Zusicherungen stehen unten, an jedem Fall einzeln.
 */
async function zweimal(item: unknown) {
  const { app, headers } = await angemeldeteApp();
  const erste = await importiere(app, headers, item);
  const zweite = await importiere(app, headers, item);
  return { app, headers, erste, zweite };
}

describe("JOB 3424 · Q2d — der zweite Import ohne externe Kennung", () => {
  const vorher = process.env.KLARWERK_CONFLUENCE_IMPORT;
  beforeAll(() => {
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
  });
  afterAll(() => {
    if (vorher === undefined) {
      delete process.env.KLARWERK_CONFLUENCE_IMPORT;
    } else {
      process.env.KLARWERK_CONFLUENCE_IMPORT = vorher;
    }
  });

  // ==============================================================================================
  // L1 — DER TRAGENDE FALL: LEERE ZEICHENKETTE, ZWEIMAL, LEERER BESTAND.
  // ==============================================================================================
  //
  // GEMESSEN (06.09., vor jeder Änderung dieses Jobs, In-Memory-Warteschlange): 201 und 201 — kein
  // 500. Der zweite Kandidat trägt `dublettenbefund: keine`, und DAS IST DIE WAHRHEIT dieses
  // Zustands: der erste Aufruf hat nur einen Eintrag in die REVIEW-WARTESCHLANGE gestellt, kein
  // Wissensobjekt. Es gibt also nichts, worauf er Dublette sein könnte. Der Fall L1b darunter zeigt
  // denselben zweiten Aufruf, nachdem der erste wirklich angenommen wurde — dort steht „identisch".
  it('L1 · externalId "": beide Aufrufe 201, kein 500, ehrlicher Befund "keine"', async () => {
    const { erste, zweite } = await zweimal({ ...BASIS, externalId: "" });

    expect(erste.statusCode, erste.body).toBe(201);
    expect(
      zweite.statusCode,
      `Der zweite Import antwortete ${zweite.statusCode}: ${zweite.body}`,
    ).not.toBe(500);
    expect(zweite.statusCode, zweite.body).toBe(201);

    const [kandidat] = zweite.json() as KandidatDto[];
    expect(kandidat, "Der zweite Aufruf reiht wirklich einen Kandidaten ein.").toBeDefined();
    expect(kandidat?.duplicate).toBe(false);
    expect(
      kandidat?.dublettenbefund?.ergebnis,
      "Ohne Wissensobjekt im Bestand ist die ehrliche Auskunft: kein Treffer — nicht Dublette.",
    ).toBe("keine");
  });

  // ==============================================================================================
  // L1b — DAS NUTZERVERSPRECHEN AUS DEM AUFTRAG, BIS ZUM ENDE: erst annehmen, dann wiederholen.
  // ==============================================================================================
  it('L1b · externalId "": nach Annahme des ersten Imports sagt der zweite „Dublette" — kein 500', async () => {
    const { app, headers, erste } = await zweimal({ ...BASIS, externalId: "" });
    expect(erste.statusCode, erste.body).toBe(201);
    const [ersterKandidat] = erste.json() as KandidatDto[];

    const angenommen = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${ersterKandidat?.id}`,
      headers,
      payload: { action: "accept" },
    });
    expect(angenommen.statusCode, angenommen.body).toBe(200);
    const koId = (angenommen.json() as KandidatDto).koId;
    expect(
      koId,
      "Vorbedingung: aus dem ersten Import ist ein Wissensobjekt geworden.",
    ).toBeTruthy();

    const dritte = await importiere(app, headers, { ...BASIS, externalId: "" });
    expect(dritte.statusCode, dritte.body).toBe(201);
    const [kandidat] = dritte.json() as KandidatDto[];
    expect(kandidat?.duplicate, "Derselbe Inhalt ein zweites Mal ist jetzt eine Dublette.").toBe(
      true,
    );
    expect(kandidat?.dublettenbefund?.ergebnis).toBe("identisch");
    expect(kandidat?.dublettenbefund?.treffer).toEqual({ art: "wissensobjekt", koId });
  });

  // ==============================================================================================
  // L2/L3 — DIE ZWEI NACHBARFÄLLE. Der Auftrag verlangt ausdrücklich die Antwort auf die Frage,
  // ob "" ein Sonderfall ist oder alle drei Schreibweisen gleich behandelt werden.
  // ==============================================================================================
  it("L2 · externalId null verhält sich Zeichen für Zeichen wie die leere Zeichenkette", async () => {
    const { erste, zweite } = await zweimal({ ...BASIS, externalId: null });
    expect(erste.statusCode, erste.body).toBe(201);
    expect(zweite.statusCode, zweite.body).toBe(201);
    const [kandidat] = zweite.json() as KandidatDto[];
    expect(kandidat?.duplicate).toBe(false);
    expect(kandidat?.dublettenbefund?.ergebnis).toBe("keine");
  });

  it("L3 · eine FEHLENDE externalId verhält sich Zeichen für Zeichen wie die leere Zeichenkette", async () => {
    const { erste, zweite } = await zweimal({ ...BASIS });
    expect(erste.statusCode, erste.body).toBe(201);
    expect(zweite.statusCode, zweite.body).toBe(201);
    const [kandidat] = zweite.json() as KandidatDto[];
    expect(kandidat?.duplicate).toBe(false);
    expect(kandidat?.dublettenbefund?.ergebnis).toBe("keine");
  });

  // ==============================================================================================
  // L4 — DIE GEGENRICHTUNG: eine ECHTE Kennung darf sich durch nichts von alledem ändern.
  // ==============================================================================================
  it("L4 · eine gefüllte externalId bleibt der idempotente Anker-Strang (zweiter Lauf reiht nichts ein)", async () => {
    const { erste, zweite } = await zweimal({ ...BASIS, externalId: "p1", provider: "Confluence" });
    expect(erste.statusCode, erste.body).toBe(201);
    expect(
      (erste.json() as KandidatDto[]).length,
      "Erstanlage reiht genau einen Kandidaten ein.",
    ).toBe(1);
    expect(zweite.statusCode, zweite.body).toBe(201);
    expect(
      (zweite.json() as KandidatDto[]).length,
      "Ein bereits offener Kandidat derselben Quelle wird NICHT erneut eingereiht (idempotent).",
    ).toBe(0);
  });

  // ==============================================================================================
  // U1 — DERSELBE WEG MIT SCHALTER AUS (der Default-Betrieb ohne externen Import).
  // ==============================================================================================
  it("U1 · ohne den Import-Schalter antworten beide Aufrufe ebenfalls 201, ohne 500", async () => {
    const gesetzt = process.env.KLARWERK_CONFLUENCE_IMPORT;
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
    try {
      const { erste, zweite } = await zweimal({ ...BASIS, externalId: "" });
      expect(erste.statusCode, erste.body).toBe(201);
      expect(zweite.statusCode, zweite.body).not.toBe(500);
      expect(zweite.statusCode, zweite.body).toBe(201);
      expect((zweite.json() as KandidatDto[])[0]?.dublettenbefund?.ergebnis).toBe("keine");
    } finally {
      if (gesetzt !== undefined) {
        process.env.KLARWERK_CONFLUENCE_IMPORT = gesetzt;
      }
    }
  });
});
